#!/usr/bin/env bash
set -euo pipefail

# Pod was recreated 2026-09-11 (new id q6wseo4cjwhvn6, image open-webui:v0.11.3).
# The RunPod proxy hostname embeds the pod id, so every pod recreation
# changes it. Prefer OWUI_URL env (repo variable or secret) over this default.
OWUI_URL="${OWUI_URL:-https://q6wseo4cjwhvn6-8080.proxy.runpod.net}"
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
