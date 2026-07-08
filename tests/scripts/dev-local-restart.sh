#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
FAKE_BIN="$TMP_DIR/bin"
STATE_FILE="$TMP_DIR/tmux-windows"
LOG_FILE="$TMP_DIR/tmux.log"
REAL_SESSIONS=()

cleanup() {
  if command -v tmux >/dev/null 2>&1; then
    for session in "${REAL_SESSIONS[@]}"; do
      tmux kill-session -t "$session" >/dev/null 2>&1 || true
    done
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$FAKE_BIN"

cat > "$FAKE_BIN/tmux" <<'FAKE_TMUX'
#!/usr/bin/env bash
set -euo pipefail

state_file="${RADULATOR_FAKE_TMUX_STATE:?}"
log_file="${RADULATOR_FAKE_TMUX_LOG:?}"
cmd="${1:-}"
shift || true

log() {
  printf "%s\n" "$*" >> "$log_file"
}

target_window() {
  local target=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -t)
        target="${2:-}"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done
  printf "%s\n" "${target#*:}"
}

window_name_arg() {
  local name=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -n)
        name="${2:-}"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done
  printf "%s\n" "$name"
}

window_exists() {
  local name="$1"
  [ -f "$state_file" ] && grep -qx "$name" "$state_file"
}

case "$cmd" in
  has-session)
    [ -f "$state_file" ]
    ;;
  list-windows)
    [ -f "$state_file" ] || exit 1
    cat "$state_file"
    ;;
  new-window)
    [ -f "$state_file" ] || exit 1
    name="$(window_name_arg "$@")"
    [ -n "$name" ] || exit 1
    if window_exists "$name"; then
      exit 1
    fi
    log "new-window $name"
    printf "%s\n" "$name" >> "$state_file"
    ;;
  kill-window)
    [ -f "$state_file" ] || exit 1
    name="$(target_window "$@")"
    if ! window_exists "$name"; then
      exit 1
    fi
    log "kill-window $name"
    grep -vx "$name" "$state_file" > "$state_file.next" || true
    mv "$state_file.next" "$state_file"
    if [ ! -s "$state_file" ]; then
      rm -f "$state_file"
    fi
    ;;
  send-keys)
    name="$(target_window "$@")"
    window_exists "$name"
    ;;
  *)
    printf "unexpected tmux command: %s\n" "$cmd" >&2
    exit 2
    ;;
esac
FAKE_TMUX
chmod +x "$FAKE_BIN/tmux"

fake_restart_case() {
  local target="$1"

  printf "%s\n" "$target" > "$STATE_FILE"
  : > "$LOG_FILE"

  PATH="$FAKE_BIN:$PATH" \
  RADULATOR_FAKE_TMUX_STATE="$STATE_FILE" \
  RADULATOR_FAKE_TMUX_LOG="$LOG_FILE" \
    "$ROOT/scripts/dev-local.sh" restart "$target" > "$TMP_DIR/fake-$target.out"

  grep -qx "$target" "$STATE_FILE"
  if grep -q "_restart_${target}_" "$STATE_FILE"; then
    printf "restart keeper window was not cleaned up for %s\n" "$target" >&2
    exit 1
  fi

  grep -qx "new-window _restart_${target}_[0-9][0-9]*" "$LOG_FILE"
  grep -qx "kill-window $target" "$LOG_FILE"
  grep -qx "new-window $target" "$LOG_FILE"
}

real_tmux_restart_case() {
  local target="$1"
  local session="radulator-dev-local-test-${target}-$$"
  REAL_SESSIONS+=("$session")

  tmux kill-session -t "$session" >/dev/null 2>&1 || true
  tmux new-session -d -s "$session" -n "$target" -c "$ROOT"

  RADULATOR_TMUX_SESSION="$session" \
  RADULATOR_DEV_PORT=58991 \
  RADULATOR_PREVIEW_PORT=58992 \
    "$ROOT/scripts/dev-local.sh" restart "$target" > "$TMP_DIR/real-$target.out"

  tmux has-session -t "$session"
  tmux list-windows -t "$session" -F '#{window_name}' > "$TMP_DIR/real-$target-windows"
  grep -qx "$target" "$TMP_DIR/real-$target-windows"
  if grep -q "_restart_${target}_" "$TMP_DIR/real-$target-windows"; then
    printf "real tmux keeper window was not cleaned up for %s\n" "$target" >&2
    exit 1
  fi
}

fake_restart_case dev
fake_restart_case preview

if command -v tmux >/dev/null 2>&1; then
  real_tmux_restart_case dev
  real_tmux_restart_case preview
fi
