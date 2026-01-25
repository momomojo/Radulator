# Visual Testing Report: TI-RADS, PI-RADS, Fleischner Calculators

**Date:** 2026-01-24
**Tester:** Claude Code Agent
**Branch:** main
**Tool:** Playwright E2E (headed mode)
**Browser:** Chromium

## Summary

All three new calculators (TI-RADS, PI-RADS, Fleischner) have been visually verified and are working correctly on the development server at http://localhost:5173.

## Test Results

### 1. ACR TI-RADS Calculator

**Test Values:**

- Composition: Solid or almost completely solid (2 pts)
- Echogenicity: Hypoechoic (2 pts)
- Shape: Taller-than-wide (3 pts)
- Margin: Lobulated or irregular (2 pts)
- Echogenic Foci: Punctate echogenic foci (3 pts)
- Nodule Size: 1.5 cm

**Expected Result:** TR5 - Highly Suspicious, 12 points, FNA recommended

**Actual Result:**

- TI-RADS Category: TR5 - Highly Suspicious
- Total Points: 12 points
- Point Breakdown: Composition: 2 | Echogenicity: 2 | Shape: 3 | Margin: 2 | Echogenic Foci: 3
- Estimated Malignancy Risk: >20%
- FNA Recommendation: FNA recommended (>=1.0 cm)
- Clinical Notes: Punctate echogenic foci may represent psammomatous calcifications; Taller-than-wide shape suggests growth across tissue planes

**Status:** PASS

**Screenshot:** `tests/reports/tirads-complete.png`

---

### 2. PI-RADS v2.1 Calculator

**Test Values:**

- Zone: Peripheral Zone (PZ)
- Lesion Size: 1.2 cm
- T2W Score: 3
- DWI Score: 4
- DCE: Positive
- EPE: No
- SVI: No

**Expected Result:** PI-RADS 4 (DWI dominant in PZ)

**Actual Result:**

- PI-RADS Category: 4 - High
- Dominant Sequence: DWI (Peripheral Zone)
- Scoring Logic: PI-RADS category based on DWI score (4)
- Cancer Probability: Clinically significant cancer likely (25-50%)
- Biopsy Recommendation: Biopsy recommended (MRI-targeted)
- T2W Score: 3
- DWI/ADC Score: 4
- DCE Status: Positive
- Lesion Size: 1.2 cm
- Clinical Notes: MRI-targeted biopsy recommended over systematic biopsy alone

**Status:** PASS

**Screenshot:** `tests/reports/pirads-complete.png`

---

### 3. Fleischner Guidelines Calculator

**Test Values:**

- Nodule Type: Solid nodule
- Number: Single nodule
- Size: 7 mm
- Risk Level: High risk

**Expected Result:** CT at 6-12 months, then 18-24 months for high-risk 6-8mm nodule

**Actual Result:**

- Recommendation: CT at 6-12 months, then CT at 18-24 months
- Follow-up Interval: 6-12 months, then 18-24 months
- Rationale: Intermediate probability; two follow-up scans recommended for high-risk patients
- Nodule Characteristics: Solid, single, 7mm
- Risk Assessment: High risk
- Important Caveats: Guidelines apply to incidental nodules in adults >=35 years. NOT for lung cancer screening, immunocompromised patients, or known malignancy.

**Status:** PASS

**Screenshot:** `tests/reports/fleischner-complete.png`

---

## UI/UX Verification

| Check                      | TI-RADS | PI-RADS | Fleischner |
| -------------------------- | ------- | ------- | ---------- |
| Calculator loads           | PASS    | PASS    | PASS       |
| Fields render correctly    | PASS    | PASS    | PASS       |
| Radio buttons work         | PASS    | PASS    | PASS       |
| Number input works         | PASS    | PASS    | PASS       |
| Calculate button works     | PASS    | PASS    | PASS       |
| Results display            | PASS    | PASS    | PASS       |
| References visible         | PASS    | PASS    | PASS       |
| Medical disclaimer visible | PASS    | PASS    | PASS       |
| Sidebar navigation         | PASS    | PASS    | PASS       |

## Calculator Integration

- All three calculators appear in the sidebar under appropriate categories
- Calculator definitions follow project patterns
- References include peer-reviewed sources with DOI links
- Field types appropriately chosen for each input

## Conclusion

All three calculators have been successfully integrated and are producing clinically accurate results based on established guidelines:

- TI-RADS: ACR TI-RADS 2017 guidelines
- PI-RADS: PI-RADS v2.1 2019 guidelines
- Fleischner: Fleischner Society 2017 guidelines
