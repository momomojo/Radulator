# ALBI Score Calculator Documentation

## Overview

The **ALBI (Albumin-Bilirubin) Score** calculator is a medical tool for assessing liver function severity in patients with hepatocellular carcinoma (HCC). It provides an objective, evidence-based grading system using only two readily available laboratory values: serum albumin and total bilirubin.

## Calculator ID
- **Component Name**: `ALBIScore`
- **URL Path**: `/albi-score`
- **Category**: Hepatology/Liver
- **Medical Specialty**: Hepatology, Oncology (HCC)

## Clinical Purpose

### Primary Use Cases
1. **Liver Function Assessment**: Objective evaluation of hepatic reserve in HCC patients
2. **Prognostic Stratification**: Source-defined liver-function risk grouping in studied cohorts
3. **Research Stratification**: An objective albumin/bilirubin measure for cohort description

ALBI does not include tumor burden and does not determine treatment eligibility for an individual patient.

### Advantages Over Child-Pugh Classification
- **More Objective**: Uses only laboratory values (no subjective assessments like ascites or encephalopathy)
- **Discrimination**: Performed at least as well as Child-Pugh across the original study cohorts
- **Simpler**: Requires only 2 parameters vs 5 for Child-Pugh
- **Continuous Scale**: Provides a continuous score rather than categorical staging
- **Validated**: Extensively validated across multiple HCC cohorts and treatment modalities

## Formula & Calculation

### Mathematical Formula
```
ALBI Score = (log₁₀ bilirubin [μmol/L] × 0.66) + (albumin [g/L] × −0.085)
```

### Grading Criteria
- **Grade 1**: ALBI Score ≤ −2.60 (source-defined lowest-risk group)
- **Grade 2**: ALBI Score > −2.60 to ≤ −1.39 (source-defined intermediate-risk group)
- **Grade 3**: ALBI Score > −1.39 (source-defined highest-risk group)

### Unit Conversions
The calculator supports both SI and US unit systems:

#### Bilirubin Conversion
- **SI Units**: μmol/L (micromoles per liter)
- **US Units**: mg/dL (milligrams per deciliter)
- **Conversion**: mg/dL × 17.104 = μmol/L

#### Albumin Conversion
- **SI Units**: g/L (grams per liter)
- **US Units**: g/dL (grams per deciliter)
- **Conversion**: g/dL × 10 = g/L

## Input Parameters

### 1. Unit System Selection
- **Type**: Radio button group
- **Options**:
  - SI units (μmol/L, g/L)
  - US units (mg/dL, g/dL)
- **Purpose**: Determines input/display unit system
- **Required**: Explicitly select SI or US before calculating. Switching units
  changes the interpretation of the entered numbers, not the numbers themselves,
  and clears the previous result. The pure core's omitted-unit SI compatibility
  default is not a browser default.

### 2. Serum Albumin
- **Type**: Numeric input
- **Units**: g/L (SI) or g/dL (US)
- **Application review interval (not an eligibility boundary)**:
  - SI: 5-60 g/L
  - US: 0.5-6.0 g/dL
- **Step**: 0.1
- **Validation**: Must be positive and finite. Outside the application review
  interval, valid arithmetic returns a numerical grade with an input-check
  warning, not a physiological-range error.
- **Clinical Notes**:
  - Normal range: 35-50 g/L (3.5-5.0 g/dL)
  - Hypoalbuminemia indicates impaired hepatic synthetic function

### 3. Total Bilirubin
- **Type**: Numeric input
- **Units**: μmol/L (SI) or mg/dL (US)
- **Application review interval (not an eligibility boundary)**:
  - SI: 1-1000 μmol/L
  - US: approximately 0.0585–58.466 mg/dL; review is evaluated after full-precision SI conversion
- **Step**: 0.1
- **Validation**: Must be positive and finite. Outside the application review
  interval, valid arithmetic returns a numerical grade with an input-check
  warning, not a physiological-range error.
- **Clinical Notes**:
  - Normal range: 5-20 μmol/L (0.3-1.2 mg/dL)
  - Hyperbilirubinemia indicates impaired hepatic excretory function

## Output & Interpretation

### Displayed Results

#### 1. ALBI Score
- **Format**: Decimal number to 3 decimal places (e.g., -2.740)
- **Range**: Typically -4.0 to 0.0 (more negative = better function)

#### 2. ALBI Grade
- **Format**: "Grade 1", "Grade 2", or "Grade 3"
- **Clinical Significance**:
  - **Grade 1**: Source-defined lowest-risk group
  - **Grade 2**: Source-defined intermediate-risk group
  - **Grade 3**: Source-defined highest-risk group

#### 3. Interpretation
Provides grade-specific interpretation:
- **Grade 1**: "Lowest-risk group in the original ALBI model"
- **Grade 2**: "Intermediate-risk group in the original ALBI model"
- **Grade 3**: "Highest-risk group in the original ALBI model"

#### 4. Clinical Context
Grade-specific output restates the source-defined interval and explains that ALBI describes liver-function prognosis in studied cohorts. It does not provide a cohort-independent survival estimate or determine treatment eligibility for an individual patient.

#### 5. Converted Values (US units only)
When US units are selected, displays SI conversions:
- Converted Bilirubin (SI): X.X μmol/L
- Converted Albumin (SI): X.X g/L
- Note: "Calculation performed using SI units (shown above)"

## Validation & Error Handling

### Input Validation
1. **Valid Numbers**: Both measurements must be positive finite numbers or complete
   decimal numeric strings. Blank, malformed, zero, negative and non-finite
   inputs fail. Converted SI values and the resulting score must also be finite;
   converted measurements must remain positive.
2. **Application Review Warning**: Albumin outside 5–60 g/L or bilirubin outside
   1–1000 μmol/L triggers a warning, with inclusive endpoints. These software
   review intervals are not physiological limits or validated model boundaries.
   The numerical score and grade remain available when arithmetic is valid;
   computability alone does not establish clinical applicability.
3. **Explicit Units**: The browser requires SI or US selection. It does not infer
   units or silently convert entered numbers when the selection changes.
4. **Report**: The warning identifies entered values/units and SI conversions,
   asks for laboratory-report verification, and accompanies copy/print output.
   Converted display values use one decimal place; calculation and grading use
   the full-precision values. Warning-bearing Grade 1 reports are not styled as
   an unqualified green success.

### Error Messages
- "Please enter valid positive values for albumin and bilirubin."
- "Select SI or US units before calculating."
- "The entered values cannot produce a finite ALBI calculation in the selected units. Check the laboratory report and units."

## Test Cases

### Standard Test Cases

#### Test 1: Grade 1 - Source-Defined Lowest-Risk Group
- **Input**: Albumin 40 g/L, Bilirubin 10 μmol/L (SI units)
- **Expected ALBI Score**: -2.740
- **Expected Grade**: Grade 1
- **Interpretation**: Lowest-risk group in the original ALBI model

#### Test 2: Grade 2 - Source-Defined Intermediate-Risk Group
- **Input**: Albumin 35 g/L, Bilirubin 17 μmol/L (SI units)
- **Expected ALBI Score**: -2.163
- **Expected Grade**: Grade 2
- **Interpretation**: Intermediate-risk group in the original ALBI model

#### Test 3: Grade 3 - Source-Defined Highest-Risk Group
- **Input**: Albumin 25 g/L, Bilirubin 50 μmol/L (SI units)
- **Expected ALBI Score**: -1.004
- **Expected Grade**: Grade 3
- **Interpretation**: Highest-risk group in the original ALBI model

#### Test 4: US Units - Grade 1
- **Input**: Albumin 4.0 g/dL, Bilirubin 0.5 mg/dL (US units)
- **Converted**: Albumin 40 g/L, Bilirubin 8.55 μmol/L
- **Expected ALBI Score**: -2.785
- **Expected Grade**: Grade 1

#### Test 5: US Units - Grade 2
- **Input**: Albumin 3.5 g/dL, Bilirubin 1.0 mg/dL (US units)
- **Converted**: Albumin 35 g/L, Bilirubin 17.1 μmol/L
- **Expected ALBI Score**: -2.161
- **Expected Grade**: Grade 2

### Boundary Test Cases

#### Test 6: Grade 1/2 Boundary
- **Input**: Albumin 38.35294117647059 g/L, Bilirubin 10 μmol/L
- **Expected ALBI Score**: -2.600 (exact inclusive boundary)
- **Expected Grade**: Grade 1

#### Test 7: Grade 2/3 Boundary
- **Input**: Albumin 24.11764705882353 g/L, Bilirubin 10 μmol/L
- **Expected ALBI Score**: -1.390 (exact inclusive boundary)
- **Expected Grade**: Grade 2

### Edge Cases

#### Test 8: Very High Bilirubin
- **Input**: Albumin 30 g/L, Bilirubin 500 μmol/L (severe cholestasis)
- **Expected**: Valid calculation, Grade 3

#### Test 9: Very Low Albumin
- **Input**: Albumin 15 g/L, Bilirubin 50 μmol/L (severe hypoalbuminemia)
- **Expected**: Valid calculation, Grade 3

#### Test 10: High Precision
- **Input**: Albumin 37.8 g/L, Bilirubin 12.3 μmol/L
- **Expected**: Precise calculation with 3 decimal places

### Error Test Cases

#### Test 11: Zero Albumin
- **Input**: Albumin 0, Bilirubin 20
- **Expected**: Error message about positive values

#### Test 12: Negative Bilirubin
- **Input**: Albumin 40, Bilirubin -10
- **Expected**: Error message about positive values

#### Test 13: Outside Application Review Interval — High
- **Input**: Albumin 100 g/L, Bilirubin 20 μmol/L
- **Expected**: Numerical score/grade plus input-check warning; not a claim of validated applicability

#### Test 14: Outside Application Review Interval — Low
- **Input**: Albumin 3 g/L, Bilirubin 20 μmol/L
- **Expected**: Numerical score/grade plus input-check warning; not a claim of validated applicability

## Clinical References

### Primary Reference
**Johnson PJ, Berhane S, Kagebayashi C, et al.**
*Assessment of liver function in patients with hepatocellular carcinoma: a new evidence-based approach-the ALBI grade.*
J Clin Oncol. 2015;33(6):550-558.
DOI: [10.1200/JCO.2014.57.9151](https://doi.org/10.1200/JCO.2014.57.9151)

**Key Findings**:
- Developed from 1,313 Japanese HCC patients
- Tested in additional geographic, resection, and sorafenib cohorts and in chronic liver disease without HCC
- Printed equation coefficients: bilirubin 0.66 and albumin −0.085 in the stated SI units
- Printed grade intervals: ≤−2.60, >−2.60 to ≤−1.39, and >−1.39
- Performed at least as well as Child-Pugh across the original study cohorts

### Validation Studies

#### TACE Outcomes
**Ho SY, Liu PH, Hsu CY, et al.**
*Prognostic role of noninvasive liver reserve markers in patients with hepatocellular carcinoma undergoing transarterial chemoembolization.*
PLoS One. 2017;12(7):e0180408.
DOI: [10.1371/journal.pone.0180408](https://doi.org/10.1371/journal.pone.0180408)

**Key Findings**:
- ALBI grade predicts outcomes after TACE
- Better discrimination than Child-Pugh for intermediate-stage HCC

#### Japanese Cohort Validation
**Hiraoka A, Kumada T, Michitaka K, et al.**
*Usefulness of albumin-bilirubin grade for evaluation of prognosis of 2584 Japanese patients with hepatocellular carcinoma.*
J Gastroenterol Hepatol. 2016;31(5):1031-1036.
DOI: [10.1111/jgh.13250](https://doi.org/10.1111/jgh.13250)

**Key Findings**:
- Validated in 2,584 Japanese HCC patients
- Confirmed prognostic value across BCLC stages
- ALBI grade independently predicted survival

#### BCLC Substratification
**Pinato DJ, Sharma R, Allara E, et al.**
*The ALBI grade provides objective hepatic reserve estimation across each BCLC stage of hepatocellular carcinoma.*
J Hepatol. 2017;66(2):338-346.
DOI: [10.1016/j.jhep.2016.09.008](https://doi.org/10.1016/j.jhep.2016.09.008)

**Key Findings**:
- ALBI grade subdivides each BCLC stage into prognostically distinct groups
- Particularly useful for BCLC Stage B substratification
- This prognostic research does not supply a treatment-selection rule for this two-input calculator

#### TACE Nomogram
**Ho SY, Hsu CY, Liu PH, et al.**
*Albumin-bilirubin (ALBI) grade-based nomogram for patients with hepatocellular carcinoma undergoing transarterial chemoembolization.*
Digestive Diseases and Sciences. 2021;66(5):1730–1738.
DOI: [10.1007/s10620-020-06384-2](https://doi.org/10.1007/s10620-020-06384-2)

**Scope**: Supporting multivariable TACE nomogram research, not the original
two-input ALBI model implemented here. The source review confirmed citation and
abstract metadata, not inaccessible full-text methods. No nomogram, individual
survival estimate or patient-selection algorithm is implemented from this source.

## Implementation Details

### Component Structure
```javascript
export const ALBIScore = {
  id: "albi-score",
  name: "ALBI Score",
  desc: "Albumin-Bilirubin grade for liver function assessment...",
  info: { /* Educational content and link */ },
  fields: [ /* Input field definitions */ ],
  compute: ({ unit_system, albumin, bilirubin }) => { /* Calculation logic */ },
  refs: [ /* Reference citations */ ]
}
```

### Calculation Logic
1. Parse and validate input values
2. Convert to SI units if US units selected
3. Require positive finite converted values; flag values outside the application review intervals without treating those intervals as physiological limits
4. Calculate ALBI score: `(log10(bilirubin_SI) × 0.66) + (albumin_SI × -0.085)`
5. Determine grade based on thresholds
6. Generate interpretation and clinical context
7. Return formatted results

### UI Components
- **shadcn/ui Card**: Main calculator container
- **Radio Group**: Unit system selection
- **Number Inputs**: Albumin and bilirubin entry
- **Results Display**: Score, grade, interpretation, clinical context
- **References Section**: Citation list with DOI links

### Styling
- Responsive design with Tailwind CSS
- Mobile-first approach
- Consistent with application theme
- Clear visual hierarchy
- Accessible color contrast

## Quality Assurance

### Manual Testing Checklist
- [ ] Calculator loads and displays correctly
- [ ] Unit system switches between SI and US
- [ ] All input fields accept valid values
- [ ] Validation rejects invalid inputs
- [ ] All three grades calculate correctly
- [ ] Boundary cases handle appropriately
- [ ] Unit conversions are accurate
- [ ] Error messages display clearly
- [ ] Clinical interpretations are accurate
- [ ] All reference links work
- [ ] Responsive design works on mobile
- [ ] Keyboard navigation functions
- [ ] Screen reader compatibility

### Automated Testing
- **Test File**: `/tests/e2e/calculators/hepatology/albi-score.spec.js`
- **Framework**: Playwright
- **Coverage**:
  - Visual appeal and theme matching
  - Unit system selection
  - Input validation
  - All grade calculations (SI and US units)
  - Edge cases and error handling
  - Clinical context display
  - Reference verification
  - Accessibility
  - Formula accuracy

### Known Issues
- Whole-calculator acceptance remains open. See the [clinical review and task record](../../verification/calculators/albi-score.md) for the exact reviewed scope, test evidence and remaining source/report/privacy/live checks.

## Browser Verification Scope

The current correction has focused Chromium desktop/mobile-width, keyboard,
actual clipboard and print-media test evidence. This is not proof of native
mobile-browser operation, native printing, all-browser accessibility or a
complete cross-browser audit. See the task record for separately retained runs.

## Accessibility Features
- Semantic HTML structure
- Proper ARIA labels
- Keyboard navigation support
- Sufficient color contrast
- Responsive text sizing
- Screen reader compatible
- Focus indicators

## Future Enhancements
1. **ALBI-BCLC Integration**: Combined staging calculator
2. **Longitudinal Tracking**: Plot ALBI changes over time
3. **Modified ALBI**: Include modified ALBI (mALBI) variants
4. **Risk Calculators**: Integrate ALBI into treatment-specific risk models
5. **Export Functionality**: PDF/print report generation
6. **Multi-language Support**: Translations for international use

## Maintenance Notes

### Last Updated
- **Documentation reconciliation**: 2026-09-08
- **Clinical source-review scope**: Recorded separately in the linked task record; not full clinical certification

### Change Log
- Synchronized explicit units, software warnings, report presentation and corrected supporting bibliography with the approved ALBI baseline work
- Initial implementation with full validation and clinical context
- Comprehensive test coverage added
- Documentation created

### Dependencies
- React 19.1.0
- shadcn/ui components
- Tailwind CSS
- No external calculation libraries (pure JavaScript Math)

## Support & Contact
For technical issues, clinical questions, or enhancement requests, please refer to the main Radulator documentation or contact the development team.

---

**Medical Disclaimer**: This calculator is provided for educational and clinical decision support purposes. It should not replace clinical judgment. Always consider the full clinical context when making treatment decisions. The ALBI score complements but does not replace comprehensive liver function assessment including Child-Pugh classification for BCLC staging.
