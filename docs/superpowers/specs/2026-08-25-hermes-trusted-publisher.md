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

1. The board, task id, project id, current task status, blocked marker, event run id, and payload agree exactly.
2. The canonical repository is `momomojo/Radulator`, the canonical base is `develop`, and the workspace resolves under the configured Radulator project root.
3. The branch is the task's dispatcher-sealed branch, is not `main`, `develop`, `gh-pages`, or `release/*`, and is not a detached or sibling worktree branch.
4. Git reports a clean worktree, exact `HEAD == head_sha`, exactly one parent `base_sha`, the base is an ancestor, and the sorted changed path set exactly matches `changed_paths`.
5. Repository and worktree Git config do not define executable hooks, credential helpers, upload/receive pack overrides, or URL rewrites. The remote URL normalizes exactly to `momomojo/Radulator`.
6. The remote branch is absent, already equals `head_sha`, or is a proven local ancestor of `head_sha` and the exact head of one open correction PR. A correction first removes and reads back the absence of any stale `ready-for-gate` label, then uses a plain fast-forward non-force push whose source is the immutable sealed 40-hex SHA, never movable `HEAD`. A missing/diverged ancestor or any other remote state is terminally rejected.
7. The open PR is absent or exactly one PR reads back with the contract branch, `headRefOid == head_sha`, `baseRefName == develop`, and repository identity. Corrected work stays on the same PR and a new exact head invalidates all old evidence.
8. Required exact-head develop checks are `Smoke Tests`, `Targeted Calculator Tests`, and `Hermes Release Control Tests`; all must be completed successfully before labeling.
9. After labeling, GitHub is read again and must show the same exact head/base/open PR and `ready-for-gate` label.

## Credentials and process boundary

The publisher is a `no_agent` Hermes cron script. Its wrapper loads the profile secret environment only after the model turn has ended and only after proving it is an owner-controlled regular non-symlink file at exact mode `0600`; the installer enforces the same boundary before enablement. The worker and commit broker never receive `GH_TOKEN`, `GITHUB_TOKEN`, credential helpers, or network publication capability. The publisher drops inherited proxy and askpass variables and passes a minimal explicit environment to Git and GitHub CLI subprocesses. HTTPS Git publication uses the fixed `gh auth git-credential` helper inside that no-agent process; the token is environment-only and never appears in argv, output, or a model-visible process.

## Idempotency and crash recovery

Every external step is read-before-write and read-after-write. A retry reuses an exact remote branch, exact PR, exact release tracker, and exact label. It never force-pushes, rewrites a PR, or creates a second PR for the same branch/head. A mismatched pre-existing object is rejected rather than reconciled by mutation.

## Lifecycle handoff

After exact CI and label readback, the publisher replays the lifecycle ledger. It reuses the one active release tracker already bound to a corrected PR, or bootstraps a separate tracker using the exact PR number and head SHA when none exists. It then completes the implementation/correction task with the PR URL, exact SHA, and release tracker id. The release tracker stays open through signed review, protected merge, production deployment, smoke, retained learning, and final completion.

## Deployment rule

The publisher job is installed disabled-first. It may be enabled only when the installed Hermes runtime exposes the approved broker contract and all repository activation tests pass. The Mac mini is not changed by this implementation PR; installation occurs only after both the Hermes broker PR and this publisher PR independently pass review and merge.
