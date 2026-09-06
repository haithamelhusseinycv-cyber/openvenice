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
if [ -z "$VOICE_KEY" ] || printf '%s' "$VOICE_KEY" | LC_ALL=C grep -q '[^!-~]'; then
  echo 'VOICETUT_API_KEY must resolve to a non-empty printable credential without whitespace or control characters' >&2
  exit 1
fi

# Escape the opaque credential first for an Nginx double-quoted string, then
# for sed's replacement syntax. This preserves provider-issued punctuation
# without allowing the secret to alter the generated Nginx configuration.
NGINX_VOICE_KEY=$(printf '%s' "$VOICE_KEY" | sed \
  -e 's/\\/\\\\/g' \
  -e 's/"/\\"/g' \
  -e 's/\$/\\$/g')
SED_VOICE_KEY=$(printf '%s' "$NGINX_VOICE_KEY" | sed \
  -e 's/\\/\\\\/g' \
  -e 's/&/\\\&/g' \
  -e 's/|/\\|/g')

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
  /etc/nginx/nginx.conf.template > /tmp/openvenice-nginx.conf
chmod 600 /tmp/openvenice-nginx.conf

exec nginx -c /tmp/openvenice-nginx.conf -g 'daemon off;'
