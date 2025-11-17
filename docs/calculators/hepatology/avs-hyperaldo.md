# AVS – Aldosterone (Primary Aldosteronism) Calculator

## Overview

The **Adrenal Vein Sampling – Aldosterone (Primary Aldosteronism)** calculator is a comprehensive clinical decision support tool for interpreting adrenal vein sampling (AVS) results in patients with suspected primary aldosteronism (PA). It helps determine whether the patient has unilateral (surgically correctable) or bilateral (medically managed) disease.

**Calculator ID:** `avs-hyperaldo`

**Category:** Hepatology/Liver (Endocrine)

**Clinical Use:** Subspecialty tool for interventional radiologists, endocrinologists, and surgeons managing primary aldosteronism

---

## Clinical Background

### What is Primary Aldosteronism?

Primary aldosteronism (PA) is a condition where one or both adrenal glands produce excessive aldosterone, leading to:
- Resistant hypertension
- Hypokalemia (low potassium)
- Increased cardiovascular risk

### Types of Primary Aldosteronism

1. **Unilateral Disease** (30-40% of cases)
   - Aldosterone-producing adenoma (APA)
   - Unilateral adrenal hyperplasia
   - **Treatment:** Unilateral adrenalectomy

2. **Bilateral Disease** (60-70% of cases)
   - Bilateral adrenal hyperplasia (BAH)
   - **Treatment:** Medical management with mineralocorticoid receptor antagonists (spironolactone, eplerenone)

### Why Adrenal Vein Sampling?

AVS is the gold standard for determining lateralization of aldosterone excess when cross-sectional imaging (CT/MRI) shows:
- Bilateral nodules
- Unilateral nodule but unclear if functional
- No visible nodule despite biochemical confirmation of PA

**Key Clinical Question:** Which adrenal gland is producing the excess aldosterone?

---

## Calculator Features

### 1. Patient Metadata Tracking
- Patient initials (de-identified)
- Procedure date
- Side of nodule seen on imaging
- Procedural notes (e.g., microcatheter use)

### 2. Flexible Unit Selection
**Aldosterone Units:**
- ng/dL (nanograms per deciliter) - US standard
- pg/mL (picograms per milliliter) - Alternative
- Conversion: 1 ng/dL = 10 pg/mL

**Cortisol Units:**
- µg/dL (micrograms per deciliter) - US standard
- nmol/L (nanomoles per liter) - SI units
- Conversion: 1 µg/dL = 27.59 nmol/L

*All calculations use standard units internally (ng/dL, µg/dL) regardless of input units.*

### 3. Multiple Protocol Support

**Pre-ACTH Protocol:**
- No cosyntropin stimulation
- Selectivity Index (SI) threshold: ≥2
- Lateralization Index (LI) threshold: >2

**Post-ACTH Protocol (Recommended):**
- After cosyntropin (ACTH) stimulation
- SI threshold: ≥5
- LI threshold: >4
- Higher success rate for cannulation verification

**Both (Comparison View):**
- Side-by-side pre/post comparison
- Verifies consistency across protocols

### 4. Multi-Sample Support
**Left Adrenal Vein:** Up to 2 samples (averaged)
**Right Adrenal Vein:** Up to 4 samples (averaged)

*Rationale:* Right adrenal vein is more challenging to cannulate; multiple samples improve reliability.

### 5. IVC Sampling Locations
- **Infrarenal IVC** (below renal veins) - standard
- **Suprarenal IVC** (above renal veins) - alternative

*Calculator uses whichever is provided (suprarenal preferred if both entered).*

---

## Calculations Performed

### 1. Selectivity Index (SI)
**Formula:** SI = (Adrenal Vein Cortisol) / (IVC Cortisol)

**Interpretation:**
- **Post-ACTH:** SI ≥ 5 indicates successful cannulation
- **Pre-ACTH:** SI ≥ 2 indicates successful cannulation

**Clinical Note:** Kahn & Angle (2010) recommend adrenal cortisol should be ≥10× peripheral for reliable sampling.

### 2. Aldosterone-to-Cortisol Ratio (A/C)
**Formula:** A/C = Aldosterone / Cortisol

Calculated for:
- Left adrenal vein
- Right adrenal vein
- IVC (peripheral baseline)

*Normalizes aldosterone by cortisol to account for dilution and verify cannulation quality.*

### 3. Lateralization Index (LI)
**Formula:** LI = (Dominant A/C) / (Nondominant A/C)

**Interpretation:**
- **Post-ACTH:** LI > 4 → Unilateral disease
- **Pre-ACTH:** LI > 2 → Unilateral disease
- **LI 2-4 (Post):** Equivocal, requires clinical correlation
- **LI < 2:** Bilateral disease

**Clinical Guidance (Kahn & Angle 2010):**
- Ratios elevated 3-5× suggest unilateral disease
- Ratios differing < 2-fold suggest bilateral hyperplasia
- Ratios between 2-3 are equivocal

### 4. Contralateral Suppression Ratio (CR)
**Formula:** CR = (Nondominant A/C) / (IVC A/C)

**Interpretation:**
- CR < 1 → Contralateral suppression confirmed
- Supports unilateral diagnosis

### 5. AV/IVC Index
**Formula:** AV/IVC = (Dominant A/C) / (IVC A/C)

**Interpretation:**
- \> 5.5 → Supports ipsilateral unilateral disease
- < 0.5 → Suggests contralateral unilateral disease

### 6. CSI (Contralateral Suppression Index) - Chow 2024
**Formula:** CSI = (Nondominant A/C) / (IVC A/C)

*Note: Same as CR (Naruse nomenclature), measures contralateral suppression vs baseline*

**Interpretation:**
- CSI < 0.5 → 76.5% sensitivity, **92.9% PPV** for unilateral disease

**Clinical Application:** Can diagnose unilateral disease even if only one adrenal vein successfully cannulated

### 7. RASI (Relative Aldosterone Secretion Index) - Chow 2024
**Formula:** RASI = (Dominant A/C) / (IVC A/C)

*Note: Same as ipsilateral AV/IVC (Naruse nomenclature), measures dominant hypersecretion vs baseline*

**Interpretation:**
- RASI > 2.4 → 85.0% sensitivity, **94.4% PPV** for unilateral disease

**Combined Criteria:**
- CSI < 0.5 **OR** RASI > 2.4 → **95.5% PPV** for unilateral PA

---

## Clinical Interpretation Guide

### Scenario 1: Bilateral Successful Cannulation

#### ✓ Unilateral Disease (LI > threshold)
**Example:** LI = 7.2 (post-ACTH), left dominant
- **Interpretation:** "Unilateral aldosterone hypersecretion on Left side. Consider unilateral adrenalectomy."
- **Supporting Evidence:** CR < 1, CSI < 0.5, RASI > 2.4
- **Management:** Surgical referral for left adrenalectomy

#### ⚠️ Equivocal (LI 2-4, post-ACTH)
**Example:** LI = 3.1, left dominant
- **Interpretation:** "Equivocal lateralization. Consider clinical correlation."
- **If LI ≥ 3:** "Suggests unilateral asymmetry (3-5× typical for unilateral disease)"
- **If LI < 3:** "Suggests possible bilateral hyperplasia"
- **Use CSI/RASI:** If CSI < 0.5 or RASI > 2.4, favors unilateral
- **Management:** Review imaging, consider repeat AVS, MDT discussion

#### Bilateral Disease (LI < 2)
**Example:** LI = 1.4
- **Interpretation:** "Bilateral disease likely. Medical management with mineralocorticoid receptor antagonists recommended."
- **Management:** Spironolactone or eplerenone

### Scenario 2: Unilateral Cannulation Failure

**Example:** Left SI = 12 ✓, Right SI = 3.2 ✗
- **Primary Warning:** "Cannulation failure on right (SI < 5)"
- **Rescue Criteria:**
  - If CSI < 0.5: "92.9% PPV for unilateral disease"
  - If RASI > 2.4: "94.4% PPV for unilateral disease"
- **Clinical Value:** May avoid repeat AVS in some cases

### Scenario 3: Bilateral Cannulation Failure

**Example:** Both SI < 5
- **Interpretation:** "Cannulation failure on both sides. Reliable lateralization requires adequate selectivity."
- **Management:** Consider repeat AVS, review technique (microcatheter use)

---

## Validation & Quality Checks

### Automated Validation Warnings

The calculator automatically flags physiologically extreme values:

**IVC Values:**
- Aldosterone > 500 ng/dL → "Extremely high, verify value"
- Aldosterone < 1 ng/dL → "Extremely low, verify value"
- Cortisol > 100 µg/dL → "Extremely high, verify value"
- Cortisol < 1 µg/dL → "Extremely low, verify value"

**Adrenal Vein Samples:**
- Aldosterone > 10,000 ng/dL → "Extremely high, verify value"
- Cortisol > 500 µg/dL → "Extremely high, verify value"

*These warnings do not prevent calculation but prompt review of lab values or units.*

### Conflicting Criteria Detection

**Example Conflict:**
- LI = 5.2 (indicates unilateral) but CSI = 0.8 (suggests bilateral)
- **Warning:** "LI indicates unilateral disease, but neither Chow criterion (CSI/RASI) is met. Consider clinical correlation."

**Possible Causes:**
- Sample quality issues
- Dilution variation
- True equivocal case
- Technical factors during procedure

---

## CSV Export

### Features
The calculator generates a comprehensive CSV file including:

1. **Patient Information**
   - Initials, date, side of nodule, notes

2. **Laboratory Units**
   - Displays values in user's selected units
   - Notes internal standard units used

3. **Raw Sample Data**
   - Individual samples with timestamps
   - Averaged values
   - Both left and right AV data

4. **Calculated Indices**
   - SI (left and right)
   - A/C ratios (left, right, IVC)
   - LI, CR, CSI, RASI, AV/IVC Index

5. **Interpretation**
   - Cannulation status
   - Clinical interpretation
   - Management recommendations

6. **Methodology & References**
   - Threshold definitions
   - Literature citations
   - Quality criteria

**Filename Format:** `AVS_Aldosterone_{PatientInitials}_{Date}.csv`

---

## Evidence Base & References

### 1. Naruse et al. 2021 - Consensus Guidelines
**Citation:** Naruse M, et al. Endocrinol Metab 2021;36(5):965-73.

**Key Contributions:**
- Selectivity Index thresholds (SI ≥2 pre, ≥5 post)
- Lateralization Index thresholds (LI >2 pre, >4 post)
- Contralateral Suppression Ratio (CR)
- International consensus methodology

**DOI:** [10.3803/EnM.2021.1192](https://doi.org/10.3803/EnM.2021.1192) ✓ Valid

### 2. Williams et al. 2017 - PASO Study
**Citation:** Williams TA, et al. Lancet Diabetes Endocrinol 2017;5(9):689-699.

**Key Contributions:**
- Primary Aldosteronism Surgical Outcome (PASO) study
- International consensus on outcome measures
- Post-adrenalectomy success predictors
- Validates surgical approach for unilateral disease

**DOI (Current in code):** 10.1210/jc.2016-2938 ❌ **INCORRECT**

**Correct DOI:** [10.1016/S2213-8587(17)30135-3](https://doi.org/10.1016/S2213-8587(17)30135-3) ✓ Valid

**Note:** The code references an incorrect DOI for the PASO study. The study was published in Lancet Diabetes & Endocrinology, not JCEM.

### 3. Chow et al. 2024 - Unilateral Cannulation Criteria
**Citation:** Chow CM, et al. World J Surg 2024;48:2941-9.

**Key Contributions:**
- CSI (Contralateral Suppression Index) < 0.5: 76.5% sens, 92.9% PPV
- RASI (Relative Aldosterone Secretion Index) > 2.4: 85.0% sens, 94.4% PPV
- Combined criteria: 95.5% PPV for unilateral PA
- Allows diagnosis when only one side cannulated successfully

**DOI (Current in code):** 10.1007/s00268-024-08280-w ❌ **NOT FOUND**

**Note:** This DOI returns a 404 error. The article may not yet be indexed, or the DOI may be incorrect. Further verification needed.

### 4. Kahn & Angle 2010 - AVS Techniques
**Citation:** Kahn SL, Angle JF. Tech Vasc Interv Radiol 2010;13(2):110-25.

**Key Contributions:**
- Technical aspects of AVS procedure
- Cortisol should be ≥10× peripheral for reliable cannulation
- Ratios elevated 3-5× suggest unilateral disease
- Ratios < 2-fold suggest bilateral hyperplasia
- Equivocal zone: LI 2-3

**DOI:** [10.1053/j.tvir.2010.02.008](https://doi.org/10.1053/j.tvir.2010.02.008) ✓ Valid

---

## Known Issues & Limitations

### Reference URL Issues

1. **PASO Study DOI Incorrect**
   - Current: `10.1210/jc.2016-2938` (404 error)
   - Correct: `10.1016/S2213-8587(17)30135-3`
   - **Impact:** Reference link broken but citation text is correct
   - **Recommendation:** Update DOI in code

2. **Chow 2024 DOI Not Found**
   - Current: `10.1007/s00268-024-08280-w` (404 error)
   - **Impact:** Reference link not accessible
   - **Recommendation:** Verify DOI or wait for article indexing

### Calculator Limitations

1. **No Integration with Imaging**
   - Does not incorporate CT/MRI findings
   - Nodule size/characteristics not considered

2. **No Clinical Context Integration**
   - Doesn't account for hypertension severity
   - Doesn't include biochemical workup results (ARR, PAC, renin)

3. **No Post-Operative Outcome Prediction**
   - PASO criteria for surgical success not included

4. **No Pediatric Considerations**
   - Thresholds based on adult studies

---

## Usage Workflow

### Pre-Procedure Planning
1. Confirm biochemical diagnosis of PA
2. Review cross-sectional imaging
3. Brief patient on procedure
4. Plan ACTH stimulation protocol

### During Procedure
1. Sample IVC (infrarenal or suprarenal)
2. Cannulate left adrenal vein
   - Obtain 1-2 samples with times
   - Record aldosterone and cortisol
3. Cannulate right adrenal vein
   - Obtain 1-4 samples with times
   - Record aldosterone and cortisol
4. *Optional:* Repeat after ACTH if doing both protocols

### Post-Procedure Analysis
1. Enter patient metadata in calculator
2. Select appropriate units (match lab)
3. Choose protocol (pre/post/both)
4. Enter IVC values
5. Enter adrenal vein sample values
6. Click Calculate
7. Review:
   - SI for cannulation quality
   - LI for lateralization
   - CSI/RASI for additional confidence
   - Interpretation and recommendations
8. Download CSV for medical record
9. Discuss in MDT (endocrine, surgery, radiology)

### Clinical Decision
- **Unilateral disease:** Refer to surgery
- **Bilateral disease:** Start medical therapy
- **Equivocal:** Review imaging, consider repeat AVS, MDT discussion

---

## Testing & Quality Assurance

### Test Coverage

**E2E Tests:** `/tests/e2e/calculators/hepatology/avs-hyperaldo.spec.js`
- Visual appeal & theme consistency
- Clinical scenarios (unilateral, bilateral, equivocal)
- Cannulation failure scenarios
- Multi-sample averaging
- Pre/post comparison
- Unit conversions
- Edge cases & validation
- Reference URL validation

**Test Data:** `/tests/data/avs-hyperaldo-test-cases.json`
- 10 clinical scenarios
- 15 edge cases
- 3 performance tests
- 3 usability tests

### Validated Clinical Scenarios

1. ✓ Classic unilateral left aldosteronism (post-ACTH)
2. ✓ Unilateral right aldosteronism (pre-ACTH)
3. ✓ Bilateral adrenal hyperplasia
4. ✓ Equivocal lateralization (LI 2-4)
5. ✓ Right cannulation failure with CSI/RASI rescue
6. ✓ Bilateral cannulation failure
7. ✓ Multi-sample averaging (2 left, 4 right)
8. ✓ Pre and post-ACTH comparison
9. ✓ Suprarenal IVC usage
10. ✓ Severe PA with very high baseline aldosterone

---

## Accessibility & UX

### Responsive Design
- **Desktop:** Full two-column layout, side-by-side comparison
- **Tablet:** Adaptive grid, stacks appropriately
- **Mobile:** Single-column, maintains usability

### Visual Hierarchy
- **Blue sections:** Patient/unit information (setup)
- **Gray sections:** Protocol data entry (input)
- **Green sections:** Post-ACTH results (output)
- **Blue sections:** Pre-ACTH results (output)
- **Purple sections:** Advanced criteria (CSI/RASI)
- **Orange sections:** Validation warnings
- **Red sections:** Conflicting criteria

### Tooltips & Guidance
- Unit conversion help text
- Input field tooltips with typical ranges
- Interpretation explanations
- Methodology notes in CSV

---

## Maintenance & Updates

### Regular Maintenance
- [ ] Verify reference URLs quarterly
- [ ] Update thresholds if consensus guidelines change
- [ ] Add new indices as literature emerges
- [ ] Monitor for PASO 2.0 or updated criteria

### Future Enhancements
- [ ] Integration with imaging findings
- [ ] Pre-test probability calculator (ARR, PAC)
- [ ] Post-operative success prediction (PASO criteria)
- [ ] Multi-language support
- [ ] Direct EMR integration

---

## Support & Contact

For questions about:
- **Clinical interpretation:** Consult endocrinology or interventional radiology
- **Calculator bugs:** Submit issue to development team
- **Reference updates:** Contact medical informatics

---

## Changelog

### Version 1.0 (Current)
- Initial implementation
- Support for pre/post/both protocols
- Multi-sample averaging
- Unit conversion (ng/dL, pg/mL, µg/dL, nmol/L)
- CSI/RASI criteria (Chow 2024)
- Validation warnings
- Conflict detection
- CSV export
- Patient metadata tracking

### Known Issues (v1.0)
- PASO study DOI incorrect (needs update)
- Chow 2024 DOI not accessible (needs verification)

---

## Appendix: Calculation Examples

### Example 1: Classic Unilateral Left PA

**Inputs:**
- IVC: Aldo 85 ng/dL, Cort 18 µg/dL
- Left AV: Aldo 2900 ng/dL, Cort 280 µg/dL
- Right AV: Aldo 450 ng/dL, Cort 320 µg/dL
- Protocol: Post-ACTH

**Calculations:**
```
SI Left = 280 / 18 = 15.6 ✓ (>5)
SI Right = 320 / 18 = 17.8 ✓ (>5)

A/C Left = 2900 / 280 = 10.36
A/C Right = 450 / 320 = 1.41
A/C IVC = 85 / 18 = 4.72

Dominant = Left (10.36 > 1.41)

LI = 10.36 / 1.41 = 7.35 ✓ (>4)
CR = 1.41 / 4.72 = 0.30 ✓ (<1)
AV/IVC = 10.36 / 4.72 = 2.19
CSI = 0.30 ✓ (<0.5)
RASI = 2.19
```

**Interpretation:** Unilateral aldosterone hypersecretion on Left side. Consider unilateral adrenalectomy. Contralateral suppression confirmed (CR = 0.30 < 1). Chow 2024 criteria met: CSI 0.30 < 0.5 (92.9% PPV).

**Management:** Left adrenalectomy

---

### Example 2: Bilateral Hyperplasia

**Inputs:**
- IVC: Aldo 90 ng/dL, Cort 20 µg/dL
- Left AV: Aldo 800 ng/dL, Cort 250 µg/dL
- Right AV: Aldo 750 ng/dL, Cort 240 µg/dL
- Protocol: Post-ACTH

**Calculations:**
```
SI Left = 250 / 20 = 12.5 ✓ (>5)
SI Right = 240 / 20 = 12.0 ✓ (>5)

A/C Left = 800 / 250 = 3.20
A/C Right = 750 / 240 = 3.13
A/C IVC = 90 / 20 = 4.50

Dominant = Left (3.20 > 3.13, minimal difference)

LI = 3.20 / 3.13 = 1.02 ✗ (<2)
CR = 3.13 / 4.50 = 0.70
CSI = 0.70 ✗ (>0.5)
RASI = 0.71 ✗ (<2.4)
```

**Interpretation:** Bilateral disease likely (LI = 1.02 < 2). Per Kahn & Angle: ratios differing by < 2-fold suggest bilateral adrenal hyperplasia. Medical management with mineralocorticoid receptor antagonists recommended.

**Management:** Spironolactone 25-50 mg daily, titrate to BP control

---

## Summary

The AVS – Aldosterone (Primary Aldosteronism) calculator is a robust, evidence-based tool for interpreting adrenal vein sampling in patients with confirmed primary aldosteronism. It integrates classical criteria (SI, LI, CR) with modern unilateral-cannulation criteria (CSI, RASI) to provide comprehensive lateralization assessment, even in challenging cases with incomplete cannulation.

**Key Strengths:**
- Multi-protocol support (pre/post/both)
- Multi-sample averaging
- Unit flexibility
- Advanced criteria (CSI/RASI)
- Validation warnings
- Comprehensive CSV export

**Areas for Improvement:**
- Reference DOI corrections needed
- Future integration with imaging/biochemistry
- Post-operative outcome prediction

**Clinical Impact:** Helps differentiate surgical vs medical management, potentially avoiding unnecessary surgery in bilateral cases and ensuring appropriate surgical referral in unilateral cases.
