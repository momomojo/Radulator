# AVS aldosterone — safety review and task record

Permanent ID `avs-hyperaldo`; source
`src/components/calculators/AdrenalVeinSamplingAldo.jsx`.

## Current state and required state

Owner exercised the actual public post-ACTH form on2026-09-08: IVC aldosterone
10/cortisol10, left1000/100, right100/100, standard displayed units. Initial
LI10 remains visible/exportable after right aldosterone changes to200; explicit
recalculation produces LI5. The same stale state occurs in the cortisol form.
Blank IVC aldosterone also produces Infinity indices and passing interpretation.
Retained receipt: `custom-calculator-live-triage.json`,2026-09-08T14:52:38.168Z.
These are confirmed live defects, not clinical certification.

Root read the complete aldosterone implementation. Stored results are updated
only by Calculate; input setters and sample add/remove do not invalidate them.
CSV combines current input metadata/units with previously stored results. The
required state is that displayed/exported results belong to the current inputs.

## Owner-approved first implementation task

Repair report-state ownership without changing medical rules. On any input,
unit, protocol, sample-time or metadata edit, and successful sample addition or
removal, immediately clear stored results and CSV availability. Keep all entered
values and sample rows. Calculate recomputes from the current form. Merely
focusing a field, downloading a current report, or clicking a disabled removal
must not erase a current result. Cover pre, post and comparison protocols.

Allowed files: this record, AdrenalVeinSamplingAldo.jsx and a dedicated browser
state-regression spec. First observe failing tests against actual controls;
then implement minimal invalidation and rerun. No formula, threshold, unit
conversion, interpretation, source claim, export format or shared-component
change is authorized by this bounded task. It is one step in the broader audit,
not a substitute for the calculation repair below.

## Independent outcome cases

The synthetic dataset above has left A/C10, right A/C1 and LI10; changing right
aldosterone to200 yields right A/C2 and LI5. After the edit, neither the old
report nor CSV action may remain. After recalculation, the report must return
using the new data. Also test every category of control and successful sample
add/remove in each protocol; all results must disappear before recalculation.

## Broader clinical review and outstanding work

Owner has read Chow2024 main text/tables/discussion (PMC11619738) and the
Endocrine Society2025 AVS implementation section/Table9, not the whole guideline.
The first is a small retrospective stimulated-AVS cohort; CSI/RASI research
cutoffs must not be applied universally to pre-ACTH or nonselective sampling.
Current guidance has protocol-dependent selectivity and a table/prose LI
equality discrepancy requiring explicit reconciliation before a threshold edit.
Naruse2021 full review and the complete clinical contract remain pending.

Required next tasks: paired peripheral-site selection; finite/missing/zero and
overflow handling per output; sample aggregation and selectivity prerequisites;
pre/post threshold provenance; contradictory/nonselective interpretations;
units in labels; actual CSV escaping and content; source/calibration limitations.
Preserve supported indices where prerequisites hold, explicitly withhold only
unsupported outputs. The Infinity defect remains unresolved by state clearing.

## Completion record

State repair implemented locally2026-09-08. The15-case pre-fix run reproduced
14 stale-state failures (report remained after an actual edit) and passed the
unchanged-focus control. After three scoped state-invalidation additions,
35/35 new and existing aldosterone browser tests passed with retries0. The
15 state tests then passed again with explicit LI10-to-LI5 recovery assertions.
Receipts: `avs-aldo-state-red.json`, `avs-aldo-state-green.json` and
`avs-aldo-state-recovery.json` in the retained baseline proof directory.

Fresh npm ci, production build, lint, invariants and whitespace checks passed.
Dependency audit reported3 existing advisories; no dependency change was made.
The owner reread the complete three-location runtime diff: it changes stored
result invalidation only, with no clinical rule or data-conversion modification.
Existing tests passing does not validate their inherited clinical expectations.

Remaining before release: independent code review, sample-action coverage across
all protocols, actual CSV/current-data and mobile acceptance, final release-base
checks, protected PR and signed reviews, deployment and live acceptance.
The Infinity/clinical-interpretation repair and whole-calculator audit remain
open; no registry status upgrade or live fix is claimed.
