# ACR TI-RADS source review

Review date: 2026-09-07

Scope: adult thyroid ultrasound nodule recommendations from the 2017 ACR TI-RADS materials. Prior biopsy results and other clinical context can alter management; this review does not add patient-specific management or staging branches. It is bounded source/implementation evidence, not certification of the whole calculator or clinical sign-off.

## Primary evidence

- ACR TI-RADS White Paper (Tessler et al., JACR 2017), [DOI 10.1016/j.jacr.2017.01.046](https://doi.org/10.1016/j.jacr.2017.01.046), reviewed at the small primary PDF mirror: [professionalradiology.com PDF](https://www.professionalradiology.com/media/user/resources/ACR%20Thyroid%20Imaging%20TI-RADS%20White%20Paper%202017.pdf). Local review artifact: `/private/tmp/radulator-review-sources.zAbC9d/acr-tirads-whitepaper.pdf`, SHA-256 `e410ac250797efb81dbc62db13438a776eed7676e39e9f7838f000da03d18fe4`. Figure 1 (PDF p3), scoring framework (PDF p2), composition narrative (PDF p4 / journal p590), and follow-up narrative (PDF p6 / journal p592) were checked.
- ACR TI-RADS Atlas, [Dartmouth PDF](https://geiselmed.dartmouth.edu/radiology/wp-content/uploads/sites/47/2025/07/ACR_TI-RADS_Atlas.pdf), reviewed at PDF p2 and p6. Local review artifact: `/private/tmp/radulator-review-sources.zAbC9d/acr-tirads-atlas.pdf`, SHA-256 `7d1fd2df4e43002abb203982e91fe15ed882e60ddaeeb200f96238a25df4beca`.

## Implemented source assertions

- Composition, echogenicity, shape, margin, and echogenic foci are scored separately. Echogenic foci use an explicit choose-all-that-apply assessment: macrocalcification 1, peripheral/rim calcification 2, and punctate echogenic foci 3; large comet-tail artifacts/no scored foci are 0. Selected scored foci are additive (maximum foci contribution 6), while the maximum theoretical calculator score is 17.
- Categories are 0 = TR1, 2 = TR2, 3 = TR3, 4–6 = TR4, and 7 or more = TR5. The implementation intentionally rejects an unassigned score rather than inventing a TR2 mapping.
- FNA thresholds are TR3 ≥2.5 cm, TR4 ≥1.5 cm, and TR5 ≥1.0 cm. Surveillance thresholds are TR3 ≥1.5 cm, TR4 ≥1.0 cm, and TR5 ≥0.5 cm. Schedules are TR3 at 1, 3, and 5 years; TR4 at 1, 2, 3, and 5 years; and TR5 annually for up to 5 years. Below the surveillance threshold the calculator does not recommend routine TI-RADS follow-up or FNA.
- Spongiform and cystic composition-only inputs return TR1/0 and hide dependent feature fields in the form. Spongiform composition is not scored upward merely because residual echogenicity is present; suspicious residual margins or scored foci require reassessment. Mixed/solid anechoic input is rejected as contradictory.
- Displayed risk values are labelled source-reported group estimates, not individual probabilities. No numeric staging advice is generated for extrathyroidal extension.

## Evidence-to-test pointers

- Source implementation: `src/components/calculators/TIRADS.jsx`
- Focused compute assertions: `tests/tirads-compute.test.mjs`
- Canonical compute vectors: `tests/fixtures/compute/tirads.json` (20 cases, including all eight foci combinations, maximum score, threshold boundaries, and validation failures)
- Legacy regression fixture: `tests/fixtures/tirads-test-data.json` (maximum-score case corrected to additive 17 points)
- Browser coverage: `tests/e2e/calculators/radiology/tirads.spec.js`

Run the bounded checks with:

```text
node --import ./scripts/register-jsx-loader.mjs --test tests/tirads-compute.test.mjs
node --import ./scripts/register-jsx-loader.mjs scripts/run-compute-tests.mjs
```

These checks establish deterministic implementation behavior and source traceability only; they do not establish clinical sign-off or whole-calculator certification. Any release claim remains subject to the existing exact-head review and deployment verification controls.
