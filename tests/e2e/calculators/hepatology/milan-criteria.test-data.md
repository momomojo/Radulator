# Milan Criteria Calculator - Test Data Scenarios

## Purpose
This document provides comprehensive test scenarios for the Milan Criteria calculator, covering all clinical decision paths and edge cases. Use these scenarios for manual testing, automated Playwright tests, and validation.

---

## Category 1: WITHIN Milan Criteria (Eligible - Standard)

### Scenario 1.1: Single Small Tumor
**Clinical Context**: Ideal transplant candidate
- **Tumor Count**: 1
- **Largest Tumor**: 4.5 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: WITHIN CRITERIA
- UCSF: WITHIN CRITERIA
- Eligibility: ELIGIBLE - Meets Milan Criteria (standard)
- Expected Outcomes: 4-year survival >70%, 5-year recurrence-free survival 83%

---

### Scenario 1.2: Single Tumor at Milan Boundary
**Clinical Context**: Edge case at 5 cm limit
- **Tumor Count**: 1
- **Largest Tumor**: 5.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: WITHIN CRITERIA (≤5 cm includes boundary)
- UCSF: WITHIN CRITERIA
- Eligibility: ELIGIBLE - Meets Milan Criteria (standard)
- Details: "Single tumor 5.0 cm (≤5 cm required)"

---

### Scenario 1.3: Two Small Tumors
**Clinical Context**: Multifocal HCC within limits
- **Tumor Count**: 2
- **Largest Tumor**: 2.8 cm
- **Second Tumor**: 2.5 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: WITHIN CRITERIA (both ≤3 cm)
- UCSF: WITHIN CRITERIA
- Total Diameter: 5.3 cm
- Eligibility: ELIGIBLE - Meets Milan Criteria (standard)
- Details: "2 tumors, largest 2.8 cm (each ≤3 cm required)"

---

### Scenario 1.4: Three Tumors at Milan Boundary
**Clinical Context**: Maximum tumor number at size limit
- **Tumor Count**: 3
- **Largest Tumor**: 3.0 cm
- **Second Tumor**: 3.0 cm
- **Third Tumor**: 2.5 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: WITHIN CRITERIA (all ≤3 cm)
- UCSF: WITHIN CRITERIA
- Total Diameter: 8.5 cm (exceeds UCSF but within Milan for 3-cm rule)
- Eligibility: ELIGIBLE - Meets Milan Criteria (standard)

---

### Scenario 1.5: Three Very Small Tumors
**Clinical Context**: Multifocal but minimal burden
- **Tumor Count**: 3
- **Largest Tumor**: 2.0 cm
- **Second Tumor**: 1.5 cm
- **Third Tumor**: 1.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: WITHIN CRITERIA
- UCSF: WITHIN CRITERIA
- Total Diameter: 4.5 cm
- Eligibility: ELIGIBLE - Meets Milan Criteria (standard)

---

## Category 2: BEYOND Milan, WITHIN UCSF (Eligible - Expanded)

### Scenario 2.1: Single Moderately Large Tumor
**Clinical Context**: Common UCSF expansion scenario
- **Tumor Count**: 1
- **Largest Tumor**: 6.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA (6.0 cm exceeds 5 cm)
- UCSF: WITHIN CRITERIA (≤6.5 cm)
- Eligibility: ELIGIBLE - Meets UCSF Criteria (expanded)
- Expected Outcomes: ~75% 5-year survival
- Milan Details: "Single tumor 6.0 cm exceeds 5 cm limit"
- UCSF Details: "Single tumor 6.0 cm (≤6.5 cm required)"

---

### Scenario 2.2: Single Tumor at UCSF Boundary
**Clinical Context**: Maximum size for UCSF
- **Tumor Count**: 1
- **Largest Tumor**: 6.5 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: WITHIN CRITERIA (exactly at ≤6.5 cm boundary)
- Eligibility: ELIGIBLE - Meets UCSF Criteria (expanded)
- UCSF Details: "Single tumor 6.5 cm (≤6.5 cm required)"

---

### Scenario 2.3: Three Tumors with Largest 4.0 cm
**Clinical Context**: Multiple tumors exceeding Milan 3 cm limit
- **Tumor Count**: 3
- **Largest Tumor**: 4.0 cm
- **Second Tumor**: 3.5 cm
- **Third Tumor**: 0.5 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA (largest 4.0 cm exceeds 3 cm limit)
- UCSF: WITHIN CRITERIA (largest ≤4.5 cm, total 8.0 cm ≤8 cm)
- Total Diameter: 8.0 cm
- Eligibility: ELIGIBLE - Meets UCSF Criteria (expanded)
- Milan Details: "3 tumors, largest 4.0 cm exceeds 3 cm limit"
- UCSF Details: "3 tumors, largest 4.0 cm, total 8.0 cm (largest ≤4.5 cm and total ≤8 cm required)"

---

### Scenario 2.4: Two Tumors at UCSF Largest Boundary
**Clinical Context**: Testing 4.5 cm largest tumor limit
- **Tumor Count**: 2
- **Largest Tumor**: 4.5 cm
- **Second Tumor**: 3.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA (4.5 cm exceeds 3 cm)
- UCSF: WITHIN CRITERIA (4.5 cm ≤4.5 cm, total 7.5 cm ≤8 cm)
- Total Diameter: 7.5 cm
- Eligibility: ELIGIBLE - Meets UCSF Criteria (expanded)

---

### Scenario 2.5: Three Tumors at UCSF Total Diameter Boundary
**Clinical Context**: Testing 8 cm total diameter limit
- **Tumor Count**: 3
- **Largest Tumor**: 4.0 cm
- **Second Tumor**: 2.5 cm
- **Third Tumor**: 1.5 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: WITHIN CRITERIA (total exactly 8.0 cm)
- Total Diameter: 8.0 cm
- Eligibility: ELIGIBLE - Meets UCSF Criteria (expanded)

---

## Category 3: BEYOND Both Criteria (Not Eligible)

### Scenario 3.1: Single Large Tumor
**Clinical Context**: Exceeds UCSF size limit
- **Tumor Count**: 1
- **Largest Tumor**: 7.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: BEYOND CRITERIA (7.0 cm exceeds 6.5 cm)
- Eligibility: NOT ELIGIBLE - Beyond both Milan and UCSF criteria
- Expected Outcomes: Consider alternatives (ablation, TACE, systemic therapy), down-staging protocols
- UCSF Details: "Single tumor 7.0 cm exceeds 6.5 cm limit"

---

### Scenario 3.2: Four or More Tumors (Small)
**Clinical Context**: Exceeds tumor number limit despite small sizes
- **Tumor Count**: 4 or more
- **Largest Tumor**: 2.5 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA (4+ tumors)
- UCSF: BEYOND CRITERIA (4+ tumors)
- Eligibility: NOT ELIGIBLE
- Milan Details: "4 or more tumors present (Milan limit: 1-3 tumors)"
- UCSF Details: "4 or more tumors present (UCSF limit: 1-3 tumors)"

---

### Scenario 3.3: Three Tumors Exceeding Total Diameter
**Clinical Context**: Individual sizes OK but total exceeds UCSF 8 cm
- **Tumor Count**: 3
- **Largest Tumor**: 4.0 cm
- **Second Tumor**: 3.0 cm
- **Third Tumor**: 1.5 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA (largest exceeds 3 cm)
- UCSF: BEYOND CRITERIA (total 8.5 cm exceeds 8 cm)
- Total Diameter: 8.5 cm
- Eligibility: NOT ELIGIBLE
- UCSF Details: "3 tumors, total diameter 8.5 cm exceeds 8 cm limit"

---

### Scenario 3.4: Two Tumors with Largest Exceeding 4.5 cm
**Clinical Context**: Largest tumor violates UCSF limit
- **Tumor Count**: 2
- **Largest Tumor**: 5.0 cm
- **Second Tumor**: 2.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: BEYOND CRITERIA (5.0 cm exceeds 4.5 cm)
- Total Diameter: 7.0 cm (total OK, but largest fails)
- Eligibility: NOT ELIGIBLE
- UCSF Details: "2 tumors, largest 5.0 cm exceeds 4.5 cm limit"

---

### Scenario 3.5: Multiple Large Tumors
**Clinical Context**: Extensive tumor burden
- **Tumor Count**: 3
- **Largest Tumor**: 5.0 cm
- **Second Tumor**: 4.0 cm
- **Third Tumor**: 3.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: BEYOND CRITERIA (largest >4.5 cm, total 12.0 cm >8 cm)
- Total Diameter: 12.0 cm
- Eligibility: NOT ELIGIBLE

---

## Category 4: Absolute Contraindications (Not Eligible)

### Scenario 4.1: Macrovascular Invasion Present
**Clinical Context**: Portal vein tumor thrombus
- **Tumor Count**: 1
- **Largest Tumor**: 3.0 cm
- **Macrovascular Invasion**: Yes
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: BEYOND CRITERIA
- Eligibility: NOT ELIGIBLE - Beyond both Milan and UCSF criteria
- Milan Details: "Macrovascular invasion present (absolute contraindication)"
- UCSF Details: "Macrovascular invasion present (absolute contraindication)"

---

### Scenario 4.2: Extrahepatic Disease Present
**Clinical Context**: Lymph node metastases
- **Tumor Count**: 1
- **Largest Tumor**: 3.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: Yes

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: BEYOND CRITERIA
- Eligibility: NOT ELIGIBLE
- Milan Details: "Extrahepatic disease present (absolute contraindication)"
- UCSF Details: "Extrahepatic disease present (absolute contraindication)"

---

### Scenario 4.3: Both Vascular Invasion and Metastases
**Clinical Context**: Advanced disease with multiple contraindications
- **Tumor Count**: 2
- **Largest Tumor**: 4.0 cm
- **Second Tumor**: 3.0 cm
- **Macrovascular Invasion**: Yes
- **Extrahepatic Disease**: Yes

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: BEYOND CRITERIA
- Eligibility: NOT ELIGIBLE
- Details: Macrovascular invasion is evaluated first (absolute contraindication)

---

### Scenario 4.4: Ideal Tumor Burden but Invasion Present
**Clinical Context**: Shows invasion trumps ideal tumor characteristics
- **Tumor Count**: 1
- **Largest Tumor**: 2.0 cm
- **Macrovascular Invasion**: Yes
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA (despite excellent tumor size)
- UCSF: BEYOND CRITERIA
- Eligibility: NOT ELIGIBLE
- Demonstrates: Absolute contraindications override size criteria

---

## Category 5: Indeterminate Status (Further Workup Required)

### Scenario 5.1: Unknown Macrovascular Invasion
**Clinical Context**: Imaging inconclusive for vascular involvement
- **Tumor Count**: 1
- **Largest Tumor**: 4.0 cm
- **Macrovascular Invasion**: Unknown
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: BEYOND CRITERIA
- Eligibility: INDETERMINATE - Further diagnostic workup required
- Expected Outcomes: "Cannot determine eligibility until vascular invasion and extrahepatic disease status are clarified"
- Milan Details: "Macrovascular invasion status unknown - further workup required"
- UCSF Details: "Macrovascular invasion status unknown - further workup required"

---

### Scenario 5.2: Unknown Extrahepatic Disease
**Clinical Context**: Staging not complete
- **Tumor Count**: 1
- **Largest Tumor**: 4.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: Unknown

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: BEYOND CRITERIA
- Eligibility: INDETERMINATE - Further diagnostic workup required
- Milan Details: "Extrahepatic disease status unknown - further workup required"

---

### Scenario 5.3: Both Statuses Unknown
**Clinical Context**: Incomplete staging workup
- **Tumor Count**: 2
- **Largest Tumor**: 3.5 cm
- **Second Tumor**: 2.5 cm
- **Macrovascular Invasion**: Unknown
- **Extrahepatic Disease**: Unknown

**Expected Results**:
- Milan: BEYOND CRITERIA
- UCSF: BEYOND CRITERIA
- Eligibility: INDETERMINATE
- Details: Macrovascular invasion evaluated first

---

### Scenario 5.4: Unknown Status with Excellent Tumor Burden
**Clinical Context**: Shows unknown prevents eligibility despite ideal tumors
- **Tumor Count**: 1
- **Largest Tumor**: 3.0 cm
- **Macrovascular Invasion**: Unknown
- **Extrahepatic Disease**: No

**Expected Results**:
- Eligibility: INDETERMINATE (despite tumor being well within Milan/UCSF)
- Demonstrates: Unknown status must be resolved before eligibility determination

---

## Category 6: Validation & Error Testing

### Scenario 6.1: Missing Tumor Count
**Input**:
- **Tumor Count**: (not selected)
- **Largest Tumor**: 4.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Error**: "Please select the number of tumors"

---

### Scenario 6.2: Missing Largest Tumor Size
**Input**:
- **Tumor Count**: 1
- **Largest Tumor**: (empty)
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Error**: "Please enter the largest tumor diameter"

---

### Scenario 6.3: Missing Second Tumor Size
**Input**:
- **Tumor Count**: 2
- **Largest Tumor**: 3.5 cm
- **Second Tumor**: (empty)
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Error**: "Please enter the second tumor diameter"

---

### Scenario 6.4: Missing Third Tumor Size
**Input**:
- **Tumor Count**: 3
- **Largest Tumor**: 3.0 cm
- **Second Tumor**: 2.5 cm
- **Third Tumor**: (empty)
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Error**: "Please enter the third tumor diameter"

---

### Scenario 6.5: Missing Macrovascular Invasion Status
**Input**:
- **Tumor Count**: 1
- **Largest Tumor**: 4.0 cm
- **Macrovascular Invasion**: (not selected)
- **Extrahepatic Disease**: No

**Expected Error**: "Please specify macrovascular invasion status"

---

### Scenario 6.6: Missing Extrahepatic Disease Status
**Input**:
- **Tumor Count**: 1
- **Largest Tumor**: 4.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: (not selected)

**Expected Error**: "Please specify extrahepatic disease status"

---

## Category 7: Edge Cases & Boundary Testing

### Scenario 7.1: Very Small Tumor
**Clinical Context**: Minimal tumor burden
- **Tumor Count**: 1
- **Largest Tumor**: 0.5 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: WITHIN CRITERIA
- UCSF: WITHIN CRITERIA
- Eligibility: ELIGIBLE - Meets Milan Criteria
- Note: Clinically, sub-1cm lesions may not meet HCC diagnosis criteria

---

### Scenario 7.2: Decimal Precision
**Clinical Context**: Testing 1 decimal place formatting
- **Tumor Count**: 1
- **Largest Tumor**: 4.567 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Milan: WITHIN CRITERIA
- Display: "4.6 cm" (rounded to 1 decimal)
- Eligibility: ELIGIBLE

---

### Scenario 7.3: Three Tumors with Varied Sizes
**Clinical Context**: Testing total diameter calculation
- **Tumor Count**: 3
- **Largest Tumor**: 2.1 cm
- **Second Tumor**: 1.9 cm
- **Third Tumor**: 1.3 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Total Diameter: 5.3 cm (sum verification)
- Milan: WITHIN CRITERIA
- UCSF: WITHIN CRITERIA

---

### Scenario 7.4: Largest Tumor Not First Entry
**Clinical Context**: Testing calculator identifies true largest
- **Tumor Count**: 3
- **Largest Tumor**: 2.5 cm (entered as "largest" but may not be)
- **Second Tumor**: 3.0 cm (actually largest)
- **Third Tumor**: 2.0 cm
- **Macrovascular Invasion**: No
- **Extrahepatic Disease**: No

**Expected Results**:
- Calculator should use Math.max() to identify 3.0 cm as largest
- Milan: WITHIN CRITERIA (all ≤3 cm)
- Display: "Largest Tumor Diameter: 3.0 cm"

---

## Test Execution Notes

### Manual Testing Checklist
- [ ] Execute all Category 1-5 scenarios
- [ ] Verify all validation errors (Category 6)
- [ ] Test conditional field visibility
- [ ] Verify decimal formatting
- [ ] Check all reference links
- [ ] Test responsive design (mobile/desktop)

### Automated Testing
- All scenarios implemented in `milan-criteria.spec.js`
- Total test cases: 40+
- Coverage: Clinical accuracy, validation, UI/UX, accessibility

### Browser Compatibility
- Test on: Chrome, Firefox, Safari, Edge
- Mobile: iOS Safari, Chrome Android
- Screen sizes: 375px (mobile), 768px (tablet), 1920px (desktop)

---

**Document Version**: 1.0
**Last Updated**: November 17, 2025
**Test Coverage**: Comprehensive (all clinical paths, edge cases, validations)
