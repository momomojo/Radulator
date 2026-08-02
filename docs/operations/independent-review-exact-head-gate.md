# Exact-head independent-review gate

## Purpose

`Radulator Independent Review (exact head)` is a fail-closed required GitHub check for pull requests to `develop` and `main`. It replaces label/comment ordering as a merge predicate: a check can pass only for the current PR head SHA after a durable independent PASS record has been revalidated against current PR and CI state.

The implementation is deliberately separate from the existing cloud merge routine. It does **not** merge PRs, apply labels, alter repository settings, or accept a post-merge comment as evidence.

## Durable review-record contract

The independent reviewer must be a separately controlled GitHub App bot. Repository variables bind the two separately controlled identities: `RADULATOR_INDEPENDENT_REVIEW_BOT_LOGIN`, `RADULATOR_INDEPENDENT_REVIEW_SYSTEM`, `RADULATOR_CLOUD_MERGE_BOT_LOGIN`, and `RADULATOR_CLOUD_MERGE_SYSTEM`. Missing, equal, PR-author, or `momomojo` identities fail closed. The reviewer writes a normal PR issue comment whose entire body is this JSON object:

```json
{
  "schema": "radulator-independent-review/v1",
  "pr": 123,
  "verdict": "PASS",
  "head_sha": "<40-character current head SHA>",
  "base_sha": "<40-character current base SHA>",
  "base_ref": "<current PR base branch, for example develop>",
  "pr_updated_at": "<exact pull-request updated_at observed by reviewer>",
  "reviewed_at": "<RFC 3339 timestamp>",
  "reviewer_system": "independent-security-review"
}
```

`CHANGES` and `HOLD` are durable negative verdicts. A PASS must be a newly created comment at or after the recorded PR snapshot; editing an old PASS after a head/base/label transition cannot refresh it. The bot identity, comment ID, creation/update time, and JSON payload are canonicalized and SHA-256 fingerprinted into the check output. The reviewer app must not share an owner, installation token, OAuth token, or automation routine with `momomojo`, the PR author, or the implementation worker.

## Gate behavior

The workflow is stored on the base branch and runs through `pull_request_target`, `issue_comment`, `workflow_run` for `E2E Tests`, and pushes to `develop`/`main`. It never checks out PR code. It publishes the same check context on the exact current head for a new review comment, PR/head/base/label change, CI completion, or base-branch advance.

GitHub only activates `issue_comment` and `workflow_run` workflows from the repository default branch. Therefore rollout is fail-closed: merge this workflow through `develop`, promote it to the default branch (`main`), verify the configured App can emit a record and the workflow can publish a blocking context, and **only then** make the context required on either protected branch. Before that promotion, a review comment may not trigger the workflow automatically; it must never be treated as a PASS.

A PASS requires all of the following, checked again immediately before publication:

1. The PR is open with valid current head and base SHAs.
2. No hold/cancellation label exists (`hold`, `do-not-merge`, `gate-hold`, `needs-fix`, `changes-requested`, `security-hold`, `cancelled`, or `canceled`).
3. `Smoke Tests` and `Targeted Calculator Tests` are both successful on that head.
4. The newest record from the configured independent App bot is a well-formed `PASS`, not an older PASS silently selected after a malformed record, and is not the PR author, `momomojo`, or the configured cloud merger.
5. Record PR number, head SHA, base SHA, base ref, and `pr_updated_at` exactly match the re-fetched PR state.
6. State fingerprints before and after the final refetch match. Any concurrent PR/review/CI state transition produces a failure check instead.

A stale check is not reusable: changing the head, base, open/closed/reopened state, labels (including removal of a hold/cancellation label), CI conclusion, or review record causes a blocking result until an independent reviewer creates a fresh exact-state PASS.

## Least-privilege identities and token boundary

Two identities are required:

| Role | Identity | Minimum permissions | Boundary |
| --- | --- | --- | --- |
| Independent reviewer | Dedicated GitHub App bot | Pull request/issue read; issue-comment write | App private key/token must be unavailable to `momomojo`, implementation workers, and the cloud merger. It emits the durable record only. |
| Required-check publisher | `github-actions[bot]` running this trusted base workflow | Repository `GITHUB_TOKEN`: `checks: write`, `pull-requests: read`, `issues: read`, `statuses: read`, `contents: read` | It can only translate independently authored records plus current GitHub state into the required context. It has no merge, contents-write, labels-write, deployments-write, or admin permission. |

The GitHub required-status UI should bind the required context to the GitHub Actions app if the platform offers an expected-app selector. Do not use `momomojo` approvals as independence evidence; GitHub cannot count a PR author's self-approval as independent review.

## Local checks and publisher dry run

The exact required context is `Radulator Independent Review (exact head)` and its publisher identity is `github-actions[bot]` (the trusted base workflow's repository `GITHUB_TOKEN`). Run deterministic local contract tests without any GitHub credential or network mutation:

```bash
node --check scripts/independent-review-gate.mjs
npm run test:independent-review-gate
```

To evaluate a real PR state without creating/updating a check, provide the same environment variables as the workflow, including a read-capable `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, and `PR_NUMBER`, then run:

```bash
node scripts/independent-review-gate.mjs --dry-run
```

`--dry-run` emits the prospective exact-head verdict and fingerprint only; it never calls the check-run write endpoint.

## Settings delta (propose only; do not apply in this change)

After a separate security/admin review and explicit Mohib approval:

1. Require `Radulator Independent Review (exact head)` on both `develop` and `main`.
2. Enable administrator enforcement on `develop` (already enabled on `main` according to the incident audit).
3. Keep `strict=false` initially only because the gate independently binds and invalidates base SHA changes. Set `strict=true` as defense in depth if merge-queue/rebase behavior and CI cost are acceptable; it is not required for this gate's base-SHA safety property.
4. Ensure the existing cloud merge routine cannot merge without required-check enforcement and cannot mutate this trusted workflow or the reviewer-App configuration.

## Threat model and rollback

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| #95 ordering: merge before a late negative review | Closed PRs always fail; post-merge records cannot produce PASS | Settings must make this check required before merger authority is restored. |
| #97 label TOCTOU | Any label transition changes `updated_at`; final refetch/state fingerprint blocks PASS | Existing unsafe routine remains unsafe until containment/settings approval. |
| Stale head/base PASS | Record and check are bound to exact head/base; any mismatch fails | GitHub settings must require this named context. |
| PR author forges comment | Only configured, separately controlled GitHub App author is trusted | App compromise remains a high-value security incident. |
| CI turns green without review | Green CI alone produces a failure check | CI context names must remain aligned with required protection. |
| Concurrent state mutation during evaluation | Two complete GitHub state reads must match before publication | A mutation after final read is handled by the event-triggered invalidation workflow; brief delivery latency remains. |
| PR edits workflow | `pull_request_target` and `workflow_run` use trusted base/default workflow, never PR checkout | A privileged merger that can alter protected base/settings defeats any repo-only control. |

Rollback: do not delete the required status context while a PR is in flight. First pause/disable merger authority, remove this context from branch protection through the approved admin change, then revert this PR via a normal review-gated PR. Removing the workflow before the required-check setting would fail closed and block all merges, which is acceptable only as an emergency containment action.
