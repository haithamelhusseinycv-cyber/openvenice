#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILDER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="${WORKSPACE_ROOT:-/workspace}"
STATE="$WORKSPACE/state"
TOOLS="$WORKSPACE/tools"
NPM_PREFIX="$TOOLS/npm"
XDG_ROOT="$STATE/xdg"
CONFIG_HOME="$XDG_ROOT/config"
DATA_HOME="$XDG_ROOT/data"
CACHE_HOME="$XDG_ROOT/cache"
STATE_HOME="$XDG_ROOT/state"
OPENCODE_DIR="$CONFIG_HOME/opencode"

log() { printf '[ai-builder] %s\n' "$*"; }

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  echo "bootstrap requires root or sudo for system packages" >&2
  exit 1
fi

log "Preparing persistent workspace"
$SUDO mkdir -p "$WORKSPACE"/{projects,state,tools,artifacts,models,logs,backups,home}
$SUDO mkdir -p "$NPM_PREFIX" "$TOOLS/bin" "$CONFIG_HOME" "$DATA_HOME" "$CACHE_HOME" "$STATE_HOME"
$SUDO chown -R "$(id -u):$(id -g)" "$WORKSPACE" || true
for d in "$WORKSPACE" "$WORKSPACE/projects" "$STATE" "$TOOLS"; do
  test -d "$d" && test -w "$d" || { echo "$d is not writable" >&2; exit 1; }
done

# OpenCode honors XDG_CONFIG_HOME and XDG_DATA_HOME. Keep all application
# configuration, credentials, session DBs, logs, caches, and installed npm
# binaries on the RunPod persistent volume rather than the disposable container.
export XDG_CONFIG_HOME="$CONFIG_HOME"
export XDG_DATA_HOME="$DATA_HOME"
export XDG_CACHE_HOME="$CACHE_HOME"
export XDG_STATE_HOME="$STATE_HOME"
export NPM_CONFIG_PREFIX="$NPM_PREFIX"
export PATH="$NPM_PREFIX/bin:$TOOLS/bin:$PATH"
export OPENCODE_CONFIG="$OPENCODE_DIR/opencode.json"
export OPENCODE_CONFIG_DIR="$OPENCODE_DIR"
export HF_HOME="$WORKSPACE/models/huggingface"
export GIT_CONFIG_GLOBAL="$STATE/gitconfig"

log "Installing/confirming engineering packages in the current container"
$SUDO apt-get update -y
COMMON_PACKAGES=(
  ca-certificates curl wget git git-lfs gh jq unzip zip tar xz-utils
  build-essential make cmake pkg-config ripgrep fd-find tree
  python3 python3-pip python3-venv python3-dev
  openssh-client rsync sqlite3
  ffmpeg imagemagick pandoc
  default-jdk-headless adb
)
DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y "${COMMON_PACKAGES[@]}"
if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y chromium-browser 2>/dev/null || \
    DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y chromium
fi

git lfs install --skip-repo >/dev/null 2>&1 || true

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(`.`)[0]' 2>/dev/null || echo 0)"
fi
if (( NODE_MAJOR < 20 )); then
  log "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
  DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y nodejs
fi

log "Installing current stable OpenCode into persistent tool storage"
npm install -g --prefix "$NPM_PREFIX" opencode-ai@latest

log "Installing common developer CLIs into persistent tool storage"
npm install -g --prefix "$NPM_PREFIX" pnpm@latest || true
python3 -m pip install --user --upgrade pip uv huggingface_hub >/dev/null 2>&1 || \
  python3 -m pip install --break-system-packages --upgrade pip uv huggingface_hub >/dev/null 2>&1 || true

# The RunPod installer location can vary. After installation copy/link the
# resolved binary into persistent storage so a fresh container can reuse it.
if ! command -v runpodctl >/dev/null 2>&1 && [[ ! -x "$TOOLS/bin/runpodctl" ]]; then
  log "Installing RunPod CLI"
  curl -sSL https://cli.runpod.net | $SUDO bash
fi
if command -v runpodctl >/dev/null 2>&1; then
  runpodctl_path="$(command -v runpodctl)"
  if [[ "$runpodctl_path" != "$TOOLS/bin/runpodctl" ]]; then
    cp "$runpodctl_path" "$TOOLS/bin/runpodctl" 2>/dev/null || true
    chmod 755 "$TOOLS/bin/runpodctl" 2>/dev/null || true
  fi
fi

log "Persisting OpenCode configuration and agent policy"
mkdir -p "$OPENCODE_DIR/agents" "$DATA_HOME/opencode" "$CACHE_HOME/opencode" "$STATE_HOME/opencode"
cp "$BUILDER_DIR/config/opencode.json" "$OPENCODE_DIR/opencode.json"
cp "$BUILDER_DIR/config/AGENTS.md" "$OPENCODE_DIR/AGENTS.md"
cp "$BUILDER_DIR/config/agents/"*.md "$OPENCODE_DIR/agents/"

log "Configuring Git without embedding secret values"
git config --global credential.https://github.com.helper '!f() { if [ "$1" = get ]; then echo username=x-access-token; echo password="$GITHUB_TOKEN"; fi; }; f'
git config --global user.name "${GIT_USER_NAME:-AI Builder}"
git config --global user.email "${GIT_USER_EMAIL:-ai-builder@local.invalid}"
git config --global init.defaultBranch master

mkdir -p "$WORKSPACE/models/huggingface"

cat > "$STATE/runtime-paths.env" <<EOF
export WORKSPACE_ROOT="$WORKSPACE"
export XDG_CONFIG_HOME="$CONFIG_HOME"
export XDG_DATA_HOME="$DATA_HOME"
export XDG_CACHE_HOME="$CACHE_HOME"
export XDG_STATE_HOME="$STATE_HOME"
export NPM_CONFIG_PREFIX="$NPM_PREFIX"
export PATH="$NPM_PREFIX/bin:$TOOLS/bin:\$PATH"
export OPENCODE_CONFIG="$OPENCODE_DIR/opencode.json"
export OPENCODE_CONFIG_DIR="$OPENCODE_DIR"
export HF_HOME="$WORKSPACE/models/huggingface"
export GIT_CONFIG_GLOBAL="$STATE/gitconfig"
export OPENCODE_SERVER_USERNAME="${OPENCODE_SERVER_USERNAME:-opencode}"
EOF
chmod 600 "$STATE/runtime-paths.env"

{
  printf 'installed_at=%s\n' "$(date -u +%FT%TZ)"
  printf 'opencode=%s\n' "$(opencode --version 2>/dev/null || echo unknown)"
  printf 'node=%s\n' "$(node --version 2>/dev/null || echo unknown)"
  printf 'npm=%s\n' "$(npm --version 2>/dev/null || echo unknown)"
  printf 'python=%s\n' "$(python3 --version 2>/dev/null || echo unknown)"
  printf 'git=%s\n' "$(git --version 2>/dev/null || echo unknown)"
  printf 'java=%s\n' "$(java -version 2>&1 | head -n1 || echo unknown)"
} > "$STATE/bootstrap-versions.txt"

log "Bootstrap complete"
log "Persistent OpenCode state: $DATA_HOME/opencode"
log "Next: run ai-builder/scripts/entrypoint.sh (foreground) or start.sh (background/debug)"
