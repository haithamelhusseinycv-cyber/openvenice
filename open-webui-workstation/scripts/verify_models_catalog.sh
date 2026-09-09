#!/usr/bin/env bash
set -euo pipefail

: "${OPENCODE_API_KEY:?Set OPENCODE_API_KEY without printing it}"

OUT=${1:-/tmp/opencode_zen_models.json}
REQUIRED=(
  "gpt-5.6-sol"
  "gpt-5.6-luna"
  "gpt-6-astra"
  "grok-4.6"
)

code=$(
  curl -sS -m 30 \
    -H "Authorization: Bearer $OPENCODE_API_KEY" \
    -o "$OUT" -w "%{http_code}" \
    https://opencode.ai/zen/v1/models || true
)
echo "catalog_http=$code"
if [[ "$code" != "200" ]]; then
  echo "catalog_unavailable"
  exit 2
fi

for id in "${REQUIRED[@]}"; do
  if jq -e --arg id "$id" '.data[] | select(.id==$id)' "$OUT" > /dev/null; then
    echo "present $id"
  else
    echo "missing $id"
  fi
done
