# Radulator: clinical baseline and delivery contract

Radulator is a React/Vite medical-calculator site. Preserve its modular calculator
definitions, permanent IDs, public URLs and existing supported functionality.
Do not rewrite the application, add an agent platform/database, or provision a broker.

## Ownership and completion

- GPT-6 Astra owns source-based clinical planning, direct implementation and final
  acceptance. Do not start more Luna clinical implementation tasks. Delegate only
  independent, bounded research or review that reduces total completion effort.
- Keep one calculator implementation active. The acceptance unit is the **whole
  agreed supported scope**, not a single correction. Small commits and urgent
  safety hotfixes are allowed; return to the same calculator's remaining gaps.
- Reconcile 42 calculator records; substantively audit the 41 outside deferred
  BI-RADS. Do not claim a sixth-edition BI-RADS implementation without its material.
- Distinguish source review, computation tests, browser/report QA, signed release
  approval, merged source, deployed artifact and live acceptance. Neither passing
  tests nor old "verified" labels prove completed clinical review.
- The existing guideline registry links each calculator's review-and-task record;
  inventory is generated from it. Reuse that record; do not add another tracker.
  Restrictions/source gaps stay explicit and prevent unsupported closure claims.
- Keep legacy `radulator-seed-convert` job `c41b8448cce4` paused unless the owner
  authorizes resumption. Preserve independent signed reviewers and existing drafts.

## Working cycle

1. Read the current task record, exact checkout/base, relevant implementation and
   tests. Do not scan the entire repository or reload historical session logs.
2. Before clinical edits, define population, outputs, exclusions, version and
   independent expected cases from primary evidence. Record the gap and tasks.
   Never change formulas, thresholds, units, interpretation/management text or
   expected answers without authorized scope and adequate source evidence.
3. Implement directly in the isolated worktree; use test-first regression cases.
   Review actual sources and code, not just another agent's summary. These are
   source-based AI reviews, not professional certification.
4. Use focused checks during editing. Before first push/handoff run `npm ci`,
   production build, lint, invariants and meaningful behavioral tests. Reuse a
   successful dependency install while its lockfile/runtime are unchanged; a
   broken toolchain requires `npm ci`, never skipped verification.
5. Clinical PRs still require the finalized full suite through required CI. Do
   not duplicate passing full runs on an unchanged subject; changed heads,
   relevant bases, failures or new concerns invalidate the applicable evidence.
6. Complete protected release and live QA, update the calculator record, then
   move on. Report whole-calculator completions, restrictions and rework—not PR
   counts or agent-hours. A bounded hotfix does not close the broader audit.

## Tools and context

- Use `rg`/Git for local inspection, batched `gh --json` for repository state,
  and GitHub MCP when its structured response helps. Do not fetch the same data
  through both without a reason. Use completion events, not continuous polling.
- Use `npm run research -- ...` for retained PubMed/PMC evidence; see
  [research access](docs/development/research-access.md). PubMed MCP is a discovery
  aid. Check exact IDs, versions, locators and correction notices yourself.
  Cached bytes passing a hash check are **not** verified clinical claims.
- Public literature queries only. Never transmit patient text, inputs, results
  or secrets through research tools, analytics or diagnostics. Never print,
  search for, or copy credentials into prompts, logs or agent messages.
- Use `npm run qa:local -- tests/e2e/<scope>.spec.js` for isolated production-
  preview QA and compact receipts. Shared Playwright configurations use a strict
  worktree-specific port and no server reuse. Override only with
  `RADULATOR_QA_PORT`; client URL and server command must agree.
- Preserve source/artifact identities and detailed logs on disk; read summaries
  and failures first. Copy/print/mobile claims must match actual tests. Print-media
  rendering is not native printing. Use synthetic inputs for browser checks.
- Give reviewers only calculator ID, exact revision, record path, allowed scope,
  accepted evidence and specific question. No full-session-history forks or
  nested reviewers. Reassess after two material rework rounds.
- Make routine decisions within approved scope. Ask only for a consequential
  unresolved clinical conflict, missing authority or meaningful scope expansion.

## Protected publication — unchanged authority

Read trusted `RADULATOR_RELEASE_MODE` before publishing. Missing/empty or
`release-train` means feature PR → protected `develop` → protected promotion to
`main`; only confirmed live hotfixes may target main directly. `single-main`
permits normal feature PRs to protected main. Unknown values fail closed.
Only the owner activates migration after the control release, protection
readback and rollback rehearsal; prove a clinical canary live before disabling
promotion. Retain historical branches and rollback configuration. See the
[artifact contract](docs/development/release-artifact-contract.md).

- PR-only; never directly push protected branches, force-publish, merge manually,
  self-sign reviews, bypass protection, or run manual deployment commands.
- Coordinator publishes isolated feature branches. `ready-for-gate` is added
  only after required CI succeeds on the finalized head. Standard risk requires
  primary signed PASS; formula/threshold/management or other high-risk changes
  require independent primary and verification PASSes. Changed head/base or
  authority requires fresh applicable evidence and reviews. `NEEDS_FIX` means
  exact-SHA rework. Only the trusted controller merges the authorized SHA.
- Host supervision uses configured `gh` credentials without exposing them.
  Hermes-managed workers use their approved credential-free publisher and must
  bootstrap/read back their release tracker with `lifecycle_controller.py`
  before completing the implementation task. Ordinary owner-directed work does
  not have to move into Hermes.
- Build with production configuration, test and deploy the same artifact, retain
  source/artifact identity and live evidence. Failed production smoke uses the
  existing last-good rollback; permanent revert still goes through a gated PR.

## Repository invariants

- Work in the existing isolated worktree. Fetch and reconcile the true target;
  preserve unrelated edits/historical worktrees. Never edit generated `dist`.
- Static calculator metadata stays in a `.jsx` under `src/components/calculators/`,
  exporting `id`, `name`, `category` as double-quoted literals. IDs never move;
  registry/counts/sitemap/static pages are generated, not hand-maintained.
- Roadmap changes belong to the owner/Strategist, not implementation workers.
- Keep input labels, button types, keyboard behavior and accessible reports.
- Account for CI-only production configuration; generators must fail loudly.
- Commands: `npm run build`, `npm run lint`, `npm run check:invariants`,
  `npm run test:qa-harness`, `npm run test:research`; focused computation/browser
  checks per task. Full CI and signed gates remain required where applicable.
