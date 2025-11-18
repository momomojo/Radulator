# Milan Criteria Calculator Documentation

## Overview

The **Milan Criteria Calculator** is a clinical decision support tool for determining liver transplant eligibility in patients with hepatocellular carcinoma (HCC). It evaluates both the standard **Milan Criteria** (1996) and the expanded **UCSF (University of California San Francisco) Criteria** (2001), providing comprehensive transplant candidacy assessment with evidence-based outcome predictions.

## Calculator ID
- **Component Name**: `MilanCriteria`
- **URL Path**: `/milan-criteria`
- **Category**: Hepatology/Liver
- **Medical Specialty**: Hepatology, Transplant Surgery, Oncology (HCC)

## Clinical Purpose

### Primary Use Cases
1. **Transplant Eligibility Assessment**: Determine if HCC patients meet criteria for liver transplantation
2. **Prognostic Stratification**: Predict post-transplant survival based on tumor burden
3. **Treatment Planning**: Guide therapeutic decisions (transplant vs. alternative treatments)
4. **Multidisciplinary Tumor Board**: Facilitate transplant candidacy discussions
5. **Patient Counseling**: Provide evidence-based outcome expectations
6. **Pre-Transplant Staging**: Document baseline tumor characteristics
7. **Down-Staging Evaluation**: Assess if patients successfully down-staged into criteria

### Clinical Significance

The Milan Criteria represent the **gold standard** for HCC liver transplant selection worldwide. Patients meeting Milan Criteria achieve:
- **>70% 4-year overall survival** (Mazzaferro 1996)
- **83% 5-year recurrence-free survival** (Mazzaferro 2009)
- Survival rates comparable to non-HCC transplant recipients

The UCSF Criteria offer a **modest expansion** while maintaining acceptable outcomes:
- **~75% 5-year overall survival** (Yao 2001)
- Increases transplant access without significantly compromising outcomes

## Criteria Definitions

### Milan Criteria (1996)

**Inclusion Requirements** (ALL must be met):
1. **Tumor Number**: Maximum of 3 tumors
2. **Tumor Size**:
   - Single tumor ≤5 cm diameter, OR
   - 2-3 tumors, each ≤3 cm diameter
3. **Macrovascular Invasion**: None
4. **Extrahepatic Disease**: None

### UCSF Criteria (2001)

**Inclusion Requirements** (ALL must be met):
1. **Tumor Number**: Maximum of 3 tumors
2. **Tumor Size**:
   - Single tumor ≤6.5 cm diameter, OR
   - 2-3 tumors with:
     - Largest tumor ≤4.5 cm diameter, AND
     - Total tumor diameter ≤8 cm
3. **Macrovascular Invasion**: None
4. **Extrahepatic Disease**: None

### Absolute Contraindications (Both Criteria)
- **Macrovascular Invasion**: Portal vein, hepatic vein, or IVC involvement
- **Extrahepatic Disease**: Lymph node metastases or distant metastases
- **Unknown Status**: Patients with unknown invasion/disease status require further workup

## Input Parameters

### 1. Number of Tumors
- **Type**: Dropdown select
- **Options**:
  - 1
  - 2
  - 3
  - 4 or more
- **Required**: Yes
- **Clinical Notes**:
  - Based on cross-sectional imaging (CT/MRI) or explant pathology
  - Count discrete nodules meeting HCC imaging criteria (LIRADS 5 or pathology-proven)
  - Satellite nodules count as separate tumors

### 2. Largest Tumor Diameter (cm)
- **Type**: Numeric input
- **Units**: Centimeters (cm)
- **Required**: Yes
- **Range**: >0 cm (no upper limit in calculator)
- **Clinical Notes**:
  - Measure maximum axial diameter on cross-sectional imaging
  - Use arterial phase measurements for hypervascular HCC
  - For multiple sequences, use largest measurement
  - Include viable tumor only (exclude necrotic areas)

### 3. Second Tumor Diameter (cm)
- **Type**: Numeric input (conditional)
- **Units**: Centimeters (cm)
- **Required**: When tumor count is 2 or 3
- **Visibility**: Only shown when "Number of Tumors" is 2 or 3
- **Clinical Notes**:
  - Enter size of second-largest tumor
  - Measure independently, not as aggregate diameter

### 4. Third Tumor Diameter (cm)
- **Type**: Numeric input (conditional)
- **Units**: Centimeters (cm)
- **Required**: When tumor count is 3
- **Visibility**: Only shown when "Number of Tumors" is 3
- **Clinical Notes**:
  - Enter size of third tumor
  - All three tumors contribute to UCSF total diameter calculation

### 5. Macrovascular Invasion
- **Type**: Radio button group
- **Options**:
  - **No**: No evidence of vascular invasion
  - **Yes**: Confirmed macrovascular invasion (absolute contraindication)
  - **Unknown**: Status not determined (requires further workup)
- **Required**: Yes
- **Clinical Notes**:
  - Assess portal vein, hepatic veins, IVC on multiphasic CT/MRI
  - Tumor thrombus with arterial enhancement is highly suspicious
  - Microscopic vascular invasion (MVI) on biopsy does NOT exclude transplant
  - Unknown status requires dedicated vascular imaging

### 6. Extrahepatic Disease
- **Type**: Radio button group
- **Options**:
  - **No**: No evidence of extrahepatic disease
  - **Yes**: Confirmed metastases (absolute contraindication)
  - **Unknown**: Status not determined (requires further workup)
- **Required**: Yes
- **Clinical Notes**:
  - Assess regional lymph nodes (celiac, portocaval, porta hepatis)
  - Screen for distant metastases (lungs, bones, adrenals)
  - CT chest/abdomen/pelvis typically sufficient
  - PET/CT not routinely recommended but may help in borderline cases

## Calculation Logic

### Patient Summary Calculations

1. **Total Tumor Diameter** (for multiple tumors):
   - Sum of all tumor diameters
   - Used for UCSF criteria evaluation
   - Displayed only when tumor count ≥2

2. **Largest Tumor Diameter**:
   - Maximum of all entered tumor sizes
   - Primary determinant for both criteria

### Milan Criteria Evaluation

**Algorithm**:
```
IF macrovascular invasion = "yes" OR extrahepatic disease = "yes":
    Result = BEYOND (absolute contraindication)

ELSE IF macrovascular invasion = "unknown" OR extrahepatic disease = "unknown":
    Result = INDETERMINATE (requires workup)

ELSE IF tumor count = 1:
    IF largest tumor ≤5 cm:
        Result = WITHIN
    ELSE:
        Result = BEYOND

ELSE IF tumor count = 2 OR 3:
    IF all tumors ≤3 cm:
        Result = WITHIN
    ELSE:
        Result = BEYOND

ELSE (tumor count ≥4):
    Result = BEYOND
```

### UCSF Criteria Evaluation

**Algorithm**:
```
IF macrovascular invasion = "yes" OR extrahepatic disease = "yes":
    Result = BEYOND (absolute contraindication)

ELSE IF macrovascular invasion = "unknown" OR extrahepatic disease = "unknown":
    Result = INDETERMINATE (requires workup)

ELSE IF tumor count = 1:
    IF largest tumor ≤6.5 cm:
        Result = WITHIN
    ELSE:
        Result = BEYOND

ELSE IF tumor count = 2 OR 3:
    IF largest tumor ≤4.5 cm AND total diameter ≤8 cm:
        Result = WITHIN
    ELSE IF largest tumor >4.5 cm:
        Result = BEYOND (largest exceeds limit)
    ELSE:
        Result = BEYOND (total exceeds limit)

ELSE (tumor count ≥4):
    Result = BEYOND
```

### Transplant Eligibility Determination

**Final Assessment Logic**:
```
IF Milan = WITHIN:
    Eligibility = "ELIGIBLE - Meets Milan Criteria (standard)"
    Expected Outcome = Excellent prognosis (>70% 4-year survival)

ELSE IF UCSF = WITHIN:
    Eligibility = "ELIGIBLE - Meets UCSF Criteria (expanded)"
    Expected Outcome = Good prognosis (~75% 5-year survival)

ELSE IF any status = "unknown":
    Eligibility = "INDETERMINATE - Further diagnostic workup required"
    Expected Outcome = Cannot determine until workup complete

ELSE:
    Eligibility = "NOT ELIGIBLE - Beyond both Milan and UCSF criteria"
    Expected Outcome = Consider alternatives (ablation, TACE, systemic therapy)
```

## Output & Interpretation

### Displayed Results

#### 1. Patient Tumor Summary
- **Number of Tumors**: Echo of input (1, 2, 3, or "4 or more")
- **Largest Tumor Diameter**: Formatted to 1 decimal place (e.g., "4.5 cm")
- **Total Tumor Diameter**: Sum of all tumors (displayed only if count ≥2)
- **Macrovascular Invasion**: Capitalized status (No/Yes/Unknown)
- **Extrahepatic Disease**: Capitalized status (No/Yes/Unknown)

#### 2. Milan Criteria Assessment
- **Milan Criteria**: "WITHIN CRITERIA" or "BEYOND CRITERIA"
- **Milan Details**: Specific reason for determination
  - Examples:
    - "Single tumor 4.5 cm (≤5 cm required)"
    - "2 tumors, largest 2.8 cm (each ≤3 cm required)"
    - "Single tumor 6.0 cm exceeds 5 cm limit"
    - "Macrovascular invasion present (absolute contraindication)"

#### 3. UCSF Criteria Assessment
- **UCSF Criteria**: "WITHIN CRITERIA" or "BEYOND CRITERIA"
- **UCSF Details**: Specific reason for determination
  - Examples:
    - "Single tumor 6.0 cm (≤6.5 cm required)"
    - "3 tumors, largest 4.0 cm, total 7.5 cm (largest ≤4.5 cm and total ≤8 cm required)"
    - "3 tumors, total diameter 8.5 cm exceeds 8 cm limit"

#### 4. Final Transplant Eligibility
- **Transplant Eligibility**: Overall candidacy determination
  - "ELIGIBLE - Meets Milan Criteria (standard)"
  - "ELIGIBLE - Meets UCSF Criteria (expanded)"
  - "INDETERMINATE - Further diagnostic workup required"
  - "NOT ELIGIBLE - Beyond both Milan and UCSF criteria"

#### 5. Expected Outcomes
- **Evidence-Based Prognosis**: Specific survival data based on eligibility
  - **Milan-eligible**: "Expected 4-year survival >70% (Mazzaferro 1996), 5-year recurrence-free survival 83% (Mazzaferro 2009 validation)"
  - **UCSF-eligible**: "Expected 5-year survival ~75% (Yao 2001), though not meeting standard Milan criteria"
  - **Indeterminate**: "Cannot determine eligibility until vascular invasion and extrahepatic disease status are clarified"
  - **Not eligible**: "Consider alternative treatments (ablation, TACE, systemic therapy). Down-staging protocols may be available at some centers."

## Clinical Scenarios & Examples

### Scenario 1: WITHIN Milan Criteria
**Patient**: Single 4.5 cm HCC, no invasion/metastases
- **Milan**: WITHIN (single ≤5 cm)
- **UCSF**: WITHIN (single ≤6.5 cm)
- **Eligibility**: ELIGIBLE - Meets Milan Criteria
- **Management**: Proceed with transplant evaluation

### Scenario 2: BEYOND Milan, WITHIN UCSF
**Patient**: Single 6.0 cm HCC, no invasion/metastases
- **Milan**: BEYOND (6.0 cm exceeds 5 cm limit)
- **UCSF**: WITHIN (6.0 cm ≤6.5 cm)
- **Eligibility**: ELIGIBLE - Meets UCSF Criteria
- **Management**: Some centers may list under UCSF expansion; outcomes still favorable

### Scenario 3: Multiple Tumors WITHIN Milan
**Patient**: 2 tumors (2.8 cm and 2.5 cm), no invasion/metastases
- **Milan**: WITHIN (2 tumors, both ≤3 cm)
- **UCSF**: WITHIN (largest 2.8 cm ≤4.5 cm, total 5.3 cm ≤8 cm)
- **Eligibility**: ELIGIBLE - Meets Milan Criteria
- **Management**: Excellent transplant candidate

### Scenario 4: Multiple Tumors BEYOND Milan, WITHIN UCSF
**Patient**: 3 tumors (4.0 cm, 3.5 cm, 0.5 cm), no invasion/metastases
- **Milan**: BEYOND (largest 4.0 cm exceeds 3 cm limit)
- **UCSF**: WITHIN (largest 4.0 cm ≤4.5 cm, total 8.0 cm ≤8 cm)
- **Eligibility**: ELIGIBLE - Meets UCSF Criteria
- **Management**: Consider UCSF-accepting centers

### Scenario 5: BEYOND Both Criteria - Tumor Number
**Patient**: 4 HCC nodules (all <3 cm), no invasion/metastases
- **Milan**: BEYOND (4 tumors exceeds limit of 3)
- **UCSF**: BEYOND (4 tumors exceeds limit of 3)
- **Eligibility**: NOT ELIGIBLE
- **Management**: Consider down-staging with locoregional therapy, then reassess

### Scenario 6: BEYOND Both Criteria - Size Excess
**Patient**: 3 tumors (5.0 cm, 3.0 cm, 1.5 cm), no invasion/metastases
- **Milan**: BEYOND (largest 5.0 cm exceeds 3 cm limit for multiple tumors)
- **UCSF**: BEYOND (largest 5.0 cm exceeds 4.5 cm limit, total 9.5 cm exceeds 8 cm)
- **Eligibility**: NOT ELIGIBLE
- **Management**: Alternative treatments or down-staging protocols

### Scenario 7: Absolute Contraindication - Vascular Invasion
**Patient**: Single 3.0 cm HCC with portal vein tumor thrombus
- **Milan**: BEYOND (macrovascular invasion present)
- **UCSF**: BEYOND (macrovascular invasion present)
- **Eligibility**: NOT ELIGIBLE
- **Management**: Transplant contraindicated; consider systemic therapy

### Scenario 8: Indeterminate - Unknown Status
**Patient**: Single 4.0 cm HCC, vascular invasion status unclear on imaging
- **Milan**: INDETERMINATE (requires workup)
- **UCSF**: INDETERMINATE (requires workup)
- **Eligibility**: INDETERMINATE
- **Management**: Obtain dedicated vascular imaging (MRI with hepatobiliary contrast) or staging laparoscopy

### Scenario 9: Edge Case - UCSF Boundary
**Patient**: Single tumor exactly 6.5 cm, no invasion/metastases
- **Milan**: BEYOND (6.5 cm exceeds 5 cm)
- **UCSF**: WITHIN (6.5 cm meets ≤6.5 cm criterion)
- **Eligibility**: ELIGIBLE - Meets UCSF Criteria
- **Management**: Acceptable under UCSF expansion

### Scenario 10: Edge Case - Total Diameter Limit
**Patient**: 3 tumors (4.0 cm, 3.0 cm, 1.5 cm = 8.5 cm total)
- **Milan**: BEYOND (largest 4.0 cm exceeds 3 cm)
- **UCSF**: BEYOND (total 8.5 cm exceeds 8 cm limit)
- **Eligibility**: NOT ELIGIBLE
- **Management**: Close but exceeds UCSF; down-staging may be considered

## Validation & Error Handling

### Required Field Validation
1. **Tumor Count**: Must select from dropdown (error: "Please select the number of tumors")
2. **Largest Tumor**: Must enter positive value (error: "Please enter the largest tumor diameter")
3. **Second Tumor**: Required when count = 2 or 3 (error: "Please enter the second tumor diameter")
4. **Third Tumor**: Required when count = 3 (error: "Please enter the third tumor diameter")
5. **Macrovascular Invasion**: Must select radio option (error: "Please specify macrovascular invasion status")
6. **Extrahepatic Disease**: Must select radio option (error: "Please specify extrahepatic disease status")

### Input Validation Rules
- All tumor sizes must be >0 cm
- Numeric inputs only accept valid decimal numbers
- No upper limit on tumor size (allows documentation of very large tumors)
- Conditional fields automatically hide/show based on tumor count

### Edge Case Handling
- **Exactly at boundary** (e.g., 5.0 cm, 3.0 cm, 6.5 cm): Treated as WITHIN criteria (≤ operator)
- **Very small tumors** (e.g., 0.1 cm): Accepted but clinically may not meet HCC diagnosis criteria
- **Very large tumors** (e.g., >15 cm): Calculated correctly as BEYOND but prompts alternative treatment
- **Unknown status**: Explicitly handled as INDETERMINATE rather than defaulting to eligible/ineligible

## Clinical Considerations

### Important Notes for Clinicians

1. **Imaging Modality**:
   - Criteria based on cross-sectional imaging (CT/MRI), not ultrasound
   - Pre-transplant imaging may underestimate or overestimate true pathologic burden
   - Up to 20-30% discordance between imaging and explant pathology

2. **Radiologic-Pathologic Correlation**:
   - Some centers use **pathologic Milan** (explant findings) vs. **radiologic Milan** (pre-transplant imaging)
   - Radiologic Milan for listing decisions; pathologic Milan affects outcomes reporting

3. **Down-Staging**:
   - Patients initially beyond criteria may be down-staged with locoregional therapy (TACE, TARE, ablation)
   - Successful down-staging into Milan/UCSF may restore transplant eligibility
   - Requires stable disease for ≥3-6 months post-treatment

4. **AFP Consideration**:
   - Milan/UCSF criteria do NOT include AFP (alpha-fetoprotein)
   - Some centers use **Extended Criteria** incorporating AFP (e.g., "All-Comers" with AFP <1000 ng/mL)
   - Very high AFP (>1000 ng/mL) associated with worse outcomes even within Milan

5. **Bridging Therapy**:
   - Patients within criteria may undergo bridging therapy while awaiting transplant
   - Prevents tumor progression beyond criteria during wait time
   - TACE, TARE, ablation commonly used

6. **Expanded Criteria Beyond UCSF**:
   - Multiple institutions have proposed further expansions (Toronto, Hangzhou, Up-to-Seven)
   - Not universally accepted; outcomes vary by center
   - UCSF remains most widely validated expansion

7. **Listing vs. Transplant Criteria**:
   - Milan/UCSF typically used for **listing** decisions
   - Some jurisdictions require meeting criteria at time of **transplant** as well
   - Disease progression while on waitlist may result in delisting

## QA Test Coverage

### Test Data Scenarios

The Playwright test suite (`milan-criteria.spec.js`) covers:

1. **Visual & Theme**:
   - Calculator styling and card layout
   - Responsive mobile design (375px width)
   - Info section visibility and content
   - Consistent theme with other calculators

2. **Professional Appearance**:
   - All required input fields present
   - Conditional field display (2nd/3rd tumor based on count)
   - Helpful sublabels and guidance text
   - Proper radio button groups

3. **Citation Verification**:
   - All 4 reference links present
   - Correct PubMed URLs (with noted errors)
   - Links open in new tab with security attributes

4. **Clinical Accuracy** (12 scenarios):
   - Within Milan: Single 4.5 cm
   - Beyond Milan, Within UCSF: Single 6.0 cm
   - Within Milan: 2 tumors (2.8, 2.5 cm)
   - Beyond Milan, Within UCSF: 3 tumors (4.0, 3.5, 0.5 cm)
   - Beyond both: 4+ tumors
   - Beyond both: Macrovascular invasion
   - Beyond both: Extrahepatic disease
   - Indeterminate: Unknown vascular invasion
   - Indeterminate: Unknown extrahepatic disease
   - Edge case: Exactly 6.5 cm (UCSF boundary)
   - Beyond UCSF: Total diameter >8 cm

5. **Validation & Errors**:
   - Missing tumor count
   - Missing largest tumor size
   - Missing second tumor (when required)
   - Missing third tumor (when required)
   - Missing vascular invasion status
   - Missing extrahepatic disease status

6. **Expected Outcomes**:
   - Milan-eligible prognosis (>70% 4-year survival)
   - UCSF-eligible prognosis (~75% 5-year survival)
   - Alternative treatment suggestions for ineligible
   - Workup recommendations for unknown status

7. **Results Display**:
   - Comprehensive results with proper sections
   - Tumor size formatting (1 decimal place)
   - Status capitalization
   - Section separators (empty string keys)

8. **Accessibility**:
   - ARIA labels and roles
   - Keyboard navigation

## Known Issues & Corrections Needed

### Citation Errors (Identified During QA)

**Issue 1: Yao et al. 2001 - Incorrect PMID**
- **Current**: PMID 11923664 (points to unrelated 2002 spine surgery paper)
- **Correct**: PMID 11391528
- **Correct Journal**: Hepatology (NOT Transplantation)
- **Correct Citation**: Yao FY et al. Hepatology 2001;33(6):1394-403

**Issue 2: Duffy et al. 2007 - Incorrect PMID**
- **Current**: PMID 17435545 (points to unrelated 2007 surgical training paper)
- **Correct**: PMID 17717454
- **Correct Citation**: Duffy JP et al. Ann Surg 2007;246(3):502-9

**Recommendation**: Update `MilanCriteria.jsx` refs array with corrected PMIDs before production deployment.

## References & Evidence Base

### Primary Literature (Corrected)

1. **Mazzaferro V et al. N Engl J Med 1996;334:693-9 (PMID: 8594428)** ✓ CORRECT
   - Original Milan Criteria establishment
   - 48 patients, 4-year survival 75%, recurrence-free survival 83%

2. **Yao FY et al. Hepatology 2001;33(6):1394-403 (PMID: 11391528)** ⚠️ NEEDS CORRECTION
   - UCSF expanded criteria
   - 70 patients, 5-year survival 75.2%

3. **Mazzaferro V et al. Lancet Oncol 2009;10:35-43 (PMID: 19058754)** ✓ CORRECT
   - Milan criteria validation study
   - 1,556 patients from 36 centers
   - 5-year recurrence-free survival 83%

4. **Duffy JP et al. Ann Surg 2007;246(3):502-9 (PMID: 17717454)** ⚠️ NEEDS CORRECTION
   - UCLA 22-year experience comparing Milan vs UCSF
   - 467 patients

### Additional Key References (Not Currently Cited)

5. **Mazzaferro V et al. Liver Transpl 2011;17:872-84 (PMID: 21648008)**
   - "Up-to-Seven" criteria (tumor number + largest diameter ≤7)

6. **Sapisochin G et al. Ann Surg 2014;259:814-21 (PMID: 24096756)**
   - Extended criteria with AFP consideration

7. **Mehta N et al. Hepatology 2018;68:2069-2080 (PMID: 30575095)**
   - Successful down-staging as exception criteria

## Technical Implementation

### Component Architecture
- **File**: `src/components/calculators/MilanCriteria.jsx`
- **Export**: Named export `MilanCriteria`
- **Type**: Static calculator definition object (not a React component)

### Field Types Used
- **select**: Tumor count dropdown
- **number**: Tumor size inputs (conditional visibility via `showIf`)
- **radio**: Macrovascular invasion and extrahepatic disease (3 options each)

### State Management
- Managed by parent `App.jsx` via `vals` state object
- No local component state required
- Generic `Field` renderer handles all input types

### Styling
- Uses Tailwind CSS utility classes
- shadcn/ui Card component for container
- shadcn/ui Input, Label components for form fields
- Responsive grid layout (2 columns on md+ breakpoints)

### Accessibility Features
- Semantic HTML with proper labels
- Radio button groups with name attributes
- Conditional field visibility doesn't break tab order
- Results displayed in accessible `<section>` with `aria-live="polite"`

## Changelog

### Version 1.0 (Initial Release)
- Comprehensive Milan and UCSF criteria evaluation
- Conditional field display based on tumor count
- Three-tier outcome classification (ELIGIBLE/INDETERMINATE/NOT ELIGIBLE)
- Evidence-based survival predictions
- Clinical management recommendations
- Robust validation and error handling
- Four peer-reviewed references (2 require PMID correction)

## Future Enhancements (Proposed)

1. **AFP Integration**: Optional AFP field with extended criteria evaluation
2. **Down-Staging Calculator**: Track pre/post-treatment measurements
3. **Waitlist Monitoring**: Serial assessments with progression detection
4. **Explant Correlation**: Compare radiologic vs pathologic findings
5. **Regional Variations**: MELD exception points calculator (US-specific)
6. **Alternative Criteria**: Toggle for Up-to-Seven, Hangzhou, Toronto criteria
7. **Treatment Suggestions**: Specific TACE/TARE/ablation protocol recommendations based on burden
8. **Citation Corrections**: Update PMIDs 11923664→11391528 and 17435545→17717454

---

**Document Version**: 1.0
**Last Updated**: November 17, 2025
**Reviewed By**: QA Testing (Comprehensive Playwright Test Suite)
**Status**: Production-ready pending citation corrections
