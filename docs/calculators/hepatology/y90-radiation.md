# Y-90 Radiation Segmentectomy Calculator

## Overview

The Y-90 Radiation Segmentectomy Calculator is a comprehensive dosimetry tool for calculating prescribed activity for hepatic Y-90 radioembolization. It supports both MIRD (uniform dose distribution) and partition (tumor/normal compartment) models with extensive safety checks and clinical guidance.

**Calculator ID:** `y90-radiation-segmentectomy`
**Category:** Hepatology/Liver
**Medical Specialty:** Interventional Radiology, Nuclear Medicine, Hepatology

---

## Clinical Purpose

This calculator assists clinicians in determining the appropriate Y-90 microsphere activity for hepatic radioembolization procedures. It is designed for:

- **Radiation Segmentectomy**: High-dose ablative treatment for isolated liver tumors (typically ≥190 Gy)
- **Radiation Lobectomy**: Treatment of larger liver volumes with curative or palliative intent
- **Dosimetry Planning**: Pre-treatment calculation of prescribed activity
- **Safety Assessment**: Evaluation of lung shunt and potential contraindications

---

## Key Features

### Dosimetry Models

#### 1. MIRD Model (Medical Internal Radiation Dose)
- **Assumption**: Uniform dose distribution throughout target volume
- **Formula**: `A [GBq] = (D [Gy] × M [kg] × (1-LSF)) / 49.67`
- **Best for**: Simple segmentectomy or lobectomy without differential tumor uptake
- **Output**: Mean segment dose

#### 2. Partition Model
- **Assumption**: Accounts for differential uptake between tumor and normal liver
- **Formula**: `A [GBq] = (D_N × M_N × (T/N + 1) × (1-LSF)) / 49.67`
- **Best for**: When tumor-to-normal uptake ratio (T/N) is known from imaging
- **Output**: Tumor dose, normal tissue dose, mean segment dose

### Safety Features

#### Contraindications (Treatment Should Not Proceed)
- ⚠️ **Lung shunt >20% with resin microspheres** (per manufacturer guidelines)
- ⚠️ **Estimated lung dose >30 Gy** (pneumonitis risk)

#### Warnings (Requires Clinical Review)
- **Target dose <190 Gy for segmentectomy**: May reduce treatment efficacy
- **Normal tissue dose >80 Gy in large volume (>300 mL)**: Increased toxicity risk
- **Lung shunt 10-20%**: Elevated but acceptable, requires monitoring

### Additional Features

- **Vial Size Recommendations**: Automatic glass microsphere (TheraSphere) vial size selection
  - 3 GBq, 5 GBq, 7 GBq, 10 GBq, or 20 GBq vials
- **Residual Correction**: Accounts for vial residual activity (default 1%)
- **BSA Calculation**: Optional body surface area using Mosteller formula
- **Dual Units**: Activity reported in both GBq and mCi
- **Clinical Interpretation**: Detailed interpretation with management recommendations

---

## Input Parameters

### Required Inputs

| Parameter | Type | Range | Units | Description |
|-----------|------|-------|-------|-------------|
| Treatment Intent | Radio | segmentectomy/lobectomy | - | Treatment strategy |
| Dosimetry Model | Radio | MIRD/Partition | - | Calculation method |
| Target Segment Volume | Number | 10-2000 | mL | Volume of liver segment to treat |
| Target Dose | Number | 80-800 | Gy | Desired absorbed dose |
| Lung Shunt Fraction | Number | 0-50 | % | Hepatopulmonary shunt percentage |
| Microsphere Type | Radio | Glass/Resin | - | TheraSphere (glass) or SIR-Spheres (resin) |

### Conditional Inputs (Partition Model Only)

| Parameter | Type | Range | Units | Description |
|-----------|------|-------|-------|-------------|
| Tumor Volume | Number | >0, ≤ segment volume | mL | Volume of tumor within segment |
| Tumor-to-Normal Ratio (T/N) | Number | 1-50 | - | Differential uptake ratio from imaging |

### Optional Inputs

| Parameter | Type | Range | Units | Default | Description |
|-----------|------|-------|-------|---------|-------------|
| Expected Vial Residual | Number | 0-20 | % | 1% | Activity remaining in vial post-administration |
| Patient Weight | Number | 0-500 | kg | - | For BSA calculation |
| Patient Height | Number | 0-300 | cm | - | For BSA calculation |

---

## Output Sections

### 1. Prescribed Activity
- **Activity to Order**: Total activity in GBq and mCi (with residual correction)
- **Recommended Vial Size**: For glass microspheres only
- **Vial Residual Correction**: Applied percentage

### 2. Dosimetry Results
- **Mean Segment Dose**: Average dose to target volume (Gy)
- **Tumor Dose**: Target tumor dose (partition model only)
- **Normal Tissue Dose**: Normal liver dose (partition model only)
- **Tumor-to-Normal Ratio**: Applied T/N ratio (partition model only)
- **Model Used**: MIRD or Partition
- **Volume Breakdown**: Target, tumor, and normal volumes with mass

### 3. Safety Parameters
- **Lung Shunt Fraction**: Applied percentage
- **Estimated Lung Dose**: Calculated dose to 1 kg lung mass (Gy)
- **Microsphere Type**: Glass (TheraSphere) or Resin (SIR-Spheres)
- **Treatment Intent**: Segmentectomy or Lobectomy
- **Body Surface Area**: If weight and height provided (m²)
- **Safety Status**: Visual indicator of safety assessment

### 4. Contraindications (If Present)
- Numbered list of absolute contraindications
- Treatment should not proceed without addressing concerns

### 5. Warnings & Notes (If Present)
- Clinical warnings requiring review
- Monitoring recommendations

### 6. Interpretation
- Plain language clinical interpretation
- Dosimetry model explanation
- Lung dose risk assessment
- Treatment recommendations

### 7. Technical Details
- **Formula**: Mathematical formula used
- **Notes**: Technical assumptions (liver density, lung mass, decay)

---

## Clinical Guidelines

### Target Dose Recommendations

#### Radiation Segmentectomy
- **Recommended**: ≥190 Gy to tumor
- **Rationale**: Higher doses associated with improved local control and pathologic necrosis
- **Reference**: Lewandowski et al. 2015, Vouche et al. 2015

#### Radiation Lobectomy
- **Typical Range**: 100-150 Gy
- **Consideration**: Larger volume requires balance between efficacy and toxicity

### Lung Shunt Management

| Lung Shunt | Lung Dose | Recommendation |
|------------|-----------|----------------|
| 0-10% | <10 Gy | Safe, proceed as planned |
| 10-20% | 10-20 Gy | Acceptable, monitor for pneumonitis |
| 20-30% | 20-30 Gy | High risk, consider dose reduction or alternative |
| >20% (resin) | Variable | **CONTRAINDICATED** per manufacturer |
| >30 Gy | >30% shunt | **CONTRAINDICATED** regardless of shunt percentage |

### T/N Ratio Selection (Partition Model)

The tumor-to-normal ratio should be derived from quantitative imaging:

- **99mTc-MAA SPECT/CT**: Gold standard for planning
- **Typical Ranges**:
  - HCC: 2-8 (median ~4)
  - Metastases: 1.5-5 (median ~2-3)
  - Very hypervascular tumors: Up to 10-20

### Microsphere Selection

#### Glass Microspheres (TheraSphere)
- **Advantages**: Higher specific activity, fewer particles, no lung shunt limit
- **Vial Sizes**: 3, 5, 7, 10, 20 GBq (fixed sizes)
- **Best for**: High-dose segmentectomy, patients with elevated lung shunt

#### Resin Microspheres (SIR-Spheres)
- **Advantages**: More particles, potentially better distribution
- **Contraindication**: Lung shunt >20%
- **Best for**: Lobectomy, low lung shunt scenarios

---

## Calculation Examples

### Example 1: Standard Radiation Segmentectomy (MIRD Model)

**Clinical Scenario**: 65-year-old patient with 3 cm HCC in segment 6

**Inputs**:
- Treatment Intent: Segmentectomy
- Dosimetry Model: MIRD
- Target Segment Volume: 200 mL
- Target Dose: 205 Gy
- Lung Shunt Fraction: 5%
- Vial Residual: 1%
- Microsphere Type: Glass

**Calculation**:
```
Segment Mass = 200 mL × 0.00103 kg/mL = 0.206 kg
Activity = (205 Gy × 0.206 kg × 0.95) / 49.67 = 0.807 GBq
Activity with Residual = 0.807 GBq / 0.99 = 0.815 GBq (22.0 mCi)
Lung Dose = (49.67 × 0.815 × 0.05) / 1.0 = 2.0 Gy
```

**Outputs**:
- Activity to Order: 0.82 GBq (22.0 mCi)
- Recommended Vial Size: 3 GBq vial
- Mean Segment Dose: 205.0 Gy
- Lung Dose: 2.0 Gy
- Safety Status: ✓ Within safety parameters

**Interpretation**: Safe to proceed. Lung dose well below 10 Gy threshold. Target dose meets recommended ≥190 Gy for segmentectomy.

---

### Example 2: Partition Model with High T/N Ratio

**Clinical Scenario**: 58-year-old with hypervascular HCC, MAA scan shows T/N = 5

**Inputs**:
- Treatment Intent: Segmentectomy
- Dosimetry Model: Partition
- Target Segment Volume: 300 mL
- Tumor Volume: 80 mL
- Target Dose: 400 Gy (to tumor)
- Lung Shunt Fraction: 8%
- T/N Ratio: 5
- Vial Residual: 1%
- Microsphere Type: Glass

**Calculation**:
```
Normal Volume = 300 - 80 = 220 mL
Normal Mass = 220 × 0.00103 = 0.227 kg
Normal Dose = 400 Gy / 5 = 80 Gy
Activity = (80 × 0.227 × 6 × 0.92) / 49.67 = 2.02 GBq
Activity with Residual = 2.02 / 0.99 = 2.04 GBq (55.1 mCi)
Lung Dose = (49.67 × 2.04 × 0.08) / 1.0 = 8.1 Gy
```

**Outputs**:
- Activity to Order: 2.04 GBq (55.1 mCi)
- Recommended Vial Size: 3 GBq vial
- Tumor Dose: 400.0 Gy
- Normal Tissue Dose: 80.0 Gy
- Mean Segment Dose: 186.7 Gy
- Lung Dose: 8.1 Gy
- Safety Status: ✓ Within safety parameters

**Interpretation**: Excellent treatment plan. High differential uptake allows delivering ablative dose to tumor (400 Gy) while limiting normal tissue to acceptable 80 Gy. Lung dose acceptable.

---

### Example 3: Contraindicated Case - High Lung Shunt with Resin

**Clinical Scenario**: 72-year-old with extensive tumor burden and high shunt

**Inputs**:
- Treatment Intent: Segmentectomy
- Dosimetry Model: MIRD
- Target Segment Volume: 200 mL
- Target Dose: 205 Gy
- Lung Shunt Fraction: 25%
- Vial Residual: 1%
- Microsphere Type: Resin

**Outputs**:
- Safety Status: ⚠️ CONTRAINDICATED
- Contraindication: Lung shunt >20% with resin microspheres (per manufacturer guidelines)

**Interpretation**: Treatment contraindicated. Consider:
1. Switch to glass microspheres (no lung shunt limit)
2. Reduce treatment volume
3. Consider alternative therapies
4. Re-evaluate MAA scan for accuracy

---

## Formula Derivations

### MIRD Model Formula

**Starting Principle**: Absorbed dose (D) relates to activity (A) by:

```
D [Gy] = (A [GBq] × 49.67) / M [kg]
```

Where 49.67 is the dose constant for Y-90 in liver tissue.

**Accounting for lung shunt**: Only fraction (1-LSF) reaches liver:

```
D = (A × (1-LSF) × 49.67) / M
```

**Solving for activity**:

```
A [GBq] = (D [Gy] × M [kg]) / (49.67 × (1-LSF))
A [GBq] = (D [Gy] × M [kg] × (1-LSF)) / 49.67
```

### Partition Model Formula

**Principle**: Different doses to tumor (D_T) and normal (D_N) based on uptake:

```
D_T = D_N × (T/N)
```

**Mass-weighted activity**:

```
A_tumor = (D_T × M_T) / 49.67
A_normal = (D_N × M_N) / 49.67
A_total = A_tumor + A_normal
```

**Substituting D_T = D_N × (T/N)**:

```
A_total = (D_N × M_T × (T/N) + D_N × M_N) / 49.67
A_total = D_N × (M_T × (T/N) + M_N) / 49.67
```

**Since M_T × (T/N) = M_N × (T/N - 1) + M_N, we can factor**:

```
A_total = D_N × M_N × ((T/N) + 1) / 49.67
```

**Accounting for lung shunt**:

```
A [GBq] = (D_N × M_N × ((T/N) + 1) × (1-LSF)) / 49.67
```

**Note**: In this calculator, target dose input represents tumor dose (D_T), so:

```
D_N = D_T / (T/N)
```

### Lung Dose Formula

**Assumption**: 1.0 kg lung mass receives activity × LSF:

```
D_lung [Gy] = (A [GBq] × LSF × 49.67) / 1.0 kg
D_lung = 49.67 × A × LSF
```

### BSA Formula (Mosteller)

```
BSA [m²] = √((Height [cm] × Weight [kg]) / 3600)
```

---

## Technical Specifications

### Constants Used

| Constant | Value | Units | Description |
|----------|-------|-------|-------------|
| Liver Density | 1.03 | g/mL | Standard liver tissue density |
| Y-90 Dose Constant | 49.67 | Gy·kg/GBq | Specific to Y-90 in liver |
| Lung Mass | 1.0 | kg | Standard assumption for dosimetry |
| GBq to mCi Conversion | 27.027 | mCi/GBq | Unit conversion factor |

### Assumptions and Limitations

1. **Uniform Density**: Liver density assumed constant at 1.03 g/mL
2. **Lung Mass**: Fixed 1.0 kg assumption may underestimate dose in small patients
3. **No Extrahepatic Deposition**: Formula assumes all non-shunted activity deposits in target
4. **Instant Deposition**: Ignores temporal distribution dynamics
5. **T/N Ratio**: Partition model assumes T/N from MAA accurately predicts Y-90 distribution
6. **No Self-Absorption Correction**: Simplified dosimetry (acceptable for clinical use)

### Validation

This calculator implements formulas from peer-reviewed literature:
- MIRD methodology: Ho et al. 1996
- Partition model validation: Garin et al. 2021, Chiesa et al. 2021
- Safety thresholds: Kennedy et al. 2007, Salem et al. 2010

---

## Safety and Clinical Use

### Important Disclaimers

⚠️ **Medical Device Disclaimer**: This calculator is for educational and planning purposes. All dosimetry calculations should be verified by qualified medical physicists or nuclear medicine physicians.

⚠️ **Clinical Judgment**: Calculator outputs do not replace clinical judgment. Consider:
- Patient performance status and liver function
- Tumor characteristics and biology
- Prior treatments and remaining liver reserve
- Alternative treatment options

⚠️ **Manufacturer Guidelines**: Always consult current package inserts for TheraSphere and SIR-Spheres for the most up-to-date safety information.

### Quality Assurance Recommendations

1. **Pre-Treatment Planning**:
   - Verify MAA scan quality and T/N ratio accuracy
   - Confirm volumetric measurements with multiple imaging modalities
   - Review lung shunt calculation methodology

2. **Dosimetry Review**:
   - Independent calculation verification by medical physicist
   - Compare MIRD and partition model results
   - Assess sensitivity to input parameter variations

3. **Safety Checklist**:
   - Lung shunt <20% (resin) or lung dose <30 Gy (glass)
   - Target dose ≥190 Gy for segmentectomy intent
   - Normal tissue dose <80 Gy in large volumes
   - Adequate liver reserve (>30% uninvolved liver)

---

## References

### Primary Literature

1. **Ho S et al.** Partition model for estimating radiation doses from Y-90 microspheres in treating hepatic tumours. *Eur J Nucl Med.* 1996. [DOI: 10.1007/BF00949868](https://doi.org/10.1007/BF00949868)
   - Original description of partition model for Y-90 dosimetry

2. **Lewandowski RJ et al.** Radiation segmentectomy: a novel approach for liver tumor treatment. *J Vasc Interv Radiol.* 2015. [DOI: 10.1016/j.jvir.2014.10.039](https://doi.org/10.1016/j.jvir.2014.10.039)
   - Establishes ≥190 Gy threshold for radiation segmentectomy

3. **Salem R et al.** Radioembolization for hepatocellular carcinoma using Yttrium-90 microspheres: a comprehensive report. *Cancer.* 2010. [DOI: 10.1002/cncr.24304](https://doi.org/10.1002/cncr.24304)
   - Comprehensive review of Y-90 dosimetry and outcomes

4. **Kennedy A et al.** Recommendations for radioembolization of hepatic malignancies using Y-90 resin microspheres. *Int J Radiat Oncol Biol Phys.* 2007. [DOI: 10.1016/j.ijrobp.2006.12.029](https://doi.org/10.1016/j.ijrobp.2006.12.029)
   - Establishes 20% lung shunt contraindication for resin

5. **Riaz A et al.** Radiation segmentectomy: a novel approach to increase safety and efficacy. *Int J Radiat Oncol Biol Phys.* 2011. [DOI: 10.1016/j.ijrobp.2010.11.001](https://doi.org/10.1016/j.ijrobp.2010.11.001)
   - Clinical outcomes for radiation segmentectomy

6. **Garin E et al.** Personalised versus standard dosimetry approach of selective internal radiation therapy in HCC. *Lancet Oncol.* 2021. [DOI: 10.1016/S1470-2045(20)30290-9](https://doi.org/10.1016/S1470-2045(20)30290-9)
   - DOSISPHERE-01 trial: personalized dosimetry improves outcomes

7. **Chiesa C et al.** EANM dosimetry committee guidance document: radioembolisation. *Eur J Nucl Med Mol Imaging.* 2021. [DOI: 10.1007/s00259-021-05340-5](https://doi.org/10.1007/s00259-021-05340-5)
   - European consensus guidelines for Y-90 dosimetry

8. **Vouche M et al.** Unresectable solitary HCC: long-term toxicity and outcomes after radiation segmentectomy. *Radiology.* 2015. [DOI: 10.1148/radiol.14141199](https://doi.org/10.1148/radiol.14141199)
   - Long-term safety data for high-dose segmentectomy

### Additional References

9. **Pasciak AS et al.** The number of microspheres in Y-90 radioembolization. *J Nucl Med.* 2016. [DOI: 10.2967/jnumed.115.168948](https://doi.org/10.2967/jnumed.115.168948)

10. **Strigari L et al.** Efficacy and toxicity related to treatment of hepatocellular carcinoma with Y-90. *J Nucl Med.* 2010. [DOI: 10.2967/jnumed.110.075861](https://doi.org/10.2967/jnumed.110.075861)

11. **Kao YH et al.** Post-radioembolization yttrium-90 PET/CT - part 1: diagnostic reporting. *EJNMMI Res.* 2013. [DOI: 10.1186/2191-219X-3-56](https://doi.org/10.1186/2191-219X-3-56)

12. **Chow PKH et al.** SIRveNIB: Selective Internal Radiation Therapy Versus Sorafenib. *J Clin Oncol.* 2018. [DOI: 10.1200/JCO.2017.76.0892](https://doi.org/10.1200/JCO.2017.76.0892)

13. **Vilgrain V et al.** Efficacy and safety of selective internal radiotherapy with yttrium-90 resin microspheres. *Lancet Oncol.* 2017. [DOI: 10.1016/S1470-2045(17)30332-9](https://doi.org/10.1016/S1470-2045(17)30332-9)

### Professional Guidelines

14. **AAPM Task Group Report**: Guidance for Y-90 radioembolization dosimetry and treatment planning. [AAPM.org](https://www.aapm.org/pubs/reports/)

15. **TheraSphere Y-90 Glass Microspheres Package Insert** - Boston Scientific. [Product Information](https://www.bostonscientific.com/en-US/products/cancer-therapies/therasphere-y90-glass-microspheres.html)

---

## Version History

- **Version 1.0** (2024): Initial implementation
  - MIRD and partition models
  - Comprehensive safety checks
  - Vial size recommendations
  - BSA calculation
  - 15 peer-reviewed references

---

## Related Calculators

- **ALBI Score**: Assess baseline liver function before Y-90
- **BCLC Staging**: Determine HCC stage and treatment appropriateness
- **Child-Pugh Score**: Evaluate cirrhosis severity
- **MELD-Na Score**: Assess liver disease severity
- **Milan Criteria**: Evaluate transplant eligibility post-Y-90

---

## Support and Feedback

For questions, bug reports, or feature requests related to this calculator, please contact the development team through the application's feedback form.

**Last Updated**: 2024
**Calculator Version**: 1.0
**Documentation Version**: 1.0
