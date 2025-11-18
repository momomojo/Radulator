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
2. **Prognostic Stratification**: Risk stratification for treatment planning
3. **BCLC Substratification**: Refining Barcelona Clinic Liver Cancer (BCLC) staging, particularly Stage B
4. **Treatment Selection**: Guiding therapeutic decisions based on liver function capacity
5. **Clinical Trial Enrollment**: Patient stratification in research protocols
6. **Longitudinal Monitoring**: Tracking liver function changes over time

### Advantages Over Child-Pugh Classification
- **More Objective**: Uses only laboratory values (no subjective assessments like ascites or encephalopathy)
- **Better Discrimination**: Superior prognostic discrimination in well-compensated patients
- **Simpler**: Requires only 2 parameters vs 5 for Child-Pugh
- **Continuous Scale**: Provides a continuous score rather than categorical staging
- **Validated**: Extensively validated across multiple HCC cohorts and treatment modalities

## Formula & Calculation

### Mathematical Formula
```
ALBI Score = (log₁₀ bilirubin [μmol/L] × 0.66) + (albumin [g/L] × −0.0852)
```

### Grading Criteria
- **Grade 1**: ALBI Score ≤ −2.60 (Best liver function - well-compensated)
- **Grade 2**: ALBI Score > −2.60 to ≤ −1.39 (Intermediate - moderately compensated)
- **Grade 3**: ALBI Score > −1.39 (Worst liver function - poorly compensated)

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
  - SI units (μmol/L, g/L) [Default]
  - US units (mg/dL, g/dL)
- **Purpose**: Determines input/display unit system

### 2. Serum Albumin
- **Type**: Numeric input
- **Units**: g/L (SI) or g/dL (US)
- **Range**:
  - SI: 5-60 g/L
  - US: 0.5-6.0 g/dL
- **Step**: 0.1
- **Validation**: Must be positive; physiological range enforced
- **Clinical Notes**:
  - Normal range: 35-50 g/L (3.5-5.0 g/dL)
  - Hypoalbuminemia indicates impaired hepatic synthetic function

### 3. Total Bilirubin
- **Type**: Numeric input
- **Units**: μmol/L (SI) or mg/dL (US)
- **Range**:
  - SI: 1-1000 μmol/L
  - US: 0.06-58.5 mg/dL
- **Step**: 0.1
- **Validation**: Must be positive; physiological range enforced
- **Clinical Notes**:
  - Normal range: 5-20 μmol/L (0.3-1.2 mg/dL)
  - Hyperbilirubinemia indicates impaired hepatic excretory function

## Output & Interpretation

### Displayed Results

#### 1. ALBI Score
- **Format**: Decimal number to 3 decimal places (e.g., -2.748)
- **Range**: Typically -4.0 to 0.0 (more negative = better function)

#### 2. ALBI Grade
- **Format**: "Grade 1", "Grade 2", or "Grade 3"
- **Clinical Significance**:
  - **Grade 1**: Optimal candidates for all treatments including curative therapies
  - **Grade 2**: Suitable for locoregional and systemic treatments with monitoring
  - **Grade 3**: Limited treatment options; careful patient selection required

#### 3. Interpretation
Provides grade-specific interpretation:
- **Grade 1**: "Best liver function - well-compensated"
- **Grade 2**: "Intermediate liver function - moderately compensated"
- **Grade 3**: "Worst liver function - poorly compensated"

#### 4. Clinical Context
Grade-specific prognostic information and treatment recommendations:

**Grade 1**
- Median survival: 85.6 months (original cohort)
- Treatment options: All therapies including resection, ablation, transplant, systemic therapy
- Prognosis: Best

**Grade 2**
- Median survival: 23.1 months (original cohort)
- Treatment options: Locoregional therapies (TACE, TARE), systemic treatments with monitoring
- Prognosis: Intermediate

**Grade 3**
- Median survival: 6.6 months (original cohort)
- Treatment options: Limited; best supportive care or clinical trials; systemic therapy requires careful liver reserve assessment
- Prognosis: Poorest

#### 5. Converted Values (US units only)
When US units are selected, displays SI conversions:
- Converted Bilirubin (SI): X.X μmol/L
- Converted Albumin (SI): X.X g/L
- Note: "Calculation performed using SI units (shown above)"

## Validation & Error Handling

### Input Validation
1. **Positive Values**: Both albumin and bilirubin must be > 0
2. **Physiological Ranges**:
   - Albumin: 5-60 g/L (SI) or 0.5-6.0 g/dL (US)
   - Bilirubin: 1-1000 μmol/L (SI) or 0.06-58.5 mg/dL (US)
3. **Unit System**: Auto-detects unrealistic values suggesting wrong unit selection

### Error Messages
- "Please enter valid positive values for albumin and bilirubin."
- "Albumin value X.X g/L is outside physiological range (5-60 g/L). Please check unit selection and input."
- "Bilirubin value X.X μmol/L is outside physiological range (1-1000 μmol/L). Please check unit selection and input."

## Test Cases

### Standard Test Cases

#### Test 1: Grade 1 - Excellent Function
- **Input**: Albumin 40 g/L, Bilirubin 10 μmol/L (SI units)
- **Expected ALBI Score**: -2.748
- **Expected Grade**: Grade 1
- **Interpretation**: Best liver function - well-compensated

#### Test 2: Grade 2 - Intermediate Function
- **Input**: Albumin 35 g/L, Bilirubin 17 μmol/L (SI units)
- **Expected ALBI Score**: -2.164
- **Expected Grade**: Grade 2
- **Interpretation**: Intermediate liver function - moderately compensated

#### Test 3: Grade 3 - Poor Function
- **Input**: Albumin 25 g/L, Bilirubin 50 μmol/L (SI units)
- **Expected ALBI Score**: -1.003
- **Expected Grade**: Grade 3
- **Interpretation**: Worst liver function - poorly compensated

#### Test 4: US Units - Grade 1
- **Input**: Albumin 4.0 g/dL, Bilirubin 0.5 mg/dL (US units)
- **Converted**: Albumin 40 g/L, Bilirubin 8.55 μmol/L
- **Expected ALBI Score**: -2.776
- **Expected Grade**: Grade 1

#### Test 5: US Units - Grade 2
- **Input**: Albumin 3.5 g/dL, Bilirubin 1.0 mg/dL (US units)
- **Converted**: Albumin 35 g/L, Bilirubin 17.1 μmol/L
- **Expected ALBI Score**: -2.162
- **Expected Grade**: Grade 2

### Boundary Test Cases

#### Test 6: Grade 1/2 Boundary
- **Input**: Albumin 38.7 g/L, Bilirubin 11 μmol/L
- **Expected ALBI Score**: ≈ -2.598 (just above -2.60)
- **Expected Grade**: Grade 2

#### Test 7: Grade 2/3 Boundary
- **Input**: Albumin 27 g/L, Bilirubin 28 μmol/L
- **Expected ALBI Score**: ≈ -1.352 (just above -1.39)
- **Expected Grade**: Grade 3

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

#### Test 13: Out of Range High
- **Input**: Albumin 100 g/L, Bilirubin 20 μmol/L
- **Expected**: Error about physiological range

#### Test 14: Out of Range Low
- **Input**: Albumin 3 g/L, Bilirubin 20 μmol/L
- **Expected**: Error about physiological range

## Clinical References

### Primary Reference
**Johnson PJ, Berhane S, Kagebayashi C, et al.**
*Assessment of liver function in patients with hepatocellular carcinoma: a new evidence-based approach-the ALBI grade.*
J Clin Oncol. 2015;33(6):550-558.
DOI: [10.1200/JCO.2014.57.9151](https://doi.org/10.1200/JCO.2014.57.9151)

**Key Findings**:
- Developed from 1,313 Japanese HCC patients
- Validated in 2 independent cohorts (liver cancer trials)
- Superior prognostic discrimination vs Child-Pugh
- Median survival by grade: Grade 1: 85.6 mo, Grade 2: 23.1 mo, Grade 3: 6.6 mo

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
- ALBI-modified BCLC improves treatment selection

#### TACE Nomogram
**Ho SY, Liu PH, Hsu CY, et al.**
*Albumin-bilirubin (ALBI) grade-based nomogram for patients with hepatocellular carcinoma undergoing transarterial chemoembolization.*
Dig Liver Dis. 2018;50(6):600-606.
DOI: [10.1016/j.dld.2018.01.128](https://doi.org/10.1016/j.dld.2018.01.128)

**Key Findings**:
- ALBI-based nomogram predicts TACE outcomes
- Incorporates tumor burden and ALBI grade
- Validated prediction model for patient selection

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
3. Validate physiological ranges
4. Calculate ALBI score: `(log10(bilirubin_SI) × 0.66) + (albumin_SI × -0.0852)`
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
- None currently identified

## Browser Compatibility
- Chrome/Edge (Chromium): Full support
- Firefox: Full support
- Safari/WebKit: Full support
- Mobile Chrome: Full support
- Mobile Safari: Full support

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
- **Code Version**: 2.0
- **Documentation**: November 2025
- **Last Formula Review**: November 2025

### Change Log
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
