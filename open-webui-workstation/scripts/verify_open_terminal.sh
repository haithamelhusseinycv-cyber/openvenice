#!/usr/bin/env bash
set -euo pipefail

: "${OPEN_TERMINAL_URL:?Set OPEN_TERMINAL_URL to the terminal service URL}"
: "${OPEN_TERMINAL_API_KEY:?Set OPEN_TERMINAL_API_KEY without printing it}"

OPEN_TERMINAL_URL="${OPEN_TERMINAL_URL%/}"
user_agent='Shahy-Open-Terminal-Check/1.0'
work_dir="$(mktemp -d)"
trap 'find "$work_dir" -type f -delete 2>/dev/null || true; rmdir "$work_dir" 2>/dev/null || true' EXIT

health_file="$work_dir/health.json"
schema_file="$work_dir/openapi.json"

health_code="$(
  curl --silent --show-error --fail-with-body --max-time 20 \
    --user-agent "$user_agent" \
    --output "$health_file" \
    --write-out '%{http_code}' \
    "$OPEN_TERMINAL_URL/health"
)"

if [[ "$health_code" != "200" ]]; then
  echo "Open Terminal health check failed: HTTP $health_code" >&2
  exit 1
fi

jq -e '.status == "ok" or .status == true' "$health_file" >/dev/null

schema_code="$(
  curl --silent --show-error --fail-with-body --max-time 20 \
    --user-agent "$user_agent" \
    --header "Authorization: Bearer $OPEN_TERMINAL_API_KEY" \
    --output "$schema_file" \
    --write-out '%{http_code}' \
    "$OPEN_TERMINAL_URL/openapi.json"
)"

if [[ "$schema_code" != "200" ]]; then
  echo "Open Terminal schema check failed: HTTP $schema_code" >&2
  exit 1
fi

jq -e '.openapi and (.paths | type == "object") and (.paths | length > 0)' \
  "$schema_file" >/dev/null

echo "Open Terminal endpoint verification passed"

