#!/usr/bin/env bash
set -euo pipefail

OUT=${1:-/tmp/openrouter_models.json}
REQUIRED=(
  "openai/gpt-5.6-sol"
  "openai/gpt-5.6-sol-pro"
  "openai/gpt-5.6-luna"
  "anthropic/claude-opus-5"
  "anthropic/claude-fable-5.1"
  "google/gemini-3.8-flash"
  "x-ai/grok-4.6"
)

code=$(curl -sS -m 30 -o "$OUT" -w "%{http_code}" https://openrouter.ai/api/v1/models || true)
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
