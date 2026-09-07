# IV Contrast Dosing — clinical review and implementation plan

ID: `contrast-dosing`; route: `/#/contrast-dosing`. Owner: GPT-6 Astra, source-based AI review started 2026-09-07. Starting source/live revision: `2ce23862442e6f6e644533341d81fe1a9facf9ac`. Isolated repair branch: `codex/contrast-capped-dose-report-2026-09-07`. This partial review does not establish complete clinical acceptance or professional certification.

## Current state → required state

The existing calculator mixes weight/concentration arithmetic and CT protocol defaults with ACR renal-safety context. It accepts anthropometry, study type, agent concentration, access type and optional renal assessment. Keep its permanent route and useful supported calculation; do not represent a renal-guideline review as verification of the dosing presets, access limits, obesity switch, or all advice.

Confirmed reporting defect, reproduced directly and in the live browser: 110 kg, 200 cm, male, SI units, hepatic study, 300 mg I/mL, peripheral 18G, stable eGFR 60 produces **150 mL** after its cap but reports **60,500 mg I** as the total dose. At that concentration, 150 mL contains **45,000 mg I**. The larger figure is the uncapped planning target, not the iodine in the displayed capped volume. This repair must not depend on completing release-controller migration.

Other identified audit gaps, not authorized as incidental changes in the first repair:

- The cited LBW trial is Zanardo et al. 2020, article 132, not de Bucourt et al., article 117. It studied adult multiphasic abdominal CT, used bioimpedance-measured LBW, and does not by itself support an automatic Boer/BMI ≥30 switch across all CT study types. Its primary outcome did not show more consistent liver enhancement with LBW dosing. This is an evidence-scope mismatch, not an established research–guideline conflict.
- The final extravasation reference has incorrect authors/pages/DOI. The matching review is Roditi et al., European Radiology 2022;32(5):3056–3066, DOI `10.1007/s00330-021-08433-4`.
- Study-type targets, the universal volume cap, IDR suitability labels, access flow defaults and saline volume need independent scope review. The current introductory disclaimer alone does not substantiate these recommendations.
- Verify adult-only applicability, nonfinite/malformed inputs, unknown enumerations and units, conditional renal fields, volume tolerance, residual dialysis handling, rounding and report consistency.

## Evidence reviewed

| Source | Exact locator | Supported scope and limits |
|---|---|---|
| [ACR Manual on Contrast Media 2026](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/ACR-Manual-on-Contrast-Media.pdf) | Adult post-contrast AKI chapter, PDF pp. 43–47 (printed 40–44); p. 47 visually inspected | Stable eGFR context, AKI limitations, individualized benefit/risk, prophylaxis/volume-risk assessment, dialysis distinctions. These passages do not establish this app's iodine targets or catheter limits. |
| Same manual, existing source binding | `scripts/audit-acr-contrast-2026-source.mjs`, 13 bound renal/warming claims; source PDF SHA-256 `24bfacd3344310d1546636f50aabba11d6458f432b3c8b1205d9c63efe751be2` freshly matched | Prior claim-specific evidence can be reused within its actual scope; warming p. 35 and all current runtime assertions still need owner completion checks. Adult/pediatric cards are linked resources, not implemented emergency algorithms. |
| [Zanardo et al., Insights into Imaging 2020;11:132](https://link.springer.com/article/10.1186/s13244-020-00920-4) | Publisher metadata; Methods: inclusion/exclusion, randomisation and dosages, LBW estimation, CT protocol; abstract and key points | Trial-specific dosing comparison, not a universal obesity or CTA prescription. Bibliography and applicability need correction. |
| [Roditi et al., European Radiology 2022;32:3056–3066](https://pmc.ncbi.nlm.nih.gov/articles/PMC9038843/) | Citation and prevention table; catheter size/site discussion | Supports device-appropriate rates/pressures and patient observation, not a universal maximum rate for all devices with the same gauge. No acute extravasation treatment implementation is authorized here. |

The immediate cap correction relies on a dimensional identity, independently evaluated by the owner: `iodine mass (mg I) = contrast volume (mL) × concentration (mg I/mL)`. A valid multiplication does not validate the protocol that selected a volume. Preserve that distinction in both tests and presentation.

## Independent cases for CONTRAST-1

All cases use metric units, male sex, contrast concentration 300 mg I/mL and 18G access. Renal state may be stable/eGFR 60 for browser reproducibility; renal recommendations must not change.

| Case | Inputs | Expected arithmetic and reporting |
|---|---|---|
| CAPPED-TBW | 110 kg, 200 cm, hepatic | Existing target `110 × 550 = 60,500 mg I`; uncapped volume `60,500 / 300 = 201.666… mL`. Preserve the 150 mL capped volume; total iodine from that volume is 45,000 mg I, approximately 409 mg I/kg TBW. Separately identify 60,500 mg I as the uncapped target. |
| UNCAPPED-TBW | 70 kg, 175 cm, routine | Target 28,000 mg I; unrounded volume 93.333… mL, display about 93 mL. Preserve existing total and unit-normalized dose; display rounding must not be mistaken for an additional clinical dosing rule. |
| CAP-EXACT | 112.5 kg, 200 cm, routine | Target and volume-equivalent dose both 45,000 mg I; volume exactly 150 mL. No claim that dose was reduced by the cap. |
| CAP-NEIGHBORS | 112.49 and 112.51 kg, 200 cm, routine | Targets 44,996 and 45,004 mg I. Only the latter is capped; displayed total must derive from the final unrounded planned volume, not the pre-cap target. Rounding may display both volumes as 150 mL. |
| CAPPED-LBW | 120 kg, 190 cm, hepatic | Existing Boer male calculation `48.84 + 50.73 − 19.2 = 80.37 kg`; current target `80.37 × 630 = 50,633.1 mg I`. Preserve its existing cap but report 45,000 mg I in 150 mL, approximately 560 mg I/kg LBW. This test describes current arithmetic; it does not endorse the obesity policy. |

## Approved bounded task: CONTRAST-1

Owner-approved before implementation, 2026-09-07. GPT-5.6 Luna xhigh implements this reporting defect only.

Allowed files: `src/components/calculators/ContrastDosing.jsx`, a focused `tests/contrast-dose-report-compute.test.mjs`, the existing contrast browser spec, and this document's implementation-results subsection. Existing expected fixtures may change only if they assert the demonstrated pre-cap reporting error; identify each changed assertion and its owner-prescribed independent answer. No renal rules, formula coefficients, dose targets, cap threshold, units, bibliography, other calculators, registry status, shared UI, or release-control changes.

1. Add RED tests against the actual exported compute function for the independent cases above. Assert reported total iodine corresponds to final planned volume (before display rounding). Preserve the original target separately for capped cases using the exact new key `Uncapped Iodine Target` with clear units and dosing basis.
2. Change `Total Iodine Dose` to derive from the final capped/unrounded volume; retain existing non-capped presentation and report the corresponding actual mg I/kg dosing weight. Do not silently increase the cap or adjust protocol/renal recommendations.
3. Retain the cap warning and make clear that the cap reduces the planned iodine below the target and diagnostic adequacy must be confirmed against the local protocol. This is a planning report, not proof of an administered dose.
4. Add one browser regression for CAPPED-TBW, including rendered result and copied report, preserving the route and other results. Use synthetic inputs only. Deliberately restore the pre-cap total in a temporary local mutation and show the focused regression fails; restore before committing.
5. Run focused computation/contrast browser tests and canonical local checks. Full required final-candidate browser suite remains necessary before clinical release; do not independently start redundant full suites or publish. Report any failure instead of weakening expected values.

## Completion record

- CONTRAST-1 implementation-results (2026-09-07): The exported `ContrastDosing.compute` now derives `Total Iodine Dose` from the final unrounded planned volume after the existing 150 mL cap. Capped cases retain the pre-cap planning value under the exact `Uncapped Iodine Target` key, and the existing cap warning now states that the cap reduces planned iodine below target, calls for local-protocol adequacy confirmation, and identifies the output as planning rather than administered-dose proof. The dose policy, target coefficients, cap threshold, renal logic, units, and non-capped presentation were left unchanged. Added five actual-export cases (CAPPED-TBW, UNCAPPED-TBW, CAP-EXACT, CAP-NEIGHBORS, CAPPED-LBW) and one rendered/copied CAPPED-TBW browser regression. Evidence: initial focused RED was 2 passed/3 failed; restored implementation GREEN was 5/5; temporary pre-fix total-dose mutation failed 3/5; `CI=1 npx playwright test ... --grep "Volume Capping"` passed 2/2 against the clean preview. `npm ci`, `npm run build`, `npm run lint`, `npm run check:invariants`, and `npm run test:contrast-source` passed. The first non-CI browser invocation was not evidence because its reused port 5173 server served an unrelated Chronolex sign-in page; no calculator assertion ran. Full final-candidate Playwright suite and clinical acceptance remain owner/release-gate responsibilities.
- Current-state/source planning: partial review above, with a live reproduction of the capped-dose inconsistency.
- CONTRAST-1 implementation, independent review and final-candidate tests: pending.
- Corrected live release: pending; the old inconsistent report remains on the starting live revision.
- Full supported-scope clinical audit: pending; dosing research, access limits and bibliography gaps listed above remain open.
- Expansion excluded: acute reaction treatment, pediatric dosing, new premedication or periprocedural algorithms.
