# AGENTS.md — coding harness for Radulator

You are working on **radulator.com** — free medical calculators used by clinicians. A protected merge to `main` enters production deployment. Use small, source-reviewed, tested and reversible changes; never publish manually.

**Branch model is controlled, not inferred.** Read the trusted repository variable `RADULATOR_RELEASE_MODE` before publication. Missing/empty or `release-train` retains feature PRs to protected `develop`, followed by the existing protected promotion PR to `main`; only confirmed live hotfixes may target main directly. `single-main` permits normal short-lived PRs to protected `main` and rejects new develop work. Unknown values fail closed. This document does not activate the migration. Only the owner activates it after the control release, protection/readback checks and rollback rehearsal, then proves one clinical canary live before disabling the old promotion routine. Keep historical branches and rollback configuration. See [the artifact contract](docs/development/release-artifact-contract.md).

## Agent harness

Use GPT-6 Astra as the coordinating owner and direct implementer for the remaining clinical baseline, per the user's 2026-09-07 change of approach. Do not start additional Luna clinical implementation tasks. Preserve existing drafts and review them as code, not accepted results. Independent reviewers remain separate and use the signed risk-tiered release path. Optional mechanical delegation is exceptional and must save total accepted-change effort, not merely generation tokens. A direct owner task is valid even when it did not arrive through a seed or strategist routine.

The legacy daily `radulator-seed-convert` job (`c41b8448cce4`) was paused through the supported Hermes task command on 2026-09-07 to stop its automatic research-to-implementation delegation. Keep it paused during this baseline unless the user authorizes resumption or a replacement policy. Do not disable the independent signed reviewers or protected release controls as part of this ownership change. Existing drafts and unrelated research/maintenance jobs are preserved.

For clinical work, Astra first reads the current implementation and primary sources, defines the supported population/outputs/exclusions, independently derives expected cases, and records gaps and small tasks in the calculator's existing review-and-task document. The guideline registry links that document; generated inventory is the summary. Never change clinical targets or expected answers merely to pass tests. Finish one clinical correction through live verification before accumulating more implementation branches; retain existing unpublished work without losing it. Astra checks actual sources, code and browser/report behavior before final acceptance; separate signed reviews still control release. These are source-based AI reviews, not professional certification. Existing verified labels and test counts do not establish completion of a broader audit.

Infer routine details from the task and prior approvals, preserve ongoing authorization, and ask only when an unresolved choice would materially change scope, safety, or an external irreversible action. Do not repeat a plan, spawn a boilerplate planning loop, or rerun passing checks without a relevant change, a failed concern, or a required gate. Keep output concise and state assumptions and outcome evidence clearly.

Never print, search for, or copy token contents into prompts, logs, review records, or agent messages. The supervised host CLI is an approved execution path; Hermes queue/tracker requirements apply only to an explicitly Hermes-managed worker task and are documented separately below.

## Local-first CI policy

Before handoff or the first push, run the canonical local gate: `npm ci`, `npm run build`, `npm run lint`, and `npm run check:invariants`, plus the task's meaningful focused or behavioral test. Batch deterministic fixes locally instead of using Actions as a debugger. Run broader checks only when the change, a failure, or an unresolved concern justifies them; required PR checks and the promotion full suite are never skipped or waived. Do not manually dispatch the full suite for ordinary iterations.

Parallel worktrees must not share a browser-test server. Assign each task its own port (and tmux session if used); set the test base URL and server command to that same port, with the exact worktree as server cwd, `--strictPort`, and no server reuse. Vite's silent fallback to a different port can otherwise make a test exercise another checkout. Build the candidate before production-preview QA and retain the tested source/artifact identity; rerun affected checks after any target ambiguity. Read complete revision IDs directly from Git/GitHub instead of reconstructing them from shortened IDs.

## The lifecycle — every task, in order

**1. RESEARCH (before any edit).** Read the task and applicable instructions completely. Read only the files your change touches plus their tests — not the tree. Check how the registry contract applies (below). Make reasonable routine assumptions from the task context; pause only for a material scope, safety, or authorization conflict.

**2. PLAN.** For non-trivial work, keep one compact note of the change, main break risk, and **outcome test** — the observable result that proves success. Reuse an existing reviewed plan or task card instead of repeating it in new boilerplate.

**3. EXECUTE.** Small, single-purpose commits with conventional messages (`fix:`, `feat:`, `docs:`, `test:`). Match the surrounding code's style exactly. Never edit generated artifacts (`dist/`). Never commit secrets, tokens, or `.env` content.

**4. TEST.** Minimum for every implementation change: `npm ci && npm run build && npm run lint && npm run check:invariants`, plus a meaningful regression or behavioral test. Lint/invariants must match main's baseline — zero NEW errors. Clinical PRs require the full Playwright suite on the finalized candidate through required CI; focused local iterations do not replace it, but workers must not duplicate a passing full run on the same subject. A changed head or relevant base invalidates that evidence. UI/product changes need feature proof per `docs/development/feature-verification.md`: start `scripts/dev-local.sh up` or `preview`, drive the app, and record screenshot/trace/proof paths. Copy and print claims must match what was actually tested; a print-button test does not prove native printing. Do not repeat checks that already passed unless code, dependencies, or the failure concern changed.

**5. CLEAN UP.** Re-read your full diff as a hostile reviewer: stray debug output, commented-out code, accidental file touches, scope creep — remove them. Your diff should contain nothing you cannot justify in one sentence.

**6. HANDOFF.** The coordinating owner publishes the isolated branch and PR with its scope and verification evidence; workers report local results without publishing. Apply `ready-for-gate` only after required CI passes on the finalized head. The signed clinical gate judges that exact head: standard risk needs one primary PASS; formula/threshold/management or other high-risk work needs independent primary and verification PASSes. `NEEDS_FIX` creates one exact-SHA rework task; a changed head/base or authority state requires fresh evidence and reviews. The trusted controller alone merges the exact authorized SHA after native protections pass. Report code acceptance, merged source, artifact/deployment identity and live QA separately; no completion claim from a PR or local commit alone.

If you are a Hermes Kanban implementation worker, create/read back the separate release tracker before completing the implementation task: `python3 ops/hermes/radulator/lifecycle_controller.py bootstrap --apply --parent-task-id "$HERMES_KANBAN_TASK" --pr <PR> --head-sha <HEAD_SHA>`. Then `kanban_complete` the implementation task with the PR URL, exact SHA, and release-tracker id. The tracker—not the implementation task—stays open through clinical review, merge, deployment smoke, retained learning, and final completion. Use `kanban_block` only for a concrete missing prerequisite, never merely because review is pending.

## Hard rules

- **Medical content is sacred.** Never change formulas, thresholds, score boundaries, units, interpretation text, management recommendations, or guideline versions unless the task explicitly authorizes it and provides primary-source evidence. Include citations and regression vectors in the PR. Do not self-approve: uncertainty is a `NEEDS_FIX` verdict. Clinical release authority belongs to the signed risk-tiered judge quorum, not an informal owner wait or a worker assertion.
- **PR-only.** Never push to `main` or `develop` directly. Choose the target from the trusted active release mode above. Never merge manually; only the trusted controller may merge the exact SHA authorized by the clinical gate and branch protection. No force publishing or permission/protection bypass.
- **The roadmap is not yours.** `docs/ROADMAP.md` is written EXCLUSIVELY by the Strategist routine and the owner. Workers never edit it — if your task seems to require a roadmap change, note it in the task or PR description. Work may arrive through a seed or directly from the owner; follow the authorized task body and record material assumptions rather than inventing roadmap scope.
- **The registry contract.** The static calculator metadata definition/adaptor remains a `.jsx` in `src/components/calculators/` exporting `id`, `name`, and `category` (double-quoted string literals — build tooling parses them statically). Pure clinical helpers may live in adjacent modules when authorized; the metadata definition remains the registry source and calculator IDs never move. The registry, README counts, sitemap, and static pages all derive from this metadata. Renaming/removing an `id` breaks deep links (`#/<id>`) and static pages (`/calculators/<id>/`) — treat ids as permanent.
- **GitHub auth.** Supervised host work uses the configured `gh` credential store and non-secret identity checks. Hermes workers use the approved credential-free publisher path; never extract, print, or pass token contents through the shell, prompts, logs, or review records.

## Error classes to think about (these have actually bitten this repo)

- **Env-dependent builds:** CI sets secrets (e.g. `VITE_GA4_MEASUREMENT_ID`) that local builds lack — a transform that runs only in CI once consumed another step's regex anchor and shipped 38 broken pages while local builds looked perfect. For any build-pipeline change, reason explicitly: *what is different in CI?* And make generators **fail loudly** — a thrown error beats a silent no-op every time.
- **Stale-base work:** workspace clones can lag origin. Fetch and reconcile with the actual target branch selected by the active release mode before opening a PR. Preserve unrelated user changes; never force-update a reviewed/published head to avoid review invalidation.
- **Derived-data drift:** counts, lists, and inventories in docs must be derived from source (registry metadata), never hand-typed.
- **Wrong local target:** a listening port alone is not proof of the intended worktree/build. Use the isolated strict-port rule above; an unrelated checkout's passing result is not acceptance evidence.
- **Accessibility erosion:** keep explicit `type` on buttons, labels on inputs, focus management in dialogs. WCAG compliance is an active investment here.
- **Partial toolchains:** if `node_modules` is broken, run `npm ci` — do not work around missing tools or skip verification because the environment is inconvenient. If the environment blocks verification (sandbox, network), say so explicitly in your handoff instead of claiming success.

## Commands

```bash
npm ci            # always this, never bare npm install, for clean state
npm run dev       # local dev server
npm run build     # production build — also generates registry-derived static calculator pages + sitemap
npm run lint      # must match main's baseline (no NEW errors)
npm run check:invariants  # Radulator-specific metadata/guardrail checks
npm test          # full Playwright suite (required for calculator-logic changes)
npm run test:smoke
scripts/dev-local.sh up    # local app-driving QA server in tmux
npm run proof:feature -- --route '/#/tirads' --expect-text 'TI-RADS'
```

Failed production smoke automatically redeploys the last verified good `main` SHA without rewriting history. Permanent code rollback still uses a revert branch (`git revert -m 1 <sha>`) → PR → risk-tiered gate → exact-head automatic merge.
