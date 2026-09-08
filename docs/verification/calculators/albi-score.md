# ALBI Score — clinical review and implementation plan

Calculator ID: `albi-score`; permanent route: `/#/albi-score`.

Owner: GPT-6 Astra. Source-based AI review started 2026-09-07; this is not professional certification. Reviewed starting source: `2ce23862442e6f6e644533341d81fe1a9facf9ac` (the task base `e3682c844e436c266ba49ae55132ef3b0d2927cd` has the same tree). No full-baseline acceptance is claimed by this partial review.

## Current state → required state

The existing tool computes the original Johnson 2015 ALBI linear predictor and three grades from albumin and total bilirubin, accepting SI or US units. It returns the score, grade, cohort-level interpretation, and calculation units. It explicitly does not decide treatment eligibility or predict an individual's survival. Preserve this useful, bounded scope; do not implement a TACE nomogram or a newer ALBI variant under the same label.

The prior pure-core extraction in `src/clinical/albi.js` preserved behavior; see `docs/development/albi-module-pilot.md`. It did not establish that every input restriction, citation, or interface behavior was appropriate. Existing canonical cases and live evidence are reusable only for their actual covered rules.

Demonstrated on the live route on 2026-09-07:

- SI albumin 40 g/L, bilirubin 10 µmol/L produced −2.740 / Grade 1.
- Changing albumin to 30 cleared the old result before recalculation, then produced −1.890 / Grade 2.
- The desktop form and result were inspected. This observation does not establish mobile, clipboard, native printing, all exclusions, or full decision-boundary coverage.

Confirmed defect: the fifth reference combines an ALBI nomogram title with an unrelated endoscopic-biopsy study's DOI and incorrect authors/journal/date/pages. Correct the bibliographic identity without altering the formula or implying that the nomogram is implemented.

Additional gaps requiring separate decisions/tests:

- The pure function accepts numeric-prefix strings such as `"40mg"` through `parseFloat`; an unknown unit value silently behaves as SI. Browser number inputs constrain some malformed inputs but do not establish a sound callable input contract.
- Albumin 5–60 g/L and bilirubin 1–1000 µmol/L are hard application guards, described as physiological limits. The reviewed original formula paragraph does not establish these as the model's validated eligibility limits. Review their clinical justification and distinguish unit-error checks from model applicability before changing them.
- Neither unit radio is visibly selected initially although calculation defaults to SI. Review the shared form initialization before prescribing a fix.
- Complete all remaining source/interpretation, boundary, unit-conversion, invalid-input, report, accessibility, privacy, and release checks below before accepting the entire calculator.

## Evidence and scope

| Source | Exact reviewed locator | Supports / does not support |
|---|---|---|
| [Johnson et al., JCO 2015;33:550–558](https://pmc.ncbi.nlm.nih.gov/articles/PMC4322258/), DOI `10.1200/JCO.2014.57.9151` | Results: equation immediately before Table 2 and grade cutoffs after Table 2; Results and Discussion read from public full text | Original equation, cutoff convention, HCC derivation/validation context and cohort-level prognosis. Not an individualized treatment-selection rule or survival calculator. |
| [Ho et al., PLOS ONE 2017;12:e0180408](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0180408) | Publisher citation metadata and abstract | Supporting ALBI-related HCC/TACE prognostic research. Does not establish treatment eligibility from this two-input tool alone. |
| [Ho, Hsu, Liu et al., Digestive Diseases and Sciences 2021;66:1730–1738](https://link.springer.com/article/10.1007/s10620-020-06384-2) | Publisher title, author list, publication metadata and abstract; online publication 2020-06-16, issue year 2021 | The intended fifth reference. This is a multivariable nomogram incorporating more than ALBI; it is not the calculation implemented here. Full subscription article was not accessed and is not used to implement any additional rule. |
| [Author-institution bibliographic record](https://scholar.nycu.edu.tw/en/publications/albuminbilirubin-albi-grade-based-nomogram-for-patients-with-hepa/) | Citation / DOI / issue metadata | Independently corroborates corrected first authors Ho SY, Hsu CY, Liu PH; DOI `10.1007/s10620-020-06384-2`; journal/volume/issue/pages/year. |
| [Crossref publisher-deposited record for the incorrect DOI](https://api.crossref.org/works/10.1016/j.dld.2018.01.128) | DOI, title, authors, journal, volume, issue and pages | The current DOI actually identifies Attili et al., a histology-needle/EUS biopsy study in Digestive and Liver Disease 2018;50(5):469–474. It cannot substantiate the ALBI citation. |

The original public full-text HTML was retrieved directly on 2026-09-07: 276155 bytes, raw SHA-256 `3717205d8812b6d5ea213f074bb801f7574b6f14c6990f4e5f1219f03e425410`. Raw HTML contains volatile site fields; do not compare this raw digest to the existing audit script's normalized digest. Existing source audits preserve their own normalization contract.

Additional owner source review on 2026-09-07:

- [AMA Manual of Style, Table 2](https://academic.oup.com/amamanualofstyle/si-conversion-calculator), serum albumin and total bilirubin rows: g/dL→g/L factor 10 and mg/dL→µmol/L factor 17.104. This independently supports the existing conversions; retain full precision for computation and round only displayed values.
- [EASL HCC guideline 2025](https://easlcampus.eu/sites/default/files/2025-02/EASL_CPG_Management_HCC.pdf), printed pp.333–335, preoperative assessment recommendation and Table4 ALBI row: ALBI remains a laboratory-based prognostic component, alongside other aspects of assessment. It is not a standalone treatment-eligibility decision. No change from the original equation is prescribed.
- [Pinato author manuscript, Cambridge repository](https://www.repository.cam.ac.uk/bitstreams/57b9d9f0-4841-4458-ad3c-9554a0e2becb/download), manuscript pp.7–19, Patients and Methods, Results and Discussion: independently recruited retrospective HCC cohorts, excluding transplantation as primary therapy, support prognostic stratification across studied treatments/stages. Discrimination differs by cohort; not every adjacent grade comparison was significant. Do not transplant its cohort survival times into individual output. Retrieved PDF SHA-256 `0ac2d3b3e2ab25e9da03bb247296b6f873134e03254c9b51f41d73e42450aaac`. Its shorthand “less than −2.60” refers back to the original model; keep the original Johnson source's explicit inclusive grade-1 cutoff, not a new alternative rule.
- [Hiraoka author-institution record](https://keio.elsevierpure.com/en/publications/usefulness-of-albumin-bilirubin-grade-for-evaluation-of-prognosis/), abstract and citation: confirms bibliographic identity and retrospective Japanese HCC population. The publisher denied full-text retrieval, and the Europe PMC record lists subscription access only. This remains supporting bibliography only; ALBI-T staging and its survival estimates are not implemented or inferred from the abstract.

An abstract does not establish inaccessible methodological details. The original equation/grades, original validation scope, current guidance and unit conversion now have directly reviewed accessible support. Additional bibliography is not used to invent rules. Input-domain policy and complete interface acceptance remain open; no genuine material research–guideline conflict has been established.

## Independently derived expected results

Owner derivation uses the paper's equation, not the implementation: `0.66 × log10(bilirubin in µmol/L) − 0.085 × albumin in g/L`. With bilirubin 10, the first term is 0.66, so the first three cases can be evaluated directly.

| Case | Inputs / condition | Expected result and reason |
|---|---|---|
| ALBI-ORIGINAL-01 | Albumin 40 g/L; bilirubin 10 µmol/L | `0.66 − 3.4 = −2.74`, Grade 1; display −2.740 |
| ALBI-ORIGINAL-02 | Albumin 30 g/L; bilirubin 10 µmol/L | `0.66 − 2.55 = −1.89`, Grade 2; display −1.890 |
| ALBI-ORIGINAL-03 | Albumin 20 g/L; bilirubin 10 µmol/L | `0.66 − 1.70 = −1.04`, Grade 3; display −1.040 |
| ALBI-BOUNDARY-1 | Exact linear predictor −2.60 | Grade 1; just above enters Grade 2. Classify the unrounded predictor, not its display string. |
| ALBI-BOUNDARY-2 | Exact linear predictor −1.39 | Grade 2; just above enters Grade 3. Classify the unrounded predictor. |
| ALBI-REF-05 | Fifth ALBI reference | Ho SY, Hsu CY, Liu PH, et al.; Digestive Diseases and Sciences, 2021;66(5):1730–1738; DOI `10.1007/s10620-020-06384-2`. Label as supporting multivariable TACE nomogram research, not this calculator's model. |

The boundary rows prescribe the clinical rule. Implementation tasks must derive representable input neighborhoods carefully instead of asserting that floating-point inversion creates an exact decimal score. Unit conversion, guard-edge and malformed-input expected cases remain pending their specific up-front review.

## Approved small tasks

### ALBI-1 — repair the fifth reference only

Ready for GPT-5.6 Luna xhigh after assignment by owner. Allowed files: `src/components/calculators/ALBIScore.jsx`, a focused reference regression in `tests/albi-compute.test.mjs` or a dedicated `tests/albi-references-compute.test.mjs`, and this document's implementation-results subsection. No formula, thresholds, other references, registry status, expected numerical fixture, shared UI, pipeline, or publication changes.

1. Add a failing regression that reads the actual exported calculator definition through the existing test loader and checks the fifth reference's prescribed bibliographic identity/link. Do not merely test a separately duplicated reference constant.
2. Correct first-author order, journal, issue year, volume/issue/pages and DOI. Keep the original paper as the primary formula reference. Add a short independently worded note in the fifth reference that this is supporting multivariable nomogram research, not a model implemented here.
3. Preserve all calculation behavior. Run ALBI focused tests and the prescribed canonical local gate. Demonstrate that reverting the reference makes the new test fail. Do not change expected clinical answers to obtain green tests.
4. Owner independently reviews the source binding and actual diff, then runs browser link/result checks on the final candidate. Signed release review and CI remain separate. This narrow correction is a candidate clinical canary for the simplified release path; do not activate or publish the migration yourself.

## ALBI-1 implementation results

- Corrected only the fifth exported reference in `src/components/calculators/ALBIScore.jsx`: Ho SY, Hsu CY, Liu PH, et al., *Digestive Diseases and Sciences* 2021;66(5):1730–1738, DOI `10.1007/s10620-020-06384-2`.
- Added an independently worded note that this is supporting multivariable TACE nomogram research and that the original two-input ALBI model implemented here does not implement that nomogram.
- Added a regression in `tests/albi-compute.test.mjs` that reads `ALBIScore.refs[4]` from the actual exported definition and checks the complete bibliographic identity, DOI, and scope note.
- TDD evidence: the new regression failed against the prior 2018 Digestive and Liver Disease citation (4/5 focused tests passed); after the citation-only correction it passed (5/5). Temporarily restoring the old citation reproduced the intended failure, then the corrected citation was restored.
- No formula, grade boundary, expected numerical vector, other reference, registry/status, shared UI, pipeline, or release state changed. This is a narrow bibliography correction, not full ALBI clinical acceptance or release proof.

### ALBI-2 — strict input and explicit unit contract

Owner prescription, initially dispatched to Luna and transferred back to direct Astra implementation on 2026-09-07 at the user's request. Preserve the uncommitted draft; it is not accepted or released. Do not change the formula, conversion constants, grade cutoffs, display precision or input-range policy in this task.

- Both the pure core and exported adapter accept finite positive numbers or entire decimal numeric strings only (trimmed surrounding whitespace is allowed); reject numeric prefixes such as `"40mg"`, empty/whitespace-only strings, booleans, arrays, objects, `NaN`, infinities, hexadecimal strings and overflow. Decimal scientific notation may be accepted if the entire string is numeric. Never call user-provided coercion methods.
- Pure-core calls that omit `unit_system` may retain the documented SI default for compatibility. An explicitly supplied unknown/null/empty unit must fail with a structured `INVALID_UNITS` error rather than fall back to SI.
- The browser-facing adapter must require an explicit SI/US selection: no selected radio must not silently mean SI. Use the existing field's `required` support and an explicit compute error; do not add a shared default-state mechanism. Unit choices stay visible; switching units changes interpretation of entered numbers, not the numbers themselves, and must clear results. Make this behavior clear in the existing unit help text.
- Prescribe regression cases for both valid unit systems, unsupported units, omitted browser selection, and each malformed input class. Independent US anchor: albumin4g/dL and bilirubin1mg/dL convert to40g/L and17.104µmol/L, giving approximately−2.586156/Grade2. The earlier SI40/10 case remains−2.740/Grade1. Test actual copy content including the chosen units and the no-treatment-eligibility context.
- Existing guards remain temporarily 5–60g/L and1–1000µmol/L, inclusive, but describe them accurately as application entry limits pending applicability review, not physiological or validated model limits. The range disposition below is not resolved by this wording correction.
- Allowed files when dispatched: `src/clinical/albi.js`, `src/components/calculators/ALBIScore.jsx`, `tests/albi-compute.test.mjs`, existing ALBI browser tests and this plan. Fixture edits require an explicit owner list if compatibility tests reveal missing unit selections; numerical expected answers are not authorized to change.

Required verification: failing regressions before implementation, focused core/adapter/browser cases, representative parser or unit-fallback mutation detected, lint/invariants/build. No full-calculator clinical acceptance or publication is delegated.

Draft checkpoint: Luna reported npm ci/build/lint, 9/9 focused core/adapter tests and a clean diff check, but stopped before isolated browser runs, mutation evidence or commit. Astra read the four-file draft on 2026-09-07; arithmetic, constants and cutoffs are unchanged. Remaining owner work includes actual browser/unit-switch and copy behavior, checking any inherited conditional/vacuous browser assertions within the promised scope, renaming the stale test description claiming parseFloat behavior, and completing mutation/candidate/release evidence. These observations are not fresh rerun results or final acceptance. Y90's urgent release takes precedence; no additional implementation agent is assigned.

Owner completion of the bounded draft, 2026-09-07:

- Read the actual core, exported adapter and changed tests against the up-front prescription. Renamed the misleading parseFloat test description and asserted that unit switching leaves entered numbers unchanged while clearing the result.
- Initial isolated browser run:30 passed,2 failed because negative-value and entry-limit tests never selected units. Added explicit SI selections so these tests exercise their intended validation rather than the missing-unit error; did not change clinical expected answers. Final dedicated strict4193 production-preview run:32 passed,0 skipped/unexpected/flaky, receipt `albi-isolated-results.json` in the existing baseline evidence directory. This is scoped functionality evidence, not a complete accessibility/citation audit based on a spec count; inherited conditional assertions remain subject to ALBI-3.
- Temporarily restored loose numeric-prefix parsing: the core and adapter malformed-input regressions both failed on `40mg` (7 passed,2 failed). Restored the exact original draft core blob `002c635ff23b656496b88c85beb83e0c512d2540`; all9 focused tests then passed. This is an observed representative mutation check, not a claim to have witnessed the draft's initial TDD sequence.
- Root lint/invariants/diff checks passed after restoration. The isolated browser exercised the existing candidate production build (`ALBIScore-CXaXi1nP.js`); npm ci/build were previously run by the implementer against unchanged runtime/dependencies. Adapter source blob `7d7925ba4fc17b502b7eae08623e7031d149e329`. Chromium native clipboard included input units and the no-treatment-eligibility context; print evidence is invocation/CSS only.
- No publication, signed approval, full ALBI clinical acceptance or entry-domain resolution is claimed. The final release candidate must incorporate the current protected main and shared privacy/print fixes and retain independent release review. No further Luna implementation is assigned.

### ALBI-3 and later — complete the remaining supported-scope audit

Not delegated yet. Owner must resolve the application range policy rather than silently count a restricted tool as fully audited. Required final coverage includes both grade-changing boundaries and rounding neighborhoods, equivalent SI/US values, missing/nonfinite/malformed input and units, documented guards and exclusions, unit switching, stale-result/reset behavior, keyboard and mobile operation, copy content, print layout, references, privacy and exact live revision. At least one representative formula/cutoff mutation must be detected by the independent cases.

Owner evidence follow-up, 2026-09-08, while the adrenal release candidate was testing: re-read the retained original PMC article's Table1, cohort eligibility paragraphs and Table2 equation. The cached article's SHA-256 still matches `3717205d8812b6d5ea213f074bb801f7574b6f14c6990f4e5f1219f03e425410`. Live PMC retrieval returned a browser challenge and Europe PMC retrieval timed out; no bypass or claim of fresh full-text retrieval. Table1 provides medians and interquartile ranges, not laboratory eligibility endpoints: the Japanese cohort's albumin IQR is31–39g/L and bilirubin IQR10.3–22.2µmol/L. These descriptive ranges cannot justify either hard application guards or new extrapolation cutoffs. The European and US cohort descriptions explicitly exclude transplantation; applicability must not be generalized to transplant-outcome prediction. The original formula has no software caps in its equation. This narrows ALBI-3's unresolved task to a deliberate input-error/applicability policy; do not infer a validated domain from observed quartiles, and do not silently remove the current guards without specifying the resulting out-of-range report behavior and tests first. No ALBI runtime or expected answer changed in this follow-up.

## Completion record

### ALBI-3 owner prescription — input range and report behavior (2026-09-08)

Fresh public PMC retrieval now succeeds. Re-read Patients and Methods, Table1, Results equation/Table2 and Discussion. The source specifies the continuous equation and grade boundaries, not the application's 5–60/1–1000 entry caps. This does not establish validated performance at arbitrary extreme measurements. The following is an explicit application-design decision, not a newly discovered guideline threshold.

- Retain strict decimal parsing and explicit browser units. Require positive finite laboratory values, finite positive converted SI values and a finite score. Reject conversion overflow/underflow before classification; never silently clamp measurements or classify an undefined score.
- Replace the old hard caps with a visible input-check warning outside their existing inclusive intervals. Call these **application review thresholds**, not physiological or validated model boundaries. The warning must identify the entered/converted values, request verification against the laboratory report and units, and say that numerical computability does not establish clinical applicability. Preserve the score and source-defined numerical grade after valid arithmetic; do not invent an individualized prognosis at extremes. Warning accompanies copy/print and takes precedence over a green grade-1 status treatment.
- Keep the studied HCC/chronic-liver-disease context and no-treatment/no-individual-survival limitation. Display an always-present concise applicability statement, including that this is not a post-transplant outcome predictor. Remove the misleading entry-limit labels; retain clear units.
- Independent equation anchors, not validation examples: SI40/0.5 → −3.598679797138228, Grade1;65/10 → −4.865, Grade1;4/10 →0.32, Grade3;40/1001 → −1.4197135088636499, Grade2. Each requires the input-check warning. Test old-limit endpoints and their immediate neighborhoods, equivalent US inputs, warning-free→warning→invalid→corrected transitions, actual copied warning text, mobile/keyboard and print layout. Tests must independently assert the unrounded grade and preserve the existing original-source anchors.
- Allowed changes when ALBI becomes the active implementation: existing pure core, adapter, ALBI computation/browser tests and this record. No shared architecture, new medical variant or new eligibility algorithm. This prescription replaces the temporary ALBI-2 cap policy; implementation, independent review and release remain pending. Do not count this planning decision as completed ALBI acceptance.

### ALBI-3 implementation checkpoint — 2026-09-08

Root resumed direct implementation in the existing clean isolated worktree at
`d11f9da` while Wells and AVS candidates remained frozen for external release
checks. This draft is not based on current production and must not be published
wholesale. Assemble only accepted ALBI changes onto the actual release base.

- Reopened the original PMC source by ordinary HTTPS. The web reader received
  a browser challenge; direct HTTPS returned the article's cohort, equation,
  cutoff and transplant-exclusion passages. No access control was bypassed.
- New core/adapter regressions initially yielded 10 pass / 2 fail, specifically
  because outside-threshold values were rejected and warning state was absent.
  After implementation all 12 pass, preserving canonical values/raw grading.
- Replaced hard caps with explicit application-review warnings, retained
  positive/finite input and conversion validation, and added an always-present
  applicability statement. Warning precedes score in the report and prevents
  a green grade-1 severity; original equation/conversions/cutoffs are unchanged.
- `npm ci`, build, lint, invariants and diff checks passed. Install still reports
  inherited dependency advisories; this is not a vulnerability-free claim.
- Isolated Chromium production-preview run on port4197: 33 pass, 0 fail/skip/
  flaky, retries0, started15:51:16.765Z, duration13355.611ms. Receipt:
  `test-results/albi3-results.json` in this worktree. New observable coverage
  includes warning-free→warning→invalid→corrected state, actual clipboard text,
  390px keyboard calculation, overflow check and warning visibility in print
  media. Native printing is not tested. Inherited conditional tests are not
  evidence of complete visual/accessibility acceptance.
- Remaining: hostile/independent review, representative rule mutation,
  remaining source/report/privacy/visual acceptance, final-base assembly,
  integrated suite, signed release review and artifact-bound live QA.

Owner visual follow-up: the first 33-pass browser run did not assert per-field
colors. Actual 390px screenshot `/tmp/radulator-albi3-mobile.png` showed green
Grade1/context badges despite the leading orange warning. A new browser
assertion reproduced this failure (success CSS where warning was required).
Authorize the narrow correctness-related shared fix in
`src/components/display/ResultDisplay.jsx`: only for `albi-score` with a nonempty
Input Check, use its explicit warning/danger severity for the ALBI Grade and
Clinical Context fields. Preserve other calculators and normal ALBI styling.
This is not a global severity redesign or a change to clinical grading.

The representative cutoff mutation `<= -2.6` to `< -2.6` failed two existing
independent tests; restoring the cutoff returned all12 to passing. The
independent reviewer found no bounded arithmetic defect, but its initial claim
about rendered colors was contradicted by this screenshot and corrected by
root. Pending shared-fix review remains separate from signed release review.

Shared-fix verification: rebuilt successfully, lint/invariants passed, and the
full dedicated ALBI Chromium suite passed33 with0 failures/skips/flaky after
adding the warning-style assertions. Final local receipt start15:55:05.579Z,
duration12591.638ms in `test-results/albi3-results.json`. The earlier screenshot
documents the defect, not the corrected visual state. No whole-site suite or
final-base release validation is claimed at this draft stage.

Candidate assembly: only the six ALBI subject files from175213c were transferred
onto actual protected develop e3682c844e436c266ba49ae55132ef3b0d2927cd on branch
`codex/albi-supported-baseline-2026-09-08`; the prior branch remains intact.
The registry now links this record without promoting its legacy verified scope.
The subject-file bytes match the reviewed draft; unrelated draft history was
not imported. Fresh canonical local checks and12 computation tests passed on
this assembly. Full integrated testing and protected release remain outstanding.
The single-main migration is not active; this normal correction targets develop.

Assembled-candidate local validation: integrated handle88669 ended exit0 with
1568 passed,1 skipped,0 failures (1569 discovered;4workers,retries0,preview4197).
The skipped generated-page check hardcodes port4173; setting CI alone did not
remove that skip. It was then run unchanged with canonical CI preview4173:
handle51468 exit0,1 passed,0 skipped. These are separate runs, not a claim of
1569 passes in one run. The later focused run overwrote the temporary custom
JSON report; the integrated terminal summary remains the evidence for its
aggregate count. Canonical focused receipt is `test-results/results.json`.
Required exact-head remote CI will retain the final candidate's complete report.
Full computation suite passed:313 canonical cases plus KBRC and supplementary
tests. No runtime/test/build changes followed the integrated run. Final clinical
release and live acceptance remain outstanding.

### PR #265 review correction — 2026-09-08

Review reproduced a presentation defect: US albumin6.01g/dL appeared as
60.099999999999994g/L inside the input-check warning. Only the warning's SI
display is now rounded to one decimal, matching the existing converted-value
rows; entered measurements, full-precision conversion, score and grade are
unchanged. The clinician/QA guide now matches the approved explicit-unit and
application-warning contract instead of claiming a default selection or hard
physiological exclusions.

The new adapter regression failed on the unformatted warning, then all13
computation tests passed. The new US6.01/1.01 case independently expects
60.1g/L and17.3µmol/L in the displayed warning, with score−4.292/Grade1 and
unrounded converted bilirubin17.27504µmol/L. Fresh build, lint and invariants
passed; the invariant warning correctly requests clinical source/review evidence.
The dedicated Chromium suite passed34, zero failed/skipped/flaky, workers2,
retries0 on the freshly built worktree preview. It checks the actual clipboard
and print-media warning presentation, not native printing. The full browser
report is `test-results/results.json`; the earlier integrated results above
apply to their historical candidate only. The changed PR head requires fresh
required CI, independent signed review and protected deployment/live evidence.
No full-calculator acceptance is asserted by this presentation correction.

Fresh independent visual review of the same built adapter
(`ALBIScore-D7MjKQ7n.js`) passed at1440px and390px: keyboard calculation,
warning formatting, amber warning styling, stale-result clearing, invalid-input
recovery and no horizontal overflow. Root also viewed the390px screenshot.
Retained proofs: `test-results/albi-final-review.json`,
`test-results/albi-final-review-1440.png` and
`test-results/albi-final-review-390.png`. No page exceptions or failed requests
were observed. The pre-existing CSP diagnostic that `frame-ancestors` is ignored
in a meta tag remains; this is not a zero-console-diagnostics claim.

- Clinical planning: partial source-based review recorded above; full supported-scope review pending.
- ALBI-1 implementation/focused regression: committed in `b0a13e65f57f423bb3ec4e05535816d58cdfa616`; 5/5 focused tests passed, with the reverted-reference mutation correctly failing.
- Independent ALBI-1 source/code review: accepted on 2026-09-07 by a separate GPT-6 Astra reviewer after checking the publisher and author-institution records. Root source/clinical planning is recorded above. This acceptance covers the citation repair only; final candidate browser/release checks and full-calculator acceptance remain pending.
- Complete calculation, interface/report and privacy acceptance: pending; prior bounded evidence is not an exemption.
- Release: existing live revision recorded above; no new correction is deployed by this document.
- Restriction: no patient-specific treatment eligibility or survival prediction; no TACE nomogram implementation. Remaining gaps must be resolved or explicitly presented to the user before full-baseline completion.
