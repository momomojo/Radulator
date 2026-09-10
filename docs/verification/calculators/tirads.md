# ACR TI-RADS — baseline review and remaining tasks

Permanent ID: `tirads`; route `/#/tirads`. Owner: GPT-6 Astra. Review: 2026-09-07, source revision `2ce23862442e6f6e644533341d81fe1a9facf9ac`. Source-based AI review, not professional certification. Reuse [the earlier scoring review](../../evidence/tirads-source-review.md); do not rebuild the calculator or repeat completed work without a changed rule or evidence gap.

Revision reconciliation (2026-09-08): the starting revision above is publicly
resolvable and has the same tree as protected develop
`e3682c844e436c266ba49ae55132ef3b0d2927cd`. The assembled TI-2/TI-3 implementation
is published at [candidate 24fb84b](https://github.com/momomojo/Radulator/commit/24fb84b2ba3b2e8c74c496949b7d51fd3a913a90)
in [PR #267](https://github.com/momomojo/Radulator/pull/267). The older TI-2
revision below is retained local history, not an independently retrievable
GitHub release artifact. Review the published candidate for current code.

## Current state and required scope

The implementation supplies real feature-based classification, optional maximum diameter in cm, points, group-risk context and size-based recommendations. Additive foci, benign-composition handling, strict size validation and threshold neighborhoods were already repaired and tested. The owner re-read the actual implementation, focused tests, current official resources and relevant original-paper passages for this baseline.

Required scope: one adult thyroid nodule, with a clinician assigning ultrasound descriptors. Standard initial, unbiopsied-nodule guidance only; not image interpretation, cancer staging, longitudinal growth assessment, multi-nodule prioritization, pediatric management or individualized cancer probability. Prior biopsy, PET avidity, suspected invasive disease and patient-specific context require a separate clinical pathway. These limits must accompany copied results, not appear only above the form.

## Evidence and exact locators

| Source | Review and applicability |
|---|---|
| [ACR current TI-RADS resources](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/TI-RADS) | Accessed 2026-09-07; current-release links still point to the existing ACR framework. This establishes resource currency, not an invented 2026 scoring revision. |
| [Tessler et al., JACR 2017](https://www.professionalradiology.com/media/user/resources/ACR%20Thyroid%20Imaging%20TI-RADS%20White%20Paper%202017.pdf) | PDF pp. 2, 4–6 read; p. 3 Figure 1 rendered and visually checked. SHA-256 `e410ac250797efb81dbc62db13438a776eed7676e39e9f7838f000da03d18fe4`. Adult scope, additive scoring, ambiguous-feature defaults, composition and group-risk context, schedules and clinical exceptions. Paper's risk ranges are group-level estimates, not a calibrated individual prediction. |
| [ACR alternative assessment chart](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/TI-RADS/TI-RADS-Assessment-Categories-Alternative-chart.pdf) | Single-page classification/management chart and footnotes: benign categories explicitly require neither routine biopsy nor surveillance; additive features and unknown-composition/echogenicity handling corroborate the original paper. |
| [ACR ultrasound reporting template](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/TI-RADS/TI-RADS-Ultrasound-Reporting-Template.pdf) | PDF p. 1 descriptor picklists include cannot-determine choices; p. 2 recommendations. A single-nodule calculator is not a complete thyroid report. |
| [ACR FAQ](https://radssupport.acr.org/support/solutions/articles/11000071474-acr-ti-rads-faq) | Updated 2026-01-12, FAQ 111–116 read: PET-avid and previously sampled nodules need different clinical consideration; growth changes management through reassessed size/features. The FAQ's observed TR4 cohort rates differ from broad original group-risk ranges because they describe different estimates, not conflicting point rules. |
| [Middleton et al., AJR 2017](https://pubmed.ncbi.nlm.nih.gov/28402167/) | Metadata confirmed. Full validation methods and cohort limitations still need review before expanding claims beyond the original paper's stated group estimates. No abstract-only inference of unexposed performance details. |

## Gap plan before further implementation

1. **TI-2: report/scope completeness.** Add a concise result field describing the supported population and exceptions; it must survive copy/print. Explicitly report no routine TI-RADS follow-up for TR1/TR2. Preserve every score, risk value, threshold and current surveillance schedule. Update the obsolete ACR resources link to the current verified URL. No new management algorithm or staging advice.
2. **TI-3: descriptor usability.** Prescribe cannot-determine options and focused help from the official chart/template after evaluating the existing form. Unknown values supplied programmatically must still be rejected; an explicit supported indeterminate descriptor is different from an arbitrary unknown enum. Do not implement this task until the owner supplies the exact accepted values and independent cases.
3. **TI-4: acceptance evidence.** Retain unchanged additive-foci/threshold vectors; demonstrate a representative point/threshold mutation fails. Complete source-to-output/citation checks and assess prior-biopsy/PET/invasive-disease caveats. Exercise desktop/mobile, keyboard, reset/stale state, actual clipboard, print-layout contract and deep links. Shared privacy work must pass before final live acceptance.

## Independent expected cases and preservation checks

### TI-3 owner prescription — 2026-09-08

Re-fetched and visually inspected the complete official alternative chart, including
footnotes1–3. PDF SHA-256:
`9159e036c2aae37115e5404184a0a999bfc53e7a57f2f89e5d31eb258bf70012`.
The chart's first two footnotes resolve the previously pending input rules.

- Add explicit `cannot_determine` choices for composition (2 points, scored as
  solid) and echogenicity (1 point, scored as isoechoic). Preserve those selected
  descriptors in the report; do not imply that a solid/isoechoic appearance was
  actually observed. All other descriptors remain required as currently defined.
- Arbitrary enum strings, absent selections and malformed values remain errors,
  never aliases for this explicit choice. Composition uncertainty must not enter
  the cystic/spongiform shortcut or hide the remaining fields.
- Independent cases, with wider shape, smooth margin and no scored foci:
  both indeterminate →3/TR3; indeterminate composition plus hypoechoic →4/TR4;
  mixed plus indeterminate echogenicity →2/TR2. At1.2cm, adding punctate foci to
  both indeterminate gives6/TR4 with surveillance; adding macrocalcification too
  gives7/TR5 with biopsy recommendation.
- Allowed implementation scope: existing TI-RADS definition, focused computation
  and browser tests, this record and its registry link. Preserve TI-2 report work.
  Test explicit choices, invalid-enum rejection, report/copy disclosure and
  switching to/from the benign-composition shortcut. No new management algorithm.

This closes the TI-3 planning dependency, not implementation or final acceptance.

Existing `tests/tirads-compute.test.mjs` and `tests/fixtures/compute/tirads.json` cover all eight foci combinations, maximum 17 points and eighteen threshold neighborhoods. Owner-prescribed preservation pair: solid/isoechoic/wider/smooth/punctate at 1.2 cm is 6/TR4 with surveillance; adding macrocalcification produces 7/TR5 with biopsy recommendation. Mixed/isoechoic/no scored foci is 2/TR2; cystic or spongiform alone is 0/TR1. Both benign categories need explicit routine-surveillance disposition. Blank size allows category plus general thresholds; zero, negative, nonfinite and unit-suffixed values are rejected. Source-based cases must not be revised merely to match implementation.

## Completion record

- TI-3 implementation checkpoint2026-09-08: owner re-fetched the official
  alternative chart, verified the recorded9159e036 digest, read its full text
  and visually inspected the one-page diagram/footnotes. Assembled TI-2 from
  preserved8d7e9b7 onto current develope3682c8 before adding the prescribed
  explicit choices. The initial new test invocation lacked the JSX loader and
  was not behavioral evidence; with the canonical loader it failed because
  indeterminate composition returned no score. After implementation all12
  focused computation tests passed. The29-case Chromium suite passed, followed
  by separate1280px/390px cases verifying actual copied assumptions, keyboard
  calculation, no horizontal overflow and benign/indeterminate recovery.
  Owner viewed the390px full-page report screenshot. Read-only review found no
  introduced scoring defect and identified a Firefox clipboard-permission
  portability issue; the test now guards native clipboard assertions by
  browser while retaining rendered disclosure/recovery for all browsers.
  The two Chromium viewport tests passed again after that correction. Native
  printing and native mobile-browser operation are not claimed. At this initial
  checkpoint, integrated testing was pending; its later result is recorded below.
  Final signed release review and live acceptance remain pending.
  The Firefox attempt initially failed before application launch because its
  Playwright browser binary was absent. After installing that test dependency,
  both1280px/390px disclosure, keyboard and recovery cases passed in Firefox
  (2/2,retries0); native clipboard is intentionally asserted only in Chromium.
  The canonical313 fixture cases also passed. Registry linkage preserves the
  existing verification status and makes no whole-calculator acceptance claim.

- Earlier scoring repair and production evidence are reusable only for their exact unchanged scope; pointers are in the earlier source review and owner baseline execution record.
- TI-2 implementation at `8d7e9b77aaf469a873bed3cb89df1b1a99d37232` is locally accepted by the owner for the prescribed report-only scope after actual source/diff review and the independent review correction. Eleven focused computation tests and the scoped Chromium clipboard/print test passed on that revision; earlier TI-2 Chromium/WebKit checks are retained for unchanged behavior. It is not published. The owner verified the correction preserves copied group-risk qualifications and groups the exact approved scope text without changing points or thresholds. The full revision string was corrected on 2026-09-07 by reading the worktree's Git HEAD; the earlier matching-prefix transcription did not identify an existing commit. This record correction does not change code or acceptance scope.
- A later default-port rerun failed because its captured network trace loaded another concurrent worktree's old TI-RADS asset. That run was rejected as target-mismatched evidence. After rebuilding this exact candidate, a dedicated strict-port4190 preview rerun passed the scoped real-clipboard/print-button test (1/1); the pure computation rerun passed11/11. This proves button invocation, not native printing. Operator evidence: `tirads-isolated.config.mjs`, `tirads-isolated-results.json` under the owner's ignored `2026-09-07-verified-baseline` evidence directory. Parallel task instructions now require distinct strict ports and exact server cwd.
- TI-2/TI-3 implementation is complete on candidate `24fb84b2ba3b2e8c74c496949b7d51fd3a913a90`.
  Its integrated local Playwright run passed 1568, with zero failures, skips or
  flaky cases (4 workers, retries 0; started 2026-09-08T16:26:04.894Z,
  296872 ms; terminal handle 57172). The JSON went to stdout, so no retained
  local full-report file is claimed. Exact-head required CI also passed in
  [run 34251942031](https://github.com/momomojo/Radulator/actions/runs/34251942031).
  This documentation reconciliation does not change runtime or expected answers;
  the new PR head still requires its own CI and applicable signed authority.
- This renewed clinical review remains partial. TI-4's remaining source-to-output,
  mutation, report/privacy and final acceptance evidence, protected production
  release and artifact-bound live QA remain open. TI-3 is not an outstanding
  implementation task.
- Clinical, browser/report, privacy and final live-baseline acceptance remain pending. No promotion from `seed-unverified` is authorized by writing this plan.
