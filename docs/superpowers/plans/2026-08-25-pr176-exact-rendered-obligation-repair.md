# PR 176 Exact Rendered Obligation Repair Plan

**Goal:** Close four exact-head fail-closed gaps found on PR #176 head `736d0c3b0f27bd013851db750f21f84e19636466` without touching live state.

**Architecture:** Tokenize prose authority by exact PR clauses, bind every reviewed release tuple to the exact lifecycle event that renders corrective actions, replace recursive Formspree digest searches with exact current-task evidence, and version any terminalized `NEEDS_FIX` prerequisite into a durable open replacement while preserving history and idempotency.

**Tech Stack:** Python standard library, `unittest`, Hermes Kanban CLI adapter, tamper-evident JSONL lifecycle ledger.

## Constraints

- Keep `ready-for-gate` absent through correction and independent rereview.
- Do not mutate the Mac mini, live Kanban, Formspree, lifecycle ledger, or production.
- Preserve unrelated parents, historical terminal tasks, exact `0600` state, fair bounded replay, and batch preflight.
- Add and observe each adversarial regression before its production fix.

## Tasks

- [ ] Add a same-line two-PR prose regression proving head/base tokens cannot cross into a different PR clause; implement clause-bounded parsing.
- [ ] Add an existing-event conflict regression proving the reviewed PR/head/base tuple matches the exact lifecycle event used to render actions; fail before mutation.
- [ ] Add legacy Formspree regressions for nested relation/event digest bait and a 65-hex prefix; accept only exact current-task structured fields or delimited top-level body/comments.
- [ ] Add a terminalized unchanged-head `NEEDS_FIX` prerequisite regression; create one versioned open replacement, preserve the terminal task id in durable history, and fail closed if the replacement is not runnable.
- [ ] Update the reconciliation runbook, run scoped and full gates, push one immutable head with readiness still absent, and request fresh independent review.
