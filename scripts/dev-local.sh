#!/usr/bin/env bash
# Radulator local development launcher.
#
# Usage:
#   scripts/dev-local.sh up              # start Vite dev server in tmux
#   scripts/dev-local.sh preview          # build and start Vite preview in tmux
#   scripts/dev-local.sh status           # tmux windows + port checks
#   scripts/dev-local.sh logs <dev|preview>
#   scripts/dev-local.sh restart <dev|preview>
#   scripts/dev-local.sh attach
#   scripts/dev-local.sh down
#
set -euo pipefail

SESSION="radulator-dev"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_PORT="${RADULATOR_DEV_PORT:-5173}"
PREVIEW_PORT="${RADULATOR_PREVIEW_PORT:-4173}"

c_reset=$'\033[0m'; c_dim=$'\033[2m'; c_grn=$'\033[32m'; c_ylw=$'\033[33m'; c_red=$'\033[31m'; c_cyn=$'\033[36m'
say()  { printf "%s\n" "$*"; }
info() { printf "${c_cyn}▸ %s${c_reset}\n" "$*"; }
ok()   { printf "${c_grn}✓ %s${c_reset}\n" "$*"; }
warn() { printf "${c_ylw}! %s${c_reset}\n" "$*"; }
die()  { printf "${c_red}✗ %s${c_reset}\n" "$*" >&2; exit 1; }

port_up() {
  lsof -ti TCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

require_tmux() {
  command -v tmux >/dev/null 2>&1 || die "tmux not found. Install with: brew install tmux"
}

preflight() {
  require_tmux
  command -v npm >/dev/null 2>&1 || die "npm not found. Install Node/npm first."
  [ -f "$ROOT/package.json" ] || die "package.json not found at $ROOT"
  [ -d "$ROOT/node_modules" ] || die "Dependencies missing. Run: npm ci"
}

ensure_session() {
  tmux has-session -t "$SESSION" 2>/dev/null || tmux new-session -d -s "$SESSION" -n _bootstrap -c "$ROOT"
}

start_window() {
  local name="$1" cmd="$2"
  if tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | grep -qx "$name"; then
    warn "window '$name' already exists — leaving it alone"
    return
  fi
  tmux new-window -t "$SESSION" -n "$name" -c "$ROOT"
  tmux send-keys -t "$SESSION:$name" "$cmd" C-m
}

kill_bootstrap() {
  tmux kill-window -t "$SESSION:_bootstrap" >/dev/null 2>&1 || true
}

port_report() {
  say "  Port status (${c_dim}· = not listening yet${c_reset}):"
  if port_up "$DEV_PORT"; then printf "    ${c_grn}●${c_reset} %-14s :%s\n" "dev" "$DEV_PORT"; else printf "    ${c_dim}·${c_reset} %-14s :%s\n" "dev" "$DEV_PORT"; fi
  if port_up "$PREVIEW_PORT"; then printf "    ${c_grn}●${c_reset} %-14s :%s\n" "preview" "$PREVIEW_PORT"; else printf "    ${c_dim}·${c_reset} %-14s :%s\n" "preview" "$PREVIEW_PORT"; fi
}

cmd_up() {
  preflight
  ensure_session
  start_window "dev" "npm run dev -- --host 127.0.0.1 --port $DEV_PORT"
  kill_bootstrap
  ok "Radulator dev server starting in tmux session '$SESSION'."
  say "  URL: http://127.0.0.1:$DEV_PORT"
  port_report
  say "${c_dim}  Logs:   scripts/dev-local.sh logs dev${c_reset}"
  say "${c_dim}  Attach: scripts/dev-local.sh attach   (Ctrl-b d to detach)${c_reset}"
  say "${c_dim}  Stop:   scripts/dev-local.sh down${c_reset}"
}

cmd_preview() {
  preflight
  ensure_session
  start_window "preview" "npm run build && npm run preview -- --host 127.0.0.1 --port $PREVIEW_PORT"
  kill_bootstrap
  ok "Radulator preview server building/starting in tmux session '$SESSION'."
  say "  URL: http://127.0.0.1:$PREVIEW_PORT"
  port_report
}

cmd_status() {
  if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$SESSION" 2>/dev/null; then
    info "tmux '$SESSION' windows:"
    tmux list-windows -t "$SESSION" -F '    #{window_index}: #{window_name}'
  else
    warn "tmux session '$SESSION' not running"
  fi
  echo
  port_report
}

cmd_logs() {
  local name="${1:-}"
  [ -n "$name" ] || die "usage: scripts/dev-local.sh logs <dev|preview>"
  require_tmux
  tmux has-session -t "$SESSION" 2>/dev/null || die "session '$SESSION' not running"
  tmux capture-pane -p -S -400 -t "$SESSION:$name"
}

cmd_restart() {
  local name="${1:-}"
  [ -n "$name" ] || die "usage: scripts/dev-local.sh restart <dev|preview>"
  require_tmux
  tmux has-session -t "$SESSION" 2>/dev/null || die "session '$SESSION' not running"
  tmux kill-window -t "$SESSION:$name" >/dev/null 2>&1 || true
  case "$name" in
    dev) start_window "dev" "npm run dev -- --host 127.0.0.1 --port $DEV_PORT" ;;
    preview) start_window "preview" "npm run build && npm run preview -- --host 127.0.0.1 --port $PREVIEW_PORT" ;;
    *) die "unknown window '$name'" ;;
  esac
  ok "restarted $name"
}

cmd_attach() {
  require_tmux
  tmux has-session -t "$SESSION" 2>/dev/null || die "session '$SESSION' not running — start with scripts/dev-local.sh up"
  tmux attach -t "$SESSION"
}

cmd_down() {
  if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux kill-session -t "$SESSION"
    ok "stopped tmux session '$SESSION'"
  else
    warn "session '$SESSION' not running"
  fi
}

case "${1:-status}" in
  up) cmd_up ;;
  preview) cmd_preview ;;
  status) cmd_status ;;
  logs) shift; cmd_logs "$@" ;;
  restart) shift; cmd_restart "$@" ;;
  attach) cmd_attach ;;
  down) cmd_down ;;
  *) die "unknown command '${1:-}'. Expected: up | preview | status | logs | restart | attach | down" ;;
esac
