# MELD-Na Calculator Test Data

## Comprehensive Test Scenarios for QA Validation

This document provides detailed test cases with expected results for validating the MELD-Na calculator implementation.

---

## 1. Score Range Test Cases

### Test Case 1.1: Low Risk (MELD-Na 6-9)
**Clinical Scenario**: Compensated cirrhosis with well-controlled liver function

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creatinine | 0.8 mg/dL | Below lower bound |
| Bilirubin | 0.9 mg/dL | Below lower bound |
| INR | 1.0 | At lower bound |
| Sodium | 140 mEq/L | Normal |
| Dialysis | No | - |

**Expected Results**:
- MELD Score: 6
- MELD-Na Score: 6
- 3-Month Mortality: 1.9%
- Risk Category: Low risk
- Clinical Notes: "Creatinine set to lower bound of 1.0 mg/dL; Bilirubin set to lower bound of 1.0 mg/dL; MELD score capped at minimum of 6"
- Interpretation: "Low risk of 3-month mortality... Monitor closely; transplant evaluation if disease progresses"

---

### Test Case 1.2: Moderate Risk (MELD-Na 10-19)
**Clinical Scenario**: Decompensated cirrhosis, early transplant candidate

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creatinine | 1.5 mg/dL | Mildly elevated |
| Bilirubin | 2.5 mg/dL | Elevated |
| INR | 1.5 | Elevated |
| Sodium | 135 mEq/L | Low-normal |
| Dialysis | No | - |

**Expected Results**:
- MELD Score: 13-15 (calculated)
- MELD-Na Score: ~16-18 (with sodium correction)
- 3-Month Mortality: 6.0%
- Risk Category: Moderate risk
- Interpretation: Should include "Patient meets criteria for liver transplant evaluation" and "Candidate for transplant listing"

---

### Test Case 1.3: High Risk (MELD-Na 20-29)
**Clinical Scenario**: Advanced cirrhosis with hepatorenal component

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creatinine | 2.5 mg/dL | Significantly elevated |
| Bilirubin | 8.0 mg/dL | Significantly elevated |
| INR | 2.0 | Significantly elevated |
| Sodium | 130 mEq/L | Hyponatremia |
| Dialysis | No | - |

**Expected Results**:
- MELD Score: ~23-25
- MELD-Na Score: ~26-28
- 3-Month Mortality: 19.6%
- Risk Category: High risk
- Interpretation: "Patient meets criteria for liver transplant evaluation... High priority for transplantation"

---

### Test Case 1.4: Very High Risk (MELD-Na 30-39)
**Clinical Scenario**: Severe decompensated cirrhosis with multi-organ dysfunction

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creatinine | 3.5 mg/dL | Severe renal dysfunction |
| Bilirubin | 15.0 mg/dL | Severe hyperbilirubinemia |
| INR | 2.5 | Severe coagulopathy |
| Sodium | 128 mEq/L | Moderate hyponatremia |
| Dialysis | No | - |

**Expected Results**:
- MELD Score: ~32-35
- MELD-Na Score: ~34-37
- 3-Month Mortality: 52.6%
- Risk Category: Very high risk
- Interpretation: Urgent transplantation needed

---

### Test Case 1.5: Critical Risk (MELD-Na = 40)
**Clinical Scenario**: Acute-on-chronic liver failure

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creatinine | 4.0 mg/dL | At upper cap |
| Bilirubin | 30.0 mg/dL | Extreme hyperbilirubinemia |
| INR | 4.0 | Extreme coagulopathy |
| Sodium | 125 mEq/L | Lower bound for calculation |
| Dialysis | No | - |

**Expected Results**:
- MELD Score: 40 (capped)
- MELD-Na Score: 40 (capped)
- 3-Month Mortality: >70%
- Risk Category: Critical risk
- Clinical Notes: "MELD score capped at maximum of 40"

---

## 2. Sodium Correction Test Cases

### Test Case 2.1: Sodium Correction Applied (MELD > 11)
**Clinical Scenario**: MELD score above threshold triggers sodium correction

| Parameter | Value | Expected Behavior |
|-----------|-------|-------------------|
| Creatinine | 2.0 mg/dL | Within normal calculation range |
| Bilirubin | 3.0 mg/dL | Moderate elevation |
| INR | 1.8 | Moderate elevation |
| Sodium | 130 mEq/L | Below 137 - should increase MELD-Na |
| Dialysis | No | - |

**Expected Results**:
- MELD Score: ~17-19
- MELD-Na Score: > MELD (due to hyponatremia)
- Delta: MELD-Na should be 2-4 points higher than MELD
- Clinical Notes: Should NOT mention "MELD-Na equals MELD"

---

### Test Case 2.2: Sodium Correction NOT Applied (MELD ≤ 11)
**Clinical Scenario**: Low MELD score, no sodium correction

| Parameter | Value | Expected Behavior |
|-----------|-------|-------------------|
| Creatinine | 1.0 mg/dL | Lower bound |
| Bilirubin | 1.5 mg/dL | Minimal elevation |
| INR | 1.2 | Minimal elevation |
| Sodium | 130 mEq/L | Low but should not affect score |
| Dialysis | No | - |

**Expected Results**:
- MELD Score: ≤11
- MELD-Na Score: = MELD (identical)
- Clinical Notes: "MELD-Na equals MELD (sodium correction only applies when MELD > 11)"

---

### Test Case 2.3: Sodium Lower Bound (125 mEq/L)
**Clinical Scenario**: Severe hyponatremia capped at lower bound

| Parameter | Value | Expected Behavior |
|-----------|-------|-------------------|
| Creatinine | 2.0 mg/dL | - |
| Bilirubin | 4.0 mg/dL | - |
| INR | 1.8 | - |
| Sodium | 120 mEq/L | Should be adjusted to 125 |
| Dialysis | No | - |

**Expected Results**:
- Clinical Notes: "Sodium set to lower bound of 125 mEq/L for MELD-Na calculation"
- MELD-Na calculation uses Na = 125, not 120

---

### Test Case 2.4: Sodium Upper Bound (137 mEq/L)
**Clinical Scenario**: Normal/high sodium capped at upper bound

| Parameter | Value | Expected Behavior |
|-----------|-------|-------------------|
| Creatinine | 2.0 mg/dL | - |
| Bilirubin | 4.0 mg/dL | - |
| INR | 1.8 | - |
| Sodium | 145 mEq/L | Should be adjusted to 137 |
| Dialysis | No | - |

**Expected Results**:
- Clinical Notes: "Sodium set to upper bound of 137 mEq/L for MELD-Na calculation"
- MELD-Na = MELD (no increase from sodium when at/above 137)

---

## 3. Dialysis Adjustment Test Cases

### Test Case 3.1: Dialysis Override (Low Creatinine)
**Clinical Scenario**: Patient on dialysis with otherwise low creatinine

| Parameter | Value | Expected Behavior |
|-----------|-------|-------------------|
| Creatinine | 1.5 mg/dL | Should be overridden to 4.0 |
| Bilirubin | 3.0 mg/dL | - |
| INR | 1.5 | - |
| Sodium | 135 mEq/L | - |
| Dialysis | Yes | Triggers Cr = 4.0 |

**Expected Results**:
- Clinical Notes: "Creatinine set to 4.0 mg/dL (dialysis ≥2x/week or 24hr CVVHD)"
- MELD Score: Should reflect Cr = 4.0, not 1.5
- Significantly higher MELD than if dialysis unchecked

---

### Test Case 3.2: Dialysis Override (High Creatinine)
**Clinical Scenario**: Patient on dialysis with already high creatinine

| Parameter | Value | Expected Behavior |
|-----------|-------|-------------------|
| Creatinine | 5.0 mg/dL | Would normally cap at 4.0 |
| Bilirubin | 3.0 mg/dL | - |
| INR | 1.5 | - |
| Sodium | 135 mEq/L | - |
| Dialysis | Yes | Sets Cr = 4.0 (takes precedence) |

**Expected Results**:
- Clinical Notes: "Creatinine set to 4.0 mg/dL (dialysis ≥2x/week or 24hr CVVHD)" (NOT "capped at 4.0")
- Dialysis note takes precedence over capping note

---

## 4. Lower Bound Adjustment Test Cases

### Test Case 4.1: Creatinine Lower Bound
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 0.5 mg/dL | Adjusted to 1.0 |
| Bilirubin | 2.0 mg/dL | No adjustment |
| INR | 1.5 | No adjustment |
| Sodium | 135 mEq/L | No adjustment |
| Dialysis | No | - |

**Expected**: Clinical Notes: "Creatinine set to lower bound of 1.0 mg/dL"

---

### Test Case 4.2: Bilirubin Lower Bound
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 1.5 mg/dL | No adjustment |
| Bilirubin | 0.5 mg/dL | Adjusted to 1.0 |
| INR | 1.5 | No adjustment |
| Sodium | 135 mEq/L | No adjustment |
| Dialysis | No | - |

**Expected**: Clinical Notes: "Bilirubin set to lower bound of 1.0 mg/dL"

---

### Test Case 4.3: INR Lower Bound
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 1.5 mg/dL | No adjustment |
| Bilirubin | 2.0 mg/dL | No adjustment |
| INR | 0.9 | Adjusted to 1.0 |
| Sodium | 135 mEq/L | No adjustment |
| Dialysis | No | - |

**Expected**: Clinical Notes: "INR set to lower bound of 1.0"

---

### Test Case 4.4: All Lower Bounds Simultaneously
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 0.5 mg/dL | Adjusted to 1.0 |
| Bilirubin | 0.5 mg/dL | Adjusted to 1.0 |
| INR | 0.9 | Adjusted to 1.0 |
| Sodium | 140 mEq/L | No adjustment |
| Dialysis | No | - |

**Expected**:
- MELD Score: 6 (minimum)
- Clinical Notes should include all three adjustments:
  - "Creatinine set to lower bound of 1.0 mg/dL"
  - "Bilirubin set to lower bound of 1.0 mg/dL"
  - "INR set to lower bound of 1.0"
  - "MELD score capped at minimum of 6"

---

## 5. Upper Bound Adjustment Test Cases

### Test Case 5.1: Creatinine Upper Bound (Without Dialysis)
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 6.0 mg/dL | Capped at 4.0 |
| Bilirubin | 3.0 mg/dL | No adjustment |
| INR | 1.5 | No adjustment |
| Sodium | 135 mEq/L | No adjustment |
| Dialysis | No | - |

**Expected**: Clinical Notes: "Creatinine capped at 4.0 mg/dL"

---

### Test Case 5.2: MELD Score Upper Bound (40)
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 4.0 mg/dL | At cap |
| Bilirubin | 50.0 mg/dL | At input maximum |
| INR | 10.0 | At input maximum |
| Sodium | 135 mEq/L | - |
| Dialysis | No | - |

**Expected**:
- MELD Score: 40 (capped)
- MELD-Na Score: 40 (capped)
- Clinical Notes: May include "MELD score capped at maximum of 40"

---

## 6. Input Validation Test Cases

### Test Case 6.1: Missing All Inputs
**Action**: Click Calculate without entering any values

**Expected**: Error: "Please enter all required values (creatinine, bilirubin, INR, and sodium)."

---

### Test Case 6.2: Creatinine Out of Range (Too Low)
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 0.05 mg/dL | Validation error |
| Bilirubin | 2.0 mg/dL | - |
| INR | 1.5 | - |
| Sodium | 135 mEq/L | - |

**Expected**: Error: "Creatinine must be between 0.1 and 15.0 mg/dL"

---

### Test Case 6.3: Creatinine Out of Range (Too High)
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 20.0 mg/dL | Validation error |
| Bilirubin | 2.0 mg/dL | - |
| INR | 1.5 | - |
| Sodium | 135 mEq/L | - |

**Expected**: Error: "Creatinine must be between 0.1 and 15.0 mg/dL"

---

### Test Case 6.4: Bilirubin Out of Range
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 1.5 mg/dL | - |
| Bilirubin | 60.0 mg/dL | Validation error |
| INR | 1.5 | - |
| Sodium | 135 mEq/L | - |

**Expected**: Error: "Bilirubin must be between 0.1 and 50.0 mg/dL"

---

### Test Case 6.5: INR Out of Range
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 1.5 mg/dL | - |
| Bilirubin | 2.0 mg/dL | - |
| INR | 12.0 | Validation error |
| Sodium | 135 mEq/L | - |

**Expected**: Error: "INR must be between 0.8 and 10.0"

---

### Test Case 6.6: Sodium Out of Range (Too Low)
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 1.5 mg/dL | - |
| Bilirubin | 2.0 mg/dL | - |
| INR | 1.5 | - |
| Sodium | 100 mEq/L | Validation error |

**Expected**: Error: "Sodium must be between 110 and 160 mEq/L"

---

### Test Case 6.7: Sodium Out of Range (Too High)
| Parameter | Value | Expected |
|-----------|-------|----------|
| Creatinine | 1.5 mg/dL | - |
| Bilirubin | 2.0 mg/dL | - |
| INR | 1.5 | - |
| Sodium | 170 mEq/L | Validation error |

**Expected**: Error: "Sodium must be between 110 and 160 mEq/L"

---

## 7. Edge Cases and Special Scenarios

### Test Case 7.1: Normal Healthy Patient
**Clinical Scenario**: Hypothetical healthy individual (educational purposes)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creatinine | 1.0 mg/dL | Normal |
| Bilirubin | 1.0 mg/dL | Normal |
| INR | 1.0 | Normal |
| Sodium | 140 mEq/L | Normal |
| Dialysis | No | - |

**Expected Results**:
- MELD Score: 6 (minimum)
- MELD-Na Score: 6
- Risk Category: Low risk
- 3-Month Mortality: 1.9%

---

### Test Case 7.2: Borderline MELD = 11 (Exactly)
**Clinical Scenario**: Testing sodium correction threshold

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creatinine | 1.0 mg/dL | - |
| Bilirubin | 3.0 mg/dL | Tuned for MELD ≈ 11 |
| INR | 1.2 | - |
| Sodium | 130 mEq/L | Low |
| Dialysis | No | - |

**Expected Results**:
- MELD Score: Should be ≤11
- MELD-Na Score: = MELD (no sodium correction at boundary)
- Clinical Notes: "MELD-Na equals MELD (sodium correction only applies when MELD > 11)"

---

### Test Case 7.3: Borderline MELD = 12 (Just Above Threshold)
**Clinical Scenario**: Testing sodium correction activation

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creatinine | 1.0 mg/dL | - |
| Bilirubin | 3.5 mg/dL | Tuned for MELD ≈ 12 |
| INR | 1.3 | - |
| Sodium | 130 mEq/L | Low |
| Dialysis | No | - |

**Expected Results**:
- MELD Score: Should be >11
- MELD-Na Score: > MELD (sodium correction should apply)
- No "MELD-Na equals MELD" note

---

### Test Case 7.4: Decimal Input Precision
**Clinical Scenario**: Testing decimal handling

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creatinine | 1.23 mg/dL | Decimal |
| Bilirubin | 2.45 mg/dL | Decimal |
| INR | 1.67 | Decimal |
| Sodium | 134.5 mEq/L | Decimal |
| Dialysis | No | - |

**Expected Results**:
- Should calculate correctly
- Results displayed as integers (rounded)

---

### Test Case 7.5: Minimum Sodium (125) with High MELD
**Clinical Scenario**: Maximum sodium impact on MELD-Na

| Parameter | Value | Notes |
|-----------|-------|-------|
| Creatinine | 2.0 mg/dL | - |
| Bilirubin | 4.0 mg/dL | - |
| INR | 1.8 | - |
| Sodium | 125 mEq/L | At lower bound |
| Dialysis | No | - |

**Expected Results**:
- MELD-Na should be significantly higher than MELD
- Maximum sodium correction applied
- Delta: MELD-Na - MELD should be ~4-6 points

---

## 8. Transplant Eligibility Test Cases

### Test Case 8.1: Below Threshold (MELD-Na < 15)
**Clinical Scenario**: Not yet transplant candidate

| Parameter | Value | Expected Interpretation |
|-----------|-------|------------------------|
| Creatinine | 1.2 mg/dL | - |
| Bilirubin | 1.5 mg/dL | - |
| INR | 1.3 | - |
| Sodium | 138 mEq/L | - |

**Expected**: "Monitor closely; transplant evaluation if disease progresses"
**Should NOT include**: "Patient meets criteria for liver transplant evaluation"

---

### Test Case 8.2: Transplant Eligible (MELD-Na 15-24)
**Clinical Scenario**: Meets criteria, candidate for listing

| Parameter | Value | Expected Interpretation |
|-----------|-------|------------------------|
| Creatinine | 2.0 mg/dL | - |
| Bilirubin | 3.0 mg/dL | - |
| INR | 1.6 | - |
| Sodium | 132 mEq/L | - |

**Expected**:
- "Patient meets criteria for liver transplant evaluation (MELD-Na ≥15)"
- "Candidate for transplant listing"

---

### Test Case 8.3: High Priority (MELD-Na ≥ 25)
**Clinical Scenario**: High priority for transplantation

| Parameter | Value | Expected Interpretation |
|-----------|-------|------------------------|
| Creatinine | 3.0 mg/dL | - |
| Bilirubin | 10.0 mg/dL | - |
| INR | 2.2 | - |
| Sodium | 128 mEq/L | - |

**Expected**:
- "Patient meets criteria for liver transplant evaluation (MELD-Na ≥15)"
- "High priority for transplantation"

---

## 9. Clinical Workflow Test Cases

### Test Case 9.1: Complete Workflow
**Steps**:
1. Enter initial values (Cr 2.8, Bili 5.2, INR 1.9, Na 131)
2. Calculate
3. Verify results display
4. Check dialysis checkbox
5. Recalculate
6. Verify dialysis note appears and score changes

**Expected**: All results should update correctly, dialysis note should appear

---

### Test Case 9.2: Recalculation with Different Values
**Steps**:
1. Calculate with low values (MELD ~10)
2. Update to high values (MELD ~25)
3. Recalculate
4. Verify second MELD > first MELD

**Expected**: Progressive increase in scores

---

## 10. Accessibility Test Cases

### Test Case 10.1: Keyboard Navigation
**Steps**:
1. Tab to creatinine field, enter value
2. Tab to bilirubin field, enter value
3. Tab to INR field, enter value
4. Tab to sodium field, enter value
5. Tab to dialysis switch, press Space to toggle
6. Tab to Calculate button, press Enter

**Expected**: All values entered correctly, calculation triggered

---

### Test Case 10.2: ARIA Labels
**Verify**:
- All inputs have proper type attributes
- Dialysis switch has `role="switch"` and `aria-checked`
- Results section has `aria-live="polite"`

---

## Summary Statistics

- **Total Test Scenarios**: 40+
- **Coverage Categories**: 10
- **Score Ranges Tested**: 5 (Low, Moderate, High, Very High, Critical)
- **Boundary Conditions**: 15+
- **Validation Errors**: 7
- **Edge Cases**: 5+
- **Clinical Workflows**: 2
- **Accessibility Tests**: 2

---

**Test Data Version**: 1.0
**Last Updated**: 2025-11-17
**Test File**: `/tests/e2e/calculators/hepatology/meld-na.spec.js`
