# NI-RADS for MRI Version 2025 — Implementation Research Brief

**Calculator:** `nirads`

**Evidence packet reviewed:** 2026-08-25

**Clinical-change flag:** Yes

**Implementation model:** one calculator with separate `2018 CT/PET-CT` and `2025 MRI` paths

This document summarizes the source-verified implementation contract in original wording. It does not reproduce ACR tables, algorithms, screenshots, or other source assets. The official publications remain controlling.

## 1. Scope

ACR NI-RADS MRI v2025 applies to MRI surveillance after definitive or curative treatment for head-and-neck cancer. It assigns the primary site and cervical nodes separately and incorporates MRI signal, enhancement, diffusion, temporal comparison, and skull-base/perineural findings.[1][2][3]

The MRI pathway extends the existing Radulator calculator; it does not replace or reinterpret its 2018 CT/PET-CT behavior.[1][4] Use during active treatment is outside the MRI-v2025 scope.[1]

The public source defines the following outputs:

- Primary site: `0`, `1`, `2a`, `2b`, `3`, and `4`.
- Neck nodes: `0`, `1`, `2`, `3`, and `4`.
- Nonnumeric states: `P-unknown primary`, `P-x`, and `N-x`.

The archived MRI table from 2021 included primary `1f` and `2f`, but those labels do not appear in the 2025 assessment document or algorithms.[1][5] The 2025 implementation therefore does not emit `1f` or `2f`. The source uses reduced diffusion and DWI matching without a numeric ADC threshold; Radulator does not invent one.[1][2][3]

## 2. Specification

### Primary-site classification

- **0 — Incomplete:** a new baseline is missing a prior examination that is known to exist and is expected to arrive. The score is added after comparison.[1]
- **1 — No evidence of recurrence:** expected treatment change, thin diffuse mucosal enhancement, low-signal scar/fibrosis, T2-bright non-mass edema/inflammation, resolved tumor at the first baseline, or stable/decreasing deep and perineural findings on comparison. Management: routine surveillance.[1][2]
- **2a — Low suspicion:** focal superficial/mucosal non-mass enhancement or focal reduced diffusion. Management: direct visual inspection.[1][2]
- **2b — Low suspicion:** deep ill-defined tissue, a profile that differs from the original tumor, intermediate T2 signal and enhancement, partial baseline resolution, or bounded first-baseline skull-base/perineural patterns. Management: short-interval MRI or PET; MRI is preferred for perineural or skull-base concern.[1][2]
- **3 — High suspicion:** a discrete new/enlarging mass matching the original tumor, persistent growth despite feature mismatch, intense focal FDG uptake, or progressive skull-base/perineural disease. Management: biopsy when clinically indicated; multidisciplinary discussion can guide next steps when perineural biopsy is infeasible.[1][2]
- **4 — Definitive recurrence:** pathologic proof or definite radiologic and clinical progression. Management: clinical treatment planning, with or without biopsy.[1][2]

### Neck-node classification

- **0 — Incomplete:** the same new-baseline plus known-pending-prior condition used for the primary site.[1]
- **1 — No evidence of recurrence:** no abnormal node, or hypoenhancing residual treated nodal tissue without FDG uptake. Management: routine surveillance.[1][3]
- **2 — Low suspicion:** residual tissue with heterogeneous enhancement or mild/moderate FDG uptake; a new/enlarging node without high-suspicion morphology; or PET/MRI discordance when the original tumor was FDG avid. Management: short-interval MRI or PET.[1][3]
- **3 — High suspicion:** residual tissue with intense FDG uptake, definite enlargement, or increased enhancement; or a new/enlarging node with necrosis/cystic change, irregular border/gross extranodal extension, or intense focal FDG uptake. Management: image-guided or clinical biopsy if clinically indicated.[1][3]
- **4 — Definitive recurrence:** pathologic proof or definite radiologic and clinical progression. Management: clinical treatment planning, with or without biopsy.[1][3]

### Fail-closed boundaries

- Category 0 requires both a new baseline and a known prior examination that is still pending. It is not a substitute for technical nonassessment.[1]
- An unknown primary returns `P-unknown primary`. Technical inability to assess a known primary returns `P-x`; inability to assess the neck returns `N-x`.[1][6]
- The PET/MRI discordance path is available only when the original tumor was FDG avid. `No`, `unknown`, and missing avidity do not qualify.[1]
- Low- and high-suspicion findings are not combined using an unsourced “highest category wins” rule. Conflicting inputs require radiologist reconciliation.
- A new/enlarging node without category-3 morphology remains neck category 2. The category-1 hypoenhancing/no-FDG rule is limited to residual treated nodal tissue.[1][3]

### 2018 versus 2025 implementation delta

The 2018 branch continues to use its existing CT/PET-CT inputs, concordance rules, output wording, risk display, and management text. MRI v2025 uses a separate classifier and adds MRI-specific T1/T2, DWI, enhancement-match, baseline-comparison, and perineural/skull-base patterns. It also exposes `N-x` and enforces the FDG-avidity qualifier without changing the legacy path.[1][4][6]

Management actions are ACR source-provided and ungraded. They are displayed as provenance-bearing source guidance, not as a Radulator evidence grade.

## 3. Worked Examples

| Example | MRI finding and output | Source-linked management |
|---|---|---|
| Primary 1 | Thin diffuse post-treatment mucosal enhancement without a focal mass → `Primary 1` | Routine surveillance.[1][2] |
| Primary 2a | Focal reduced diffusion at the superficial/mucosal primary site → `Primary 2a` | Direct visual inspection.[1][2] This DWI-only route has no literal 2018 CT/PET-CT equivalent. |
| Primary 2b | Deep nonnodular tissue with intermediate T2 signal and intermediate enhancement → `Primary 2b` | Short-interval MRI or PET.[1][2] |
| Primary 3 | A growing discrete mass matches the original tumor on DWI, T2, and enhancement → `Primary 3` | Biopsy if clinically indicated.[1][2] |
| Neck 2 | A new/enlarging node lacks necrosis, cystic change, irregular border/gross extranodal extension, and intense FDG uptake → `Neck 2` | Short-interval MRI or PET.[1][3] |
| Neck 4 | Nodal recurrence is pathologically proven or shows definite radiologic and clinical progression → `Neck 4` | Clinical treatment planning, with or without biopsy.[1][3] |

## 4. Open Questions and Limitations

1. Rights and permission remain a separate unresolved axis. The implementation uses original wording and links to ACR sources; it includes no copied source assets. No legal conclusion is made here.[7]
2. MRI-v2025 category-level outcome validation is still developing, and first-follow-up plus skull-base/perineural interpretation remain human-factors risks.[8][9][10]
3. Source/math packet review authorized implementation but is not physician clinical signoff. Merge still requires signed exact-head primary and verification PASS attestations.

## 5. References

1. American College of Radiology. [NI-RADS MRI v2025 Assessment Categories](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/NI-RADS/NIRADS-MRI-2025-Assessment-Categories.pdf). Updated August 2025.
2. American College of Radiology. [NI-RADS MRI v2025 Primary Site Assessment Categories Algorithm](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/NI-RADS/NI-RADS-MRI-v2025-Primary-Site-Assessment-Categories-Algorithm.pdf). November 2025.
3. American College of Radiology. [NI-RADS MRI v2025 Neck Nodes Assessment Categories Algorithm](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/NI-RADS/NI-RADS-MRI-v2025-Neck-Nodes-Assessment-Categories-Algorithm.pdf). November 2025.
4. Aiken AH, Rath TJ, Anzai Y, et al. ACR Neck Imaging Reporting and Data Systems (NI-RADS): A White Paper of the ACR NI-RADS Committee. *J Am Coll Radiol.* 2018;15(8):1097-1108. [PMID 29983244](https://pubmed.ncbi.nlm.nih.gov/29983244/). DOI: `10.1016/j.jacr.2018.05.006`.
5. American College of Radiology. [Archived NI-RADS MRI category and management table](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/NI-RADS/NIRADS-MRI-Management-Table.pdf). November 2021. Used only for the historical `1f`/`2f` comparison.
6. American College of Radiology. [NI-RADS PET/CT category descriptors and management](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/NI-RADS/NIRADS-PET-CT-Management-Table.pdf). January 2021. Historical control for `P-unknown primary` and `P-x`.
7. American College of Radiology. [NI-RADS resources and permission route](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/NI-RADS).
8. Bunch PM, Aiken AH, Baugnon KL, et al. ACR Neck Imaging Reporting and Data System for MRI Version 2025. *J Am Coll Radiol.* 2025;22(11):1325-1336. [PMID 40754125](https://pubmed.ncbi.nlm.nih.gov/40754125/). DOI: `10.1016/j.jacr.2025.07.023`.
9. Ashour MM, Darwish EAF, Fahiem RM, Abdelaziz TT. MRI Posttreatment Surveillance for Head and Neck Squamous Cell Carcinoma: Proposed MR NI-RADS Criteria. *AJNR Am J Neuroradiol.* 2021;42(6):1123-1129. [PMID 33707288](https://pubmed.ncbi.nlm.nih.gov/33707288/). DOI: `10.3174/ajnr.A7058`.
10. Baba A, Kurokawa R, Kurokawa M, et al. Performance of NI-RADS for Diagnosis of Recurrence: A Systematic Review and Meta-analysis. *AJNR Am J Neuroradiol.* 2023;44(10):1184-1190. [PMID 37709352](https://pubmed.ncbi.nlm.nih.gov/37709352/). DOI: `10.3174/ajnr.A7992`.
