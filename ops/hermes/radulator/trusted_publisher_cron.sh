#!/usr/bin/env bash
# Credential-isolated no-agent wrapper for the Radulator trusted publisher.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${RADULATOR_PUBLISHER_PYTHON:?missing publisher Python}"
: "${RADULATOR_PUBLISHER_RUNTIME_ROOT:?missing sealed publisher runtime root}"
: "${RADULATOR_PUBLISHER_RUNTIME_MANIFEST:?missing sealed publisher runtime manifest}"
: "${RADULATOR_PUBLISHER_RUNTIME_MANIFEST_SHA256:?missing sealed publisher runtime manifest digest}"
: "${RADULATOR_PUBLISHER_PYTHON_VERSION:?missing sealed publisher Python version}"
: "${RADULATOR_PUBLISHER_PYTHON_SHA256:?missing sealed publisher Python digest}"
: "${RADULATOR_BROKER_CLIENT_CONFIG:?missing broker publisher client config}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

unset GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN GH_HOST GH_CONFIG_DIR XDG_CONFIG_HOME \
  PYTHONHOME PYTHONPATH PYTHONSTARTUP PYTHONINSPECT PYTHONWARNINGS

RUNTIME_PREFLIGHT_ARGS=(
  -I
  -B
  "$SCRIPT_DIR/trusted_publisher.py"
  --runtime-preflight
  --runtime-root "$RADULATOR_PUBLISHER_RUNTIME_ROOT"
  --runtime-manifest "$RADULATOR_PUBLISHER_RUNTIME_MANIFEST"
  --runtime-manifest-sha256 "$RADULATOR_PUBLISHER_RUNTIME_MANIFEST_SHA256"
  --runtime-python-version "$RADULATOR_PUBLISHER_PYTHON_VERSION"
  --runtime-python-sha256 "$RADULATOR_PUBLISHER_PYTHON_SHA256"
  --repository-id "radulator"
  --broker-client-config "$RADULATOR_BROKER_CLIENT_CONFIG"
)

if [[ "${RADULATOR_PUBLISHER_PREFLIGHT:-0}" == "1" ]]; then
  export HOME="/var/empty"
  exec "$RADULATOR_PUBLISHER_PYTHON" "${RUNTIME_PREFLIGHT_ARGS[@]}"
fi

: "${RADULATOR_PUBLISHER_HOME:?missing publisher home}"
: "${RADULATOR_PUBLISHER_PROJECT_ROOT:?missing private publisher repository}"
: "${RADULATOR_PUBLISHER_STATE_DIR:?missing publisher state directory}"
: "${RADULATOR_BROKER_UID:?missing broker UID}"
: "${RADULATOR_PUBLISHER_GID:?missing publisher GID}"
: "${RADULATOR_GITHUB_REPOSITORY_ID:?missing GitHub repository ID}"
: "${RADULATOR_GITHUB_WORKFLOW_ID:?missing GitHub workflow ID}"
: "${RADULATOR_READY_LABEL_ACTOR_ID:?missing ready-label actor ID}"
: "${RADULATOR_READY_LABEL_ACTOR_LOGIN:?missing ready-label actor login}"
: "${RADULATOR_READY_LABEL_ACTOR_TYPE:?missing ready-label actor type}"
export HOME="$RADULATOR_PUBLISHER_HOME"
export GH_CONFIG_DIR="$RADULATOR_PUBLISHER_HOME/.config/gh"

PUBLISHER_ARGS=(
  -I
  -B
  "$SCRIPT_DIR/trusted_publisher.py"
  --board "default"
  --project-id "radulator"
  --project-root "$RADULATOR_PUBLISHER_PROJECT_ROOT"
  --repository "momomojo/Radulator"
  --base-branch "develop"
  --expected-origin "momomojo/Radulator"
  --lifecycle-controller "$SCRIPT_DIR/lifecycle_controller.py"
  --ledger "$RADULATOR_PUBLISHER_STATE_DIR/radulator-release-lifecycle.jsonl"
  --lock-file "$RADULATOR_PUBLISHER_STATE_DIR/radulator-trusted-publisher.lock"
  --repository-id "radulator"
  --publisher-state-dir "$RADULATOR_PUBLISHER_STATE_DIR"
  --broker-client-config "$RADULATOR_BROKER_CLIENT_CONFIG"
  --expected-broker-uid "$RADULATOR_BROKER_UID"
  --publisher-gid "$RADULATOR_PUBLISHER_GID"
  --github-repository-id "$RADULATOR_GITHUB_REPOSITORY_ID"
  --workflow-id "$RADULATOR_GITHUB_WORKFLOW_ID"
  --ready-label-actor-id "$RADULATOR_READY_LABEL_ACTOR_ID"
  --ready-label-actor-login "$RADULATOR_READY_LABEL_ACTOR_LOGIN"
  --ready-label-actor-type "$RADULATOR_READY_LABEL_ACTOR_TYPE"
)

GH_BIN="/opt/homebrew/bin/gh"
if [[ ! -x "$GH_BIN" ]]; then
  echo "[trusted-publisher] FATAL: trusted GitHub CLI is unavailable" >&2
  exit 1
fi
GH_TOKEN="$($GH_BIN auth token --hostname github.com 2>/dev/null)" || {
  echo "[trusted-publisher] FATAL: host GitHub authentication is unavailable" >&2
  exit 1
}
if [[ -z "$GH_TOKEN" || ${#GH_TOKEN} -gt 4096 || "$GH_TOKEN" == *$'\n'* || "$GH_TOKEN" == *$'\r'* ]]; then
  echo "[trusted-publisher] FATAL: host GitHub credential is malformed" >&2
  exit 1
fi
export GH_TOKEN

run_publisher_once() {
  "$RADULATOR_PUBLISHER_PYTHON" "${PUBLISHER_ARGS[@]}"
}

if [[ "${RADULATOR_PUBLISHER_SERVICE_LOOP:-0}" == "1" ]]; then
  interval="${RADULATOR_PUBLISHER_INTERVAL_SECONDS:-60}"
  if [[ ! "$interval" =~ ^[0-9]+$ ]] || (( interval < 15 || interval > 3600 )); then
    echo "[trusted-publisher] FATAL: publisher interval is invalid" >&2
    exit 1
  fi
  while true; do
    if ! run_publisher_once; then
      echo "[trusted-publisher] ERROR: publisher pass failed; retrying after interval" >&2
    fi
    /bin/sleep "$interval"
  done
fi

exec "$RADULATOR_PUBLISHER_PYTHON" "${PUBLISHER_ARGS[@]}"
