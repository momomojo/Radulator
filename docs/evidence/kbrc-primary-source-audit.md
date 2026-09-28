# KBRC primary-source audit

The KBRC implementation is checked against the open primary article and its
supplement with:

```bash
npm run test:kbrc-source
```

The audit requires Node.js 20 or newer. It retrieves the publisher PDF first,
falls back to the Europe PMC supplementary archive when the publisher
endpoint is unavailable, and parses the verified PDF bytes with the installed
`pdfjs-dist` library in memory. No Poppler executable or temporary source
directory is part of the audit path.

The audit downloads the PMC full-text XML named in the registry (NCBI PMC
OAI-PMH) and the supplement for PMCID `PMC13156734`, verifies the `mmc1.pdf`
member before parsing it, and retains the source bytes only in memory:

- Member: `mmc1.pdf`
- Bytes: `3696579`
- SHA-256: `d05d344c32a94e797587c5cb79896117026199d0dacd36ea1c0f28856848f6f5`
- Locator: Item S1, equation for the refit model on the combined dataset

The script derives all 22 signed equation terms and spline knots from Item S1,
derives the four published examples from the article XML and Table 1, and then
compares those source-derived values independently with both the executable
calculator and the canonical compute fixtures. The math regression also checks
representative neighborhoods immediately below, at, and above every spline
knot. A same-commit manifest is not used as the equation or vector oracle.

The verification record includes deliberate mutation checks against a
temporary working copy of the calculator source. A representative equation
sign change, spline-knot change, and native-indicator change must each make the
source-derived math regression fail; every mutation is restored before the
final checks and no mutation is retained in the worktree.

## Weight-input review binding

The calculator reviews, rather than rejects, weights outside 30–130 kg (the
`Input Review` output), and its information text says BMI, not weight alone, is
the model predictor. The audit binds both to the primary source at the exact
head. The literal statements it asserts are kept in `WEIGHT_XML_STATEMENTS` and
`WEIGHT_PDF_STATEMENTS` in `scripts/audit-kbrc-primary-source.mjs`.

Source statements, each asserted verbatim at its locator:

- Article XML paragraph `p0030` (Methods, Cohort Generation): weight and height
  are listed among the variables collected for the derivation model.
- Article XML paragraph `p0050` (Methods, Statistical Analysis): BMI is one of
  the continuous predictors modeled with 3-knot restricted cubic splines, and no
  variable was dichotomized or categorized or given an arbitrary cutoff.
- Supplement `mmc1.pdf` page 5 (Item S1): BMI is expressed in kg/m², and the
  parsed equation has no weight or height input. Weight enters the model only
  through BMI.
- Supplement page 6 (Table S1, Predictor Modeling Approach): BMI is a
  continuous restricted cubic spline with 3 knots. No weight or height predictor
  is listed.
- Article Table 1: BMI is reported only as a median (IQR), 28.28
  (24.60–32.59) kg/m² in the combined cohort. The table has no weight or height
  row.
- Closed-world check: across the whole article, including tables, captions and
  references, body weight, obesity and kilogram values appear only in the two
  lists of collected variables (the abstract and `p0030`). The source states no
  weight range, limit or validated domain.

Runtime binding, using the published lower-risk allograft example from `p0115`
(BMI 30):

- At 29.99, 30, 30.01, 129.99, 130 and 130.01 kg (height 170 cm), the
  calculator returns an estimate, never an error. The probability equals an
  oracle evaluated directly from the Item S1 terms at the BMI implied by that
  weight, so the weight is neither clamped nor cut off.
- `Input Review` appears only at 29.99 and 130.01 kg. It must call the interval
  a Radulator entry-review interval that is not a validated model domain, ask
  for a check of weight, height and units, and leave applicability to clinical
  judgment.
- 86.7 kg at 170 cm and 132.3 kg at 210 cm (both BMI 30) return the published
  0.4% with the same probability. Only 132.3 kg is reviewed.
- Zero and negative weights are rejected, because they cannot form a BMI. Age,
  height, platelet, hemoglobin and kidney-length limits stay enforced: values
  0.01 beyond each limit are rejected and the limits themselves are accepted.

In the same run, the binding must fail for four simulated regressions: a
restored hard 30–130 kg cutoff, a clamped weight, a removed review, and review
text that calls the interval the validated model domain.

The 30–130 kg interval is a Radulator entry-review aid. Neither the article nor
the supplement defines it, and the audit does not treat it as a model claim.

## Licensing and endpoints

The article and supplement are licensed CC BY-NC-ND 4.0. Radulator does not
vendor or modify either source artifact. The downloaded bytes remain only in
memory for the audit process; the repository stores the primary URLs,
immutable member digest, extraction code, and source-derived numeric facts
needed for reproducibility.

Primary endpoints:

- Full-text XML used by the audit (the registry's `full_text_xml_url`): https://pmc.ncbi.nlm.nih.gov/api/oai/v1/mh/?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:13156734&metadataPrefix=pmc
- Full-text XML, Europe PMC copy with the same paragraph ids: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13156734/fullTextXML
- Supplement PDF (publisher): https://ars.els-cdn.com/content/image/1-s2.0-S2590059526001135-mmc1.pdf
- Supplement archive: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13156734/supplementaryFiles
- Human-readable article: https://europepmc.org/article/PMC/13156734
