# Wells PE: source evidence for wording, cut points and cohort figures

Review date: 2026-09-28 (UTC)

**Scope.** This review covers `src/components/calculators/WellsPE.jsx` (`wells-pe`):
- the checkbox labels and subLabels;
- the three-tier low band;
- the cohort figures and D-dimer outcome shown in the info text and results;
- the description line;
- the PERC note;
- the info link and references.

The item weights and the two-level split are unchanged. This is bounded source and implementation evidence, not clinical sign-off or whole-calculator certification.

No source prose is reproduced here. The texts below are criterion names, numeric criteria and results stated as facts, identifiers, and our own paraphrases.

## Sources

| Key | Source | Identifiers | How it was read |
|---|---|---|---|
| NICE-NG158 | NICE guideline NG158, *Venous thromboembolic diseases: diagnosis, management and thrombophilia testing* (published 26 March 2020, last updated 2 August 2023) | [nice.org.uk/guidance/ng158](https://www.nice.org.uk/guidance/ng158) | NICE's own NG158 PDF, fetched live (see "Retrieved artifacts"). The live file is byte-identical to the Internet Archive capture `20260829003713`, whose SHA-1 matches the archive's CDX digest `BEGSGCWDDU6PSC4P3R76SBRZNC2DXCVB`. Table 2 reads the same in the HTML recommendations chapter and in NICE's April 2024 render of the PDF (archive capture `20240415113901`). |
| Wells2000 | Wells PS, Anderson DR, Rodger M, et al. Derivation of a simple clinical model to categorize patients probability of pulmonary embolism: increasing the models utility with the SimpliRED D-dimer. *Thromb Haemost.* 2000;83(3):416-420 | PMID [10744147](https://pubmed.ncbi.nlm.nih.gov/10744147/); DOI [10.1055/s-0037-1613830](https://doi.org/10.1055/s-0037-1613830) | PubMed plain-text abstract. The publisher full text was not retrieved. Crossref metadata for the DOI matches the title, volume 83, issue 3, pages 416-420 and year 2000; the PubMed record carries no DOI. |
| Wells2001 | Wells PS, Anderson DR, Rodger M, et al. Excluding pulmonary embolism at the bedside without diagnostic imaging. *Ann Intern Med.* 2001;135(2):98-107 | PMID [11453709](https://pubmed.ncbi.nlm.nih.gov/11453709/); DOI [10.7326/0003-4819-135-2-200107170-00010](https://doi.org/10.7326/0003-4819-135-2-200107170-00010) | PubMed plain-text abstract (structured). The full text was not retrieved. |
| Christopher | van Belle A, Büller HR, Huisman MV, et al.; Christopher Study Investigators. Effectiveness of managing suspected pulmonary embolism using an algorithm combining clinical probability, D-dimer testing, and computed tomography. *JAMA.* 2006;295(2):172-179 | PMID [16403929](https://pubmed.ncbi.nlm.nih.gov/16403929/) (verified with E-utilities esearch); DOI [10.1001/jama.295.2.172](https://doi.org/10.1001/jama.295.2.172) | PubMed plain-text abstract (structured). The full text was not retrieved. |
| ACP2015 | Raja AS, Greenberg JO, Qaseem A, et al. Evaluation of Patients With Suspected Acute Pulmonary Embolism: Best Practice Advice From the Clinical Guidelines Committee of the American College of Physicians. *Ann Intern Med.* 2015;163(9):701-711 | PMID [26414967](https://pubmed.ncbi.nlm.nih.gov/26414967/); DOI [10.7326/M14-1772](https://doi.org/10.7326/M14-1772) | PubMed plain-text abstract. It is used for the PERC note only, and it is not part of the audit. |
| AltVersion | Walen S, et al. *Insights Imaging.* 2014;5:231-236, Table 1 | PMC [3999363](https://pmc.ncbi.nlm.nih.gov/articles/PMC3999363/) | Context only. It reproduces a different version of the rule, which this calculator does not cite. |

### Retrieved artifacts

Each artifact was fetched at least twice, a minute or more apart, on 2026-09-28. Every fetch returned HTTP 200 with identical bytes.

| Artifact | URL | Media type | Bytes | SHA-256 of the response bytes | Fetches (UTC) |
|---|---|---|---|---|---|
| NICE NG158 PDF | `https://www.nice.org.uk/guidance/ng158/resources/venous-thromboembolic-diseases-diagnosis-management-and-thrombophilia-testing-pdf-66141847001797` | application/pdf | 305,423 (54 pages) | `d96c3f78a4becc4e6e82de3a76f6a1be1ab05d82045dd4d53d66c62c2578a058` | 04:34, 04:36, 04:37 |
| NICE NG158 recommendations chapter | `https://www.nice.org.uk/guidance/ng158/chapter/Recommendations` | text/html | 120,558 | `455281393f1e56d707462ff0f7098b2f5cb23386bb0679ed61d6524c3b77f3fe` | 04:34, 04:36, 04:37 |
| Wells2000 abstract | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=10744147&rettype=abstract&retmode=text&tool=radulator-wells-audit` | text/plain | 3,104 | `6a5ba4c054a1c74315f88a2bbd1fbeabbc599db49c70def9f1c7b8be36c64de8` | 04:36, 04:37, 04:56, 05:01 |
| Wells2001 abstract | same form, `id=11453709` | text/plain | 3,848 | `2ad680b73da4d69e2bef5b05b20040cb92a19d903105e54c6ed0d9db4a4c0af8` | 04:56, 05:01 |
| Christopher abstract | same form, `id=16403929` | text/plain | 3,234 | `92919cce91f7e5b447723f84177f9ad496c0b026374cb8444c3e00cb781c0689` | 04:56, 05:01 |
| ACP2015 abstract | same form, `id=26414967` | text/plain | 3,279 | `9540bc94046424eb87732de5fbf54dd3744ba916716aaf5a52b5a67c53ec4246` | 04:56, 05:01 |

**Locators.**
- **NICE:** recommendation 1.1.17, Table 2 "Two-level PE Wells score" (PDF page 12 of 54): rows 1 to 7 and the simplified-score rows. NICE marks the table as adapted with permission from Wells 2000. For the malignancy row, see NICE's "Terms used in this guideline" entry for active cancer (PDF page 28). Recommendation 1.1.16 covers PERC and 1.1.21 the PE-unlikely pathway.
- **Wells2000:** the unlabelled abstract. It covers the seven items and weights, the three-tier cut points, the two-tier split, the PE rate in PE-unlikely patients, and the PE rate after a negative SimpliRED D-dimer.
- **Wells2001:** abstract sections SETTING, PATIENTS and RESULTS.
- **Christopher:** abstract sections INTERVENTIONS, MAIN OUTCOME MEASURE and RESULTS.
- **ACP2015:** Best Practice Advice 1 to 3.

## Changed text, commit 1: criterion wording

| Field | Before | After | Source and locator | Paraphrase (own words) | Binding |
|---|---|---|---|---|---|
| `alternative_less_likely` label | PE is #1 diagnosis OR equally likely | Alternative diagnosis less likely than PE | NICE-NG158 Table 2 row 2 (3 points). The Wells2000 abstract names the 3.0-point item as the absence of an alternative diagnosis. | The item scores only when the clinician judges PE more likely than every alternative diagnosis. Neither source credits a case where an alternative is as likely as PE. | Compute test and spec. The audit requires the runtime label to name the item. |
| `alternative_less_likely` subLabel | Alternative diagnosis is less likely than PE | PE judged more likely than every alternative diagnosis; a tie does not count | As above | The same strict reading, stated from the PE side, with the tie made explicit. | Compute test |
| `clinical_dvt` subLabel | Leg swelling, pain with palpation of deep veins | Must include both leg swelling and pain on palpation of the deep veins | NICE-NG158 Table 2 row 1 | Both findings are the minimum. Either one alone does not meet the item. | Compute test |
| `immobilization_surgery` subLabel | Bedrest ≥3 days OR surgery requiring general/regional anesthesia in past 4 weeks | Immobilization lasting more than 3 days, or surgery, within the previous 4 weeks | NICE-NG158 Table 2 row 4. The Wells2000 abstract lists immobilization or surgery within the prior 4 weeks at 1.5 points. | Immobilization must exceed 3 days, so exactly 3 days does not qualify. The PE rule puts no anaesthesia condition on surgery; that condition belongs to the DVT rule. | Compute test |
| `previous_pe_dvt` subLabel | Objectively diagnosed | (removed) | NICE-NG158 Table 2 row 5; Wells2000 abstract | Both sources list a previous DVT or PE with no further qualifier. "Objectively diagnosed" comes from the AltVersion wording. | Compute test |
| `malignancy` subLabel | Active cancer (treatment within 6 months or palliative) | Under treatment, treated within the past 6 months, or palliative | NICE-NG158 Table 2 row 7; NICE glossary entry for active cancer | The item covers cancer under current treatment, treated within the past 6 months, or managed palliatively. NICE's glossary definition of active cancer is broader, so that term is dropped. | Compute test |
| Score Breakdown line | PE #1 diagnosis or equally likely: +3.0 | Alternative diagnosis less likely than PE: +3.0 | Follows the label | The result names the same criterion as the input. | Compute test (all 128 selections); spec |
| Info link "View Original Wells PE Study" | `https://doi.org/10.1160/TH00-08-0302` | `https://doi.org/10.1055/s-0037-1613830` | doi.org handle API: the old DOI returns response code 100 (handle not found). Crossref: the new DOI is Wells2000. | The link to the primary study was dead. | Compute test |
| `refs` | No NICE entry | Adds NICE NG158, recommendation 1.1.17, Table 2 | NICE-NG158 | Cites the adaptation that supplies the criterion definitions. | Compute test |

The previous label, the "≥3 days" threshold and "objectively diagnosed" all match AltVersion's Table 1. That is a different version of the rule from the Wells 2000 / NICE version this calculator cites.

### How a tie is scored

The checkbox is a clinician judgement.
- **Before:** the label told the user to select the item when PE and an alternative diagnosis were equally likely, which added 3 points.
- **Now:** the label and subLabel say that a tie does not count, so a tie adds nothing.

Three points can move a patient across the two-level boundary. For example, 1.5 points (PE unlikely) becomes 4.5 points (PE likely), and the pathway switches from D-dimer first to CTPA directly.

The cited sources support the strict reading:
- NICE's adaptation of Wells 2000 requires the alternative diagnosis to be less likely than PE.
- The Wells 2000 abstract names the item as the absence of an alternative diagnosis, which is stricter still.

## Changed text, commit 2: cut points, cohort figures and claims

| Where | Before | After | Source and locator | Paraphrase (own words) | Binding |
|---|---|---|---|---|---|
| Three-tier low band (compute) | Low when the score is 1 or less, so 1.5 was Moderate | Low below 2, Moderate 2 to 6, High above 6 | Wells2000 abstract, three-tier cut points | Low is any score below 2.0, moderate is 2.0 to 6.0, and high is above 6.0. | Audit: every selection's three-tier result. Compute test: 1.5, 2, 6 and 6.5 boundaries. Spec: 1.5 points shows Low. |
| Info band lines | Low 0-1 points, Moderate 2-6, High >6 | Low <2 points, Moderate 2–6, High >6 | Same | Same | Audit: the exact band lines, rebuilt from the parsed cut points |
| Three-tier rates (info text and results) | ~3.6%, ~20.5%, ~66.7% | Wells 2001 emergency department cohort (930 patients): PE in 1.3%, 16.2% and 37.5% of low, moderate and high probability patients | Wells2001 abstract, SETTING, PATIENTS and RESULTS | Four Canadian emergency departments enrolled 930 consecutive patients, 527 low, 339 moderate and 64 high probability. PE was found in 1.3%, 16.2% and 37.5% of these groups. | Audit: tier counts must sum to 930; the info sentence and every three-tier result must carry the parsed rates |
| PE-unlikely rate (info text and results) | ~8% | 7.8%, attributed to Wells 2000 | Wells2000 abstract | PE occurred in 7.8% of patients scoring 4 or less. | Audit |
| PE-likely rate (info text and results) | ~34% | Removed | No retrieved abstract gives it | None of the three abstracts reports a PE rate for PE-likely patients. | Audit: every percentage shown must be one of the sourced figures |
| Info line on a negative D-dimer | PE Unlikely + negative D-dimer = PE excluded (NPV >99%) | D-dimer first. The Christopher Study outcome and the Wells 2000 SimpliRED rates follow; see the next two rows. | Christopher abstract (INTERVENTIONS, MAIN OUTCOME MEASURE, RESULTS); Wells2000 abstract | See "What supports a figure above 99%" | Audit: the exact sentences; no "NPV", ">99" or "excluded" anywhere |
| Christopher Study sentence (info text) | none | 1,028 untreated PE-unlikely patients with a normal D-dimer; 0.5% (95% CI 0.2–1.1%) had nonfatal VTE over 3 months of follow-up | Christopher abstract, RESULTS | PE unlikely with a normal D-dimer: 1,057 patients, 1,028 left untreated, 5 later nonfatal VTE (0.5%, 95% CI 0.2-1.1%) within the 3-month follow-up. | Audit: the rate must equal 5/1028, and the window must equal the outcome window |
| SimpliRED sentence (info text) | none | With the SimpliRED D-dimer in Wells 2000, PE occurred in 2.2% (derivation) and 1.7% (validation) of PE-unlikely patients with a negative result | Wells2000 abstract and title | With the SimpliRED D-dimer, PE-unlikely patients with a negative result still had PE in 2.2% (95% CI 1.0-4.0%) of the derivation set and 1.7% of the validation set. | Audit |
| PE-unlikely recommendation | If negative, PE is effectively excluded (NPV >99%) | If positive, proceed to CTPA. If negative, the Christopher Study outcome is quoted with its group and follow-up. | Christopher abstract, INTERVENTIONS and RESULTS | In the Christopher Study, PE-unlikely patients with a normal D-dimer were treated as not having PE and received no anticoagulation; 0.5% had nonfatal VTE in 3 months. | Audit: exact text in every PE-unlikely selection. Spec: visible text, and no NPV or ">99%" on the page. |
| Description line | This calculator follows the 2001 Wells criteria with PERC rule integration | This calculator implements the Wells 2000 score (seven items and both cut-point schemes); item wording follows NICE NG158 Table 2. PERC is not scored here; a note suggests it for low-probability results. | Wells2000 abstract; `guidelineVersion` "Wells Criteria (2000)" | The calculator scores the 2000 rule; PERC criteria are not collected. | Audit: scope sentence, `guidelineVersion` and the Wells2000 year; neither the "2001 Wells criteria" nor the "PERC rule integration" phrase may appear |
| PERC note | Shown at 4 points or less, citing "score 0-1" | Shown below 2 points (the low band), citing "score <2" | ACP2015 Best Practice Advice 2 and 3; NICE-NG158 1.1.16 | ACP: with a low pretest probability and all PERC criteria met, skip D-dimer testing and imaging. With an intermediate pretest probability, use a high-sensitivity D-dimer first. NICE bases PERC on overall clinical impression, so the note only suggests considering PERC. | Audit: the note appears exactly when the score is below the parsed low cut point. Compute test and spec. |

The removed figures, and where they appear:
- **3.6% and 20.5%** appear in none of the three abstracts. They may come from the Wells 2000 full text, which was not retrieved.
- **66.7%** appears only in the Christopher abstract, as the share of patients classified PE unlikely. It is not a PE rate.
- **~34%** is close to the remaining share classified PE likely (33.3%), which is also not a PE rate.

### What supports a figure above 99%

| Group | D-dimer | Outcome | Figure | Source |
|---|---|---|---|---|
| Wells **low** probability (below 2), negative D-dimer | Not named in the abstract | PE during follow-up (excluded patients were followed for 3 months) | 1 of 437; NPV 99.5% (CI 99.1-100%) | Wells2001 RESULTS and MEASUREMENTS |
| **PE unlikely** (dichotomized Wells), normal D-dimer, untreated | Not named in the abstract | Nonfatal VTE over 3 months (the outcome measure was symptomatic or fatal VTE) | 5 of 1,028: 0.5% (95% CI 0.2-1.1%), about 99.5% event-free | Christopher RESULTS |
| **PE unlikely** (4 or less), negative D-dimer | SimpliRED (whole-blood assay named in the title) | PE | 2.2% (95% CI 1.0-4.0%) derivation, 1.7% validation, so about 98% | Wells2000 |

**Conclusions.**
- **Wells 2000 does not support "NPV >99%".** Its own figures for the PE-unlikely group with a negative SimpliRED D-dimer are about 98%.
- **Wells 2001 supports 99.5%, but not for the PE-unlikely group.** Its figure belongs to the three-tier low group, which is narrower than PE unlikely.
- **The Christopher Study supports about 99.5% for PE-unlikely patients as a point estimate only.** Its 95% CI upper bound of 1.1% means the lower bound of the event-free proportion is below 99%.

The calculator therefore states the Christopher Study event rate with its CI, group and follow-up, and states the Wells 2000 SimpliRED rates beside it. It makes no NPV claim. It does not name an assay for the Christopher Study, because the abstract does not.

## Scoring changes and checks

- **The only category change: 1.5 points moves from Moderate to Low.** This follows the Wells 2000 low band (below 2.0). It affects the three single 1.5-point selections: heart rate, immobilization or surgery, and previous DVT/PE.
- **Unchanged:** weights, the score, the Score Breakdown, the two-level category and severity, and the PE-likely recommendation, in all 128 selections. A differential against the previous head (not committed) confirmed this.
- **`tests/wells-pe-compute.test.mjs`**, over all 128 selections:
  - the weights, the two-level split and the three-tier cut points;
  - the attributed rates and the PE-unlikely recommendation;
  - the PERC note's band;
  - no NPV or ">99" claim, and no unsourced percentage.
  - Named vectors cover 1.5, 2, 4, 4.5, 6 and 6.5 points.
- **`tests/e2e/calculators/clinical/wells-pe.spec.js`**:
  - the label;
  - 1.5 points showing Low with the PERC note;
  - the attributed D-dimer outcome, with no NPV or ">99%" text on the page.

## Source audit

`scripts/audit-wells-pe-source.mjs` and `.test.mjs` run in Smoke through the `scripts/audit-*-source.test.mjs` loop. They use only NCBI plain-text abstracts: Wells2000, Wells2001 and Christopher.

**Retrieval checks.** Each record is one E-utilities request (`rettype=abstract&retmode=text&tool=radulator-wells-audit`, with no personal identifiers), spaced 400 ms apart. Before anything is parsed, the audit checks:
- the final protocol, host, path and query;
- the media type `text/plain`;
- the exact byte length and SHA-256 (see "Retrieved artifacts").

**Failure handling.**
- **Changed source:** an HTTP 200 that misses any pin fails at once and is never retried.
- **Transient errors:** HTTP 400, 429 and 5xx are retried, honouring `Retry-After`.

**Parsing and statement pins.**
- The parser checks each record's abstract layout: the exact list of section labels.
- Eleven statements are pinned by the SHA-256 and length of the exact normalized span between two markers of at most six words.

**Parsed facts.** Only numbers, item names and years are parsed from the spans:
- the seven weights;
- the three-tier cut points and the two-tier split;
- the Wells 2000 PE-unlikely and SimpliRED rates;
- the Wells 2001 cohort, tier counts and rates;
- the Wells 2001 low-tier NPV, pinned for the analysis above but not shown by the calculator;
- the Christopher group size, events, rate, CI and follow-up window.

**Runtime binding.** The audit binds these facts to:
- the item order, labels and weights;
- every one of the 128 selections: score, both tiers, recommendation and PERC note;
- the exact info-text sentences and band lines;
- the absence of any NPV, ">99" or "excluded" claim, and of any unsourced percentage;
- `guidelineVersion` and the references.

The test runs the live audit and then 31 mutations, each of which must fail:
- **source bytes:** same-length digest drift, byte-length drift, a missing record, a drifted HTTP 200 (never retried);
- **records and statements:** DOI, year and layout drift; a same-length edit inside a pinned span; a seven-word marker;
- **runtime items:** item order, a reverted label, `guidelineVersion`, a missing reference;
- **runtime text:** the low band reverted, a changed tier rate, a changed Christopher rate, the assay attribution removed, the NPV claim restored, an unsourced percentage, the description line reverted;
- **runtime output:** a changed weight, 1.5 scored Moderate, 4 scored PE likely, the recommendation reverted, the PERC note outside the low band, an unsourced output percentage, an NPV claim in a note;
- **response identity and retry:** wrong host, format or media type; 400, 429 and 5xx retried; 404 not retried.

### Why NICE is not in the audit

Smoke runs every source audit on each clinical PR, and only a workflow change can exempt one. A NICE fetch would therefore put NICE's availability and rendering in front of every clinical PR.

- **Outage.** On 2026-09-28, NICE's guidance service returned HTTP 500 for every guidance URL tried: the NG158 overview, recommendations chapter and PDF, and NG51 as a control.
  - An earlier review hit this before 03:40 UTC, and this review hit it again from 04:07 to 04:10 UTC, so the failures spanned at least half an hour.
  - The service had recovered by 04:34 UTC.
  - The audits' retries last well under a minute.
- **Re-rendering.** NICE re-renders the PDF without changing its content. Compared with the 2026 file, the April 2024 render has a © NICE 2023 footer, 55 pages and 320,405 bytes, with identical Table 2 content. A raw-byte pin would fail at the next re-render with no change to the guidance.

The NICE bytes and hashes above let a reviewer re-verify the criterion wording by hand.

## Rendering note

At this head, checkbox subLabels are not rendered: the checkbox branch of `src/components/forms/Field.jsx` passes the label only. The corrected subLabels become visible when the renderer fix lands. Labels, the info text and all result lines are visible now.

## Reproduce

```text
node scripts/audit-wells-pe-source.test.mjs
node --import ./scripts/register-jsx-loader.mjs --test tests/wells-pe-compute.test.mjs
npx playwright test tests/e2e/calculators/clinical/wells-pe.spec.js --project=chromium
```
