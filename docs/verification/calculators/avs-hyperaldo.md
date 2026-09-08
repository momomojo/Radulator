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

## Next owner-approved task: numerical prerequisites, before criteria policy

Owner re-read computeSet, peripheral selection, warning construction and CSV
serialization at ac54bbc. ANZ consensus sections4.1–4.2 explicitly define SI
as adrenal/peripheral cortisol, LI as the ratio of adrenal A/C values, and
suppression/AV-IVC as adrenal A/C divided by peripheral A/C. These definitions
support the dependency matrix below independently of disputed diagnostic
thresholds. Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC11612544/ ,
section IDs `cen15139-sec-0180` and `cen15139-sec-0190`. The owner inspected
the retained public HTML when the browser service returned a challenge.

| Output | Required numerical inputs | Missing/invalid-input consequence |
|---|---|---|
| Each side's SI | That adrenal cortisol and explicitly identified peripheral cortisol, finite and positive | Withhold that SI and its success assertion, not the other side's independently valid ratio. |
| Each adrenal A/C | Paired adrenal aldosterone and cortisol from the same sample, positive and finite | Withhold that A/C; never substitute zero for a blank or average a partially entered row silently. |
| LI | Two positive finite adrenal A/C values | Arithmetic may remain available without peripheral aldosterone; clinical lateralization additionally requires valid selectivity under the selected named criteria. |
| Peripheral A/C | Positive finite aldosterone and cortisol from the same identified peripheral site | Withhold if the pair is absent; never combine suprarenal aldosterone with infrarenal cortisol. |
| CR/CSI and AV-IVC/RASI | Appropriate adrenal A/C and positive finite peripheral A/C | Show unavailable with a specific reason; omit dependent interpretive claims. Never treat Infinity as a criterion met. |

These are software-input requirements, not a claim that a biological zero cannot
occur. A zero/below-assay-limit laboratory result needs explicit censoring handling;
the current form has none, so it cannot be silently treated as an exact positive
denominator. Do not manufacture detection-limit substitutions. Negative,
nonfinite, malformed and overflowed values must never become clinical results.

Independent standard-unit anchors (one paired sample per side): peripheral
A10/C10, left A1000/C100, right A100/C100 gives SI10/10, adrenal A/C10/1,
peripheral A/C1, LI10, CR/CSI1 and AV-IVC/RASI10. Clearing only peripheral
aldosterone must preserve SI10/10 and numerical LI10 while withholding all
peripheral-A/C-dependent outputs and claims. Right A200 gives LI5 and CR/CSI2,
not a change to SI. Equal adrenal A/C values give numerical LI1 and no unique
dominant side. Supra A20 with blank supra cortisol plus infra C10 with blank
infra aldosterone must not manufacture peripheral A/C2. SI may use an explicitly
identified cortisol baseline; report the actual source site.

Execution steps within this existing lane:

1. Add actual-control failing cases for the dependency anchors above, blank/zero/
   negative/overflow values, partial sample rows and pre/post isolation. Retain
   the red evidence; changing assertions to accept Infinity is prohibited.
2. Separate parsing and per-output validity from clinical criteria. Preserve
   protocol identity and report reasons alongside unavailable values. Avoid
   whole-report rejection when independent outputs remain computable.
3. Make UI and actual CSV agree on value, units, source site and unavailable
   reason; no `.toFixed` call on an unavailable value. Dependent interpretations
   must respect validity before evaluating any cutoff.
4. Review sample aggregation/timing separately before generalizing the one-pair
   anchors to multiple samples. The existing mean-of-all-rows behavior is not
   clinically accepted by this numerical contract.
5. Root reviews source, diff and actual-control results. Required full release
   checks and signed reviews remain mandatory. No registry verification upgrade.

Allowed scope: this record, the existing aldosterone component and its dedicated
tests; an adjacent pure helper is permitted only if it materially simplifies
independent testing. No shared app or release-control changes. This approves
numeric-validity work, not the still-pending threshold/presentation decision.

### Independent contract review: additional required cases

The existing read-only reviewer identified dependency cases that the first
anchor set did not cover. Incorporate these before implementation acceptance:

- Missing peripheral cortisol preserves independently valid adrenal A/C and
  numerical LI, but leaves SI and peripheral-normalized outputs unavailable.
- Missing adrenal aldosterone does not erase that side's available cortisol SI.
  It does withhold that side's A/C and bilateral LI; keep the other side's
  independently computable outputs.
- Require met/not-met/unavailable criterion states. Unavailable is neither
  failure nor success, cannot trigger a diagnostic conflict, and must never
  enter JavaScript's `null < cutoff` coercion. Numerical asymmetry is distinct
  from clinically interpretable dominance.
- Validate conversion, aggregation, division and conversion back for display,
  not just raw inputs. Finite-input overflow/underflow gets an explicit
  computational-range reason, distinct from missing input.
- Verify actual parsed CSV cells beside valid and unavailable values, including
  both-protocol isolation, reciprocal ratios and compact comparison summaries.

Peripheral selection and multiple-row handling must be explicit before the
numeric runtime change. The UI must identify the selected reference site and
must not silently fall back from an invalid provided value. If both peripheral
sites are populated, require a deliberate common reference-site choice rather
than invent a mixed pair or change clinical site preference implicitly.
For multiple adrenal rows, distinguish entirely empty, time-only, partial and
complete measurement rows; retain row identity and indicate missing prerequisites
per analyte. Do not adopt a new aggregation policy merely to satisfy the one-row
tests. Complete the source-based aggregation plan before replacing that behavior.

The first implementation slice can safely address the single-pair numerical
dependency calculation and its tests in an adjacent pure helper; it is not a
finished repair until wired to the actual form/CSV and acceptance cases pass.
No new helper may be counted as a live fix or a completed calculator audit.

## State-repair completion evidence

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

## Material interpretation-policy decision — physician input requested

Owner read the complete main text of the
[Australian/New Zealand working-group consensus](https://pmc.ncbi.nlm.nih.gov/articles/PMC11612544/),
DOI10.1111/cen.15139 (online2024,2025 issue), including sections3.1–3.9 and
4.1–4.3; figures not visually inspected. Local public source:
`/tmp/radulator-avs-anz-2024.html`. This is expert consensus informed by a
literature review, not a high-certainty comparative threshold trial.

Section4.1 uses unstimulated SI≥2 and stimulated SI≥5. Section4.2 uses LI≥4
after bilateral selective cannulation regardless of ACTH, with contextual
assessment for LI2–4. Section3.8 separately discusses one-sided sampling and
inconsistent validation of AV/IVC thresholds; it does not authorize bilateral
lateralization from failed sampling. Section3.1 emphasizes sampling timing.

Independent source reviewer confirmed these material differences:

| Case | Source-specific consequence |
| --- | --- |
| Unstimulated LI3 | Naruse Table1 footnote's complementary >2 criterion is met; ANZ §4.2 standard ≥4 criterion is not. |
| Stimulated SI5 | ANZ §4.1 ≥5 is met; Endocrine2025 Table9 and preceding prose >5 is not. |
| LI4 | Endocrine2025 Table9 ≥4 includes it, but following prose >4 excludes it and treats3–4 contextually. |

The last difference is internal source ambiguity; it is not resolved by ACTH
status alone. Endocrine source locator:
https://academic.oup.com/jcem/article/110/9/2453/8196671 , Implementation
Strategies/Table9 and following paragraph. Reviewer independently checked these
locators; no whole-calculator validation was asserted.

Owner recommendation submitted to physician user: preserve useful numeric SI/LI
and display separately named source/year/exact-operator criterion results with
prerequisite and equality caveats, without selecting a single automatic
disease/treatment conclusion. User input is required before choosing an operative
institutional default or silently resolving the ambiguous equality. No threshold
or interpretation replacement is implemented. Numerical-validity repair and
other calculators remain in scope; this is not a blocker of the whole baseline.
