# Spleen Size (ULN) Calculator - Documentation

## Overview

The Spleen Size (ULN) Calculator provides gender- and height-adjusted upper limits of normal for spleen length and volume based on the landmark study by Chow et al. (2016). This calculator helps radiologists and clinicians determine whether an observed spleen size falls within normal limits for a patient's body habitus.

## Clinical Context

### Purpose
- Establish normal reference values for spleen size based on ultrasound measurements
- Account for physiological variation based on patient sex and body height
- Provide 95% confidence intervals for normal spleen dimensions

### Clinical Applications
- Assessment of splenomegaly in various conditions
- Pre-procedural planning for splenic interventions
- Monitoring of hematologic conditions
- Evaluation of portal hypertension
- Research studies requiring normal spleen size references

## Calculator Details

### Input Parameters

1. **Gender** (required)
   - Options: Female, Male
   - Radio button selection
   - Determines which formula to apply

2. **Body Height (cm)** (required)
   - Numeric input
   - Validated ranges:
     - Female: 155-180 cm (optimal)
     - Male: 165-200 cm (optimal)
   - Heights outside validated ranges will trigger a warning but still calculate results

### Calculation Formulas

#### Female Patients (Validated: 155-180 cm)
```
Spleen Length (cm) = (0.0282 × Height) + 7.5526
Spleen Volume (cm³) = (7.0996 × Height) - 939.5
```

#### Male Patients (Validated: 165-200 cm)
```
Spleen Length (cm) = (0.0544 × Height) + 3.6693
Spleen Volume (cm³) = (4.3803 × Height) - 457.15
```

### Output Values

The calculator provides:

1. **Spleen Length Upper Limit (cm)**
   - Displayed to 1 decimal place
   - Represents the 95th percentile for the patient's demographics

2. **Spleen Volume Upper Limit (cm³)**
   - Displayed as a whole number
   - Based on ellipsoid formula from ultrasound measurements

3. **Interpretation**
   - Within validated range: Standard interpretation indicating 95% confidence
   - Outside validated range: Warning message with extrapolation notice

### Validation Ranges

The calculator displays specific warning messages when heights fall outside validated ranges:

- **Female patients:** Warning if height < 155 cm or > 180 cm
- **Male patients:** Warning if height < 165 cm or > 200 cm

**Warning Message Format:**
> "Height outside validated range (XXX-XXX cm). Results may be less accurate."

**Modified Interpretation:**
> "The above mentioned spleen size and volume are within 95% of observations in healthy individuals (extrapolated beyond validated range)."

## Clinical Study Reference

### Primary Reference

**Study:** Chow KU, Luxembourg B, Seifried E, Bönig H. Spleen Size Is Significantly Influenced by Body Height and Sex: Establishment of Normal Values for Spleen Size at US with a Cohort of 1200 Healthy Individuals. *Radiology*. 2016 Apr;279(1):306-13.

**DOI:** [10.1148/radiol.2015150887](https://doi.org/10.1148/radiol.2015150887)

**PMID:** 26509293

### Study Details

- **Study Type:** Prospective cohort study
- **Population:** 1,200 healthy volunteers
- **Demographics:**
  - Women: 155-180 cm body height
  - Men: 165-200 cm body height
- **Imaging Method:** Ultrasound with ellipsoid formula for volume calculation
- **Statistical Method:** Linear regression through 95th percentile
- **Key Finding:** Spleen size significantly influenced by body height and sex

### Study Methodology

The researchers:
1. Measured spleen dimensions via ultrasound in healthy individuals
2. Correlated measurements with anthropometric data
3. Performed linear regression analysis
4. Established gender-specific formulas based on 95th percentile values
5. Validated ranges for different height cohorts

## Example Calculations

### Example 1: Female, 170 cm (Within Range)

**Inputs:**
- Gender: Female
- Height: 170 cm

**Calculations:**
```
Length = (0.0282 × 170) + 7.5526 = 4.794 + 7.5526 = 12.3466 ≈ 12.3 cm
Volume = (7.0996 × 170) - 939.5 = 1206.932 - 939.5 = 267.432 ≈ 267 cm³
```

**Output:**
- Spleen length should not exceed: **12.3 cm**
- Spleen volume should not exceed: **267 cm³**
- Interpretation: Within 95% of observations in healthy individuals
- Warning: None

---

### Example 2: Male, 180 cm (Within Range)

**Inputs:**
- Gender: Male
- Height: 180 cm

**Calculations:**
```
Length = (0.0544 × 180) + 3.6693 = 9.792 + 3.6693 = 13.4613 ≈ 13.5 cm
Volume = (4.3803 × 180) - 457.15 = 788.454 - 457.15 = 331.304 ≈ 331 cm³
```

**Output:**
- Spleen length should not exceed: **13.5 cm**
- Spleen volume should not exceed: **331 cm³**
- Interpretation: Within 95% of observations in healthy individuals
- Warning: None

---

### Example 3: Female, 150 cm (Below Range)

**Inputs:**
- Gender: Female
- Height: 150 cm

**Calculations:**
```
Length = (0.0282 × 150) + 7.5526 = 4.23 + 7.5526 = 11.7826 ≈ 11.8 cm
Volume = (7.0996 × 150) - 939.5 = 1064.94 - 939.5 = 125.44 ≈ 125 cm³
```

**Output:**
- Spleen length should not exceed: **11.8 cm**
- Spleen volume should not exceed: **125 cm³**
- Warning: ⚠️ **Height outside validated range (155-180 cm)**
- Interpretation: Extrapolated beyond validated range

---

### Example 4: Male, 210 cm (Above Range)

**Inputs:**
- Gender: Male
- Height: 210 cm

**Calculations:**
```
Length = (0.0544 × 210) + 3.6693 = 11.424 + 3.6693 = 15.0933 ≈ 15.1 cm
Volume = (4.3803 × 210) - 457.15 = 919.863 - 457.15 = 462.713 ≈ 463 cm³
```

**Output:**
- Spleen length should not exceed: **15.1 cm**
- Spleen volume should not exceed: **463 cm³**
- Warning: ⚠️ **Height outside validated range (165-200 cm)**
- Interpretation: Extrapolated beyond validated range

## Clinical Interpretation Guidelines

### Normal Spleen Size
- A spleen measuring **below** the calculated upper limits is considered normal size for the patient's demographics
- Values represent the 95th percentile—95% of healthy individuals have smaller spleens

### Splenomegaly Assessment
If measured spleen dimensions **exceed** the calculated upper limits:
- Consider mild splenomegaly
- Correlate with clinical context
- Evaluate for underlying causes:
  - Portal hypertension
  - Hematologic disorders
  - Infections (e.g., mononucleosis, malaria)
  - Infiltrative diseases (e.g., sarcoidosis, amyloidosis)
  - Connective tissue diseases
  - Neoplastic conditions

### Important Considerations

1. **Reference Standard:** These values are based on ultrasound measurements using the ellipsoid formula
2. **Cross-Modality Use:** Can be applied to CT/MRI measurements with appropriate correlation
3. **Population Specifics:** Derived from a cohort that may not represent all ethnic populations
4. **Clinical Correlation:** Always interpret in context of clinical presentation
5. **Extrapolation Caution:** Results outside validated height ranges are less reliable

## Measurement Techniques

### Ultrasound Measurement
The study used ultrasound with the **ellipsoid formula** for volume calculation:

```
Volume = Length × Width × Thickness × 0.523
```

Where 0.523 = π/6 (constant for ellipsoid volume)

### Measurement Tips
1. Patient positioning: Left lateral decubitus or supine
2. Probe: Curvilinear transducer (2-5 MHz typically)
3. Measure spleen in maximal dimensions
4. Use splenic hilum as anatomic landmark
5. Avoid rib shadowing

### Referencing Prostate Volume Calculator
The calculator notes: *"You can use the prostate volume calculator for volume estimation"* - this refers to using the same ellipsoid formula calculation tool for manual volume calculations if needed.

## User Interface Features

### Design Elements
- Clean, professional medical calculator interface
- Responsive design (mobile, tablet, desktop compatible)
- Clear input labels and instructions
- Gender selection via radio buttons
- Numeric input with spinbutton controls
- Prominent Calculate button
- Well-formatted results display
- Citation with DOI link

### Accessibility
- Screen reader compatible
- Keyboard navigation support
- High contrast text
- Clear visual hierarchy
- Descriptive labels

## Technical Implementation

### Technology Stack
- React 19.1.0 (functional components)
- Tailwind CSS for styling
- shadcn/ui component library
- Vite build system

### Component Location
`/src/components/calculators/SpleenSizeULN.jsx`

### Key Features
- Real-time calculation on button click
- Input validation (prevents calculation without required fields)
- Conditional warning messages
- Gender-specific formula selection
- Height range validation
- Rounded display values (1 decimal for length, whole number for volume)

## Quality Assurance

### Testing Coverage
- ✅ Female calculations (within range)
- ✅ Female calculations (outside range)
- ✅ Male calculations (within range)
- ✅ Male calculations (outside range)
- ✅ Warning message display
- ✅ Input validation
- ✅ Gender switching
- ✅ Decimal height values
- ✅ Responsive design
- ✅ Citation verification

### Automated Tests
Comprehensive Playwright E2E test suite available at:
`/tests/e2e/calculators/radiology/spleen-size.spec.js`

### Test Data
Detailed test cases and validation data:
`/.dev/docs/SPLEEN_SIZE_TEST_DATA.md`

## Known Limitations

1. **Population Specificity:** Formulas derived from specific population; may not apply to all ethnic groups
2. **Height Ranges:** Less accurate outside validated ranges (155-180 cm for females, 165-200 cm for males)
3. **Measurement Modality:** Formulas based on ultrasound; correlation with CT/MRI assumed
4. **Individual Variation:** Some healthy individuals may have spleens exceeding these limits
5. **Pediatric Populations:** Not validated for children or adolescents
6. **Clinical Correlation Required:** Calculator provides reference values only; clinical judgment essential

## Related Calculators

Within Radulator:
- **Prostate Volume:** Uses same ellipsoid formula for volume calculation
- Other radiology calculators for organ measurements and classifications

## Updates and Maintenance

**Current Version:** RadCalc 2.0
**Last Updated:** November 16, 2025
**Status:** Production-ready on test1 branch
**Formula Verification:** ✅ Confirmed accurate
**Citation Verification:** ✅ DOI accessible (with redirect)

## Support and Feedback

For questions, issues, or suggestions regarding this calculator:
- Use the "Send Feedback" feature in the application
- Reference: Spleen Size (ULN) Calculator
- Calculator ID: `spleen-size`

---

## References

1. Chow KU, Luxembourg B, Seifried E, Bönig H. Spleen Size Is Significantly Influenced by Body Height and Sex: Establishment of Normal Values for Spleen Size at US with a Cohort of 1200 Healthy Individuals. Radiology. 2016 Apr;279(1):306-13. doi: 10.1148/radiol.2015150887. Epub 2015 Oct 28. PMID: 26509293.

2. Rosenberg HK, Markowitz RI, Kolberg H, Park C, Hubbard A, Bellah RD. Normal splenic size in infants and children: sonographic measurements. AJR Am J Roentgenol. 1991 Jul;157(1):119-21.

3. Prassopoulos P, Daskalogiannaki M, Raissaki M, Hatjidakis A, Gourtsoyiannis N. Determination of normal splenic volume on computed tomography in relation to age, gender and body habitus. Eur Radiol. 1997;7(2):246-8.

---

*This documentation is part of the Radulator medical calculator suite.*
