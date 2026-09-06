#!/bin/sh
set -eu

PORT_VALUE=$(printf '%s' "${PORT:-8080}" | tr -d '[:space:]')
case "$PORT_VALUE" in
  ''|*[!0-9]*)
    echo 'PORT must resolve to a numeric TCP port' >&2
    exit 1
    ;;
esac

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
    -e 's/&/\\\&/g' \
    -e 's/|/\\|/g'
}

VOICE_KEY=$(normalize_credential "${VOICETUT_API_KEY:-}")
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

UPSTREAM_VALUE=${VOICETUT_UPSTREAM:-}
case "$UPSTREAM_VALUE" in
  https://*.api.runpod.ai) ;;
  *)
    echo 'VOICETUT_UPSTREAM must be an HTTPS RunPod API host' >&2
    exit 1
    ;;
esac

sed \
  -e "s|__PORT__|$PORT_VALUE|g" \
  -e "s|__VOICETUT_UPSTREAM__|$UPSTREAM_VALUE|g" \
  -e "s|__VOICETUT_API_KEY__|$SED_VOICE_KEY|g" \
  -e "s|__RUNPOD_API_KEY__|$SED_RUNPOD_KEY|g" \
  /etc/nginx/nginx.conf.template > /tmp/openvenice-nginx.conf
chmod 600 /tmp/openvenice-nginx.conf

exec nginx -c /tmp/openvenice-nginx.conf -g 'daemon off;'
