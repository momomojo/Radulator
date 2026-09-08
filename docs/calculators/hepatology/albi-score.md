# ALBI Score — user guide

Calculator ID: `albi-score`. Permanent route: `/#/albi-score`.

This guide describes use, not completion status. The sole authoritative
[clinical review, verification and release record](../../verification/calculators/albi-score.md)
tracks accepted scope, source locators, tests, history and outstanding work.

## Purpose

Calculate the original Johnson 2015 Albumin-Bilirubin score and three grades
from serum albumin and total bilirubin. The model describes liver-function
prognosis in studied HCC and chronic-liver-disease cohorts. It does not include
tumour burden, determine treatment eligibility, predict individual survival,
or predict post-transplant outcomes. Modified ALBI, ALBI-T and TACE nomograms
are not implemented by this calculator.

## Use

1. Explicitly select SI or US units; neither is assumed in the browser.
2. Enter serum albumin in g/L (SI) or g/dL (US), and total bilirubin in µmol/L
   (SI) or mg/dL (US), using the laboratory report.
3. Calculate. Review the score, grade, applicability and any input warning.
4. Copy Results copies the displayed report; Print Results invokes the browser
   print workflow. Reset clears inputs and results.

Changing an input or the unit selection clears stale results. Switching units
does **not** convert the numbers already entered: replace them with the values
in the newly selected units before calculating.

## Calculation and report

`ALBI = 0.66 × log10(total bilirubin in µmol/L) − 0.085 × albumin in g/L`.
US conversions use albumin ×10 and bilirubin ×17.104. Calculation and grading
retain full precision; the displayed score has three decimals.

| Grade | Unrounded score | Meaning within the original model |
|---|---|---|
| 1 | ≤−2.60 | Lowest-risk group |
| 2 | >−2.60 and ≤−1.39 | Intermediate-risk group |
| 3 | >−1.39 | Highest-risk group |

A score just above a cutoff can round to that cutoff while retaining the next
grade. The report explains this. Laboratory displays normally use one decimal;
small positive values that would display as zero instead use three significant
digits. Examples: SI 40/10 → −2.740/Grade 1; US 4/1 → −2.586/Grade 2.

## Validation and applicability

Both measurements must be positive finite decimal values. Blank, malformed,
zero, negative, non-finite and unrepresentable converted values are rejected.
No grade is returned for invalid input.

Albumin outside 5–60 g/L or bilirubin outside 1–1000 µmol/L triggers a visible
input check after SI conversion; endpoints are included. These are **software
review thresholds**, not physiological ranges or validated model eligibility
limits. Valid arithmetic remains available with a warning to verify the
laboratory report and units. Computability is not proof of clinical
applicability. The warning accompanies copied/printed results and prevents
green Grade 1 styling.

## Evidence

- [Johnson et al., JCO 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4322258/): original equation, grade intervals and studied populations.
- [AMA conversion table](https://academic.oup.com/amamanualofstyle/si-conversion-calculator): serum albumin and total bilirubin conversions.
- [EASL HCC guidance 2025](https://easlcampus.eu/sites/default/files/2025-02/EASL_CPG_Management_HCC.pdf), printed pp.335,349–350: ALBI within broader assessment, not a treatment-selection algorithm.

The five references displayed in the calculator distinguish original-model
evidence from supporting prognostic/nomogram research. Bibliographic inclusion
does not mean that a cited paper's other models are implemented. See the
canonical record for accessible source scope and verification limitations.
