#!/usr/bin/env node

// Exact-head primary-source audit for the DLP-to-effective-dose interpretation boundary.
//
// Retrieves the official ICRP Publication 147 page (Abstract, Key Points and Executive
// Summary (a)-(h) as published by ICRP), the ICRP-hosted free extract of Publication 103,
// and AAPM Report 96. Every artifact must arrive from its pinned final URL host, path and
// query with its pinned media type. The two static PDFs are pinned by byte length and SHA-256
// of the raw response bytes. The ICRP 147 page is dynamic ASP whose navigation, news, footer
// and session markup can change without any change to the publication, so it is pinned by the
// SHA-256 of its normalized publication column (Recommended citation through Executive
// Summary (h)) instead of raw bytes: editing publication text fails the audit, site chrome
// does not. The audit then pins each source statement by the digest of its exact text span
// at its locator and binds the statements to the calculator runtime: the Interpretation
// text, the removed lifetime-cancer-risk output, the ICRP 147 citation/locator, the explicit
// age-stratum requirement and the unchanged adult chest conversion. Any drift exits non-zero.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { DLPDose } from "../src/components/calculators/DLPDose.jsx";

const CALCULATOR_PATH = "src/components/calculators/DLPDose.jsx";
const USER_AGENT = "Radulator-DLP-primary-source-audit/1";
const MAX_ATTEMPTS = 3;

const RUNTIME_INTERPRETATION =
  "Estimated effective dose supports broad radiation-dose comparisons. It does not determine an individual's cancer probability; individual risk assessment requires organ doses and age-, sex-, and population-specific factors.";
const RUNTIME_ICRP147_REFERENCE =
  "ICRP Publication 147. Use of dose quantities in radiological protection. Ann ICRP. 2021;50(1). Executive summary (f)-(g): medical comparisons and individual-risk limitations.";
const RUNTIME_ICRP103_REFERENCE_URL = "https://doi.org/10.1016/j.icrp.2007.10.003";
const RUNTIME_AGE_ERROR = "Please select a valid patient age group.";
const REMOVED_RISK_FIELD = "Estimated Additional Lifetime Cancer Risk";
// SHA-256 of the canonical JSON of all 55 runtime k-factors (every region x age, read back
// through compute() "K-Factor Used"). Identical on origin/develop and origin/main when #288
// was split: this family changes no conversion coefficient.
const EXPECTED_RUNTIME_K_TABLE_SHA256 =
  "482165e2a7b18266b6f46550f57d36c51b489cf64440142ecc6eec7ec650cbda";

const SOURCES = Object.freeze({
  icrp147: Object.freeze({
    key: "icrp147",
    authority: "International Commission on Radiological Protection",
    document:
      "ICRP Publication 147. Use of dose quantities in radiological protection. Ann ICRP 2021;50(1):9-82",
    doi: "10.1177/0146645320911864",
    pmid: "33653178",
    url: "https://www.icrp.org/publication.asp?id=ICRP+Publication+147",
    media_type: "text/html",
    // publication.asp is dynamic ASP: its navigation, news modules, footer and session markup
    // may change at any time, so raw bytes are not pinned. The enforced pin is the SHA-256 of
    // the publication column only (Recommended citation through Executive Summary (h)),
    // decoded as windows-1252, tags removed, entities decoded, NFKC, quote/dash folding,
    // whitespace collapsed, one paragraph block per line.
    pin: "publication-column-text",
    pin_rationale:
      "dynamic ASP page: navigation, news, footer and session markup can change without any change to the publication text",
    content_sha256: "01ebdf43c223d42a5618b20ba63cb4db4dee9de490ad28799e794fa49f08e8a6",
    content_blocks: 19,
    content_digest_basis:
      "publication column (Recommended citation through Executive Summary (h)), windows-1252 decoded, tags removed, entities decoded, NFKC, quote/dash folding, whitespace collapsed, one paragraph block per line",
  }),
  icrp103: Object.freeze({
    key: "icrp103",
    authority: "International Commission on Radiological Protection",
    document:
      "ICRP Publication 103 free extract. The 2007 Recommendations of the ICRP. Ann ICRP 2007;37(2-4)",
    doi: "10.1016/j.icrp.2007.10.003",
    pmid: "18082557",
    url: "https://www.icrp.org/docs/ICRP_Publication_103-Annals_of_the_ICRP_37(2-4)-Free_extract.pdf",
    media_type: "application/pdf",
    bytes: 354_712,
    sha256: "8129e99e681e7a20abaa6e269782195ef026002b019dd438a77c594befb556b9",
    pin: "raw-bytes",
    pages: 35,
  }),
  aapm96: Object.freeze({
    key: "aapm96",
    authority: "American Association of Physicists in Medicine",
    document:
      "AAPM Report No. 96. The Measurement, Reporting, and Management of Radiation Dose in CT. 2008",
    url: "https://www.aapm.org/pubs/reports/RPT_96.pdf",
    media_type: "application/pdf",
    bytes: 1_241_814,
    sha256: "dd67d8b4d39c5c9ce4aa505588047754d4a30558414477161614aa5ee5178157",
    pin: "raw-bytes",
    pages: 34,
  }),
});

// Source statements are pinned by the SHA-256 and length of the exact normalized source span
// that runs from a short `from` anchor to the next `to` anchor inside the named locator, so the
// audit verifies literal source text at head without republishing the copyrighted passages.
// `paraphrase` is Radulator's own summary for reviewers; open the URL at the locator to read
// the statement itself. ICRP 147 spans are case-preserving text after windows-1252 decoding,
// NFKC, quote/dash folding and whitespace collapsing, inside one paragraph block. PDF spans are
// the same folding, lower-cased, with whitespace and hyphens removed so typeset line breaks and
// end-of-line hyphenation do not matter; every other character must match.
const ICRP147_STATEMENTS = Object.freeze([
  Object.freeze({
    id: "icrp147-recommended-citation",
    locator: "ICRP Publication 147 page, Recommended citation",
    block: "citation",
    paraphrase: "ICRP's recommended citation: ICRP 2021, Publication 147, Annals of the ICRP 50(1).",
    spans: [
      {
        from: "ICRP, 2021.",
        to: "Ann. ICRP 50(1).",
        length: 101,
        sha256: "11905cdf0319ac5dea712cd6088c680c0aa4fc57f5fd3d3fa6054b88a1499095",
      },
    ],
  }),
  Object.freeze({
    id: "icrp147-abstract-individual-risk-organ-doses",
    locator: "Abstract",
    block: "abstract",
    paraphrase: "Best estimates of risk to individuals rely on organ/tissue doses and specific dose-risk models.",
    spans: [
      {
        from: "It is recognised that best",
        to: "dose risk models.",
        length: 118,
        sha256: "4166c55443ee6735f6a5fe39edbe226f2a36402654fb8ac2607ca6dfaee1f52c",
      },
    ],
  }),
  Object.freeze({
    id: "icrp147-key-point-medical-comparison",
    locator: "Key Points",
    block: "key_points",
    paraphrase:
      "Medical uses of effective dose include comparing doses between different procedures and informing justification.",
    spans: [
      {
        from: "Effective dose is used in medicine",
        to: "in medical research.",
        length: 204,
        sha256: "a5db6cbeb53c52ac31c85e832ccdaf4cd3ac84aa81d6f9845cf1b764c90d81ee",
      },
    ],
  }),
  Object.freeze({
    id: "icrp147-key-point-not-individual-risk-analysis",
    locator: "Key Points",
    block: "key_points",
    paraphrase:
      "Treating effective dose as an approximate risk indicator is no replacement for cancer-type-specific risk analysis based on organ/tissue doses.",
    spans: [
      {
        from: "It is emphasised that use",
        to: "using organ/tissue doses.",
        length: 156,
        sha256: "a804e1e5fbd19d792f77e0b64bca1ade02379c037adebc0d162f52b3ca0142d5",
      },
    ],
  }),
  Object.freeze({
    id: "icrp147-es-b-population-averaged-risk-coefficients",
    locator: "Executive Summary (b)",
    block: "b",
    paraphrase:
      "Detriment-adjusted nominal risk coefficients are averages of sex-, age- and population-specific values, for all workers and for the whole population.",
    spans: [
      {
        from: "Detriment-adjusted nominal risk coefficients",
        to: "years of age at exposure).",
        length: 284,
        sha256: "4c4cafd9e3ad810f9dd208fbc7bb6cf1c59fa5c54e84b1ff8a98eb46b2843585",
      },
    ],
  }),
  Object.freeze({
    id: "icrp147-es-c-reference-persons-of-specified-ages",
    locator: "Executive Summary (c)",
    block: "c",
    paraphrase: "Effective dose is computed for sex-averaged Reference Persons of stated ages.",
    spans: [
      {
        from: "Effective dose is calculated for sex-averaged",
        to: "of specified ages.",
        length: 82,
        sha256: "9ac4c0f19b5d1207d07ff20987067da3bc636e2a70f022b9870f4d6f37b566c4",
      },
    ],
  }),
  Object.freeze({
    id: "icrp147-es-f-medical-comparisons",
    locator: "Executive Summary (f)",
    block: "f",
    paraphrase:
      "In medicine, effective dose estimates can compare doses across imaging modalities such as CT and nuclear medicine, give a generic indicator for sorting procedure types into broad risk categories when communicating with clinicians and patients, and give an approximate measure of possible detriment.",
    spans: [
      {
        from: "In medical applications, estimates of",
        to: "within the body tissues.",
        length: 300,
        sha256: "9ebd38ce710af68dfb1d5b325687fe6a57bb69b4b41c8ef338584fee24047805",
      },
      {
        from: "In this context, effective dose",
        to: "clinicians and patients.",
        length: 217,
        sha256: "f9a87249aab9f695244f8218e439d5f7b8ac1865f037e7e457066ac5a557321e",
      },
      {
        from: "In each of these cases,",
        to: "of possible detriment.",
        length: 93,
        sha256: "f1375ffe7578a64ee4794763fba22e8d6c1634e786ac1751e47c21c6f09a555a",
      },
    ],
  }),
  Object.freeze({
    id: "icrp147-es-g-individual-risk-limits",
    locator: "Executive Summary (g)",
    block: "g",
    paraphrase:
      "Because low-dose risk projection is uncertain, effective dose can be regarded as an approximate indicator of possible risk, with lifetime cancer risk varying by age at exposure, sex and population; that use does not replace a risk analysis built on best-estimate organ/tissue doses, radiation-type effectiveness, and age-, sex- and population-specific risk factors with their uncertainties.",
    spans: [
      {
        from: "Bearing in mind the uncertainties",
        to: "and population group.",
        length: 275,
        sha256: "055a86bb48ba9fdfdcf972fea44f0e7047ed52cce9164b2693b2c772961117f9",
      },
      {
        from: "The use of effective dose as",
        to: "consideration of uncertainties.",
        length: 329,
        sha256: "7bb111e8c05ce6a9bbf0181f6559c907bcea4ffa5b1f3189fd5292af1c704c90",
      },
    ],
  }),
]);

// PDF statements. `start`/`end` bound the paragraph (whitespace-normalized, lower-case) on
// the named PDF page before the span anchors are applied.
const PDF_STATEMENTS = Object.freeze([
  Object.freeze({
    id: "icrp103-extract-identity",
    source: "icrp103",
    pdf_page: 1,
    locator: "Free extract cover",
    paraphrase: "The PDF is ICRP's extract of Publication 103, the 2007 Recommendations.",
    spans: [
      {
        from: "This document is an extract from",
        to: "Radiological Protection",
        length: 119,
        sha256: "a42edb5befe2a8e5f494810938a11ccb712b3b5d74fc577d6dcc21339d0f2216",
      },
    ],
  }),
  Object.freeze({
    id: "icrp103-es-e-combined-detriment-5-percent-per-sv",
    source: "icrp103",
    pdf_page: 13,
    printed_page: 12,
    locator: "Executive Summary (e)",
    start: "(e) an understanding of",
    end: "(f) the commission's extensive",
    paraphrase:
      "The combined detriment from excess cancer and heritable effects stays at roughly 5% per Sv (the ICRP figure the removed output treated as an individual lifetime cancer risk).",
    spans: [
      {
        from: "the combined detriment due to",
        to: "5% per Sv.",
        length: 88,
        sha256: "aaaa964f5ad71a72b960153bfee10077ef031237ca5a31bee7bec95528efe1e9",
      },
    ],
  }),
  Object.freeze({
    id: "icrp103-es-i-reference-person-not-individual",
    source: "icrp103",
    pdf_page: 14,
    printed_page: 13,
    locator: "Executive Summary (i), continued from printed p. 12",
    start: null,
    end: "(j) effective dose is intended",
    paraphrase:
      "Tissue weighting factors are rounded values meant for a population of both sexes and all ages, and effective dose is calculated for a Reference Person rather than for an individual.",
    spans: [
      {
        from: "intended to apply as rounded",
        to: "and all ages.",
        length: 65,
        sha256: "47bb24beef4ce9446805636fc0787bfef0c2c56c060383af84fcadd6a7694195",
      },
      {
        from: "Effective dose is calculated for a Reference Person",
        to: "for an individual.",
        length: 66,
        sha256: "249687a814d3e0a05b0b5af1a0409dc5413a76a150a677f4f965470d3e3e9305",
      },
    ],
  }),
  Object.freeze({
    id: "icrp103-es-j-not-for-individual-risk",
    source: "icrp103",
    pdf_page: 14,
    printed_page: 13,
    locator: "Executive Summary (j)",
    start: "(j) effective dose is intended",
    end: "(k) the collective effective dose",
    paraphrase:
      "Effective dose is a protection quantity; ICRP does not recommend it for epidemiological evaluation or for detailed retrospective investigation of an individual's exposure and risk.",
    spans: [
      {
        from: "Effective dose is intended for use",
        to: "protection quantity.",
        length: 51,
        sha256: "2e090aebd5ff1d1d1de2a8fcf1ccc58b595c9ab99bb62b9d5154e458eff4a3ff",
      },
      {
        from: "Effective dose is not recommended for",
        to: "exposure and risk.",
        length: 150,
        sha256: "aefb449ac5b18c2924dc319af77d18194e878c4a05a2cfd23527469855a9d40c",
      },
    ],
  }),
  Object.freeze({
    id: "icrp103-glossary-nominal-risk-coefficient",
    source: "icrp103",
    pdf_page: 28,
    printed_page: 27,
    locator: "Glossary, Nominal risk coefficient",
    start: "nominal risk coefficient",
    end: "non-cancer diseases",
    paraphrase:
      "A nominal risk coefficient is a lifetime risk estimate averaged over sex and age at exposure for a representative population.",
    spans: [
      {
        from: "Nominal risk coefficient",
        to: "representative population.",
        length: 107,
        sha256: "7c04c5f35753e52da34ea0263b813b6906409c98ce285b07f2b1ac38dc710fa5",
      },
    ],
  }),
  Object.freeze({
    id: "aapm96-identity",
    source: "aapm96",
    pdf_page: 3,
    locator: "Title page",
    paraphrase: "The PDF is AAPM Report No. 96 on measuring, reporting and managing CT radiation dose.",
    spans: [
      {
        from: "AAPM REPORT NO. 96",
        to: "Radiation Dose in CT",
        length: 72,
        sha256: "bafc93ad1e3543d4dcfa64d2f3407b04a94b962c0cb1805d4c70c41fc9586a61",
      },
    ],
  }),
  Object.freeze({
    id: "aapm96-table3-age-specific-columns",
    source: "aapm96",
    pdf_page: 19,
    printed_page: 13,
    locator: "Table 3 caption and column header",
    start: "table 3. normalized effective dose",
    end: "head and neck 0.",
    paraphrase:
      "Table 3 lists effective dose per DLP by body region in separate columns for 0-, 1-, 5- and 10-year-old patients and adults.",
    spans: [
      {
        from: "Table 3. Normalized effective dose",
        to: "various body regions.",
        length: 138,
        sha256: "9234dc4b069226749d34bc0d4c50fa3a30858b856e26b3db97b71eac2dc23eef",
      },
      {
        from: "Region of Body",
        to: "10 year old Adult",
        length: 63,
        sha256: "886181a91ea2c9a1eee8f10d2932ad1eea1ddc8c8957791ee8df58d78c8004b9",
      },
    ],
  }),
  Object.freeze({
    id: "aapm96-eq12",
    source: "aapm96",
    pdf_page: 19,
    printed_page: 13,
    locator: "Eq. 12",
    // pdf.js emits the approximately-equal glyph out of reading order on this page, so that
    // one glyph is removed from the page text before the span is taken.
    ignore_glyphs: ["\u2248"],
    paraphrase: "Eq. 12: effective dose (mSv) is approximately k multiplied by DLP.",
    spans: [
      {
        from: "E (mSv)",
        to: "(Eqn. 12)",
        length: 20,
        sha256: "43617407e1a12094e294d30829bd3113514c730f9aa15829350a621ca8045e0d",
      },
    ],
  }),
]);

const AGE_STRATA = Object.freeze([
  Object.freeze({ value: "newborn", label: "Newborn (0 years)", table3_column: "0 year old" }),
  Object.freeze({ value: "child_1", label: "Child (1 year)", table3_column: "1 year old" }),
  Object.freeze({ value: "child_5", label: "Child (5 years)", table3_column: "5 year old" }),
  Object.freeze({ value: "child_10", label: "Child (10 years)", table3_column: "10 year old" }),
  Object.freeze({ value: "adult", label: "Adult", table3_column: "Adult" }),
]);

// The removed branch reported (E / 1000) * 5 * 100 percent and switched to a "negligible"
// label below 0.01%, i.e. below E = 0.02 mSv. These vectors straddle that boundary and cover
// the old percentage branch, a large dose and a pediatric cell.
const BOUNDARY_VECTORS = Object.freeze([
  Object.freeze({
    id: "removed-negligible-branch-extremity-adult-dlp-1",
    inputs: { dlp: "1", body_region: "extremity", age_group: "adult" },
    effective_dose: "0.00 mSv",
  }),
  Object.freeze({
    id: "removed-branch-boundary-below-extremity-adult-dlp-24",
    inputs: { dlp: "24", body_region: "extremity", age_group: "adult" },
    effective_dose: "0.02 mSv",
  }),
  Object.freeze({
    id: "removed-branch-boundary-above-extremity-adult-dlp-26",
    inputs: { dlp: "26", body_region: "extremity", age_group: "adult" },
    effective_dose: "0.02 mSv",
  }),
  Object.freeze({
    id: "removed-percent-branch-extremity-adult-dlp-100",
    inputs: { dlp: "100", body_region: "extremity", age_group: "adult" },
    effective_dose: "0.08 mSv",
  }),
  Object.freeze({
    id: "aapm96-adult-chest-dlp-500",
    inputs: { dlp: "500", body_region: "chest", age_group: "adult" },
    effective_dose: "7.00 mSv",
  }),
  Object.freeze({
    id: "abdomen-pelvis-adult-dlp-750",
    inputs: { dlp: "750", body_region: "abdomen_pelvis", age_group: "adult" },
    effective_dose: "11.25 mSv",
  }),
  Object.freeze({
    id: "large-chest-adult-dlp-100000",
    inputs: { dlp: "100000", body_region: "chest", age_group: "adult" },
    effective_dose: "1400.00 mSv",
  }),
  Object.freeze({
    id: "pediatric-newborn-chest-dlp-500",
    inputs: { dlp: "500", body_region: "chest", age_group: "newborn" },
    effective_dose: "27.00 mSv",
  }),
]);

// Radulator data-entry guardrails from the same production change. They are tested here so
// the audit states their provenance, but they are not publication-derived clinical claims.
const APP_INPUT_GUARDRAIL_VECTORS = Object.freeze([
  Object.freeze({ id: "partial-numeric-string-rejected", dlp: "500junk" }),
  Object.freeze({ id: "nonfinite-string-rejected", dlp: "Infinity" }),
  Object.freeze({ id: "overflowing-string-rejected", dlp: "1e309" }),
  Object.freeze({ id: "hexadecimal-string-rejected", dlp: "0x10" }),
  Object.freeze({ id: "dose-underflow-rejected", dlp: "5e-324" }),
]);

const CLAIM_BINDINGS = Object.freeze([
  Object.freeze({
    claim_id: "interpretation-broad-dose-comparisons",
    runtime_field: "Interpretation",
    runtime_text: "Estimated effective dose supports broad radiation-dose comparisons.",
    source_statement_ids: ["icrp147-key-point-medical-comparison", "icrp147-es-f-medical-comparisons"],
  }),
  Object.freeze({
    claim_id: "interpretation-not-individual-cancer-probability",
    runtime_field: "Interpretation",
    runtime_text: "It does not determine an individual's cancer probability",
    source_statement_ids: [
      "icrp147-es-g-individual-risk-limits",
      "icrp147-key-point-not-individual-risk-analysis",
      "icrp103-es-i-reference-person-not-individual",
      "icrp103-es-j-not-for-individual-risk",
    ],
  }),
  Object.freeze({
    claim_id: "interpretation-individual-risk-inputs",
    runtime_field: "Interpretation",
    runtime_text:
      "individual risk assessment requires organ doses and age-, sex-, and population-specific factors.",
    source_statement_ids: [
      "icrp147-es-g-individual-risk-limits",
      "icrp147-abstract-individual-risk-organ-doses",
    ],
  }),
  Object.freeze({
    claim_id: "removed-numerical-lifetime-cancer-risk",
    runtime_absent_field: REMOVED_RISK_FIELD,
    source_statement_ids: [
      "icrp103-es-e-combined-detriment-5-percent-per-sv",
      "icrp103-glossary-nominal-risk-coefficient",
      "icrp147-es-b-population-averaged-risk-coefficients",
      "icrp147-es-g-individual-risk-limits",
    ],
  }),
  Object.freeze({
    claim_id: "icrp147-reference-and-locator",
    runtime_reference: RUNTIME_ICRP147_REFERENCE,
    source_statement_ids: [
      "icrp147-recommended-citation",
      "icrp147-es-f-medical-comparisons",
      "icrp147-es-g-individual-risk-limits",
    ],
  }),
  Object.freeze({
    claim_id: "explicit-age-stratum-required",
    runtime_error: RUNTIME_AGE_ERROR,
    source_statement_ids: [
      "icrp147-es-c-reference-persons-of-specified-ages",
      "aapm96-table3-age-specific-columns",
    ],
  }),
  Object.freeze({
    claim_id: "adult-chest-conversion-unchanged",
    runtime_vector_id: "aapm96-adult-chest-dlp-500",
    source_statement_ids: ["aapm96-table3-chest-row", "aapm96-eq12"],
  }),
]);

// windows-1252 code points for bytes 0x80-0x9f (undefined bytes map to U+FFFD).
const CP1252_C1 = [
  0x20ac, 0xfffd, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0xfffd, 0x017d, 0xfffd,
  0xfffd, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0xfffd, 0x017e, 0x0178,
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function retrieve(source) {
  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(source.url, {
        headers: { "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      });
      if (response.ok) {
        return {
          bytes: Buffer.from(await response.arrayBuffer()),
          finalUrl: new URL(response.url),
          contentType: response.headers.get("content-type") ?? "",
        };
      }
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel();
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < MAX_ATTEMPTS) await delay(1_000 * 2 ** (attempt - 1));
  }
  assert.fail(
    `${source.key}: primary-source retrieval failed after ${MAX_ATTEMPTS} attempts (${lastFailure})`,
  );
}

function assertArtifactIdentity(source, retrieved) {
  const expected = new URL(source.url);
  const { finalUrl } = retrieved;
  assert.equal(finalUrl.protocol, "https:", `${source.key}: final URL left HTTPS`);
  assert.equal(finalUrl.hostname, expected.hostname, `${source.key}: final URL host drifted`);
  assert.equal(finalUrl.pathname, expected.pathname, `${source.key}: final URL path drifted`);
  assert.equal(finalUrl.search, expected.search, `${source.key}: final URL query drifted`);
  const mediaType = retrieved.contentType.split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, source.media_type, `${source.key}: media type drifted`);
  if (source.media_type === "application/pdf") {
    assert.equal(
      retrieved.bytes.subarray(0, 5).toString("latin1"),
      "%PDF-",
      `${source.key}: artifact lacks a PDF header`,
    );
  }
}

function assertRawBytePin(source, retrieved) {
  assert.equal(source.pin, "raw-bytes", `${source.key}: raw-byte pin requested for a ${source.pin} source`);
  assert.equal(retrieved.bytes.length, source.bytes, `${source.key}: artifact byte length drifted`);
  assert.equal(sha256(retrieved.bytes), source.sha256, `${source.key}: artifact SHA-256 drifted`);
}

function decodeWindows1252(bytes) {
  let text = "";
  for (const byte of bytes) {
    text += String.fromCodePoint(byte >= 0x80 && byte <= 0x9f ? CP1252_C1[byte - 0x80] : byte);
  }
  return text;
}

function decodeEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&(amp|apos|gt|lt|nbsp|quot);/g, (_, name) => named[name]);
}

function foldText(value) {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlText(fragment) {
  return foldText(decodeEntities(fragment.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")));
}

function compact(value) {
  return foldText(value).toLowerCase().replace(/[\s\-\u00ad]+/g, "");
}

function icrp147Blocks(html) {
  const start = html.indexOf("<b>Recommended citation</b>");
  assert.ok(start >= 0, "icrp147: Recommended citation locator is missing");
  const end = html.indexOf("</div>", start);
  assert.ok(end > start, "icrp147: publication column end is missing");
  const blocks = html
    .slice(start, end)
    .split(/(?:\s*<br>\s*){2,}/i)
    .map(htmlText)
    .filter(Boolean);

  const single = (label, predicate) => {
    const matches = blocks.filter(predicate);
    assert.equal(matches.length, 1, `icrp147: expected exactly one ${label} block`);
    return matches[0];
  };
  const keyPointsStart = blocks.findIndex((block) => block.startsWith("Key Points "));
  const summaryStart = blocks.findIndex((block) => block.startsWith("Executive Summary (a) "));
  assert.ok(keyPointsStart >= 0, "icrp147: Key Points locator is missing");
  assert.ok(summaryStart > keyPointsStart, "icrp147: Executive Summary must follow Key Points");

  const located = {
    citation: single("Recommended citation", (block) => block.startsWith("Recommended citation ")),
    abstract: single("Abstract", (block) => block.startsWith("Abstract - ")),
    key_points: blocks.slice(keyPointsStart, summaryStart).join("\n"),
  };
  const letters = ["a", "b", "c", "d", "e", "f", "g", "h"];
  letters.forEach((letter, index) => {
    const block = blocks[summaryStart + index];
    const marker = letter === "a" ? "Executive Summary (a) " : `(${letter}) `;
    assert.ok(block?.startsWith(marker), `icrp147: Executive Summary (${letter}) is missing or out of order`);
    located[letter] = block;
  });
  assert.equal(
    blocks.length,
    summaryStart + letters.length,
    "icrp147: unexpected content after Executive Summary (h)",
  );
  return { blocks, located };
}

function verifyIcrp147(retrieved, mismatches) {
  assertArtifactIdentity(SOURCES.icrp147, retrieved);
  const html = decodeWindows1252(retrieved.bytes);
  const { blocks, located } = icrp147Blocks(html);
  assert.equal(
    blocks.length,
    SOURCES.icrp147.content_blocks,
    "icrp147: publication-column paragraph count drifted",
  );
  const contentSha256 = sha256(blocks.join("\n"));
  assert.equal(
    contentSha256,
    SOURCES.icrp147.content_sha256,
    "icrp147: publication-column text drifted (re-review the ICRP 147 statements before re-pinning)",
  );
  const verified = new Map();
  for (const statement of ICRP147_STATEMENTS) {
    const block = located[statement.block];
    assert.ok(block, `${statement.id}: locator ${statement.locator} is missing`);
    verified.set(statement.id, {
      id: statement.id,
      source: "icrp147",
      locator: statement.locator,
      paraphrase: statement.paraphrase,
      spans: checkSpans(statement, block, foldText, mismatches),
    });
  }
  return {
    verified,
    contentSha256,
    blockCount: blocks.length,
    // Informational only: raw page bytes are not pinned (site chrome may change).
    observedRaw: { bytes: retrieved.bytes.length, sha256: sha256(retrieved.bytes), enforced: false },
  };
}

async function pdfPages(source, bytes) {
  const document = await getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    useSystemFonts: true,
    verbosity: 0,
  }).promise;
  assert.equal(document.numPages, source.pages, `${source.key}: PDF page count drifted`);
  const wanted = [...new Set(PDF_STATEMENTS.filter((s) => s.source === source.key).map((s) => s.pdf_page))];
  if (source.key === "icrp103") wanted.push(13);
  const pages = new Map();
  for (const pageNumber of [...new Set(wanted)].sort((left, right) => left - right)) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.set(
      pageNumber,
      foldText(content.items.map((item) => `${item.str}${item.hasEOL ? " " : ""}`).join("")).toLowerCase(),
    );
  }
  await document.destroy();
  return pages;
}

function spanDigest(text, from, to, label) {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `${label}: span start anchor ${JSON.stringify(from)} is missing`);
  assert.equal(
    text.indexOf(from, start + 1),
    -1,
    `${label}: span start anchor ${JSON.stringify(from)} is not unique in its locator`,
  );
  const toIndex = text.indexOf(to, start + from.length);
  assert.ok(toIndex >= 0, `${label}: span end anchor ${JSON.stringify(to)} is missing`);
  const value = text.slice(start, toIndex + to.length);
  return { length: value.length, sha256: sha256(value) };
}

function checkSpans(statement, text, normalize, mismatches) {
  return statement.spans.map((span, index) => {
    const actual = spanDigest(
      text,
      normalize(span.from),
      normalize(span.to),
      `${statement.id} span ${index + 1}`,
    );
    if (actual.length !== span.length || actual.sha256 !== span.sha256) {
      mismatches.push({ id: statement.id, span: index + 1, expected: { length: span.length, sha256: span.sha256 }, actual });
    }
    return { from: span.from, to: span.to, ...actual };
  });
}

function paragraphSlice(pageText, statement) {
  const start = statement.start ? pageText.indexOf(statement.start) : 0;
  assert.ok(start >= 0, `${statement.id}: start locator ${JSON.stringify(statement.start)} is missing`);
  const end = statement.end ? pageText.indexOf(statement.end, start + 1) : pageText.length;
  assert.ok(end > start, `${statement.id}: end locator ${JSON.stringify(statement.end)} is missing or out of order`);
  return pageText.slice(start, end);
}

function verifyPdfStatements(source, pages, mismatches) {
  const verified = new Map();
  for (const statement of PDF_STATEMENTS.filter((s) => s.source === source.key)) {
    const pageText = pages.get(statement.pdf_page);
    assert.ok(pageText, `${statement.id}: PDF page ${statement.pdf_page} was not extracted`);
    const withoutIgnored = (value) =>
      (statement.ignore_glyphs ?? []).reduce((text, glyph) => text.replaceAll(glyph, ""), value);
    const slice = compact(withoutIgnored(paragraphSlice(pageText, statement)));
    verified.set(statement.id, {
      id: statement.id,
      source: source.key,
      pdf_page: statement.pdf_page,
      ...(statement.printed_page ? { printed_page: statement.printed_page } : {}),
      locator: statement.locator,
      paraphrase: statement.paraphrase,
      spans: checkSpans(statement, slice, (value) => compact(withoutIgnored(value)), mismatches),
      ...(statement.ignore_glyphs ? { ignored_glyphs: statement.ignore_glyphs } : {}),
    });
  }
  return verified;
}

function verifyIcrp103Continuity(pages) {
  // Printed p. 12 (PDF 13) opens paragraph (i) and does not reach (j), so the text that opens
  // printed p. 13 (PDF 14) before "(j)" is the continuation of paragraph (i).
  const page13 = pages.get(13);
  const page14 = pages.get(14);
  const openI = page13.indexOf("(i) an important change");
  assert.ok(openI >= 0, "icrp103: Executive Summary (i) does not open on PDF page 13");
  assert.equal(page13.indexOf("(j) ", openI), -1, "icrp103: paragraph (j) unexpectedly starts on PDF page 13");
  const beforeJ = page14.slice(0, page14.indexOf("(j) effective dose is intended"));
  assert.doesNotMatch(beforeJ, /\([a-z]\) /, "icrp103: PDF page 14 has another paragraph before (j)");
}

function parseTable3ChestRow(pages) {
  const page = pages.get(19);
  const tableStart = page.indexOf("table 3. normalized effective dose");
  assert.ok(tableStart >= 0, "aapm96: Table 3 locator is missing");
  const row = page.slice(tableStart).match(/ chest ((?:\d\.\d+ ){4}\d\.\d+) /);
  assert.ok(row, "aapm96: Table 3 chest row could not be parsed");
  const values = row[1].split(" ").map(Number);
  assert.equal(values.length, AGE_STRATA.length, "aapm96: Table 3 chest row must have one value per age column");
  assert.ok(new Set(values).size > 1, "aapm96: Table 3 chest row must be age-specific");
  return Object.fromEntries(AGE_STRATA.map((stratum, index) => [stratum.table3_column, values[index]]));
}

function runtimeKTable() {
  const regions = DLPDose.fields.find((field) => field.id === "body_region").opts.map((opt) => opt.value);
  const ages = DLPDose.fields.find((field) => field.id === "age_group").opts.map((opt) => opt.value);
  return regions.map((region) => [
    region,
    ages.map((age) => {
      const result = DLPDose.compute({ dlp: "1", body_region: region, age_group: age });
      const match = /^([0-9.]+) mSv\/\(mGy·cm\)$/.exec(result["K-Factor Used"] ?? "");
      assert.ok(match, `${region}/${age}: runtime K-Factor Used is missing`);
      return [age, Number(match[1])];
    }),
  ]);
}

function assertInterpretationBoundary(result, label) {
  assert.equal(result.Error, undefined, `${label}: unexpected error ${result.Error}`);
  assert.equal(result.Interpretation, RUNTIME_INTERPRETATION, `${label}: Interpretation drifted`);
  assert.ok(!Object.hasOwn(result, REMOVED_RISK_FIELD), `${label}: removed lifetime-risk field is back`);
  assert.doesNotMatch(
    JSON.stringify(result),
    /negligible|\d[\d.]*\s*%|lifetime cancer risk/i,
    `${label}: runtime output asserts a numerical or negligible cancer risk`,
  );
}

function verifyRuntime(table3Chest) {
  const bindings = {};

  // Every clause of the Interpretation text is bound to a source claim.
  const clauses = CLAIM_BINDINGS.filter((binding) => binding.runtime_field === "Interpretation");
  assert.equal(
    `${clauses[0].runtime_text} ${clauses[1].runtime_text}; ${clauses[2].runtime_text}`,
    RUNTIME_INTERPRETATION,
    "every Interpretation clause must be bound to a source claim",
  );

  // All 55 region x age cells at DLP 500, plus the boundary vectors.
  const table = runtimeKTable();
  const cells = table.flatMap(([, row]) => row).length;
  assert.equal(cells, 55, "runtime coefficient table must have 11 regions x 5 ages");
  const kTableSha256 = sha256(JSON.stringify(table));
  assert.equal(
    kTableSha256,
    EXPECTED_RUNTIME_K_TABLE_SHA256,
    "runtime k-factor table changed; a coefficient change needs its own source audit",
  );
  for (const [region, row] of table) {
    for (const [age, k] of row) {
      const result = DLPDose.compute({ dlp: "500", body_region: region, age_group: age });
      assertInterpretationBoundary(result, `${region}/${age}`);
      assert.equal(result["Effective Dose"], `${(500 * k).toFixed(2)} mSv`, `${region}/${age}: E = k x DLP`);
    }
  }
  for (const vector of BOUNDARY_VECTORS) {
    const result = DLPDose.compute({ ...vector.inputs });
    assertInterpretationBoundary(result, vector.id);
    assert.equal(result["Effective Dose"], vector.effective_dose, `${vector.id}: Effective Dose`);
  }
  bindings["removed-numerical-lifetime-cancer-risk"] = {
    removed_field_absent: true,
    percent_or_negligible_absent: true,
    cells_checked: cells,
    boundary_vector_ids: BOUNDARY_VECTORS.map((vector) => vector.id),
  };

  // ICRP 147 reference and locator.
  const icrp147Refs = DLPDose.refs.filter((ref) => ref.u === SOURCES.icrp147.url);
  assert.equal(icrp147Refs.length, 1, "calculator must cite the audited ICRP 147 page exactly once");
  assert.equal(icrp147Refs[0].t, RUNTIME_ICRP147_REFERENCE, "ICRP 147 reference label drifted");
  for (const part of [
    "ICRP Publication 147",
    "Use of dose quantities in radiological protection",
    "2021;50(1)",
    "Executive summary (f)-(g)",
  ]) {
    assert.ok(icrp147Refs[0].t.includes(part), `ICRP 147 reference lacks ${JSON.stringify(part)}`);
  }
  assert.ok(
    DLPDose.refs.some((ref) => ref.u === RUNTIME_ICRP103_REFERENCE_URL),
    "calculator must keep the ICRP 103 DOI reference",
  );
  assert.ok(
    DLPDose.refs.some((ref) => ref.u === SOURCES.aapm96.url),
    "calculator must keep the AAPM Report 96 reference",
  );
  bindings["icrp147-reference-and-locator"] = { reference_url: SOURCES.icrp147.url, label_match: true };

  // Explicit age stratum: the five runtime strata are the five Table 3 columns, every region's
  // adult coefficient differs from each pediatric one, and missing/unknown ages fail closed.
  const runtimeAges = DLPDose.fields
    .find((field) => field.id === "age_group")
    .opts.map(({ value, label }) => `${value}|${label}`)
    .sort();
  assert.deepEqual(
    runtimeAges,
    AGE_STRATA.map(({ value, label }) => `${value}|${label}`).sort(),
    "runtime age strata must match the Table 3 age columns",
  );
  for (const [region, row] of table) {
    const byAge = new Map(row);
    for (const stratum of AGE_STRATA.filter(({ value }) => value !== "adult")) {
      assert.notEqual(
        byAge.get(stratum.value),
        byAge.get("adult"),
        `${region}/${stratum.value}: an adult fallback would not change the coefficient`,
      );
    }
  }
  const invalidAges = [undefined, "", "invalid", null, 5, "Adult", "toString", "__proto__"];
  for (const age_group of invalidAges) {
    const result = DLPDose.compute({ dlp: "500", body_region: "chest", age_group });
    assert.equal(result.Error, RUNTIME_AGE_ERROR, `age ${String(age_group)} must fail closed`);
    assert.equal(result["Effective Dose"], undefined, `age ${String(age_group)} must not emit a dose`);
    assert.equal(result.Interpretation, undefined, `age ${String(age_group)} must not emit an interpretation`);
  }
  bindings["explicit-age-stratum-required"] = {
    runtime_strata: AGE_STRATA.map(({ value, table3_column }) => ({ value, table3_column })),
    invalid_ages_rejected: invalidAges.length,
    adult_fallback_would_change_every_region: true,
  };

  // Unchanged adult chest conversion: AAPM 96 Table 3 chest/adult and Eq. 12.
  const adultChest = Object.fromEntries(table)["chest"].find(([age]) => age === "adult")[1];
  assert.equal(table3Chest.Adult, 0.014, "aapm96: Table 3 adult chest k drifted");
  assert.equal(adultChest, table3Chest.Adult, "runtime adult chest k differs from AAPM 96 Table 3");
  const chestResult = DLPDose.compute({ dlp: "500", body_region: "chest", age_group: "adult" });
  assert.equal(chestResult["Effective Dose"], "7.00 mSv", "500 mGy·cm x 0.014 must remain 7.00 mSv");
  bindings["adult-chest-conversion-unchanged"] = {
    table3_chest_adult_k: table3Chest.Adult,
    runtime_chest_adult_k: adultChest,
    vector_id: "aapm96-adult-chest-dlp-500",
    effective_dose: chestResult["Effective Dose"],
  };

  for (const clause of clauses) {
    bindings[clause.claim_id] = { runtime_field: "Interpretation", runtime_text: clause.runtime_text };
  }

  // App-owned data-entry guardrails (provenance only, not source claims).
  for (const vector of APP_INPUT_GUARDRAIL_VECTORS) {
    const result = DLPDose.compute({ dlp: vector.dlp, body_region: "chest", age_group: "adult" });
    assert.ok(result.Error, `${vector.id}: must be rejected`);
    assert.equal(result["Effective Dose"], undefined, `${vector.id}: must not emit a dose`);
  }

  return { bindings, kTableSha256, cells };
}

function verifyCalculatorSource(calculatorSource) {
  for (const removed of [REMOVED_RISK_FIELD, "lifetimeRiskPercent", "negligible at population level", "* 5 * 100"]) {
    assert.ok(!calculatorSource.includes(removed), `calculator source still contains ${JSON.stringify(removed)}`);
  }
  assert.ok(
    calculatorSource.includes(JSON.stringify(RUNTIME_INTERPRETATION)),
    "calculator source must hold the audited Interpretation literal",
  );
}

async function main() {
  const [icrp147Retrieved, icrp103Retrieved, aapm96Retrieved, calculatorSource] = await Promise.all([
    retrieve(SOURCES.icrp147),
    retrieve(SOURCES.icrp103),
    retrieve(SOURCES.aapm96),
    readFile(CALCULATOR_PATH, "utf8"),
  ]);

  const mismatches = [];
  const icrp147 = verifyIcrp147(icrp147Retrieved, mismatches);

  for (const [source, retrieved] of [
    [SOURCES.icrp103, icrp103Retrieved],
    [SOURCES.aapm96, aapm96Retrieved],
  ]) {
    assertArtifactIdentity(source, retrieved);
    assertRawBytePin(source, retrieved);
  }
  const icrp103Pages = await pdfPages(SOURCES.icrp103, icrp103Retrieved.bytes);
  verifyIcrp103Continuity(icrp103Pages);
  const aapm96Pages = await pdfPages(SOURCES.aapm96, aapm96Retrieved.bytes);
  const table3Chest = parseTable3ChestRow(aapm96Pages);

  const verified = new Map([
    ...icrp147.verified,
    ...verifyPdfStatements(SOURCES.icrp103, icrp103Pages, mismatches),
    ...verifyPdfStatements(SOURCES.aapm96, aapm96Pages, mismatches),
  ]);
  assert.equal(
    mismatches.length,
    0,
    `pinned source spans drifted (re-review each statement at its locator before re-pinning):\n${JSON.stringify(mismatches, null, 2)}`,
  );
  verified.set("aapm96-table3-chest-row", {
    id: "aapm96-table3-chest-row",
    source: "aapm96",
    pdf_page: 19,
    printed_page: 13,
    locator: "Table 3, Chest row",
    paraphrase: "Chest conversion factors by age column, parsed from the table.",
    values: { ...table3Chest },
  });

  const boundStatementIds = new Set(CLAIM_BINDINGS.flatMap((binding) => binding.source_statement_ids));
  for (const binding of CLAIM_BINDINGS) {
    for (const statementId of binding.source_statement_ids) {
      assert.ok(verified.has(statementId), `${binding.claim_id}: source statement ${statementId} is not verified`);
    }
  }
  for (const statementId of verified.keys()) {
    if (statementId.endsWith("-identity")) continue;
    assert.ok(boundStatementIds.has(statementId), `${statementId}: verified statement has no runtime binding`);
  }

  verifyCalculatorSource(calculatorSource);
  const runtime = verifyRuntime(table3Chest);
  for (const binding of CLAIM_BINDINGS) {
    assert.ok(runtime.bindings[binding.claim_id], `${binding.claim_id}: runtime binding was not exercised`);
  }

  const audit = {
    schema: "radulator-dlp-primary-source-audit/v1",
    calculator_id: DLPDose.id,
    calculator_path: CALCULATOR_PATH,
    sources: Object.values(SOURCES).map((source) => ({
      key: source.key,
      authority: source.authority,
      document: source.document,
      ...(source.doi ? { doi: source.doi, pmid: source.pmid } : {}),
      url: source.url,
      final_url: {
        icrp147: icrp147Retrieved,
        icrp103: icrp103Retrieved,
        aapm96: aapm96Retrieved,
      }[source.key].finalUrl.href,
      media_type: source.media_type,
      pin: source.pin,
      ...(source.pin === "publication-column-text"
        ? {
            pin_rationale: source.pin_rationale,
            content_sha256: icrp147.contentSha256,
            content_blocks: icrp147.blockCount,
            content_digest_basis: source.content_digest_basis,
            observed_raw: icrp147.observedRaw,
          }
        : { bytes: source.bytes, sha256: source.sha256, pages: source.pages }),
    })),
    source_statements: [...verified.values()],
    claim_bindings: CLAIM_BINDINGS.map((binding) => ({
      claim_id: binding.claim_id,
      source_statement_ids: [...binding.source_statement_ids],
      runtime: runtime.bindings[binding.claim_id],
    })),
    runtime: {
      interpretation: RUNTIME_INTERPRETATION,
      icrp147_reference: RUNTIME_ICRP147_REFERENCE,
      removed_field: REMOVED_RISK_FIELD,
      k_table_cells: runtime.cells,
      k_table_sha256: runtime.kTableSha256,
      boundary_vector_ids: BOUNDARY_VECTORS.map((vector) => vector.id),
    },
    app_input_guardrails: {
      provenance: "radulator-data-entry-guardrail",
      publication_derived: false,
      rejected_vector_ids: APP_INPUT_GUARDRAIL_VECTORS.map((vector) => vector.id),
    },
    scope: {
      coefficient_table_changed: false,
      not_asserted: [
        "pediatric k-factor source fidelity",
        "phantom-basis disclosure",
        "typical DLP ranges and Dose Alert policy",
        "whole-calculator clinical acceptance",
      ],
    },
    source_bytes_committed: false,
  };

  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(audit)}\n`);
  } else {
    console.log(
      `DLP primary-source audit passed: 3 pinned artifacts, ${verified.size} source statements, ${CLAIM_BINDINGS.length} runtime claim bindings, ${runtime.cells} coefficient cells and ${BOUNDARY_VECTORS.length} boundary vectors.`,
    );
  }
}

await main();
