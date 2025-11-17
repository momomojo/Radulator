# Child-Pugh Score Calculator Documentation

## Overview

The **Child-Pugh Score** calculator is a foundational medical tool for classification and prognostic assessment of chronic liver disease and cirrhosis. It provides a standardized scoring system using five clinical and laboratory parameters to stratify patients into three prognostic classes (A, B, C) that correlate with disease severity, surgical risk, and mortality.

## Calculator ID
- **Component Name**: `ChildPugh`
- **URL Path**: `/child-pugh`
- **Category**: Hepatology/Liver
- **Medical Specialty**: Hepatology, Surgery, Gastroenterology

## Clinical Purpose

### Primary Use Cases
1. **Cirrhosis Severity Assessment**: Objective classification of chronic liver disease severity
2. **Surgical Risk Stratification**: Preoperative assessment for patients with liver disease
3. **Prognosis Estimation**: One-year and perioperative mortality risk prediction
4. **Treatment Planning**: Guiding therapeutic decisions and transplant evaluation
5. **Clinical Trial Enrollment**: Patient stratification in hepatology research
6. **Transplant Listing**: Initial evaluation for liver transplant candidacy (now supplemented by MELD-Na)

### Historical Context
- **Original Publication**: Child & Turcotte (1964) - Initial 3-parameter system
- **Modified Version**: Pugh et al. (1973) - Current 5-parameter system
- **Gold Standard**: Remained the primary prognostic tool for decades
- **Current Role**: Still widely used alongside MELD-Na score for comprehensive assessment

### Advantages
- **Time-Tested**: Over 50 years of clinical validation
- **Comprehensive**: Combines laboratory and clinical parameters
- **Universally Recognized**: Standard terminology (Class A/B/C) familiar to all clinicians
- **Practical**: Readily available parameters in routine clinical practice
- **Versatile**: Applicable across diverse liver disease etiologies

### Limitations
- **Subjective Components**: Ascites and encephalopathy grading can vary between observers
- **Ceiling Effect**: Cannot differentiate severity above 15 points
- **Categorical**: Less granular than continuous scores like MELD-Na
- **Non-linear**: Point increments don't reflect proportional risk increases

## Formula & Calculation

### Scoring System

Each of five parameters is assigned 1, 2, or 3 points based on severity thresholds:

#### 1. Total Bilirubin
- **1 point**: < 2.0 mg/dL
- **2 points**: 2.0-3.0 mg/dL
- **3 points**: > 3.0 mg/dL

*Note*: For patients with primary biliary cholangitis (PBC) or primary sclerosing cholangitis (PSC), some centers use modified bilirubin cutoffs (< 4 mg/dL = 1pt, 4-10 = 2pts, > 10 = 3pts) due to cholestatic disease patterns.

#### 2. Serum Albumin
- **1 point**: > 3.5 g/dL
- **2 points**: 2.8-3.5 g/dL
- **3 points**: < 2.8 g/dL

#### 3. INR (International Normalized Ratio)
- **1 point**: < 1.7
- **2 points**: 1.7-2.2
- **3 points**: > 2.2

*Historical Note*: Original scoring used prothrombin time (< 4 sec prolonged = 1pt, 4-6 sec = 2pts, > 6 sec = 3pts). INR provides better standardization.

#### 4. Ascites
- **1 point**: None
- **2 points**: Slight (mild)
- **3 points**: Moderate to Severe

*Clinical Definition*:
- **None**: No ascites on physical exam or imaging
- **Slight**: Detectable only on imaging or subtle physical exam findings
- **Moderate to Severe**: Clinically evident on exam, requiring diuretic therapy

#### 5. Hepatic Encephalopathy
- **1 point**: None
- **2 points**: Grade 1-2 (mild)
- **3 points**: Grade 3-4 (severe)

*West Haven Criteria*:
- **Grade 1**: Trivial lack of awareness, euphoria, anxiety, shortened attention
- **Grade 2**: Lethargy, disorientation, inappropriate behavior, asterixis
- **Grade 3**: Somnolent but arousable, gross disorientation, bizarre behavior
- **Grade 4**: Coma, unresponsive to painful stimuli

### Total Score Calculation
```
Total Score = Bilirubin Points + Albumin Points + INR Points + Ascites Points + Encephalopathy Points
```

**Score Range**: 5-15 points

### Classification Criteria

#### Class A (5-6 points): Well-Compensated Disease
- **Description**: Minimal hepatic dysfunction
- **1-Year Mortality**: 5-10%
- **Perioperative Mortality**: ~10%
- **Clinical Implications**:
  - Good surgical candidates
  - Can tolerate most hepatic resections
  - Low short-term transplant priority
  - Often suitable for HCC treatments (resection, ablation)

#### Class B (7-9 points): Significant Functional Compromise
- **Description**: Moderate hepatic dysfunction
- **1-Year Mortality**: 15-20%
- **Perioperative Mortality**: ~30%
- **Clinical Implications**:
  - Increased surgical risk; careful patient selection required
  - Limited hepatic resection may be considered
  - May benefit from transplant evaluation
  - Often candidates for locoregional HCC therapies

#### Class C (10-15 points): Decompensated Disease
- **Description**: Advanced hepatic dysfunction
- **1-Year Mortality**: 45-55% (some studies report up to 70%)
- **Perioperative Mortality**: 70-80%
- **Clinical Implications**:
  - Contraindication to elective surgery
  - High transplant priority
  - Limited treatment options for HCC
  - Focus on supportive care and transplant evaluation

## Input Parameters

### 1. Total Bilirubin
- **Type**: Numeric input
- **Units**: mg/dL
- **Range**: ≥ 0
- **Step**: 0.1
- **Validation**: Must be non-negative finite number
- **Clinical Notes**:
  - Normal range: 0.3-1.2 mg/dL
  - Measures hepatic excretory function
  - Elevated in both hepatocellular and cholestatic disease

### 2. Serum Albumin
- **Type**: Numeric input
- **Units**: g/dL
- **Range**: ≥ 0
- **Step**: 0.1
- **Validation**: Must be non-negative finite number
- **Clinical Notes**:
  - Normal range: 3.5-5.0 g/dL
  - Measures hepatic synthetic function
  - Half-life ~20 days; reflects chronic liver dysfunction
  - Affected by nutrition, renal losses, inflammation

### 3. INR
- **Type**: Numeric input
- **Units**: Ratio (dimensionless)
- **Range**: ≥ 0
- **Step**: 0.1
- **Validation**: Must be non-negative finite number
- **Clinical Notes**:
  - Normal range: 0.9-1.1
  - Measures coagulation factor synthesis
  - Affected by vitamin K status; ensure not vitamin K deficient
  - Not affected by warfarin in liver disease assessment

### 4. Ascites
- **Type**: Radio button group
- **Options**:
  1. **None**: No ascites
  2. **Slight**: Mild ascites
  3. **Moderate to Severe**: Moderate or severe ascites
- **Required**: Yes
- **Assessment Methods**:
  - Physical examination (shifting dullness, fluid wave)
  - Imaging (ultrasound, CT, MRI)
  - Diagnostic paracentesis if unclear

### 5. Hepatic Encephalopathy
- **Type**: Radio button group
- **Options**:
  1. **None**: No encephalopathy
  2. **Grade 1-2 (mild)**: Mild encephalopathy
  3. **Grade 3-4 (severe)**: Severe encephalopathy
- **Required**: Yes
- **Assessment Methods**:
  - Clinical evaluation (mental status, asterixis)
  - Number connection test
  - Ammonia levels (supportive but not diagnostic)
  - EEG if needed (triphasic waves)

## Output & Interpretation

### Displayed Results

#### 1. Total Score
- **Format**: "X points" (5-15)
- **Clinical Significance**: Higher scores indicate worse prognosis

#### 2. Child-Pugh Class
- **Format**: "A", "B", or "C"
- **Universal Standard**: Recognized globally in hepatology

#### 3. Classification
- **Class A**: "Well-compensated disease"
- **Class B**: "Significant functional compromise"
- **Class C**: "Decompensated disease"

#### 4. 1-Year Mortality
- **Class A**: 5-10%
- **Class B**: 15-20%
- **Class C**: 45-55%
- **Source**: Historical cohort data from original validation studies

#### 5. Perioperative Mortality
- **Class A**: 10%
- **Class B**: 30%
- **Class C**: 70-80%
- **Context**: Abdominal surgery in cirrhotic patients
- **Clinical Use**: Guides surgical decision-making

#### 6. Points Breakdown
Detailed breakdown showing:
- Each parameter value and its assigned points
- Visual confirmation of scoring logic
- Useful for educational purposes and verification

**Example Output**:
```
Total Score: 8 points
Child-Pugh Class: B
Classification: Significant functional compromise
1-Year Mortality: 15-20%
Perioperative Mortality: 30%

─────────────────────
Points Breakdown
Bilirubin: 2.5 mg/dL → 2 points
Albumin: 3.0 g/dL → 2 points
INR: 1.8 → 2 points
Ascites: Slight → 2 points
Encephalopathy: None → 1 point
```

## Validation & Error Handling

### Input Validation
1. **Numeric Fields**: Must be valid, non-negative, finite numbers
2. **Radio Selections**: Both ascites and encephalopathy must be selected
3. **Error Messages**:
   - "Please enter a valid bilirubin value (≥ 0)"
   - "Please enter a valid albumin value (≥ 0)"
   - "Please enter a valid INR value (≥ 0)"
   - "Please select ascites status"
   - "Please select encephalopathy grade"

### Boundary Testing
- **Bilirubin**: Exact values at 2.0 and 3.0 mg/dL
- **Albumin**: Exact values at 2.8 and 3.5 g/dL
- **INR**: Exact values at 1.7 and 2.2

### Edge Cases Handled
- Zero values (e.g., bilirubin = 0)
- Very high values (extreme decompensation)
- Decimal precision (up to 3 decimal places)
- Maximum possible score capped at 15 points

## Test Data

### Class A Examples

#### Minimum Score (5 points)
```javascript
{
  bilirubin: "1.5",    // 1 point
  albumin: "4.0",      // 1 point
  inr: "1.2",          // 1 point
  ascites: "none",     // 1 point
  encephalopathy: "none"  // 1 point
}
// Expected: 5 points, Class A, Well-compensated
```

#### Maximum Class A Score (6 points)
```javascript
{
  bilirubin: "2.2",    // 2 points (in range 2-3)
  albumin: "4.0",      // 1 point
  inr: "1.2",          // 1 point
  ascites: "none",     // 1 point
  encephalopathy: "none"  // 1 point
}
// Expected: 6 points, Class A, Well-compensated
```

#### Typical Compensated Cirrhosis
```javascript
{
  bilirubin: "1.2",    // 1 point
  albumin: "3.8",      // 1 point
  inr: "1.3",          // 1 point
  ascites: "none",     // 1 point
  encephalopathy: "none"  // 1 point
}
// Expected: 5 points, Class A
```

### Class B Examples

#### Minimum Score (7 points)
```javascript
{
  bilirubin: "2.5",    // 2 points
  albumin: "3.2",      // 2 points
  inr: "1.2",          // 1 point
  ascites: "none",     // 1 point
  encephalopathy: "none"  // 1 point
}
// Expected: 7 points, Class B, Significant functional compromise
```

#### Middle Class B Score (8 points)
```javascript
{
  bilirubin: "2.5",    // 2 points
  albumin: "3.0",      // 2 points
  inr: "1.8",          // 2 points
  ascites: "none",     // 1 point
  encephalopathy: "none"  // 1 point
}
// Expected: 8 points, Class B
```

#### Maximum Class B Score (9 points)
```javascript
{
  bilirubin: "2.5",    // 2 points
  albumin: "3.0",      // 2 points
  inr: "1.8",          // 2 points
  ascites: "slight",   // 2 points
  encephalopathy: "none"  // 1 point
}
// Expected: 9 points, Class B, Surgical risk 30%
```

#### Typical Early Decompensation
```javascript
{
  bilirubin: "2.5",    // 2 points
  albumin: "3.0",      // 2 points
  inr: "1.9",          // 2 points
  ascites: "slight",   // 2 points
  encephalopathy: "none"  // 1 point
}
// Expected: 9 points, Class B, 1-year mortality 15-20%
```

### Class C Examples

#### Minimum Score (10 points)
```javascript
{
  bilirubin: "3.5",    // 3 points
  albumin: "2.6",      // 3 points
  inr: "1.2",          // 1 point
  ascites: "none",     // 1 point
  encephalopathy: "grade1-2"  // 2 points
}
// Expected: 10 points, Class C, Decompensated disease
```

#### Middle Class C Score (12 points)
```javascript
{
  bilirubin: "4.0",    // 3 points
  albumin: "2.5",      // 3 points
  inr: "2.5",          // 3 points
  ascites: "none",     // 1 point
  encephalopathy: "grade1-2"  // 2 points
}
// Expected: 12 points, Class C
```

#### Maximum Score (15 points)
```javascript
{
  bilirubin: "5.0",    // 3 points
  albumin: "2.0",      // 3 points
  inr: "3.0",          // 3 points
  ascites: "moderate", // 3 points
  encephalopathy: "grade3-4"  // 3 points
}
// Expected: 15 points, Class C, 1-year mortality 45-55%, Surgical risk 70-80%
```

#### Typical Advanced Decompensation
```javascript
{
  bilirubin: "4.5",    // 3 points
  albumin: "2.3",      // 3 points
  inr: "2.5",          // 3 points
  ascites: "moderate", // 3 points
  encephalopathy: "grade1-2"  // 2 points
}
// Expected: 14 points, Class C, contraindication to elective surgery
```

### Boundary Value Tests

#### Bilirubin Boundaries
```javascript
// At 2.0 mg/dL (should be 2 points)
{ bilirubin: "2.0", albumin: "4.0", inr: "1.2", ascites: "none", encephalopathy: "none" }
// Expected: Bilirubin → 2 points

// At 3.0 mg/dL (should be 2 points)
{ bilirubin: "3.0", albumin: "4.0", inr: "1.2", ascites: "none", encephalopathy: "none" }
// Expected: Bilirubin → 2 points

// Just below 2.0 mg/dL (should be 1 point)
{ bilirubin: "1.999", albumin: "4.0", inr: "1.2", ascites: "none", encephalopathy: "none" }
// Expected: Bilirubin → 1 point

// Just above 3.0 mg/dL (should be 3 points)
{ bilirubin: "3.001", albumin: "4.0", inr: "1.2", ascites: "none", encephalopathy: "none" }
// Expected: Bilirubin → 3 points
```

#### Albumin Boundaries
```javascript
// At 3.5 g/dL (should be 2 points)
{ bilirubin: "1.5", albumin: "3.5", inr: "1.2", ascites: "none", encephalopathy: "none" }
// Expected: Albumin → 2 points

// At 2.8 g/dL (should be 2 points)
{ bilirubin: "1.5", albumin: "2.8", inr: "1.2", ascites: "none", encephalopathy: "none" }
// Expected: Albumin → 2 points

// Just above 3.5 g/dL (should be 1 point)
{ bilirubin: "1.5", albumin: "3.501", inr: "1.2", ascites: "none", encephalopathy: "none" }
// Expected: Albumin → 1 point

// Just below 2.8 g/dL (should be 3 points)
{ bilirubin: "1.5", albumin: "2.799", inr: "1.2", ascites: "none", encephalopathy: "none" }
// Expected: Albumin → 3 points
```

#### INR Boundaries
```javascript
// At 1.7 (should be 2 points)
{ bilirubin: "1.5", albumin: "4.0", inr: "1.7", ascites: "none", encephalopathy: "none" }
// Expected: INR → 2 points

// At 2.2 (should be 2 points)
{ bilirubin: "1.5", albumin: "4.0", inr: "2.2", ascites: "none", encephalopathy: "none" }
// Expected: INR → 2 points

// Just below 1.7 (should be 1 point)
{ bilirubin: "1.5", albumin: "4.0", inr: "1.699", ascites: "none", encephalopathy: "none" }
// Expected: INR → 1 point

// Just above 2.2 (should be 3 points)
{ bilirubin: "1.5", albumin: "4.0", inr: "2.201", ascites: "none", encephalopathy: "none" }
// Expected: INR → 3 points
```

### Extreme Value Tests

#### Zero Values
```javascript
{
  bilirubin: "0",      // 1 point (<2)
  albumin: "4.0",      // 1 point
  inr: "1.2",          // 1 point
  ascites: "none",     // 1 point
  encephalopathy: "none"  // 1 point
}
// Expected: 5 points, should handle gracefully
```

#### Very High Values
```javascript
{
  bilirubin: "20.0",   // 3 points (>3)
  albumin: "1.5",      // 3 points (<2.8)
  inr: "5.0",          // 3 points (>2.2)
  ascites: "moderate", // 3 points
  encephalopathy: "grade3-4"  // 3 points
}
// Expected: 15 points (maximum), Class C
```

## Clinical Scenarios

### Scenario 1: Pre-operative Assessment
**Case**: 62-year-old with cirrhosis being evaluated for elective cholecystectomy
```javascript
{
  bilirubin: "1.8",
  albumin: "3.6",
  inr: "1.5",
  ascites: "none",
  encephalopathy: "none"
}
// Result: 5 points, Class A
// Interpretation: Acceptable surgical candidate with 10% perioperative mortality risk
```

### Scenario 2: Transplant Evaluation
**Case**: 55-year-old with alcoholic cirrhosis and new-onset ascites
```javascript
{
  bilirubin: "2.8",
  albumin: "3.1",
  inr: "1.9",
  ascites: "slight",
  encephalopathy: "none"
}
// Result: 9 points, Class B
// Interpretation: Consider transplant evaluation; 1-year mortality 15-20%
```

### Scenario 3: HCC Treatment Planning
**Case**: 68-year-old with hepatitis C cirrhosis and 3cm HCC
```javascript
{
  bilirubin: "1.2",
  albumin: "3.8",
  inr: "1.3",
  ascites: "none",
  encephalopathy: "none"
}
// Result: 5 points, Class A
// Interpretation: Good candidate for curative resection or ablation
```

### Scenario 4: Advanced Cirrhosis
**Case**: 47-year-old with NASH cirrhosis, recurrent hepatic encephalopathy
```javascript
{
  bilirubin: "4.5",
  albumin: "2.3",
  inr: "2.5",
  ascites: "moderate",
  encephalopathy: "grade1-2"
}
// Result: 14 points, Class C
// Interpretation: Urgent transplant evaluation; contraindication to elective surgery
```

## Clinical Integration

### Combined Use with MELD-Na Score
The Child-Pugh and MELD-Na scores are complementary:

**Child-Pugh Strengths**:
- Includes clinical parameters (ascites, encephalopathy)
- Better captures overall functional status
- Familiar classification system (A/B/C)
- Useful for surgical risk stratification

**MELD-Na Strengths**:
- Purely objective (laboratory-based)
- Continuous scale with better discrimination
- Current standard for transplant allocation
- Better prediction in acute decompensation

**Best Practice**: Use both scores for comprehensive assessment

### Treatment Decision Tree

#### Class A (5-6 points)
- **Hepatic Resection**: Suitable if tumor characteristics favorable
- **Ablation**: Excellent candidate
- **Transplantation**: Low priority unless meeting Milan criteria for HCC
- **Surgery**: Most elective surgeries acceptable with appropriate monitoring
- **Systemic Therapy**: Can tolerate most chemotherapy regimens

#### Class B (7-9 points)
- **Hepatic Resection**: Limited resection only; careful patient selection
- **Ablation**: Good candidate, preferred over resection
- **Transplantation**: Moderate priority; evaluate MELD-Na score
- **Surgery**: High-risk; avoid elective procedures if possible
- **Systemic Therapy**: Dose adjustment may be needed

#### Class C (10-15 points)
- **Hepatic Resection**: Contraindicated
- **Ablation**: Limited role; palliative intent only
- **Transplantation**: High priority if no contraindications
- **Surgery**: Emergency only; prohibitive mortality risk
- **Systemic Therapy**: Often contraindicated; supportive care focus

## References & Evidence Base

### Original Publications

1. **Pugh RN, Murray-Lyon IM, Dawson JL, et al.** (1973)
   - *Transection of the oesophagus for bleeding oesophageal varices*
   - British Journal of Surgery. 60(8):646-649
   - DOI: [10.1002/bjs.1800600817](https://doi.org/10.1002/bjs.1800600817)
   - **Significance**: Introduced the modified Child-Pugh classification still used today

2. **Child CG, Turcotte JG** (1964)
   - *Surgery and portal hypertension*
   - In: The liver and portal hypertension. Philadelphia: Saunders, pp. 50-64
   - NCBI: [NBK541016](https://www.ncbi.nlm.nih.gov/books/NBK541016/)
   - **Significance**: Original 3-parameter classification (bilirubin, albumin, nutrition)

### Validation Studies

3. **Durand F, Valla D** (2005)
   - *Assessment of the prognosis of cirrhosis: Child-Pugh versus MELD*
   - Journal of Hepatology. 42 Suppl:S100-7
   - DOI: [10.1016/j.jhep.2004.11.015](https://doi.org/10.1016/j.jhep.2004.11.015)
   - **Key Finding**: Comparative analysis of Child-Pugh vs MELD scoring systems

4. **Kamath PS, Kim WR** (2007)
   - *The model for end-stage liver disease (MELD)*
   - Hepatology. 45(3):797-805
   - DOI: [10.1002/hep.21563](https://doi.org/10.1002/hep.21563)
   - **Key Finding**: MELD as complement/alternative to Child-Pugh for transplant allocation

### Additional Evidence
- **Surgical Risk**: Mansour A, et al. Ann Surg. 1997 - Validated perioperative mortality rates
- **HCC Staging**: Forner A, et al. Lancet. 2012 - Child-Pugh in BCLC staging
- **Varices**: Garcia-Tsao G, et al. Hepatology. 2007 - Child-Pugh in variceal bleeding risk

## Technical Implementation

### Calculator Architecture
- **Component**: React functional component
- **State Management**: Controlled inputs with useState hooks
- **Validation**: Real-time input validation with error messages
- **Computation**: Deterministic algorithm with clear thresholds
- **Output**: Structured object with formatted results

### Code Location
```
src/components/calculators/ChildPugh.jsx
```

### Data Structure
```javascript
export const ChildPugh = {
  id: "child-pugh",
  name: "Child-Pugh Score",
  desc: "Classification and prognosis of chronic liver disease and cirrhosis",
  fields: [...],
  compute: (vals) => {...},
  refs: [...]
}
```

### Testing Coverage
- **Test File**: `tests/e2e/calculators/hepatology/child-pugh.spec.js`
- **Test Suites**: 11 describe blocks
- **Total Tests**: 47 test cases
- **Coverage Areas**:
  - Visual appeal and theme matching
  - Input validation
  - Radio button selection
  - Class A calculations (5-6 points)
  - Class B calculations (7-9 points)
  - Class C calculations (10-15 points)
  - Boundary value testing
  - Clinical scenarios
  - Reference links
  - User experience

## Changelog

### Version History
- **v1.0** (Initial Release): Full Child-Pugh implementation with 5-parameter scoring
- **Current**: Test1 branch - Comprehensive Playwright test coverage

## Related Calculators

### Within Radulator
1. **MELD-Na Score**: Complementary objective score for transplant allocation
2. **ALBI Score**: Simpler 2-parameter liver function assessment for HCC patients
3. **BCLC Staging**: Incorporates Child-Pugh class for HCC staging
4. **Milan Criteria**: Uses Child-Pugh for HCC transplant eligibility

### Clinical Workflow
```
Patient with Cirrhosis
    ↓
Child-Pugh Score (Overall function)
    ↓
├─ Class A → Consider curative treatments
├─ Class B → Locoregional therapy, transplant evaluation
└─ Class C → Transplant priority, supportive care
    ↓
MELD-Na Score (Transplant allocation)
    ↓
If HCC: BCLC Staging + Milan Criteria
```

## Frequently Asked Questions

**Q: Should I use Child-Pugh or MELD-Na?**
A: Use both. Child-Pugh captures clinical parameters (ascites, encephalopathy) while MELD-Na is purely objective. They provide complementary information.

**Q: How do I grade ascites clinically?**
A: None = no detectable fluid; Slight = only on imaging or subtle exam; Moderate-Severe = obvious on exam, needs diuretics.

**Q: Can Child-Pugh predict transplant waitlist mortality?**
A: MELD-Na is superior for this purpose. Child-Pugh is better for overall functional assessment and surgical risk.

**Q: What about patients on warfarin?**
A: Use PT-INR from before warfarin initiation or temporarily hold warfarin (with appropriate precautions) to get baseline coagulation status.

**Q: Do nutrition and renal function affect the score?**
A: Yes - albumin is affected by nutrition and renal losses. Consider these confounders when interpreting results.

**Q: How often should I recalculate the score?**
A: With each significant clinical change, at least every 3-6 months for stable cirrhosis, or when considering interventions.

**Q: Is Class B always 7-9 points?**
A: Yes. The classification is standardized: A = 5-6, B = 7-9, C = 10-15.

## Keywords for Search
Child-Pugh score, Child-Turcotte-Pugh, CTP score, cirrhosis classification, liver disease severity, hepatic function assessment, surgical risk cirrhosis, Child class, Pugh score, ascites grading, hepatic encephalopathy, liver transplant evaluation, cirrhosis prognosis, perioperative mortality liver disease, ESLD classification
