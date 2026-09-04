#!/usr/bin/env bash
set -euo pipefail

OWUI_URL="${OWUI_URL:-https://c7togjwbwnqjqi-8080.proxy.runpod.net}"
UA='Mozilla/5.0'

echo "[runtime] url=$OWUI_URL"

for path in /health /api/version /api/config; do
  code=$(curl -sS -m 20 -A "$UA" -o /tmp/owui_resp.json -w "%{http_code}" "$OWUI_URL$path" || true)
  echo "path=$path http=$code"
  head -c 300 /tmp/owui_resp.json || true
  echo
  echo "---"
done
