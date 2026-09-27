# Y-90 dosimetry — clinical review and correction plan

Permanent ID `y90-radiation-segmentectomy`; existing hash/static URLs remain unchanged. Owner: GPT-6 Astra. Reviewed 2026-09-07 against source/main `f4547ad70d9b2d6302471be0b6aaa3f45686727f`. Source-based AI review, not professional certification or treatment authorization.

## Current state and demonstrated defects

The calculator supports uniform and tumor/normal partition calculations, residual correction, lung-dose estimation and optional BSA. Root read its entire implementation and existing browser expectations, then exercised the actual live uniform form: lobectomy, glass, 1000 mL, 100 Gy, 10% shunt, 0% residual returns **1.87 GBq and 9.3 Gy lung dose**, while echoing the requested 100 Gy as achieved and declaring parameters safe. The correct independent energy-balance result with the existing conversion factor is **2.30 GBq and 11.4 Gy**.

Two errors are present: uniform activity multiplies by `(1-F)` instead of dividing; partition activity uses `M_N*(TNR+1)` instead of `M_T*TNR+M_N` and also multiplies by `(1-F)`. Existing browser tests assert the incorrect formulas, so their green status is not clinical evidence. The legacy JSON cases repeat those formulas and contain unsupported vial expectations.

Other exposed problems: vial selection has no calibration/treatment-time input yet claims decay correction; a generic 190 Gy minimum and 80 Gy normal-tissue rule ignore product, compartment and clinical context; a global safety clearance cannot follow from these few inputs. `parseFloat` and unchecked enums permit malformed programmatic inputs.

## Evidence and scope

| Source | Exact reviewed locator and use |
|---|---|
| [EANM guideline, Weber et al. 2022](https://doi.org/10.1007/s00259-021-05600-z), [open full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC8940802/) | Dosimetry → Single versus multi-compartment versus voxel-based dosimetry, paragraphs 70–77 / equation `Equb`: compartment definitions, activity-per-mass T/N ratio, mass-weighted partition equation, conversion factor 49.67 J/GBq. XML SHA-256 `6254af6d1e26c52e1df05ea32b0f90e8606613df8d679188b97909fedb86a827`. |
| [TheraSphere FDA-hosted eIFU P200029S011C](https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200029S011C.pdf) | PDF pp.20–23 and Appendix p.29 read; p.29 equation visually inspected. Confirms shunt/residual denominators and tumor-target partition derivation; dose-vial ordering requires timing. Its coefficient is 50, not 49.67. Page20 separates perfused-volume and tumor-partition targets; do not transfer its targets to resin or a different compartment. SHA-256 `c85ca2d4930ec471d0f373b8acaaa175fb689a4a1bec20c015a0409fece2ba6d`. |
| [AAPM MPPG14.a](https://pmc.ncbi.nlm.nih.gov/articles/PMC10860558/) | Section7.2 equations2–8 and accompanying assumptions read: local deposition, activity in liver/lungs, density, limitations of assumed lung mass. It reports49.38 and discusses differing published conversion constants. Downloaded XML SHA-256 `3dd757dc71312365e2c9246f530bde4bc45d64a22339e654e799f8daa8588cb6`; remaining report/treatment sections are not yet fully reviewed. |

The first correction retains **49.67 J/GBq consistently**, explicitly labeled as the EANM model convention, and density1.03 g/mL. It does not claim numerical identity to the manufacturer implementation or silently change to50/49.38. These convention differences do not explain the algebraic errors. Adult educational arithmetic for clinician-selected targets is supported; patient eligibility, dose-target selection, calibration-time ordering, cumulative exposure, hepatic reserve, mapping quality and individualized treatment authorization are not.

## Independent derivation and expected results

Let `F` be shunt fraction, `R` expected residual fraction, `C=49.67`, `M=0.00103*volume_mL` kg. `A_inj` means activity entering the patient at treatment time; `A_vial` includes compensation for expected residual, also at treatment time. It is **not** activity at calibration or a vial order.

- Uniform energy requirement: `E = D*M`; `A_inj = E/[C*(1-F)]`.
- Partition: `D_N = D_T/TNR`; `E = D_T*M_T + D_N*M_N`; `A_inj = E/[C*(1-F)]`.
- `A_vial = A_inj/(1-R)`; `D_lung = C*A_inj*F/1 kg`; use injected activity, not residual-compensated vial activity, for lung dose.
- Mean perfused dose in partition is `E/(M_T+M_N)`; `1 mCi = 0.037 GBq`. Round only displayed results.

Root derived cases from energy balance, independently of the implementation. Unless specified: total1000mL, residual0%, glass/lobectomy. Expected activity below is at treatment time including residual, displayed2dp; lung dose1dp.

| Case | Inputs | Energy J | Activity GBq (mCi) | Lung Gy | Other |
|---|---|---:|---|---:|---|
| U0 | uniform100Gy, shunt0% |103|2.07 (56.0)|0.0|mean100.0Gy|
| U10 | uniform100Gy, shunt10% |103|2.30 (62.3)|11.4|injected2.30409592197GBq|
| UR | U10, residual10% |103|2.56 (69.2)|11.4|residual changes vial activity, not required injected activity or dose|
| P10 | tumor200mL, tumor300Gy, TNR3, shunt10% |144.2|3.23 (87.2)|16.0|normal100.0Gy, mean140.0Gy|
| PR | P10, residual10% |144.2|3.58 (96.9)|16.0|injected3.22573429076GBq|
| P1 | P10, TNR1 |309|6.91 (186.8)|34.3|normal/mean300.0Gy; equals uniform300Gy for any valid partition split|

Additional cases: shunt0/10/20% must increase required activity; changing tumor fraction with TNR1 leaves activity unchanged. Changing residual must not double-correct lung dose. Missing/blank/nonfinite/unit-suffixed/array/boolean numeric inputs used by the model fail, except the explicitly documented inherited omitted-residual default below; unknown nonempty enum values fail. Irrelevant tumor/TNR values do not affect uniform results. Retain current visible numeric entry bounds as **software bounds pending applicability review**, not guideline limits. Test lung-dose30Gy flag just below/above using independent energy/shunt inputs; do not round before comparison.

## Y90-1: approved bounded implementation

Allowed files: `src/components/calculators/Y90RadiationSegmentectomy.jsx`, new `tests/y90-compute.test.mjs`, existing `tests/e2e/calculators/hepatology/y90-radiation.spec.js`, `tests/test-data/y90-radiation-test-cases.json`, and this document. No shared UI, registry, workflow or dependency changes.

1. Correct both formulas and their comments/display using the equations above. Validate exact supported enum membership and whole finite numeric inputs (strings/numbers only), keeping the existing numeric ranges for this bounded fix. Preserve ID, names, input IDs, optional BSA and model outputs. Show tumor volume and T/N fields only for partition via the existing `showIf` convention; label target dose clearly as mean perfused-volume dose for uniform and tumor dose for partition.
2. Replace `Activity to Order` with `Activity at Treatment Time`, and add `Expected Injected Activity`, both clearly labeled GBq/mCi. Replace prescribed-activity heading with calculated-activity heading. Remove unsupported numeric vial selection, claimed timing correction, and prompts to increase doses to190Gy. Do not replace them with new target-selection rules. Remove generic80Gy/0.3kg guidance and resin20%-as-complete-eligibility rule pending product-specific review.
3. Keep numeric lung-dose output. Replace global safety/contraindication interpretation with `Treatment Suitability: Not assessed`. A separate `Single-Treatment Lung Dose Check` reports `Above 30 Gy reference — specialist review required` when unrounded estimate>30, otherwise `At or below 30 Gy reference — not treatment clearance`. Add the same scope to visible/copy/print output: `Educational compartment dosimetry for clinician-selected targets. Assumes 1.0 kg lung mass and 1.03 g/mL liver density. Does not assess cumulative lung dose, hepatic reserve, extrahepatic deposition, product-specific eligibility, or treatment suitability. No calibration-to-treatment decay or vial-order calculation.`
4. Keep existing model/volume/mass/dose context; explicitly state conversion factor49.67. Prepend the two directly reviewed EANM/FDA references. Mark remaining historical bibliography as pending scope review in this record; do not invent new citation details. No full clinical-version verification claim.
5. Tests first: add the source-derived exact outputs above, invalid inputs, invariance/monotonic cases, no false safety/ordering statements, visibility/stale result changes, and actual copy plus print-layout contract. Replace legacy incorrect browser/JSON expectations only according to this prescribed correction, retaining unaffected validation/UI coverage. Record each revised expected claim. Representative mutations restoring wrong shunt direction and wrong partition mass weighting must fail focused tests, then be restored.

This is one urgent correction with explicit restrictions, not a completed full audit. If any rule/case is unclear, return it to Astra; do not alter expected answers to match current behavior.

Pre-implementation independent check: six expected cases and source/conversion conventions independently confirmed. Accepted clarifications: visibly define T/N as **tumor-to-normal activity concentration (activity or corrected counts per unit mass), not the total tumor/normal counts ratio**. Replace the entire old information/interpretation safety prose with the prescribed limited scope/checks, including removal of `<10 Gy normal`, `10–20 Gy acceptable`, and positive `≥190 Gy threshold met` wording. This is replacement of unsupported guidance, not only suppression of the old dose-increase prompt. Assertions must reject those inherited claims wherever they appear in metadata or results.

## Remaining audit and acceptance

Owner clarification after final-review input probe, 2026-09-07: preserve the inherited, visibly documented expected-residual default. Omitted/undefined `vial_residual` uses1%; explicitly blank, null, malformed or nonfinite residual fails. This is an application default awaiting product/applicability review, not a universal expected clinical residual. U10 with default1% yields2.33GBq treatment-time activity,2.30GBq expected injected activity,11.4Gy lung dose and reported1.0% residual. Add a regression for omission versus blank; other required model numerics and radios remain explicit. This corrects the plan's overly broad missing-input wording without silently changing the inherited default.

Restore unaffected required-radio, missing-lung-shunt, missing/upper-bound T/N and invalid optional-BSA coverage when replacing wrong clinical expectations. Prove stale results disappear before recalculation after dose/model changes. No new eligibility or target-selection rule is authorized.

- Y90-1 arithmetic and restricted reporting implemented in `947d355d36b9153479fb28e06c3de6ae8366d535` and independently accepted within the prescribed scope; owner corrected the two remaining browser-test preconditions (true height-only optional BSA; visible recomputed result before model switching). Focused compute cases and deliberate wrong-shunt/partition/rounded-boundary mutations are retained in the implementation evidence. No broader clinical acceptance is implied.
- Owner assembly extends the allowed scope only to accurate Y90 guideline-registry metadata, its generated inventory, and one print-only `.skip-link` selector in `src/index.css`. Actual desktop/mobile/print-CSS QA found the fixed navigation link overlaying the printed report. A browser regression focusing that link before print media failed against the prior CSS; hiding this navigation element in print preserves the screen keyboard link. This is a report defect correction, not a UI redesign. Native printing remains unverified.
- Full required CI, independent signed release reviews and exact deployed correction/live proof remain pending; local browser screenshots and native clipboard checks do not establish publication.
- Y90-2: review product-specific current guidance, every historical reference, numerical entry-bound applicability, lung mass choice and cumulative-dose scope; determine which additional clinical functions can be supported without false clearance. Restrictions beyond BI-RADS must return to the user before declaring the whole baseline complete.
- Y90-3: full desktop/mobile/keyboard/report/reference/QA coverage and broader regression acceptance after shared privacy release. No native printing claim from an emulated print layout.
