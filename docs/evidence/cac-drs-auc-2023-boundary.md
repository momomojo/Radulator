# CAC-DRS and proposed CAC-stage boundary audit

The original 2018 CAC-DRS publication contains conflicting wording at an
Agatston score of exactly 300. Radulator now uses the later unambiguous
multi-society authority:

- ACC/AHA/ASE/ASNC/ASPC/HFSA/HRS/SCAI/SCCT/SCMR/STS 2023 Multimodality
  Appropriate Use Criteria for the Detection and Risk Assessment of Chronic
  Coronary Disease
- DOI: `10.1016/j.jacc.2023.03.410`
- PMCID: `PMC10585920`
- Locator: Table 1.2, scenarios 18-21
- Accessible primary XML:
  https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10585920/fullTextXML

Table 1.2 identifies CAC score 100-299 as CAC-DRS 2 and CAC score >=300 as
CAC-DRS 3. The executable evidence therefore binds literal scores 299, 300,
and 301 to A2, A3, and A3 respectively.

The independent audit command retrieves the primary XML, isolates Table 1.2,
verifies both boundary rows, and executes the three calculator vectors. The
same command also retrieves the accessible full-text XML for Maron et al.
(PMCID `PMC11462328`), isolates its proposed staging table, verifies stages 0
through 4 (`0`, `1-99` below the 75th percentile, `100-299` or at least the
75th percentile, `300-999`, and `>=1000`), and executes the corresponding
calculator boundaries. The protected `Hermes Release Control Tests` check
installs the required PDF extraction tool and runs this command together with
the KBRC live-supplement audit on every exact PR head:

```bash
npm run test:cac-drs-source
```
