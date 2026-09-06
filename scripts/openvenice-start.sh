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

RAW_VOICE_KEY=${VOICETUT_API_KEY:-}
UPSTREAM_VALUE=${VOICETUT_UPSTREAM:-}

if [ -z "$RAW_VOICE_KEY" ] && [ -z "$UPSTREAM_VALUE" ]; then
  printf '%s\n' \
    'location = /voicetut/health { default_type application/json; return 503 '\''{"ok":false,"loaded":false,"disabled":true}'\''; add_header Cache-Control "no-store" always; }' \
    'location /voicetut/ { default_type application/json; return 503 '\''{"error":"VoiceTut proxy is disabled"}'\''; add_header Cache-Control "no-store" always; }' \
    > /tmp/openvenice-voicetut.conf
  echo 'VoiceTut proxy disabled; using Venice TTS fallback' >&2
else
  if [ -z "$RAW_VOICE_KEY" ] || [ -z "$UPSTREAM_VALUE" ]; then
    echo 'VOICETUT_API_KEY and VOICETUT_UPSTREAM must both be set to enable VoiceTut' >&2
    exit 1
  fi

RAW_LEN=$(printf '%s' "$RAW_VOICE_KEY" | wc -c | tr -d '[:space:]')
HAS_WHITESPACE=false
HAS_COLON=false
HAS_DOLLAR=false
HAS_SLASH=false
HAS_BEARER=false
HAS_AUTHORIZATION=false
printf '%s' "$RAW_VOICE_KEY" | grep -q '[[:space:]]' && HAS_WHITESPACE=true || true
printf '%s' "$RAW_VOICE_KEY" | grep -q ':' && HAS_COLON=true || true
printf '%s' "$RAW_VOICE_KEY" | grep -q '\$' && HAS_DOLLAR=true || true
printf '%s' "$RAW_VOICE_KEY" | grep -q '/' && HAS_SLASH=true || true
printf '%s' "$RAW_VOICE_KEY" | grep -qi 'bearer' && HAS_BEARER=true || true
printf '%s' "$RAW_VOICE_KEY" | grep -qi 'authorization' && HAS_AUTHORIZATION=true || true
printf 'VOICETUT_API_KEY shape raw_len=%s whitespace=%s colon=%s dollar=%s slash=%s bearer=%s authorization=%s\n' \
  "$RAW_LEN" "$HAS_WHITESPACE" "$HAS_COLON" "$HAS_DOLLAR" "$HAS_SLASH" "$HAS_BEARER" "$HAS_AUTHORIZATION" >&2

VOICE_KEY=$(printf '%s' "$RAW_VOICE_KEY" | tr -d '[:space:]')
VOICE_KEY=${VOICE_KEY#VOICETUT_API_KEYS=}
VOICE_KEY=${VOICE_KEY#VOICETUT_API_KEY=}
VOICE_KEY=$(printf '%s' "$VOICE_KEY" | sed 's/^"//;s/"$//')
case "$VOICE_KEY" in
  ''|*[!A-Za-z0-9_-]*)
    echo 'VOICETUT_API_KEY must resolve to a non-empty URL-safe token' >&2
    exit 1
    ;;
esac

UPSTREAM_LEN=$(printf '%s' "$UPSTREAM_VALUE" | wc -c | tr -d '[:space:]')
UPSTREAM_HTTPS=false
UPSTREAM_RUNPOD=false
case "$UPSTREAM_VALUE" in https://*) UPSTREAM_HTTPS=true ;; esac
case "$UPSTREAM_VALUE" in *.api.runpod.ai|https://*.api.runpod.ai) UPSTREAM_RUNPOD=true ;; esac
printf 'VOICETUT_UPSTREAM shape len=%s https=%s runpod_host=%s\n' "$UPSTREAM_LEN" "$UPSTREAM_HTTPS" "$UPSTREAM_RUNPOD" >&2

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

  sed -e "s|__VOICETUT_UPSTREAM__|$UPSTREAM_VALUE|g" /etc/nginx/nginx.voicetut.conf.template |
    while IFS= read -r line; do
      case "$line" in
        '  proxy_set_header Authorization "Bearer __VOICETUT_API_KEY__";')
          printf '  proxy_set_header Authorization "Bearer %s";\n' "$VOICE_KEY"
          ;;
        *) printf '%s\n' "$line" ;;
      esac
    done > /tmp/openvenice-voicetut.conf
fi

sed \
  -e "s|__PORT__|$PORT_VALUE|g" \
  /etc/nginx/nginx.conf.template > /tmp/openvenice-nginx.conf
chmod 600 /tmp/openvenice-nginx.conf /tmp/openvenice-voicetut.conf

exec nginx -c /tmp/openvenice-nginx.conf -g 'daemon off;'
