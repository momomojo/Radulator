# MELD 3.0 / MELD-Na Calculator Documentation

## Overview

This calculator keeps the permanent Radulator ID `meld-na` while adding **MELD 3.0** as the current OPTN liver-allocation score option. The prior **MELD-Na (OPTN 2016)** calculation remains available as a temporary legacy option for comparison and education.

Clinical signoff source: kanban parent gate `t_10a996a5`, owner-authenticated approval comment `868` at `2026-07-07T04:05:53Z`.

Signed-off packet: `/Users/agent/nas-mounts/vault-mohibhafeez/Radulator/medical-evidence/calculators/meld-na/signoff/meld-3.0-signoff-packet.md`

Packet SHA-256: `cef58cc2577687e7f795e82c6fa9213c8cff35e47df70d1c64d51c14a6b1cc35`

## Calculator ID

- **Component Name**: `MELDNa`
- **URL Path**: `/meld-na`
- **Category**: Hepatology/Liver
- **Medical Specialty**: Hepatology, Transplant Medicine, Gastroenterology

## Clinical Scope

### Current MELD 3.0 Option

- Applies to liver-transplant candidates at least 12 years old.
- Age 12-17 at registration uses the adolescent MELD 3.0 path with `+7.33` constant for all sexes.
- Age 18 or older at registration uses the adult MELD 3.0 path with `+1.33` adult female term and `+6` constant.
- Outputs the MELD 3.0 score plus cautious prognosis context.
- Does not provide treatment directives, exception-score workflow, listing decisions, or organ-allocation decisions.

### Temporary Legacy Option

- Preserves MELD-Na calculation behavior for comparison and education.
- Uses the existing MELD-Na sodium correction and legacy 3-month mortality categories.
- Should be interpreted as a legacy pathway, not the current OPTN MELD 3.0 allocation model.

## MELD 3.0 Formula

### Adult Path, Age at Registration 18 or Older

```text
MELD 3.0 =
1.33(if female)
+ 4.56 * ln(bilirubin)
+ 0.82 * (137 - sodium)
- 0.24 * (137 - sodium) * ln(bilirubin)
+ 9.09 * ln(INR)
+ 11.14 * ln(creatinine)
+ 1.85 * (3.5 - albumin)
- 1.83 * (3.5 - albumin) * ln(creatinine)
+ 6
```

### Adolescent Path, Age at Registration 12-17

```text
MELD 3.0 =
4.56 * ln(bilirubin)
+ 0.82 * (137 - sodium)
- 0.24 * (137 - sodium) * ln(bilirubin)
+ 9.09 * ln(INR)
+ 11.14 * ln(creatinine)
+ 1.85 * (3.5 - albumin)
- 1.83 * (3.5 - albumin) * ln(creatinine)
+ 7.33
```

### MELD 3.0 Bounds

- Creatinine, bilirubin, and INR values below 1.0 are set to 1.0.
- Creatinine values above 3.0 mg/dL are set to 3.0.
- Dialysis/CVVHD rule sets creatinine to 3.0 mg/dL for MELD 3.0.
- Sodium is bounded to 125-137 mEq/L.
- Albumin is bounded to 1.5-3.5 g/dL.
- Final score is rounded to the nearest integer and capped 6-40.

## Legacy MELD-Na Formula

```text
MELD = [0.957 * ln(creatinine) + 0.378 * ln(bilirubin) + 1.120 * ln(INR) + 0.643] * 10
MELD-Na = MELD + 1.32 * (137 - sodium) - [0.033 * MELD * (137 - sodium)]
```

Legacy MELD-Na bounds:

- Creatinine, bilirubin, and INR values below 1.0 are set to 1.0.
- Creatinine values above 4.0 mg/dL are set to 4.0.
- Dialysis/CVVHD rule sets creatinine to 4.0 mg/dL for legacy MELD-Na.
- Sodium correction only applies when MELD is greater than 11.
- Sodium is bounded to 125-137 mEq/L for the MELD-Na correction.
- Final MELD and MELD-Na scores are rounded and capped 6-40.

## Inputs

- **Scoring model**: current MELD 3.0 or temporary legacy MELD-Na.
- **Age at registration**: required for MELD 3.0; validates 12-120 years.
- **Sex for adult MELD 3.0 calculation**: required only when age at registration is 18 or older.
- **Creatinine**: mg/dL, input validation 0.1-15.0.
- **Total bilirubin**: mg/dL, input validation 0.1-50.0.
- **INR**: input validation 0.8-10.0.
- **Sodium**: mEq/L, input validation 110-160.
- **Serum albumin**: g/dL, required for MELD 3.0, input validation 0.5-8.0.
- **Dialysis**: dialysis at least twice in the past week or 24-hour CVVHD.

## Outputs

### MELD 3.0

- **MELD 3.0 Score**: integer 6-40.
- **Calculation Path**: adult or adolescent age-at-registration path.
- **Prognosis Context**: cautious text describing that higher MELD 3.0 values correspond to higher 90-day waitlist mortality risk in transplant-candidate cohorts.
- **Legacy MELD-Na**: notes that legacy MELD-Na remains available in the temporary option.
- **Clinical Notes**: value bounds and path-specific adjustments applied.

### Legacy MELD-Na

- **MELD Score**
- **MELD-Na Score**
- **3-Month Mortality**
- **Risk Category**
- **Interpretation**
- **Clinical Notes**

## Signed-Off MELD 3.0 Test Vectors

| Scenario | Inputs | Expected MELD 3.0 |
|---|---|---:|
| Low-score bounded normal male | male, Cr 0.8, bili 0.8, INR 1.0, Na 140, albumin 4.0, no dialysis | 6 |
| Adult female sex term | female, Cr 1.0, bili 1.5, INR 1.2, Na 135, albumin 3.0, no dialysis | 13 |
| Same labs as prior, adult male | male, Cr 1.0, bili 1.5, INR 1.2, Na 135, albumin 3.0, no dialysis | 12 |
| Hypoalbuminemia | male, Cr 1.0, bili 2.0, INR 1.5, Na 137, albumin 1.8, no dialysis | 16 |
| High-score female with hyponatremia | female, Cr 2.5, bili 10.0, INR 2.2, Na 128, albumin 2.8, no dialysis | 38 |
| Same labs as prior, adult male | male, Cr 2.5, bili 10.0, INR 2.2, Na 128, albumin 2.8, no dialysis | 36 |
| Dialysis/creatinine cap | male, Cr 5.0, bili 2.0, INR 1.5, Na 137, albumin 3.5, dialysis | 25 |
| Adolescent path check | age 16, Cr 1.0, bili 1.5, INR 1.2, Na 135, albumin 3.0, no dialysis | 13 |

Verifier output: `/Users/agent/.hermes/profiles/radulator/task-notes/meld30_audit_recompute_t45134910.json`

## References

1. OPTN/HRSA. *Improving Liver Allocation: MELD, PELD, Status 1A, Status 1B.* Policy notice, Board approved June 27, 2022. https://www.hrsa.gov/sites/default/files/hrsa/optn/policy-guid-change_impr-liv-alloc-meld-peld-sta-1a-sta-1b_liv.pdf
2. OPTN/HRSA. *Improving Liver Allocation: General Implementation FAQ.* https://www.hrsa.gov/sites/default/files/hrsa/optn/improving-liver-allocation-general-implementation-faq.pdf
3. Kim WR et al. MELD 3.0: The Model for End-Stage Liver Disease Updated for the Modern Era. *Gastroenterology.* 2021. https://doi.org/10.1053/j.gastro.2021.08.050
4. Kim WR et al. Hyponatremia and mortality among patients on the liver-transplant waiting list. *N Engl J Med.* 2008. https://doi.org/10.1056/NEJMoa0801209
5. Kamath PS et al. A model to predict survival in patients with end-stage liver disease. *Hepatology.* 2001. https://doi.org/10.1053/jhep.2001.22172
