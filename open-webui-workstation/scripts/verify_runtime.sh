#!/usr/bin/env bash
set -euo pipefail

OWUI_URL="${OWUI_URL:-https://8rhrqskupcsqvq-8080.proxy.runpod.net}"
OWUI_URL="${OWUI_URL%/}"
UA='Shahy-Deployment-Check/1.0'
failed=0

echo "[runtime] url=$OWUI_URL"

for path in /health /api/version /api/config; do
  response_file=$(mktemp)
  code=$(curl -sS --fail-with-body -m 20 -A "$UA" -o "$response_file" -w "%{http_code}" "$OWUI_URL$path" || true)
  echo "path=$path http=$code"
  head -c 300 "$response_file" || true
  echo
  rm -f "$response_file"

  if [[ "$code" != "200" ]]; then
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo "Shahy runtime verification failed" >&2
  exit 1
fi

echo "Shahy runtime verification passed"
