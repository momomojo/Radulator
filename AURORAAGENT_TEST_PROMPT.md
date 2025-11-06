# Auroraagent Browser Testing Instructions for AVS Calculators

## Overview
You are testing two newly implemented Adrenal Vein Sampling (AVS) calculators on the Radulator website. These calculators implement state-of-the-art clinical criteria for interpreting AVS results in patients with ACTH-independent Cushing syndrome and primary aldosteronism.

## Website Information
- **URL**: http://localhost:5173/Radulator/
- **Calculator Names**:
  1. "AVS – Cortisol (Cushing)"
  2. "AVS – Aldosterone (PA)"

## Testing Objectives
1. Verify all input fields are accessible and functional
2. Confirm calculation accuracy against known clinical scenarios
3. Test CSV download functionality
4. Validate visual indicators and error messages
5. Test multi-sample support
6. Verify side-by-side comparison view (aldosterone calculator)

---

## Test Case 1: AVS – Cortisol (Cushing) - Unilateral Adenoma

### Scenario
A 58-year-old woman with bilateral adrenal masses and mild autonomous cortisol secretion. Imaging shows larger left adrenal nodule.

### Test Steps
1. Navigate to http://localhost:5173/Radulator/
2. Click on "AVS – Cortisol (Cushing)" in the sidebar
3. Fill in Patient Information:
   - Patient Initials: "JD"
   - Date of Procedure: Select today's date
   - Side of Nodule: "Left"

4. Fill in IVC Measurements (use Suprarenal):
   - Infrarenal IVC Cortisol: Leave blank
   - Infrarenal IVC Epinephrine: Leave blank
   - Suprarenal IVC Cortisol: 12
   - Suprarenal IVC Epinephrine: 50

5. Left Adrenal Vein Sample:
   - Time: 10:15
   - Cortisol: 180
   - Epinephrine: 250

6. Right Adrenal Vein Sample:
   - Time: 10:20
   - Cortisol: 35
   - Epinephrine: 180

7. Click "Calculate"

### Expected Results
- **Cannulation Success**: Both should show "✓ Successful" in green
- **Left Epi Δ**: 200 pg/mL
- **Right Epi Δ**: 130 pg/mL
- **Left AV/PV Ratio**: 15.000
- **Right AV/PV Ratio**: 2.917
- **CLR**: 5.143
- **Dominant Side**: LEFT
- **Interpretation**: Should indicate "Unilateral cortisol-secreting adenoma on LEFT side" with criteria met (left >6.5, right ≤3.3, CLR ≥2.3)
- **Download Button**: A "Download Results as CSV" button should appear below the interpretation

8. Review results, then click "Download Results as CSV"

### Expected CSV Download
- File named "AVS_Cortisol_JD_[date].csv" should download
- CSV contains all input data, calculations, and methodology section

### Validation Checks
- [ ] "Calculate" button is separate from download functionality
- [ ] Results display BEFORE any download occurs
- [ ] Patient information displays correctly in results
- [ ] Green checkmarks appear for successful cannulation
- [ ] Epinephrine delta values are correct
- [ ] AV/PV ratios match expected values (±0.001)
- [ ] Interpretation correctly identifies LEFT unilateral disease
- [ ] "Download Results as CSV" button appears only after successful calculation
- [ ] Can review results before downloading
- [ ] CSV downloads only when "Download Results as CSV" button is clicked
- [ ] CSV file contains all input data, calculations, and methodology section

---

## Test Case 2: AVS – Cortisol (Cushing) - Failed Cannulation

### Scenario
Test the visual indicators when cannulation fails on one side.

### Test Steps
1. Clear the form or refresh
2. Fill in Patient Information:
   - Patient Initials: "AB"
   - Date: Today
   - Side of Nodule: "Right"

3. Suprarenal IVC:
   - Cortisol: 15
   - Epinephrine: 60

4. Left Adrenal Vein:
   - Time: 11:00
   - Cortisol: 200
   - Epinephrine: 180 (This will FAIL - delta is only 120, needs >100 from 60 = needs >160)

5. Right Adrenal Vein:
   - Time: 11:05
   - Cortisol: 150
   - Epinephrine: 200

6. Calculate

### Expected Results
- **Left Cannulation**: "✓ Successful" (green) - Epi Δ = 120 pg/mL (PASSES)
- **Right Cannulation**: "✓ Successful" (green) - Epi Δ = 140 pg/mL
- **Interpretation**: Should still calculate but note if any warnings

Wait, let me recalculate: If IVC Epi is 60, then:
- Left needs >160 to pass: 180 gives delta of 120 (PASSES)
- Right: 200 gives delta of 140 (PASSES)

Let me fix this test case with actual failure:

### Corrected Test Steps for Failure
4. Left Adrenal Vein:
   - Cortisol: 200
   - Epinephrine: 80 (delta = 20, FAILS)

5. Right Adrenal Vein:
   - Cortisol: 150
   - Epinephrine: 200 (delta = 140, PASSES)

### Expected Results
- **Left Cannulation**: "✗ Failed" (red) - Epi Δ = 20 pg/mL
- **Right Cannulation**: "✓ Successful" (green) - Epi Δ = 140 pg/mL
- **Interpretation**: "⚠️ Cannulation unsuccessful on left side. Epinephrine gradient must be >100 pg/mL..."

### Validation Checks
- [ ] Red X appears for failed cannulation
- [ ] Warning emoji (⚠️) appears in interpretation
- [ ] Clear error message explains cannulation failure
- [ ] "Download Results as CSV" button still appears (failure is still a result)
- [ ] CSV downloads with failure noted when button clicked

---

## Test Case 3: AVS – Aldosterone (PA) - Post-ACTH Unilateral Disease

### Scenario
55-year-old man with treatment-resistant hypertension and hypokalemia. Post-ACTH stimulation protocol.

### Test Steps
1. Click "AVS – Aldosterone (PA)" in sidebar
2. Fill Patient Information:
   - Patient Initials: "TM"
   - Date: Today
   - Side of Nodule: "Right"
   - Notes: "Microcatheter used for right AV"

3. Select Protocol: "Post-ACTH only"

4. Post-Cosyntropin IVC:
   - Infrarenal IVC Aldosterone: Leave blank
   - Infrarenal IVC Cortisol: Leave blank
   - Suprarenal IVC Aldosterone: 15
   - Suprarenal IVC Cortisol: 20

5. Left Adrenal Vein:
   - Time: 09:30
   - Aldosterone: 180
   - Cortisol: 850

6. Right Adrenal Vein:
   - Time: 09:35
   - Aldosterone: 2400
   - Cortisol: 900

7. Click "Calculate"

### Expected Results
- **Cannulation Status**: "✓ Bilateral successful cannulation (SI ≥ 5)" (green)
- **Left SI**: 42.50
- **Right SI**: 45.00
- **Left A/C**: 0.2118
- **Right A/C**: 2.6667
- **IVC A/C**: 0.7500
- **LI (Lateralization Index)**: 12.59 (should be >4 for unilateral)
- **Dominant Side**: Right
- **CR (Contralateral Suppression)**: 0.28 (<1, indicates suppression)
- **CSI**: 0.28 (<0.5, ✓ Chow 2024 positive)
- **RASI**: 3.56 (>2.4, ✓ Chow 2024 positive)
- **AV/IVC**: 3.56
- **Interpretation**: "✓ Unilateral aldosterone hypersecretion on Right side (LI = 12.59 > 4). Consider unilateral adrenalectomy. Contralateral suppression confirmed (CR = 0.28 < 1). Chow 2024 criteria also met: CSI 0.28 < 0.5 (92.9% PPV); RASI 3.56 > 2.4 (94.4% PPV)."
- **Download Button**: "Download Results as CSV" appears below results

8. Click "Download Results as CSV"

### Validation Checks
- [ ] Results display before any download
- [ ] All selectivity indices calculated correctly
- [ ] Both sides show checkmarks for adequate cannulation
- [ ] L/R and R/L ratios displayed
- [ ] CSI and RASI display with checkmarks when criteria met
- [ ] Interpretation mentions Chow 2024 criteria
- [ ] Download button appears only after calculation
- [ ] CSV downloads only when button clicked
- [ ] CSV contains complete methodology section
- [ ] Notes field appears in CSV output

---

## Test Case 4: AVS – Aldosterone - Side-by-Side Comparison (Pre & Post)

### Scenario
Test the "Both" protocol option to see side-by-side comparison view.

### Test Steps
1. Stay in AVS – Aldosterone calculator
2. Clear form or refresh
3. Fill Patient Information:
   - Initials: "SK"
   - Date: Today
   - Side: "Left"

4. Select Protocol: "Both (comparison view)"

5. **Pre-Cosyntropin Protocol**:
   - Suprarenal IVC Aldosterone: 18
   - Suprarenal IVC Cortisol: 12
   - Left AV Aldosterone: 850
   - Left AV Cortisol: 45
   - Right AV Aldosterone: 120
   - Right AV Cortisol: 38

6. **Post-Cosyntropin Protocol**:
   - Suprarenal IVC Aldosterone: 20
   - Suprarenal IVC Cortisol: 25
   - Left AV Aldosterone: 1200
   - Left AV Cortisol: 650
   - Right AV Aldosterone: 180
   - Right AV Cortisol: 720

7. Click "Calculate"

### Expected Results
- **Display**: Two side-by-side boxes:
  - Left box: Blue background "Pre-ACTH Results"
  - Right box: Green background "Post-ACTH Results"
- **Pre-ACTH**:
  - SI threshold: ≥2
  - LI threshold: >2
  - Should show if cannulation succeeded (SI ≥2)
- **Post-ACTH**:
  - SI threshold: ≥5
  - LI threshold: >4
  - Both SIs should be ≥5
- **Both protocols should calculate**: LI, CR, CSI, RASI, interpretations
- **Download Button**: "Download Results as CSV" appears below both result panels

8. Review results from both protocols, then click "Download Results as CSV"

### Expected CSV Download
- File should contain BOTH pre and post sections with complete data for both protocols

### Validation Checks
- [ ] Results display before any download occurs
- [ ] Side-by-side layout appears (2 columns on desktop)
- [ ] Pre section has blue background
- [ ] Post section has green background
- [ ] Different thresholds applied (Pre: LI>2, Post: LI>4)
- [ ] Both interpretations display (truncated to 150 chars in comparison view)
- [ ] Download button appears only after successful calculation
- [ ] Can review both result sections before downloading
- [ ] CSV downloads only when "Download Results as CSV" button is clicked
- [ ] CSV contains complete data for both protocols
- [ ] Can scroll through both result sections

---

## Test Case 5: Multi-Sample Support - Aldosterone

### Scenario
Test adding multiple samples per adrenal vein and verify averaging.

### Test Steps
1. In AVS – Aldosterone calculator
2. Select "Post-ACTH only"
3. Fill IVC data:
   - Suprarenal IVC Aldosterone: 12
   - Suprarenal IVC Cortisol: 18

4. Left Adrenal Vein - Add 2 samples:
   - Sample 1: Time 10:00, Aldosterone 600, Cortisol 500
   - Click "+ Add Sample"
   - Sample 2: Time 10:05, Aldosterone 800, Cortisol 600
   - (Average should be: Aldo=700, Cort=550)

5. Right Adrenal Vein - Add 3 samples:
   - Sample 1: Time 10:10, Aldosterone 100, Cortisol 450
   - Click "+ Add Sample"
   - Sample 2: Time 10:15, Aldosterone 120, Cortisol 500
   - Click "+ Add Sample"
   - Sample 3: Time 10:20, Aldosterone 110, Cortisol 550
   - (Average should be: Aldo=110, Cort=500)

6. Click "Calculate"

### Expected Results
- **Calculations should use averaged values**:
  - Left SI: 550/18 = 30.56
  - Right SI: 500/18 = 27.78
  - Left A/C: 700/550 = 1.2727
  - Right A/C: 110/500 = 0.2200
  - LI: 1.2727/0.2200 = 5.79 (>4, unilateral LEFT)
- **Download Button**: "Download Results as CSV" appears below interpretation

7. Review averaged results, then click "Download Results as CSV"

### Expected CSV Download
- CSV should include all individual samples with times
- Averages should be noted in calculations section

### Validation Checks
- [ ] Results display before any download occurs
- [ ] Can add up to 2 samples for left AV
- [ ] Can add up to 4 samples for right AV
- [ ] "+ Add Sample" button disables at max
- [ ] "Remove" button works for each sample
- [ ] "Remove" button disabled when only 1 sample remains
- [ ] Calculations correctly average multiple samples
- [ ] Time fields display properly for each sample
- [ ] Download button appears only after calculation
- [ ] CSV downloads only when button clicked
- [ ] CSV includes all individual samples with times

---

## Test Case 6: Equivocal Case with Kahn & Angle Guidance

### Scenario
Test the equivocal range (LI between 2-4) to see Kahn & Angle interpretive text.

### Test Steps
1. AVS – Aldosterone, Post-ACTH protocol
2. IVC: Aldosterone 10, Cortisol 15
3. Left AV: Aldosterone 300, Cortisol 500
4. Right AV: Aldosterone 150, Cortisol 450
5. Calculate

### Expected Results
- Left A/C: 0.6000
- Right A/C: 0.3333
- LI: 1.80 (between 2-4, equivocal range... wait, this is <2, bilateral)

Let me recalculate for LI between 2-4:
- Need LI = dominant/nondominant to be between 2-4
- If Left A/C = 0.8 and Right A/C = 0.3, then LI = 2.67 (equivocal)

### Corrected Test Data
3. Left AV: Aldosterone 400, Cortisol 500 (A/C = 0.8)
4. Right AV: Aldosterone 135, Cortisol 450 (A/C = 0.3)
5. IVC A/C = 10/15 = 0.667
6. Click "Calculate"

### Expected Results
- LI: 2.67 (between 2 and 4)
- Interpretation should include: "⚠️ Equivocal lateralization (LI = 2.67 between 2-4). Per Kahn & Angle 2010: ratios between 2-3 are equivocal."
- Should also check CSI and RASI for additional guidance
- **Download Button**: "Download Results as CSV" appears below interpretation

7. Review equivocal interpretation, then click "Download Results as CSV"

### Validation Checks
- [ ] Results display before any download occurs
- [ ] Warning emoji appears for equivocal result
- [ ] Kahn & Angle 2010 citation appears
- [ ] Additional guidance from CSI/RASI included if applicable
- [ ] Mentions "LI < 3 suggests possible bilateral hyperplasia" OR "LI ≥ 3 suggests unilateral asymmetry"
- [ ] Download button appears only after calculation
- [ ] CSV downloads only when button clicked

---

## Test Case 7: Unilateral Cannulation Failure with CSI/RASI Rescue

### Scenario
Test Chow 2024 unilateral-cannulating criteria when one side fails SI but CSI/RASI can still provide guidance.

### Test Steps
1. AVS – Aldosterone, Post-ACTH
2. IVC: Aldosterone 8, Cortisol 12
3. Left AV: Aldosterone 800, Cortisol 450 (SI = 37.5, PASSES)
4. Right AV: Aldosterone 50, Cortisol 40 (SI = 3.33, FAILS threshold of 5)
5. Click "Calculate"

### Expected Results
- Cannulation Status: "⚠️ Cannulation failure on right (SI < 5)"
- Should still calculate:
  - Left A/C: 1.778
  - Right A/C: 1.25
  - IVC A/C: 0.667
  - CSI: 1.25/0.667 = 1.87 (>0.5, does NOT meet Chow criteria)
  - RASI: 1.778/0.667 = 2.67 (>2.4, MEETS Chow criteria ✓)
- Interpretation: "Cannulation failure on right... However, unilateral-cannulating criteria suggest unilateral disease: RASI > 2.4 (2.67, 94.4% PPV)."
- **Download Button**: "Download Results as CSV" appears below interpretation

6. Review CSI/RASI rescue criteria, then click "Download Results as CSV"

### Validation Checks
- [ ] Results display before any download occurs
- [ ] Shows cannulation failure warning
- [ ] Still calculates CSI and RASI
- [ ] Mentions "unilateral-cannulating criteria" from Chow 2024
- [ ] Provides PPV values for CSI/RASI
- [ ] Explains that guidance is still possible despite failed cannulation
- [ ] Download button appears only after calculation
- [ ] CSV downloads only when button clicked

---

## General UI/UX Checks

### Navigation
- [ ] Calculator names appear in left sidebar
- [ ] Clicking calculator name switches view correctly
- [ ] Previous inputs are cleared when switching calculators

### Input Validation
- [ ] Number inputs only accept numbers
- [ ] Time inputs show time picker
- [ ] Date inputs show date picker
- [ ] Dropdown selections work properly
- [ ] Can clear and re-enter all fields

### Responsive Design
- [ ] Layout adapts to smaller screens
- [ ] Multi-sample inputs stack vertically on mobile
- [ ] Side-by-side comparison stacks on mobile
- [ ] All buttons accessible on touch devices

### Visual Indicators
- [ ] Green checkmarks (✓) for successful cannulation
- [ ] Red X (✗) for failed cannulation
- [ ] Warning emoji (⚠️) for equivocal results
- [ ] Color-coded result boxes (gray for cannulation status, blue for interpretation)

### CSV Download
- [ ] "Download Results as CSV" button appears only after successful calculation
- [ ] Button does not appear before calculation
- [ ] Clicking "Calculate" does NOT trigger automatic download
- [ ] CSV downloads only when "Download Results as CSV" button is clicked
- [ ] Filename includes patient initials and date
- [ ] CSV contains all sections: patient info, input data, calculations, interpretation, methodology, references
- [ ] CSV is properly formatted (commas, no HTML)
- [ ] Can open CSV in Excel/Google Sheets without issues

---

## Error Conditions to Test

### Missing Required Data
1. Try to calculate with no IVC cortisol → Should show error: "Insufficient data..."
2. Try to calculate with only left AV, no right AV → Should show error
3. Leave all fields blank and calculate → Should show appropriate error message

### Invalid Input
1. Enter negative numbers → Should either prevent or handle gracefully
2. Enter letters in number fields → Should be prevented by input type
3. Enter zero for cortisol → Should handle division by zero

### Edge Cases
1. Very large numbers (cortisol 10000) → Should calculate without crashing
2. Very small numbers (aldosterone 0.5) → Should maintain precision
3. Identical values on both sides → CLR or LI should be 1.0

---

## Performance Checks

- [ ] Page loads in <2 seconds
- [ ] Calculator switches instantly
- [ ] Calculations complete in <100ms
- [ ] No console errors in browser developer tools
- [ ] CSV downloads within 1 second of clicking "Download Results as CSV" button

---

## Accessibility Checks

- [ ] All inputs have associated labels
- [ ] Can tab through all form fields in logical order
- [ ] Results announced to screen readers (aria-live regions)
- [ ] Sufficient color contrast for all text
- [ ] Visual indicators supplemented with text (not color-only)

---

## Final Checklist

After completing all test cases:

- [ ] All calculations match expected values within rounding tolerance (±0.01)
- [ ] All visual indicators (✓, ✗, ⚠️, colors) display correctly
- [ ] CSV files download with correct filenames and complete data
- [ ] No JavaScript errors in console
- [ ] All interpretations cite correct references (Young, Naruse, Chow, Kahn & Angle)
- [ ] Multi-sample averaging works correctly
- [ ] Side-by-side comparison view functions properly
- [ ] Patient metadata appears in results and CSV
- [ ] Notes field content included in CSV
- [ ] Both calculators handle edge cases gracefully

---

## Reporting Results

Please provide:
1. **Pass/Fail Status** for each test case
2. **Screenshots** of:
   - Successful unilateral disease interpretation (cortisol)
   - Failed cannulation with visual indicators
   - Side-by-side comparison view (aldosterone)
   - Downloaded CSV file opened in spreadsheet software
3. **Any Issues Found**: Bug descriptions, unexpected behavior, UX problems
4. **Performance Metrics**: Load times, calculation speed
5. **Browser Information**: Browser name and version used for testing
6. **Overall Assessment**: Are the calculators ready for clinical use?

---

## Success Criteria

The implementation is considered successful if:
- ✅ All calculations match known clinical scenarios
- ✅ Young criteria (cortisol) correctly identifies unilateral vs bilateral disease
- ✅ Naruse/PASO criteria (aldosterone) with correct SI and LI thresholds
- ✅ Chow 2024 CSI/RASI criteria implemented and flagged correctly
- ✅ Kahn & Angle interpretive guidance appears for equivocal cases
- ✅ Multi-sample averaging works correctly
- ✅ CSV downloads contain complete clinical documentation
- ✅ Visual indicators clearly communicate cannulation success/failure
- ✅ No critical bugs or calculation errors
- ✅ Professional appearance matching existing Radulator calculators

---

**Thank you for thorough testing! Your feedback will ensure these calculators are safe and accurate for clinical use.**
