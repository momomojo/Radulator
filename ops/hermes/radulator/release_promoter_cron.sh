#!/usr/bin/env bash
# Cron wrapper (no_agent) for release_promoter.py — profile-HOME pattern.
PROFILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_ROOT="$(cd "$PROFILE_DIR/../.." && pwd)"
export HERMES_PROFILE_DIR="$PROFILE_DIR"
export HOME="/Users/agent"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/Users/agent/.local/bin:${PATH:-}"
set -a
source "$PROFILE_DIR/.env" || { echo "[release-promoter] FATAL: cannot source $PROFILE_DIR/.env"; exit 1; }
set +a
exec "$HERMES_ROOT/hermes-agent/venv/bin/python" \
  "$PROFILE_DIR/scripts/release_promoter.py" "$@"
