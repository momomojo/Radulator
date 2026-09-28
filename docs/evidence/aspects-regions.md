# ASPECTS region texts and region grouping: source evidence

Scope: the ten region checkboxes of `src/components/calculators/ASPECTSScore.jsx`
(label, subLabel), the region list in the info text, and the "Regional Breakdown"
result with the two clinical notes that depend on it. The score arithmetic
(ASPECTS = 10 minus the number of affected regions) is unchanged.

The audit re-checks everything below against the live sources:

```bash
node scripts/audit-aspects-region-source.test.mjs
# or the audit alone:
node --import ./scripts/register-jsx-loader.mjs scripts/audit-aspects-region-source.mjs
```

The repository stores no copied source passages. Each source statement is pinned
in `scripts/audit-aspects-region-source.mjs` by the SHA-256 of its exact
normalized text between two markers of at most six words, with a locator and a
paraphrase in our own words. Titles, identifiers and numeric criteria stated as
facts are the only other source content here.

## Sources

| Key | Source | Identifiers | Retrieved from | Pin |
|---|---|---|---|---|
| `barber2000` | Barber PA, Demchuk AM, Zhang J, Buchan AM. Validity and reliability of a quantitative computed tomography score in predicting outcome of hyperacute stroke before thrombolytic therapy. Lancet. 2000;355(9216):1670-1674. The original ASPECTS paper. | PMID 10905241 (verified); DOI 10.1016/S0140-6736(00)02237-6 | PubMed record through NCBI E-utilities (`tool=radulator-aspects-audit`, no e-mail) | SHA-256 of the normalized citation and abstract (13 fields). PubMed updates indexing metadata without any change to the article, so raw bytes are not pinned. |
| `pexman2001` | Pexman JHW, Barber PA, Hill MD, et al. Use of the Alberta Stroke Program Early CT Score (ASPECTS) for assessing CT scans in patients with acute stroke. AJNR Am J Neuroradiol. 2001;22(8):1534-1542. The developers' methods paper. | PMID 11559501; PMCID PMC7974585 | PMC article page (the publisher does not release PMC XML for it) | SHA-256 of the normalized article body (46 paragraph blocks, Abstract through the last figure legend). The page carries a per-request id and CSRF token, so raw bytes are not pinned. |
| `dubey2013` | Dubey P, et al. Acute stroke imaging: recent updates. Stroke Res Treat. 2013;2013:767212. Figure 1 reprints the developers' ASPECTS template from aspectsinstroke.com with the Calgary group's permission. | PMID 23970999; PMCID PMC3732599; DOI 10.1155/2013/767212; article licence CC BY 3.0 | PMC XML through NCBI E-utilities | Raw bytes: 65,170 bytes, SHA-256 `7a0479726ba0956a36ce9e63050bf0e052fe69ac292428a67a9254b26d54a2ba` |
| `developers_what_is` | aspectsinstroke.com (Foothills Medical Centre, University of Calgary), "What is ASPECTS" | Internet Archive capture of 2016-12-06 11:53:58 GMT | web.archive.org `id_` capture | Raw bytes: 12,396 bytes, SHA-256 `0fa6d381b95c3eb6d61f082c2c1e5821d3b5b00fcc461fa3666359adebb5a03e` |
| `developers_insula_basal_ganglia` | aspectsinstroke.com, Training: "Insula and basal ganglia" | Internet Archive capture of 2016-12-29 22:22:03 GMT | web.archive.org `id_` capture | Raw bytes: 11,387 bytes, SHA-256 `2ab9a266bbfd2dfbfcb1b8f60bded61ca9befa29393c1d6a768a0c264f5befe5` |
| `developers_m1_m6` | aspectsinstroke.com, Training: "M1-M6 regions" | Internet Archive capture of 2016-12-30 02:52:53 GMT | web.archive.org `id_` capture | Raw bytes: 10,930 bytes, SHA-256 `c2f480242b0061b6a0c122496dbdf45cf6c0a416ffddec1a7f7977a87fd657fb` |

Not retrieved:

- The Barber 2000 full text (Lancet, paywalled) and the erratum that PubMed lists
  for it (Lancet 2000;355(9221):2170). Only the PubMed abstract is used, and the
  content of the erratum is unknown.
- The live developers' site. aspectsinstroke.com fails TLS with an expired
  certificate. That was not bypassed; the audit reads Internet Archive captures of
  the 2016 site instead. The template legend and the internal-capsule guidance
  read the same in the earliest (2012) captures as in the 2016 ones. The
  redesigned site (captured 2024) no longer carries this text.
- Europe PMC and ajnr.org copies of Pexman 2001 (HTTP 403 in the earlier review).
  The PMC article page was used.

## What changed, and why

| Runtime text or behaviour | Source and locator | What the source says (paraphrase) | Runtime binding |
|---|---|---|---|
| "Regional Breakdown": the insular ribbon moves from "Subcortical: n/4" to the ganglionic cortex. The result now reads `Subcortical (C, L, IC): a/3 \| Ganglionic cortical (I, M1-M3): b/4 \| Supraganglionic (M4-M6): c/3`. | `dubey2013` Figure 1 caption; `developers_what_is` template legend; `developers_m1_m6` "M1-3 region" and "M4-6 region" sections | The developers give 3 of the 10 points to subcortical structures (caudate, lentiform nucleus, internal capsule) and 7 to MCA cortex (insular cortex and M1-M6). A lesion at or below the level of the caudate head belongs to a ganglionic region (M1-M3, insula, caudate, lentiform nucleus, internal capsule); a lesion above it belongs to M4-M6. | Claims `breakdown-subcortical-is-c-l-ic` and `breakdown-insula-is-ganglionic-cortex`. Checked for all 1024 region combinations. |
| "Predominantly subcortical involvement" note: the rule text is unchanged (at least 3 subcortical regions and no cortical region). With the corrected grouping it now needs C, L and IC with no involvement of I or M1-M6. Before, any 3 of C, L, IC and I without M1-M6 triggered it, so an insula-plus-basal-ganglia pattern also got a lenticulostriate suggestion next to the proximal-M1 note. | As above (the 3/7 grouping) | As above | Claim `subcortical-note-uses-corrected-grouping`. Checked for all 1024 combinations. The note's clinical suggestion itself is not source-audited. |
| Collateral note text: "Complete cortical MCA involvement ..." becomes "Complete M1-M6 cortical involvement ...". The trigger (M1-M6 all involved) is unchanged. | `dubey2013` Figure 1 caption; `developers_what_is` template legend | MCA cortex includes the insular cortex as well as M1-M6. | Claim `m1-m6-note-names-its-trigger`. The note fires on M1-M6 without requiring the insula, so the text names M1-M6 rather than claiming all MCA cortex. |
| M3 subLabel "Posterior temporal lobe at ganglionic level" becomes "MCA cortex behind M2 at ganglionic level". The info-text line "M3 - Posterior temporal lobe (posterior MCA cortex)" becomes "M3 - Posterior MCA cortex (behind M2)". | `pexman2001` Fig 1 legend; Results (M-area paragraph); Discussion (paragraph on CT baselines). `dubey2013` Figure 1 caption. `developers_what_is` template legend. | M3 is defined only as the back part of the MCA cortex on the ganglionic cut. The developers stress that the M areas are geometric rather than anatomic. M2 starts at the front tip of the temporal lobe and ends at a slanted back edge, and the ganglionic divisions are drawn from the two ends of the sylvian fissure. No source equates M3 with the posterior temporal lobe. | Claim `m3-posterior-mca-cortex-behind-m2` (exact subLabel and info line; no lobe named). |
| All ten region subLabels drop "(-1 point)". FieldLabel renders a subLabel as `label (subLabel)`, so the old text would render nested parentheses once checkbox subLabels are shown. | `pexman2001` Methods; `developers_what_is` "How to compute ASPECTS"; `barber2000` abstract (Methods) | One point is subtracted from 10 for early ischemic change in each of the ten defined regions. | Claim `score-is-ten-minus-regions`: ten region checkboxes, ASPECTS = 10 - regions for every combination, and the info text still states the one-point rule. The no-parentheses check is an app rendering guardrail, not a source claim. |

## What was kept, and why

| Runtime text | Source and locator | What the source says (paraphrase) | Runtime binding |
|---|---|---|---|
| IC subLabel "Posterior limb of internal capsule"; info line "IC - Internal capsule (posterior limb)" | `developers_insula_basal_ganglia` "Internal capsule" section; `pexman2001` Results (internal capsule paragraph) | The developers' training guidance counts the internal capsule region as involved when its posterior limb is hypodense, because anterior-limb hypodensity is hard to score on non-contrast CT. Pexman 2001 records that the six developers first split 3:3 on this: three looked only at the posterior limb, three at any part of either limb. | Claim `internal-capsule-posterior-limb`. The earlier evidence review proposed "Internal capsule at the ganglionic level" because it could not read the developers' site. That site adopts the posterior-limb convention, so the text stays. |
| M1 subLabel "Frontal operculum at ganglionic level"; info line "M1 - Frontal operculum (anterior MCA cortex)" | `pexman2001` Results (M-area paragraph) and Fig 1 legend | M1 is the front part of the MCA cortex. All six developers put it ahead of where the sylvian fissure begins anteriorly, and all counted the frontal operculum as part of it. | Claim `m1-frontal-operculum` |
| M2 subLabel "Anterior temporal lobe, lateral to insular ribbon"; info line "M2 - Anterior temporal lobe (lateral to insular ribbon)" | `pexman2001` Results (M-area paragraph) and Fig 1 legend; `dubey2013` Figure 1 caption | M2 is the MCA cortex lying lateral to the insula. All six developers started it at the front tip of the temporal lobe. | Claim `m2-anterior-temporal-lateral-to-insula` |
| M4, M5, M6 subLabels "Immediately superior to M1/M2/M3" and the info lines | `dubey2013` Figure 1 caption; `developers_what_is` template legend; `pexman2001` Fig 1 legend | M4, M5 and M6 are the front, lateral and back MCA territories directly above M1, M2 and M3, higher than the basal ganglia. Pexman gives the vertical offset as about 2 cm. | Claim `m4-m6-immediately-superior` |
| I subLabel "Insular cortex / loss of insular ribbon"; info line "I - Insular ribbon (insular cortex)" | `pexman2001` Results (first paragraph); `developers_insula_basal_ganglia` "Insular cortex" section | Insular ribbon hypoattenuation is loss of gray/white differentiation of the insular cortex; either half can be lost on its own. | Claim `insular-ribbon-definition` |
| C label "C - Caudate Head"; subLabel "Early ischemic change in caudate nucleus"; info line "C - Caudate head" | `pexman2001` Fig 1 legend; `developers_insula_basal_ganglia` "Basal ganglia" section | The region key names the caudate head. The training guidance assesses the caudate nucleus on both levels: its head on the ganglionic level, its body and tail on the supraganglionic level. | Claim `caudate-region` |
| Info-text grouping: C, L, IC, I, M1-M3 under the ganglionic level; M4-M6 under the supraganglionic level | `developers_what_is` "How to compute ASPECTS"; `pexman2001` Methods; `developers_m1_m6` | ASPECTS is scored at the basal ganglia level and at the supraganglionic level. | Claim `two-levels-in-info-text` |

## Not asserted by these sources

- The lentiform subLabel "Putamen and globus pallidus". This is standard anatomy
  and none of these sources states it.
- The clinical suggestions in the pattern notes (proximal M1 occlusion,
  lenticulostriate territory, collateral status). Only their region grouping is
  bound here.
- Thrombectomy eligibility, time-window and trial-threshold text.
- Whole-calculator clinical acceptance.

## Tests

- `tests/aspects-regions-compute.test.mjs`: breakdown vectors, all 1024 region
  combinations (score, breakdown and both notes), the subLabel wording and the
  no-parentheses rule, and the info-text region list.
- `tests/e2e/calculators/neuroradiology/aspects-score.spec.js`: the visible
  breakdown, the isolated-insula case, the note boundary, the renamed collateral
  note and the M3 info line.
- `scripts/audit-aspects-region-source.test.mjs`: the live audit, then offline
  mutation checks on the fetched bytes. A changed word in the PMC article body,
  the PubMed abstract or a raw-pinned file fails. A change to PMC tokens or site
  chrome, or to PubMed indexing metadata, passes. The same checks cover a changed
  capture time, original page or final host, and a reverted calculator (old
  grouping, old note trigger, old M3 text).
