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

for d in "$WORKSPACE" "$WORKSPACE/projects" "$WORKSPACE/state" "$WORKSPACE/logs"; do
  if [[ -d "$d" && -w "$d" ]]; then ok "$d exists and is writable"; else fail "$d missing or not writable"; fi
done

marker="$STATE/.persistence-write-test"
printf '%s\n' "$(date -u +%s)" > "$marker"
[[ -s "$marker" ]] && ok "persistent workspace write/read test" || fail "persistent workspace write/read test"

if mountpoint -q "$WORKSPACE" 2>/dev/null; then
  ok "$WORKSPACE is a mount point"
else
  warn "$WORKSPACE is not reported as a distinct mount point; confirm RunPod persistent/network volume mapping before production use"
fi

for v in RUNPOD_API_KEY GITHUB_TOKEN OPENROUTER_API_KEY HF_TOKEN OPENCODE_SERVER_PASSWORD; do
  if [[ -n "${!v:-}" ]]; then ok "$v is present"; else fail "$v is missing"; fi
done

for cmd in opencode git node npm python3 curl jq gh runpodctl; do
  if command -v "$cmd" >/dev/null 2>&1; then ok "$cmd available"; else fail "$cmd unavailable"; fi
done

if command -v opencode >/dev/null 2>&1; then
  ok "OpenCode version: $(opencode --version 2>/dev/null || echo unknown)"
fi

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
