# PR 176 Final Authority and CAS Repair Plan

**Goal:** Close the remaining exact-head reconciliation races and recursive Formspree authority gaps without mutating live state.

**Constraints:** Keep `ready-for-gate` absent, preserve every prior PR #176 correction, make no Mac mini/Kanban/Formspree/production changes, and publish only after fresh exact-head verification.

## Tasks

- [x] Add a failing lifecycle regression where a concurrent `NEEDS_FIX` to new-head `implementing` transition occurs during reconciliation preflight; reject every stale action before `adapter.perform`.
- [x] Add a failing lifecycle regression for an unsupported exact-task Kanban status; accept only the canonical Hermes task statuses.
- [x] Add failing Formspree regressions proving task identity, status, parent relation, and legacy-task reference cannot come from nested children/events/history.
- [x] Store the exact current lifecycle event hash/state/head in each frozen action plan and compare it immediately before every individual action apply.
- [x] Scope Formspree authority to the exact root/top-level `task`, its current top-level relation containers, and its exact top-level comments/body.
- [x] Run focused red-green cycles, full Hermes discovery, the repository local gate, and diff/syntax checks.
- [ ] Push one new immutable head for independent rereview with readiness absent.
