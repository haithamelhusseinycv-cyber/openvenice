#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${WORKSPACE_ROOT:-/workspace}"
STATE="$WORKSPACE/state"
LOG_DIR="$WORKSPACE/logs"
PID_FILE="$STATE/opencode-web.pid"

log() { printf '[ai-builder] %s\n' "$*"; }

if [[ -f "$STATE/runtime-paths.env" ]]; then
  # shellcheck disable=SC1090
  source "$STATE/runtime-paths.env"
fi

: "${OPENCODE_SERVER_PASSWORD:?OPENCODE_SERVER_PASSWORD must be injected as a runtime secret}"
export OPENCODE_SERVER_USERNAME="${OPENCODE_SERVER_USERNAME:-opencode}"
export OPENCODE_CONFIG="${OPENCODE_CONFIG:-$STATE/opencode-config/opencode.json}"
export HF_HOME="${HF_HOME:-$WORKSPACE/models/huggingface}"

mkdir -p "$LOG_DIR" "$STATE" "$WORKSPACE/projects"

endpoint_healthy() {
  curl -fsS -u "$OPENCODE_SERVER_USERNAME:$OPENCODE_SERVER_PASSWORD" \
    http://127.0.0.1:4096/ >/dev/null 2>&1
}

if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    if endpoint_healthy; then
      log "OpenCode Web is already running and authenticated on port 4096 (PID $old_pid)"
      exit 0
    fi
    log "Stale or unrelated PID $old_pid found; OpenCode endpoint is not healthy. Removing PID file."
  fi
  rm -f "$PID_FILE"
fi

# A healthy authenticated endpoint without our PID file is still an existing
# OpenCode instance; do not start a duplicate listener.
if endpoint_healthy; then
  log "OpenCode Web is already responding on port 4096"
  exit 0
fi

cd "$WORKSPACE/projects"
log "Starting OpenCode Web on 0.0.0.0:4096"
nohup opencode web --hostname 0.0.0.0 --port 4096 \
  >"$LOG_DIR/opencode-web.log" 2>&1 &
pid=$!
printf '%s\n' "$pid" > "$PID_FILE"

for _ in $(seq 1 30); do
  if endpoint_healthy; then
    log "OpenCode Web is responding locally with authentication"
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$PID_FILE"
    log "OpenCode exited unexpectedly; recent log output follows"
    tail -n 80 "$LOG_DIR/opencode-web.log" || true
    exit 1
  fi
  sleep 1
done

rm -f "$PID_FILE"
log "OpenCode process is running but did not become reachable within 30 seconds"
tail -n 80 "$LOG_DIR/opencode-web.log" || true
exit 1
