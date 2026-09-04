#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${WORKSPACE_ROOT:-/workspace}"
STATE="$WORKSPACE/state"
FAIL=0

ok()   { printf '[OK]   %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }
fail() { printf '[FAIL] %s\n' "$*"; FAIL=1; }

if [[ -f "$STATE/runtime-paths.env" ]]; then
  # shellcheck disable=SC1090
  source "$STATE/runtime-paths.env"
fi

printf '%s\n' 'AI Builder verification'
printf '%s\n' '-----------------------'

for d in "$WORKSPACE" "$WORKSPACE/projects" "$STATE" "$WORKSPACE/logs" "$WORKSPACE/tools"; do
  if [[ -d "$d" && -w "$d" ]]; then ok "$d exists and is writable"; else fail "$d missing or not writable"; fi
done

# Persistence is a hard requirement. A writable directory inside an ephemeral
# container is not sufficient.
if mountpoint -q "$WORKSPACE" 2>/dev/null; then
  ok "$WORKSPACE is a distinct mount point"
else
  fail "$WORKSPACE is not a distinct mount point; persistent RunPod storage is required"
fi

marker="$STATE/.persistence-write-test"
printf '%s\n' "$(date -u +%s)" > "$marker"
[[ -s "$marker" ]] && ok "persistent workspace write/read test" || fail "persistent workspace write/read test"

for v in RUNPOD_API_KEY GITHUB_TOKEN OPENROUTER_API_KEY HF_TOKEN OPENCODE_SERVER_PASSWORD; do
  if [[ -n "${!v:-}" ]]; then ok "$v is present"; else fail "$v is missing"; fi
done

for cmd in opencode git node npm python3 curl jq gh runpodctl java adb ffmpeg pandoc; do
  if command -v "$cmd" >/dev/null 2>&1; then ok "$cmd available"; else fail "$cmd unavailable"; fi
done

if command -v chromium >/dev/null 2>&1 || command -v chromium-browser >/dev/null 2>&1; then
  ok "Chromium browser available"
else
  fail "Chromium browser unavailable"
fi

if command -v pnpm >/dev/null 2>&1; then ok "pnpm available"; else fail "pnpm unavailable"; fi

if command -v opencode >/dev/null 2>&1; then
  ok "OpenCode version: $(opencode --version 2>/dev/null || echo unknown)"
  if opencode agent list 2>/dev/null | grep -qi 'builder-max'; then
    ok "builder-max agent is discoverable"
  else
    fail "builder-max agent is not discoverable"
  fi
fi

# Verify that state/config paths resolve inside the persistent volume. OpenCode
# keeps auth/session/log data under XDG_DATA_HOME and personal rules under
# XDG_CONFIG_HOME, so these must never point at disposable container storage.
for pair in \
  "XDG_CONFIG_HOME:${XDG_CONFIG_HOME:-}" \
  "XDG_DATA_HOME:${XDG_DATA_HOME:-}" \
  "XDG_CACHE_HOME:${XDG_CACHE_HOME:-}" \
  "XDG_STATE_HOME:${XDG_STATE_HOME:-}" \
  "NPM_CONFIG_PREFIX:${NPM_CONFIG_PREFIX:-}"; do
  name="${pair%%:*}"
  value="${pair#*:}"
  case "$value" in
    "$WORKSPACE"/*) ok "$name is persistent ($value)" ;;
    *) fail "$name is not rooted under $WORKSPACE" ;;
  esac
done

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  if GH_TOKEN="$GITHUB_TOKEN" gh api repos/haithamelhusseinycv-cyber/openvenice --jq '.full_name' >/dev/null 2>&1; then
    ok "GitHub token can read openvenice"
  else
    fail "GitHub token cannot read openvenice"
  fi
fi

if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  model_count="$(curl -fsS https://openrouter.ai/api/v1/models \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" 2>/dev/null | jq '.data | length' 2>/dev/null || echo 0)"
  if [[ "$model_count" =~ ^[0-9]+$ ]] && (( model_count > 0 )); then
    ok "OpenRouter reachable; catalog returned $model_count models"
  else
    fail "OpenRouter authenticated model-catalog request failed"
  fi
fi

if [[ -n "${HF_TOKEN:-}" ]]; then
  if curl -fsS https://huggingface.co/api/whoami-v2 \
      -H "Authorization: Bearer $HF_TOKEN" >/dev/null 2>&1; then
    ok "Hugging Face token authenticated"
  else
    fail "Hugging Face authentication failed"
  fi
fi

if [[ -n "${RUNPOD_API_KEY:-}" ]] && command -v runpodctl >/dev/null 2>&1; then
  if runpodctl user >/dev/null 2>&1; then
    ok "RunPod API key authenticated through runpodctl"
  else
    fail "RunPod API key authentication failed through runpodctl"
  fi
fi

if [[ -n "${OPENCODE_SERVER_PASSWORD:-}" ]]; then
  user="${OPENCODE_SERVER_USERNAME:-opencode}"
  if curl -fsS -u "$user:$OPENCODE_SERVER_PASSWORD" http://127.0.0.1:4096/ >/dev/null 2>&1; then
    ok "OpenCode Web responds locally on port 4096"
  else
    fail "OpenCode Web is not responding locally on port 4096"
  fi
fi

if [[ -f "$STATE/bootstrap-versions.txt" ]]; then
  ok "bootstrap version manifest exists"
else
  warn "bootstrap version manifest not found"
fi

if (( FAIL != 0 )); then
  printf '\nVerification FAILED. Resolve the failed checks before declaring the builder ready.\n' >&2
  exit 1
fi

printf '\nAll required local verification checks passed.\n'
