# CAC-DRS and proposed CAC-stage boundary audit

Radulator resolves the CAC-DRS score-300 boundary with the later
multi-society authority:

- ACC/AHA/ASE/ASNC/ASPC/HFSA/HRS/SCAI/SCCT/SCMR/STS 2023 Multimodality
  Appropriate Use Criteria for the Detection and Risk Assessment of Chronic
  Coronary Disease
- DOI: `10.1186/s12968-023-00958-5`
- PMCID: `PMC10585920`
- Locator: `Tab2`, the table titled `Symptomatic Patients Without Known CCD
  and With Prior Testing*`, clinical scenarios 18-21

The proposed CAC staging boundaries are audited against Maron et al.,
`Coronary Artery Calcium Staging to Guide Preventive Interventions`:

- DOI: `10.1016/j.jacadv.2024.101287`
- PMCID: `PMC11462328`
- Locator: `tbl1`, the table titled `Proposed Coronary Artery Calcium Staging Guide to Therapy`

## Accepted live artifacts

Only these two exact NCBI PMC BioC JSON artifacts are accepted by the live
audit. Publication HTML and all alternate hosts, ports, paths, media types,
redirects, and primary-HTML/BioC fallback paths are not retrieval sources for
this audit.

### AUC BioC JSON

- Endpoint: `https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC10585920/unicode`
- Exact final host: `www.ncbi.nlm.nih.gov`
- Exact final path: `/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC10585920/unicode`
- Required media type: `application/json`
- Raw body: `216779` bytes; SHA-256
  `e13e2353c894a67bd9092255f89a682ef43ce638aa26873a54e8ef4ae63d351a`
- Canonical body: `207915` bytes; SHA-256
  `3870526ebbef77ece57d8ea89f0d32d2a63c2fd47013aa425ced7ceaa0c9d3f2`

The BioC collection must identify source `PMC`, date `20240128`, and one
document with ID `10585920`, license `CC BY`, the exact AUC title, PMCID
`10585920`, and DOI `10.1186/s12968-023-00958-5`. The unique `Tab2` table
passage must have section type `TABLE`, a valid XML declaration, and the exact
clinical rows:

```text
18. CAC score = 0 (CAC-DRS 0)
19. CAC score 1-99 (CAC-DRS 1)
20. CAC score 100-299 (CAC-DRS 2)
21. CAC score >= 300 (CAC-DRS 3)
```

The executable boundary vectors therefore bind scores 299, 300, and 301 to
A2, A3, and A3 respectively.

### Maron BioC JSON

- Endpoint: `https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC11462328/unicode`
- Exact final host: `www.ncbi.nlm.nih.gov`
- Exact final path: `/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC11462328/unicode`
- Required media type: `application/json`
- Raw body: `26452` bytes; SHA-256
  `f9513adaa3fecf0163a04eaf21f18ff1faefb9045cedc504ee9e505ebde596e0`
- Canonical body: `25322` bytes; SHA-256
  `9fc8b5ffb054f03de2539911da77296e5435a9c60848859b6728c98cd81cf997`

The BioC collection must identify source `PMC`, date `20260202`, and one
document with ID `PMC11462328`, license `CC BY-NC-ND`, the exact Maron title,
subtitle `A Proposal and Call to Action`, PMCID `PMC11462328`, and DOI
`10.1016/j.jacadv.2024.101287`. The unique `tbl1` table passage must have
section type `TABLE`, a valid XML declaration, and these exact clinical
boundary rows:

```text
0  CAC Score: 0  No calcified plaque  Visual score: CAC absent
1  CAC Score: 1-99 and <75th percentile for age and sex  Mild atherosclerotic burden
2  CAC Score: 100-299 or >=75th percentile for age and sex  Moderate atherosclerotic burden
3  CAC Score: 300-999  Severe atherosclerotic burden
4  CAC Score: >=1,000  Extensive atherosclerotic burden
```

The executable Maron vectors cover stage 0, stage 1, the exact 75th-percentile
equality case (stage 2), score boundaries 100 and 299 (stage 2), 300 and 999
(stage 3), and 1,000 (stage 4).

For both artifacts, canonical bytes are produced from parsed JSON by
recursively sorting object keys, preserving array order, serializing compact
UTF-8 JSON, and omitting a trailing newline. Raw and canonical lengths and
SHA-256 values above are asserted by the audit and by the Hermes registry
`source_audit` record.

## Retrieval and negative coverage

Both artifacts are retrieved through the shared NCBI helper,
`scripts/lib/ncbi-fetch.mjs`, which spaces requests to NCBI and never sends
`NCBI_API_KEY` to the BioC API. Every request uses `redirect: "error"` and the
audit rejects any response with `response.redirected === true`. It then
requires HTTP 200, the exact final URL including protocol, host, port, path,
query, and fragment, and the exact JSON media type before reading the body. The
raw byte length and SHA-256 are checked before anything is parsed. Wrong final
URLs, wrong ports, wrong media types, HTTP 206, malformed HTTP-200 JSON, wrong
article identity, and wrong table identity are rejected for both AUC and Maron
fixtures. URL/media failures cancel the unread response body and assert
cleanup.

Retries follow the helper's policy: up to five attempts, 1, 2, 4 and 8 seconds
apart (a `Retry-After` header can lengthen a wait, up to 30 seconds), for
network errors, HTTP 429 and 5xx, a redirected, wrong-URL or wrong-media-type
response, and a response under half the pinned length (a challenge page). An
HTTP 200 body that is the wrong document fails at once and is never retried:
a raw length or SHA-256 mismatch, including same-length digest drift and
byte-length drift of the live artifacts, malformed JSON, a wrong identity or
table, and a body over `1,000,000` bytes, whose stream is cut off and cancelled
as soon as the limit is crossed. Non-retryable statuses such as HTTP 206, 302
and 404 stop after one attempt. Cleanup is attempted on redirect and non-200
responses, but a rejecting cleanup cannot replace the authoritative redirect
or HTTP error; the regression assertions cover that case and its call count.
An offline check also confirms that no error, fetch-log line or cache record
carries the key.

The protected exact-head `Clinical Source Audits (exact head)` job runs the live
audit at the PR head whenever its selection rules, loaded from the PR's base
commit, select it: on every PR to `main`, and on every `develop` PR whose diff
reaches this audit, the CAC calculator it imports, or the `cac-mesa` registry
record. The nightly source-audit run also runs it against `main` and `develop`.
It runs the same command as:

```bash
npm run test:cac-drs-source
```
