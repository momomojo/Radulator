# Renal Cyst (Bosniak Classification) Calculator

## Overview

The Renal Cyst (Bosniak Classification) Calculator classifies cystic renal masses using **Bosniak Classification, version 2019** CT criteria from Silverman et al. The v2019 update replaces several qualitative 2005 rules with explicit wall/septal thickness thresholds, septa counts, a nodule definition, calcification simplification, and homogeneous HU-based Bosniak II subtypes.

**Calculator ID**: `bosniak`
**Display Name**: Bosniak Classification (Renal Cysts)
**Specialty**: Radiology
**Category**: Genitourinary Imaging
**Guideline Version**: Bosniak v2019

---

## Version History

The prior calculator implementation used 2005 CT logic while displaying a v2019 badge in some builds. The current implementation is the single live Bosniak version and uses v2019 CT criteria.

Key changes from the retired 2005 implementation:

- **Quantitative thresholds**: thin `<=2 mm`, minimally thickened `3 mm`, thick `>=4 mm`
- **Septa count**: few `1-3`, many `>=4`
- **Nodule decision tree**: `>=4 mm` convex protrusion with obtuse margins or any convex protrusion with acute margins is Bosniak IV when enhancing
- **Calcifications**: any morphology may occur in Bosniak II only when the mass remains well defined with a thin smooth wall and underlying features remain assessable; abundant calcification may require MRI
- **Density subtypes**: homogeneous `>=70 HU` noncontrast, non-enhancing `>20 HU` renal mass protocol, `21-30 HU` portal venous phase, and too-small-to-characterize low-attenuation masses are Bosniak II. A homogeneous hyperattenuating nonenhancing mass larger than `3 cm` may be best characterized with MRI before assignment; size is not an automatic IIF upgrade.
- **Enhancement confirmation**: wall, septal, or nodule enhancement is required for IIF, III, and IV criteria
- **Removed standalone upgrades**: intrarenal location and size `>=3 cm` alone no longer upgrade to IIF
- **Eligibility gate**: Apply the general-population Bosniak v2019 guidance only after infectious, inflammatory, and vascular etiologies and necrotic solid masses are excluded and when a hereditary renal cell carcinoma syndrome is not known or suspected
- **Enhancing-tissue gate**: Bosniak v2019 is intended for masses with less than approximately `25%` enhancing tissue; masses with approximately one-quarter or more are evaluated as solid masses with cystic or necrotic change
- **Well-defined gate**: Bosniak I and II are assigned only when the mass is explicitly recorded as well defined
- **Feature-specific enhancement**: wall, septal, and nodule enhancement are recorded separately; enhancement elsewhere cannot upgrade an unrelated feature

---

## v2019 CT Criteria

### Scope Gate

Bosniak v2019 applies to cystic renal masses where less than approximately 25% of the mass is composed of enhancing tissue. If approximately 25% or more of the mass is enhancing tissue, evaluate the lesion as a solid renal mass with cystic or necrotic change rather than assigning a Bosniak class. Apply the classification only after infectious, inflammatory, and vascular etiologies and necrotic solid masses are excluded.

The source's suggested reporting content is intended for the general population and not patients with a renal cell carcinoma syndrome. The calculator therefore returns **Not applicable** instead of an I/II no-follow-up result when a hereditary RCC syndrome is known or suspected, including von Hippel-Lindau syndrome or hereditary leiomyomatosis and renal cell cancer (HLRCC/FH). Use syndrome-specific renal-mass evaluation and surveillance with the appropriate specialist.

### Enhancement

Enhancement is either unequivocally perceived visually or quantitatively confirmed. For CT, v2019 uses a `>=20 HU` increase between noncontrast and contrast-enhanced phases.

### Categories

| Category | v2019 Criteria in Calculator | Reporting Term | Management |
|---|---|---|---|
| **I** | Fully characterized well-defined homogeneous simple fluid on a renal mass protocol examination, thin smooth wall, no septa, no calcification, no nodule | Benign simple cyst | No follow-up required |
| **II** | All are well defined with a thin smooth `<=2 mm` wall, plus few `1-3` thin septa (which may enhance), any calcification morphology when features remain assessable, or a benign homogeneous CT density subtype including a homogeneous `-9 to 20 HU` mass known only from noncontrast CT | Benign cystic mass | No follow-up required |
| **IIF** | Smooth 3 mm enhancing wall or septa, or many `>=4` thin enhancing septa | Probably benign cystic mass | CUA 2023 suggests imaging every `6-12` months during the first year, then yearly if stable; for cysts without progression, `5 years` of follow-up is suggested. The interval is expert opinion and the 5-year duration is conditional with very low certainty; tailor surveillance to patient factors and specialist guidance |
| **III** | Enhancing thick `>=4 mm` or irregular obtuse wall/septa without enhancing nodule | Indeterminate cystic mass | Consider urology consultation |
| **IV** | Enhancing nodule: `>=4 mm` obtuse convex protrusion or any size acute-margin convex protrusion | Cystic mass, highly suspicious for malignancy | Consider urology consultation |

---

## Inputs

| Field | Options | Purpose |
|---|---|---|
| **Bosniak v2019 eligibility** | General-population criteria apply and alternative etiologies/necrotic solid mass are excluded; known or suspected hereditary RCC syndrome; not excluded or uncertain | Prevents general-population management output outside the source-defined population |
| **Enhancing-tissue proportion** | Less than approximately `25%` or absent; approximately `25%` or more | Applies the cystic-mass scope gate |
| **Mass definition** | Well defined; ill defined or uncertain | Enforces the source-defined well-defined requirement before assigning Bosniak I or II |
| **Wall enhancement** | Absent/not confirmed; present | Binds enhancement to the wall feature |
| **Septal enhancement** | Absent/not confirmed; present | Binds enhancement to the selected septa |
| **Protrusion/nodule enhancement** | Absent/not confirmed; present | Binds enhancement to the selected protrusion |
| **Wall thickness / morphology** | Thin `<=2 mm`; smooth 3 mm; smooth `>=4 mm`; irregular obtuse protrusion `<=3 mm` | Determines I/IIF/III wall criteria |
| **Septa count** | None; few `1-3`; many `>=4` | Applies v2019 septal-count thresholds |
| **Septal thickness / morphology** | Thin `<=2 mm`; smooth 3 mm; smooth `>=4 mm`; irregular obtuse protrusion `<=3 mm` | Determines II/IIF/III septal criteria |
| **Enhancing nodule morphology** | None; `>=4 mm` obtuse; any size acute | Applies the v2019 IV nodule definition |
| **Calcifications** | Absent; present | Any morphology may occur in Bosniak II only with a well-defined thin smooth wall and assessable underlying features; abundant calcification may require MRI |
| **Homogeneous CT density subtype** | Fully characterized simple fluid on renal mass protocol CT; `-9 to 20 HU` at noncontrast CT only; `>=70 HU` noncontrast; non-enhancing `>20 HU`; `21-30 HU` portal venous; low attenuation too small to characterize; other | Separates a fully characterized Bosniak I simple cyst from the source-defined Bosniak II noncontrast `-9 to 20 HU` subtype; applies the other v2019 benign HU subtypes; `other` is treated as heterogeneous or otherwise incompletely characterized and cannot be overridden into II by calcification or few thin septa |
| **Hyperattenuating mass size** | `<=3 cm`; `>3 cm` or uncertain | Shown for the `>=70 HU` subtype; larger or size-uncertain masses return Not assigned with MRI characterization guidance |
| **Wall, septal, or nodule enhancement** | Absent/not confirmed; present | Required for IIF/III/IV criteria |

---

## Worked Examples

### Bosniak I

Fully characterized homogeneous simple-fluid mass on a renal mass protocol examination with a thin smooth wall, no septa, no calcifications, no nodule, and no enhancing solid tissue.

**Result**: Bosniak I, benign simple cyst, no follow-up required.

### Bosniak II: Noncontrast −9 to 20 HU Subtype

Well-defined homogeneous `-9 to 20 HU` mass evaluated only at noncontrast CT,
with a thin smooth wall and no higher-order feature.

**Result**: Bosniak II, likely benign renal mass, no follow-up required. This is
not labeled a fully characterized Bosniak I simple cyst because enhancement and
the complete simple-fluid characterization were not established by a renal mass
protocol examination.

### Bosniak II: High-Attenuation Case That Changed from 2005

Homogeneous `>=70 HU` noncontrast CT mass with thin wall, no septa, no calcification, no nodule, and no enhancement.

**Result**: Bosniak II, benign cystic mass, no follow-up required.
**Prior 2005 behavior**: high attenuation alone was treated as IIF.

### Bosniak II: Other Benign Homogeneous CT Subtypes

With a well-defined thin smooth wall and no higher-risk enhancing features, each of these source-defined inputs returns Bosniak II in a separate exact regression vector:

- homogeneous nonenhancing `>20 HU` at renal mass protocol CT;
- homogeneous `-9 to 20 HU` known only from noncontrast CT;
- homogeneous `21-30 HU` at portal venous phase CT;
- homogeneous low-attenuation mass too small to characterize.

**Result for each vector**: Bosniak II, benign cystic mass.

### Bosniak II: Calcification Case That Changed from 2005

Thin smooth wall, no septa, calcifications present, water density, no enhancing nodule.

**Result**: Bosniak II, benign cystic mass, no follow-up required.
**Prior 2005 behavior**: thick or nodular calcifications could upgrade the result.

### Not Assigned at CT: MRI Needed

A nonenhancing wall or septum measuring `3 mm` or more, an irregular nonenhancing wall/septum, many (`>=4`) nonenhancing septa, a protrusion without confirmed enhancement, heterogeneous or otherwise incompletely characterized density, or a homogeneous hyperattenuating nonenhancing mass larger than `3 cm` (or of uncertain size) is not forced into Bosniak II. The calculator returns **Not assigned** and recommends renal mass protocol MRI before classification.

### Bosniak IIF

Many `>=4` thin enhancing septa without thick wall, irregular septa, or nodule.

**Result**: Bosniak IIF, probably benign cystic mass. CUA 2023 suggests imaging every 6-12 months during the first year, then yearly if stable; for cysts without progression, 5 years of follow-up is suggested. The interval is based on expert opinion and the 5-year duration is a conditional recommendation with very low certainty. Tailor surveillance to patient factors and specialist guidance. Bosniak v2019 predicts malignancy risk and is not a substitute for patient-specific management.

### Bosniak III

Enhancing smooth wall `>=4 mm` without an enhancing nodule.

**Result**: Bosniak III, indeterminate cystic mass, consider urology consultation.

### Bosniak IV

Enhancing convex protrusion with acute margins, any size. When other features fall into a lower or incompletely characterized class, the confirmed enhancing nodule remains the highest feature and Bosniak IV is assigned.

**Result**: Bosniak IV, cystic mass highly suspicious for malignancy, consider urology consultation.

---

## MRI Scope Note

Bosniak v2019 includes separate MRI criteria, including a different enhancement threshold (`>=15%` signal-intensity increase) and MRI-specific class II/IIF subtypes. This calculator implements the CT pathway. Use dedicated Bosniak v2019 MRI criteria when evaluating renal masses on MRI.

---

## Implementation

- **Component**: `src/components/calculators/RenalCystBosniak.jsx`
- **E2E Tests**: `tests/e2e/calculators/radiology/renal-cyst.spec.js`
- **Test Data**: `tests/e2e/calculators/radiology/renal-cyst-test-data.json`

---

## References

1. Silverman SG, Pedrosa I, Ellis JH, Hindman NM, Schieda N, Smith AD, et al. **Bosniak Classification of Cystic Renal Masses, Version 2019: An Update Proposal and Needs Assessment.** Radiology. 2019;292(2):475-488. DOI: [10.1148/radiol.2019182646](https://doi.org/10.1148/radiol.2019182646)
2. Richard PO, Violette PD, Bhindi B, et al. **2023 UPDATE - Canadian Urological Association guideline: Management of cystic renal lesions.** Can Urol Assoc J. 2023;17(6):162-174. [PMCID: PMC10263289](https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/). Recommendation 6 is expert opinion; recommendation 7 is conditional with very low certainty.
3. Bosniak MA. **The current radiological approach to renal cysts.** Radiology. 2005;236(1):61-70. DOI: [10.1148/radiol.2362040218](https://doi.org/10.1148/radiol.2362040218)
