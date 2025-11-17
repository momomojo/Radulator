# MR Elastography (Liver) Calculator

## Overview

The MR Elastography (MRE) calculator computes area-weighted mean liver stiffness across multiple regions of interest (ROIs) or slices to assess hepatic fibrosis severity. This calculator implements the standard formula used in clinical MR Elastography interpretation.

**Calculator ID:** `mr-elastography`
**Category:** Hepatology/Liver
**Primary Use:** Liver fibrosis staging (F0-F4)

## Clinical Purpose

MR Elastography is a non-invasive imaging technique that measures liver stiffness as a surrogate marker for hepatic fibrosis. The area-weighted mean approach provides a robust assessment by:

- Combining measurements from multiple liver segments
- Weighting each ROI by its area to account for sampling differences
- Reducing sampling variability compared to single-point measurements
- Providing quantitative fibrosis staging (F0-F4 scale)

## Formula

### Area-Weighted Mean Stiffness

```
Mean Stiffness (kPa) = Σ(Mi × Ai) / ΣAi
```

Where:
- **Mi** = Stiffness measurement in kilopascals (kPa) for ROI i
- **Ai** = Area of ROI i in square centimeters (cm²)
- **Σ** = Sum across all valid ROIs

### Interpretation Thresholds (60 Hz GRE)

The calculator uses frequency-adjusted interpretation based on typical 60 Hz gradient echo (GRE) sequences:

| Stiffness (kPa) | Interpretation | Fibrosis Stage |
|-----------------|----------------|----------------|
| < 2.5 | Within normal limits | F0 (No fibrosis) |
| 2.5 - 3.0 | Borderline, repeatable mild elevation | F0-F1 |
| 3.0 - 3.6 | Significant fibrosis likely | ≥F2 |
| 3.6 - 4.0 | Advanced fibrosis likely | ≥F3 |
| ≥ 4.0 | Cirrhosis likely | F4 |

**Important:** Cutoffs vary by disease etiology, vendor, sequence parameters, and driver frequency. Always correlate with clinical context and institutional protocols.

## Input Methods

The calculator supports **three different input methods** that can be used independently or combined:

### 1. Individual ROI Fields
- Enter up to 4 ROI pairs directly
- Each ROI requires:
  - Stiffness (kPa): e.g., 2.8
  - Area (cm²): e.g., 50.0
- Best for: Small number of measurements

### 2. CSV Paste
- Paste multiple ROI pairs in bulk
- Format: `kPa, Area` per line
- Supports multiple separators: comma, semicolon, space
- Handles European decimal notation (comma as decimal separator)
- Example:
  ```
  2.8, 50
  3.2, 45
  3.6, 40
  ```
- Best for: Copying from workstation reports or spreadsheets

### 3. Dynamic ROI Table
- Interactive multi-row table interface
- Add/remove rows as needed
- Real-time validation feedback
- Always maintains at least one row
- Best for: Interactive data entry with multiple slices

## Frequency Adjustment

Driver frequency affects stiffness measurements. The calculator supports:

- **40 Hz** - Less common, lower frequency
- **50 Hz** - Older systems
- **60 Hz** - Most common for GRE sequences (default)
- **90 Hz** - Higher frequency, some vendors
- **Other** - Custom frequency input

The calculator applies approximate frequency-specific adjustments to interpretation thresholds.

## Unique Features

### 1. Advanced State Management
Unlike other calculators in Radulator, MR Elastography uses **dedicated state management** (`mreRows`) for the dynamic table:
- Separate from main `vals` state object
- Synchronized via `useEffect` hook
- Enables real-time add/remove functionality

### 2. Multi-Source Input Aggregation
The calculator intelligently combines ROIs from all three input sources:
- Validates each ROI independently
- Filters invalid entries (negative values, zero area, missing data)
- Counts total valid ROIs across all sources
- Prevents calculation until at least one valid ROI exists

### 3. Real-Time Validation
- Input fields show red border for invalid values
- `aria-invalid` attribute for screen readers
- Calculate button disabled until valid data present
- Helpful error messages guide user correction

### 4. Professional Table UI
- Clean multi-row layout with column headers
- Row numbers for easy reference
- Placeholder text and input hints
- Responsive design (mobile-friendly)
- Remove buttons with disabled state on last row

## Results Display

The calculator provides comprehensive output:

1. **Total Area (cm²)** - Sum of all ROI areas
2. **Area-weighted Mean (kPa)** - Calculated mean stiffness (2 decimal precision)
3. **Interpretation** - Clinical stage and recommendation
4. **ROIs Used** - Count of valid ROIs included
5. **Frequency** - Driver frequency used
6. **Formula** - Mathematical formula displayed
7. **Notes** - Clinical context and variability warnings

### Tooltip Enhancement
The displayed mean stiffness value includes a tooltip showing the raw (unrounded) value for verification purposes.

## Clinical Interpretation Guidelines

### Normal Liver (< 2.5 kPa)
- No significant fibrosis suspected
- Follow standard screening protocols
- Consider metabolic or inflammatory causes if clinically indicated

### Borderline (2.5-3.0 kPa)
- Repeatable mild elevation
- May represent early fibrosis (F1)
- Consider follow-up imaging in 6-12 months
- Correlate with liver function tests and clinical history

### Significant Fibrosis (3.0-3.6 kPa)
- ≥F2 fibrosis likely
- Warrants hepatology consultation
- Consider etiology-specific treatment
- Monitor for progression

### Advanced Fibrosis (3.6-4.0 kPa)
- ≥F3 fibrosis likely
- Hepatology referral recommended
- Screen for varices and hepatocellular carcinoma
- Assess for transplant candidacy if progressing

### Cirrhosis (≥ 4.0 kPa)
- F4 cirrhosis likely
- Hepatocellular carcinoma surveillance every 6 months
- Endoscopic variceal screening
- Consider transplant evaluation
- Monitor for decompensation

## Technical Considerations

### ROI Placement Best Practices
1. **Avoid vessels** - Hepatic veins, portal veins reduce accuracy
2. **Avoid edges** - "Hot edges" artifact at liver surface
3. **Avoid interference** - Areas with wave interference patterns
4. **Use confidence maps** - When available, prefer high-confidence regions
5. **Sample multiple segments** - Right lobe segments V-VIII most reliable
6. **Consistent size** - ROIs 2-3 cm diameter recommended

### Quality Control
- Minimum 3 ROIs recommended for reliable staging
- ROI areas typically 20-100 cm²
- Coefficient of variation < 15% ideal
- Exclude failed acquisitions or motion artifacts

### Limitations
- Not validated in:
  - Acute hepatitis
  - Cholestatic disease (can overestimate fibrosis)
  - Congestion/heart failure (falsely elevated)
  - Infiltrative disease
  - Post-prandial state (measure fasting)
- Iron overload may affect measurements
- Obesity can reduce image quality

## Validation & Accuracy

### Formula Verification
The area-weighted calculation has been validated with multiple test cases:

**Test Case 1: Simple 2-ROI Average**
- ROI 1: 2.5 kPa × 60 cm² = 150
- ROI 2: 3.5 kPa × 40 cm² = 140
- Expected: (150 + 140) / 100 = **2.90 kPa** ✓

**Test Case 2: Demonstrating Area Weighting**
- ROI 1: 2.0 kPa × 90 cm² = 180
- ROI 2: 5.0 kPa × 10 cm² = 50
- Area-weighted: 230 / 100 = **2.30 kPa**
- Simple average would be: 3.5 kPa (incorrect)
- This confirms proper area weighting ✓

**Test Case 3: Multiple ROIs (5 segments)**
- 2.0×30 + 2.5×35 + 3.0×40 + 3.5×25 + 4.0×20 = 435
- Total area: 150 cm²
- Expected: 435 / 150 = **2.90 kPa** ✓

### Playwright Test Coverage
Comprehensive E2E tests verify:
- ✓ Visual appeal and theme consistency
- ✓ Responsive design (mobile/desktop)
- ✓ All three input methods
- ✓ Formula accuracy across ranges
- ✓ Frequency-adjusted interpretation
- ✓ Edge case handling
- ✓ Accessibility (ARIA labels, keyboard navigation)
- ✓ Reference citations
- ✓ Multi-source input aggregation
- ✓ Dynamic table functionality (add/remove rows)
- ✓ Real-time validation
- ✓ Decimal precision (2 decimals)

## References

### Primary References

1. **Manduca A, Bayly PJ, Ehman RL, et al.**
   *MR elastography: Principles, guidelines, and terminology*
   Physical Acoustics. 2020.
   [PMC8495610](https://pmc.ncbi.nlm.nih.gov/articles/PMC8495610/)
   - Consensus guidance from MRE Guidelines Committee
   - Standardized terminology and best practices
   - Quality control recommendations

2. **Mariappan YK, Glaser KJ, Ehman RL**
   *Magnetic Resonance Elastography: A Review*
   Clin Anat. 2010 Jul;23(5):497-511.
   [PMC3066083](https://pmc.ncbi.nlm.nih.gov/articles/PMC3066083/)
   - Comprehensive technical review
   - Clinical applications overview
   - Validation studies summary

3. **Resoundant Inc.**
   *Clinical Overview & Practical Tips*
   [https://www.resoundant.com/radiology](https://www.resoundant.com/radiology)
   - Commercial vendor guidance
   - Practical imaging tips
   - Troubleshooting recommendations

### Additional Key Studies

4. **Loomba R, Wolfson T, Ang B, et al.**
   *Magnetic Resonance Elastography Predicts Advanced Fibrosis in Patients With Nonalcoholic Fatty Liver Disease: A Prospective Study*
   Hepatology. 2014;60(6):1920-1928.
   - NAFLD-specific validation
   - Area under ROC: 0.92 for advanced fibrosis

5. **Yin M, Talwalkar JA, Glaser KJ, et al.**
   *Assessment of Hepatic Fibrosis With Magnetic Resonance Elastography*
   Clin Gastroenterol Hepatol. 2007;5(10):1207-1213.e2.
   - Original clinical validation study
   - Comparison with biopsy gold standard

6. **Singh S, Venkatesh SK, Loomba R, et al.**
   *Magnetic Resonance Elastography for Staging Liver Fibrosis in Non-alcoholic Fatty Liver Disease: A Diagnostic Accuracy Systematic Review and Individual Participant Data Pooled Analysis*
   Eur Radiol. 2016;26(5):1431-1440.
   - Meta-analysis of diagnostic accuracy
   - Pooled sensitivity/specificity estimates

## Usage Examples

### Example 1: Simple Three-Slice Acquisition

**Scenario:** Standard liver MRE with three axial slices

**Input (Individual Fields):**
- ROI 1: 2.8 kPa, 50 cm²
- ROI 2: 3.2 kPa, 45 cm²
- ROI 3: 3.6 kPa, 40 cm²

**Calculation:**
- Total Area: 135 cm²
- Mean: (2.8×50 + 3.2×45 + 3.6×40) / 135 = 414 / 135 = **3.07 kPa**

**Interpretation:** ≥F2 fibrosis likely

---

### Example 2: Multi-Segment CSV Import

**Scenario:** Comprehensive 6-segment evaluation from workstation

**Input (CSV Paste):**
```
2.5, 55
2.8, 50
3.1, 52
3.3, 48
2.9, 51
3.2, 49
```

**Calculation:**
- Total Area: 305 cm²
- Mean: ≈ **2.98 kPa**

**Interpretation:** Borderline to ≥F2, consider follow-up

---

### Example 3: Dynamic Table with Cirrhosis

**Scenario:** Suspected cirrhosis, four representative ROIs

**Input (Dynamic Rows):**
1. 4.2 kPa, 50 cm²
2. 4.5 kPa, 48 cm²
3. 3.9 kPa, 52 cm²
4. 4.3 kPa, 50 cm²

**Calculation:**
- Total Area: 200 cm²
- Mean: (4.2×50 + 4.5×48 + 3.9×52 + 4.3×50) / 200 = **4.22 kPa**

**Interpretation:** Cirrhosis (F4) likely

---

## Integration Notes

### Calculator Location
- **File:** `src/components/calculators/MRElastography.jsx`
- **Registered in:** `src/App.jsx` (calcDefs array)
- **Position:** 17th calculator in sidebar

### State Management Pattern
```javascript
// Unique state for dynamic rows
const [mreRows, setMreRows] = useState([{ kpa: "", area: "" }]);

// Sync to compute values
useEffect(() => {
  if (def?.id === "mr-elastography") {
    setVals((p) => ({ ...p, roi_rows: mreRows }));
  }
}, [def?.id, mreRows]);
```

### Calculate Button Logic
```javascript
// Disable until at least one valid ROI exists
const canRun = (() => {
  if (def.id !== "mr-elastography") return true;
  // ... validation logic for all three input sources
  return roisFromFields.length + roisFromCsv.length + roisFromRows.length > 0;
})();
```

## Accessibility Features

- ✓ Semantic HTML with proper `<label>` elements
- ✓ ARIA labels on dynamic table inputs (`aria-label`)
- ✓ Invalid state indicators (`aria-invalid="true"`)
- ✓ Live region for results (`aria-live="polite"`)
- ✓ Keyboard navigation support
- ✓ Screen reader friendly result announcements
- ✓ Sufficient color contrast
- ✓ Focus indicators on interactive elements

## Testing

### Running E2E Tests

```bash
# Run all MR Elastography tests
npx playwright test mr-elastography

# Run specific test group
npx playwright test mr-elastography --grep "Multiple ROIs"

# Run with UI mode for debugging
npx playwright test mr-elastography --ui

# Generate test report
npx playwright show-report
```

### Test Data Validation

All test cases use validated calculation data:
- Manual verification of area-weighted formulas
- Comparison with reference publications
- Boundary condition testing (F0/F1, F2/F3 thresholds)
- Edge case coverage (zero area, negative values, high stiffness)

## Future Enhancements

Potential improvements for consideration:

1. **Confidence Map Integration**
   - Import confidence values per ROI
   - Weight by both area and confidence
   - Filter low-confidence measurements

2. **Vendor-Specific Presets**
   - GE, Siemens, Philips sequence parameters
   - Pre-populated frequency defaults
   - Vendor-specific interpretation adjustments

3. **Longitudinal Tracking**
   - Save historical measurements
   - Plot stiffness trends over time
   - Calculate rate of change

4. **Report Generation**
   - Structured reporting template
   - Auto-populate findings
   - Export to PACS/EMR

5. **Advanced Statistics**
   - Standard deviation across ROIs
   - Coefficient of variation
   - Heterogeneity index

6. **Etiology-Specific Cutoffs**
   - NAFLD-specific thresholds
   - Hepatitis C adjustments
   - Alcohol-related liver disease
   - Cholestatic disease warnings

## Support & Troubleshooting

### Common Issues

**Q: Calculate button is disabled**
A: Enter at least one valid ROI with positive stiffness and area > 0 in any input method (fields, CSV, or dynamic rows).

**Q: ROI shows red border**
A: The value is invalid (negative, zero area, or non-numeric). Correct the value to proceed.

**Q: Unexpected interpretation for my values**
A: Verify correct frequency selection. Cutoffs are frequency-dependent and institution-specific. Always correlate with clinical context.

**Q: How many ROIs should I enter?**
A: Minimum 3 ROIs recommended for reliable staging. More ROIs improve accuracy but have diminishing returns beyond 5-6 representative measurements.

**Q: Can I mix input methods?**
A: Yes! The calculator combines ROIs from all three sources (individual fields, CSV, and dynamic rows) automatically.

### Contact

For calculator bugs or feature requests, please create an issue in the repository with:
- Calculator name and version
- Input values used
- Expected vs. actual output
- Screenshots if applicable

---

**Document Version:** 1.0
**Last Updated:** November 17, 2025
**Calculator Version:** 1.0 (Radulator 2.0)
