---
name: radulator-calculator-audit
description: Use when auditing or closing an existing Radulator calculator end to end, reconciling prior calculator work, checking US-guideline alignment, or tracing its acceptance through Hermes planning and release records.
---

# Radulator calculator audit

This is a project-specific reference workflow, not a new release authority or
clinical certification. The unit of acceptance is one calculator's agreed
supported scope. Follow the current checkout's `AGENTS.md` and protected release
policy; this skill does not enable jobs, change models, or authorize publication.

## Start with the existing record

Resolve the actual Radulator checkout, calculator ID, protected base and active
PR. Resolve `docs/verification/calculators/<id>.md` from current protected source
or the active candidate, record that revision, and read its current receipt
before older plans. A missing file in an older checkout is not a missing audit.
Reuse that record. A registry `verified` label, test count,
or completed PR is not proof of live acceptance.

Read [workflow.md](references/workflow.md) for a full calculator pass, including
the evidence/output matrix, precise test surfaces, command routing and closure.
Read [hermes-lifecycle.md](references/hermes-lifecycle.md) when reconciling prior
work or making claims about planning, duplicate prevention, retained learning,
or unattended release. The latter includes a dated inspection, not live truth.

| Question | Evidence to locate |
|---|---|
| What does the tool actually promise? | Current inputs, outputs, reports, source-reviewed population and exclusions |
| Is advice US-guideline aligned? | Each recommendation mapped to applicable current US guidance and updates; formula validity alone is insufficient |
| Does it calculate and communicate correctly? | Independent cases, raw boundaries, units, invalid inputs, warning/state behavior, real copy and rendered PDF |
| Has it shipped? | Exact signed candidate, protected merged source, deployment/artifact identity, live changed-calculator QA |
| Will Hermes remember it? | Installed registry/consumer readback and applicable lifecycle/learning acknowledgment, separately from release |

## Useful ALBI example, not a universal clinical rule

The original ALBI pass is recorded in
`docs/verification/calculators/albi-score.md` on the ALBI candidate; resolve
[PR265](https://github.com/momomojo/Radulator/pull/265) and its protected merge
rather than assuming this file exists in an older control checkout. Its linked
receipt determines release status. It distinguishes raw-score grading from rounded display,
software input-review warnings from validated clinical limits, and prognosis
from individual treatment eligibility. Do not copy its cutoffs, warning ranges,
conversion constants, or test counts into another calculator.

## Common sources of repeated work

- A reachable citation for the owner may be inaccessible to the independent
  reviewer. Check the actual review host's lawful retrieval path before freezing
  evidence. A hash proves bytes, not a clinical claim or a signed approval.
- DOM print visibility can pass while the PDF clips or overlays text. Inspect
  the actual generated pages; name Chromium PDF versus native printing accurately.
- Updating a review date can invalidate inventory assertions. Test changed
  metadata consumers as well as clinical computation before the final push.
- Archived plans and old worktrees are historical evidence, not assignments.
  Reopen only an evidenced defect, new source delta, or newly approved scope.
- An installed skill is guidance, not deterministic duplicate prevention. Do not
  claim Hermes consumers are synchronized merely because this file exists.
