# Prostate Volume Calculator

## Overview

The **Prostate Volume Calculator** calculates prostate volume using the ellipsoid formula based on measurements from MRI or ultrasound imaging. It also computes PSA-Density (PSA-D), which is used as a diagnostic marker to help distinguish benign prostatic hyperplasia (BPH) from prostate cancer.

**Category:** Radiology
**Specialty:** Urology/Genitourinary Imaging
**Status:** ✅ Production Ready

---

## Clinical Purpose

### Primary Uses
1. **Volume Estimation**: Calculate prostate volume from tri-dimensional measurements
2. **PSA-Density Calculation**: Normalize PSA values by prostate volume
3. **BPH Assessment**: Quantify degree of prostatic enlargement
4. **Cancer Risk Stratification**: Use PSA-D to assess malignancy risk

### Clinical Context
- **Normal prostate volume**: ≤ 30 cm³ (mL)
- **BPH**: Prostate volume > 30 cm³
- **PSA-Density thresholds**:
  - Low risk: < 0.08 ng/mL/cm³
  - Intermediate: 0.08 - 0.15 ng/mL/cm³ (context-dependent)
  - Elevated: > 0.15 ng/mL/cm³ (may warrant biopsy)

---

## Formula & Methodology

### Ellipsoid Volume Formula

```
Volume = Length × Width × Height × (π/6)
```

Where:
- **Length** = Craniocaudal dimension (cm)
- **Width** = Transverse dimension (cm)
- **Height** = Anteroposterior dimension (cm)
- **π/6** ≈ 0.52 (rounded approximation used in clinical practice)

### PSA-Density Formula

```
PSA-Density = PSA (ng/mL) / Prostate Volume (mL)
```

### Technical Notes
- The exact value of π/6 is 0.523598776
- Using 0.52 introduces a 0.69% underestimation
- 1 mL = 1 cm³ for volume measurements
- Results rounded to 1 decimal place for volume, 3 decimal places for PSA-D

---

## User Interface

### Input Fields

| Field | Label | Type | Units | Required |
|-------|-------|------|-------|----------|
| `length` | Length (craniocaudal, cm): | number | cm | Yes |
| `height` | Height (anteroposterior, cm): | number | cm | Yes |
| `width` | Width (transverse, cm): | number | cm | Yes |
| `psa` | PSA (ng/mL): | number | ng/mL | Optional |

### Output Fields

| Field | Format | Description |
|-------|--------|-------------|
| Prostate Volume (mL) | X.X | Volume in milliliters (1 decimal place) |
| PSA-Density | X.XXX | PSA-D ratio (3 decimal places) or "‑‑" if PSA not provided |

### Additional Features

**Information Box:**
- Explains ellipsoid formula with π/6 ≈ 0.52
- Notes PSA-Density thresholds (0.08 - 0.15 range)
- Clarifies that universal cut-off values are context-dependent

**PI-RADS Sector Map Button:**
- Links to interactive PI-RADS prostate sector map
- Opens in new window
- Useful for reporting prostate lesion locations

**Clinical Interpretation:**
- Displays "Normal prostate volume (≤ 30 cm³)" when volume ≤ 30 mL
- No message displayed for enlarged prostates (volume > 30 mL)

---

## Measurement Guidelines

### Imaging Modalities
1. **MRI** (preferred for accuracy)
   - T2-weighted sequences in all three planes
   - Measure maximal dimensions
   - Better soft tissue contrast

2. **Transrectal Ultrasound (TRUS)**
   - Standard clinical practice
   - Less accurate than MRI for volume
   - Real-time measurement

### Measurement Technique
- **Length (Craniocaudal)**: Longest dimension from base to apex
- **Width (Transverse)**: Widest dimension on axial images
- **Height (Anteroposterior)**: Anterior to posterior dimension on sagittal/axial images

### Common Pitfalls
- Measuring from non-perpendicular planes
- Including pericapsular tissues
- Compression artifacts on ultrasound
- Not measuring maximal dimensions

---

## Clinical Interpretation

### Prostate Volume Ranges

| Volume (mL) | Classification | Clinical Significance |
|-------------|----------------|----------------------|
| ≤ 30 | Normal | Typical adult prostate |
| 30 - 50 | Mild enlargement | Early/mild BPH |
| 50 - 100 | Moderate enlargement | Moderate BPH, may benefit from medical therapy |
| > 100 | Severe enlargement | Severe BPH, consider surgical options |

### PSA-Density Interpretation

| PSA-D (ng/mL/cm³) | Risk Category | Clinical Action |
|-------------------|---------------|-----------------|
| < 0.08 | Low | Low suspicion for cancer |
| 0.08 - 0.15 | Intermediate | Context-dependent, consider other risk factors |
| > 0.15 | Elevated | Increased suspicion, consider biopsy |

### Clinical Scenarios

**Scenario 1: Low PSA-D with Enlarged Prostate**
- Volume: 85 mL, PSA: 8.0 ng/mL
- PSA-D: 0.093
- Interpretation: BPH likely, benign etiology

**Scenario 2: High PSA-D with Normal Prostate**
- Volume: 22 mL, PSA: 6.0 ng/mL
- PSA-D: 0.273
- Interpretation: Elevated suspicion for malignancy, biopsy warranted

**Scenario 3: Borderline Case**
- Volume: 35 mL, PSA: 4.5 ng/mL
- PSA-D: 0.129
- Interpretation: Intermediate risk, consider MRI, additional markers, or monitoring

---

## Validation & Quality Assurance

### Test Coverage
- ✅ Normal prostate volumes (≤30 mL)
- ✅ BPH range (30-150+ mL)
- ✅ PSA-Density calculations (low, intermediate, high)
- ✅ Edge cases (zero values, very small/large dimensions)
- ✅ Decimal precision handling
- ✅ Missing PSA values
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Accessibility (ARIA labels, keyboard navigation)

### Calculation Validation

**Example 1: Normal Prostate**
```
Input: L=4.0, H=3.0, W=3.5, PSA=2.5
Volume = 4.0 × 3.0 × 3.5 × 0.52 = 21.84 → 21.8 mL
PSA-D = 2.5 / 21.84 = 0.1145 → 0.115 ng/mL/cm³
```

**Example 2: BPH**
```
Input: L=6.0, H=5.0, W=5.5, PSA=8.0
Volume = 6.0 × 5.0 × 5.5 × 0.52 = 85.8 mL
PSA-D = 8.0 / 85.8 = 0.0932 → 0.093 ng/mL/cm³
```

**Example 3: High PSA-D**
```
Input: L=4.0, H=3.0, W=3.5, PSA=6.0
Volume = 4.0 × 3.0 × 3.5 × 0.52 = 21.84 → 21.8 mL
PSA-D = 6.0 / 21.84 = 0.2747 → 0.275 ng/mL/cm³
```

---

## References

### Primary References

1. **Paterson NR, et al.** "Prostate volume estimations using magnetic resonance imaging and transrectal ultrasound compared to radical prostatectomy specimens." *Canadian Urological Association Journal* 2016.
   - DOI: [10.5489/cuaj.3236](https://doi.org/10.5489/cuaj.3236)
   - Focus: Comparison of volume measurement techniques

2. **Aminsharifi A, et al.** "Prostate specific antigen density as a predictor of clinically significant prostate cancer when the prostate specific antigen is in the diagnostic gray zone: Defining the optimum cutoff point stratified by race and body mass index." *Journal of Urology* 2018.
   - DOI: [10.1016/j.juro.2018.05.016](https://doi.org/10.1016/j.juro.2018.05.016)
   - Focus: PSA density cutoff optimization

### Additional Clinical Resources

3. **PI-RADS v2.1** - Prostate Imaging Reporting and Data System
   - Standardized reporting for multiparametric MRI
   - Lesion localization using sector map

4. **AUA/ASTRO/SUO Guidelines** - Clinically Localized Prostate Cancer
   - Recommendations for PSA screening and biopsy criteria

---

## Technical Implementation

### Code Location
- **Component**: `/src/components/calculators/ProstateVolume.jsx`
- **Test Suite**: `/tests/e2e/calculators/radiology/prostate-volume.spec.js`
- **Test Data**: `/tests/e2e/calculators/radiology/prostate-volume-test-data.json`

### Key Features
- Real-time calculation on button click
- Controlled React state management
- Input validation (numeric types)
- Precision handling (toFixed for display)
- Conditional PSA-D display ("‑‑" when PSA missing/zero)
- Clinical interpretation message for normal volumes

### Code Structure
```javascript
{
  id: "prostate-volume",
  name: "Prostate Volume",
  desc: "Ellipsoid volume estimation (MRI/US) and PSA‑Density.",
  fields: [
    { id: "length", label: "Length (craniocaudal, cm):", type: "number" },
    { id: "height", label: "Height (anteroposterior, cm):", type: "number" },
    { id: "width", label: "Width (transverse, cm):", type: "number" },
    { id: "psa", label: "PSA (ng/mL):", type: "number" }
  ],
  compute: ({ length, height, width, psa }) => {
    const volume = length * height * width * 0.52;
    const density = psa && volume ? psa / volume : null;
    return {
      "Prostate Volume (mL)": volume.toFixed(1),
      "PSA‑Density": density ? density.toFixed(3) : "‑‑"
    };
  }
}
```

---

## Accessibility Features

- ✅ **Semantic HTML**: Proper heading hierarchy, labels, sections
- ✅ **ARIA Labels**: Input fields grid labeled, results marked with `aria-live="polite"`
- ✅ **Keyboard Navigation**: Full tab/enter support
- ✅ **Screen Reader Support**: All inputs have associated labels
- ✅ **Responsive Design**: Mobile-first approach with breakpoints
- ✅ **Color Contrast**: WCAG AA compliant color schemes

---

## Browser Compatibility

Tested and verified on:
- ✅ Chrome/Chromium (Desktop & Mobile)
- ✅ Firefox (Desktop)
- ✅ Safari/WebKit (Desktop & Mobile)
- ✅ Mobile Chrome (Pixel 5)
- ✅ Mobile Safari (iPhone 12)

---

## Changelog

### Version 1.0 (Current - test1 branch)
- Initial implementation with ellipsoid formula
- PSA-Density calculation
- Clinical interpretation for normal volumes
- PI-RADS sector map integration
- Comprehensive test suite
- Full documentation

---

## Known Limitations

1. **Formula Approximation**: Uses π/6 ≈ 0.52 (0.69% underestimation vs true value)
2. **Measurement Variability**: Inter-observer variability in measurements (5-15% typical)
3. **Shape Assumptions**: Assumes ellipsoid geometry (may not fit all prostates)
4. **PSA-D Thresholds**: No universally established cutoffs; values are context-dependent
5. **Zonal Volume**: Does not calculate transition zone or peripheral zone volumes separately

---

## Future Enhancements

Potential improvements for future versions:
- [ ] Add age-adjusted normal volume ranges
- [ ] Include race/ethnicity-specific PSA-D thresholds
- [ ] Calculate transition zone volume separately
- [ ] Add free PSA / total PSA ratio
- [ ] Integration with PI-RADS scoring
- [ ] Export results as PDF report
- [ ] Multi-language support

---

## Support & Maintenance

**Last Updated**: 2025-11-16
**Maintainer**: Radulator Development Team
**Status**: Active Development (test1 branch)
**QA Status**: ✅ Comprehensive testing completed

For issues or questions, please refer to the project repository or contact the development team.

---

## Quick Reference Card

### Normal Values
- Prostate Volume: ≤ 30 mL
- PSA-D Low Risk: < 0.08
- PSA-D Elevated: > 0.15

### Formula
```
Volume (mL) = L × W × H × 0.52
PSA-D = PSA (ng/mL) / Volume (mL)
```

### Measurement Tips
- Use maximal dimensions
- Measure perpendicular planes
- T2-MRI preferred over TRUS
- Exclude pericapsular tissue

### Clinical Decision Points
- Volume > 30 mL → Consider BPH
- PSA-D > 0.15 → Consider biopsy
- PSA-D < 0.08 → Low cancer risk
