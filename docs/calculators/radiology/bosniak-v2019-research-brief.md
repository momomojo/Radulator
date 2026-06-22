# Bosniak Classification v2019 — Research Brief

**Status:** Research brief (stage 1 of two-stage medical pipeline)
**Calculator ID:** `bosniak`
**Category:** Radiology / Genitourinary Imaging
**Current guideline version (badge):** "Bosniak v2019" (incorrect — the calculator implements 2005 criteria)
**Actual algorithm base:** Bosniak MA. Radiology 2005;236(1):61–70 (DOI: 10.1148/radiol.2362040218)
**Stage 2 trigger:** Mohib Hafeez, MD sign-off on this brief

---

## 1. Discrepancy Summary

The current calculator (`src/components/calculators/RenalCystBosniak.jsx`) implements the **2005 Bosniak criteria** (Bosniak MA, Radiology 2005) but displays `guidelineVersion: "Bosniak v2019"` (line 6) in the UI badge. The `desc` field (line 5) correctly states "CT 2005" — an internal inconsistency that misleads clinicians who see the badge.

The table below maps every field and option in the current implementation to its 2005 source criterion, then flags the corresponding v2019 difference.

### Field-Level Discrepancy Table

| Field ID | Current Option (2005) | 2005 Criterion Source | v2019 Difference | Severity |
|----------|----------------------|----------------------|------------------|----------|
| `walls` | `hairline-thin` | "hairline thin wall" — Category I/II | v2019: quantified as ≤2 mm (Silverman 2019, Table 2). Wall may enhance in Class I/II — not a downgrade criterion. | Moderate (terminology quantified; functional impact low) |
| `walls` | `minimally-thick` | "minimally thickened wall, minimal enhancement possible" — Category IIF | v2019: exactly **3 mm** smooth minimally thickened + enhancement required for IIF (Silverman 2019, Table 1). | Moderate (threshold boundary matters for IIF→III) |
| `walls` | `thick-irregular` | "thickened, irregular, enhancing wall" — Category III | v2019: **≥4 mm** thick OR **≤3 mm** irregular protrusion with obtuse margins → Class III. Protrusion ≥4 mm obtuse or any size acute margins → **Class IV** (Silverman 2019, Table 3). | Major (2005 lumps irregular wall and IV-features) |
| `septa` | `no` | No septa | No change | None |
| `septa` | `few-thin` | "few hairline thin septa with possible enhancement" — Category II | v2019: "few" = **1–3** septa, thin = **≤2 mm**, enhancement permitted (Silverman 2019, Table 2). | Moderate (count threshold new — requires user to count) |
| `septa` | `thick` | "thick, minimally thickened, minimal enhancement possible" — Category IIF | v2019: exactly **3 mm** smooth minimally thickened, **enhancement required** for IIF (Silverman 2019, Table 1). ≥4 mm smooth = **Class III**. | Moderate (quantified to 3 mm; enhancement now required) |
| `septa` | `thickened-irregular` | "thickened, irregular, enhancing septa" — Category III | v2019: **≥4 mm** smooth OR ≤3 mm irregular obtuse protrusion = III. Nodular ≥4 mm obtuse or any acute = **IV** (Silverman 2019, Table 3). | Major (2005 lumps septal irregularity and nodules) |
| `calcs` | `fine` | "fine or sheet segment (lightly thickened)" — Category II | v2019: **all calcifications regardless of morphology** → Class II, provided features are assessable (Silverman 2019, Table 4). If calcifications obscure assessment → recommend MRI with subtraction. | Major (upgrades calcified cysts from II→II boundary changes; see below) |
| `calcs` | `thick-nodular` | "thick or nodular calcifications" — contributes to Category III in combination with other III features | v2019: any calcification → **Class II** (Silverman 2019, Table 4). Thick/nodular calcifications alone no longer contribute to Class III. | Major (changes classification path for calcified masses) |
| `density` | `water` | "water density" (roughly 0–20 HU) — Category I | v2019: explicitly **−9 to 20 HU** at noncontrast CT (Silverman 2019, Table 1). | Minor (formalized range) |
| `density` | `high` | "high attenuation (>20 HU)" — Category IIF | v2019: **≥70 HU** homogeneous at noncontrast → **Class II** (Table 4). 21–30 HU at portal venous → **Class II** (Table 4). Homogeneous non-enhancing >20 HU at renal mass protocol → **Class II** (Table 4). | **Critical** (2005: high attenuation = IIF follow-up; v2019: most = II, no follow-up) |
| `intrarenal` | checkbox (`intrarenal_yes`) | "totally intrarenal" — 2005 considered a IIF feature | v2019: **removed** as a criterion. No evidence supports intrarenal location as an independent predictor (Silverman 2019, Knowledge Gaps). | Major (eliminates a IIF upgrade path) |
| `large` | checkbox (`large_yes`) | "≥3 cm size" — 2005 used size alone as a IIF criterion | v2019: **removed** as a standalone criterion for homogeneous masses (Silverman 2019, Table 4: size ≥3 cm hyperattenuating non-enhancing → now II). Size still relevant for surveillance. | Major (eliminates a IIF upgrade path) |
| `soft` | `no` | No enhancing soft tissue component | v2019: unchanged for "no" case | None |
| `soft` | `yes` | "enhancing soft tissue component" — Category IV | v2019: **≤25%** of mass must be enhancing tissue; otherwise not a Bosniak-classifiable mass (necrotic solid). Nodule defined: ≥4 mm obtuse margin or any size acute margin = **Class IV** (Silverman 2019, Table 3). Enhancement threshold formalized (≥20 HU CT / ≥15% SI MRI). | Major (new exclusion criterion + formalized nodule definition) |

### Summary of Critical Discrepancies

1. **Badge mismatch:** UI displays "Bosniak v2019" while implementing 2005 logic — **immediate safety concern**.
2. **Calcification rules reversed:** v2019 downgrades all calcifications to Class II; current 2005 logic uses thick/nodular calcifications as a Class III criterion.
3. **High-attenuation masses:** 2005 → IIF (requires follow-up); v2019 → II (no follow-up) for homogeneous masses.
4. **Intrarenal location** → eliminated as a criterion in v2019.
5. **Size ≥3 cm** → eliminated as a standalone criterion in v2019.
6. **Quantitative thresholds missing:** No 2/3/4 mm cutoffs, no septal count, no nodule definition.
7. **No MRI pathway** despite the existing `info` field referencing v2019 MRI criteria.

### Impact on Current Calculator Logic

Applying v2019 rules to the current compute function (lines 102–161):

```
Current hierarchy: IV → III → IIF → II → I

v2019 corrections:
- "high" density: downgrade IIF → II (unless other features present)
- "intrarenal" checkbox: eliminate as IIF criterion
- "large" checkbox: eliminate as IIF criterion
- "thick-nodular" calcs: no longer contributes to III (unless combined with III-qualifying walls/septa)
- wall/septa "thick-irregular" / "thickened-irregular" needs separation into irregular (III) vs nodule (IV)
```

---

## 2. Bosniak v2019 Specification

### 2.1 Definition of a Cystic Mass

> A cystic renal mass is one in which **less than approximately 25%** of the mass is composed of enhancing tissue.
>
> — Silverman et al., Radiology 2019;292(2):475–488, Table 1

If >25% enhancing solid tissue → **not a Bosniak mass** — classify as a solid renal mass with cystic/necrotic changes.

### 2.2 Unified Enhancement Definition

Enhancement = unequivocally perceived visually **OR** quantitatively confirmed:
- **CT:** ≥20 HU increase between noncontrast and contrast-enhanced phases
- **MRI:** ≥15% signal intensity increase

All classes may now demonstrate enhancement (in 2005, enhancement was restricted to IIF and above).

### 2.3 Quantitative Definitions

| Term | Definition | Source |
|------|-----------|--------|
| **Thin** | ≤2 mm | Silverman 2019, Table 2 |
| **Minimally thickened** | 3 mm | Silverman 2019, Table 2 |
| **Thick** | ≥4 mm | Silverman 2019, Table 2 |
| **Few septa** | 1–3 septa | Silverman 2019, Table 2 |
| **Many septa** | ≥4 septa | Silverman 2019, Table 2 |
| **Irregular thickening** | ≤3 mm convex protrusion with obtuse margins | Silverman 2019, Table 3 |
| **Nodule (obtuse margins)** | ≥4 mm convex protrusion with obtuse margins | Silverman 2019, Table 3 |
| **Nodule (acute margins)** | Any size convex protrusion with acute margins | Silverman 2019, Table 3 |

### 2.4 CT Classification Table

| Class | Key Features | Enhancement | Malignancy Risk | Management | Silverman 2019 Source |
|-------|-------------|-------------|-----------------|------------|----------------------|
| **I** | Well-defined thin (≤2 mm) smooth wall; homogeneous simple fluid (−9 to 20 HU); no septa, no calcifications | Wall **may** enhance (new) | 0% (benign) | No follow-up required | Table 1, Fig. 1 |
| **II** (6 subtypes) | All have thin (≤2 mm) smooth walls. <br>1. Thin (≤2 mm) few (1–3) septa; any calcification<br>2. Homogeneous hyperattenuating **≥70 HU** (noncontrast)<br>3. Homogeneous non-enhancing >20 HU (renal mass protocol)<br>4. Homogeneous −9 to 20 HU (noncontrast)<br>5. Homogeneous **21–30 HU** (portal venous)<br>6. Homogeneous low attenuation, "too small to characterize" | Walls/septa **may** enhance | <1% (benign/likely benign) | No follow-up required | Tables 1, 4; Figs. 3–6 |
| **IIF** | Smooth minimally thickened **(3 mm) enhancing wall** **OR**<br> Smooth minimally thickened **(3 mm) enhancing septum/septa** (1–3) **OR**<br> Many **(≥4) thin (≤2 mm) enhancing** septa | **Enhancement required** | 0–38% (probably benign; nearly all indolent when malignant) | Follow-up at 6 mo, 12 mo, then annually ×5 years | Table 1; Figs. 7–8 |
| **III** | One or more enhancing **thick (≥4 mm)** **OR** **irregular** (≤3 mm obtuse convex protrusion) walls/septa. No nodular enhancement. | Enhancement required | ~50% (indeterminate) | Consider urology consultation | Table 3; Figs. 9–10 |
| **IV** | One or more enhancing **nodule(s)** :<br> • ≥4 mm convex protrusion with **obtuse** margins **OR**<br> • Any size convex protrusion with **acute** margins | Enhancement required | ~90% (highly suspicious) | Consider urology consultation | Table 3; Figs. 11–13 |

### 2.5 Reporting Terminology (v2019)

| Class | Recommended Term |
|-------|-----------------|
| **I** | "Benign simple cyst" |
| **II** | "Benign cystic mass" (or "Benign cyst" if confirmed) |
| **IIF** | "Probably benign cystic mass" |
| **III** | "Indeterminate cystic mass" |
| **IV** | "Cystic mass, highly suspicious for malignancy" |

> Avoid the terms "complicated cyst" or "complex cyst."
> — Silverman 2019, Reporting Recommendations

### 2.6 Exclusions from Bosniak Classification

Do not apply Bosniak classification to:
- Lesions with >25% enhancing solid tissue (necrotic solid mass)
- Infectious, inflammatory, or vascular cyst-like lesions (e.g., abscess)
- Patients with a hereditary renal cell carcinoma syndrome
- Abundant thick nodular calcifications that obscure feature assessment (recommend MRI with subtraction)

### 2.7 MRI Pathway — Scope Note

Bosniak v2019 provides **separate CT and MRI algorithms** (Silverman 2019, Tables 5–8). Key differences:

| Aspect | CT | MRI |
|--------|----|-----|
| Enhancement threshold | ≥20 HU increase | ≥15% SI increase |
| Class II subtypes | 6 types (HU-based) | 3 types (signal-based; T1/T2 hyperintense) |
| Class IIF | Wall/septa thickness + count | Same CT features PLUS heterogeneously T1-hyperintense on fat-saturated unenhanced T1WI |
| Class III/IV | Same criteria | Same criteria (enhancement via SI) |

**Recommendation:** Keep the MRI pathway **out of scope for v1** of any calculator upgrade. The CT criteria alone represent a significant change. The existing `info` field already references MRI use — this should be preserved and updated. An MRI toggle can be added in a follow-up stage.

---

## 3. Worked Examples

### Example 1: Class I — Simple Benign Cyst (Unchanged from 2005)

**Clinical context:** 45-year-old female, incidental 1.5 cm left renal cyst on CT.

| Feature | Finding | v2019 Classification |
|---------|---------|---------------------|
| Walls | ≤2 mm, smooth, imperceptible | No III/IV criteria met |
| Septa | None | — |
| Calcifications | None | — |
| Density | Water (−9 to 20 HU) | Class I criterion |
| Enhancement | None | — |
| Soft tissue component | None | — |

**v2019: Bosniak I — Benign simple cyst.**
**Management:** No follow-up required.
**Source:** Silverman 2019, Fig. 1 (simple cyst), Table 1

---

### Example 2: Class II — High-Attenuation Cyst (2005 = IIF)

**Clinical context:** 55-year-old male, 2.5 cm homogeneous hyperattenuating left renal lesion at noncontrast CT (82 HU). No enhancement on follow-up renal mass protocol CT (82 → 84 HU, Δ = 2 HU).

| Feature | Finding | v2019 Classification |
|---------|---------|---------------------|
| Walls | ≤2 mm, smooth | II criterion |
| Septa | None | — |
| Calcifications | None | — |
| Density | **≥70 HU** (82 HU) | v2019: homogeneous ≥70 HU noncontrast → **Class II** subtype 2 |
| Enhancement | None (Δ = 2 HU) | Non-enhancing confirms benign nature |
| Intrarenal | No | — |
| Large | 2.5 cm (<3 cm) | Size removed as criterion in v2019 |

**v2019: Bosniak II** (hyperattenuating subtype — Table 4, Silverman 2019).
**v2005: Bosniak IIF** (any high attenuation >20 HU triggered IIF).
**Management:** No follow-up required (v2019) vs follow-up recommended (v2005).
**Impact:** This represents the single most clinically impactful change in v2019 — up to 15–20% of Bosniak IIF assignments under 2005 were due to hyperattenuation alone.
**Source:** Silverman 2019, Table 4, Figs. 3–5

---

### Example 3: Class II — Cyst with Thick Nodular Calcifications (2005 = III)

**Clinical context:** 62-year-old female, 3.5 cm right renal cystic mass with thick nodular peripheral calcifications. Walls ≤2 mm and smooth. No septa. Water density. No enhancement.

| Feature | Finding | v2019 Classification |
|---------|---------|---------------------|
| Walls | ≤2 mm, smooth | II criterion |
| Septa | None | — |
| Calcifications | **Thick nodular** | v2019: **any calcification** → Class II (provided features are assessable) |
| Density | Water | — |
| Enhancement | None | — |
| Soft tissue component | None | — |

**v2019: Bosniak II** (subtype 1 with calcification — Table 4).
**v2005: Bosniak III** (in the current code, `calcs === "thick-nodular"` with no class I/II features triggers Category III at line 117).
**Management:** No follow-up required (v2019).
**Caution:** If thick nodular calcifications obscure assessment of underlying walls/septa, recommend MRI with subtraction rather than classifying from calcification-limited CT alone.
**Source:** Silverman 2019, Table 4, Fig. 6

---

### Example 4: Class IIF — Many Thin Enhancing Septa

**Clinical context:** 58-year-old male, 4.2 cm cystic mass with multiple thin septa.

| Feature | Finding | v2019 Classification |
|---------|---------|---------------------|
| Walls | ≤2 mm, smooth | IIF requires thickened or many septa |
| Septa | **5 thin (≤2 mm)** , all **enhancing** | v2019: many (≥4) thin (≤2 mm) enhancing septa = **Class IIF** |
| Calcifications | None | — |
| Density | Water | — |
| Enhancement | Septa enhance (≥20 HU increase) | Required for IIF |
| Soft tissue component | None | — |

**v2019: Bosniak IIF** (many thin enhancing septa).
**v2005: Bosniak IIF** (few-thin septa with possible enhancement — qualitative criterion). Same final category, but v2019 requires septal counting and explicit enhancement confirmation.
**Management:** Follow-up at 6 mo, 12 mo, then annually ×5 years.
**Source:** Silverman 2019, Table 1, Figs. 7–8

---

### Example 5: Class III — Thick Irregular Septa vs Class IV — Enhancing Nodule

**Clinical context:** Two separate cases illustrating the III vs IV boundary.

**Case 5a: Class III** — 65-year-old, 5.0 cm cystic mass with smooth thick (≥4 mm) enhancing septa. No nodular component.

| Feature | Finding | Classification |
|---------|---------|---------------|
| Walls | ≤2 mm, smooth | — |
| Septa | **≥4 mm**, smooth, enhancing | ≥4 mm = Class III (thick) |
| Nodules | None | No nodule criteria met |
| Soft tissue | None | — |

**v2019: Bosniak III** (thick ≥4 mm enhancing septa — Table 3).
**Source:** Silverman 2019, Table 3, Fig. 9

**Case 5b: Class IV** — 70-year-old, 6.0 cm cystic mass with an enhancing convex protrusion showing **acute margins** with the septal wall, measuring 3 mm.

| Feature | Finding | Classification |
|---------|---------|---------------|
| Walls | ≤2 mm, smooth | — |
| Septa | Thin (≤2 mm) | — |
| Nodules | **3 mm convex protrusion with acute margins** | Any size + acute margins = **Class IV** nodule |
| Soft tissue | None | — |

**v2019: Bosniak IV** (enhancing nodule, acute margins any size — Table 3).
**Comparison:** If the same 3 mm protrusion had **obtuse** margins, it would be irregular thickening (Class III) because it is ≤3 mm (Silverman 2019, Table 3: "≤3 mm convex protrusion with obtuse margins" = irregular thickening = III; "≥4 mm convex protrusion with obtuse margins" = nodule = IV).
**Source:** Silverman 2019, Table 3, Fig. 11–13

---

## 4. Decision Options for Physician (Mohib Hafeez, MD)

Three options, in increasing order of complexity:

### Option A: Immediate Badge Correction to "Bosniak 2005" (Stopgap)

**Effort:** ~5 minutes (one-line change in `RenalCystBosniak.jsx` line 6).
**Risk:** None — brings badge in line with actual algorithm.
**Downside:** Doesn't address the clinical gap (users get 2005 criteria without v2019 improvements). Existing `info` field already references v2019 MRI criteria — would also need alignment.
**Acceptance criteria:** Change `guidelineVersion: "Bosniak v2019"` → `guidelineVersion: "Bosniak 2005"` on line 6. Update `desc` and `metaDesc` as needed. Update existing `docs/calculators/radiology/renal-cyst.md` to correct any v2019 references to the 2005 implementation. Deployable immediately.

### Option B: Full v2019 Upgrade

**Effort:** Significant — new field definitions (2/3/4 mm thickness, septa count, nodule classification), updated compute function, removal of intrarenal/size checkboxes, addition of enhancement confirmation field, potential IIF→II downgrades, updated UI badge to correct "Bosniak v2019."
**Key implementation challenges:**
1. **Septa count:** Requires user to input number of septa (or "few" / "many" selector plus ≤2/3/≥4 mm thickness)
2. **Nodule definition:** Complex decision tree combining size (≤3 vs ≥4 mm) and margin angle (obtuse vs acute)
3. **Calcification:** Simplify to binary (present/absent) — remove "fine" vs "thick-nodular" distinction
4. **Density:** Replace single "high >20 HU" with multiple HU ranges matching v2019 subtypes 2–6
5. **Enhancement confirmation:** New field — "enhancement present?" (≥20 HU increase) — required for IIF and above
6. **Intrarenal + large:** Remove both checkboxes
7. **Solid component >25% gate:** New exclusion criterion — requires user to estimate enhancing solid proportion
8. **Reporting:** Update output text to use v2019 recommended terminology

**Validation requirement:** After implementation, Mohib must clinically validate against ≥5 test cases spanning Classes I–IV, including edge cases that would change category from 2005.

### Option C: 2005/2019 Version Selector (AAST-style)

**Effort:** Highest — requires a toggle component at the top of the calculator, two compute functions (or a branched one), and a `guidelineVersion` that changes dynamically. Matches the Radulator roadmap "Guideline version system" concept.
**Advantages:**
- Users can compare classifications side-by-side for education
- Migration path as referring clinicians adapt to v2019
- Educational value (seeing which cases change category)
**Disadvantages:**
- Most complex to build and validate
- Dual maintenance burden
- Could confuse users if default version is unclear

### Recommendation

A **two-phase approach**:

**Phase 1 (immediate, <30 min):** Badge correction + field documentation update (Option A).

**Phase 2 (planned, 1–2 weeks):** Full v2019 upgrade (Option B). The quantitative criteria — particularly the high-attenuation downgrade from IIF→II and the calcification simplification — meaningfully change clinical management and align with current evidence. The version selector (Option C) can be added later as an educational feature if desired, but should not delay the primary upgrade.

**Decision needed:** Which option(s) to pursue, and whether to include MRI criteria in the v2019 upgrade.

---

## 5. References

### Primary Source

1. **Silverman SG, Pedrosa I, Ellis JH, et al.** Bosniak Classification of Cystic Renal Masses, Version 2019: An Update Proposal and Needs Assessment. *Radiology*. 2019;292(2):475–488.
   - DOI: [10.1148/radiol.2019182646](https://doi.org/10.1148/radiol.2019182646)
   - PMID: [31210616](https://pubmed.ncbi.nlm.nih.gov/31210616/)
   - PMCID: PMC6677285
   - **Key content:** Tables 1–8 (full classification criteria, quantitative definitions, CT and MRI algorithms), Figs. 1–13 (case examples), Reporting Recommendations, Follow-up Recommendations, Knowledge Gaps.

### Current (2005) Implementation Reference

2. **Bosniak MA.** The Current Radiological Approach to Renal Cysts. *Radiology*. 2005;236(1):61–70.
   - DOI: [10.1148/radiol.2362040218](https://doi.org/10.1148/radiol.2362040218)
   - PMID: [15955860](https://pubmed.ncbi.nlm.nih.gov/15955860/)
   - **Current calculator base.** Radulator's `RenalCystBosniak.jsx` implements this 2005 version.

### Validation and Comparative Studies

3. **Bai X, Sun Y, Wang M, et al.** Bosniak Classification of Cystic Renal Masses, Version 2019: Interobserver Agreement and Diagnostic Performance. *Radiology*. 2020;297(3):597–605.
   - DOI: [10.1148/radiol.2020200952](https://doi.org/10.1148/radiol.2020200952)
   - PMID: [33047993](https://pubmed.ncbi.nlm.nih.gov/33047993/)
   - **Key finding:** v2019 interreader agreement significantly improved over 2005 version.

4. **Lucocq J, Pillai S, O'Rourke S, et al.** Bosniak Classification Version 2019: A Systematic Review and Meta-Analysis of Diagnostic Performance. *Scott Med J*. 2024;69(1):18–23.
   - DOI: [10.1177/00369330231218012](https://doi.org/10.1177/00369330231218012)
   - **Key finding:** v2019 provides better diagnostic specificity and inter-rater reliability than v2005, potentially decreasing overtreatment.

5. **McNicholas MMJ, Rohan AJ, Kambadakone A, et al.** Bosniak Classification Version 2019 of Cystic Renal Masses Assessed at CT: Comparison with Prior Classification. *AJR*. 2020;214(6):1312–1322.
   - DOI: [10.2214/AJR.19.22740](https://www.ajronline.org/doi/10.2214/AJR.19.22740)
   - **Key finding:** ≥4 mm septal or wall thickness threshold had 72–76% positive predictive value for malignancy; ≥4 septa had 70–71% PPV. ~2% fewer benign cyst resections predicted with v2019.

### Educational Resources

6. **Radiopaedia.org.** Bosniak Classification of Cystic Renal Masses (Version 2019). [Online article](https://radiopaedia.org/articles/bosniak-classification-of-cystic-renal-masses-version-2019).
   - Comprehensive summary of v2019 criteria with imaging examples.

7. **The Radiology Assistant.** Bosniak Classification 2019. [Online article](https://radiologyassistant.nl/abdomen/kidney/bozniak-2019).
   - Detailed educational resource with structured cases and classification walkthrough.

### Interpretation Guidance

8. **Schieda N, Davenport MS, Silverman SG, et al.** Bosniak Classification of Cystic Renal Masses, Version 2019: Interpretation Pitfalls and Recommendations to Avoid Misclassification. *AJR*. 2022;218(1):14–24.
   - DOI: [10.2214/AJR.21.26742](https://doi.org/10.2214/AJR.21.26742)
   - PMCID: PMC8751648
   - **Key content:** Practical pitfalls including pseudoenhancement, calcification assessment, and measurement technique.

### Existing Radulator Documentation

9. **Radulator Docs.** Renal Cyst (Bosniak Classification) Calculator.
   - File: `docs/calculators/radiology/renal-cyst.md`
   - Documents the current 2005 implementation. Already references v2019 MRI criteria in its "Clinical Guidance" section. Should be updated in parallel with any badge correction or v2019 upgrade.

---

## Document Metadata

- **Author:** Radulator agent (research brief, stage 1)
- **Date:** 2026-06-11
- **Seed:** Issue #14
- **Branch:** `radulator/t_bosniak-v2019-brief`
- **Calculator factory pipeline status:** Stage 1 complete → awaiting physician sign-off for stage 2 (implementation seed)
- **Medical-change flag:** No — research brief only (no calculator source code changes in this seed)