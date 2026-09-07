# AGENTS.md — coding harness for Radulator

You are working on **radulator.com** — free medical calculators used by real clinicians. Push to `main` = production deploy within minutes, which is why feature work never targets it directly. Work like a careful engineer at a medical device company: small, verified, reversible steps.

**Branch model (release train).** Feature/fix PRs target **`develop`** (integration branch; smoke + targeted CI required, with the full suite required when the trusted risk classifier marks the change high risk). Batches are promoted develop→main by an automated promotion PR that runs the **full Playwright suite** and gets a fresh production-gate review of the whole batch — only then does anything deploy. The ONLY PRs that may target `main` directly are hotfixes for live production breakage, and they also require the full suite. If you are unsure which base to use: `develop`.

## Agent harness

Use GPT-6 Astra as the coordinating owner. Implementation agents use GPT-5.6 Luna at xhigh reasoning unless the owner explicitly selects another supported setting; independent reviewers must remain separate from the implementation agent and use the signed risk-tiered review path. Delegate genuinely independent work in parallel with isolated scopes, and keep one owner responsible for integration. A direct owner task is valid even when it did not arrive through a seed or strategist routine.

Infer routine details from the task and prior approvals, preserve ongoing authorization, and ask only when an unresolved choice would materially change scope, safety, or an external irreversible action. Do not repeat a plan, spawn a boilerplate planning loop, or rerun passing checks without a relevant change, a failed concern, or a required gate. Keep output concise and state assumptions and outcome evidence clearly.

Never print, search for, or copy token contents into prompts, logs, review records, or agent messages. The supervised host CLI is an approved execution path; Hermes queue/tracker requirements apply only to an explicitly Hermes-managed worker task and are documented separately below.

## Local-first CI policy

Before handoff or the first push, run the canonical local gate: `npm ci`, `npm run build`, `npm run lint`, and `npm run check:invariants`, plus the task's meaningful focused or behavioral test. Batch deterministic fixes locally instead of using Actions as a debugger. Run broader checks only when the change, a failure, or an unresolved concern justifies them; required PR checks and the promotion full suite are never skipped or waived. Do not manually dispatch the full suite for ordinary iterations.

## The lifecycle — every task, in order

**1. RESEARCH (before any edit).** Read the task and applicable instructions completely. Read only the files your change touches plus their tests — not the tree. Check how the registry contract applies (below). Make reasonable routine assumptions from the task context; pause only for a material scope, safety, or authorization conflict.

**2. PLAN.** For non-trivial work, keep one compact note of the change, main break risk, and **outcome test** — the observable result that proves success. Reuse an existing reviewed plan or task card instead of repeating it in new boilerplate.

**3. EXECUTE.** Small, single-purpose commits with conventional messages (`fix:`, `feat:`, `docs:`, `test:`). Match the surrounding code's style exactly. Never edit generated artifacts (`dist/`). Never commit secrets, tokens, or `.env` content.

**4. TEST.** Minimum for every implementation change: `npm ci && npm run build && npm run lint && npm run check:invariants`, plus a meaningful regression or behavioral test. Lint/invariants must match main's baseline — zero NEW errors. Calculator logic changes additionally require the full Playwright suite (`npm test`) — not just smoke. UI/product changes need feature proof per `docs/development/feature-verification.md`: start `scripts/dev-local.sh up` or `preview`, drive the app, and record screenshot/trace/proof paths. Do not repeat checks that already passed unless code, dependencies, or the failure concern changed.

**5. CLEAN UP.** Re-read your full diff as a hostile reviewer: stray debug output, commented-out code, accidental file touches, scope creep — remove them. Your diff should contain nothing you cannot justify in one sentence.

**6. HANDOFF.** Push your branch, open a PR explaining what/why/how-verified, then apply the `ready-for-gate` label **only when CI smoke is green**. The signed clinical gate judges that exact head automatically: standard risk needs one primary PASS; formula/threshold/management or other high-risk work needs independent primary and verification PASSes. `NEEDS_FIX` creates one exact-SHA rework task; correct it on the same PR and push a new head, which invalidates every old approval. The trusted merge controller merges only the currently approved exact SHA after all branch rules pass.

If you are a Hermes Kanban implementation worker, create/read back the separate release tracker before completing the implementation task: `python3 ops/hermes/radulator/lifecycle_controller.py bootstrap --apply --parent-task-id "$HERMES_KANBAN_TASK" --pr <PR> --head-sha <HEAD_SHA>`. Then `kanban_complete` the implementation task with the PR URL, exact SHA, and release-tracker id. The tracker—not the implementation task—stays open through clinical review, merge, deployment smoke, retained learning, and final completion. Use `kanban_block` only for a concrete missing prerequisite, never merely because review is pending.

## Hard rules

- **Medical content is sacred.** Never change formulas, thresholds, score boundaries, units, interpretation text, management recommendations, or guideline versions unless the task explicitly authorizes it and provides primary-source evidence. Include citations and regression vectors in the PR. Do not self-approve: uncertainty is a `NEEDS_FIX` verdict. Clinical release authority belongs to the signed risk-tiered judge quorum, not an informal owner wait or a worker assertion.
- **PR-only.** Never push to `main` or `develop` directly. PRs target `develop` (hotfix-to-`main` only for live production breakage). Never merge manually; only the trusted controller may merge the exact SHA authorized by the clinical gate and branch protection.
- **The roadmap is not yours.** `docs/ROADMAP.md` is written EXCLUSIVELY by the Strategist routine and the owner. Workers never edit it — if your task seems to require a roadmap change, note it in the task or PR description. Work may arrive through a seed or directly from the owner; follow the authorized task body and record material assumptions rather than inventing roadmap scope.
- **The registry contract.** The static calculator metadata definition/adaptor remains a `.jsx` in `src/components/calculators/` exporting `id`, `name`, and `category` (double-quoted string literals — build tooling parses them statically). Pure clinical helpers may live in adjacent modules when authorized; the metadata definition remains the registry source and calculator IDs never move. The registry, README counts, sitemap, and static pages all derive from this metadata. Renaming/removing an `id` breaks deep links (`#/<id>`) and static pages (`/calculators/<id>/`) — treat ids as permanent.
- **GitHub auth.** Supervised host work uses the configured `gh` credential store and non-secret identity checks. Hermes workers use the approved credential-free publisher path; never extract, print, or pass token contents through the shell, prompts, logs, or review records.

## Error classes to think about (these have actually bitten this repo)

- **Env-dependent builds:** CI sets secrets (e.g. `VITE_GA4_MEASUREMENT_ID`) that local builds lack — a transform that runs only in CI once consumed another step's regex anchor and shipped 38 broken pages while local builds looked perfect. For any build-pipeline change, reason explicitly: *what is different in CI?* And make generators **fail loudly** — a thrown error beats a silent no-op every time.
- **Stale-base work:** workspace clones can lag origin. Always `git fetch` + rebase onto the real `origin/develop` (or `origin/main` for hotfixes) before opening a PR.
- **Derived-data drift:** counts, lists, and inventories in docs must be derived from source (registry metadata), never hand-typed.
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
