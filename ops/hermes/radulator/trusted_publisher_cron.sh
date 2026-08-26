#!/usr/bin/env bash
# Credential-isolated no-agent wrapper for the Radulator trusted publisher.
set -euo pipefail

PROFILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_ROOT="$(cd "$PROFILE_DIR/../.." && pwd)"
export HERMES_PROFILE_DIR="$PROFILE_DIR"
export HOME="/Users/agent"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/Users/agent/.local/bin:${PATH:-}"

GH_BIN="/opt/homebrew/bin/gh"
if [[ ! -x "$GH_BIN" ]]; then
  echo "[trusted-publisher] FATAL: trusted GitHub CLI is unavailable" >&2
  exit 1
fi
unset GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN GH_HOST GH_CONFIG_DIR XDG_CONFIG_HOME \
  PYTHONHOME PYTHONPATH PYTHONSTARTUP PYTHONINSPECT PYTHONWARNINGS
GH_TOKEN="$($GH_BIN auth token --hostname github.com 2>/dev/null)" || {
  echo "[trusted-publisher] FATAL: host GitHub authentication is unavailable" >&2
  exit 1
}
if [[ -z "$GH_TOKEN" || ${#GH_TOKEN} -gt 4096 || "$GH_TOKEN" == *$'\n'* || "$GH_TOKEN" == *$'\r'* ]]; then
  echo "[trusted-publisher] FATAL: host GitHub credential is malformed" >&2
  exit 1
fi
export GH_TOKEN

exec "$HERMES_ROOT/hermes-agent/venv/bin/python" \
  -I \
  "$PROFILE_DIR/scripts/trusted_publisher.py" \
  --board "default" \
  --project-root "/Users/agent/Documents/Radulator" \
  --repository "momomojo/Radulator" \
  --base-branch "develop" \
  --expected-origin "momomojo/Radulator" \
  --lifecycle-controller "$PROFILE_DIR/scripts/lifecycle_controller.py" \
  --ledger "$PROFILE_DIR/state/radulator-release-lifecycle.jsonl" \
  --lock-file "$PROFILE_DIR/state/radulator-trusted-publisher.lock"
