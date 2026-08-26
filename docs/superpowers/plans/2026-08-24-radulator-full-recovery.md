# Radulator Full Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Restore Radulator to a continuously publishing, exact-head-gated release system; clear stale automation blockers; process the clinical backlog safely; and make society-guideline provenance and refresh status explicit and testable.

**Architecture:** GitHub remains the authoritative source, CI executor, protected-branch controller, and deployment ledger. Hermes proposes and signs exact-state decisions but cannot bypass CI, signed high-risk quorum, protected branches, legal constraints, deployed-SHA smoke tests, or rollback authorization. Every recoverable hold must produce a bounded corrective obligation and retry; only an unresolved legal/licensing constraint may remain externally blocked.

**Tech Stack:** React, Vite, Playwright, Node.js 20, Python 3.9+, GitHub Actions, GitHub Pages, Hermes profiles/Kanban/cron, Ed25519 attestations.

**Spec:** `docs/superpowers/specs/2026-08-23-risk-tiered-autonomous-release.md`

## Global constraints

- Work only through pull requests targeting `develop`; production promotion remains controller-owned.
- Bind every clinical decision and merge attempt to the exact base/head state and required CI run.
- Run the full browser suite for calculator, input, output, unit, interpretation, or citation changes.
- Use primary society publications, standards, or peer-reviewed source papers for medical claims.
- Never store signing private keys or GitHub credentials in the repository, logs, comments, or command arguments.
- Preserve legitimate copyright/licensing boundaries; convert them into a specific research or implementation path instead of a vague passive hold.
- Treat current live GitHub, Hermes, and deployed-site readback as authoritative; stale card text is not a blocker.

## Task 1: Establish a clean, current baseline

**Files:**

- Inspect: `AGENTS.md`
- Inspect: `package.json`
- Inspect: `.github/workflows/*.yml`

1. Fetch current `origin/develop` and work in an isolated branch/worktree.
2. Run the full Playwright suite, build, lint, invariant checks, and production dependency audit.
3. Record failures as separate, reproducible obligations before modifying source.

## Task 2: Make deployment reconciliation idempotent

**Files:**

- Modify: `scripts/reconcile-deployment.mjs`
- Modify: `scripts/deployment-identity.mjs`
- Test: `scripts/reconcile-deployment.test.mjs`
- Test: `scripts/deployment-identity.test.mjs`

1. Add a failing regression that reproduces the GitHub Actions workflow-run metadata shape observed for an already-successful `repository_dispatch` deployment.
2. Prove the current reconciler incorrectly dispatches the same `main` SHA again.
3. Scope run identity to the already-selected deploy workflow, validate the exact display-title/ref and SHA, and avoid relying on nullable branch/name metadata for `repository_dispatch`.
4. Retain strict branch validation for push-triggered deployments and reject mismatched refs.
5. Run the focused deployment identity, authorization, reconciliation, smoke, and rollback suites.

## Task 3: Preserve lifecycle phase across a recoverable block

**Files:**

- Modify: `ops/hermes/radulator/lifecycle_controller.py`
- Test: `ops/hermes/radulator/tests/test_lifecycle_controller.py`

1. Add failing tests for `smoke_passed -> blocked -> smoke_passed -> learned` and `learned -> blocked -> learned -> complete`.
2. Add tests for invalid resume targets and replay of legacy blocked ledger records.
3. Store a hash-covered `resume_state` on new blocked events and reconstruct the prior resumable phase for legacy records.
4. Permit recovery only to the retained exact phase, keeping state transitions and side effects idempotent.
5. Run all Hermes Python lifecycle/installer tests under macOS-compatible Python 3.9 semantics.

## Task 4: Close the dependency audit gap

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/deploy.yml`

1. Capture the current production audit failures.
2. Upgrade direct and transitive dependencies to patched, supported releases without changing application behavior.
3. Re-run `npm audit --omit=dev --audit-level=high` until it passes.
4. Remove the deployment workflow's warning-only bypass so production dependency audit failures stop the release.
5. Re-run build, lint, invariants, and the full browser suite.

## Task 5: Publish and prove the control-plane recovery

1. Commit only the scoped recovery changes and push a PR targeting `develop`.
2. Obtain exact-head CI and independent judge readback; repair any concrete findings on the same PR with a new head.
3. Allow the trusted merge controller to merge after all requirements pass.
4. Verify promotion to `main`, one deployment for the new SHA, exact release marker, live smoke, and rollback readiness.
5. Observe at least two reconciler cycles without a duplicate deployment.

## Task 6: Reconcile the Kanban backlog with live state

1. Enumerate all blocked Radulator cards with their workspace, head, retry count, and current external state.
2. Complete/archive stale cards whose GitHub obligation is already satisfied, including the closed issue and superseded duplicate back-merges.
3. Requeue recoverable publication cards now that authenticated GitHub write access is proven.
4. Verify claim leases, bounded retries, no starvation, single-flight scheduling, and authoritative post/PR readback.
5. Leave zero Radulator cards blocked solely by stale auth, DNS, duplicate work, or an already-resolved hold.

## Task 7: Process the clinical backlog safely

1. Rebase the CAC/MESA repair onto current `develop`; validate semantics against the official calculator/publication; run the full suite; push the existing PR branch; and obtain high-risk judge quorum.
2. Triage each remaining Bosniak, MELD 3.0, BI-RADS, institutional-edition, and related PR/issue against current primary guidance and exact live implementation.
3. Convert valid review feedback into tests first, correct the same PR, and rerun the full suite and signed clinical gate.
4. Merge and deploy passing work automatically; close or supersede obsolete proposals with linked evidence.
5. For copyrighted standards, implement only permitted terminology/logic and preserve a narrowly stated legal obligation rather than silently shipping restricted tables.

## Task 8: Make guideline provenance and refresh automatic

**Files:**

- Add: `docs/clinical/guideline-registry.json`
- Add: `scripts/check-guideline-registry.mjs`
- Add: `scripts/check-guideline-registry.test.mjs`
- Modify: calculator metadata and relevant Hermes operations instructions

1. Inventory every calculator and medical decision aid, including shared input/output paths.
2. Require an explicit guideline/instrument version, issuing society, primary-source URL/DOI, last verified date, and affected calculator IDs.
3. Seed the registry only from authoritative ACR, SIR, SNIS, RSNA, AASLD/OPTN, ACC/AHA, or original validated-instrument sources as appropriate; do not imply that one society governs every calculator.
4. Add deterministic checks for missing coverage, malformed citations, duplicate IDs, expired verification dates, and version mismatch with runtime metadata.
5. Update the monthly Hermes guideline watcher to research official sources, open/update a PR with citations, request signed clinical review, fix concrete judge findings, and continue through merge/deployment without waiting for owner approval unless a genuine legal/licensing decision is required.
6. Add the registry check to CI and the release-learning evidence set.

## Task 9: Completion proof

1. Run all focused tests, full Playwright, build, lint, invariants, syntax/YAML validation, production audit, lifecycle tests, release-policy tests, deployment tests, and guideline-registry tests.
2. Verify live website routes, exact deployed SHA marker, citation links, current society/version labels, and calculator regression fixtures.
3. Verify GitHub has no unresolved actionable automated review feedback on merged heads and no eligible PR waiting on a stale gate.
4. Verify Hermes jobs are healthy, learning events are retained, review handoffs create bounded corrective obligations, and all recoverable holds advance.
5. Report any remaining external legal/licensing obligation explicitly; do not call the system fully current or complete until all other required work is merged and live.
