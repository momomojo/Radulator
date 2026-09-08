# Adrenal MRI Chemical Shift — source review and correction plan

Owner GPT-6 Astra; reviewed 2026-09-08 against main/live `5c4dcbaafb53d99415569e65e1245f80b9e6532a`. Permanent ID `adrenal-mri`. Source-based AI review; full clinical acceptance remains open.

## Current state → required state

The live empty form displays `NaN` for both measures and `Non-adenoma / lipid-poor`. Root traced this to omitted inputs defaulting to zero with unchecked division. Actual-export Aip100/Aop50/Sip100/Sop0 gives SII50.0% and CSI `Infinity` with an adenoma interpretation. Preserve useful measurement calculations, but require actual finite magnitude signal measurements and defined finite ratios before emitting the combined interpretation. Do not hide a broken ratio while declaring a diagnosis from the remaining value.

## Evidence and independent cases

- [ESE/ENSAT2023](https://academic.oup.com/ejendo/article/189/1/G1/7198474), sections2.3/4.1.1 MRI and Table4: clinical interpretation depends on the imaging context. Owner reviewed the chemical-shift context and imaging limitations; this does not establish a universally valid numerical cutoff. Existing AJR source identities/full-text details and the16.5% convention remain pending the broader audit; direct DOI retrieval was unsuccessful.
- SII=100(Aip−Aop)/Aip; CSI=(Aop/Sop)/(Aip/Sip). For this existing four-measurement combined tool, Aip, Sip and Sop must be positive; Aop may be zero but not negative. Reject missing, malformed, nonfinite or negative magnitude measurements and any nonfinite arithmetic result. These are measurement/arithmetic domains, not validation-cohort bounds or new clinical thresholds.
- Independent preservation anchors:100/50/100/100 → SII50.0%, CSI0.50;100/90/100/100 →10.0%,0.90;100/0/100/100 →100.0%,0.00. Finite decimal/scientific input strings remain supported.
- For each measurement: omitted, blank, null, boolean, array, object, suffix/hex or nonfinite input → Error only. Zero Aip/Sip/Sop and any negative signal → Error only. Finite inputs causing overflow/undefined intermediate ratios must not escape as NaN/Infinity. No stale copied clinical result after invalid recalculation; correction must recover.

Allowed files: `AdrenalMRICSI.jsx`, shared focused adrenal computation/browser regression files, this per-calculator plan. Preserve IDs, numeric formulas for the defined domain, metadata and existing finite-result wording. No new diagnostic threshold, management algorithm, modality expansion or full-verification registry label.

The existing `tests/e2e/calculators/radiology/adrenal-mri-csi.spec.js` zero-value case explicitly expected ratios even when mathematically undefined. Its observed failure after the repair is an obsolete unsafe expectation, not evidence to restore NaN outputs. Update that case to require the source-planned error and absence of numeric/clinical results; this existing test is additionally in scope.

## Acceptance record

Up-front bounded review, independently calculated examples and live initial-state defect capture complete. Local implementation, six combined computation tests, all30 focused MRI/safety browser cases, representative mutation checks and independent read-only diff review are complete; final local full-suite result1541 passed with no skips/failures. Shared evidence and exact scope are recorded in [the CT companion record](adrenal-ct.md#acceptance-record). The existing generated inventory and spec-file-count test were refreshed without changing clinical statuses. Exact-head required CI, independent signed authorization, exact deployment and live QA remain pending. Full audit still requires primary derivation/validation and technical applicability, bibliography correction if needed, interpretation scope and full interface/report coverage.
