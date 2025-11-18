# Hip Dysplasia Indices Calculator

## Overview

The Hip Dysplasia Indices Calculator is a clinical tool designed to evaluate hip development in children using radiographic measurements. It provides age and gender-specific normal values for acetabular and femoral angles, and calculates migration indices to assess hip stability and detect dysplasia or dislocation.

## Clinical Purpose

This calculator assists clinicians in:
- Assessing hip joint development in children from newborn to school age
- Calculating migration indices to quantify hip joint displacement
- Comparing measured values against age and gender-specific normal ranges
- Early detection of developmental dysplasia of the hip (DDH)
- Monitoring hip stability in children with cerebral palsy or other neuromuscular conditions
- Determining appropriate intervention timing

## Measurements

### 1. Acetabular Index (AC-Angle / Tönnis Angle)

The acetabular index represents the slope of the acetabular roof and is crucial for detecting hip dysplasia.

**Normal Values by Age and Gender:**

| Age Range | Female | Male |
|-----------|--------|------|
| 0-3 months (newborn) | 27 ± 5° | 25 ± 5° |
| 4-6 months (infant) | 25 ± 4° | 23 ± 4° |
| 7-12 months (1 year) | 23 ± 3° | 21 ± 3° |
| 13-24 months (2 years) | 22 ± 3° | 20 ± 3° |
| 25-60 months (preschool) | 18-22° | 18-22° |
| 61+ months (school age) | 15-20° | 15-20° |

**Clinical Interpretation:**
- **0-10°**: Normal acetabular roof
- **>10°**: Indicates hip dysplasia (steeper acetabular roof)

### 2. Centrum-Collum-Diaphysis Angle (CCD-Angle)

The CCD angle measures the angle between the femoral neck and shaft, indicating femoral development.

**Normal Values by Age:**

| Age Range | Normal Range |
|-----------|--------------|
| 0-3 months | 140-150° (newborn) |
| 4-6 months | 135-145° (infant) |
| 7-12 months | 130-140° (1 year) |
| 13-24 months | 125-135° (2 years) |
| 25-60 months | 125-135° (child) |
| 61+ months | 125-135° (adult range) |

**Clinical Significance:**
- Values decrease with age as the femur develops
- Coxa valga (increased angle) may indicate developmental abnormalities
- Coxa vara (decreased angle) may suggest other pathologies

### 3. Migration Index (Reimers Index)

The migration index quantifies the percentage of the femoral head that lies lateral to Perkins' line (acetabular edge).

**Formula:**
```
Migration Index (%) = [a / (a + b)] × 100
```

Where:
- **a** = Lateral distance from femoral head to acetabular line
- **b** = Medial distance from acetabular line to center of femoral head

**Interpretation for Children Under 3 Years:**

| Migration Index | Interpretation |
|-----------------|----------------|
| 0% | Normal (perfectly centered) |
| 0-10% | Mild concern |
| 10-33% | At risk |
| 33-60% | Subluxation |
| 60-90% | Severe subluxation |
| ≥90% | Dislocation |

**Interpretation for Children 3 Years and Older:**

| Migration Index | Interpretation |
|-----------------|----------------|
| <22% | Normal |
| 22-32% | Borderline/At risk |
| 33-59% | Subluxation |
| 60-89% | Severe subluxation |
| ≥90% | Dislocation |

## How to Use

### Required Inputs

1. **Date of Birth**: Used to calculate age in months and determine appropriate normal values
2. **Gender**: Female or male (affects normal AC-angle values in young children)

### Optional Measurements

3. **AC-Angle (Right/Left)**: Acetabular index measurements for each hip
4. **CCD-Angle (Right/Left)**: Centrum-collum-diaphysis angle measurements
5. **Migration Index Measurements (Right/Left)**:
   - **a**: Lateral distance (mm or cm)
   - **b**: Medial distance (mm or cm)

### Steps

1. Enter the child's date of birth
2. Select gender (female or male)
3. Enter available measurements:
   - AC-angles if measured
   - CCD-angles if measured
   - Migration index values (a and b) for right and/or left hip
4. Click "Calculate"

### Results

The calculator provides:
- Age and gender-specific normal values for AC-angle and CCD-angle
- Calculated migration index percentage for each hip (if measurements provided)
- Clinical interpretation of migration index values

## Clinical Examples

### Example 1: Normal Newborn Female
**Input:**
- DOB: 1 month ago
- Gender: Female
- Right hip: a=0 mm, b=50 mm
- Left hip: a=0 mm, b=50 mm

**Output:**
- Normal AC-Angle: 27 ± 5°
- Normal CCD-Angle: 140-150° (newborn)
- Migration Index (Right): 0.0% - Normal
- Migration Index (Left): 0.0% - Normal

### Example 2: 4-Year-Old with Unilateral Subluxation
**Input:**
- DOB: 4 years ago
- Gender: Male
- Right hip: a=15 mm, b=85 mm
- Left hip: a=45 mm, b=55 mm

**Output:**
- Normal AC-Angle: 18-22° (preschool)
- Normal CCD-Angle: 125-135° (child)
- Migration Index (Right): 15.0% - Normal
- Migration Index (Left): 45.0% - Subluxation

### Example 3: Infant with Bilateral At-Risk Hips
**Input:**
- DOB: 5 months ago
- Gender: Female
- Right hip: a=12 mm, b=88 mm
- Left hip: a=15 mm, b=85 mm

**Output:**
- Normal AC-Angle: 25 ± 4°
- Normal CCD-Angle: 135-145° (infant)
- Migration Index (Right): 12.0% - At risk
- Migration Index (Left): 15.0% - At risk

## Clinical Significance

### Migration Index Thresholds

The different thresholds for children under vs. over 3 years reflect developmental considerations:

- **Under 3 years**: Any lateral migration is concerning as the hip should be well-centered during critical development
- **3+ years**: Up to 22% migration may be acceptable in normally developing hips

### Bilateral vs. Unilateral Assessment

- **Bilateral involvement**: Often seen in developmental dysplasia
- **Unilateral involvement**: May suggest neuromuscular pathology (e.g., cerebral palsy)
- **Asymmetry**: Significant difference between sides warrants further investigation

### Progressive Monitoring

Serial measurements allow tracking of:
- Response to treatment (bracing, surgery)
- Natural progression of dysplasia
- Risk of future subluxation or dislocation

## Measurement Technique

### Radiographic Requirements

- **Anteroposterior (AP) pelvis radiograph**
- **Patient positioning**:
  - Supine with legs extended
  - Pelvis level (no rotation)
  - Neutral hip rotation (toes pointing up)
- **Image quality**: Clear visualization of acetabular roof and femoral head

### Measurement Landmarks

**For Migration Index:**
1. Identify Perkins' line (vertical line from lateral edge of acetabulum)
2. Locate center of femoral head (using template or visual estimation)
3. Measure:
   - **a**: Horizontal distance from center of femoral head to Perkins' line (lateral portion)
   - **b**: Horizontal distance from Perkins' line to center of femoral head (medial portion)

**For AC-Angle:**
1. Draw Hilgenreiner's line (horizontal line through triradiate cartilages)
2. Draw line along acetabular roof
3. Measure angle between these two lines

**For CCD-Angle:**
1. Draw line through femoral shaft axis
2. Draw line through femoral neck axis
3. Measure angle between these lines

## Limitations

1. **Age Range**: Normal values are most well-established for children 0-15 years
2. **Measurement Variability**: Inter-observer variability exists; consistent technique is crucial
3. **Radiographic Quality**: Poor positioning can significantly affect measurements
4. **2D Limitations**: Standard radiographs may not capture complex 3D hip anatomy
5. **Isolated Values**: Should be interpreted in clinical context with physical examination

## Clinical Decision Making

### Migration Index < 22% (Normal in 3+ years)
- Routine monitoring if asymptomatic
- Consider underlying neuromuscular condition if progressive

### Migration Index 22-32% (Borderline/At Risk)
- Close follow-up with serial radiographs
- Consider conservative management (abduction bracing)
- Physical therapy assessment

### Migration Index 33-59% (Subluxation)
- Orthopedic consultation recommended
- May require surgical intervention (femoral or pelvic osteotomy)
- Risk of progression to dislocation

### Migration Index 60-89% (Severe Subluxation)
- Urgent orthopedic referral
- High likelihood of surgical intervention needed
- Functional limitations likely present

### Migration Index ≥ 90% (Dislocation)
- Immediate orthopedic consultation
- Surgical management typically required
- Poor prognosis without intervention

## References

### Primary Literature

1. **Tönnis D.** (1976). Normal values of the hip joint for the evaluation of X-rays in children and adults. *Clinical Orthopaedics and Related Research*, 119:39-47.
   - [PubMed: 954321](https://pubmed.ncbi.nlm.nih.gov/954321/)
   - Established age and gender-specific normal values for acetabular index

2. **Tönnis D.** (1984). Die Angeborene Hüftdysplasie Und Hüftluxation Im Kindes- Und Erwachsenenalter. *Springer-Verlag Berlin Heidelberg*.
   - [DOI: 10.1007/978-3-662-06621-8](https://doi.org/10.1007/978-3-662-06621-8)
   - Comprehensive textbook on congenital hip dysplasia and dislocation

3. **Reimers J.** (1980). The stability of the hip in children. A radiological study of the results of muscle surgery in cerebral palsy. *Acta Orthopaedica Scandinavica Supplementum*, 184:1-100.
   - [PubMed: 6930145](https://pubmed.ncbi.nlm.nih.gov/6930145/)
   - Developed and validated the migration index (Reimers index)

### Additional Resources

- American Academy of Orthopaedic Surgeons (AAOS) Guidelines on DDH
- Pediatric Orthopaedic Society of North America (POSNA) recommendations
- International Hip Dysplasia Institute resources

## Version History

- **v2.0** (2024): Integrated into Radulator calculator suite
  - Added age/gender-specific reference values
  - Implemented dual interpretation ranges (under/over 3 years)
  - Enhanced with reference diagram
  - Comprehensive input validation

## Related Calculators

Within Radulator:
- **Renal Cyst Bosniak**: Age-specific classification system
- **Spleen Size ULN**: Gender and height-adjusted normal values

External:
- Sharp angle measurement (complementary hip dysplasia assessment)
- Center-edge angle of Wiberg (acetabular coverage)

## Support and Feedback

For questions, corrections, or feature requests regarding this calculator, please use the Feedback Form in the application or contact the development team.

---

**Disclaimer**: This calculator is intended for educational and clinical reference purposes. All clinical decisions should be made by qualified healthcare professionals considering the complete clinical picture. The calculator does not replace clinical judgment or comprehensive patient evaluation.
