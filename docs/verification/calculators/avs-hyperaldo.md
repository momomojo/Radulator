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

### Additional owner-approved input-label correction

Changing either laboratory-unit selector already changes how the runtime reads
all concentrations, but hormone-field labels remain hardcoded to standard units.
Correct those labels to reflect the existing selected units in every pre/post
IVC and adrenal row. This changes no conversion constant, formula or threshold.
Test label/selection agreement first against the current broken form, then verify
equivalent concentrations (ng/dL to pg/mL times10, µg/dL to nmol/L times27.59)
retain the independent SI10/LI10 result and selected-unit CSV values. Runtime
conversion validation beyond these equivalence anchors remains in the clinical
audit. This is within the existing calculator/test/doc scope, not a new feature.

Label regression failed before the correction: selecting pg/mL still displayed
ng/dL on the actual IVC field. Six shared-renderer label spans now use the
existing unit selections. All41 focused browser cases passed afterward with
retries0; receipt `avs-aldo-units-focused.json`. Equivalent-unit assertions verify
both protocol reports and actual CSV, not merely selected dropdown text. Fresh
build/lint/invariants passed. Independent read-only review found no introduced
issue. Existing standard-unit placeholder/range examples remain outside this
label-only correction and require review with the broader clinical input contract.

## Broader clinical review and outstanding work

Owner has read Chow2024 main text/tables/discussion (PMC11619738) and the
Endocrine Society2025 AVS implementation section/Table9, not the whole guideline.
The first is a small retrospective stimulated-AVS cohort; CSI/RASI research
cutoffs must not be applied universally to pre-ACTH or nonselective sampling.
Current guidance has protocol-dependent selectivity and a table/prose LI
equality discrepancy requiring explicit reconciliation before a threshold edit.
The complete clinical contract remains pending. Naruse2021 main-text review is
now complete as recorded below; its figures were not visually inspected.

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

Expanded acceptance passed20/20 cases with retries0: both-side sample addition
and removal in pre/post/comparison modes preserve entered values; actual CSV
contains current right sample200/100 and LI5, not prior LI10; downloading keeps
the report available. A390px keyboard calculation/edit/recalculation has no page
horizontal overflow; owner visually inspected the saved report screenshot.
Receipt `avs-aldo-state-acceptance.json`; screenshot
`avs-aldo-mobile-report.png` under that test's result directory. This is desktop
Chromium mobile-viewport evidence, not native mobile-browser testing.

Independent read-only reviewer found no introduced defect in state ownership or
clinical-rule changes. Nonblocking untested edge: actual clicks on disabled
minimum/maximum sample controls; source guards and disabled state were checked.
Do not claim those clicks were exercised. Owner independently read test output.

Remaining before release: finalized release-base checks, protected PR and signed
reviews, deployment and live acceptance. Existing CSV parsing/escaping and
clinical-rule correctness are not established by the bounded export test.
The Infinity/clinical-interpretation repair and whole-calculator audit remain
open; no registry status upgrade or live fix is claimed.

## Source reconciliation: Naruse2021

Owner read the complete main text, Table1 and discussion of
[Naruse et al.,2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8566130/),
DOI10.3803/EnM.2021.1192, through a normal public HTTPS download after the
browsing service returned a challenge. Local source `/tmp/radulator-naruse-2021.html`.
This is a review article, not a newly inspected primary validation dataset.

Locators: “What are the criteria for successful AVS?” and “What are the criteria
for lateralization?”, Table1 and its footnote. These support a named historical
protocol using SI2 unstimulated/5 stimulated and LI>2/>4, with adjunct suppression
rather than a standalone treatment decision. The article discusses uncertainty
in one-sided AV/IVC prediction and failure to reproduce the original high PPV.
Its narrative also uses inclusive0.5/5.5 where Table1 uses strict comparisons;
do not silently collapse source differences. Cortisol cosecretion and ACTH
discordance limit interpretation.

Implication for next clinical task: existing pre/post thresholds have identifiable
provenance, so they must not be declared invented or overwritten solely because
2025 guidance differs. Separate numerical validity, sample selectivity and
protocol-specific interpretation. Verify underlying studies/current guidance
before deciding the intended supported protocol and resolving equality cases.
