# RECIST 1.1 Tumor Response

## Scope

The Radulator RECIST 1.1 calculator is a conventional adult and paediatric solid-tumor **clinical-trial time-point response** aid. It validates measurements already selected by a qualified clinician/radiologist, derives target sums and lesion states, compares the current sum with baseline and the prior nadir, and combines target, non-target, new-lesion, and longitudinal context into one time-point category.

It does not interpret images, select lesions, determine whether a finding is malignant, calculate individual prognosis, advise treatment continuation/change, calculate best overall response across a study, apply PFS/censoring rules, or perform trial statistical analysis. iRECIST/irRECIST and disease-specific adaptations are outside scope. Clinician/radiologist and protocol confirmation remain required.

Evidence reviewed: 2026-08-25. The independently reviewed Stage-1 pack passed source/math review; that PASS is not owner clinical signoff and is not rights or legal clearance.

## Inputs and lesion-derived state

- Measurable disease uses one to five target lesions, with at most two per organ.
- Every target records a stable identifier, organ, node/non-node status, modality, measurement plane, slice thickness when applicable, baseline measurement, current state, and current measurement when applicable.
- Non-nodal CT/MRI targets require at least 10 mm when slice thickness is at most 5 mm; with thicker slices, the target must be at least twice the slice thickness. Clinical-caliper lesions require at least 10 mm and chest-radiograph lesions at least 20 mm.
- Target nodes use short axis and require at least 15 mm at baseline. Nodes from 10 to under 15 mm are pathologic non-target lesions; nodes under 10 mm are non-pathologic by RECIST size criteria.
- A disappeared target contributes 0 mm. A present lesion genuinely too small to measure contributes the RECIST default 5 mm and is visibly marked as imputed. An accurately measurable lesion retains its actual value, including a node below 10 mm.
- The calculator derives target CR from individual lesion states. It does not expose an unchecked `all_target_cr` shortcut.
- A required missing target makes the target compartment NE unless the measured subset alone satisfies both target-PD conditions.
- Prior confirmed target response is separate from prior confirmed overall response. Only prior confirmed target PR controls continuing target PR; only prior confirmed overall CR controls malignant-reappearance progression.
- Reappearance scope is selected through a lesion-level workflow. Target scope is tied to a target row; nodal reappearance must be at least 10 mm short axis; non-target reappearance must be explicitly judged unequivocal; unknown compartment requires an explicit overall-only override.

## Exact arithmetic and response rules

Let `B` be the baseline target sum, `N` the smallest target sum before the current assessment (baseline included), and `C` the current target sum.

- Baseline change: `100 × (C − B) / B`.
- Nadir change: `100 × (C − N) / N` when `N > 0`.
- Absolute nadir change: `C − N` mm.
- Target CR: all non-nodal targets disappeared and every target node is under 10 mm short axis. A target CR may therefore retain a non-zero nodal sum.
- Target PR: at least a 30% decrease from baseline. Exactly −30% qualifies.
- Target PD by sum: at least a 20% increase from prior nadir **and** at least a 5 mm absolute increase. Both equalities qualify.
- Target SD: neither CR, PR, nor PD.

Classification comparisons use exact decimal input arithmetic. Displayed percentages are rounded to one decimal only after classification, so a displayed −30.0% cannot create PR when the unrounded decrease is less than 30%.

When a prior nadir is zero and current target burden is positive outside qualifying reappearance after confirmed overall CR, the calculator returns an indeterminate result for manual RECIST review instead of inventing an infinity-based PD category.

## Overall time-point response

Measurable-disease overall response follows the RECIST 1.1 target/non-target/new-lesion combination rules. Target PD, unequivocal non-target PD, or an unequivocal new malignant lesion produces overall PD. Target CR with persistent or unevaluated non-target disease produces overall PR. Missing target measurement produces NE unless another compartment independently proves PD. An equivocal possible new lesion produces an indeterminate result requiring reassessment.

For non-target-only disease, CR/no new lesion produces CR; persistent disease/no new lesion produces the exact source term `Non-CR/non-PD`; unevaluated disease produces NE; and unequivocal non-target PD or an unequivocal new lesion produces PD. No target sums, baseline/nadir percentages, or target arithmetic are shown or copied in this mode.

The output is always labeled `RECIST 1.1 time-point response`. It never silently converts a time-point category into study-level best overall response and never appends treatment advice.

## Confirmation and limitations

CR or PR generally requires protocol-specified confirmation in a non-randomized trial where response is the primary endpoint. Confirmation is not generally required in randomized trials or when response is not the primary endpoint, but the study protocol controls. Follow-up timing is protocol specific.

Reader variability, lesion selection, scan technique, non-target interpretation, and new-lesion assessment can change the category even when arithmetic is correct. Small isolated nodal change may warrant reassessment in context. The calculator cannot decide whether non-target worsening is unequivocal or whether a new lesion is malignant.

## Primary sources

1. Eisenhauer EA, et al. New response evaluation criteria in solid tumours: revised RECIST guideline (version 1.1). *Eur J Cancer*. 2009;45(2):228-247. [Official guideline PDF](https://project.eortc.org/recist/wp-content/uploads/sites/4/2015/03/RECISTGuidelines.pdf). DOI: `10.1016/j.ejca.2008.10.026`; PMID: `19097774`.
2. RECIST Working Group. [RECIST 1.1 current page and clarifications](https://recist.eortc.org/recist-1-1).
3. Schwartz LH, et al. RECIST 1.1—Update and clarification: From the RECIST committee. *Eur J Cancer*. 2016;62:132-137. [PubMed Central](https://pmc.ncbi.nlm.nih.gov/articles/PMC5737828/).

Rules and tables are paraphrased; no source tables, journal prose, logos, or marks are reproduced. Rights status remains `REVIEW REQUIRED BEFORE PUBLIC REPRODUCTION`.

## Verification provenance

- Corrected pack `ROOT-MANIFEST.sha256`: `9b9cca7b229ddddb5378f8c40426b9526b8bdc9bea4a1c9213703f261624a704`.
- Corrected Stage-1 brief SHA-256: `1d20457c25497224258162df74da5de21dcad4ec634bb81f602509decb16e760`.
- Fresh independent PASS report SHA-256: `8c35e119a34c58f5d5bf7987706318bb4be2164f50ae8a5767d4805ec1784ad2`.
- Durable JavaScript fixtures: 29 sealed vectors plus 48 independent adversarial classes, including repaired longitudinal vectors v23–v25.
