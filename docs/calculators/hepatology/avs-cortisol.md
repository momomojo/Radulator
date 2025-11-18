# AVS Cortisol (Cushing) Calculator

## Overview

The **Adrenal Vein Sampling – Cortisol (Autonomous Cushing)** calculator provides comprehensive cortisol lateralization analysis during adrenal vein sampling for ACTH-independent cortisol excess, including mild or subclinical Cushing syndrome. It implements the validated Young et al. criteria with full support for multiple samples, automated cannulation verification, and detailed clinical interpretation.

## Medical Context

### Clinical Indication

Adrenal vein sampling (AVS) is indicated for patients with:
- ACTH-independent Cushing syndrome
- Subclinical Cushing syndrome
- Bilateral adrenal masses with cortisol excess
- Need to determine lateralization before adrenalectomy

### Why AVS is Performed

When patients have bilateral adrenal masses and evidence of autonomous cortisol secretion, imaging alone cannot reliably identify which adrenal gland is the source of excess cortisol production. AVS provides definitive biochemical evidence of lateralization by directly sampling blood from each adrenal vein and comparing cortisol levels.

## Calculator Features

### 1. Patient Metadata
- **Patient Initials**: For record-keeping and CSV export
- **Date of Procedure**: Tracks when AVS was performed
- **Side of Nodule**: Documents imaging findings (Left/Right/Bilateral)

### 2. Laboratory Unit Selection
- **Cortisol Units**:
  - µg/dL (micrograms per deciliter) - US standard
  - nmol/L (nanomoles per liter) - International standard
  - Conversion factor: 1 µg/dL = 27.59 nmol/L
  - All calculations use µg/dL internally regardless of input units

- **Epinephrine Units**:
  - pg/mL (picograms per milliliter) - standard unit
  - No conversion needed

### 3. Peripheral (IVC) Measurements
- **Infrarenal IVC**: Baseline cortisol and epinephrine from infrarenal inferior vena cava
- **Suprarenal IVC**: Optional suprarenal measurements (preferred if available)
- The calculator automatically uses suprarenal values if provided, otherwise falls back to infrarenal

### 4. Multi-Sample Support
- **Left Adrenal Vein**: Up to 2 samples with averaging
- **Right Adrenal Vein**: Up to 4 samples with averaging
  - Right adrenal is technically more challenging, so more samples may be needed
- Each sample captures:
  - Time drawn (for procedure documentation)
  - Cortisol level
  - Epinephrine level

### 5. Automated Cannulation Verification
The calculator validates each sample using the **epinephrine gradient criterion**:
- **Success criterion**: Adrenal vein epinephrine must be >100 pg/mL above IVC epinephrine
- Each sample is individually validated
- Visual indicators (✓/✗) show cannulation success for each side
- Only samples passing epinephrine validation are used for cortisol ratio calculations

### 6. Cortisol Lateralization Analysis

The calculator computes three key metrics:

#### AV/PV Cortisol Ratios
- **Left AV/PV**: Left adrenal vein cortisol / peripheral (IVC) cortisol
- **Right AV/PV**: Right adrenal vein cortisol / peripheral (IVC) cortisol
- Only calculated from samples that passed epinephrine validation
- Multi-sample averaging improves accuracy

#### Cortisol Lateralization Ratio (CLR)
- **Formula**: Higher AV/PV ratio / Lower AV/PV ratio
- Requires successful cannulation of both adrenal veins
- Key metric for determining unilateral vs. bilateral disease

#### Dominant Side
- Side with higher AV/PV ratio
- Indicates which adrenal gland has greater cortisol secretion

### 7. Clinical Interpretation

The calculator applies **Young et al. criteria** (World J Surg 2008):

#### Unilateral Cortisol-Secreting Adenoma
Diagnosed when ALL three criteria are met:
1. **Dominant side AV/PV >6.5** (high cortisol on affected side)
2. **Contralateral AV/PV ≤3.3** (suppression on unaffected side)
3. **CLR ≥2.3** (clear lateralization)

**Clinical Significance**: Patient is candidate for unilateral adrenalectomy on the dominant side

#### Bilateral Cortisol Hypersecretion
Diagnosed when:
- **CLR ≤2** (minimal lateralization)

**Clinical Significance**: Suggests bilateral adrenal hyperplasia; surgical management more complex

#### Indeterminate Lateralization
When criteria for unilateral or bilateral disease are not met:
- AV/PV ratios don't meet threshold criteria
- CLR in intermediate range (>2 but <2.3)
- Requires multidisciplinary review

#### Failed Cannulation
When epinephrine gradient <100 pg/mL on either side:
- **Warning displayed**: Ratios cannot be reliably interpreted
- Common on left side (easier cannulation)
- May require repeat procedure

## Methodology

### Cannulation Success Validation
Per Young et al. protocol:
- Epinephrine (Epi) concentration in adrenal vein must exceed peripheral vein by >100 pg/mL
- This confirms blood is truly from adrenal vein and not contaminated with peripheral blood
- Each sample validated individually

### Sample Averaging
When multiple samples are obtained from one adrenal vein:
1. Each sample individually validated for epinephrine gradient
2. Only successful samples (Epi Δ >100) included in cortisol averaging
3. Average cortisol used to calculate AV/PV ratio
4. Improves accuracy by reducing sampling variability

### Cortisol Ratio Calculation
```
AV/PV Ratio = (Mean of valid adrenal vein cortisol samples) / (Peripheral IVC cortisol)
```

### Lateralization Ratio Calculation
```
CLR = max(Left AV/PV, Right AV/PV) / min(Left AV/PV, Right AV/PV)
```

## Test Cases

### Test Case 1: Unilateral Left Adrenal Adenoma
**Clinical Scenario**: 58-year-old woman with 2.5 cm left adrenal nodule, subclinical Cushing's

**Inputs**:
- IVC Cortisol: 15 µg/dL
- IVC Epinephrine: 50 pg/mL
- Left AV Cortisol: 120 µg/dL
- Left AV Epinephrine: 250 pg/mL (Δ = 200, successful)
- Right AV Cortisol: 30 µg/dL
- Right AV Epinephrine: 200 pg/mL (Δ = 150, successful)

**Results**:
- Left AV/PV: 8.000 (>6.5 ✓)
- Right AV/PV: 2.000 (≤3.3 ✓)
- CLR: 4.000 (≥2.3 ✓)
- **Interpretation**: Unilateral cortisol-secreting adenoma on LEFT side
- **Recommendation**: Candidate for left adrenalectomy

### Test Case 2: Unilateral Right Adrenal Adenoma
**Clinical Scenario**: 62-year-old man with 3.0 cm right adrenal nodule, mild Cushing's

**Inputs**:
- IVC Cortisol: 12 µg/dL
- IVC Epinephrine: 40 pg/mL
- Left AV Cortisol: 25 µg/dL
- Left AV Epinephrine: 180 pg/mL (Δ = 140, successful)
- Right AV Cortisol: 100 µg/dL
- Right AV Epinephrine: 220 pg/mL (Δ = 180, successful)

**Results**:
- Left AV/PV: 2.083 (≤3.3 ✓)
- Right AV/PV: 8.333 (>6.5 ✓)
- CLR: 4.000 (≥2.3 ✓)
- **Interpretation**: Unilateral cortisol-secreting adenoma on RIGHT side
- **Recommendation**: Candidate for right adrenalectomy

### Test Case 3: Bilateral Cortisol Hypersecretion
**Clinical Scenario**: 55-year-old woman with bilateral adrenal nodules (1.8 cm left, 2.2 cm right)

**Inputs**:
- IVC Cortisol: 10 µg/dL
- IVC Epinephrine: 30 pg/mL
- Left AV Cortisol: 80 µg/dL
- Left AV Epinephrine: 200 pg/mL (Δ = 170, successful)
- Right AV Cortisol: 70 µg/dL
- Right AV Epinephrine: 190 pg/mL (Δ = 160, successful)

**Results**:
- Left AV/PV: 8.000
- Right AV/PV: 7.000
- CLR: 1.143 (≤2 ✓)
- **Interpretation**: Bilateral cortisol hypersecretion likely
- **Recommendation**: Suggests bilateral adrenal hyperplasia; consider bilateral adrenalectomy or medical management

### Test Case 4: Failed Left Cannulation
**Clinical Scenario**: Technical difficulty cannulating left adrenal vein

**Inputs**:
- IVC Cortisol: 15 µg/dL
- IVC Epinephrine: 50 pg/mL
- Left AV Cortisol: 100 µg/dL
- Left AV Epinephrine: 120 pg/mL (Δ = 70, **FAILED** <100)
- Right AV Cortisol: 80 µg/dL
- Right AV Epinephrine: 200 pg/mL (Δ = 150, successful)

**Results**:
- Left cannulation: ✗ Failed
- Right cannulation: ✓ Successful
- **Interpretation**: ⚠️ Cannulation unsuccessful on left side. Ratios cannot be reliably interpreted.
- **Recommendation**: Consider repeat AVS with focus on left adrenal vein cannulation

### Test Case 5: Multi-Sample Averaging
**Clinical Scenario**: Multiple right adrenal samples due to technical challenges

**Inputs**:
- IVC Cortisol: 10 µg/dL
- IVC Epinephrine: 40 pg/mL
- Left AV Sample 1: Cortisol 100, Epi 200 (Δ = 160, successful)
- Left AV Sample 2: Cortisol 120, Epi 220 (Δ = 180, successful)
- Right AV Cortisol: 30 µg/dL
- Right AV Epinephrine: 180 pg/mL (Δ = 140, successful)

**Results**:
- Left AV/PV: 11.000 (average of 100 and 120 = 110; 110/10)
- Right AV/PV: 3.000
- CLR: 3.667
- **Interpretation**: Multi-sample averaging improves accuracy

## Edge Cases

### 1. Borderline Epinephrine Gradient
- **Scenario**: Epinephrine Δ = exactly 100 pg/mL
- **Behavior**: Cannulation marked as FAILED (must be >100, not ≥100)
- **Clinical**: Per Young protocol, gradient must EXCEED 100

### 2. Very High Cortisol Levels
- **Scenario**: Severe autonomous cortisol secretion (AV cortisol >500 µg/dL)
- **Behavior**: Calculator handles without upper limit
- **Clinical**: Seen in large cortisol-secreting adenomas

### 3. Unit Conversion Accuracy
- **Scenario**: Cortisol values entered in nmol/L
- **Behavior**: Automatic conversion to µg/dL for calculations, results consistent regardless of input units
- **Clinical**: Labs may report in either unit system

### 4. Both Infrarenal and Suprarenal IVC Provided
- **Behavior**: Automatically uses suprarenal values
- **Clinical**: Suprarenal IVC is anatomically closer to adrenal veins, preferred for accuracy

### 5. Indeterminate Lateralization
- **Scenario**: AV/PV ratios don't meet strict Young criteria
- **Behavior**: Reports "Indeterminate lateralization" with actual values
- **Clinical**: May require correlation with imaging, clinical context, or repeat AVS

## CSV Export

The calculator generates comprehensive CSV reports including:

### Report Sections
1. **Patient Information**: Initials, date, side of nodule
2. **Laboratory Units**: Selected units for cortisol and epinephrine
3. **Peripheral Measurements**: IVC cortisol and epinephrine
4. **Left Adrenal Samples**: Individual samples with Epi Δ and validation status
5. **Right Adrenal Samples**: Individual samples with Epi Δ and validation status
6. **Lateralization Analysis**: AV/PV ratios, CLR, dominant side
7. **Interpretation**: Clinical conclusion
8. **Methodology**: Detailed explanation of criteria
9. **References**: Full citations

### Filename Format
```
AVS_Cortisol_{PatientInitials}_{ProcedureDate}.csv
```

## Styling and UI/UX

### Visual Design
- **Patient Information Section**: Blue background (`bg-blue-50`) with border for emphasis
- **Laboratory Units Section**: Gray background (`bg-gray-50`) for configuration area
- **Sample Input Grids**: Responsive 4-column layout (stacks on mobile)
- **Cannulation Success Indicators**:
  - Green text (`text-green-600`) for ✓ Successful
  - Red text (`text-red-600`) for ✗ Failed
- **Interpretation Section**: Blue background with border for key findings

### Responsive Design
- **Desktop**: 3-column grid for patient info, 4-column for samples
- **Mobile**: Single-column stacking for all grids
- **Buttons**: Full-width calculate and download buttons
- **Add/Remove Sample Buttons**: Secondary and destructive variants

### User Experience
- **Dynamic Sample Management**: Add/remove samples with visual feedback
- **Button State Management**: Disabled states when limits reached
- **Validation Feedback**: Clear error messages for insufficient data
- **Unit Conversion Hints**: Conversion factors displayed near unit selectors
- **Time Input**: Optional time stamps for procedural documentation

## References

### Primary Literature

1. **Young WF Jr, du Plessis H, Thompson GB, et al.**
   "The clinical conundrum of corticotropin-independent autonomous cortisol secretion in patients with bilateral adrenal masses."
   *World J Surg.* 2008 May;32(5):856-62.
   DOI: [10.1007/s00268-007-9332-8](https://doi.org/10.1007/s00268-007-9332-8)
   PMID: 18074172

   **Key Findings**:
   - Established AV/PV ratio criteria: >6.5 for adenoma, ≤3.3 for suppression
   - CLR ≥2.3 indicates unilateral disease
   - CLR ≤2 suggests bilateral hypersecretion
   - Epinephrine gradient >100 pg/mL validates cannulation

2. **Acharya R, Dhir M, Bandi R, Yip L, Challinor S.**
   "Outcomes of Adrenal Venous Sampling in Patients with Bilateral Adrenal Masses and ACTH-Independent Cushing's Syndrome."
   *World J Surg.* 2019 Feb;43(2):527-533.
   DOI: [10.1007/s00268-018-4788-2](https://doi.org/10.1007/s00268-018-4788-2)
   PMID: 30232569

   **Key Findings**:
   - Validated Young criteria in contemporary cohort
   - Multi-sample averaging improves accuracy
   - Technical success rates and outcomes data
   - Emphasized importance of epinephrine validation

### Additional Resources
- Endocrine Society Clinical Practice Guidelines on Cushing's Syndrome
- Society of Interventional Radiology guidelines for AVS technique
- AACE/AAES Medical Guidelines for Clinical Practice for the Diagnosis and Treatment of Primary Aldosteronism

## Clinical Workflow Integration

### Pre-Procedure
1. Confirm ACTH-independent cortisol excess
2. Document bilateral adrenal masses on imaging
3. Review anticoagulation and contrast allergy history
4. Explain procedure risks/benefits to patient

### During Procedure
1. Obtain baseline peripheral IVC samples (infrarenal ± suprarenal)
2. Cannulate right adrenal vein (more technically challenging)
   - Obtain multiple samples if needed
   - Check fluoroscopic position
3. Cannulate left adrenal vein
   - Typically easier to access
   - Confirm position before sampling

### Post-Procedure
1. Enter all samples into calculator
2. Review epinephrine gradients to validate cannulation
3. Calculate AV/PV ratios and CLR
4. Generate interpretation based on Young criteria
5. Export CSV for medical record
6. Discuss results at multidisciplinary conference

### Management Decisions
- **Unilateral adenoma**: Proceed with unilateral adrenalectomy
- **Bilateral disease**: Consider bilateral adrenalectomy vs. medical management
- **Failed cannulation**: Plan repeat AVS
- **Indeterminate**: Correlate with imaging, consider repeat AVS or conservative management

## Quality Assurance

### Calculator Validation
- ✅ Mathematical accuracy verified against published cases
- ✅ Unit conversion accuracy tested (µg/dL ↔ nmol/L)
- ✅ Epinephrine validation threshold (>100 pg/mL) correct
- ✅ Young criteria implementation matches original study
- ✅ Multi-sample averaging algorithm validated

### Reference Link Verification
- ✅ Acharya et al. DOI link verified (10.1007/s00268-018-4788-2)
- ✅ Young et al. DOI link verified (10.1007/s00268-007-9332-8)
- ✅ Both links resolve to correct articles

### Browser Compatibility
- ✅ Tested on Chrome, Firefox, Safari, Edge
- ✅ Mobile responsive design verified
- ✅ CSV download tested on multiple browsers
- ✅ Date picker compatibility verified

## Known Limitations

1. **Calculator does not**:
   - Provide ACTH-dependent primary aldosteronism interpretation (see AVS Hyperaldosteronism calculator)
   - Calculate absolute cortisol secretion rates
   - Account for cosyntropin stimulation protocols
   - Provide imaging correlation

2. **User responsibility**:
   - Confirm cannulation position via fluoroscopy
   - Ensure proper sample handling and lab processing
   - Correlate with clinical and imaging findings
   - Obtain informed consent for procedure

3. **Clinical judgment required**:
   - Borderline cases may need multidisciplinary review
   - Consider patient comorbidities for surgical candidacy
   - Repeat AVS may be needed if cannulation fails

## Future Enhancements

Potential improvements for future versions:
- Integration with PACS for imaging correlation
- Support for cosyntropin-stimulated protocols
- Comparison mode for serial AVS procedures
- Statistical confidence intervals for CLR
- Integration with electronic health records (EHR)

---

**Last Updated**: 2024-11-16
**Calculator Version**: 1.0
**Test Coverage**: 19 comprehensive E2E tests
**Documentation Status**: Complete
