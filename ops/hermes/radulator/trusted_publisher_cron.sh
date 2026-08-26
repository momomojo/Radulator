#!/usr/bin/env bash
# Credential-isolated no-agent wrapper for the Radulator trusted publisher.
set -euo pipefail

PROFILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_ROOT="$(cd "$PROFILE_DIR/../.." && pwd)"
export HERMES_PROFILE_DIR="$PROFILE_DIR"
export HOME="/Users/agent"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/Users/agent/.local/bin:${PATH:-}"

ENV_FILE="$PROFILE_DIR/.env"
if [[ ! -f "$ENV_FILE" || -L "$ENV_FILE" ]]; then
  echo "[trusted-publisher] FATAL: profile environment is not a regular non-symlink file" >&2
  exit 1
fi
ENV_UID="$(stat -f '%u' "$ENV_FILE")"
ENV_MODE="$(stat -f '%Lp' "$ENV_FILE")"
if [[ "$ENV_UID" != "$(id -u)" || "$ENV_MODE" != "600" ]]; then
  echo "[trusted-publisher] FATAL: profile environment must be owner-controlled mode 0600" >&2
  exit 1
fi

set -a
source "$ENV_FILE" || {
  echo "[trusted-publisher] FATAL: cannot source profile environment" >&2
  exit 1
}
set +a

BOARD="${RADULATOR_HERMES_BOARD:-${HERMES_KANBAN_BOARD:-default}}"
PROJECT_ROOT="${RADULATOR_PROJECT_ROOT:-/Users/agent/Documents/Radulator}"

PUBLISHER_ARGS=(
  --board "$BOARD"
  --project-root "$PROJECT_ROOT"
  --repository "momomojo/Radulator"
  --base-branch "develop"
  --expected-origin "momomojo/Radulator"
  --lifecycle-controller "$PROFILE_DIR/scripts/lifecycle_controller.py"
  --ledger "$PROFILE_DIR/state/radulator-release-lifecycle.jsonl"
  --lock-file "$PROFILE_DIR/state/radulator-trusted-publisher.lock"
)
if [[ -n "${RADULATOR_HERMES_PROJECT_ID:-}" ]]; then
  PUBLISHER_ARGS+=(--project-id "$RADULATOR_HERMES_PROJECT_ID")
fi

exec "$HERMES_ROOT/hermes-agent/venv/bin/python" \
  "$PROFILE_DIR/scripts/trusted_publisher.py" \
  "${PUBLISHER_ARGS[@]}" \
  "$@"
