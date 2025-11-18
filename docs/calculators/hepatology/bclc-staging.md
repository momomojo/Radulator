# BCLC Staging Calculator - Documentation

## Overview

The **Barcelona Clinic Liver Cancer (BCLC) Staging Calculator** is a comprehensive clinical decision support tool for hepatocellular carcinoma (HCC) staging. It integrates multiple clinical parameters to provide prognostic stratification and evidence-based treatment recommendations.

### Key Features

- **5-Stage Classification System**: Stage 0 (Very Early), A (Early), B (Intermediate), C (Advanced), D (Terminal)
- **Integrated Child-Pugh Scoring**: Automatic calculation of liver function class (A, B, C)
- **ECOG Performance Status**: Assessment of patient functional capacity (0-4 scale)
- **Tumor Burden Assessment**: Number, size, and distribution of tumors
- **Vascular Invasion Detection**: Portal vein, hepatic vein, and segmental involvement
- **Metastasis Evaluation**: Lymph node and distant metastasis assessment
- **Treatment Recommendations**: Evidence-based therapy guidance for each stage
- **Prognostic Information**: Expected survival and outcomes

---

## Clinical Background

### BCLC Staging System

The BCLC staging system is the gold standard for HCC staging, endorsed by:
- **EASL** (European Association for the Study of the Liver)
- **AASLD** (American Association for the Study of Liver Diseases)
- **EORTC** (European Organization for Research and Treatment of Cancer)

**Original Publication**: Llovet JM, Bru C, Bruix J. *Semin Liver Dis.* 1999;19(3):329-338
**Latest Update**: Reig M, Forner A, Rimola J, et al. *J Hepatol.* 2022;76(3):681-693

### Staging Algorithm

The BCLC staging follows a hierarchical decision tree:

```
1. Check for Stage D criteria (Terminal)
   - ECOG Performance Status >2, OR
   - Child-Pugh Class C without transplant option

2. Check for Stage C criteria (Advanced)
   - Vascular invasion (any type), OR
   - Extrahepatic spread (lymph nodes or distant)

3. Assess tumor burden for Stages 0, A, B (if ECOG 0-2)
   - Stage 0: Single tumor ≤2cm + ECOG 0 + Child-Pugh A
   - Stage A: Single tumor (any size) OR 2-3 tumors ≤3cm + ECOG 0
   - Stage B: Multifocal beyond Stage A criteria + ECOG 0
```

---

## Input Parameters

### 1. Tumor Burden

#### Number of Tumors
- **Single tumor**: Solitary HCC lesion
- **2-3 tumors**: Oligonodular disease
- **More than 3 tumors**: Multinodular/multifocal disease

#### Largest Tumor Size
- **Input**: Diameter in centimeters
- **Range**: 0.1 - 30.0 cm
- **Critical Thresholds**:
  - ≤2.0 cm: Stage 0 eligibility
  - ≤3.0 cm: Milan criteria for transplant
  - >5.0 cm: Advanced disease consideration

#### All Tumors ≤3 cm?
- **Purpose**: Determine Milan criteria eligibility
- **Options**:
  - Yes - all tumors ≤3 cm (within Milan)
  - No - at least one tumor >3 cm (beyond Milan)
  - N/A - single tumor

### 2. Vascular Invasion & Metastasis

#### Vascular Invasion
- **None**: No vascular involvement
- **Portal vein - segmental/sectoral**: Limited involvement
- **Portal vein - left/right/main trunk**: Major vessel involvement
- **Hepatic vein invasion**: IVC/hepatic vein involvement

**Clinical Significance**: Any vascular invasion → Stage C (Advanced)

#### Extrahepatic Spread
- **None**: Confined to liver
- **Lymph node metastasis**: Regional or distant nodes
- **Distant metastasis**: Lung, bone, brain, other organs

**Clinical Significance**: Any extrahepatic spread → Stage C (Advanced)

### 3. Performance Status

#### ECOG Performance Status
- **0**: Fully active, no restrictions on physical activity
- **1**: Restricted in strenuous activity, ambulatory and able to carry out light work
- **2**: Ambulatory and capable of self-care, unable to work, up >50% of waking hours
- **3**: Limited self-care capability, confined to bed/chair >50% of waking hours
- **4**: Completely disabled, cannot carry out any self-care, bedbound

**Critical Thresholds**:
- ECOG 0: Required for Stages 0, A, B
- ECOG 1-2: May qualify for Stage B or C
- ECOG >2: Automatic Stage D (Terminal)

### 4. Liver Function (Child-Pugh Components)

#### Total Bilirubin (mg/dL)
- **Normal**: <1.2 mg/dL
- **Scoring**:
  - <2.0 mg/dL → 1 point
  - 2.0-3.0 mg/dL → 2 points
  - >3.0 mg/dL → 3 points

#### Serum Albumin (g/dL)
- **Normal**: 3.5-5.5 g/dL
- **Scoring**:
  - >3.5 g/dL → 1 point
  - 2.8-3.5 g/dL → 2 points
  - <2.8 g/dL → 3 points

#### INR (International Normalized Ratio)
- **Normal**: <1.1
- **Scoring**:
  - <1.7 → 1 point
  - 1.7-2.2 → 2 points
  - >2.2 → 3 points

#### Ascites
- **None** → 1 point
- **Slight** (detectable by ultrasound) → 2 points
- **Moderate to Severe** (clinically evident) → 3 points

#### Hepatic Encephalopathy
- **None** → 1 point
- **Grade 1-2** (mild confusion, lethargy) → 2 points
- **Grade 3-4** (stupor, coma) → 3 points

**Child-Pugh Classification**:
- **Class A**: 5-6 points (well-compensated)
- **Class B**: 7-9 points (significantly compromised)
- **Class C**: 10-15 points (decompensated)

### 5. Transplant Eligibility

- **Yes - eligible for transplant**: Patient meets transplant criteria
- **No - not a candidate**: Contraindications exist
- **Unknown**: Assessment pending

**Clinical Significance**: Child-Pugh C patients without transplant option → Stage D

---

## Output & Interpretation

### BCLC Stage Results

#### Stage 0 (Very Early)
- **Criteria**: Single tumor ≤2cm + ECOG 0 + Child-Pugh A
- **Treatment**: Resection or ablation (RFA/MWA) preferred; TACE if ablation not feasible
- **Prognosis**: >5 years median survival; 75% 5-year survival
- **Patient Profile**: Best candidates for curative therapy

#### Stage A (Early)
- **Criteria**:
  - Single tumor (any size), OR
  - 2-3 tumors all ≤3cm (Milan criteria)
  - ECOG 0
- **Treatment**:
  - Resection or ablation for single tumors
  - Liver transplant for multiple tumors or high recurrence risk
  - TACE as alternative
- **Prognosis**: >5 years median survival; 81 months median OS
- **Patient Profile**: Curative treatment candidates

#### Stage B (Intermediate)
- **Criteria**:
  - Multifocal disease beyond Stage A criteria
  - ECOG 0
  - No vascular invasion or metastasis
- **Treatment**:
  - TACE (for well-defined nodules)
  - Systemic therapy (for diffuse/extensive disease)
  - Liver transplant (if extended criteria met with downstaging)
- **Prognosis**: ~2.5 years (30 months) median survival
- **Patient Profile**: Palliative but potentially effective treatment

#### Stage C (Advanced)
- **Criteria**:
  - Vascular invasion (any type), OR
  - Extrahepatic spread (lymph nodes or distant)
  - ECOG 0-2
- **Treatment**:
  - **First-line**: Atezolizumab + Bevacizumab (IMbrave150 trial)
  - **Alternatives**: Sorafenib or Lenvatinib
  - **Second-line**: Regorafenib, Cabozantinib
- **Prognosis**: ~2 years median survival with systemic therapy
- **Patient Profile**: Systemic therapy candidates

#### Stage D (Terminal)
- **Criteria**:
  - ECOG Performance Status >2, OR
  - Child-Pugh Class C without transplant option
- **Treatment**: Best supportive care, symptomatic management
- **Prognosis**: ~3 months median survival
- **Patient Profile**: Palliative care focus

### Child-Pugh Score Output

The calculator automatically computes and displays:
- **Total Points**: Sum of 5 components (5-15 range)
- **Class**: A (5-6), B (7-9), or C (10-15)
- **Interpretation**:
  - Class A: Well-compensated cirrhosis
  - Class B: Significantly compromised liver function
  - Class C: Decompensated cirrhosis

### Additional Output Elements

- **Stage Details**: Explanation of why patient was assigned specific stage
- **ECOG Performance Status**: Confirmation of functional status
- **Recommended Treatment**: Evidence-based therapy options
- **Expected Prognosis**: Survival estimates from clinical trials
- **Liver Function Assessment**: Detailed Child-Pugh interpretation

---

## Clinical Use Cases

### Use Case 1: Screening Candidate for Curative Therapy

**Scenario**: 62-year-old with cirrhosis, surveillance ultrasound finds 1.5cm lesion

**Inputs**:
- Single tumor: 1.5 cm
- No vascular invasion
- No metastasis
- ECOG 0 (fully active)
- Bilirubin 0.9, Albumin 4.2, INR 1.0
- No ascites or encephalopathy

**Result**: Stage 0, Child-Pugh A (5 points)
**Treatment**: Resection or RFA/MWA ablation
**Prognosis**: Excellent (>5 years)

### Use Case 2: Transplant Evaluation

**Scenario**: 58-year-old with 3 small HCC lesions, considering transplant

**Inputs**:
- 2-3 tumors, largest 2.8 cm, all ≤3 cm
- No vascular invasion
- No metastasis
- ECOG 0
- Bilirubin 1.3, Albumin 3.6, INR 1.2
- No ascites or encephalopathy

**Result**: Stage A, Child-Pugh A (5 points), within Milan criteria
**Treatment**: Liver transplant preferred
**Prognosis**: Excellent with transplant (>5 years)

### Use Case 3: Advanced Disease with Portal Vein Invasion

**Scenario**: 71-year-old with large HCC and main portal vein thrombosis

**Inputs**:
- Single tumor: 5.0 cm
- Portal vein - left/right/main trunk invasion
- No metastasis
- ECOG 1 (ambulatory)
- Bilirubin 1.5, Albumin 3.5, INR 1.3
- No ascites or encephalopathy

**Result**: Stage C, Child-Pugh A (5 points)
**Treatment**: Atezolizumab + Bevacizumab (first-line systemic therapy)
**Prognosis**: ~2 years with systemic therapy

### Use Case 4: Decompensated Cirrhosis

**Scenario**: 65-year-old with HCC and severe liver dysfunction

**Inputs**:
- Single tumor: 3.0 cm
- No vascular invasion
- No metastasis
- ECOG 1
- Bilirubin 4.5, Albumin 2.5, INR 2.5
- Moderate ascites, Grade 3-4 encephalopathy
- Not a transplant candidate

**Result**: Stage D, Child-Pugh C (15 points)
**Treatment**: Best supportive care
**Prognosis**: ~3 months

---

## Edge Cases & Special Considerations

### Boundary Conditions

#### Tumor Size 2.0cm (Stage 0 vs A)
- **At exactly 2.0cm**: Qualifies for Stage 0 if all other criteria met
- **At 2.1cm**: Automatically Stage A, not Stage 0

#### Child-Pugh Class Boundaries
- **Bilirubin 2.0 mg/dL**: Scores 2 points (threshold is ≥2.0)
- **Albumin 3.5 g/dL**: Scores 2 points (threshold is ≤3.5)
- **INR 1.7**: Scores 2 points (threshold is ≥1.7)

### Complex Scenarios

#### Stage 0 Requirements
All four criteria MUST be met:
1. Single tumor ≤2.0cm
2. ECOG 0
3. Child-Pugh Class A
4. No vascular invasion or metastasis

Missing any criterion → Stage A or higher

#### Both Vascular Invasion AND Metastasis
- Result: Stage C
- Details show both factors
- Treatment remains systemic therapy

#### Child-Pugh C with Transplant Eligibility
- If transplant candidate: May avoid Stage D despite Child-Pugh C
- If not a candidate: Automatic Stage D

### ECOG and Stage Relationships

- **ECOG 0**: Required for Stages 0, A, B
- **ECOG 1-2**: Compatible with Stages A, B, C
- **ECOG >2**: Forces Stage D regardless of tumor burden

---

## Treatment Recommendations by Stage

### Stage 0 Treatment Options

1. **Resection** (first choice if feasible)
   - Anatomic resection for curative intent
   - Requires adequate liver reserve

2. **Ablation** (RFA or MWA)
   - For tumors ≤2cm
   - Excellent local control
   - Less invasive than resection

3. **TACE** (if ablation not feasible)
   - Alternative if technical limitations
   - Good local control

### Stage A Treatment Options

1. **Resection**
   - For single tumors with preserved liver function
   - Preferred in Child-Pugh A patients

2. **Liver Transplant**
   - For multiple tumors within Milan criteria
   - High recurrence risk patients
   - Best long-term outcomes

3. **Ablation**
   - For small tumors (<3cm)
   - Percutaneous or laparoscopic approach

4. **TACE**
   - Bridge to transplant
   - Alternative to ablation

### Stage B Treatment Options

1. **TACE** (primary therapy)
   - For well-defined nodules
   - Multiple sessions often needed
   - On-demand approach

2. **Systemic Therapy**
   - For diffuse/extensive disease
   - TACE-refractory cases

3. **Liver Transplant**
   - Extended criteria with successful downstaging
   - Selected centers and protocols

### Stage C Treatment Options

1. **First-line Systemic Therapy**
   - **Atezolizumab + Bevacizumab** (preferred)
     - IMbrave150 trial: median OS 19.2 months
     - Combination immunotherapy + anti-VEGF

2. **Alternative First-line**
   - **Sorafenib**: multi-kinase inhibitor, median OS 10.7 months
   - **Lenvatinib**: non-inferior to sorafenib

3. **Second-line Therapy**
   - **Regorafenib**: post-sorafenib progression
   - **Cabozantinib**: multi-kinase inhibitor
   - **Ramucirumab**: post-sorafenib with AFP ≥400 ng/mL

### Stage D Treatment Options

1. **Best Supportive Care**
   - Symptom management
   - Pain control
   - Nutritional support

2. **Palliative Interventions**
   - Manage ascites
   - Prevent/treat encephalopathy
   - Address complications

3. **Quality of Life Focus**
   - Hospice referral when appropriate
   - Advance care planning

---

## Validation & Accuracy

### Child-Pugh Scoring Validation

The calculator implements the original Pugh modification:

**Pugh RN, Murray-Lyon IM, et al.** *Br J Surg.* 1973;60(8):646-649

| Parameter | 1 Point | 2 Points | 3 Points |
|-----------|---------|----------|----------|
| Bilirubin (mg/dL) | <2.0 | 2.0-3.0 | >3.0 |
| Albumin (g/dL) | >3.5 | 2.8-3.5 | <2.8 |
| INR | <1.7 | 1.7-2.2 | >2.2 |
| Ascites | None | Slight | Moderate |
| Encephalopathy | None | Grade 1-2 | Grade 3-4 |

**Classification**:
- Class A: 5-6 points
- Class B: 7-9 points
- Class C: 10-15 points

### BCLC Algorithm Validation

The staging algorithm follows the 2022 BCLC update:

**Reig M, Forner A, Rimola J, et al.** *J Hepatol.* 2022;76(3):681-693

**Key Algorithm Steps**:
1. Check terminal criteria (Stage D)
2. Check advanced criteria (Stage C)
3. Assess tumor burden (Stages 0/A/B)

**Decision Points**:
- Stage 0: ≤2cm threshold is inclusive (2.0cm qualifies)
- Stage C: Any vascular invasion or metastasis
- Stage D: ECOG >2 OR Child-Pugh C (without transplant)

---

## Testing & Quality Assurance

### Test Coverage

The calculator includes comprehensive E2E tests covering:

1. **All 5 Stages**: 0, A, B, C, D
2. **Child-Pugh Scoring**: All three classes (A, B, C)
3. **Edge Cases**: Boundary values, threshold testing
4. **Vascular Invasion Types**: All 4 options
5. **Metastasis Types**: Lymph node and distant
6. **ECOG Levels**: All 5 performance statuses (0-4)
7. **Complex Scenarios**: Multiple risk factors

### Test Files

- **E2E Tests**: `/tests/e2e/calculators/hepatology/bclc-staging.spec.js`
- **Test Data**: `/tests/fixtures/bclc-staging-test-cases.json`
- **Test Helper**: `/tests/helpers/calculator-test-helper.js`

### Validation Test Cases

Key test scenarios include:
- Stage 0: Tumor exactly 2.0cm (boundary)
- Stage A: Single tumor >2cm
- Stage A: Milan criteria (2-3 tumors ≤3cm)
- Stage B: >3 tumors
- Stage C: All vascular invasion types
- Stage C: Both invasion AND metastasis
- Stage D: ECOG >2
- Stage D: Child-Pugh C without transplant
- Child-Pugh: All boundary scores (5, 6, 7, 9, 10, 15)
- Edge cases: Decimal precision at thresholds

---

## Reference Citations

### Primary BCLC References

1. **Original BCLC System**
   Llovet JM, Bru C, Bruix J. Prognosis of hepatocellular carcinoma: the BCLC staging classification. *Semin Liver Dis.* 1999;19(3):329-338.
   [DOI: 10.1055/s-2007-1007122](https://doi.org/10.1055/s-2007-1007122)

2. **BCLC 2022 Update**
   Reig M, Forner A, Rimola J, et al. BCLC strategy for prognosis prediction and treatment recommendation: The 2022 update. *J Hepatol.* 2022;76(3):681-693.
   [PMC8866082](https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/)

3. **BCLC 2025 Update**
   Reig M, Forner A, Ávila MA, et al. BCLC strategy for prognosis prediction and treatment recommendations: The 2025 update. *J Hepatol.* 2025.
   [DOI: 10.1016/j.jhep.2025.10.020](https://doi.org/10.1016/j.jhep.2025.10.020)

4. **Barcelona Approach**
   Llovet JM, Brú C, Bruix J. The Barcelona approach: diagnosis, staging, and treatment of hepatocellular carcinoma. *Liver Transpl.* 2004;10(2 Suppl 1):S115-20.
   [DOI: 10.1002/lt.20034](https://doi.org/10.1002/lt.20034)

### Child-Pugh References

5. **Original Child-Pugh Publication**
   Pugh RN, Murray-Lyon IM, Dawson JL, et al. Transection of the oesophagus for bleeding oesophageal varices. *Br J Surg.* 1973;60(8):646-649.
   [DOI: 10.1002/bjs.1800600817](https://doi.org/10.1002/bjs.1800600817)

6. **Child-Pugh Clinical Use**
   StatPearls - Use of The Child Pugh Score in Liver Disease. NCBI Bookshelf. Updated 2024.
   [NCBI Books](https://www.ncbi.nlm.nih.gov/books/NBK542308/)

### ECOG Performance Status

7. **Original ECOG Publication**
   Oken MM, Creech RH, Tormey DC, et al. Toxicity and response criteria of the Eastern Cooperative Oncology Group. *Am J Clin Oncol.* 1982;5(6):649-655.
   [PubMed: 7165009](https://pubmed.ncbi.nlm.nih.gov/7165009/)

8. **ECOG-ACRIN Reference**
   ECOG-ACRIN Cancer Research Group. ECOG Performance Status Scale.
   [ECOG-ACRIN](https://ecog-acrin.org/resources/ecog-performance-status/)

### Treatment References

9. **Atezolizumab + Bevacizumab (IMbrave150)**
   Finn RS, Qin S, Ikeda M, et al. Atezolizumab plus Bevacizumab in Unresectable Hepatocellular Carcinoma. *N Engl J Med.* 2020;382(20):1894-1905.
   [DOI: 10.1056/NEJMoa1915745](https://doi.org/10.1056/NEJMoa1915745)

10. **EASL Clinical Practice Guidelines**
    European Association for the Study of the Liver. EASL Clinical Practice Guidelines: Management of hepatocellular carcinoma. *J Hepatol.* 2018;69(1):182-236.
    [DOI: 10.1016/j.jhep.2018.03.019](https://doi.org/10.1016/j.jhep.2018.03.019)

11. **AASLD Guidelines**
    Heimbach JK, Kulik LM, Finn RS, et al. AASLD guidelines for the treatment of hepatocellular carcinoma. *Hepatology.* 2018;67(1):358-380.
    [DOI: 10.1002/hep.29086](https://doi.org/10.1002/hep.29086)

12. **Hepatic Encephalopathy Guidelines**
    Vilstrup H, Amodio P, Bajaj J, et al. Hepatic encephalopathy in chronic liver disease: 2014 Practice Guideline. *Hepatology.* 2014;60(2):715-735.
    [DOI: 10.1002/hep.27210](https://doi.org/10.1002/hep.27210)

---

## Frequently Asked Questions

### Q: What if my patient doesn't fit neatly into one stage?

**A:** The BCLC system uses a hierarchical algorithm. Some patients may have borderline features. The calculator follows the 2022 update guidelines, which prioritize:
1. Terminal criteria (Stage D) first
2. Advanced criteria (Stage C) second
3. Tumor burden assessment last

For borderline cases, multidisciplinary tumor board discussion is recommended.

### Q: Why did my patient with a small tumor get Stage A instead of Stage 0?

**A:** Stage 0 has strict criteria - ALL must be met:
- Single tumor ≤2.0cm (not 2.1cm)
- ECOG 0 (not 1 or 2)
- Child-Pugh A (not B or C)
- No vascular invasion or metastasis

Missing even one criterion moves patient to Stage A.

### Q: Can a patient move from Stage B to Stage A after downstaging?

**A:** Yes. After successful downstaging therapy (e.g., TACE reducing tumor burden from >3 tumors to 2-3 tumors ≤3cm), patients can be re-staged. This is particularly relevant for transplant evaluation.

### Q: What if my patient has ECOG 1 but meets Stage 0 tumor criteria?

**A:** Stage 0 specifically requires ECOG 0. ECOG 1 patients would be classified as Stage A (early) or higher depending on other factors.

### Q: How do I interpret "borderline" Child-Pugh values?

**A:** The calculator uses standard thresholds:
- Bilirubin ≥2.0 scores 2 points (not 1)
- Albumin ≤3.5 scores 2 points (not 1)
- INR ≥1.7 scores 2 points (not 1)

Values at exact thresholds are included in the higher-scoring category per the original Pugh publication.

### Q: Should I use BCLC for cholangiocarcinoma or other liver tumors?

**A:** No. BCLC is specifically validated for hepatocellular carcinoma (HCC) only. Use appropriate staging systems for other liver malignancies.

### Q: What about patients with HCC and HIV or other comorbidities?

**A:** BCLC staging focuses on HCC-specific factors. Comorbidities should be considered separately in treatment planning, but don't directly affect BCLC stage assignment.

---

## Version History

- **v2.0** (2024): Implemented 2022 BCLC update with Atezolizumab + Bevacizumab as first-line Stage C therapy
- **v1.0** (2023): Initial implementation with original BCLC criteria and Child-Pugh scoring

---

## Contact & Support

For questions about this calculator or to report issues:
- Submit feedback via the Feedback Form in the application
- Review test files for usage examples
- Consult primary references for clinical guidance

**Medical Disclaimer**: This calculator is for educational and clinical decision support purposes. Always consult current clinical guidelines and consider individual patient factors when making treatment decisions.
