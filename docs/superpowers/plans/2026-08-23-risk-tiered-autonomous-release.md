# Risk-Tiered Autonomous Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and install an automatic, exact-head, risk-tiered clinical judge pipeline from feedback handoff through merge, deployment, smoke verification, and retained learning.

**Architecture:** Trusted repository scripts classify the exact PR diff, verify Ed25519 judge attestations, and authorize a separate merge workflow. Versioned Mac mini overlay scripts collect judge candidates, sign exact-state verdicts, reconcile Kanban/GitHub lifecycle state, and retain only deployed lessons.

**Tech Stack:** Node.js 20 (`node:crypto`, `node:test`/strict assertions), Python 3 standard library (`sqlite3`, `unittest`), GitHub Actions/API, Hermes Agent profile cron jobs, Hindsight.

**Spec:** `docs/superpowers/specs/2026-08-23-risk-tiered-autonomous-release.md`

## Global Constraints

- No direct pushes to `develop` or `main`; all integration uses PRs.
- Standard risk requires one primary judge PASS; high risk requires primary plus independent verifier PASS.
- Every approval binds exact head/base SHA, PR epoch, label digest, file digest, risk tier, and CI evidence.
- Private signing keys remain only on the Mac mini; repository/GitHub configuration contains public keys only.
- Missing or ambiguous evidence fails closed.
- Hindsight receives a distilled lesson only after production smoke passes.
- Every cron job has an explicit absolute workdir and pinned model/provider; each judge profile is verified at profile-level `xhigh` effort because Hermes does not store per-job effort.

---

### Task 1: Risk policy and signed attestation verifier

**Files:**
- Create: `scripts/release-policy.mjs`
- Create: `scripts/release-policy.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `classifyRisk(files) -> {tier, version, filesSha256, evidenceSha256, reasonCodes, reasonCount}` with bounded signed metadata; detailed reasons remain only in the local review candidate
- Produces: `canonicalJson(value)`, `digest(value)`, `verifyAttestation(record, publicKeys, exactState)`
- Produces: `requiredJudgeRoles(tier) -> ["primary"] | ["primary", "verification"]`

- [ ] Write failing tests proving feedback-only code is standard, calculator logic is high, threshold documentation is high, missing clinical patch is high, canonical signatures verify, mutations/stale SHAs fail, and high risk requires two roles.
- [ ] Run `node scripts/release-policy.test.mjs` and confirm failures are caused by missing policy exports.
- [ ] Implement the minimal deterministic classifier, canonicalization, Ed25519 verification, and quorum evaluator.
- [ ] Run `node scripts/release-policy.test.mjs` and confirm all cases pass.
- [ ] Add `test:release-policy` to `package.json` and commit `feat: add risk-tiered clinical attestation policy`.

### Task 2: Activate the exact-head clinical release gate

**Files:**
- Modify: `scripts/independent-review-gate.mjs`
- Modify: `scripts/independent-review-gate.test.mjs`
- Modify: `.github/workflows/independent-review-gate.yml`
- Modify: `docs/operations/independent-review-exact-head-gate.md`

**Interfaces:**
- Consumes: `classifyRisk`, `verifyAttestation`, `requiredJudgeRoles`
- Produces: a fingerprint-bearing check named `Radulator Clinical Release Gate (exact head)` plus the suite-independent, App-bound required status `Radulator Clinical Release Authorization`

- [ ] Replace the PASS-candidate test with failing tests for one standard PASS, missing second high-risk PASS, two high-risk PASSes, newest NEEDS_FIX, invalid signature, changed head/base/epoch/labels/files/CI, and post-publication state change.
- [ ] Run `npm run test:independent-review-gate` and confirm the new success-path tests fail with the evaluation-only result.
- [ ] Load paginated PR files, compute exact risk/evidence, parse signed carriers, and return success only for the required quorum.
- [ ] Complete/read back the fingerprint check and its paired commit status using the evaluated conclusion; require the status from the configured Actions App in branch rules.
- [ ] Update the trusted workflow to provide judge public keys, keep PR code unexecuted, and remove the evaluation-only switch.
- [ ] Run gate and policy tests; commit `feat: activate exact-head clinical release gate`.

### Task 3: Protected automatic merge controller

**Files:**
- Create: `scripts/auto-merge.mjs`
- Create: `scripts/auto-merge.test.mjs`
- Create: `.github/workflows/auto-merge.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: current PR/GitHub checks and `evaluateGate` exact-state result
- Produces: one SHA-pinned merge request or an idempotent no-op/failure reason

- [ ] Write failing tests for wrong head, draft/closed PR, missing current success check, hold/NEEDS_FIX state, base mismatch, duplicate merge, and valid develop/main merge requests.
- [ ] Run the focused test and confirm missing controller behavior fails.
- [ ] Implement a dry-run-by-default controller that re-fetches exact state, validates the current gate check and required CI, and calls the merge endpoint with expected SHA only when `RADULATOR_AUTO_MERGE_ENABLED=true`.
- [ ] Add a serialized trusted workflow with `contents: write`, `pull-requests: write`, and `checks: read`; do not execute PR code.
- [ ] Run controller/gate tests and commit `feat: add approval-bound automatic merge`.

### Task 4: Deployment smoke and rollback deployment

**Files:**
- Create: `scripts/post-deploy-smoke.mjs`
- Create: `scripts/post-deploy-smoke.test.mjs`
- Create: `scripts/select-rollback-deployment.mjs`
- Create: `scripts/select-rollback-deployment.test.mjs`
- Modify: `.github/workflows/deploy.yml`
- Create: `.github/workflows/rollback-deployment.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: `smokeSite(baseUrl)` with URL/status/content evidence
- Produces: `selectLastGoodDeployment(failedRun, runs)` returning a prior successful main SHA only

- [ ] Write failing tests using a local HTTP server for home/calculator/sitemap success and each failure; add rollback-selection tests rejecting the failed/current/non-main SHA.
- [ ] Run focused tests and confirm missing implementations fail.
- [ ] Implement smoke and rollback selection.
- [ ] Accept only verified `repository_dispatch` events: exact merged-current-main evidence for promotion or independently recomputed failed-run/last-known-good evidence for rollback; never accept a caller-supplied manual deployment ref. Run production smoke after Pages deploy and upload its evidence.
- [ ] Only after trusted Pages success plus exact-SHA live-smoke failure, emit an explicit rollback-request repository dispatch carrying the failed run ID. Poll and re-read that run by trusted deploy workflow ID/path, independently select the last successful main SHA, re-authorize the resulting verified rollback dispatch inside `deploy.yml`, and record the rollback summary without modifying protected branches or recursing after rollback failure.
- [ ] Run focused tests and commit `feat: verify and roll back failed deployments`.

### Task 5: Mac mini judge collection and signing overlay

**Files:**
- Create: `ops/hermes/radulator/judge-candidates.mjs`
- Create: `ops/hermes/radulator/judge-candidates.test.mjs`
- Create: `ops/hermes/radulator/judge-attest.mjs`
- Create: `ops/hermes/radulator/judge-attest.test.mjs`
- Create: `ops/hermes/radulator/skills/radulator-clinical-judge/SKILL.md`

**Interfaces:**
- Produces: atomic candidate cache records using the same policy/exact-state schema as the GitHub gate
- Produces: `judge-attest.mjs generate-key|sign|post` with stale-state readback before signature/post

- [ ] Write failing tests for paginated candidate collection, exact-state cache ids, key separation, PASS/NEEDS_FIX signing, stale cache rejection, high-risk secondary behavior, and redacted logs.
- [ ] Run focused tests and confirm missing CLI behavior fails.
- [ ] Implement candidate collection and signer using Node Ed25519 primitives and GitHub API readbacks.
- [ ] Write the judge skill with explicit citation, changed-file, test-evidence, and verdict rules; require NEEDS_FIX for uncertainty.
- [ ] Run focused tests and commit `feat: add autonomous clinical judge overlay`.

### Task 6: Lifecycle ledger, Kanban handoff, and learning retention

**Files:**
- Create: `ops/hermes/radulator/lifecycle_controller.py`
- Create: `ops/hermes/radulator/tests/test_lifecycle_controller.py`
- Create: `ops/hermes/radulator/learning_context.py`
- Create: `ops/hermes/radulator/retain_learning.py`
- Create: `ops/hermes/radulator/tests/test_learning_context.py`
- Create: `ops/hermes/radulator/tests/test_retain_learning.py`
- Create: `ops/hermes/radulator/skills/radulator-release-learning/SKILL.md`

**Interfaces:**
- Produces: hash-chained append-only lifecycle events and idempotent replay state
- Consumes: Kanban/GitHub/judge/deploy adapters and emits child/comment/complete actions
- Produces: one sanitized Hindsight retention candidate after `smoke_passed`

- [ ] Write failing replay tests for every state transition, duplicate event, crash/replay, tamper detection, NEEDS_FIX requeue, exact-SHA handoff without attachments, completion only after smoke, and one-time learning.
- [ ] Run Python unit tests and confirm missing controller behavior fails.
- [ ] Implement the ledger core and adapters using atomic writes and readback verification.
- [ ] Implement learning context and a bounded `kanban_closure` retention helper so only deployed stable lessons receive exact Hindsight readback before `learned` is appended; do not route release closure through the general conversational `hindsight_retain` tool.
- [ ] Run Python tests and commit `feat: retain autonomous release progress and learning`.

### Task 7: Idempotent Mac mini installer and job configuration

**Files:**
- Create: `ops/hermes/radulator/install.py`
- Create: `ops/hermes/radulator/tests/test_install.py`
- Create: `ops/hermes/radulator/README.md`

**Interfaces:**
- Produces: `install.py --repo ABS --radulator-home ABS --default-home ABS --dry-run|--apply|--restore`

- [ ] Write failing tests over temporary profile homes for backup/restore, stable ids, explicit workdirs, pinned model/provider plus profile-level `xhigh` effort, separate key paths, disabled-first install, and idempotent reapply.
- [ ] Run installer tests and confirm missing behavior fails.
- [ ] Implement file copying, atomic jobs.json/config updates, key generation hooks, backup manifest, dry-run diff, verification, enable, and restore.
- [ ] Document exact installation, self-test, rotation, disable, and recovery commands.
- [ ] Run overlay tests and commit `feat: install risk-tiered Hermes release control plane`.

### Task 8: Repository integration verification and publication

**Files:**
- Modify: `AGENTS.md`
- Modify: `.github/workflows/e2e-tests.yml`

**Interfaces:**
- Consumes: all new test commands and release policy
- Produces: documented automatic judge/merge rules and CI execution of all control-plane tests

- [ ] Update AGENTS.md to replace physician-owner waiting and manual merge with the approved risk-tiered judge and exact-head automatic merge rules.
- [ ] Add every Node/Python control-plane test to the trusted tooling CI job.
- [ ] Run `npm ci`, all focused tests, `npm run build`, `npm run lint`, `npm run check:invariants`, and `npm run test:smoke`.
- [ ] Review the full diff for secrets, generated artifacts, unsafe PR code execution, bypasses, and uncovered spec requirements.
- [ ] Rebase on `origin/develop`, rerun the full local gate, commit, push, and open a PR to `develop` with the verification evidence.

### Task 9: Staged live activation

**Files:**
- External state: Mac mini Hermes profiles, GitHub repository variables/rules, test PRs, GitHub Pages deployment

**Interfaces:**
- Consumes: merged installer/control-plane release
- Produces: Mac-mini-live-verified autonomous release loop

- [ ] Run installer dry-run on live sanitized paths and verify backup/config/job diff.
- [ ] Create separate signing keys at the action point, configure only public keys in GitHub, and read back role/key ids without printing private material.
- [ ] Install jobs disabled, run all self-tests, then enable the primary/secondary judge, lifecycle, and learning jobs.
- [ ] Run a standard-risk canary through judge, gate, develop merge, promotion, main merge, deployment, smoke, ledger completion, and Hindsight retention.
- [ ] Run a high-risk synthetic canary proving one signature blocks and two signatures authorize; close it without clinical publication.
- [ ] Run the failed-smoke rollback drill and verify the last good SHA is served.
- [ ] Reconcile `t_76a0310e` into a new exact-effect review child, removing the obsolete 19 MB attachment dependency and returning the new canary finding to implementation when judged NEEDS_FIX.
- [ ] Capture final job ids, PR/deploy URLs, head SHAs, test counts, ledger hashes, and memory readback as completion evidence.
