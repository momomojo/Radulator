# LI-RADS v2018 Comprehensive Research Document

## Executive Summary

The Liver Imaging Reporting and Data System (LI-RADS) version 2018 is a comprehensive standardized system developed by the American College of Radiology (ACR) for the interpretation and reporting of liver imaging in patients at risk for hepatocellular carcinoma (HCC). This document provides the complete specification for implementing a LI-RADS v2018 calculator for the Radulator medical calculator application.

---

## 1. Primary Guidelines and References

### 1.1 Official ACR Documentation

The official LI-RADS v2018 materials are maintained by the ACR:

- **ACR LI-RADS Website**: https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/LI-RADS
- **CT/MRI LI-RADS v2018 Core PDF**: https://www.acr.org/-/media/ACR/Files/RADS/LI-RADS/LI-RADS-2018-Core.pdf

### 1.2 Key Peer-Reviewed References (DOIs)

| # | Citation | DOI |
|---|----------|-----|
| 1 | Chernyak V, Fowler KJ, Kamaya A, et al. Liver Imaging Reporting and Data System (LI-RADS) Version 2018: Imaging of Hepatocellular Carcinoma in At-Risk Patients. Radiology. 2018;289(3):816-830. | [10.1148/radiol.2018181494](https://doi.org/10.1148/radiol.2018181494) |
| 2 | Cerny M, Chernyak V, Olive D, et al. LI-RADS Version 2018 Ancillary Features at MRI. RadioGraphics. 2018;38(7):1973-2001. | [10.1148/rg.2018180052](https://doi.org/10.1148/rg.2018180052) |
| 3 | Kang JH, Choi SH, Lee JS, et al. Interreader Agreement of Liver Imaging Reporting and Data System on MRI: A Systematic Review and Meta-Analysis. J Magn Reson Imaging. 2020;52(3):795-804. | [10.1002/jmri.27065](https://doi.org/10.1002/jmri.27065) |
| 4 | Bae JS, et al. LI-RADS Tumor in Vein at CT and Hepatobiliary MRI. Radiology. 2021;302(1):107-115. | [10.1148/radiol.2021210215](https://doi.org/10.1148/radiol.2021210215) |
| 5 | van der Pol CB, Lim CS, Sirlin CB, et al. Diagnostic Performance of LI-RADS for MRI and CT Detection of HCC: A Systematic Review and Diagnostic Meta-Analysis. Eur J Radiol. 2021;134:109439. | [10.1016/j.ejrad.2020.109439](https://doi.org/10.1016/j.ejrad.2020.109439) |
| 6 | Marrero JA, Kulik LM, Sirlin CB, et al. Diagnosis, Staging, and Management of Hepatocellular Carcinoma: 2018 Practice Guidance by AASLD. Hepatology. 2018;68(2):723-750. | [10.1002/hep.29913](https://doi.org/10.1002/hep.29913) |
| 7 | Fowler KJ, Tang A, Santillan C, et al. Interreader Reliability of LI-RADS Version 2014 Algorithm and Imaging Features for Diagnosis of HCC: A Large International Study. Radiology. 2018;286(1):173-185. | [10.1148/radiol.2017170376](https://doi.org/10.1148/radiol.2017170376) |
| 8 | Lee S, Kim SS, Shin H, et al. LI-RADS Version 2018 Category 5 for Diagnosing Hepatocellular Carcinoma: An Updated Meta-Analysis. Eur Radiol. 2024;34:1410-1422. | [10.1007/s00330-023-10134-z](https://doi.org/10.1007/s00330-023-10134-z) |
| 9 | Ronot M, et al. A Multicenter Assessment of Interreader Reliability of LI-RADS Version 2018 for MRI and CT. Radiology. 2023;307(5):e222855. | [10.1148/radiol.222855](https://doi.org/10.1148/radiol.222855) |
| 10 | Tang A, et al. LI-RADS: a conceptual and historical review from its beginning to its recent integration into AASLD clinical practice guidance. J Hepatocell Carcinoma. 2019;6:23-34. | [10.2147/JHC.S186239](https://doi.org/10.2147/JHC.S186239) |

---

## 2. At-Risk Population Criteria

### 2.1 Inclusion Criteria (Who LI-RADS Applies To)

LI-RADS is applicable to **adult patients (age >= 18 years)** with:

1. **Cirrhosis** (from any cause EXCEPT vascular disorders or congenital hepatic fibrosis)
2. **Chronic hepatitis B viral infection** (even WITHOUT cirrhosis)
3. **Current or prior HCC** (including liver transplant candidates/recipients)

### 2.2 Exclusion Criteria

LI-RADS should NOT be used in:

- Patients younger than 18 years
- Cirrhosis due to **vascular disorders** (e.g., Budd-Chiari syndrome, cardiac cirrhosis)
- Cirrhosis due to **congenital hepatic fibrosis**

**Rationale**: These excluded populations have a high prevalence of hypervascularized benign nodules that reduce the positive predictive value of imaging for HCC diagnosis.

### 2.3 Hepatitis B Specifics (2023/2024 Updated Criteria)

For noncirrhotic chronic hepatitis B patients at risk:
- Males older than 40 years OR females older than 50 years from endemic regions
- Individuals from Africa aged 20 years and older
- Individuals with family history of HCC
- Western populations receiving antiviral therapy with PAGE-B score >= 10

---

## 3. LI-RADS v2018 Category System

### 3.1 Complete Category Definitions

| Category | Name | Definition | HCC Probability |
|----------|------|------------|-----------------|
| **LR-NC** | Not Categorizable | Image omission or degradation precludes adequate evaluation | N/A |
| **LR-1** | Definitely Benign | 100% certainty benign (e.g., simple cyst, hemangioma, focal fat) | 0% |
| **LR-2** | Probably Benign | High probability benign; distinctive nodule <20mm without major HCC features | ~14% |
| **LR-3** | Intermediate Probability | Observations with intermediate probability of malignancy | 38-40% |
| **LR-4** | Probably HCC | Probable HCC, not meeting LR-5 criteria | 67-74% |
| **LR-5** | Definitely HCC | Definite HCC - can be treated without biopsy | 92-95% |
| **LR-M** | Probably/Definitely Malignant (not HCC-specific) | Malignant features but not specific for HCC | 93-100% malignant; 29-44% HCC |
| **LR-TIV** | Tumor in Vein | Definite enhancing soft tissue within a vein | Variable (contraindication to transplant) |

---

## 4. Major Features (Scoring Algorithm)

### 4.1 Definition of Major Features

The five major features used in the LI-RADS diagnostic table are:

#### 4.1.1 Nonrim Arterial Phase Hyperenhancement (APHE)

**Definition**: Nonrim enhancement in the arterial phase that is unequivocally greater than the background liver tissue.

- Reflects tumor angiogenesis (key component of HCC pathogenesis)
- Must be "nonrim" (rim APHE suggests LR-M)
- Can be present in entire lesion or only a portion

#### 4.1.2 Nonperipheral "Washout"

**Definition**: Perceived temporal reduction in enhancement of an observation relative to surrounding liver parenchyma from an earlier to later phase.

**Assessment timing**:
- **Extracellular agents**: Portal venous phase OR delayed phase
- **Gadoxetate disodium (Eovist/Primovist)**: Portal venous phase ONLY (not transitional phase due to hepatocyte uptake)

#### 4.1.3 Enhancing "Capsule"

**Definition**: Uniform, sharp, smooth rim of hyperenhancement around most or all of an observation that is unequivocally thicker or more conspicuous than fibrotic tissue surrounding cirrhosis-related background nodules.

- Assessed on: Portal venous, delayed, or transitional phases
- Can be complete or partial
- Include capsule within measurement of lesion size

#### 4.1.4 Size

**Definition**: Largest outer-edge-to-outer-edge dimension.

**Categories**:
- < 10 mm
- 10-19 mm
- >= 20 mm

**Measurement notes**:
- Include capsule if present
- Measure in phase where border is best defined
- Avoid arterial phase (may include perilesional enhancement)

#### 4.1.5 Threshold Growth

**Definition (v2018 simplified)**: Size increase of **>= 50% in <= 6 months**.

- All other size increases = "subthreshold growth" (ancillary feature)
- New observation >= 10 mm also qualifies as threshold growth

---

## 5. LI-RADS v2018 Diagnostic Table

### 5.1 Observations WITHOUT Arterial Phase Hyperenhancement (APHE)

| Size | No additional major features | One additional major feature | Two or more additional major features |
|------|------------------------------|------------------------------|---------------------------------------|
| < 20 mm | **LR-3** | **LR-3** | **LR-4** |
| >= 20 mm | **LR-3** | **LR-4** | **LR-4** |

*Additional major features = washout, capsule, or threshold growth*

### 5.2 Observations WITH Nonrim Arterial Phase Hyperenhancement (APHE)

| Size | No additional major features | One additional major feature | Two or more additional major features |
|------|------------------------------|------------------------------|---------------------------------------|
| < 10 mm | **LR-3** | **LR-4** | **LR-4** |
| 10-19 mm | **LR-3** | **LR-4** (capsule only) / **LR-5** (washout or growth) | **LR-5** |
| >= 20 mm | **LR-4** | **LR-5** | **LR-5** |

### 5.3 Key v2018 Changes from v2017

1. **Observations 10-19 mm with APHE + washout = LR-5** (previously required US visibility or threshold growth)
2. **Threshold growth simplified**: Only >= 50% in <= 6 months qualifies
3. **Removed LR-5us and LR-5g qualifiers** (simplified nomenclature)

---

## 6. Ancillary Features

### 6.1 Rules for Application

- **Optional** - use at radiologist's discretion
- Can upgrade by **ONE category maximum** (up to LR-4 only; CANNOT upgrade to LR-5)
- Can downgrade by **ONE category maximum**
- If **conflicting features** (malignancy AND benignity): **DO NOT adjust category**

### 6.2 Ancillary Features Favoring Malignancy in General

| Feature | Description |
|---------|-------------|
| US visibility as discrete nodule | Observation visible on prior/concurrent ultrasound |
| Subthreshold growth | Size increase not meeting threshold (< 50% in 6 months) |
| Corona enhancement | Perilesional enhancement in late arterial phase |
| Fat sparing in focal fat | Lesion lacks fat in otherwise fatty liver |
| Restricted diffusion | High signal on DWI, low signal on ADC map |
| Mild-moderate T2 hyperintensity | Higher than liver but lower than fluid |
| Iron sparing in siderotic liver | Lesion lacks iron in iron-overloaded liver |
| Transitional phase hypointensity | Hypointense on transitional phase (gadoxetate) |
| Hepatobiliary phase hypointensity | Hypointense on HBP (gadoxetate/gadobenate) |

### 6.3 Ancillary Features Favoring HCC in Particular

| Feature | Description |
|---------|-------------|
| Nonenhancing "capsule" | T2 hypointense rim around observation |
| Nodule-in-nodule architecture | Smaller nodule within larger nodule |
| Mosaic architecture | Internal compartments with variable appearance |
| Blood products in mass | Intralesional hemorrhage |
| Fat in mass, more than adjacent liver | Intralesional fat |

### 6.4 Ancillary Features Favoring Benignity

| Feature | Description |
|---------|-------------|
| Size stability >= 2 years | No growth over 2+ years of imaging |
| Size reduction | Decrease in size over time |
| Parallels blood pool | Enhancement identical to blood vessels |
| Undistorted vessels | Vessels pass through without displacement |
| Iron in mass, more than liver | Siderotic nodule |
| Marked T2 hyperintensity | Signal intensity similar to fluid/bile |
| Hepatobiliary phase isointensity | Same signal as liver on HBP |

---

## 7. LR-M Category (Non-HCC Malignancy)

### 7.1 Definition

Observations that are **probably or definitely malignant but not specific for HCC**. Includes:
- Atypical HCC
- Intrahepatic cholangiocarcinoma (iCCA)
- Combined hepatocellular-cholangiocarcinoma (cHCC-CCA)
- Metastases

### 7.2 LR-M Criteria (Presence of ANY ONE Qualifies)

#### 7.2.1 Targetoid Features (5 types)

1. **Rim arterial phase hyperenhancement** (APHE with peripheral > central enhancement)
2. **Peripheral washout** (rim of washout around observation)
3. **Delayed central enhancement** (central enhancement on delayed phase)
4. **Targetoid restriction** (peripheral high DWI signal, central low)
5. **Targetoid transitional/HBP appearance** (peripheral hypointensity, central iso/hyperintensity)

#### 7.2.2 Non-targetoid LR-M Features

1. **Infiltrative appearance** - ill-defined margins, irregular shape
2. **Marked diffusion restriction** - very high signal on DWI
3. **Necrosis or severe ischemia** - non-enhancing areas suggesting tumor necrosis
4. **Other features suggesting non-HCC malignancy** - radiologist judgment

### 7.3 Important Notes

- **No minimum size** requirement for LR-M
- Even ONE LR-M feature prompts categorization as LR-M
- LR-M observations typically require **biopsy** for diagnosis

---

## 8. LR-TIV Category (Tumor in Vein)

### 8.1 Definition

Definite tumor invasion of the portal or hepatic veins.

### 8.2 Diagnostic Criteria

**Required criterion**: Unequivocal **enhancing soft tissue within a vein**

### 8.3 Features Suggestive of TIV (FSTIV)

When present, prompt careful vein evaluation but do NOT alone establish LR-TIV:

1. Occluded vein with ill-defined walls
2. Occluded vein with restricted diffusion
3. Occluded or obscured vein in contiguity with malignant parenchymal mass
4. Heterogeneous vein enhancement (not attributable to artifacts)

### 8.4 Differentiating TIV from Bland Thrombus

| Feature | Tumor Thrombus | Bland Thrombus |
|---------|----------------|----------------|
| Enhancement | Present (arterial phase) | Absent |
| Vein expansion | Common | Possible |
| DWI restriction | Often present | May be present if acute |
| Contiguous mass | Often present | Absent |
| Neovascularity | Present | Absent |

### 8.5 Clinical Significance

- **Contraindication to liver transplantation**
- Indicates advanced disease stage
- Associated with poor prognosis

### 8.6 Diagnostic Performance

Per LI-RADS v2018 criterion:
- Sensitivity: 62-93%
- Specificity: 87-100%
- ICC for interobserver agreement: 0.63

---

## 9. Step-by-Step Diagnostic Algorithm

### 9.1 Algorithm Flowchart

```
START
  |
  v
[1] Is patient in LI-RADS population?
    (Cirrhosis, chronic HBV, current/prior HCC)
  |
  No --> Do not use LI-RADS
  |
  Yes
  |
  v
[2] Is study technically adequate?
  |
  No --> LR-NC (Not Categorizable)
  |
  Yes
  |
  v
[3] Is there enhancing soft tissue in vein?
  |
  Yes --> LR-TIV (Tumor in Vein)
  |
  No
  |
  v
[4] Is observation definitely benign?
    (Cyst, hemangioma, focal fat, etc.)
  |
  Yes --> LR-1 (Definitely Benign)
  |
  No
  |
  v
[5] Is observation probably benign?
    (Distinctive nodule <20mm, no major/LR-M features)
  |
  Yes --> LR-2 (Probably Benign)
  |
  No
  |
  v
[6] Does observation have LR-M features?
    (Targetoid or non-targetoid)
  |
  Yes --> LR-M (Malignant, not HCC-specific)
  |
  No
  |
  v
[7] Apply Diagnostic Table
    using major features:
    - APHE (nonrim)
    - Washout (nonperipheral)
    - Capsule (enhancing)
    - Size
    - Threshold growth
  |
  v
  LR-3, LR-4, or LR-5
  |
  v
[8] Apply ancillary features (optional)
    - Upgrade by 1 (max to LR-4)
    - Downgrade by 1
    - Do not adjust if conflicting
  |
  v
FINAL CATEGORY
```

### 9.2 Decision Logic for Diagnostic Table

```javascript
function getLIRADSCategory(hasAPHE, size, hasWashout, hasCapsule, hasThresholdGrowth) {
  // Count additional major features (excluding APHE and size)
  const additionalFeatures = [hasWashout, hasCapsule, hasThresholdGrowth].filter(Boolean).length;

  if (!hasAPHE) {
    // WITHOUT APHE
    if (size < 20) {
      return additionalFeatures >= 2 ? 'LR-4' : 'LR-3';
    } else {
      // >= 20mm
      return additionalFeatures >= 1 ? 'LR-4' : 'LR-3';
    }
  } else {
    // WITH nonrim APHE
    if (size < 10) {
      return additionalFeatures >= 1 ? 'LR-4' : 'LR-3';
    } else if (size >= 10 && size < 20) {
      if (additionalFeatures >= 2) return 'LR-5';
      if (hasWashout || hasThresholdGrowth) return 'LR-5';
      if (hasCapsule && additionalFeatures === 1) return 'LR-4';
      return 'LR-3';
    } else {
      // >= 20mm
      return additionalFeatures >= 1 ? 'LR-5' : 'LR-4';
    }
  }
}
```

---

## 10. Management Recommendations by Category

| Category | Probability of HCC | Recommended Management |
|----------|-------------------|------------------------|
| **LR-1** | 0% | Return to routine surveillance |
| **LR-2** | ~14% | Return to routine surveillance; option for alternate modality |
| **LR-3** | 38-40% | Repeat imaging in 3-6 months (same or alternate modality) |
| **LR-4** | 67-74% | Multidisciplinary discussion; consider biopsy or short-term follow-up |
| **LR-5** | 92-95% | Treat as HCC without biopsy; proceed to staging and treatment planning |
| **LR-M** | 93-100% malignant | Biopsy recommended; multidisciplinary discussion |
| **LR-TIV** | Variable | Advanced stage; contraindication to transplant; multidisciplinary discussion |

---

## 11. OPTN/UNOS Integration

### 11.1 Relationship to Transplant Eligibility

LI-RADS categories generally correspond to OPTN classes but with important differences:

| LI-RADS | OPTN Class | Notes |
|---------|------------|-------|
| LR-1 | OPTN 1 | Definitely benign |
| LR-2 | OPTN 2 | Probably benign |
| LR-3 | OPTN 3 | Indeterminate |
| LR-4 | OPTN 4 | Probable HCC |
| LR-5 | OPTN 5 | Definite HCC |

### 11.2 Key Discrepancies

- **6.1% of LI-RADS v2018 LR-5 observations** do not qualify as OPTN class 5
- OPTN subdivides class 5 by size and treatment status (5A, 5B, 5X, 5T)
- OPTN class 0 (inadequate study) has no LI-RADS equivalent

### 11.3 Clinical Implications

For transplant candidates with LR-5 that doesn't meet OPTN class 5:
- Consider biopsy, OR
- Watch-and-wait for growth to meet OPTN criteria

---

## 12. CT vs MRI Considerations

### 12.1 Technical Requirements

**CT Requirements**:
- Multidetector CT (>= 8 detectors)
- IV contrast with multiphase protocol

**MRI Requirements**:
- 1.5T or 3T magnet
- IV contrast (extracellular or hepatobiliary)

### 12.2 Required Imaging Phases

| Phase | CT | MRI (ECA) | MRI (Gadoxetate) |
|-------|----|-----------|--------------------|
| Unenhanced | Optional* | Required | Required |
| Late arterial | Required | Required | Required |
| Portal venous | Required | Required | Required |
| Delayed (2-5 min) | Required | Required | N/A |
| Transitional (2-5 min) | N/A | N/A | Required |
| Hepatobiliary (15-20 min) | N/A | N/A | Optional** |

*Required post-treatment; **Strongly recommended

### 12.3 Washout Assessment by Contrast Agent

| Contrast Type | Washout Assessment Phase |
|---------------|--------------------------|
| Extracellular agents (CT/MRI) | Portal venous OR delayed phase |
| Gadobenate dimeglumine | Portal venous OR delayed phase |
| Gadoxetate disodium | Portal venous phase ONLY |

**Important**: With gadoxetate, transitional phase hypointensity does NOT count as washout (due to hepatocyte uptake).

### 12.4 Comparative Performance

| Modality | Sensitivity (LR-5) | Specificity (LR-5) |
|----------|-------------------|--------------------|
| CT | 66% | 88% |
| MRI (extracellular) | 77% | 92% |
| MRI (gadoxetate) | 65% | 93% |

---

## 13. Diagnostic Performance (Validation Data)

### 13.1 Meta-Analysis Results (2020-2024)

**LI-RADS >= 3 (all versions)**:
- Pooled sensitivity: 86% (95% CI: 78-91%)
- Pooled specificity: 85% (95% CI: 78-90%)
- AUC: 0.92

**LI-RADS v2018 LR-5**:
- Pooled sensitivity: 66% (95% CI: 61-70%)
- Pooled specificity: 91% (95% CI: 89-93%)

### 13.2 Per-Category HCC Probability

| Category | HCC Probability | Overall Malignancy |
|----------|----------------|-------------------|
| LR-3 | 38-40% | 34-40% |
| LR-4 | 67-74% | 80-81% |
| LR-5 | 92-95% | 97-99% |

### 13.3 Interobserver Agreement

| Feature/Category | Kappa (Cohen's/Fleiss) | Agreement Level |
|------------------|------------------------|-----------------|
| APHE | 0.60-0.75 | Moderate-Substantial |
| Washout | 0.56-0.70 | Moderate-Substantial |
| Capsule | 0.45-0.65 | Moderate |
| Final category | 0.59-0.82 | Moderate-Substantial |
| Overall ICC | 0.68 | Moderate |

---

## 14. Common Pitfalls and Edge Cases

### 14.1 Interpretation Pitfalls

1. **Applying LI-RADS to non-eligible populations**
   - Always verify cirrhosis, chronic HBV, or prior HCC

2. **Misidentifying rim vs. nonrim APHE**
   - Rim APHE = LR-M, not LR-3/4/5

3. **Washout assessment with gadoxetate**
   - Do NOT use transitional phase for washout
   - Only portal venous phase counts

4. **Capsule vs. perilesional fibrosis**
   - Capsule must be thicker than surrounding fibrosis

5. **Including perilesional enhancement in size**
   - Avoid arterial phase for measurement
   - Measure outer-to-outer on portal/delayed phase

### 14.2 Edge Cases

**Case 1: 15mm observation with APHE + capsule only**
- Answer: LR-4 (capsule alone insufficient for LR-5 at 10-19mm)

**Case 2: 15mm observation with APHE + washout**
- Answer: LR-5 (washout sufficient at 10-19mm with APHE)

**Case 3: 25mm observation with APHE, no other features**
- Answer: LR-4 (>= 20mm with APHE but no additional features)

**Case 4: Observation with both malignancy AND benignity ancillary features**
- Answer: Do not adjust category

**Case 5: 8mm observation with APHE + washout + capsule**
- Answer: LR-4 (cannot be LR-5 if < 10mm)

---

## 15. Implementation Considerations for Calculator

### 15.1 Required Input Fields

1. **Patient eligibility** (checkbox/select)
   - Cirrhosis
   - Chronic hepatitis B
   - Current/prior HCC

2. **Study quality** (radio)
   - Adequate
   - Inadequate (LR-NC)

3. **Vein involvement** (radio)
   - No tumor in vein
   - Definite tumor in vein (LR-TIV)

4. **Benign entity** (radio)
   - Observation present (continue)
   - Definitely benign (LR-1)
   - Probably benign (LR-2)

5. **LR-M features** (checkbox group)
   - Rim APHE
   - Targetoid restriction
   - Infiltrative appearance
   - Marked diffusion restriction
   - Necrosis
   - Other non-HCC features

6. **Major features** (for diagnostic table)
   - Nonrim APHE (yes/no)
   - Observation size (number, mm)
   - Nonperipheral washout (yes/no)
   - Enhancing capsule (yes/no)
   - Threshold growth (yes/no)

7. **Ancillary features** (optional, checkbox groups)
   - Favoring malignancy
   - Favoring HCC
   - Favoring benignity

### 15.2 Output Requirements

1. **Primary category** (LR-1 through LR-5, LR-M, LR-TIV, LR-NC)
2. **Category after ancillary adjustment** (if applicable)
3. **HCC probability** (percentage range)
4. **Management recommendation**
5. **Algorithm pathway** (which branch was followed)
6. **Warnings** (if applicable)

### 15.3 Validation Rules

- LR-5 requires observation >= 10mm
- LR-M overrides diagnostic table
- LR-TIV assessed before other categories
- Ancillary features cannot upgrade to LR-5
- Conflicting ancillary features = no adjustment

---

## 16. Warnings and Contraindications

### 16.1 Clinical Warnings

1. **LI-RADS is NOT validated for**:
   - Pediatric patients (< 18 years)
   - Patients without cirrhosis/HBV/prior HCC
   - Vascular causes of cirrhosis

2. **LR-TIV**:
   - Contraindication to liver transplantation
   - Indicates advanced disease

3. **LR-M**:
   - Requires biopsy for definitive diagnosis
   - May represent HCC (29-44%) or other malignancy

4. **LR-5 vs OPTN**:
   - Some LR-5 observations may not meet OPTN class 5
   - Verify OPTN criteria for transplant candidates

### 16.2 Technical Warnings

1. **Contrast-specific washout rules**:
   - Gadoxetate: PVP only for washout
   - Extracellular: PVP or delayed phase

2. **Size measurement**:
   - Include capsule in measurement
   - Avoid arterial phase

---

## 17. References Summary

### Primary Guidelines
1. Chernyak V, et al. Radiology 2018;289(3):816-830. DOI: 10.1148/radiol.2018181494

### Ancillary Features
2. Cerny M, et al. RadioGraphics 2018;38(7):1973-2001. DOI: 10.1148/rg.2018180052

### Interobserver Agreement
3. Kang JH, et al. J Magn Reson Imaging 2020;52(3):795-804. DOI: 10.1002/jmri.27065
4. Ronot M, et al. Radiology 2023;307(5):e222855. DOI: 10.1148/radiol.222855

### Diagnostic Performance
5. van der Pol CB, et al. Eur J Radiol 2021;134:109439. DOI: 10.1016/j.ejrad.2020.109439
6. Lee S, et al. Eur Radiol 2024;34:1410-1422. DOI: 10.1007/s00330-023-10134-z

### AASLD Integration
7. Marrero JA, et al. Hepatology 2018;68(2):723-750. DOI: 10.1002/hep.29913

### Tumor in Vein
8. Bae JS, et al. Radiology 2021;302(1):107-115. DOI: 10.1148/radiol.2021210215

### Historical Review
9. Tang A, et al. J Hepatocell Carcinoma 2019;6:23-34. DOI: 10.2147/JHC.S186239

### Additional Validation
10. Fowler KJ, et al. Radiology 2018;286(1):173-185. DOI: 10.1148/radiol.2017170376

---

## Document Information

- **Version**: 1.0
- **Date Created**: January 24, 2026
- **Author**: Claude (Medical Research Agent)
- **Project**: Radulator LI-RADS Calculator
- **Status**: Ready for implementation

---

*This document is intended for use in developing a medical calculator and should not be used as a substitute for clinical judgment or official LI-RADS guidelines. Always refer to the ACR official documentation for the most current LI-RADS criteria.*
