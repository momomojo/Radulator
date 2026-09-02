# CAC-DRS and proposed CAC-stage boundary audit

The original 2018 CAC-DRS publication contains conflicting wording at an
Agatston score of exactly 300. Radulator uses the later unambiguous
multi-society authority:

- ACC/AHA/ASE/ASNC/ASPC/HFSA/HRS/SCAI/SCCT/SCMR/STS 2023 Multimodality
  Appropriate Use Criteria for the Detection and Risk Assessment of Chronic
  Coronary Disease
- DOI: `10.1186/s12968-023-00958-5`
- PMCID: `PMC10585920`
- Locator: `Tab2` / Table 1.2, clinical scenarios 18-21
- Accessible primary full text:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC10585920/

The primary HTML path is accepted only for an exact HTTP 200 response whose
raw final URL and URL components remain exactly
`https://pmc.ncbi.nlm.nih.gov/articles/PMC10585920/`, whose media type is
`text/html`, and whose `citation_fulltext_html_url`, `citation_doi`, and
`citation_title` metadata exactly identify this article. The validator also
requires the four CAC rows in Tab2: score 0/CAC-DRS 0, 1-99/CAC-DRS 1,
100-299/CAC-DRS 2, and >=300/CAC-DRS 3. A malformed HTTP 200 body is retried
within a 2,000,000-byte boundary before the source is rejected.

If that primary body cannot be validated, the only fallback is the NCBI PMC
BioC JSON endpoint below; no alternate host, port, path, media type, or
redirect is accepted:

```text
https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC10585920/unicode
```

The fallback requires `application/json`, exact HTTP 200, the exact raw final
URL and components above, PMC document `10585920`, DOI
`10.1186/s12968-023-00958-5`, the exact article title, and a unique `Tab2`
caption/table identity. The live capture is 216,779 raw bytes with SHA-256
`e13e2353c894a67bd9092255f89a682ef43ce638aa26873a54e8ef4ae63d351a`.
For the evidence digest, JSON is parsed and recursively re-serialized as
compact UTF-8 with lexicographically sorted object keys and no trailing
newline: 207,915 canonical bytes with SHA-256
`3870526ebbef77ece57d8ea89f0d32d2a63c2fd47013aa425ced7ceaa0c9d3f2`.

Table 1.2 identifies CAC score 100-299 as CAC-DRS 2 and CAC score >=300 as
CAC-DRS 3. The executable evidence therefore binds literal scores 299, 300,
and 301 to A2, A3, and A3 respectively.

The same audit retrieves the primary PMC full text for Maron et al.
(PMCID `PMC11462328`), requiring exact HTML identity and the proposed staging
table (`tbl1`) rows for stages 0 through 4: `0`, `1-99` below the 75th
percentile, `100-299` or at least the 75th percentile, `300-999`, and `>=1000`.
It executes the corresponding calculator boundaries as well. Negative local
fixtures cover redirects, non-default ports, wrong media types, wrong article
identity, HTTP 206, malformed HTTP 200 bodies, and wrong-table identities for
both the primary and fallback paths. The protected `Hermes Release Control
Tests` check installs the required PDF extraction tool and runs this command
together with the KBRC live-supplement audit on every exact PR head:

```bash
npm run test:cac-drs-source
```
