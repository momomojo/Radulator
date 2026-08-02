# Exact-head independent-review evaluator

## Current mode: evaluation-only and fail-closed

`Radulator Independent Review (exact head)` is an observability/evaluation check for pull requests whose base is `develop` or `main`. This repository version **cannot publish a successful required check**. Even a fully valid independent PASS candidate is completed as `failure` with reason `ACTIVATION_BLOCKED`.

That behavior is intentional. GitHub's Checks API has no compare-and-swap operation that binds a success write to mutable same-head PR metadata such as labels or review comments. A state change after the final read can race a success write, and asynchronous event delivery cannot close that interval. Creating another check, re-fetching, or reading the check back narrows the interval but does not make it atomic.

Therefore:

- this workflow does not merge, label, deploy, change settings, or execute PR code;
- its job is inert unless `RADULATOR_INDEPENDENT_REVIEW_EVALUATION_ENABLED=true` is separately approved/configured;
- no repository variable can enable success publication;
- `neutral` and `skipped` are never used because GitHub can treat them as satisfying a required check;
- the context must **not** be made required while this evaluation-only implementation is deployed; doing so would intentionally block every merge;
- activation requires a separate approved design that moves the authoritative cancellation/hold predicate into a GitHub-native control or a serialized sole merge authority with exact-head preflight.

## Exact-head CI semantics

GitHub associates `pull_request` workflow runs and job checks with the PR source head SHA, while the default `actions/checkout` behavior checks out the synthetic merge ref. The E2E workflow now explicitly checks out:

```yaml
ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
```

in Smoke, Targeted, and Full Suite jobs. The executed commit and the check identity are therefore the same source head. Push and manual runs continue to execute `github.sha`.

Because E2E executes PR-controlled application and test code, its workflow token is explicitly limited to `contents: read`.

The evaluator does not fold generic commit statuses/checks in API response order. It:

1. loads `pull_request` runs for `e2e-tests.yml` and the exact current source head;
2. pins the configured workflow ID and GitHub Actions App ID;
3. requires the run's PR association to match PR number, head SHA, base ref, and base SHA;
4. deterministically selects the latest exact run by creation time, attempt, and run ID;
5. requires that run to be completed/successful;
6. requires exactly one expected-App check from that run's check suite for each job;
7. treats missing, duplicate, queued, cancelled, skipped, neutral, wrong-App, or non-success jobs as blocking.

`develop` requires Smoke and Targeted. `main` additionally requires Full Suite. The durable record binds workflow run ID, attempt, check-suite/check-run IDs, App ID, exact head, conclusion, and completion time.

## Immutable review-record contract (v2)

The carrier is a newly created PR issue comment from a dedicated GitHub App installation. New verdicts require new comments. Edited records are invalid (`created_at` must equal `updated_at`), and only `PASS` or `NEEDS_FIX` is valid.

The newest candidate is selected by immutable App/Bot identity **before** parsing. A malformed newest candidate blocks instead of falling back to an older PASS. If more than one newest candidate has the same GitHub timestamp, the state is ambiguous and blocks; numeric comment IDs are used only for deterministic diagnostics.

The entire comment body is JSON:

```json
{
  "schema": "radulator-independent-review/v2",
  "repository_id": 1027532341,
  "pr": 123,
  "verdict": "PASS",
  "head_sha": "<40 lowercase hex>",
  "base_sha": "<40 lowercase hex>",
  "base_ref": "develop",
  "state_epoch": {
    "event_id": 123456,
    "event_created_at": "2026-08-02T00:00:00Z"
  },
  "labels_sha256": "<64 lowercase hex>",
  "ci": [
    {
      "name": "Smoke Tests",
      "app_id": 15368,
      "check_run_id": 1,
      "check_suite_id": 2,
      "workflow_id": 227376261,
      "workflow_run_id": 3,
      "run_attempt": 1,
      "head_sha": "<40 lowercase hex>",
      "conclusion": "success",
      "completed_at": "2026-08-02T00:00:00Z"
    }
  ],
  "reviewer": {
    "github_app_id": 1,
    "installation_id": 2,
    "bot_user_id": 3,
    "app_owner_id": 4,
    "run_id": "opaque-non-secret-run-id",
    "system": "independent-reviewer/version"
  },
  "reviewed_at": "2026-08-02T00:00:00Z",
  "evidence_sha256": "<sha256 of canonical JSON above with this field omitted>"
}
```

Raw PR `updated_at` is not a state token: comments can change it and make a record self-invalidating, while a label add/remove cycle can restore the old label set. Instead, the evaluator binds:

- exact current head SHA, base SHA/ref, open/draft state;
- a monotonic relevant timeline-event epoch;
- a digest of relevant current labels;
- exact current CI run/check evidence.

Relevant timeline events include close/reopen, ready/draft, base/head transitions, and both add and remove events for `ready-for-gate` and every hold/cancellation label. A hold add/remove cycle advances the epoch even when the final labels equal an earlier state.

## Verifiable reviewer identity

Display login and a free-form `reviewer_system` are insufficient. A PASS candidate requires all of these to agree:

- REST carrier `user.type == Bot`, exact Bot user ID/login;
- REST `performed_via_github_app` exact App ID/slug/owner ID/login;
- configured reviewer App, installation, Bot, owner, and system IDs;
- record payload App, installation, Bot, owner, and system IDs;
- the current `issue_comment` action is `created`, with the exact comment ID;
- webhook `installation.id`, comment App ID, and sender ID/login match the configured reviewer.

The event-bound installation check means a free-form installation ID in old comment text is never enough. CI-completion or unrelated events cannot turn an old record into a candidate; the dedicated reviewer must append its record after exact CI is green.

The reviewer Bot/App/installation/owner/system must be distinct from:

- `momomojo` (login and immutable user ID);
- the PR author;
- GitHub Actions publisher App 15368;
- the configured cloud merger Bot/App/installation/owner/system.

Missing or malformed numeric identity configuration blocks.

## Publisher protocol

For each event, the trusted workflow:

1. creates a fresh `in_progress` check on the observed current head before evaluation;
2. loads and fingerprints complete state twice;
3. treats any mismatch as failure;
4. completes the fresh check as `failure` (including a valid PASS candidate);
5. reads back check name, head, publisher App ID, external ID, status, and conclusion;
6. loads state once more; any change remains/creates failure on the current head.

The publisher never edits an old success and never writes success in the first place. A crash leaves a missing or in-progress check, both fail-closed if the context is eventually required. Check output includes policy mode, reason code, exact head/base, record ID, and an evaluation fingerprint.

## Trusted workflow scope and activation

`pull_request_target` is filtered to bases `develop` and `main`. Runtime checks reject every other base. The workflow also observes review comments, E2E completion, and pushes to `develop`/`main`.

The publisher checks out the exact trusted PR base SHA for `pull_request_target`; `issue_comment`, `workflow_run`, and push events execute the repository default branch copy. It never checks out or runs PR-controlled code.

GitHub activates `issue_comment` and `workflow_run` workflows only from the default branch. Safe rollout order is therefore:

1. merge this evaluation-only implementation to `develop` through normal review;
2. promote it to `main` through the normal full-suite gate;
3. separately approve/configure immutable CI/reviewer/cloud identities;
4. enable failure-only evaluation with `RADULATOR_INDEPENDENT_REVIEW_EVALUATION_ENABLED=true`;
5. confirm default-branch triggers and canary every blocking/invalidation class on a disposable PR;
6. resolve the atomic enforcement boundary in a separate reviewed change;
7. only after that change can a future implementation add success publication and propose required-context/settings changes.

Until step 6 is resolved, do not require this context and do not restore any merger that treats labels or this evaluator as atomic authorization.

## Proposed variables (documented only; not changed here)

- `RADULATOR_E2E_WORKFLOW_ID` (currently observed: `227376261`)
- `RADULATOR_CI_APP_ID` (GitHub Actions: `15368`)
- `RADULATOR_INDEPENDENT_REVIEW_EVALUATION_ENABLED` (`true` enables only failure/in-progress evaluation; it cannot enable success)
- reviewer: `RADULATOR_INDEPENDENT_REVIEW_{BOT_LOGIN,BOT_USER_ID,APP_ID,APP_SLUG,INSTALLATION_ID,APP_OWNER_ID,APP_OWNER_LOGIN,SYSTEM}`
- merger: `RADULATOR_CLOUD_MERGE_{BOT_LOGIN,BOT_USER_ID,APP_ID,APP_SLUG,INSTALLATION_ID,APP_OWNER_ID,APP_OWNER_LOGIN,SYSTEM}`

This PR does not create Apps, credentials, installations, variables, branch-protection rules, labels, or merger changes.

## Local verification and dry run

```bash
node --check scripts/independent-review-gate.mjs
npm run test:independent-review-gate
```

With a read-capable token and all proposed variables supplied, this performs a no-write real-state evaluation:

```bash
GITHUB_REPOSITORY=momomojo/Radulator PR_NUMBER=123 \
  node scripts/independent-review-gate.mjs --dry-run
```

`--dry-run` never calls a check-run write endpoint. Its conclusion remains `failure`; `eligible=true` only means the exact-state candidate contract validated.

## Rollback

Because successful publication and required-context settings are absent, rollback is a normal revert PR. If a future change ever makes this context required, remove merger authority first and coordinate branch-protection rollback before removing the workflow; otherwise the missing context will intentionally block all merges.
