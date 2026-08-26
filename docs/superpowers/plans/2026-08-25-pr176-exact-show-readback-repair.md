# PR 176 Exact Show Readback Repair Plan

**Goal:** Reject reconciliation tracker/source authority that appears only in nested children or history of an unrelated Kanban `show` response.

**Constraints:** Keep `ready-for-gate` absent, preserve every prior PR #176 repair, and do not touch the Mac mini, live Kanban, Formspree, lifecycle ledger, or production.

## Tasks

- [ ] Add independent nested-only tracker and nested-only source regressions and observe both fail on exact head `05315377159f2c3841da613b85ab938d72594fdc`.
- [ ] Require `_exact_task_record(readback, task_id)` and derive the reconciliation status only from that exact root/`task` record.
- [ ] Refresh operator documentation and run scoped plus full release-control verification.
- [ ] Merge current `develop` if necessary, push one immutable corrected head with readiness absent, and request fresh independent rereview.
