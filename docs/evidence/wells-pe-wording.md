# Wells PE criterion wording: source evidence

Review date: 2026-09-28 (UTC)

Scope: the checkbox labels and subLabels of `src/components/calculators/WellsPE.jsx` (`wells-pe`), the matching result line, the info link and one added reference. Weights, the two-level split and the three-tier cut points are unchanged (see "Scoring is unchanged"). This is bounded source and implementation evidence, not clinical sign-off or whole-calculator certification.

No source prose is reproduced here. The texts below are criterion names, numeric criteria stated as facts, identifiers and our own paraphrases.

## Sources

| Key | Source | Identifiers | How it was read |
|---|---|---|---|
| NICE-NG158 | NICE guideline NG158, *Venous thromboembolic diseases: diagnosis, management and thrombophilia testing* (published 26 March 2020, last updated 2 August 2023) | [nice.org.uk/guidance/ng158](https://www.nice.org.uk/guidance/ng158) | NICE's own NG158 PDF, fetched live (see "Retrieved artifacts"). The live file is byte-identical to the Internet Archive capture `20260829003713`, whose SHA-1 matches the archive's CDX digest `BEGSGCWDDU6PSC4P3R76SBRZNC2DXCVB`. The same Table 2 content appears in the HTML recommendations chapter and in NICE's April 2024 render of the PDF (archive capture `20240415113901`). |
| Wells2000 | Wells PS, Anderson DR, Rodger M, et al. Derivation of a simple clinical model to categorize patients probability of pulmonary embolism: increasing the models utility with the SimpliRED D-dimer. *Thromb Haemost.* 2000;83(3):416-420 | PMID [10744147](https://pubmed.ncbi.nlm.nih.gov/10744147/); DOI [10.1055/s-0037-1613830](https://doi.org/10.1055/s-0037-1613830) | PubMed plain-text abstract via NCBI E-utilities (see "Retrieved artifacts"). The publisher full text was not retrieved. Crossref metadata for the DOI matches the title, volume 83, issue 3, pages 416-420 and year 2000; the PubMed record carries no DOI. |
| AltVersion | Walen S, et al. *Insights Imaging.* 2014;5:231-236, Table 1 | PMC [3999363](https://pmc.ncbi.nlm.nih.gov/articles/PMC3999363/) | Context only. It reproduces a different version of the rule, which this calculator does not cite. |

### Retrieved artifacts

Each artifact was fetched twice, 73 seconds apart, on 2026-09-28 at 04:36 and 04:37 UTC. Both fetches returned HTTP 200 with identical bytes.

| Artifact | URL | Media type | Bytes | SHA-256 of the response bytes |
|---|---|---|---|---|
| NICE NG158 PDF | `https://www.nice.org.uk/guidance/ng158/resources/venous-thromboembolic-diseases-diagnosis-management-and-thrombophilia-testing-pdf-66141847001797` | application/pdf | 305,423 (54 pages) | `d96c3f78a4becc4e6e82de3a76f6a1be1ab05d82045dd4d53d66c62c2578a058` |
| NICE NG158 recommendations chapter | `https://www.nice.org.uk/guidance/ng158/chapter/Recommendations` | text/html | 120,558 | `455281393f1e56d707462ff0f7098b2f5cb23386bb0679ed61d6524c3b77f3fe` |
| Wells 2000 abstract, PubMed plain text | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=10744147&rettype=abstract&retmode=text&tool=radulator-wells-audit` | text/plain | 3,104 | `6a5ba4c054a1c74315f88a2bbd1fbeabbc599db49c70def9f1c7b8be36c64de8` |

NICE locator: recommendation 1.1.17, Table 2 "Two-level PE Wells score" (PDF page 12 of 54), rows 1 to 7 and the simplified-score rows. NICE marks the table as adapted with permission from Wells 2000. For the malignancy row, see also NICE's "Terms used in this guideline" entry for active cancer (PDF page 28).

## Changed text

| Field | Before | After | Source and locator | Paraphrase (own words) | Binding |
|---|---|---|---|---|---|
| `alternative_less_likely` label | PE is #1 diagnosis OR equally likely | Alternative diagnosis less likely than PE | NICE-NG158 Table 2 row 2 (3 points). The Wells2000 abstract names the 3.0-point item as the absence of an alternative diagnosis. | The item scores only when the clinician judges PE more likely than every alternative diagnosis. Neither source credits a case where an alternative is as likely as PE. | Compute test: exact label, and no "equally likely" or "#1" in any field or output. Spec: visible label, absence of the old wording, breakdown line. |
| `alternative_less_likely` subLabel | Alternative diagnosis is less likely than PE | PE judged more likely than every alternative diagnosis; a tie does not count | As above | The same strict reading, stated from the PE side, with the tie made explicit. | Compute test |
| `clinical_dvt` subLabel | Leg swelling, pain with palpation of deep veins | Must include both leg swelling and pain on palpation of the deep veins | NICE-NG158 Table 2 row 1 | Both findings are the minimum. Either one alone does not meet the item. | Compute test |
| `immobilization_surgery` subLabel | Bedrest ≥3 days OR surgery requiring general/regional anesthesia in past 4 weeks | Immobilization lasting more than 3 days, or surgery, within the previous 4 weeks | NICE-NG158 Table 2 row 4. The Wells2000 abstract lists immobilization or surgery within the prior 4 weeks at 1.5 points. | Immobilization must exceed 3 days, so exactly 3 days does not qualify. The PE rule puts no anaesthesia condition on surgery; that condition belongs to the DVT rule. | Compute test: requires "more than 3 days" and "4 weeks"; rejects ≥, "at least", anaesthesia and bedrest. |
| `previous_pe_dvt` subLabel | Objectively diagnosed | (removed) | NICE-NG158 Table 2 row 5; Wells2000 abstract | Both sources list a previous DVT or PE with no further qualifier. "Objectively diagnosed" comes from the AltVersion wording. | Compute test: no subLabel |
| `malignancy` subLabel | Active cancer (treatment within 6 months or palliative) | Under treatment, treated within the past 6 months, or palliative | NICE-NG158 Table 2 row 7; NICE glossary entry for active cancer | The item covers cancer under current treatment, treated within the past 6 months, or managed palliatively. NICE's glossary definition of active cancer is broader (it also counts, for example, a diagnosis within the past 6 months), so that term is dropped. The nested parentheses go with it. | Compute test |
| Score Breakdown line | PE #1 diagnosis or equally likely: +3.0 | Alternative diagnosis less likely than PE: +3.0 | Follows the label | The result names the same criterion as the input. | Compute test (all 128 selections); spec |
| Info link "View Original Wells PE Study" | `https://doi.org/10.1160/TH00-08-0302` | `https://doi.org/10.1055/s-0037-1613830` | doi.org handle API: the old DOI returns response code 100 (handle not found). Crossref: the new DOI is Wells2000. | The link to the primary study was dead. | Compute test |
| `refs` | No NICE entry | Adds NICE NG158, recommendation 1.1.17, Table 2 | NICE-NG158 | Cites the adaptation that supplies the criterion definitions. | Compute test |

The previous label, the "≥3 days" threshold and "objectively diagnosed" all match AltVersion's Table 1. That is a different version of the rule from the Wells 2000 / NICE version this calculator cites (`guidelineVersion: "Wells Criteria (2000)"`).

## How a tie is scored (the one change that can move a score)

`compute()` is unchanged. The checkbox is a clinician judgement, and the label change alters what that judgement should be when PE and an alternative diagnosis seem equally likely:

- Before, the label told the user to select the item for a tie, which added 3 points.
- Now, the label and subLabel say that a tie does not count, so the item adds 0 points.

Three points can move a patient across the two-level boundary, for example from 1.5 points (PE unlikely) to 4.5 points (PE likely). That switches the pathway from D-dimer first to CTPA directly. A compute vector pins this pair of results.

Why the cited source supports the strict reading:

- NICE's official adaptation of Wells 2000 words the item as the alternative diagnosis being less likely than PE. An alternative that is equally likely is not less likely.
- The Wells 2000 abstract names the item as the absence of an alternative diagnosis. That is stricter still, and it also gives no credit for a tie.

## Scoring is unchanged

- `tests/wells-pe-compute.test.mjs` covers all 128 selections:
  - The score is the sum of the source weights: 3, 3, 1.5, 1.5, 1.5, 1 and 1.
  - The two-level result is PE unlikely at 4 points or less and PE likely above 4.
  - The three-tier result uses the cut points as implemented: 1 point or less is low, 6 points or less is moderate, and above 6 is high.
  - The recommendation and severity follow the two-level result.
  - Named boundary vectors cover 4 and 4.5 points, and 6 and 6.5 points.
- A differential run against `origin/develop` (not committed) compared the 128 outputs:
  - 64 are identical.
  - The other 64 differ only in the renamed breakdown line.
- Mutation checks (not committed) confirmed that the compute test fails when:
  - a weight changes;
  - either two-level or three-tier comparison changes;
  - the old label, the "≥3 days" threshold, the "objectively diagnosed" subLabel or the dead DOI returns.

## Weights and cut points compared with the source

- **Weights:** they match the Wells2000 abstract and NICE-NG158 Table 2.
- **Two-level split:** it matches both sources.
- **Three-tier bands: known difference, not changed here.**
  - The Wells2000 abstract bands are: low below 2.0 points, moderate 2.0 to 6.0 points, high above 6.0 points.
  - The calculator places 1.5 points (any single 1.5-point item) in Moderate rather than Low.
  - The info text's ranges (0-1 and 2-6 points) do not cover 1.5.
  - This is a scoring change, outside a wording fix. It is left for a separate PR, and the compute test pins the current behaviour so that the fix has to be deliberate.

## Source audit decision

No network audit script was added. Smoke runs every `scripts/audit-*-source.test.mjs` on each clinical PR, and exempting one requires a workflow change, so a NICE-based audit would put NICE's availability and PDF rendering in front of every clinical PR. Two observations during this review argue against that:

- **NICE had an outage.** At 04:07 to 04:10 UTC on 2026-09-28, NICE's guidance service returned HTTP 500 for every guidance URL tried: the NG158 overview, recommendations chapter and PDF, and NG51 as a control. The earlier evidence review, finished at about 03:40 UTC, had already hit the same errors, so the failures spanned at least half an hour. The service had recovered by 04:34 UTC. The existing source audits retry for well under a minute in total.
- **NICE re-renders the PDF without changing its content.** Compared with the 2026 file, NICE's April 2024 render of NG158 has:
  - a © NICE 2023 footer instead of 2026;
  - 55 pages instead of 54;
  - 320,405 bytes instead of 305,423;
  - identical Table 2 content.

  A raw-byte pin would therefore fail at NICE's next re-render, for example a footer-year change, with no change to the guidance.

The Wells2000 plain-text abstract is byte-stable and served by NCBI E-utilities, but it carries only the item names, weights and cut points, not the definitions changed here. An audit binding its three-tier bands would fail on the 1.5-point difference above, so it belongs with that scoring fix. The byte pins in "Retrieved artifacts" let a reviewer re-verify every source by hand.

## Rendering note

At this head, checkbox subLabels are not rendered (the checkbox branch of `src/components/forms/Field.jsx` passes the label only). The corrected subLabels become visible when the renderer fix lands; labels and the result line are visible now.

## Reproduce

```text
node --import ./scripts/register-jsx-loader.mjs --test tests/wells-pe-compute.test.mjs
npx playwright test tests/e2e/calculators/clinical/wells-pe.spec.js --project=chromium
```
