#!/bin/sh
set -eu

PORT_VALUE=$(printf '%s' "${PORT:-8080}" | tr -d '[:space:]')
case "$PORT_VALUE" in
  ''|*[!0-9]*)
    echo 'PORT must resolve to a numeric TCP port' >&2
    exit 1
    ;;
esac

VOICE_KEY=$(printf '%s' "${VOICETUT_API_KEY:-}" | tr -d '[:space:]')
VOICE_KEY=${VOICE_KEY#VOICETUT_API_KEYS=}
VOICE_KEY=${VOICE_KEY#VOICETUT_API_KEY=}
VOICE_KEY=$(printf '%s' "$VOICE_KEY" | sed 's/^"//;s/"$//')
case "$VOICE_KEY" in
  ''|*[!A-Za-z0-9_-]*)
    echo 'VOICETUT_API_KEY must resolve to a non-empty URL-safe token' >&2
    exit 1
    ;;
esac

case "${VOICETUT_UPSTREAM:-}" in
  https://*.api.runpod.ai) ;;
  *)
    echo 'VOICETUT_UPSTREAM must be an HTTPS RunPod API host' >&2
    exit 1
    ;;
esac

sed \
  -e "s|__PORT__|$PORT_VALUE|g" \
  -e "s|__VOICETUT_UPSTREAM__|$VOICETUT_UPSTREAM|g" \
  -e "s|__VOICETUT_API_KEY__|$VOICE_KEY|g" \
  /etc/nginx/nginx.conf.template > /tmp/openvenice-nginx.conf
chmod 600 /tmp/openvenice-nginx.conf

exec nginx -c /tmp/openvenice-nginx.conf -g 'daemon off;'
