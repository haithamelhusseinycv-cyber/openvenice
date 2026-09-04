#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILDER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="${WORKSPACE_ROOT:-/workspace}"
STATE="$WORKSPACE/state"
CONFIG_STATE="$STATE/opencode-config"
DATA_STATE="$STATE/opencode-data"
CACHE_STATE="$STATE/opencode-cache"

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
$SUDO mkdir -p "$WORKSPACE"/{projects,state,tools,artifacts,models,logs,backups}
$SUDO chown -R "$(id -u):$(id -g)" "$WORKSPACE" || true
for d in "$WORKSPACE" "$WORKSPACE/projects" "$STATE"; do
  test -d "$d" && test -w "$d" || { echo "$d is not writable" >&2; exit 1; }
done

log "Installing base engineering packages"
$SUDO apt-get update -y
DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y \
  ca-certificates curl wget git git-lfs gh jq unzip zip tar xz-utils \
  build-essential make cmake pkg-config ripgrep fd-find tree \
  python3 python3-pip python3-venv python3-dev \
  openssh-client rsync sqlite3 \
  ffmpeg imagemagick pandoc \
  default-jdk-headless adb \
  chromium-browser 2>/dev/null || \
DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y \
  ca-certificates curl wget git git-lfs gh jq unzip zip tar xz-utils \
  build-essential make cmake pkg-config ripgrep fd-find tree \
  python3 python3-pip python3-venv python3-dev \
  openssh-client rsync sqlite3 \
  ffmpeg imagemagick pandoc \
  default-jdk-headless adb chromium

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

log "Installing current stable OpenCode"
$SUDO npm install -g opencode-ai@latest

log "Installing common developer CLIs"
$SUDO npm install -g pnpm@latest || true
python3 -m pip install --break-system-packages --upgrade pip uv huggingface_hub >/dev/null 2>&1 || true

if ! command -v runpodctl >/dev/null 2>&1; then
  log "Installing RunPod CLI"
  curl -sSL https://cli.runpod.net | $SUDO bash
fi

log "Persisting OpenCode configuration and session state"
mkdir -p "$CONFIG_STATE/agents" "$DATA_STATE" "$CACHE_STATE"
cp "$BUILDER_DIR/config/opencode.json" "$CONFIG_STATE/opencode.json"
cp "$BUILDER_DIR/config/AGENTS.md" "$CONFIG_STATE/AGENTS.md"
cp "$BUILDER_DIR/config/agents/"*.md "$CONFIG_STATE/agents/"

mkdir -p "$HOME/.config" "$HOME/.local/share" "$HOME/.cache"
if [[ -e "$HOME/.config/opencode" && ! -L "$HOME/.config/opencode" ]]; then
  mv "$HOME/.config/opencode" "$HOME/.config/opencode.pre-ai-builder.$(date +%s)"
fi
if [[ -e "$HOME/.local/share/opencode" && ! -L "$HOME/.local/share/opencode" ]]; then
  mv "$HOME/.local/share/opencode" "$HOME/.local/share/opencode.pre-ai-builder.$(date +%s)"
fi
if [[ -e "$HOME/.cache/opencode" && ! -L "$HOME/.cache/opencode" ]]; then
  mv "$HOME/.cache/opencode" "$HOME/.cache/opencode.pre-ai-builder.$(date +%s)"
fi
ln -sfn "$CONFIG_STATE" "$HOME/.config/opencode"
ln -sfn "$DATA_STATE" "$HOME/.local/share/opencode"
ln -sfn "$CACHE_STATE" "$HOME/.cache/opencode"

log "Configuring Git to consume GITHUB_TOKEN from the runtime environment without embedding its value"
git config --global credential.https://github.com.helper '!f() { if [ "$1" = get ]; then echo username=x-access-token; echo password="$GITHUB_TOKEN"; fi; }; f'
git config --global user.name "${GIT_USER_NAME:-AI Builder}"
git config --global user.email "${GIT_USER_EMAIL:-ai-builder@local.invalid}"
git config --global init.defaultBranch master

mkdir -p "$WORKSPACE/models/huggingface"

cat > "$STATE/runtime-paths.env" <<EOF
export WORKSPACE_ROOT="$WORKSPACE"
export OPENCODE_CONFIG="$CONFIG_STATE/opencode.json"
export HF_HOME="$WORKSPACE/models/huggingface"
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
} > "$STATE/bootstrap-versions.txt"

log "Bootstrap complete"
log "Next: inject secrets through RunPod environment and run ai-builder/scripts/start.sh"
