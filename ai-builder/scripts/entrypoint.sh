#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${WORKSPACE_ROOT:-/workspace}"
PROJECT_DIR="$WORKSPACE/projects/openvenice"
STATE="$WORKSPACE/state"
TOOLS="$WORKSPACE/tools"
RUNTIME_ENV="$STATE/runtime-paths.env"
PY_VENV="$TOOLS/python"

log() { printf '[ai-builder-entrypoint] %s\n' "$*"; }

: "${OPENCODE_SERVER_PASSWORD:?OPENCODE_SERVER_PASSWORD must be injected as a runtime secret}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN must be injected as a runtime secret}"
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY must be injected as a runtime secret}"
: "${HF_TOKEN:?HF_TOKEN must be injected as a runtime secret}"
: "${RUNPOD_API_KEY:?RUNPOD_API_KEY must be injected as a runtime secret}"

if ! mountpoint -q "$WORKSPACE" 2>/dev/null; then
  echo "$WORKSPACE is not a distinct mounted volume; refusing to run with ephemeral state" >&2
  exit 1
fi

mkdir -p "$WORKSPACE/projects" "$STATE" "$TOOLS" "$WORKSPACE/logs"

# The source checkout itself lives on persistent storage. Clone only when the
# volume is new; never reset an existing working tree on startup because the
# builder may legitimately have in-progress work.
if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  log "Initializing persistent openvenice checkout"
  git clone https://github.com/haithamelhusseinycv-cyber/openvenice.git "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# RunPod container-local packages may disappear when the container is recreated.
# Keep this command baseline aligned with bootstrap.sh COMMON_PACKAGES so a fresh
# image cannot silently reuse stale persistent state with a partial toolchain.
need_bootstrap=0
required_commands=(
  git git-lfs node npm python3 curl wget jq gh
  make cmake rg fdfind rsync sqlite3
  java adb ffmpeg pandoc convert
)
for cmd in "${required_commands[@]}"; do
  command -v "$cmd" >/dev/null 2>&1 || need_bootstrap=1
done

# bootstrap.sh enforces Node >=20; startup must enforce the same invariant.
node_major=0
if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'process.versions.node.split(`.`)[0]' 2>/dev/null || echo 0)"
fi
if ! [[ "$node_major" =~ ^[0-9]+$ ]] || (( node_major < 20 )); then
  need_bootstrap=1
fi

if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
  need_bootstrap=1
fi

# Persistent tool state must be complete, not merely present in part.
if [[ ! -x "$TOOLS/npm/bin/opencode" || ! -x "$TOOLS/npm/bin/pnpm" || ! -x "$TOOLS/bin/runpodctl" ]]; then
  need_bootstrap=1
fi
if [[ ! -x "$PY_VENV/bin/python" || ! -x "$PY_VENV/bin/uv" ]]; then
  need_bootstrap=1
fi
if [[ ! -f "$STATE/bootstrap-versions.txt" || ! -f "$RUNTIME_ENV" ]]; then
  need_bootstrap=1
fi

# Explicit maintenance requests must run bootstrap even when the current
# installation is otherwise healthy.
if [[ "${AI_BUILDER_FORCE_BOOTSTRAP:-0}" == "1" ||
      "${AI_BUILDER_UPGRADE_OPENCODE:-0}" == "1" ||
      "${AI_BUILDER_UPGRADE_TOOLCHAIN:-0}" == "1" ]]; then
  need_bootstrap=1
fi

if (( need_bootstrap == 1 )); then
  log "Running idempotent AI Builder bootstrap for this container"
  bash ai-builder/scripts/bootstrap.sh
fi

if [[ -f "$RUNTIME_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$RUNTIME_ENV"
else
  echo "Missing runtime environment manifest: $RUNTIME_ENV" >&2
  exit 1
fi

# Refresh Git's environment-backed credential helper on every container start;
# it references GITHUB_TOKEN at invocation time and never writes the token value.
git config --global credential.https://github.com.helper '!f() { if [ "$1" = get ]; then echo username=x-access-token; echo password="$GITHUB_TOKEN"; fi; }; f'
git config --global user.name "${GIT_USER_NAME:-AI Builder}"
git config --global user.email "${GIT_USER_EMAIL:-ai-builder@local.invalid}"

# Ensure the configured primary agent is discoverable before exposing the web UI.
if ! opencode agent list 2>/dev/null | grep -qi 'builder-max'; then
  echo "builder-max agent is not discoverable; refusing to start" >&2
  exit 1
fi

export OPENCODE_SERVER_USERNAME="${OPENCODE_SERVER_USERNAME:-opencode}"
log "Starting OpenCode Web in foreground on 0.0.0.0:4096"
exec opencode web --hostname 0.0.0.0 --port 4096
