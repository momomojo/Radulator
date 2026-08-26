# Hermes Trusted Publisher Specification

## Decision

The approved boundary is:

> The AI worker edits and tests files only. A dispatcher-sealed host broker makes a credential-free local commit. A separate no-agent publisher validates the exact task, repository, branch, and commit, pushes without force, opens the PR, reads it back, and adds `ready-for-gate` only after exact-head CI passes. GitHub credentials never enter the model.

The publisher consumes only the durable `hermes.trusted_local_commit.v1` event written by Hermes. It never trusts worker prose, a terminal result, an unsealed environment variable, or branch names supplied at runtime.

## Durable input contract

The selected Kanban board must contain a blocked task whose current status is `blocked`, whose latest blocked event has reason `AWAITING_TRUSTED_PUBLISHER v1`, and whose latest `trusted_local_commit` event belongs to the same ended run. Its payload is exactly:

```json
{
  "contract": "hermes.trusted_local_commit.v1",
  "task_id": "t_example",
  "project_id": null,
  "board": "default",
  "workspace": "/absolute/project-worktree",
  "branch": "radulator/t_example-feature",
  "base_sha": "0000000000000000000000000000000000000000",
  "head_sha": "1111111111111111111111111111111111111111",
  "changed_paths": ["path/one", "path/two"],
  "publisher_state": "awaiting"
}
```

Crash recovery may add `recovered_from_run_id` as a positive integer. `project_id`
must exactly equal the current task's board-scoped project identity and may be null,
as it is on the current authoritative `default` board. No other input shape
authorizes publication.

## Publisher validation

The publisher processes at most one oldest eligible task per invocation and fails closed unless all of these are true:

1. The board, task id, project id, `capability` block kind, current task status, blocked marker, event run id, and payload agree exactly. The event run is the task's latest run, has ended with blocked status/outcome and the exact publisher marker, and no active run is attached. Crash recovery additionally binds the named predecessor to an older ended `reclaimed` run and its durable completion-request event.
2. The canonical repository is `momomojo/Radulator`, the canonical base is `develop`, and the workspace resolves under the configured Radulator project root.
3. The branch is the task's dispatcher-sealed branch, is not `main`, `develop`, `gh-pages`, or `release/*`, and is not a detached or sibling worktree branch.
4. Git reports a clean worktree, exact `HEAD == head_sha`, exactly one parent `base_sha`, the base is an ancestor, and the sorted changed path set exactly matches `changed_paths`.
5. Repository and worktree Git config do not define executable hooks, credential helpers, upload/receive pack overrides, or URL rewrites. The remote URL normalizes exactly to `momomojo/Radulator`.
6. The target `develop` ref is read independently from the feature ref. A new publication requires `base_sha` to equal current `develop`; a correction requires `base_sha` to equal the current remote feature head and current `develop` to be contained in the corrected head. Immediately before mutation both refs and the local/Kanban authority are re-read. Publication uses a plain fast-forward non-force push whose source is the immutable sealed 40-hex SHA, never movable `HEAD`.
7. All PR history for the exact branch is enumerated. No second PR may be created. One closed, unmerged, exact-repository PR is reopened and reused; a merged or ambiguous prior PR is rejected. Before a correction push or closed-PR reopen, any inherited `ready-for-gate` label is removed and its absence is read back on the unchanged exact PR state, head, base, owner, and repository. The final open readback must bind the exact feature head, current target-base SHA, `develop`, owner, and non-fork repository identity.
8. The publisher resolves the active E2E workflow by exact ID/path/name, binds exact PR/head/base/repository metadata, and selects the newest exact `(run_id, run_attempt)` before inspecting its result. That newest attempt must be completed successfully. Its complete job list must contain exactly one successful `Smoke Tests`, `Targeted Calculator Tests`, and `Hermes Release Control Tests`; each job's exact check run must bind the same run attempt, head, GitHub Actions App, and the workflow run's check-suite ID.
9. `ready-for-gate` is a compensating transaction. After any attempted or previously observed label, the publisher revalidates task/run/local refs/remote refs/PR/CI. Any error removes the label and requires generic PR readback proving absence; inability to prove absence yields `UNSAFE_LABEL_STATE` and leaves the implementation task blocked.

## Credentials and process boundary

The publisher is a `no_agent` Hermes cron script. Its wrapper never sources the Hermes profile `.env`. It discards inherited GitHub-token and GitHub-configuration overrides, resolves a fresh token from the fixed `/opt/homebrew/bin/gh` for `github.com` without printing it, validates it, and exports it only into the no-agent publisher process; installer activation requires the same credential readback. Before the first Git invocation, the publisher reads the linked repository/worktree config as owner-controlled regular files and rejects executable, include, filter, helper, proxy/TLS, protocol, URL-rewrite, transport, and `core.alternateRefsCommand` surfaces. Every fixed `/usr/bin/git` invocation additionally disables optional locks, replacement objects, system/global config, hooks, fsmonitor, external diff/attributes, SSH/askpass, credential helpers, and ext transport, so parent, ancestry, diff, and path validation use raw objects even when `refs/replace/*` exists; the one credentialed HTTPS push supplies only the absolute GitHub CLI helper. The worker and commit broker never receive `GH_TOKEN`, `GITHUB_TOKEN`, credential helpers, or publication network capability. Activation is additionally bound to the reviewed `hermes.worker_git_isolation.v1` runtime boundary and exact live model-path probes; the contract constant alone is not credential-isolation proof.

## Idempotency and crash recovery

Every external step is read-before-write and read-after-write. A retry reuses an exact remote branch, exact PR, exact release tracker, exact ledger seed, exact audit comment, and exact label. It never force-pushes, rewrites history, or creates a second PR for the same branch. A mismatched pre-existing object is rejected rather than authorized by prose or nested history.

## Lifecycle handoff

After exact CI and label readback, the publisher replays the lifecycle ledger. A new tracker must be the exact child of the implementation task; the publisher appends and replays an idempotent initial `feedback` event bound to the exact PR/head before task completion. A correction may reuse only a `needs_fix` tracker whose ledger head equals the correction commit's parent and whose exact parent relation points from that tracker to the correction task. Tracker/correction and implementation audit comments are exact and idempotent. The release tracker stays open through signed review, protected merge, production deployment, smoke, retained learning, and final completion.

## Deployment rule

The publisher job is installed disabled-first. Its installer migrates only the exact prior deployed v1 backup allowlist, snapshots every newly managed publisher dependency before any installer mutation, and writes one authenticated complete v3 manifest that binds the required pre-install job-provenance digest; any partial, enlarged, duplicate, injected, missing, or replaced set fails closed. The job may be enabled only when a reviewed Hermes service runs the broker and publisher under a separate OS identity, exposes both `hermes.trusted_local_commit.v1` and `hermes.worker_git_isolation.v1`, produces and verifies a host-signed authority receipt binding repository, board, project, task, run, workspace, branch, base, head, and changed paths, and provides a bounded host-authenticated completion-obligation query for crash recovery. It must also pass the semantic claim/completion CAS canary, exact model-path denial/success canary, host credential probe, and all repository activation tests. The denial receipt must explicitly cover profile `.env`, GitHub config/token, SSH config/private keys, Keychain lookup, loopback/public networking, and Git metadata, while also proving an ordinary workspace edit and bounded test succeed. Until that separate-identity service and every exact receipt/query field have independently passed review and been source-bound, activation remains `PENDING_HERMES_RUNTIME`; this release cannot enable. The Mac mini is not changed by this implementation PR; installation occurs only after both the Hermes broker PR and this publisher PR independently pass review and merge.
