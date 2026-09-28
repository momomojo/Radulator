# IPSS primary-source audit

`scripts/audit-ipss-primary-source.test.mjs` checks the IPSS calculator's localization cutoffs
against a pinned primary source at every exact head. It runs the offline tests, then the live audit.

In CI, the Smoke workflow step "Verify roadmap clinical source audits at exact head" discovers and
runs every `scripts/audit-*-source.test.mjs` on clinical changes, including this one. That step is
shared by all source audits; IPSS has no dedicated named check. Adding one would change release
control (the workflow or `package.json`), so it is not part of this audit. The step log carries the
audit's own PASS line with the pinned digest.

## Source

Siddiq F, Brooks H, Demirtas E, Bhatti IA, et al. Consensus Guidelines on Inferior Petrosal Sinus Sampling: A Guideline From the Society of Vascular and Interventional Neurology Guidelines and Practice Standards Committee. *Stroke: Vascular and Interventional Neurology* 2026.

- PMID 42088331
- PMC13138407, article version PMC13138407.1
- DOI 10.1161/SVIN.125.002309
- License: CC BY-NC-ND 4.0. No source bytes are committed.

## Retrieval

The DOI and the PMC HTML page are behind browser challenges, so the audit fetches the article as
PMC XML through NCBI E-utilities:

`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&retmode=xml&tool=radulator-ipss-source-audit&id=13138407`

Only transport failures are retried: network errors, HTTP 429 and HTTP 5xx. The audit makes five
attempts with exponential backoff, honours `Retry-After`, and caps each wait at 30 seconds. A
successful response that misses any pin is a changed source, not a transient failure, so it fails
at once.

## Pinned response

The response must match every pin before anything is parsed.

| Pin | Value |
|---|---|
| Final URL protocol, host and path (after redirects) | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi` |
| Final URL query | `db=pmc`, `id=13138407`, `retmode=xml` |
| Media type | `text/xml; charset=utf-8` |
| Decoded body length | 118457 bytes |
| SHA-256 of the decoded body | `0b43fa8e60653614611f4d61a5302bcd05fe21b3adbef39566e055e7e9156c9b` |

The pin is on the raw response bytes, not on normalized text, because the response is byte-stable.
When it was pinned on 2026-09-28 UTC, six retrievals were compared. They spanned nine minutes, came
from at least two NCBI backends, and used both curl and Node `fetch`. All six decoded to identical
bytes. Only the gzip transfer encoding differed between responses. The server sends no
`Content-Length`, so the length pin is on the decoded body. The XML contains no per-request
elements, so no normalized-text fallback is needed.

Any change fails the audit, including a new PMC article version or reprocessing of the record. To
re-pin, review the new response against the reviewed statements, their locators and everything the
calculator cites. Then update the pins in `scripts/audit-ipss-primary-source.mjs` in a reviewed
change.

## Identity

The audit checks these structured `<article-id>` elements: PMID, PMCID, article version and DOI.
It also checks the full `<article-title>` and the CC BY-NC-ND 4.0 license reference.

## Literal statements verified, with locators

Each statement must appear exactly once in the section named by its locator. The locator is the
`<sec><title>` path in the article `<body>`, outermost first. That path must identify exactly one
section. Only the section's own text counts: nested child sections are excluded. The comparison is
made after `≥`/`≤`, dashes and whitespace are normalized.

| Claim | Locator (`<sec><title>` path) | Statement |
|---|---|---|
| ACTH cutoffs | Important Lab Values > Supporting Literature Summary | An ACTH IPS:P ratio ≥2 prestimulation or a peak ≥3 poststimulation (CRH or desmopressin) is considered diagnostic for CD. |
| Prolactin adequacy | Important Lab Values > Supporting Literature Summary | Prestimulation PRL IPS:P ratios ≥1.8 support adequate catheterization |
| Prolactin caution | Important Lab Values > Supporting Literature Summary | …with a ratio <1.8 indicating improper placement |

The digest pins the whole reviewed article. That includes Figure 5, which sits in the same section
and which the calculator cites for its concurrent-prolactin normalization. The audit asserts literal
text only for the three statements above.

## Calculator binding

`src/components/calculators/IPSS.jsx` is run at the exact thresholds and just below them, on the
left and on the right inferior petrosal sinus:

| Input | Ratio | Expected result |
|---|---|---|
| Basal ACTH, each side | 2.0 | meets the basal criterion |
| Basal ACTH, each side | 1.9995 | does not |
| Stimulated peak, each side | 3.0 | meets the stimulated criterion |
| Stimulated peak, each side | 2.9995 | does not |
| Basal PRL | 1.8 on both sides | each side supports adequate sampling |
| Basal PRL | 1.799 on one side, either side | sampling caution on that side |

An offline test makes each inclusive comparison exclusive in turn: basal left, basal right,
stimulated peak, PRL left and PRL right. Every such change fails the binding.
