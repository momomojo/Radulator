# AGENTS.md — coding harness for Radulator

You are working on **radulator.com** — free medical calculators used by real clinicians. Push to `main` = production deploy within minutes, which is why feature work never targets it directly. Work like a careful engineer at a medical device company: small, verified, reversible steps.

**Branch model (release train).** Feature/fix PRs target **`develop`** (integration branch; smoke + targeted CI required). Batches are promoted develop→main by an automated promotion PR that runs the **full Playwright suite** and gets a fresh production-gate review of the whole batch — only then does anything deploy. The ONLY PRs that may target `main` directly are hotfixes for live production breakage, and they also require the full suite. If you are unsure which base to use: `develop`.

## The lifecycle — every task, in order

**1. RESEARCH (before any edit).** Read your task card/issue completely. Read only the files your change touches plus their tests — not the tree. Check how the registry contract applies (below). If the task is ambiguous or conflicts with what you find in code, STOP and report the conflict instead of guessing.

**2. PLAN.** Before editing, write down (in your card comment or PR description): what you will change, what could break, and the **outcome test** — the observable result that proves success (a passing test, a rendered page, a measured count). If you cannot name an outcome test, you do not understand the task yet — go back to research.

**3. EXECUTE.** Small, single-purpose commits with conventional messages (`fix:`, `feat:`, `docs:`, `test:`). Match the surrounding code's style exactly. Never edit generated artifacts (`dist/`). Never commit secrets, tokens, or `.env` content.

**4. TEST.** Minimum for every change: `npm ci && npm run build && npm run lint`. Lint must match main's baseline — zero NEW errors (the baseline itself is dirty; do not try to fix unrelated lint debt in your PR). Behavioral changes need a test that would catch their regression. Calculator logic changes additionally require the full Playwright suite (`npm test`) — not just smoke.

**5. CLEAN UP.** Re-read your full diff as a hostile reviewer: stray debug output, commented-out code, accidental file touches, scope creep — remove them. Your diff should contain nothing you cannot justify in one sentence.

**6. HANDOFF.** Push your branch, open a PR explaining what/why/how-verified, then apply the `ready-for-gate` label **only when CI smoke is green**. The production gate (a separate high-intelligence reviewer) merges or returns `GATE-VERDICT: CHANGES` findings — implement every finding exactly as written, push, and re-apply the label. If you are a hermes kanban worker: end with `kanban_complete` (PR URL as evidence) or `kanban_block` (one-line reason) — never just print text and exit.

## Hard rules

- **Medical content is sacred.** Never change formulas, thresholds, score boundaries, units, interpretation text, or guideline versions unless your task card explicitly authorizes it AND provides the citation. Include the citation in your PR. When in doubt: block and ask — the owner is a physician; medical sign-off is his, not yours.
- **PR-only.** Never push to `main` or `develop` directly. PRs target `develop` (hotfix-to-`main` only for live production breakage). Never merge — the gate merges.
- **The roadmap is not yours.** `docs/ROADMAP.md` is written EXCLUSIVELY by the Strategist routine (and the owner). Workers never edit it — if your task seems to require a roadmap change, note it in your PR description and the strategist will pick it up. Work arrives as GitHub issues labeled `seed` (`lane:flash` / `lane:codex`) — execute the seed body as written; if it is ambiguous, that is a finding for the seed author, not a license to improvise.
- **The registry contract.** Every calculator is one self-contained `.jsx` in `src/components/calculators/` exporting `id`, `name`, `category` (double-quoted string literals — build tooling parses them statically). The registry, README counts, sitemap, and static pages all derive from this metadata. Renaming/removing an `id` breaks deep links (`#/<id>`) and static pages (`/calculators/<id>/`) — treat ids as permanent.
- **GitHub auth (hermes workers):** `export GH_TOKEN="$(sed -n 's/^GH_TOKEN=//p' "$HERMES_HOME/.env" | head -1)"` and verify with `gh api user -q .login` before any GitHub operation. If invalid, block with that fact.

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
npm run build     # production build — also generates 38 static calculator pages + sitemap
npm run lint      # must match main's baseline (no NEW errors)
npm test          # full Playwright suite (required for calculator-logic changes)
npm run test:smoke
```

Rollback (owner/maintainers): revert the merge commit (`git revert -m 1 <sha>`) on a branch → PR → gate; deploy follows the merge automatically.
