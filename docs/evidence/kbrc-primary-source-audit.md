# KBRC primary-source audit

The KBRC implementation is checked against the open primary article and its
supplement with:

```bash
npm run test:kbrc-source
```

The audit requires Node.js 20 or newer and Poppler's `pdftotext` command on
`PATH`.

The audit downloads the Europe PMC full-text XML and supplementary ZIP for
PMCID `PMC13156734`, extracts only `mmc1.pdf` into a mode-0600 temporary
directory, and verifies the member before reading it:

- Member: `mmc1.pdf`
- Bytes: `3696579`
- SHA-256: `d05d344c32a94e797587c5cb79896117026199d0dacd36ea1c0f28856848f6f5`
- Locator: Item S1, equation for the refit model on the combined dataset

The script derives all 22 signed equation terms and spline knots from Item S1,
derives the four published examples from the article XML and Table 1, and then
compares those source-derived values independently with both the executable
calculator and the canonical compute fixtures. A same-commit manifest is not
used as the equation or vector oracle.

The article and supplement are licensed CC BY-NC-ND 4.0. Radulator does not
vendor or modify either source artifact. The downloaded bytes remain only in
the temporary audit directory and are deleted in a `finally` block; the
repository stores the primary URLs, immutable member digest, extraction code,
and source-derived numeric facts needed for reproducibility.

Primary endpoints:

- Full-text XML: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13156734/fullTextXML
- Supplement archive: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13156734/supplementaryFiles
- Human-readable article: https://europepmc.org/article/PMC/13156734
