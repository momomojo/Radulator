# ALBI Score — canonical clinical and completion record

**This is the sole active ALBI record.** Calculator `albi-score`, route
`/#/albi-score`, original Johnson 2015 model. Owner: GPT-6 Astra.
Updated 2026-09-08. Source-based AI review, not professional certification.

Candidate provenance: [PR #265](https://github.com/momomojo/Radulator/pull/265),
branch `codex/albi-supported-baseline-2026-09-08`, worktree
`Radulator-source/.worktrees/albi-input-contract`. Do not resume any historical
ALBI branch or create another plan. Earlier full narrative is retained at
[49611cd](https://github.com/momomojo/Radulator/blob/49611cd51dd38e84c3463e1045086644d59d2cc9/docs/verification/calculators/albi-score.md).

## Acceptance and authoritative release state

The [release receipt](https://github.com/momomojo/Radulator/pull/265#issuecomment-5591825061)
is the sole post-commit release-state record. It records the exact reviewed PR
head, protected merges, deployment and live acceptance. Read its current status:
an absent or incomplete receipt means **not released**. This avoids a second
code release merely to stamp the preceding release's SHA into this file.

| Phase | Disposition |
|---|---|
| Provenance reconciliation | Complete: no missing runtime implementation or unique committed test identified across ALBI refs/worktrees and PRs listed below |
| Owner clinical review | Complete for the supported original-model scope below; sources and rules reviewed separately from tests |
| Implementation | Strict inputs/units, applicability warnings, citation repair and warning styling incorporated; final reset/precision corrections added with failing regressions |
| Computation | 14 focused tests pass after final precision changes; original six fixture vectors retained |
| Browser/report acceptance | 38 Chromium tests pass; independent desktop/mobile interaction and visual review pass; corrected three-page Chromium PDF inspected in full |
| Independent final review | Separate Astra read-only code/report review accepts the final runtime scope, including the subsequent print-only fix; this does not replace signed release reviews |
| Protected release and live acceptance | Determined only by the linked release receipt, including exact-head CI, independent signatures, source/deployment identity, live ALBI and production-combined privacy QA |
| Worktree retirement | Incorporated module checkout removed cleanly; local/origin historical refs retained. Candidate checkout is retained through release; its eventual retirement is recorded in the release receipt |

Only incomplete acceptance in this record or its linked release receipt is an
active task. A complete receipt closes this original-model baseline; historical
branches do not reopen it. Do not treat historical
limitations of prior drafts as new assignments. No new calculator, mALBI,
nomogram, broker, harness rewrite or pipeline migration belongs to this scope.

## Supported clinical task

For clinicians assessing original ALBI liver-function prognosis in studied HCC
and chronic-liver-disease settings: enter serum albumin and total bilirubin
with explicit SI or US units. Return the continuous score, source-defined
grade, relative group interpretation, units, applicability, precision note
and any input-review warning. No tumour staging, individual survival estimate,
treatment eligibility, post-transplant prediction or treatment-specific nomogram.

| Rule/output | Reviewed requirement and independent expected cases |
|---|---|
| Equation | `0.66 × log10(bilirubin µmol/L) − 0.085 × albumin g/L`. SI40/10 → −2.740/G1;30/10 → −1.890/G2;20/10 → −1.040/G3 |
| Grade boundaries | Raw score ≤−2.60 → G1; >−2.60 to ≤−1.39 → G2; >−1.39 → G3. Inclusive endpoints and neighborhoods are independently tested |
| Conversions | Albumin g/dL ×10; bilirubin mg/dL ×17.104. US4/1 → SI40/17.104 → −2.586156…/G2. No intermediate rounding |
| Precision | Three-decimal score does not determine grade: −2.5999 displays−2.600/G2;−1.3899 displays−1.390/G3. Report explains unrounded grading |
| Laboratory display | Normally one decimal; positive values that would round to zero use three significant digits. SI40/0.01 → −4.720/G1; bilirubin displayed0.0100, not0.0 |
| Valid input | Positive finite numbers or entire decimal strings; reject prefixes, blanks, booleans, arrays/objects, nonfinite values, conversion overflow and underflow to zero. Never coerce caller objects |
| Units/state | Browser must select SI/US. Pure core retains omitted-unit SI compatibility only. Invalid explicit units fail. Editing units/values clears results; unit switching does not alter entered numbers; Reset clears the form |
| Review warnings | SI albumin outside5–60 or bilirubin outside1–1000 triggers an input check, inclusive endpoints. Software review thresholds, not physiological/validated model boundaries. Keep valid numerical score/grade with warning and laboratory/unit check |
| Warning anchors | SI40/0.5 → −3.598679797…/G1;65/10 → −4.865/G1;4/10 →0.32/G3;40/1001 →−1.419713509…/G2. Mathematical examples, not extreme-domain validation |
| Reports | Input check precedes results, accompanies copy/print, and overrides green G1 styling. Applicability excludes individual treatment/survival inference. No grade/report action for invalid calculations |

The range policy is an explicit application-design decision. Original-source
cohort quartiles are descriptive, not validated input endpoints. The positive
finite arithmetic domain does not establish clinical validity at every extreme.
The limitations above define this tool's intended scope; they are not withheld
features promised by the original ALBI calculator.

## Source-to-claim review

| Source and exact locator | Scope accepted |
|---|---|
| [Johnson et al., JCO2015;33:550–558](https://pmc.ncbi.nlm.nih.gov/articles/PMC4322258/), DOI10.1200/JCO.2014.57.9151. Abstract Methods; Methods/cohorts; Results equation immediately before Table2 and intervals immediately after; Discussion | Original two-input model, units, grade boundaries, derivation1313 Japanese HCC patients, additional geographic/treatment cohorts and chronic-liver-disease cohort; transplant exclusion and population-level interpretation |
| [AMA Manual of Style, Table2](https://academic.oup.com/amamanualofstyle/si-conversion-calculator), serum albumin and total bilirubin rows | Conversion factors10 and17.104; independently checked2026-09-08 |
| [EASL HCC2025](https://easlcampus.eu/sites/default/files/2025-02/EASL_CPG_Management_HCC.pdf), printed p.335/Table4, pp.349–350 treatment-selection discussion/recommendation | ALBI as one component of broader assessment; prognosis is not evidence for choosing embolic versus systemic treatment. No new algorithm imported |
| [Ho et al., PLOS ONE2017](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0180408), citation/abstract | Supporting HCC/TACE prognostic bibliography; no additional calculation |
| [Hiraoka et al., JGH2016](https://doi.org/10.1111/jgh.13250), author-institution citation/abstract | Supporting retrospective Japanese HCC bibliography. Inaccessible full methods not used for ALBI-T or new output |
| [Pinato et al., J Hepatol2017](https://doi.org/10.1016/j.jhep.2016.09.008), [Cambridge manuscript](https://www.repository.cam.ac.uk/bitstreams/57b9d9f0-4841-4458-ad3c-9554a0e2becb/download) pp.7–19 | Additional cohort-level prognosis, variable discrimination across cohorts, transplant exclusion; no individual survival numbers imported |
| [Ho, Hsu, Liu et al., DDS2021;66:1730–1738](https://doi.org/10.1007/s10620-020-06384-2), publisher/author-institution citation and abstract | Correct fifth-reference identity. Multivariable TACE nomogram explicitly not implemented; full subscription methods not required for the retained original-model scope |

Fresh official NCBI metadata2026-09-08: PMID25512453, matching DOI/PMCID.
Returned relationship is `CommentIn` PMID25512460 (editorial), not a correction
or retraction. This is the returned relationship scope, not a universal
unretracted-status claim. Packet:
`.git/radulator-research-cache/pubmed-25512453-1788900146009769000.json`;
metadata XML SHA256 `3d370d042067ba8abdfd6dcb494e38f82f1a64f3a34f271b7ea166c5587f9685`.
PMC E-utilities returned metadata without full text; the web reader received a
browser challenge. Ordinary direct public HTTPS succeeded, and owner read the
cohort/equation/cutoff/Discussion passages. No bypass was used.

Fresh exact-source audit passed:276155 raw bytes;276075 canonical bytes;
SHA256 `fccc2f40b9ae8a85fcd7dbc093886be078a554db8f425322db6cffc3bd2499b0`.
Only volatile PMC request fields are normalized. Audit binds the equation,
boundaries/population and six executable vectors. A matching hash alone is not
clinical review. Raw copyrighted source files are not committed.

## Verification evidence and limits

- `tests/fixtures/compute/albi-score.json`: six protected source-bound vectors.
- `tests/albi-compute.test.mjs`: raw boundaries/rounding, SI/US equivalence,
  strict parser/units, warning boundaries/anchors, nonrepresentable arithmetic,
  citation identity, warning display and small positive display.
- Prior observed parser mutation accepted `40mg`: two tests failed. Cutoff
  `<= -2.6` → `< -2.6`: two tests failed. Restored source passed.
- Final precision tests reproduced two failures (12pass/2fail); minimal adapter
  formatting/note changes produced14pass. Formula/core/cutoffs unchanged.
- `tests/e2e/calculators/hepatology/albi-score.spec.js`: actual form/results,
  all grades, cutoffs, units, warnings/recovery, real Chromium clipboard,
  print-media visibility, reference expansion/DOIs, mobile widths and keyboard.
  Optional-action assertions were tightened; a title visibility check is no
  longer mislabeled as measured contrast.
- Reset regression reproduced missing Reset control (36pass/1fail): ALBI lacked
  the existing shared `showReset` flag. Only ALBI opts in; no new shared reset
  implementation. Final rerun passed.
- Actual PDF inspection found fixed mobile navigation obscuring text and
  dark-mode print inheritance. The new regression failed before the fix.
  The shared mobile header now uses the existing `no-print` class; print-only
  CSS makes text black, backgrounds transparent, and result rows avoid page
  breaks. Screen styles and clinical arithmetic are unchanged.
- Final 38-test Chromium run: 38 passed, zero skipped/unexpected/flaky,
  two workers, retries disabled. Build, lint, invariants, 14 compute tests and
  the live primary-source audit passed on the final runtime changes.
- Fresh independent visual sessions: desktop 1440 and mobile 390, warning
  SI40/0.5, ordinary SI40/10, US4/1, invalidation, Reset and keyboard
  calculation; no horizontal overflow or observed console/page errors.
  Runtime `ALBIScore-CGq84QmE.js`, stylesheet `index-B5Y5XgbM.css`.
- Evidence is retained outside removable worktrees in
  `.git/albi-closeout-evidence/`: `independent-rebuilt-visual-trace.json`,
  `independent-visual-trace.json`, desktop/mobile screenshots,
  `albi-warning-print-fixed.pdf` and all three rendered pages, and
  `final-local-browser-results.json`. Owner visually inspected every PDF page:
  no covered/clipped result text; the warning stays intact. This is Chromium
  Letter PDF output, not native printer certification.
- Previous49611cd evidence:13compute,34Chromium, desktop1440/mobile390 visual
  PASS, full required CI. That is historical evidence, not final-head approval.
- Native printer output, physical mobile devices, full screen-reader
  certification and every browser are not claimed. Print-media/PDF/keyboard
  evidence must be named precisely.
- Pre-existing ignored meta-CSP `frame-ancestors` diagnostic is not an ALBI
  runtime exception. No general CSP redesign is included.
- Privacy must be verified on the production-combined release: develop lacks
  main's already-live privacy hotfixes. Do not import those controls into this
  clinical PR or falsely count a no-analytics-key local build as privacy proof.

## Historical work reconciliation — do not resume

| Historical work | Incorporated disposition |
|---|---|
| PR219 `2b7dbf3`, promotion220 `2f2f7e8` | Original primary-source fidelity corrections are inherited |
| Module commits22e4032/32b397e/e3f9b61; PR251 merged `e3682c8`, promotion252 `2ce2386` | Eight core/adapter/test/audit/fixture/pilot files match by content; extraction complete, not a remaining task |
| `codex/albi-input-contract-2026-09-07`: b0a13e6,664b2c5,0df7258,d11f9da,175213c | Citation, parser/explicit units, software-warning policy, applicability, report styling/tests incorporated into6cde66f; do not merge unrelated historical ancestry |
| `codex/clinical-baseline-records-2026-09-07`, planningaa09916, tip081c81d | Alternate earlier warning anchors61/10,40/0.1,40/10000 express the same accepted policy. Current anchors cover it; mixed-purpose branch preserved |
| Active6cde66f →49611cd → final PR265 head | Sole current candidate; later warning-formatting/guide tests refine incorporated work |
| `Radulator-albi-module` worktree | Removed after clean/content-equivalence checks. No unique committed ALBI content was lost. Local/origin `refactor/albi-clinical-module-2026-09-07` refs retain `e3f9b61f52c120c71efdd7bb114d423cbd2c5bd9` for recovery |
| `RADULATOR_ALBI_PR_2026-09-07.md` outside repo | Marked ARCHIVED with canonical pointer; no longer “current unpublished candidate” |
| `docs/development/albi-module-pilot.md` | Historical extraction note with canonical pointer; old parsing/limits explicitly superseded |
| `docs/calculators/hepatology/albi-score.md` | User guide only; duplicate QA checklists and unreviewed ancillary claims removed |

Retain historical refs and other calculators' worktrees. The active worktree's
test artifacts are evidence, not tasks. Retire it only after final changes and
release evidence are preserved and its status is clean. Future ALBI changes
must start from current protected production and reopen only affected rows of
this record; a historical “pending” sentence or stale worktree is not a task.
