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
- **Density subtypes**: homogeneous `>=70 HU` noncontrast, non-enhancing `>20 HU` renal mass protocol, `21-30 HU` portal venous phase, and too-small-to-characterize low-attenuation masses are Bosniak II
- **Enhancement confirmation**: wall, septal, or nodule enhancement is required for IIF, III, and IV criteria
- **Removed standalone upgrades**: intrarenal location and size `>=3 cm` alone no longer upgrade to IIF
- **Eligibility gate**: Apply Bosniak v2019 only after infectious, inflammatory, and vascular etiologies and necrotic solid masses are excluded
- **Enhancing-tissue gate**: Bosniak v2019 is intended for masses with less than approximately `25%` enhancing tissue; masses with approximately one-quarter or more are evaluated as solid masses with cystic or necrotic change
- **Feature-specific enhancement**: wall, septal, and nodule enhancement are recorded separately; enhancement elsewhere cannot upgrade an unrelated feature

---

## v2019 CT Criteria

### Scope Gate

Bosniak v2019 applies to cystic renal masses where less than approximately 25% of the mass is composed of enhancing tissue. If approximately 25% or more of the mass is enhancing tissue, evaluate the lesion as a solid renal mass with cystic or necrotic change rather than assigning a Bosniak class. Apply the classification only after infectious, inflammatory, and vascular etiologies and necrotic solid masses are excluded.

### Enhancement

Enhancement is either unequivocally perceived visually or quantitatively confirmed. For CT, v2019 uses a `>=20 HU` increase between noncontrast and contrast-enhanced phases.

### Categories

| Category | v2019 Criteria in Calculator | Reporting Term | Management |
|---|---|---|---|
| **I** | Homogeneous `-9 to 20 HU` simple fluid, thin smooth wall, no septa, no calcification, no nodule | Benign simple cyst | No follow-up required |
| **II** | All are well defined with a thin smooth `<=2 mm` wall, plus few `1-3` thin septa (which may enhance), any calcification morphology when features remain assessable, or a benign homogeneous CT density subtype | Benign cystic mass | No follow-up required |
| **IIF** | Smooth 3 mm enhancing wall or septa, or many `>=4` thin enhancing septa | Probably benign cystic mass | Follow-up at 6 months, 12 months, then annually for 5 years |
| **III** | Enhancing thick `>=4 mm` or irregular obtuse wall/septa without enhancing nodule | Indeterminate cystic mass | Consider urology consultation |
| **IV** | Enhancing nodule: `>=4 mm` obtuse convex protrusion or any size acute-margin convex protrusion | Cystic mass, highly suspicious for malignancy | Consider urology consultation |

---

## Inputs

| Field | Options | Purpose |
|---|---|---|
| **Bosniak v2019 eligibility** | Alternative etiologies and necrotic solid mass excluded; not excluded or uncertain | Prevents use outside the source-defined population |
| **Enhancing-tissue proportion** | Less than approximately `25%` or absent; approximately `25%` or more | Applies the cystic-mass scope gate |
| **Wall enhancement** | Absent/not confirmed; present | Binds enhancement to the wall feature |
| **Septal enhancement** | Absent/not confirmed; present | Binds enhancement to the selected septa |
| **Protrusion/nodule enhancement** | Absent/not confirmed; present | Binds enhancement to the selected protrusion |
| **Wall thickness / morphology** | Thin `<=2 mm`; smooth 3 mm; smooth `>=4 mm`; irregular obtuse protrusion `<=3 mm` | Determines I/IIF/III wall criteria |
| **Septa count** | None; few `1-3`; many `>=4` | Applies v2019 septal-count thresholds |
| **Septal thickness / morphology** | Thin `<=2 mm`; smooth 3 mm; smooth `>=4 mm`; irregular obtuse protrusion `<=3 mm` | Determines II/IIF/III septal criteria |
| **Enhancing nodule morphology** | None; `>=4 mm` obtuse; any size acute | Applies the v2019 IV nodule definition |
| **Calcifications** | Absent; present | Any morphology may occur in Bosniak II only with a well-defined thin smooth wall and assessable underlying features; abundant calcification may require MRI |
| **Homogeneous CT density subtype** | Water `-9 to 20 HU`; `>=70 HU` noncontrast; non-enhancing `>20 HU`; `21-30 HU` portal venous; low attenuation too small to characterize; other | Applies v2019 benign HU subtypes |
| **Wall, septal, or nodule enhancement** | Absent/not confirmed; present | Required for IIF/III/IV criteria |

---

## Worked Examples

### Bosniak I

Thin smooth wall, no septa, no calcifications, no nodule, homogeneous `-9 to 20 HU` fluid, and no enhancing solid tissue.

**Result**: Bosniak I, benign simple cyst, no follow-up required.

### Bosniak II: High-Attenuation Case That Changed from 2005

Homogeneous `>=70 HU` noncontrast CT mass with thin wall, no septa, no calcification, no nodule, and no enhancement.

**Result**: Bosniak II, benign cystic mass, no follow-up required.
**Prior 2005 behavior**: high attenuation alone was treated as IIF.

### Bosniak II: Calcification Case That Changed from 2005

Thin smooth wall, no septa, calcifications present, water density, no enhancing nodule.

**Result**: Bosniak II, benign cystic mass, no follow-up required.
**Prior 2005 behavior**: thick or nodular calcifications could upgrade the result.

### Not Assigned at CT: MRI Needed

A nonenhancing wall or septum measuring `3 mm` or more, an irregular nonenhancing wall/septum, many (`>=4`) nonenhancing septa, or a protrusion without confirmed enhancement is not forced into Bosniak II. The calculator returns **Not assigned** and recommends renal mass protocol MRI to evaluate for occult enhancement before classification.

### Bosniak IIF

Many `>=4` thin enhancing septa without thick wall, irregular septa, or nodule.

**Result**: Bosniak IIF, probably benign cystic mass, follow-up at 6 months, 12 months, then annually for 5 years.

### Bosniak III

Enhancing smooth wall `>=4 mm` without an enhancing nodule.

**Result**: Bosniak III, indeterminate cystic mass, consider urology consultation.

### Bosniak IV

Enhancing convex protrusion with acute margins, any size.

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
2. Bosniak MA. **The current radiological approach to renal cysts.** Radiology. 2005;236(1):61-70. DOI: [10.1148/radiol.2362040218](https://doi.org/10.1148/radiol.2362040218)
