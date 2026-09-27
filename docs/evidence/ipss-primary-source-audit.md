# IPSS primary-source audit

The IPSS calculator's localization cutoffs are checked at every exact head by
`scripts/audit-ipss-primary-source.test.mjs`. Smoke runs every `scripts/audit-*-source.test.mjs` on clinical changes.

## Source

Siddiq F, Brooks H, Demirtas E, Bhatti IA, et al. Consensus Guidelines on Inferior Petrosal Sinus Sampling: A Guideline From the Society of Vascular and Interventional Neurology Guidelines and Practice Standards Committee. *Stroke: Vascular and Interventional Neurology* 2026.

- PMID 42088331
- PMC13138407
- DOI 10.1161/SVIN.125.002309

## Retrieval

The DOI and the PMC HTML page are behind browser challenges, so the audit fetches the article as PMC XML through NCBI E-utilities (`efetch db=pmc`). Retrieval uses five attempts with exponential backoff and honours `Retry-After`. It fails loudly if the source cannot be retrieved.

The audit then confirms the article's PMID, PMCID, DOI and title.

## Literal statements verified

Each statement must appear verbatim in the article body. The comparison is made after `≥`/`≤` and whitespace are normalized.

| Claim | Statement |
|---|---|
| ACTH cutoffs | An ACTH IPS:P ratio ≥2 prestimulation or a peak ≥3 poststimulation (CRH or desmopressin) is considered diagnostic for CD. |
| Prolactin adequacy | Prestimulation PRL IPS:P ratios ≥1.8 support adequate catheterization |
| Prolactin caution | …with a ratio <1.8 indicating improper placement |

## Calculator binding

`src/components/calculators/IPSS.jsx` is run at the exact thresholds and just below them:

| Input | Ratio | Expected result |
|---|---|---|
| Basal ACTH | 2.0 | meets the basal criterion |
| Basal ACTH | 1.9995 | does not |
| Stimulated peak | 3.0 | meets the stimulated criterion |
| Stimulated peak | 2.9995 | does not |
| Basal PRL | 1.8 on both sides | supports adequate sampling |
| Basal PRL | 1.799 on one side | sampling caution |

Changing the basal comparison to an exclusive `> 2` fails the audit.
