# MELD 3.0 / MELD-Na Calculator Test Data

This document lists the focused QA scenarios for the `meld-na` calculator after adding current MELD 3.0 while preserving the temporary legacy MELD-Na option.

## Scope

- Current model: MELD 3.0 for candidates currently at least 12 years old.
- Registered-before-18 path: `+7.33` constant for all sexes, including candidates who registered before age 12 and later aged into MELD.
- Adult path: registered at age 18 or older, female term `+1.33` when applicable plus `+6` constant.
- Legacy model: MELD-Na (OPTN 2016) remains available for comparison and education.

Clinical signoff source: kanban parent gate `t_10a996a5`, comment `868`, owner-authenticated at `2026-07-07T04:05:53Z`.

Signed-off packet SHA-256: `cef58cc2577687e7f795e82c6fa9213c8cff35e47df70d1c64d51c14a6b1cc35`

Verifier output: `/Users/agent/.hermes/profiles/radulator/task-notes/meld30_audit_recompute_t45134910.json`

## MELD 3.0 Verifier Examples

### Test Case 1: Low-Score Bounded Normal Male

| Parameter | Value |
|---|---:|
| Current age | 45 |
| Age at registration | 45 |
| Sex | Male |
| Creatinine | 0.8 mg/dL |
| Total bilirubin | 0.8 mg/dL |
| INR | 1.0 |
| Sodium | 140 mEq/L |
| Albumin | 4.0 g/dL |
| Dialysis | No |

Expected:

- MELD 3.0 Score: 6
- Calculation Path: Registered at age ≥18
- Notes include lower/upper bounds for creatinine, bilirubin, sodium, and albumin.

### Test Case 2: Adult Female Sex Term

| Parameter | Value |
|---|---:|
| Current age | 45 |
| Age at registration | 45 |
| Sex | Female |
| Creatinine | 1.0 mg/dL |
| Total bilirubin | 1.5 mg/dL |
| INR | 1.2 |
| Sodium | 135 mEq/L |
| Albumin | 3.0 g/dL |
| Dialysis | No |

Expected:

- MELD 3.0 Score: 13
- Same labs with adult male selected: 12
- Notes include adult female MELD 3.0 sex term when female is selected.

### Test Case 3: Hypoalbuminemia

| Parameter | Value |
|---|---:|
| Current age | 45 |
| Age at registration | 45 |
| Sex | Male |
| Creatinine | 1.0 mg/dL |
| Total bilirubin | 2.0 mg/dL |
| INR | 1.5 |
| Sodium | 137 mEq/L |
| Albumin | 1.8 g/dL |
| Dialysis | No |

Expected:

- MELD 3.0 Score: 16

### Test Case 4: High-Score Female with Hyponatremia

| Parameter | Value |
|---|---:|
| Current age | 45 |
| Age at registration | 45 |
| Sex | Female |
| Creatinine | 2.5 mg/dL |
| Total bilirubin | 10.0 mg/dL |
| INR | 2.2 |
| Sodium | 128 mEq/L |
| Albumin | 2.8 g/dL |
| Dialysis | No |

Expected:

- MELD 3.0 Score: 38
- Same labs with adult male selected: 36

### Test Case 5: Dialysis / Creatinine Cap

| Parameter | Value |
|---|---:|
| Current age | 45 |
| Age at registration | 45 |
| Sex | Male |
| Creatinine | 5.0 mg/dL |
| Total bilirubin | 2.0 mg/dL |
| INR | 1.5 |
| Sodium | 137 mEq/L |
| Albumin | 3.5 g/dL |
| Dialysis | Yes |

Expected:

- MELD 3.0 Score: 25
- Clinical Notes: "Creatinine set to 3.0 mg/dL for MELD 3.0 (dialysis/CVVHD rule)"

### Test Case 6: Registered-Before-18 Path

| Parameter | Value |
|---|---:|
| Current age | 16 |
| Age at registration | 16 |
| Creatinine | 1.0 mg/dL |
| Total bilirubin | 1.5 mg/dL |
| INR | 1.2 |
| Sodium | 135 mEq/L |
| Albumin | 3.0 g/dL |
| Dialysis | No |

Expected:

- MELD 3.0 Score: 13
- Calculation Path: Registered before age 18; candidate currently age ≥12
- Clinical Notes: "Registered-before-18 path used: MELD 3.0 applies +7.33 constant for all sexes"
- Adult sex selector is hidden.

### Test Case 7: Registered Before Age 12 and Aged into MELD

| Parameter | Value |
|---|---:|
| Current age | 12 |
| Age at registration | 8 |
| Creatinine | 1.0 mg/dL |
| Total bilirubin | 1.5 mg/dL |
| INR | 1.2 |
| Sodium | 135 mEq/L |
| Albumin | 3.0 g/dL |
| Dialysis | No |

Expected:

- MELD 3.0 Score: 13
- Calculation Path: Registered before age 18; candidate currently age ≥12
- Adult sex selector is hidden.

## MELD 3.0 Validation Cases

### Missing Current Age

Inputs: current MELD 3.0 model selected with shared labs and registration age present but no current age.

Expected error:

```text
Please enter current age for MELD 3.0.
```

### Missing Registration Age

Inputs: current MELD 3.0 model selected with shared labs and current age present but no registration age.

Expected error:

```text
Please enter age at registration for MELD 3.0.
```

### Current Age Under 12

Inputs: current age 11 and age at registration 8 with otherwise valid MELD 3.0 labs.

Expected error:

```text
MELD applies only when the candidate is currently at least 12 years old; use PELD/PELD Cr for younger candidates.
```

### Registration Age Exceeds Current Age

Inputs: current age 16 and age at registration 18 with otherwise valid MELD 3.0 labs.

Expected error:

```text
Age at registration cannot exceed current age.
```

### Missing Adult Sex

Inputs: age at registration 18 or older with otherwise valid MELD 3.0 labs and no adult sex selection.

Expected error:

```text
Please select sex for adult MELD 3.0 calculation.
```

### Adult Sex Selection Guidance

When age at registration is 18 or older, the field exposes the current OPTN guidance to select Male or Female in consultation with the candidate. The help text includes the OPTN examples for a candidate receiving feminizing or masculinizing gender-affirming hormone therapy so the `+1.33` term is not applied from an unlabeled assumption.

### No Unsupported Upper-Age Limit

Inputs: current age 121, age at registration 121, adult Male selection, creatinine 1.0, bilirubin 1.5, INR 1.2, sodium 135, and albumin 3.0.

Expected:

- No validation error from an invented maximum age.
- MELD 3.0 Score: 12.
- Prognosis Context begins `MELD 3.0 numeric stratum 10-19` and does not use a qualitative low/intermediate/high label.

### Albumin Bounds

| Albumin input | Expected adjustment |
|---:|---|
| 1.0 g/dL | Albumin set to lower bound of 1.5 g/dL |
| 4.5 g/dL | Albumin set to upper bound of 3.5 g/dL |

## Legacy MELD-Na Regression Cases

The temporary legacy option must preserve existing MELD-Na behavior.

### Legacy Low Risk

| Parameter | Value |
|---|---:|
| Creatinine | 0.8 mg/dL |
| Total bilirubin | 0.9 mg/dL |
| INR | 1.0 |
| Sodium | 140 mEq/L |
| Dialysis | No |

Expected:

- MELD Score: 6
- MELD-Na Score: 6
- 3-Month Mortality: 1.9%
- Risk Category: Low risk

### Legacy Sodium Correction Applied

| Parameter | Value |
|---|---:|
| Creatinine | 2.0 mg/dL |
| Total bilirubin | 3.0 mg/dL |
| INR | 1.8 |
| Sodium | 130 mEq/L |
| Dialysis | No |

Expected:

- MELD-Na Score is greater than MELD Score.
- No "MELD-Na equals MELD" note.

### Legacy Sodium Correction Not Applied

| Parameter | Value |
|---|---:|
| Creatinine | 1.0 mg/dL |
| Total bilirubin | 1.5 mg/dL |
| INR | 1.2 |
| Sodium | 130 mEq/L |
| Dialysis | No |

Expected:

- MELD Score: 11 or lower
- MELD-Na Score equals MELD Score
- Clinical Notes: "MELD-Na equals MELD (sodium correction only applies when MELD > 11)"

### Legacy Dialysis Rule

| Parameter | Value |
|---|---:|
| Creatinine | 5.0 mg/dL |
| Total bilirubin | 3.0 mg/dL |
| INR | 1.5 |
| Sodium | 135 mEq/L |
| Dialysis | Yes |

Expected:

- Clinical Notes: "Creatinine set to 4.0 mg/dL (dialysis twice, or 24 hours of CVVHD, within a week prior to the serum creatinine test)"
- Should not show "Creatinine capped at 4.0 mg/dL" for this branch.

## Reference Checks

The calculator references should include:

1. OPTN Policy 9.1.D - MELD Score.
2. OPTN/HRSA MELD and PELD Calculators User Guide.
3. OPTN/HRSA Policy Notice - Improving Liver Allocation: MELD, PELD, Status 1A, Status 1B.
4. Kim WR et al. Gastroenterology 2021 - MELD 3.0.
5. Kim WR et al. New England Journal of Medicine 2008 - MELD-Na Development.
6. Kamath PS et al. Hepatology 2001 - Original MELD Score.
