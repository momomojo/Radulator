# Calculator planning and closure preflight

Read this before turning a calculator backlog item, guideline-watch result,
seed or historical closure into a proposal, assignment or retained summary.
This is a consumer contract, not another completion tracker.

Resolve the permanent calculator ID to the guideline registry's canonical
`docs/verification/calculators/<id>.md` record and its linked release receipt.
Read current protected-source state and any explicitly owned pending PR. Check
the receipt against the actual PR head, signed gates and deployed source. A
candidate record is not proof that its changes reached protected source.

- **Pending release:** continue the existing task at its unresolved obligation;
  do not commission a duplicate whole-calculator audit from an older backlog.
- **Accepted scope released and live-tested:** reconcile stale pointers. Propose
  further clinical work only for a demonstrated defect, applicable source delta
  or owner-approved scope extension. Completion applies to that recorded scope.
- **New relevant evidence:** preserve the prior completion, identify precisely
  which input/rule/output changes, and reuse or open one bounded delta task.
- **Record unavailable or inconsistent:** report the exact reconciliation gap;
  absence of an old Kanban event is not evidence that the calculator needs a
  rewrite, and an old “verified” label is not evidence of release completion.

Return up to the requested number of evidenced remaining proposals, including
zero. Date/seed status alone may trigger source checking, not reimplementation.
Do not replace source-based clinical review with a comparator's answer.

## Existing ALBI handoff

Permanent ID: `albi-score`. Active/released work is reconciled through
[PR #265](https://github.com/momomojo/Radulator/pull/265), its
[canonical review record](https://github.com/momomojo/Radulator/blob/89a49be5662c2c8bec720e1978eea85989e33c92/docs/verification/calculators/albi-score.md),
and its [read-back release receipt](https://github.com/momomojo/Radulator/pull/265#issuecomment-5591825061).
The receipt, not this reference, records pending versus released status.
The accepted scope is the original ALBI equation/grades, units, applicability,
validation and usable reports; not a treatment-selection or survival nomogram.

This owner-directed PR need not be retrofitted into a Hermes worker queue.
Maintain its canonical record and receipt. Do not fabricate parent tasks,
historical lifecycle events, `smoke_passed` entries or Hindsight acknowledgments.
The managed learning path still requires its genuine exact-release ledger and
retention readback. Planning-reference installation is not retained learning.

For delivery mechanics, use current repository `AGENTS.md`, trusted release mode
and the protected controller. Do not infer batching, back-merging or deployment
success from historical operations prose. Clinical ownership and model routing
follow current owner/project instructions; routine low-cost defaults do not
authorize a weaker model to decide clinical rules.
