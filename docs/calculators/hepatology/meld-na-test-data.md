# MELD 3.0 / MELD-Na Calculator Test Data

This document lists the focused QA scenarios for the `meld-na` calculator after adding current MELD 3.0 while preserving the temporary legacy MELD-Na option.

## Scope

- Current model: MELD 3.0 for candidates at least 12 years old.
- Adolescent path: age 12-17 at registration, `+7.33` constant for all sexes.
- Adult path: age 18 or older at registration, adult female term `+1.33` plus `+6` constant.
- Legacy model: MELD-Na (OPTN 2016) remains available for comparison and education.

Clinical signoff source: kanban parent gate `t_10a996a5`, comment `868`, owner-authenticated at `2026-07-07T04:05:53Z`.

Signed-off packet SHA-256: `cef58cc2577687e7f795e82c6fa9213c8cff35e47df70d1c64d51c14a6b1cc35`

Verifier output: `/Users/agent/.hermes/profiles/radulator/task-notes/meld30_audit_recompute_t45134910.json`

## MELD 3.0 Verifier Examples

### Test Case 1: Low-Score Bounded Normal Male

| Parameter | Value |
|---|---:|
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
- Calculation Path: Adult age ≥18 at registration
- Notes include lower/upper bounds for creatinine, bilirubin, sodium, and albumin.

### Test Case 2: Adult Female Sex Term

| Parameter | Value |
|---|---:|
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

### Test Case 6: Adolescent Path

| Parameter | Value |
|---|---:|
| Age at registration | 16 |
| Creatinine | 1.0 mg/dL |
| Total bilirubin | 1.5 mg/dL |
| INR | 1.2 |
| Sodium | 135 mEq/L |
| Albumin | 3.0 g/dL |
| Dialysis | No |

Expected:

- MELD 3.0 Score: 13
- Calculation Path: Adolescent age 12-17 at registration
- Clinical Notes: "Age 12-17 path used: MELD 3.0 applies +7.33 constant for all sexes"
- Adult sex selector is hidden.

## MELD 3.0 Validation Cases

### Missing Age

Inputs: current MELD 3.0 model selected with shared labs present but no age.

Expected error:

```text
Please enter age at registration for MELD 3.0.
```

### Age Under 12

Inputs: age at registration 11 with otherwise valid MELD 3.0 labs.

Expected error:

```text
MELD 3.0 applies to candidates at least 12 years old; use the pediatric PELD/PELD Cr pathway for younger candidates.
```

### Missing Adult Sex

Inputs: age at registration 18 or older with otherwise valid MELD 3.0 labs and no adult sex selection.

Expected error:

```text
Please select sex for adult MELD 3.0 calculation.
```

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

- Clinical Notes: "Creatinine set to 4.0 mg/dL (dialysis ≥2x/week or 24hr CVVHD)"
- Should not show "Creatinine capped at 4.0 mg/dL" for this branch.

## Reference Checks

The calculator references should include:

1. OPTN/HRSA MELD/PELD policy notice.
2. OPTN/HRSA implementation FAQ.
3. Kim WR et al. Gastroenterology 2021 MELD 3.0 paper.
4. Kim WR et al. Gastroenterology 2008 MELD-Na paper.
5. Kamath PS et al. Hepatology 2001 original MELD paper.
