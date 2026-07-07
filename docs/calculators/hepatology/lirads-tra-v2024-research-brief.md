# LI-RADS CT/MRI Treatment Response Assessment v2024 — Research Brief

**Status:** Research brief (stage 1 of two-stage medical pipeline)  
**Calculator ID candidate:** `lirads-tra`  
**Category candidate:** Hepatology/Liver  
**Target audience:** Radiologists, hepatologists, interventional radiologists, IR/DR residents  
**Stage 2 trigger:** Mohib Hafeez, MD sign-off on this brief

---

## 1. Scope

### 1.1 What TRA v2024 Assesses

The **LI-RADS CT/MRI Treatment Response Assessment (TRA) v2024** is the ACR-endorsed standardized system for evaluating hepatocellular carcinoma (HCC) response after locoregional therapy (LRT). It assigns **LR-TR categories** conveying the probability of residual viable tumor:

| Category | Nonradiation TRA | Radiation TRA |
|----------|-----------------|---------------|
| **LR-TR Nonevaluable** | ✓ | ✓ |
| **LR-TR Nonviable** | ✓ | ✓ |
| **LR-TR Equivocal** | ✓ | — (not in radiation core) |
| **LR-TR Nonprogressing** | — (not in nonradiation core) | ✓ *(new in v2024)* |
| **LR-TR Viable** | ✓ | ✓ |

The **decisive architectural change from v2017** is the **bifurcation** into two independent cores:

- **Nonradiation TRA core** — for ablative/embolic therapies (RFA, MWA, TACE, TAE, cryoablation, PEA, DEB-TACE) and surgical resection margin assessment. Response is immediate; masslike enhancement = viable tumor.
- **Radiation TRA core** — for radiation-based therapies (TARE/Y-90, SBRT). Delayed necrosis causes persistent enhancement; size change over time is essential; introduces the "Nonprogressing" category.

### 1.2 Relationship to Existing LI-RADS v2018 Diagnostic Calculator

Radulator's existing **`LIRADS.jsx`** implements the **CT/MRI Diagnostic Algorithm v2018** (LR-1 through LR-5, LR-M, LR-TIV) for untreated observations in at-risk patients. The TRA v2024 algorithm is a **separate, complementary tool** applied *after* locoregional therapy:

- **Diagnostic LI-RADS v2018** → initial lesion characterization (treatment-naive). NOT replaced.
- **TRA v2024** → post-treatment response assessment. NEW — no overlap with existing calculator.

They share the underlying LI-RADS lexicon but have different target populations, features, and category sets. A patient may have a diagnostic LR-5 assigned before treatment, then LR-TR categories assigned on follow-up imaging after TACE or SBRT.

### 1.3 Applicable Populations

Apply TRA v2024 to:
- High-risk patients (cirrhosis, chronic HBV, current/prior HCC, post-transplant)
- Path-proven or presumed HCC (LR-4, LR-5, LR-M) after locoregional treatment
- Post-treatment multiphase CT or MRI (extracellular or hepatobiliary contrast agents)

**Do NOT apply to:**
- Noncontrast or single-phase CT/MRI
- New or untreated observations outside the treatment zone
- Observations away from surgical margin in postsurgical patients
- Systemic therapy alone (use caution if combined with LRT)
- The v2024 TRA does not apply to immunotherapy/systemic therapy assessment — future versions may address this gap.

---

## 2. Algorithm Specification

### 2.1 Nonradiation TRA Core — Decision Logic

**Primary source:** CT/MRI LI-RADS 2024 Update (Radiology 2024;313(2):e232408), Table 1.  
**ACR core document:** LI-RADS CT/MR Nonradiation TRA v2024 Core (PDF).

The algorithm proceeds in 4 steps:

#### Step 1: Assess for masslike enhancement

Evaluate for **masslike enhancement** (any degree, any phase) within the treated lesion, along the treated lesion margin, or along the surgical resection margin.

**Definition — Masslike Enhancement:** An enhancing area (any degree of enhancement, in any postcontrast phase — arterial, portal venous, delayed) that occupies space. Examples: nodular, irregular peripheral, or thick rim enhancement. Smooth thin rim enhancement is NOT masslike.

| Finding | Impression | Category |
|---------|------------|----------|
| No enhancement within lesion or along margins | No masslike enhancement present | **LR-TR Nonviable** |
| Smooth perilesional enhancement without masslike component | Expected post-treatment change; not masslike | **LR-TR Nonviable** |
| Parenchymal perfusional changes (linear, geographic, wedge-shaped) without masslike component | Expected post-treatment change; not masslike | **LR-TR Nonviable** |
| Complete lesion disappearance | No masslike enhancement | **LR-TR Nonviable** |
| Unequivocal nodular, irregular, or thick rim enhancement | Masslike enhancement present | **LR-TR Viable** |
| Uncertain — enhancement present but morphology/degree insufficient for confident diagnosis | Uncertain presence or morphology of masslike enhancement | **LR-TR Equivocal** → Go to Step 2 |
| Cannot assess due to image degradation, omitted phase, or artifact | Masslike enhancement cannot be assessed | **LR-TR Nonevaluable** |

#### Step 2 (Optional): Apply ancillary MRI features

If Step 1 resulted in **LR-TR Equivocal** due to uncertain masslike enhancement, and MRI is available with DWI and T2-weighted sequences, optional ancillary features may be applied to **upgrade to LR-TR Viable**.

Allowed ancillary features favoring viability (MRI only):
1. **Diffusion restriction** (any degree) — signal higher than liver on DWI (b ≥ 400 s/mm²) with corresponding low ADC, not solely attributable to T2 shine-through
2. **Mild-to-moderate T2 hyperintensity** — signal higher than liver, similar to or lower than spleen, lower than simple fluid

| Condition | Action |
|-----------|--------|
| Uncertain masslike enhancement AND one or both AFs present | Upgrade to **LR-TR Viable** |
| Uncertain masslike enhancement AND no AFs present | Remain **LR-TR Equivocal** |
| Uncertain masslike enhancement AND AFs present but deemed artifactual (T2 shine-through, susceptibility) | Remain **LR-TR Equivocal** (use conservatively per ACR guidance) |
| Certain masslike enhancement (unequivocal) | **LR-TR Viable** — AFs not needed |
| No masslike enhancement | **LR-TR Nonviable** — AFs not applicable (cannot downgrade) |

> **Evidence:** Adding DWI and T2 criteria improved sensitivity for residual HCC from 57% to 71% with minimal loss of specificity (Insights Imaging 2026; doi:10.1186/s13244-026-02290-9).

#### Step 3: Tiebreaking

If unsure between two categories after Steps 1–2, choose the category reflecting **lower certainty** (i.e., LR-TR Equivocal over LR-TR Nonviable or LR-TR Viable).

| Unsure between | Choose |
|----------------|--------|
| LR-TR Nonviable vs LR-TR Equivocal | **LR-TR Equivocal** |
| LR-TR Equivocal vs LR-TR Viable | **LR-TR Equivocal** |
| LR-TR Nonviable vs LR-TR Viable (rare; use Step 2 if applicable) | **LR-TR Equivocal** (fallback) |

#### Step 4: Final check

Consider if the assigned TRA category is reasonable given the clinical context, treatment type, and time since treatment.

#### Nonradiation TRA — Complete Category Table with Management

| Category | Definition | Management Recommendation | Evidence |
|----------|------------|--------------------------|----------|
| **LR-TR Nonevaluable** | Masslike enhancement cannot be assessed (image degradation, omitted phase) | Repeat imaging ≤3 months (same or alternative modality). Do NOT assign if contrast phases are present and acceptable. | ACR Core v2024, Radiology 2024;313(2):e232408 — Section "LR-TR Nonevaluable" |
| **LR-TR Nonviable** | No masslike enhancement in treated lesion, margin, or surgical margin. Includes smooth perilesional enhancement and parenchymal perfusional changes without masslike component. | Continue monitoring ≈3 months. Same modality preferred; alternative if diagnostic advantage. | ACR Core v2024 Table — "LR-TR Nonviable" |
| **LR-TR Equivocal** | Uncertainty about presence or morphology of masslike enhancement. | Continue monitoring ≈3 months or MDD in complex cases. AFs may upgrade to Viable. Existing only in nonradiation TRA. | ACR Core v2024; Radiology 2024 Fig. 1; ECR 2025 C-22116 |
| **LR-TR Viable** | Masslike enhancement (any degree, any phase) — nodular, irregular, smooth within lesion or along margin. OR uncertain masslike enhancement + one or more ancillary features. | MDD for consensus management; often includes retreatment. | ACR Core v2024 Step 1–2; see Section 3 for examples |

---

### 2.2 Radiation TRA Core — Decision Logic

**Primary source:** CT/MRI LI-RADS 2024 Update (Radiology 2024;313(2):e232408), Table 2.  
**ACR core document:** LI-RADS CT/MR Radiation TRA v2024 Core (PDF).

The radiation TRA core replaces the LR-TR Equivocal category with **LR-TR Nonprogressing** and requires **serial assessment of size change** — a fundamentally different paradigm.

#### Step 1: Assess for masslike enhancement (current study)

Same masslike enhancement definition as nonradiation core. However, in the radiation setting:

- **Persistent intratumoral enhancement** is common after TARE/SBRT (up to 45–50% of treated lesions show enhancement at 1–3 months)
- This enhancement often represents **delayed necrosis and inflammatory change**, not viable tumor
- **Single timepoint assessment is insufficient** — comparison with prior imaging is essential

| Current Study Finding | Action |
|-----------------------|--------|
| No masslike enhancement | **LR-TR Nonviable** (final) |
| Masslike enhancement present | Compare with prior study → Step 1a |
| Cannot assess | **LR-TR Nonevaluable** |

#### Step 1a: Compare with prior imaging (size change assessment)

| Temporal Change | Impression | Category |
|----------------|------------|----------|
| New masslike enhancement (not present on prior) | Suggests viable tumor | **LR-TR Viable** (exclude pseudoprogression) |
| Increase in extent/degree of masslike enhancement over serial studies | Suggests viable tumor | **LR-TR Viable** |
| Stable masslike enhancement (same extent/degree over ≥2 studies) | May represent nonviable residual cells with delayed necrosis | **LR-TR Nonprogressing** |
| Decreasing masslike enhancement over time | Expected resolution of post-radiation change | **LR-TR Nonprogressing** |

#### Step 2 (Optional): Apply ancillary MRI features

If Step 1a resulted in **LR-TR Nonprogressing** and there is a clinical question about viability, optional ancillary features may upgrade to **LR-TR Viable** (same AF definitions as nonradiation core).

| Condition | Action |
|-----------|--------|
| Stable/decreasing enhancement + diffusion restriction or mild-moderate T2 hyperintensity | Consider upgrading to **LR-TR Viable** (use conservatively) |
| Stable/decreasing enhancement + no AFs | Remain **LR-TR Nonprogressing** |

#### Radiation TRA — Complete Category Table with Management

| Category | Definition | Management Recommendation | Evidence |
|----------|------------|--------------------------|----------|
| **LR-TR Nonevaluable** | Masslike enhancement cannot be assessed (same as nonradiation) | Repeat imaging ≤3 months | ACR Core v2024 |
| **LR-TR Nonviable** | No masslike enhancement within lesion or along margins. Expected: smooth perilesional enhancement; wedge-shaped (TARE) or round (SBRT) perfusion changes. | Continue monitoring ≈3 months (same modality preferred) | ACR Core v2024; Radiology 2024 Fig. 2 |
| **LR-TR Nonprogressing** *(new)* | Stable or decreasing masslike enhancement over time. Represents nonviable residual tumor cells undergoing delayed necrosis. Reduces false-positive Viable calls. | Short-interval follow-up ≈3 months. Watch-and-wait strategy — do NOT retreat based on stable enhancement alone. | ACR Core v2024; Radiology 2024 Table 2; ECR 2025 C-22116 |
| **LR-TR Viable** | New or increased masslike enhancement over time (any degree, any phase). Must exclude pseudoprogression (usually requires ≥2 post-treatment follow-up studies). Or stable/decreasing enhancement + ancillary features (optional). | MDD for consensus management; often includes retreatment | ACR Core v2024; PMC12149880; PubMed 40304670 |

> **Critical warning:** After SBRT, pseudoprogression (transient increase in APHE size mimicking progression) occurs in some patients. Confirming viability usually requires **≥2 post-treatment follow-up studies** showing sustained or progressive increase.

---

### 2.3 Summary Comparison: v2017 → v2024

| Aspect | v2017 (TR) | v2024 Nonradiation | v2024 Radiation |
|--------|-----------|-------------------|-----------------|
| **Number of cores** | 1 (combined) | 1 (dedicated) | 1 (dedicated) |
| **Viable criteria** | APHE + washout OR enhancement similar to pretreatment (3 criteria) | Masslike enhancement (any degree, any phase) — single criterion | New or increased masslike enhancement over time |
| **Ancillary features** | None | Optional: DWI restriction + T2 mild-moderate hyperintensity (upgrade only) | Same AFs (upgrade from Nonprogressing) |
| **Equivocal category** | Present (broad, high inter-reader variability) | Present (narrowed — uncertainty about masslike enhancement) | Removed (replaced by Nonprogressing) |
| **Washout** | Required for viable | Removed as criterion | Removed as criterion |
| **Size change** | Not emphasized | Not required (response is immediate) | Essential criterion (stable/decreasing vs new/increasing) |
| **Validation** | Sensitivity 62%, specificity 87% | Early data: improved sensitivity, maintained specificity | Reduced false-positive Viable calls |

---

## 3. Worked Examples

### Example 1: Nonradiation TRA — LR-TR Nonviable (Complete Response after RFA)

**Clinical context:** 62-year-old male with cirrhosis (HCV), solitary 3.2 cm HCC (LR-5) in segment 6 treated with RFA 6 months ago.

**Imaging findings (4-phase CT):**
- Treated lesion: well-defined hypodense ablation zone without internal enhancement
- Margin: thin (<2 mm), smooth, linear rim enhancement (reactive hyperemia) along the ablation margin
- Surrounding parenchyma: geographic wedge-shaped arterial hyperenhancement without mass effect (arterioportal shunt)
- No nodular, irregular, or thick enhancement

**Algorithm steps:**
1. Step 1: No masslike enhancement → smooth perilesional enhancement only, consistent with expected post-RFA change
2. Step 2: AFs not applicable (no equivocal finding)
3. **Final category: LR-TR Nonviable**

**Management:** Continue routine surveillance (≈3 months).

**Source:** Adapted from Radiology 2024;313(2):e232408, Fig. 3 (case of complete necrosis after RFA).

---

### Example 2: Nonradiation TRA — LR-TR Viable (Residual Tumor after TACE)

**Clinical context:** 58-year-old female with NASH cirrhosis, 4.5 cm HCC treated with DEB-TACE 3 months ago.

**Imaging findings (MRI with ECA):**
- Treated lesion: predominantly necrotic with internal T1 hyperintense foci (coagulative necrosis)
- **Foci of nodular enhancement** along the medial margin of the treatment zone — arterial phase hyperenhancement, persisting on portal venous and delayed phases
- DWI: nodular foci show diffusion restriction (low ADC, b=800)
- T2: corresponding mild-to-moderate hyperintensity

**Algorithm steps:**
1. Step 1: Unequivocal nodular masslike enhancement along margin
2. Step 2: AFs not needed — enhancement is unequivocal
3. **Final category: LR-TR Viable**

**Management:** Refer for MDD; likely retreatment (additional TACE or ablation).

**Source:** Pattern consistent with Radiology 2024 Fig. 5 (residual enhancing tumor after TACE) and ECR 2025 C-22116 Fig. 9–10.

---

### Example 3: Nonradiation TRA — LR-TR Equivocal, Upgraded to Viable via AFs

**Clinical context:** 55-year-old male with chronic HBV, 2.8 cm HCC treated with MWA 4 months ago.

**Imaging findings (MRI with HBA):**
- Ablation zone: predominantly nonenhancing, well-defined
- Along inferolateral margin: a **small (<5 mm) focus of questionable enhancement** — visible on arterial phase but barely perceptible on portal venous and delayed phases. Uncertain whether masslike or volume averaging.
- DWI: the same area shows **mild diffusion restriction** (ADC ≈1.1 × 10⁻³ mm²/s)
- T2: **mild hyperintensity** in the same area
- Prior comparison (3-month post-MWA study): this focus was not present

**Algorithm steps:**
1. Step 1: Uncertain masslike enhancement → **LR-TR Equivocal**
2. Step 2: Apply AFs — diffusion restriction present AND mild-moderate T2 hyperintensity present
3. **Upgrade to LR-TR Viable** (two ancillary features present)

**Management:** Short-interval follow-up in 3 months or MDD discussion for retreatment.

**Source:** Pattern based on Radiology 2024 Fig. 6 and ACR Core v2024 AF guidance. Note that early detection of recurrence enables intervention at median 5.1 months post-surgery vs 12 months with older criteria (AJR 2025; doi:10.2214/AJR.25.33787).

---

### Example 4: Radiation TRA — LR-TR Nonprogressing (Stable Enhancement after SBRT)

**Clinical context:** 67-year-old male with alcohol-related cirrhosis, 2.1 cm HCC treated with SBRT 6 months ago.

**Imaging findings (MRI with ECA — current and prior):**
- **3-month post-SBRT:** treated lesion shows nodular intratumoral enhancement on arterial phase, persisting on portal venous phase. Lesion size 2.3 cm (slight increase from pre-treatment 2.1 cm).
- **6-month post-SBRT (current):** Lesion still shows nodular intratumoral enhancement, similar extent and degree as 3-month study. Size stable at 2.3 cm.
- No new enhancing nodules
- Wedge-shaped perilesional enhancement (expected post-TARE/SBRT perfusion change)
- DWI: mild heterogeneous signal, not clearly restricted
- T2: mild heterogeneous hyperintensity

**Algorithm steps:**
1. Step 1: Masslike enhancement present
2. Step 1a: Enhancement **stable** over 3-month interval (not new, not increased). Size stable (2.3 → 2.3 cm)
3. Step 2 (Optional AFs): Mild heterogeneous DWI/T2 — not clearly positive for restriction or T2 hyperintensity per AF definitions
4. **Final category: LR-TR Nonprogressing**

**Management:** Continue short-interval follow-up in 3 months. No retreatment indicated. If progressive increase on next study → upgrade to LR-TR Viable.

**Source:** Pattern consistent with Radiology 2024 Fig. 7–8; ECR 2025 C-22116 Fig. 14–15. Matches the 45% of SBRT-treated HCCs with residual enhancement but complete pathological necrosis on explant (Mendiratta-Lala et al., cited in Radiology 2024).

---

### Example 5: Radiation TRA — LR-TR Viable (Progressive Enhancement after TARE)

**Clinical context:** 60-year-old female with NASH cirrhosis, bilobar HCC treated with TARE/Y-90 9 months ago.

**Prior imaging (3- and 6-month post-TARE):**
- Treated right lobe lesion showed mild persistent enhancement, **stable** in extent — classified as Nonprogressing at 6 months.

**Current imaging (9-month MRI with ECA):**
- Right lobe lesion: clear **interval increase** in enhancing component — nodular enhancement now extends beyond prior treatment zone
- New small nodule along the medial margin of the treatment zone (not present before)
- DWI: new nodule shows unequivocal diffusion restriction (low ADC)
- T2: new nodule shows mild-moderate T2 hyperintensity
- Lesion size: increased from 3.1 cm (6 months) to 4.5 cm (current)

**Algorithm steps:**
1. Step 1: Masslike enhancement present
2. Step 1a: Enhancement **increased** in extent AND new nodule present — progressive change
3. Step 2: Not needed (unequivocal progression)
4. **Final category: LR-TR Viable**

**Management:** MDD for retreatment (additional TARE, ablation, or systemic therapy).

**Source:** Pattern consistent with Radiology 2024 Fig. 2 and ECR 2025 C-22116 Fig. 16 (progressive disease after TARE).

---

## 4. Open Questions for Physician

Before proceeding to implementation (stage 2), the following design questions need Mohib's clinical judgment:

### Q1: Single Calculator with Treatment Core Selector vs Two Separate Calculator Entries

The TRA v2024 algorithm has two distinct cores with different logic, categories, and decision trees. Two design options:

- **Option A (single entry):** One calculator (`lirads-tra`) with a radio selector at the top: "Nonradiation LRT" vs "Radiation LRT." The compute function branches accordingly. More compact, less registry overhead, but the UI is more complex.
- **Option B (two entries):** `lirads-tra-nonradiation` and `lirads-tra-radiation` as separate calculator entries, each with its own URL, meta description, and distilled logic tree. Simpler per-calculator UI; better SEO targeting ("LI-RADS TRA nonradiation calculator" vs "LI-RADS TRA radiation calculator"); but inflates registry count and could confuse users searching for "LI-RADS TRA."

**Clinical preference?** Option A is more typical for LI-RADS family tools — the existing diagnostic LI-RADS handles multiple lesion features within one calculator. But the radiation/nonradiation cores are fundamentally different enough that Option B may be clinically cleaner.

### Q2: Include Surgical Resection Margin Application or Not?

The nonradiation TRA core explicitly states that the algorithm may be applied to evaluate the **surgical margin after HCC resection** (AJR 2025; doi:10.2214/AJR.25.33787). Including this adds clinical utility but:
- The user would need to select "post-resection margin" vs "post-LRT" as a sub-option
- The imaging features are identical (masslike enhancement = LR-TR Viable at margin)
- The management implications differ (recurrence at resection margin may warrant different intervention than residual tumor after TACE)

**Include the resection margin use case** as a note/option, or omit for clarity and add in a future update?

### Q3: Should Ancillary Features Be Mandatory or Optional in the Calculator?

The ACR specifies AFs as **optional** — they may be used to upgrade from Equivocal/Nonprogressing to Viable. Implementation options:

- **Option 1:** Always show DWI/T2 inputs. When the user selects "equivocal masslike enhancement" or "stable/decreasing after radiation," enable AF fields that can push the result to Viable.
- **Option 2:** Keep AF fields hidden by default with an "Include ancillary MRI features?" toggle. Recommended for MRI-only users.
- **Option 3:** Omit AFs entirely in v1 and add them in a follow-up. Keeps the calculator simpler but misses the v2024's key diagnostic improvement.

**Preference?** Given that AFs are the most impactful change in v2024 (improving sensitivity from 57% to 71%), Option 1 or 2 seems appropriate for v1.

---

## 5. References

### Primary Source

1. **Aslam A, Nishino M, Cruite I, et al.** CT/MRI LI-RADS 2024 Update: Treatment Response Assessment. *Radiology*. 2024;313(2):e232408.  
   DOI: [10.1148/radiol.232408](https://doi.org/10.1148/radiol.232408)  
   PMID: [39530896](https://pubmed.ncbi.nlm.nih.gov/39530896/)  
   **Key tables/figures:** Table 1 (nonradiation TRA categories), Table 2 (radiation TRA categories), Fig. 1 (nonradiation algorithm flowchart), Fig. 2 (radiation algorithm flowchart), Figs. 3–8 (case examples for nonradiation), Figs. 7–8 (radiation examples).

### ACR Core Documents

2. **ACR.** LI-RADS CT/MR Nonradiation Treatment Response Assessment v2024 Core. (PDF)  
   Available at: [https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/LI-RADS](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/LI-RADS)  
   Direct download: [LI-RADS-CTMR-Nonradiation-TRA-v2024-Core.pdf](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/LI-RADS/LI-RADS-CTMR-Nonradiation-TRA-v2024-Core.pdf)

3. **ACR.** LI-RADS CT/MR Radiation Treatment Response Assessment v2024 Core. (PDF)  
   Direct download: [LI-RADS-CTMR-Radiation-TRA-v2024-Core.pdf](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/LI-RADS/LI-RADS-CTMR-Radiation-TRA-v2024-Core.pdf)

### Review and Educational Articles

4. **Shin J, Gu K, Min JH.** LI-RADS CT/MRI Treatment Response Assessment Update in 2024. *J Korean Soc Radiol*. 2025;86(3):352–363.  
   DOI: [10.3348/jksr.2025.0028](https://doi.org/10.3348/jksr.2025.0028)  
   PMCID: PMC12149880  
   **Comprehensive Korean-language review of both cores with validation data.**

5. **Del Blanco CR, et al.** LI-RADS 2024 radiation and nonradiation treatment response algorithms: what's new? *ECR 2025*, C-22116.  
   DOI: [10.26044/ecr2025/C-22116](https://dx.doi.org/10.26044/ecr2025/C-22116)  
   **Educational poster with worked examples (Figs. 4–16).**

6. **The 2024 LI-RADS treatment response update: practical reporting after non-radiation and radiation locoregional therapies for hepatocellular carcinoma.** *Insights Imaging*. 2026 (in press).  
   DOI: [10.1186/s13244-026-02290-9](https://doi.org/10.1186/s13244-026-02290-9)  
   **Practical reporting guide with evidence synthesis and management recommendations.**

### Validation and Comparative Studies

7. **Nonradiation TRA v2024 vs v2017 for post-TACE assessment.** *AJR*. 2024.  
   DOI: [10.2214/AJR.24.32035](https://doi.org/10.2214/AJR.24.32035)  
   **Early validation: improved sensitivity of masslike enhancement criterion.**

8. **LI-RADS CT/MRI Nonradiation TRA v2024 for detecting local recurrence after surgical resection of HCC.** *AJR*. 2025.  
   DOI: [10.2214/AJR.25.33787](https://doi.org/10.2214/AJR.25.33787)  
   **Validates resection margin use case; median 5.1 months to detection vs 12 months with older criteria.**

### Existing LI-RADS Diagnostic Calculator Reference (for context only)

9. **Chernyak V, Fowler KJ, Kamaya A, et al.** LI-RADS v2018: Liver Imaging Reporting and Data System. *Radiology*. 2018;289(3):816–830.  
   DOI: [10.1148/radiol.2018180174](https://doi.org/10.1148/radiol.2018180174)  
   **Radulator's existing `LIRADS.jsx` implements this diagnostic algorithm. NOT replaced by TRA v2024.**

---

## Document Metadata

- **Author:** Radulator agent (research brief, stage 1)
- **Date:** 2026-06-11
- **Branch:** `radulator/t_lirads-tra-v2024-brief`
- **Target repository:** [momomojo/Radulator](https://github.com/momomojo/Radulator)
- **Calculator factory pipeline status:** Stage 1 complete → awaiting physician sign-off for stage 2 (implementation seed)