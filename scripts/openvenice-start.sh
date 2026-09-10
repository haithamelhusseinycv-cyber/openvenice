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

# --- Open-model AI gateway (/ai/v1) -------------------------------------------
# QWEN_UPSTREAM is an HTTPS OpenAI-compatible root (e.g. https://host/v1) and
# QWEN_API_KEY is its private token. Both are injected here and never shipped to
# the browser. When either is missing the gateway fails closed with HTTP 503 so
# the frontend can fall back to its configured external provider.
RAW_AI_KEY=${QWEN_API_KEY:-}
AI_UPSTREAM_VALUE=${QWEN_UPSTREAM:-}

if [ -z "$RAW_AI_KEY" ] && [ -z "$AI_UPSTREAM_VALUE" ]; then
  printf '%s\n' \
    'location = /ai/v1/health { limit_except GET { deny all; } default_type application/json; return 503 '\''{"ok":false,"gateway":"ai-v1","configured":false}'\''; add_header Cache-Control "no-store" always; }' \
    'location /ai/v1/ { default_type application/json; return 503 '\''{"error":"AI gateway is disabled"}'\''; add_header Cache-Control "no-store" always; }' \
    > /tmp/openvenice-ai.conf
  echo 'AI gateway disabled; chat uses the configured external provider' >&2
else
  if [ -z "$RAW_AI_KEY" ] || [ -z "$AI_UPSTREAM_VALUE" ]; then
    echo 'QWEN_UPSTREAM and QWEN_API_KEY must both be set to enable the AI gateway' >&2
    exit 1
  fi

  AI_KEY=$(normalize_credential "$RAW_AI_KEY")
  AI_KEY=${AI_KEY#QWEN_API_KEY=}
  if [ -z "$AI_KEY" ] || printf '%s' "$AI_KEY" | LC_ALL=C grep -q '[^!-~]'; then
    echo 'QWEN_API_KEY must resolve to a non-empty printable credential without whitespace or control characters' >&2
    exit 1
  fi
  SED_AI_KEY=$(escape_for_nginx_and_sed "$AI_KEY")

  case "$AI_UPSTREAM_VALUE" in
    https://*) ;;
    *)
      echo 'QWEN_UPSTREAM must be an HTTPS OpenAI-compatible root such as https://host.example/v1' >&2
      exit 1
      ;;
  esac
  case "$AI_UPSTREAM_VALUE" in
    *' '*|*'	'*)
      echo 'QWEN_UPSTREAM must not contain whitespace' >&2
      exit 1
      ;;
  esac
  AI_UPSTREAM_VALUE=$(printf '%s' "$AI_UPSTREAM_VALUE" | sed 's:/*$::')

  sed -e "s|__AI_UPSTREAM__|$AI_UPSTREAM_VALUE|g" \
      -e "s|__AI_API_KEY__|$SED_AI_KEY|g" \
    /etc/nginx/nginx.ai.conf.template > /tmp/openvenice-ai.conf
  echo 'AI gateway enabled' >&2
fi

sed \
  -e "s|__PORT__|$PORT_VALUE|g" \
  /etc/nginx/nginx.conf.template > /tmp/openvenice-nginx.conf
chmod 600 /tmp/openvenice-nginx.conf /tmp/openvenice-voicetut.conf

exec nginx -c /tmp/openvenice-nginx.conf -g 'daemon off;'
