#!/bin/sh
set -eu
umask 077

PORT_VALUE=${PORT:-8080}
case "$PORT_VALUE" in
  ''|*[!0-9]*)
    echo 'PORT must resolve to a numeric TCP port' >&2
    exit 1
    ;;
esac
if [ "$PORT_VALUE" -lt 1 ] || [ "$PORT_VALUE" -gt 65535 ]; then
  echo 'PORT must be between 1 and 65535' >&2
  exit 1
fi

normalize_credential() {
  printf '%s' "$1" | tr -d '[:space:]' | sed 's/^"//;s/"$//'
}

escape_for_nginx_and_sed() {
  value=$1
  nginx_value=$(printf '%s' "$value" | sed \
    -e 's/\\/\\\\/g' \
    -e 's/"/\\"/g' \
    -e 's/\$/\\$/g')
  printf '%s' "$nginx_value" | sed \
    -e 's/\\/\\\\/g' \
    -e 's/&/\\&/g' \
    -e 's/|/\\|/g'
}

RAW_VOICE_KEY=${VOICETUT_API_KEY:-}
UPSTREAM_VALUE=${VOICETUT_UPSTREAM:-}

if [ -z "$RAW_VOICE_KEY" ] && [ -z "$UPSTREAM_VALUE" ]; then
  printf '%s\n' \
    'location = /voicetut/health { default_type application/json; return 503 '\''{"ok":false,"loaded":false,"disabled":true}'\''; add_header Cache-Control "no-store" always; }' \
    'location /voicetut/ { default_type application/json; return 503 '\''{"error":"VoiceTut proxy is disabled"}'\''; add_header Cache-Control "no-store" always; }' \
    > /tmp/openvenice-voicetut.conf
  echo 'VoiceTut proxy disabled; Noor will use the Venice TTS fallback' >&2
else
  if [ -z "$RAW_VOICE_KEY" ] || [ -z "$UPSTREAM_VALUE" ]; then
    echo 'VOICETUT_API_KEY and VOICETUT_UPSTREAM must both be set to enable VoiceTut' >&2
    exit 1
  fi

  VOICE_KEY=$(normalize_credential "$RAW_VOICE_KEY")
  VOICE_KEY=${VOICE_KEY#VOICETUT_API_KEYS=}
  VOICE_KEY=${VOICE_KEY#VOICETUT_API_KEY=}
  if [ -z "$VOICE_KEY" ] || printf '%s' "$VOICE_KEY" | LC_ALL=C grep -q '[^!-~]'; then
    echo 'VOICETUT_API_KEY must resolve to a non-empty printable credential without whitespace or control characters' >&2
    exit 1
  fi
  SED_VOICE_KEY=$(escape_for_nginx_and_sed "$VOICE_KEY")

  RUNPOD_KEY=$(normalize_credential "${RUNPOD_API_KEY:-}")
  RUNPOD_KEY=${RUNPOD_KEY#RUNPOD_API_KEY=}
  if [ -z "$RUNPOD_KEY" ]; then
    # Keep the OpenVenice web app available while the platform credential is
    # being configured. VoiceTut requests will fail closed at RunPod's gateway.
    RUNPOD_KEY=$VOICE_KEY
    echo 'RUNPOD_API_KEY is not configured; VoiceTut gateway requests may be rejected' >&2
  elif printf '%s' "$RUNPOD_KEY" | LC_ALL=C grep -q '[^!-~]'; then
    echo 'RUNPOD_API_KEY must resolve to a printable credential without whitespace or control characters' >&2
    exit 1
  fi
  SED_RUNPOD_KEY=$(escape_for_nginx_and_sed "$RUNPOD_KEY")

  case "$UPSTREAM_VALUE" in
    https://*.api.runpod.ai) ;;
    *)
      echo 'VOICETUT_UPSTREAM must be an HTTPS RunPod API host' >&2
      exit 1
      ;;
  esac
  UPSTREAM_HOST=${UPSTREAM_VALUE#https://}
  case "$UPSTREAM_HOST" in
    ''|*[!A-Za-z0-9.-]*|.*|-*|*..*|*-.*|*.-*)
      echo 'VOICETUT_UPSTREAM must be an origin-only RunPod API hostname' >&2
      exit 1
      ;;
  esac

  sed -e "s|__VOICETUT_UPSTREAM__|$UPSTREAM_VALUE|g" \
      -e "s|__VOICETUT_API_KEY__|$SED_VOICE_KEY|g" \
      -e "s|__RUNPOD_API_KEY__|$SED_RUNPOD_KEY|g" \
    /etc/nginx/nginx.voicetut.conf.template > /tmp/openvenice-voicetut.conf
fi

sed \
  -e "s|__PORT__|$PORT_VALUE|g" \
  /etc/nginx/nginx.conf.template > /tmp/openvenice-nginx.conf
chmod 600 /tmp/openvenice-nginx.conf /tmp/openvenice-voicetut.conf

CONNECTOR_CONF=/tmp/openvenice-connectors.conf
CONNECTOR_TEMPLATE=/etc/nginx/nginx.connectors.conf.template
if [ ! -f "$CONNECTOR_TEMPLATE" ]; then
  CONNECTOR_TEMPLATE=/tmp/openvenice/nginx.connectors.conf.template
fi
: > "$CONNECTOR_CONF"

append_disabled_connector() {
  prefix=$1
  name=$2
  printf '%s\n' \
    "location = ${prefix}/health { default_type application/json; return 503 '{\"ok\":false,\"configured\":false}'; add_header Cache-Control \"no-store\" always; }" \
    "location ${prefix}/ { default_type application/json; return 503 '{\"error\":\"${name} connector is not configured\"}'; add_header Cache-Control \"no-store\" always; }" \
    >> "$CONNECTOR_CONF"
}

emit_connector() {
  section=$1
  prefix=$2
  name=$3
  raw=$4
  placeholder=$5
  token=$(normalize_credential "$raw")
  if [ -z "$token" ]; then
    append_disabled_connector "$prefix" "$name"
    printf 'false'
    return 0
  fi
  if printf '%s' "$token" | LC_ALL=C grep -q '[^!-~]'; then
    echo "${name} token must be printable without whitespace or control characters" >&2
    exit 1
  fi
  escaped=$(escape_for_nginx_and_sed "$token")
  awk "/# BEGIN ${section}/,/# END ${section}/" "$CONNECTOR_TEMPLATE" \
    | sed -e "s|${placeholder}|${escaped}|g" \
    >> "$CONNECTOR_CONF"
  printf 'true'
}

GITHUB_RAW=${GITHUB_CONNECTOR_TOKEN:-${GITHUB_TOKEN:-}}
GITHUB_JSON=$(emit_connector github /connectors/github GitHub "$GITHUB_RAW" '__GITHUB_TOKEN__')
GRAPH_JSON=$(emit_connector graph /connectors/graph 'Microsoft Graph' "${MICROSOFT_GRAPH_TOKEN:-}" '__MICROSOFT_GRAPH_TOKEN__')
EXA_JSON=$(emit_connector exa /connectors/exa Exa "${EXA_API_KEY:-}" '__EXA_API_KEY__')
TAVILY_JSON=$(emit_connector tavily /connectors/tavily Tavily "${TAVILY_API_KEY:-}" '__TAVILY_API_KEY__')

printf '%s\n' \
  'location = /connectors/status {' \
  '  default_type application/json;' \
  "  return 200 '{\"github\":${GITHUB_JSON},\"graph\":${GRAPH_JSON},\"exa\":${EXA_JSON},\"tavily\":${TAVILY_JSON}}';" \
  '  add_header Cache-Control "no-store" always;' \
  '}' \
  >> "$CONNECTOR_CONF"

chmod 600 "$CONNECTOR_CONF"
echo "Shahy connectors: github=${GITHUB_JSON} graph=${GRAPH_JSON} exa=${EXA_JSON} tavily=${TAVILY_JSON}" >&2

exec nginx -c /tmp/openvenice-nginx.conf -g 'daemon off;'

