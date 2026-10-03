#!/usr/bin/env node

/**
 * Mehran CIN (original 2004 PCI score) primary-source audit.
 *
 * Retrieves five official or primary source artifacts at the exact head and verifies each one
 * as bytes before anything is parsed: final URL (HTTPS host, path and query), media type, exact
 * byte length and SHA-256. A response that misses any of these pins is a changed source and
 * fails at once, without a retry; only transport failures are retried. Every cited source
 * statement is then pinned by the length and SHA-256 of its exact normalized text span inside an
 * explicit section, anchor or page locator, and every changed clinical claim in MehranCIN.jsx is
 * bound to runtime output at explicit vectors, including the Table 15 score boundaries and the
 * published risk-band extremes. Nothing falls back to a secondary source.
 *
 * Sources, all pinned by their raw response bytes:
 * - PubMed 15464318 and 34793743, one request per record, as PubMed's plain-text abstract
 *   (efetch rettype=abstract, retmode=text). The text form carries no DTD header or retrieval
 *   metadata, so its bytes change only when the record itself changes.
 * - KDIGO 2012 AKI guideline Section 4 as PMC XML (efetch db=pmc).
 * - ESUR Guidelines on Contrast Media, B. Renal adverse reactions (HTML page).
 * - ACR Manual on Contrast Media 2026 (PDF).
 *
 * Statement pins: a span runs from a start marker, unique in its locator, through the first
 * following end marker, inclusive. Markers are at most six words and only locate the span; the
 * audit pins the span's length and SHA-256, so it verifies the literal source text at head
 * without republishing it. Each statement's paraphrase is Radulator's own summary; open the
 * source at the locator to read the statement itself. Titles and identifiers are compared
 * directly, and Table 15 is parsed into its numbers.
 *
 * Normalizers: PubMed text is NFKC-normalized with whitespace collapsed. XML and HTML use
 * markupText (tags removed, inline tags without a space, citation superscripts dropped,
 * entities decoded, whitespace collapsed, case preserved). ACR PDF text uses compactPdfText
 * (NFKC, folded quotes and hyphens, lower case, all whitespace removed, because the PDF text
 * layer splits words).
 *
 * The steps are exported so the exact-head test can prove that each check fails when its source
 * bytes, response, statement text, parsed table or runtime changes. Source bytes and source text
 * are never committed.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getDocument, version as pdfjsVersion } from "pdfjs-dist/legacy/build/pdf.mjs";

export const SCHEMA = "radulator-mehran-primary-source-audit/v2";
export const CALCULATOR_PATH = "src/components/calculators/MehranCIN.jsx";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER_AGENT = "Radulator-Mehran-primary-source-audit/2";
export const FETCH_ATTEMPTS = 4;
const FETCH_MAX_DELAY_MS = 8_000;
const FETCH_SPACING_MS = 1_100; // stay well below the anonymous NCBI E-utilities limit (3 requests/s)
const TRANSIENT_HTTP_STATUSES = Object.freeze([408, 425, 429, 500, 502, 503, 504]);
const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const PRIMARY_DOI_URL = "https://doi.org/10.1016/j.jacc.2004.06.068";
const ESUR_REFERENCE_URL = "https://esur-cm.org/index.php/en/b-renal-adverse-reactions";
const KDIGO_REFERENCE_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC4089629/";
const ACR_PDF_PAGE_OFFSET = 3;
const ACR_EDITION_PAGE = 2; // PDF page 1 is an image-only cover
export const PDF_PARSER = "pdfjs-dist@4.10.38"; // package-lock.json pin
const MARKUP_PARSER = "scripts/audit-mehran-primary-source.mjs markupText (deterministic tag/entity normalizer)";
const TEXT_PARSER = "scripts/audit-mehran-primary-source.mjs parseRecordText (PubMed plain-text abstract blocks)";

// Every source is pinned by the exact bytes of its response.
export const SOURCES = Object.freeze({
  "pubmed-15464318": Object.freeze({
    key: "pubmed-15464318",
    kind: "pubmed-text",
    authority: "U.S. National Library of Medicine (PubMed)",
    title: "PubMed 15464318: Mehran et al., J Am Coll Cardiol 2004;44(7):1393-9 (plain-text abstract)",
    pmid: "15464318",
    citation: "J Am Coll Cardiol. 2004 Oct 6;44(7):1393-9.",
    doi: "10.1016/j.jacc.2004.06.068",
    url: `${EFETCH}?db=pubmed&id=15464318&rettype=abstract&retmode=text&tool=radulator-mehran-audit`,
    // NCBI E-utilities occasionally answers a fixed, valid query with a transient 400.
    retry_http_statuses: Object.freeze([400]),
    media_type: "text/plain",
    bytes: 2_301,
    sha256: "1909b4329e81cab7dc1a9bb8085e4c0452f71f60bc9f689e470acc4a3a8b022d",
  }),
  "pubmed-34793743": Object.freeze({
    key: "pubmed-34793743",
    kind: "pubmed-text",
    authority: "U.S. National Library of Medicine (PubMed)",
    title: "PubMed 34793743: Mehran et al., Lancet 2021;398(10315):1974-83 (plain-text abstract)",
    pmid: "34793743",
    citation: "Lancet. 2021 Nov 27;398(10315):1974-1983.",
    doi: "10.1016/S0140-6736(21)02326-6",
    url: `${EFETCH}?db=pubmed&id=34793743&rettype=abstract&retmode=text&tool=radulator-mehran-audit`,
    retry_http_statuses: Object.freeze([400]),
    media_type: "text/plain",
    bytes: 5_570,
    sha256: "9117f0f184abef66e82e5ac1228dcc0c0dbf36a52460f4b07366556eea3a0861",
  }),
  kdigo: Object.freeze({
    key: "kdigo",
    kind: "pmc-xml",
    authority: "Kidney Disease: Improving Global Outcomes (KDIGO)",
    title:
      "KDIGO Clinical Practice Guideline for Acute Kidney Injury (2012), Section 4: Contrast-induced AKI. Kidney Int Suppl 2012;2:69-88 (PMC4089629)",
    url: `${EFETCH}?db=pmc&id=4089629&retmode=xml`,
    retry_http_statuses: Object.freeze([400]),
    media_type: "text/xml",
    bytes: 272_094,
    sha256: "b8775bd178b990bc0e6dd38e60fd03ffd0cee9ebf63f021bacc4eeb18ed77e22",
  }),
  esur: Object.freeze({
    key: "esur",
    kind: "html",
    authority: "European Society of Urogenital Radiology (ESUR)",
    title: "ESUR Guidelines on Contrast Media, B. Renal adverse reactions (PC-AKI)",
    url: ESUR_REFERENCE_URL,
    retry_http_statuses: Object.freeze([]),
    media_type: "text/html",
    bytes: 44_070,
    sha256: "982259b9506a813557468a17855c4cb97afe791e3af52a943980bd01290a9f4d",
  }),
  acr: Object.freeze({
    key: "acr",
    kind: "pdf",
    authority: "American College of Radiology (ACR)",
    title: "ACR Manual on Contrast Media 2026 (official PDF)",
    url: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/ACR-Manual-on-Contrast-Media.pdf",
    retry_http_statuses: Object.freeze([]),
    media_type: "application/pdf",
    bytes: 1_765_419,
    sha256: "24bfacd3344310d1546636f50aabba11d6458f432b3c8b1205d9c63efe751be2",
  }),
});
export const SOURCE_KEYS = Object.freeze(Object.keys(SOURCES));
const PUBMED_SOURCE_BY_PMID = Object.freeze({ 15464318: "pubmed-15464318", 34793743: "pubmed-34793743" });

/**
 * Source statements, pinned without republishing source text. Span statements are checked
 * inside their locator: PubMed labelled abstract section; KDIGO <sec> with the given title
 * (balanced); ESUR text between the named anchor and the next anchor; ACR single PDF page
 * (printed page = PDF page - 3, checked against the running header). Identity statements
 * compare a title or DOI; the Table 15 statement is verified by parsing the table.
 */
export const SOURCE_STATEMENTS = Object.freeze([
  Object.freeze({
    id: "pm2004-title",
    source: "pubmed",
    locator: { pmid: "15464318", field: "title" },
    paraphrase: "Bibliographic title of the 2004 Mehran score development and initial validation paper.",
    identity: "A simple risk score for prediction of contrast-induced nephropathy after percutaneous coronary intervention: development and initial validation.",
  }),
  Object.freeze({
    id: "pm2004-doi",
    source: "pubmed",
    locator: { pmid: "15464318", field: "doi" },
    paraphrase: "The PubMed record's DOI for the 2004 paper.",
    identity: "10.1016/j.jacc.2004.06.068",
  }),
  Object.freeze({
    id: "pm2004-objective-pci",
    source: "pubmed",
    locator: { pmid: "15464318", label: "OBJECTIVES" },
    paraphrase: "The study set out to build a simple CIN risk score for patients undergoing PCI.",
    spans: [
      { from: "We sought to", to: "intervention (PCI).", length: 126, sha256: "4d991636b3e816d855a57f280c78ced76229a5456e4a0041fbbe9698bdf8c4e4" },
    ],
  }),
  Object.freeze({
    id: "pm2004-procedural-candidates-and-endpoint",
    source: "pubmed",
    locator: { pmid: "15464318", label: "METHODS" },
    paraphrase: "Procedural as well as baseline characteristics were candidate predictors; CIN meant a creatinine rise of >=25% and/or >=0.5 mg/dL at 48 h after PCI.",
    spans: [
      { from: "The baseline clinical", to: "vs. baseline).", length: 251, sha256: "8dd9c819fa50b52a68019f98e886396a4698719f2049cde0c9c72fe48c6c10ab" },
    ],
  }),
  Object.freeze({
    id: "pm2004-eight-variables",
    source: "pubmed",
    locator: { pmid: "15464318", label: "METHODS" },
    paraphrase: "Eight predictors, including IABP use and contrast volume, got integer weights that add up to each patient's score.",
    spans: [
      { from: "Based on the", to: "each patient.", length: 298, sha256: "414859d309d832c49a30b7cf2085d85ec80ec2f3865db0eb184fe4d393ecbdee" },
    ],
  }),
  Object.freeze({
    id: "pm2004-development-rates",
    source: "pubmed",
    locator: { pmid: "15464318", label: "RESULTS" },
    paraphrase: "Development cohort: CIN 13.1% overall, 7.5% at scores <=5 and 57.3% at scores >=16.",
    spans: [
      { from: "The overall occurrence", to: "score, respectively)", length: 145, sha256: "16dc8ae7af9296c3a1b1357e3ec27e1f24c14fc8acf10d4eca70eddc9f5ce645" },
    ],
  }),
  Object.freeze({
    id: "pm2004-validation-rates",
    source: "pubmed",
    locator: { pmid: "15464318", label: "RESULTS" },
    paraphrase: "Validation cohort (n=2,786): c-statistic 0.67; CIN 8.4% in the low and 55.9% in the high score group.",
    spans: [
      { from: "In the 2,786", to: "score, respectively).", length: 251, sha256: "563f1ededa9b85509f39a6de5380e920fb27dc6a6dfdd5853698671b64e4f43b" },
    ],
  }),
  Object.freeze({
    id: "pm2021-title",
    source: "pubmed",
    locator: { pmid: "34793743", field: "title" },
    paraphrase: "Bibliographic title of the 2021 contemporary Mehran PCI score paper.",
    identity: "A contemporary simple risk score for prediction of contrast-associated acute kidney injury after percutaneous coronary intervention: derivation and validation from an observational registry.",
  }),
  Object.freeze({
    id: "pm2021-contemporary-cohort",
    source: "pubmed",
    locator: { pmid: "34793743", label: "METHODS" },
    paraphrase: "The 2021 score was derived from consecutive PCI patients treated from 2012 to 2020 at one tertiary centre.",
    spans: [
      { from: "Consecutive patients undergoing", to: "were included", length: 208, sha256: "7af8ac3011af7136674dbabde8e09e133d5799665e465ea84839c5ca6d07d558" },
    ],
  }),
  Object.freeze({
    id: "pm2021-pre-procedural-vs-procedural-models",
    source: "pubmed",
    locator: { pmid: "34793743", label: "METHODS" },
    paraphrase: "The 2021 score has a pre-procedure model and a second model that adds procedural variables.",
    spans: [
      { from: "Model 1 included", to: "procedural variables.", length: 99, sha256: "f15dbddbac388e62c2d2e788b768e73f9ab7d578a2d4cd9c1c5c28ff4279a393" },
    ],
  }),
  Object.freeze({
    id: "pm2021-different-predictors",
    source: "pubmed",
    locator: { pmid: "34793743", label: "FINDINGS" },
    paraphrase: "The 2021 pre-procedure model uses different predictors (e.g. presentation, eGFR, LVEF, haemoglobin, glucose) from the 2004 set.",
    spans: [
      { from: "Independent predictors of", to: "and age.", length: 261, sha256: "2c6705dde8465d1978fce79f450489816c34f75e70c64deff85afdab8532bbc4" },
    ],
  }),
  Object.freeze({
    id: "kdigo-4.2.1-assess-risk-and-kidney-function",
    source: "kdigo",
    locator: { section: "Chapter 4.2: Assessment of the population at risk for CI-AKI" },
    paraphrase: "Ungraded recommendation 4.2.1: before any intravascular (IV or IA) iodinated contrast procedure, assess CI-AKI risk and screen for existing kidney impairment.",
    spans: [
      { from: "4.2.1: Assess the", to: "(Not Graded)", length: 259, sha256: "4623cc061deb09384992e204df309178e06ab4077bfbc7cab46c624e0098885b" },
    ],
  }),
  Object.freeze({
    id: "kdigo-pci-risk-models",
    source: "kdigo",
    locator: { section: "Risk models of CI-AKI" },
    paraphrase: "Validated CI-AKI prediction models built from patient and procedural factors exist for PCI; KDIGO reproduces the Mehran model as Table 15.",
    spans: [
      { from: "Validated risk-prediction models", to: "Table 15.", length: 232, sha256: "8a96fa27bc5664beb30d7a8d4b2c368de65a195ded45e70596857e0cc7b23602" },
    ],
  }),
  Object.freeze({
    id: "kdigo-mehran-development-rates",
    source: "kdigo",
    locator: { section: "Risk models of CI-AKI" },
    paraphrase: "KDIGO restates the Mehran development rates: 13.1% overall, 7.5% at <=5 and 57.3% at >=16.",
    spans: [
      { from: "The overall occurrence", to: "score, respectively)", length: 155, sha256: "dcf7ac7787df47ae120b71dce03384b6766eef947d01d75dca5c420de19267ed" },
    ],
  }),
  Object.freeze({
    id: "kdigo-risk-model-role",
    source: "kdigo",
    locator: { section: "Risk models of CI-AKI" },
    paraphrase: "KDIGO presents such models as aids to risk counselling, choosing prophylaxis and describing study populations.",
    spans: [
      { from: "These models can", to: "of CI-AKI.", length: 175, sha256: "689ce7d8fc3fc714039a66bb861433420f024229f4d4fe8642247598f8b76d47" },
    ],
  }),
  Object.freeze({
    id: "kdigo-table-15",
    source: "kdigo",
    locator: { table: "tbl15" },
    paraphrase: "Integer weights: hypotension 5, IABP 5, CHF 5, age >75 4, anemia 3, diabetes 3, contrast 1 per 100 mL, and either SCr >1.5 mg/dL 4 or eGFR 40-60/20-39/<20 scoring 2/4/6.",
    table: true,
  }),
  Object.freeze({
    id: "kdigo-4.3.1-lowest-possible-dose",
    source: "kdigo",
    locator: { section: "DOSE/VOLUME OF CONTRAST-MEDIA ADMINISTRATION" },
    paraphrase: "Ungraded recommendation 4.3.1: give patients at risk the lowest possible contrast dose.",
    spans: [
      { from: "4.3.1: Use the", to: "(Not Graded)", length: 99, sha256: "a967cec116e570a09573cc12277638a8a57c5a40ece7a601eca91bf48e27403e" },
    ],
  }),
  Object.freeze({
    id: "kdigo-arterial-vs-venous-route",
    source: "kdigo",
    locator: { section: "Route of administration of contrast media" },
    paraphrase: "CI-AKI risk appears higher after arterial than after venous contrast administration.",
    spans: [
      { from: "The risk of", to: "contrast media.", length: 108, sha256: "704187d1a1f92703ce30ede479476337010dac7727143b5bd25ee2421b7d3bcd" },
    ],
  }),
  Object.freeze({
    id: "kdigo-4.4.1-volume-expansion",
    source: "kdigo",
    locator: { section: "FLUID ADMINISTRATION" },
    paraphrase: "Grade 1A recommendation 4.4.1: at-risk patients should get IV volume expansion with isotonic saline or bicarbonate rather than none.",
    spans: [
      { from: "4.4.1: We recommend", to: "CI-AKI. (1A)", length: 196, sha256: "6136dbc2a23c81900ddb7c2c3c7c713c4cb9b0051ae161802d6ca1e0966d4c77" },
    ],
  }),
  Object.freeze({
    id: "kdigo-4.5.1-no-prophylactic-dialysis",
    source: "kdigo",
    locator: { section: "Chapter 4.5: Effects of hemodialysis or hemofiltration" },
    paraphrase: "Grade 2C suggestion 4.5.1: do not use prophylactic haemodialysis or haemofiltration to clear contrast in at-risk patients.",
    spans: [
      { from: "4.5.1: We suggest", to: "CI-AKI. (2C)", length: 169, sha256: "5bf1fef834b75cffc1f0f3cb159eeeb3151e0da21226f8fd555d864faf2a172c" },
    ],
  }),
  Object.freeze({
    id: "esur-b1-ckd-epi-needs-age-and-sex",
    source: "esur",
    locator: { anchor: "B_1" },
    paraphrase: "ESUR recommends the CKD-EPI equation for adult eGFR; its published forms are sex-specific and take age as an input.",
    spans: [
      { from: "In adults >", to: "calculate eGFR.", length: 74, sha256: "deb735d3d5e38bd256eb25ac857e80dd045c2ae5cc865930e740aca42c3b7490" },
      { from: "Female sCr <", to: "x 0.993Age", length: 57, sha256: "d496531527adc35156b29d80c92a78a936b89a1c6965540d4bcd9bb7400bf5d0" },
      { from: "Male sCr <", to: "x 0.993Age", length: 55, sha256: "e474bafeaac301ac166d610531e0d90dff2189195052e07bbf57c39ad8b28cc6" },
      { from: "(sCr in µmol/l; age", to: "in years)", length: 29, sha256: "9917a1bcf113b22a13d628e035eed249397b4b001b139e050d0b53db72fdfed6" },
    ],
  }),
  Object.freeze({
    id: "esur-b2-route-and-aki-risk-factors",
    source: "esur",
    locator: { anchor: "B_2" },
    paraphrase: "PC-AKI risk factors depend on route: eGFR <45 before first-pass intra-arterial exposure (or in ICU), eGFR <30 before IV or second-pass exposure, known or suspected AKI, and first-pass intra-arterial delivery itself.",
    spans: [
      { from: "eGFR less than 45", to: "ICU patients.", length: 136, sha256: "c6b71dd4b3a7f524b7daaecc385ae4156e1b969a9bb0875aeb2e9f2b6ffd9596" },
      { from: "eGFR less than 30", to: "renal exposure.", length: 149, sha256: "5224c9efefe4f4e7c795e79cb887b6fdcf04e601345c5923ed97341db9f3cc92" },
      { from: "Known or suspected", to: "renal failure.", length: 39, sha256: "1ad554b3725fb83b273bace244e18543b6be8ad7878ed39424a394b4244e721f" },
      { from: "Procedure related Intra-arterial", to: "renal exposure.", length: 95, sha256: "92f74f44ae1390868e37164e6a1d6cd4d72acb82f38c5cdc096af9b410494e7a" },
    ],
  }),
  Object.freeze({
    id: "esur-b2.2-route-specific-hydration",
    source: "esur",
    locator: { anchor: "B_2_2" },
    paraphrase: "ESUR hydration regimens are organised by exposure route (IV or second-pass versus first-pass intra-arterial), not by a risk score.",
    spans: [
      { from: "For intravenous contrast", to: "the patient", length: 133, sha256: "1c4bd715f594356a4a59c581e9c2e7b883265b2e461a8cbb9409c92bdd643744" },
      { from: "For intra-arterial contrast", to: "the patient", length: 100, sha256: "84458d76c3c127cf7cad9d65e135a3ea21fe9d03158eb8999fb96f060193e50c" },
    ],
  }),
  Object.freeze({
    id: "esur-b2.2-individualize-hydration-severe-chf",
    source: "esur",
    locator: { anchor: "B_2_2" },
    paraphrase: "The responsible clinician should tailor preventive hydration in severe heart failure (NYHA 3-4) or end-stage renal failure (eGFR <15).",
    spans: [
      { from: "The clinician responsible", to: "ml/min/1.73 m2).", length: 219, sha256: "978c7d7451e48b5118b05c398686bbd859c1f6c321bfd969f06b4dee53e410e6" },
    ],
  }),
  Object.freeze({
    id: "esur-b2.3-lowest-diagnostic-dose",
    source: "esur",
    locator: { anchor: "B_2_3" },
    paraphrase: "Use the smallest contrast dose that still gives a diagnostic result.",
    spans: [
      { from: "Use the lowest", to: "diagnostic result.", length: 75, sha256: "6350b94efcc823d9c1deaf171d23712a637e1ba2528b57efb34aa2417dd63e7e" },
    ],
  }),
  Object.freeze({
    id: "esur-b2.3-first-pass-ratio-only",
    source: "esur",
    locator: { anchor: "B_2_3" },
    paraphrase: "Dose-to-eGFR ratio limits (<1.1 g iodine per mL/min, or volume/eGFR <3.0 at 350 mgI/mL) are stated only for first-pass intra-arterial exposure.",
    spans: [
      { from: "For intra-arterial contrast", to: "350 mgl/ml.", length: 278, sha256: "a8921a91f8445b2a13c680326d7c024a13186a050f32ea8f672477e5ed034b1b" },
    ],
  }),
  Object.freeze({
    id: "esur-b4.1-metformin-by-egfr-route-aki",
    source: "esur",
    locator: { anchor: "B_4_1" },
    paraphrase: "Metformin continues when eGFR >30 without AKI for IV or second-pass exposure and is stopped at contrast time with AKI; the rule keys on eGFR, AKI and route.",
    spans: [
      { from: "Patients with eGFR", to: "metformin normally.", length: 210, sha256: "f09fbd9f4a451a4a98fcb6fdf4793d95309b3c2f486d033690d5cee143a56a9e" },
      { from: "(c) With AKI:", to: "medium administration.", length: 84, sha256: "1d36186fe6a2eebfc95fcc187bd01bf385a35d08eed31e75cb197f4a1df37d31" },
    ],
  }),
  Object.freeze({
    id: "esur-b5-dialysis-not-protective",
    source: "esur",
    locator: { anchor: "B_5" },
    paraphrase: "No evidence supports haemodialysis as protection against PC-AKI; patients already on haemodialysis need no timing change or extra session for iodinated contrast.",
    spans: [
      { from: "However, there is", to: "systemic fibrosis.", length: 167, sha256: "7b6529142afa0d62bd48683a253fb2a3cde5102da41139c0527d037e928fbca7" },
      { from: "Patients on hemodialysis Iodine-based contrast medium", to: "contrast medium is unnecessary.", length: 221, sha256: "cef571daaf8860619097c04bc33b2e4d7d332b4444f64473fdf2c7d002585894" },
    ],
  }),
  Object.freeze({
    id: "esur-b5-avoid-fluid-overload",
    source: "esur",
    locator: { anchor: "B_5" },
    paraphrase: "Guard against osmotic load and fluid overload in all patients.",
    spans: [
      { from: "In all patients,", to: "fluid overload.", length: 50, sha256: "eafe068d1646bf934eca9ebe7e88695419b8d8c80ffe5744c8551213449ca456" },
    ],
  }),
  Object.freeze({
    id: "acr-ca-aki-terminology",
    source: "acr",
    locator: { pdf_page: 42 },
    paraphrase: "ACR's CA-AKI means kidney-function deterioration within 48 h of intravascular iodinated contrast whether or not contrast caused it.",
    spans: [
      { from: "Contrast-associated acute kidney", to: "the deterioration", length: 329, sha256: "3fcc343be2fe8abb643ede5cab8831ac2106e68cd3ab93083f8bc12dc1e7fa0c" },
    ],
  }),
  Object.freeze({
    id: "acr-no-iv-dose-toxicity-relationship",
    source: "acr",
    locator: { pdf_page: 42 },
    paraphrase: "Toxicity may scale with dose in cardiac angiography, but no such dose relationship is shown for IV contrast at usual diagnostic doses.",
    spans: [
      { from: "The nephrotoxic effect", to: "diagnostic doses.", length: 212, sha256: "49c2d201a25e96f4e3e5f377e3865dd79e905bb5407125ec5a4cc00b6421bc34" },
    ],
  }),
  Object.freeze({
    id: "acr-cardiac-angiography-overestimates-iv-risk",
    source: "acr",
    locator: { pdf_page: 43 },
    paraphrase: "IV administration is not comparable to cardiac angiography, so risk figures from angiography studies probably overstate CI-AKI risk for IV contrast.",
    spans: [
      { from: "Cardiac angiography differs", to: "major ways", length: 75, sha256: "c69c901df02657309fdd1f6e2d9785e7d5806e73bae45bf2bba27907452f51d9" },
      { from: "Therefore, data from", to: "contrast-enhanced studies", length: 124, sha256: "68d87119b6dd2850a4a7bf45028a8d70fad2a02b8af984a36c706b77fdf983f2" },
    ],
  }),
  Object.freeze({
    id: "acr-aki-not-stratified-by-creatinine-or-egfr",
    source: "acr",
    locator: { pdf_page: 44 },
    paraphrase: "With AKI, creatinine is unreliable, so no creatinine or eGFR cut-off can stratify risk.",
    spans: [
      { from: "no serum creatinine", to: "is unreliable", length: 121, sha256: "966b621969ff45ad04b81d8a20b20f829a65fbe8e29194660bce19237891be49" },
    ],
  }),
  Object.freeze({
    id: "acr-no-absolute-renal-threshold",
    source: "acr",
    locator: { pdf_page: 44 },
    paraphrase: "No agreed creatinine or eGFR level exists beyond which intravascular iodinated contrast must never be given.",
    spans: [
      { from: "There is no", to: "be administered.", length: 183, sha256: "9cda3027aa20fd974d9bdbc5801b8209a0f9a8b455a11605b26dd58311848b7b" },
    ],
  }),
  Object.freeze({
    id: "acr-individualized-risk-benefit",
    source: "acr",
    locator: { pdf_page: 45 },
    paraphrase: "Prevention starts with considering other imaging and an individual risk-benefit judgement.",
    spans: [
      { from: "Consideration of alternative", to: "are fundamental.", length: 99, sha256: "8cf8008ea5a33261314353a05a2e9ed23d878d863d5793e8b32545d32d3f222a" },
    ],
  }),
  Object.freeze({
    id: "acr-no-contrast-volume-threshold",
    source: "acr",
    locator: { pdf_page: 46 },
    paraphrase: "ACR does not endorse a specific contrast-volume cap for further doses within 24 hours.",
    spans: [
      { from: "nor to recommend", to: "24-hour period", length: 124, sha256: "788280134f4ba1009b70d4fef98b360c6c713a38c95e274943c368f859593893" },
    ],
  }),
  Object.freeze({
    id: "acr-ideal-infusion-rate-unknown",
    source: "acr",
    locator: { pdf_page: 46 },
    paraphrase: "The best prophylactic infusion rate and volume are unknown; isotonic saline is the preferred fluid.",
    spans: [
      { from: "The ideal infusion", to: "is preferred.", length: 93, sha256: "0a793ae5b3916e048449cc8f8a183b3981500af6c79916e092785df7a9c50e5e" },
    ],
  }),
  Object.freeze({
    id: "acr-volume-expansion-heart-failure-risk",
    source: "acr",
    locator: { pdf_page: 46 },
    paraphrase: "Prophylaxis applies to AKI or eGFR <30, but heart failure and other hypervolaemic states must be weighed before volume expansion.",
    spans: [
      { from: "Prophylaxis is indicated", to: "before initiation", length: 203, sha256: "cdca3787053318be91a8bcb22c5aa5f6b3fb15e88cd938ae7b1e351c1e6ff523" },
    ],
  }),
  Object.freeze({
    id: "acr-no-dialysis-solely-for-contrast",
    source: "acr",
    locator: { pdf_page: 47 },
    paraphrase: "Do not start acute dialysis or CRRT, or change a dialysis schedule, only because iodinated contrast was given.",
    spans: [
      { from: "Patients should not", to: "of benefit", length: 208, sha256: "6cf0beef20ac8427ce6268c9f6950a6252eed093358cbde335e3bd6887ac3b80" },
    ],
  }),
  Object.freeze({
    id: "acr-metformin-categories-by-egfr",
    source: "acr",
    locator: { pdf_page: 51 },
    paraphrase: "ACR sorts metformin users into two categories by renal function measured as eGFR.",
    spans: [
      { from: "The Committee recommends", to: "by eGFR).", length: 134, sha256: "ce9aa7afa84801dc82ce0246561db91775caa955d5256d8c7acdc172067ff86e" },
    ],
  }),
  Object.freeze({
    id: "acr-metformin-category-ii",
    source: "acr",
    locator: { pdf_page: 52 },
    paraphrase: "Metformin is paused around the procedure for AKI, eGFR <30, or arterial catheter studies with possible renal emboli.",
    spans: [
      { from: "In patients taking metformin who", to: "the procedure", length: 291, sha256: "1a49ee15d1ed1c8e453fb19ce54e0b61200548299ddccf75d63b171b6a2542da" },
    ],
  }),
]);

const ACR_RUNNING_HEADERS = Object.freeze({
  42: "POST-CONTRAST ACUTE KIDNEY INJURY AND CONTRAST-INDUCED NEPHROPATHY IN ADULTS",
  43: "POST-CONTRAST ACUTE KIDNEY INJURY AND CONTRAST-INDUCED NEPHROPATHY IN ADULTS",
  44: "POST-CONTRAST ACUTE KIDNEY INJURY AND CONTRAST-INDUCED NEPHROPATHY IN ADULTS",
  45: "POST-CONTRAST ACUTE KIDNEY INJURY AND CONTRAST-INDUCED NEPHROPATHY IN ADULTS",
  46: "POST-CONTRAST ACUTE KIDNEY INJURY AND CONTRAST-INDUCED NEPHROPATHY IN ADULTS",
  47: "POST-CONTRAST ACUTE KIDNEY INJURY AND CONTRAST-INDUCED NEPHROPATHY IN ADULTS",
  51: "METFORMIN",
  52: "METFORMIN",
});

const EXPECTED_TABLE_15_ROWS = Object.freeze([
  ["Risk factors", "Integer score (calculate)"],
  ["Hypotension", "5"],
  ["IABP", "5"],
  ["CHF", "5"],
  ["Age >75 years", "4"],
  ["Anemia", "3"],
  ["Diabetes", "3"],
  ["Contrast-media volume", "1 per 100 ml"],
  ["SCr >1.5 mg/dl (>132.6 μmol/l)", "4"],
  ["or", ""],
  ["eGFR <60 ml/min per 1.73 m2", "2 for 40–60 4 for 20–39 6 for <20"],
]);

export const MAX_MARKER_WORDS = 6;
const TABLE_15_CAPTION = "CI-AKI risk-scoring model for percutaneous coronary intervention";
// Footnote shorthand is parsed into numbers; its exact text is pinned by digest only.
const EXPECTED_TABLE_15_FOOTNOTE = Object.freeze({
  low_below: 5,
  high_above: 16,
  length: 69,
  sha256: "186481efc6ba62754514c36e3618cab1d15dc4ca73db68d7a88932eac2e9c883",
});

// Source row label -> runtime checkbox field (the only hard-coded mapping; the
// weights themselves are read from the retrieved Table 15).
const TABLE_15_BINARY_FIELDS = Object.freeze([
  ["Hypotension", "hypotension", "Hypotension"],
  ["IABP", "iabp", "IABP"],
  ["CHF", "chf", "CHF"],
  ["Age >75 years", "age_over_75", "Age >75"],
  ["Anemia", "anemia", "Anemia"],
  ["Diabetes", "diabetes", "Diabetes"],
]);

const RUNTIME_FIELD_IDS_2004 = Object.freeze([
  "hypotension",
  "iabp",
  "chf",
  "age_over_75",
  "anemia",
  "diabetes",
  "creatinine",
  "egfr",
  "contrast_volume",
]);

export const PREVENTION_CONTEXT =
  "Assess renal function, acute kidney injury, contrast exposure route and volume status separately. Individualize hydration, especially in severe heart failure. This score does not prescribe hydration doses, medication holds, dialysis access or a safe contrast maximum.";
export const MODEL_SCOPE =
  "Original 2004 PCI score; displayed rates are historical cohort estimates, not an individual guarantee or general IV CT contrast clearance. Anticipated procedural inputs make the estimate conditional; update after the procedure.";

const RUNTIME_VECTORS = Object.freeze({
  "creatinine-1-contrast-100": { creatinine: "1", contrast_volume: "100" },
  "chf-iabp-diabetes-anemia-egfr19-contrast-100": {
    chf: true,
    iabp: true,
    diabetes: true,
    anemia: true,
    egfr: "19",
    contrast_volume: "100",
  },
  "all-factors-creatinine-2.5-egfr15-contrast-500": {
    hypotension: true,
    iabp: true,
    chf: true,
    age_over_75: true,
    anemia: true,
    diabetes: true,
    creatinine: "2.5",
    egfr: "15",
    contrast_volume: "500",
  },
  "creatinine-3-egfr30-contrast-0": { creatinine: "3", egfr: "30", contrast_volume: "0" },
  "creatinine-3-egfr60-contrast-0": { creatinine: "3", egfr: "60", contrast_volume: "0" },
  "egfr90-contrast-0": { egfr: "90", contrast_volume: "0" },
  "egfr90-contrast-blank": { egfr: "90", contrast_volume: "" },
});

const VALID_VECTOR_IDS = Object.freeze(
  Object.keys(RUNTIME_VECTORS).filter((id) => id !== "egfr90-contrast-blank"),
);

// Unsupported management outputs removed by this change; none may appear in any
// valid report or in the static info text.
const FORBIDDEN_OUTPUT_FIELDS = Object.freeze([
  "Estimated eGFR",
  "Prevention Recommendations",
  "Contrast Limits",
]);
const FORBIDDEN_OUTPUT_PATTERNS = Object.freeze([
  ["weight-based hydration dose", /mL\/kg/i],
  ["score-triggered medication hold", /\bhold (?:metformin|nephrotoxins?)\b|ACE inhibitors|\bARBs?\b/i],
  ["prophylactic renal replacement access", /renal replacement|prophylactic (?:dialysis|renal)/i],
  ["eGFR-multiple contrast limit", /Maximum:|Target:|eGFR\s*[×x]\s*\d|\d(?:\.\d+)?\s*[×x]\s*eGFR/i],
  ["iso-osmolar agent mandate", /iodixanol|iso-osmolar/i],
  ["delay or nephrology instruction", /delaying non-emergent|Nephrology consultation/i],
]);

/**
 * Changed clinical claims -> verbatim source statements -> runtime checks.
 * Runtime check kinds: "calculator-source" (MehranCIN.jsx text, e.g. the header
 * comment), "metadata" (static calculator text), "output" (compute()
 * result for a vector, or "*" for every valid vector), "absent" (field must be
 * missing), "error" (compute() must refuse with no clinical report).
 */
export const CLAIM_BINDINGS = Object.freeze([
  {
    claim: "original-2004-pci-derivation-scope",
    statements: ["pm2004-objective-pci", "pm2004-title", "kdigo-pci-risk-models", "kdigo-table-15"],
    runtime: [
      { kind: "calculator-source", includes: "Developed in a PCI population; not a general contrast-clearance tool" },
      { kind: "metadata", path: "desc", equals: "Original 2004 PCI contrast-associated kidney injury risk score" },
      { kind: "metadata", path: "guidelineVersion", equals: "Mehran Score (2004)" },
      { kind: "metadata", path: "metaDesc", includes: "Original 2004 Mehran PCI risk score" },
      { kind: "metadata", path: "info.text", includes: "Scope: original PCI model" },
      { kind: "output", vector: "*", field: "Model Scope", includes: "Original 2004 PCI score" },
    ],
  },
  {
    claim: "contrast-associated-terminology",
    statements: ["acr-ca-aki-terminology", "pm2021-title"],
    runtime: [{ kind: "metadata", path: "desc", includes: "contrast-associated kidney injury" }],
  },
  {
    claim: "not-a-general-iv-ct-contrast-tool",
    statements: [
      "acr-cardiac-angiography-overestimates-iv-risk",
      "kdigo-arterial-vs-venous-route",
      "esur-b2-route-and-aki-risk-factors",
    ],
    runtime: [
      { kind: "metadata", path: "info.text", includes: "not a general IV CT contrast risk calculator" },
      { kind: "metadata", path: "metaDesc", includes: "Not a general IV contrast clearance or treatment calculator." },
      { kind: "output", vector: "*", field: "Model Scope", includes: "not an individual guarantee or general IV CT contrast clearance" },
    ],
  },
  {
    claim: "not-the-2021-mehran-model",
    statements: ["pm2021-title", "pm2021-contemporary-cohort", "pm2021-different-predictors"],
    runtime: [
      { kind: "metadata", path: "info.text", includes: "or the newer Mehran 2 model" },
      { kind: "metadata", path: "fields.id", equals: RUNTIME_FIELD_IDS_2004.join(",") },
    ],
  },
  {
    claim: "rates-are-historical-cohort-estimates",
    statements: ["pm2004-development-rates", "pm2004-validation-rates", "kdigo-mehran-development-rates"],
    runtime: [
      { kind: "metadata", path: "metaDesc", includes: "with historical cohort-rate context" },
      { kind: "metadata", path: "info.text", includes: "Rates are historical cohort estimates, not an individualized guarantee." },
      { kind: "output", vector: "*", field: "Model Scope", includes: "displayed rates are historical cohort estimates, not an individual guarantee" },
    ],
  },
  {
    claim: "anticipated-procedural-inputs-are-conditional",
    statements: [
      "pm2004-procedural-candidates-and-endpoint",
      "pm2004-eight-variables",
      "pm2021-pre-procedural-vs-procedural-models",
    ],
    runtime: [
      {
        kind: "metadata",
        path: "info.text",
        includes: "Anticipated procedural inputs give a conditional estimate; update them after the procedure.",
      },
      { kind: "metadata", path: "fields.contrast_volume.subLabel", includes: "anticipated or administered volume" },
      {
        kind: "output",
        vector: "*",
        field: "Model Scope",
        includes: "Anticipated procedural inputs make the estimate conditional; update after the procedure.",
      },
    ],
  },
  {
    claim: "prevention-needs-separate-renal-aki-route-volume-assessment",
    statements: [
      "kdigo-4.2.1-assess-risk-and-kidney-function",
      "kdigo-risk-model-role",
      "esur-b2-route-and-aki-risk-factors",
      "acr-aki-not-stratified-by-creatinine-or-egfr",
      "acr-individualized-risk-benefit",
      "esur-b5-avoid-fluid-overload",
    ],
    runtime: [
      {
        kind: "metadata",
        path: "info.text",
        includes:
          "Prevention is not determined by this score alone. Assess renal function, acute kidney injury, contrast exposure route and volume status;",
      },
      {
        kind: "output",
        vector: "*",
        field: "Prevention Context",
        includes: "Assess renal function, acute kidney injury, contrast exposure route and volume status separately.",
      },
    ],
  },
  {
    claim: "individualize-hydration-in-severe-heart-failure",
    statements: [
      "esur-b2.2-individualize-hydration-severe-chf",
      "acr-volume-expansion-heart-failure-risk",
      "kdigo-4.4.1-volume-expansion",
    ],
    runtime: [
      { kind: "metadata", path: "info.text", includes: "individualize hydration, especially in severe heart failure." },
      {
        kind: "output",
        vector: "chf-iabp-diabetes-anemia-egfr19-contrast-100",
        field: "Prevention Context",
        includes: "Individualize hydration, especially in severe heart failure.",
      },
      { kind: "output", vector: "*", field: "Prevention Context", equals: PREVENTION_CONTEXT },
    ],
  },
  {
    claim: "no-score-triggered-hydration-dose",
    statements: ["acr-ideal-infusion-rate-unknown", "esur-b2.2-route-specific-hydration"],
    runtime: [
      { kind: "metadata", path: "info.text", includes: "This tool does not prescribe hydration doses" },
      { kind: "output", vector: "*", field: "Prevention Context", includes: "does not prescribe hydration doses" },
      { kind: "absent", vector: "*", field: "Prevention Recommendations" },
    ],
  },
  {
    claim: "no-score-triggered-medication-hold",
    statements: [
      "esur-b4.1-metformin-by-egfr-route-aki",
      "acr-metformin-categories-by-egfr",
      "acr-metformin-category-ii",
    ],
    runtime: [
      { kind: "metadata", path: "info.text", includes: "medication holds" },
      { kind: "output", vector: "*", field: "Prevention Context", includes: "medication holds" },
    ],
  },
  {
    claim: "no-prophylactic-dialysis-access",
    statements: [
      "kdigo-4.5.1-no-prophylactic-dialysis",
      "esur-b5-dialysis-not-protective",
      "acr-no-dialysis-solely-for-contrast",
    ],
    runtime: [
      { kind: "metadata", path: "info.text", includes: "dialysis access" },
      { kind: "output", vector: "*", field: "Prevention Context", includes: "dialysis access" },
    ],
  },
  {
    claim: "no-universal-safe-contrast-maximum",
    statements: [
      "esur-b2.3-first-pass-ratio-only",
      "esur-b2.3-lowest-diagnostic-dose",
      "kdigo-4.3.1-lowest-possible-dose",
      "acr-no-contrast-volume-threshold",
      "acr-no-iv-dose-toxicity-relationship",
      "acr-no-absolute-renal-threshold",
    ],
    runtime: [
      { kind: "metadata", path: "info.text", includes: "a safe contrast maximum" },
      { kind: "output", vector: "*", field: "Prevention Context", includes: "a safe contrast maximum" },
      { kind: "absent", vector: "*", field: "Contrast Limits" },
    ],
  },
  {
    claim: "no-invented-egfr-from-creatinine",
    statements: ["esur-b1-ckd-epi-needs-age-and-sex", "kdigo-table-15"],
    runtime: [
      { kind: "metadata", path: "fields.egfr.subLabel", includes: "No eGFR is calculated here." },
      {
        kind: "output",
        vector: "creatinine-1-contrast-100",
        field: "Renal Input Method",
        equals: "Supplied creatinine 1 mg/dL; no eGFR calculated.",
      },
      { kind: "absent", vector: "*", field: "Estimated eGFR" },
    ],
  },
  {
    claim: "renal-items-are-alternatives-without-double-counting",
    statements: ["kdigo-table-15"],
    runtime: [
      { kind: "metadata", path: "fields.egfr.subLabel", includes: "takes precedence if both renal fields are entered" },
      { kind: "output", vector: "creatinine-3-egfr30-contrast-0", field: "Mehran Score", equals: "4 points" },
      { kind: "output", vector: "creatinine-3-egfr30-contrast-0", field: "Score Breakdown", equals: "eGFR 20-40: +4" },
      {
        kind: "output",
        vector: "creatinine-3-egfr30-contrast-0",
        field: "Renal Input Method",
        includes: "eGFR takes precedence over creatinine, without double-counting.",
      },
    ],
  },
  {
    claim: "contrast-volume-is-a-required-score-input",
    statements: ["kdigo-table-15", "pm2004-eight-variables"],
    runtime: [
      { kind: "metadata", path: "fields.contrast_volume.required", equals: "true" },
      { kind: "metadata", path: "fields.contrast_volume.subLabel", includes: "blank is unknown, not zero" },
      { kind: "error", vector: "egfr90-contrast-blank", includes: "blank volume is unknown, not zero" },
      { kind: "output", vector: "egfr90-contrast-0", field: "Mehran Score", equals: "0 points" },
    ],
  },
  {
    claim: "cin-definition-thresholds",
    statements: ["pm2004-procedural-candidates-and-endpoint"],
    runtime: [
      { kind: "metadata", path: "info.text", includes: "Serum creatinine increase ≥25% from baseline" },
      { kind: "metadata", path: "info.text", includes: "Absolute increase ≥0.5 mg/dL" },
    ],
  },
  {
    claim: "corrected-original-study-doi",
    statements: ["pm2004-doi", "pm2004-title"],
    runtime: [
      { kind: "metadata", path: "info.link.url", equals: PRIMARY_DOI_URL },
      { kind: "metadata", path: "refs.0.u", equals: PRIMARY_DOI_URL },
      {
        kind: "metadata",
        path: "refs.0.t",
        includes: "A simple risk score for prediction of contrast-induced nephropathy after percutaneous coronary intervention.",
      },
    ],
  },
  {
    claim: "added-guideline-references-resolve-to-audited-sections",
    statements: [
      "esur-b2.2-individualize-hydration-severe-chf",
      "esur-b2.3-first-pass-ratio-only",
      "esur-b4.1-metformin-by-egfr-route-aki",
      "esur-b5-dialysis-not-protective",
      "kdigo-table-15",
      "kdigo-4.5.1-no-prophylactic-dialysis",
    ],
    runtime: [
      {
        kind: "metadata",
        path: `refs[u=${ESUR_REFERENCE_URL}].t`,
        includes: "B.2.2 individualized hydration, B.2.3 exposure-specific contrast guidance, B.4.1 metformin and B.5 dialysis",
      },
      {
        kind: "metadata",
        path: `refs[u=${KDIGO_REFERENCE_URL}].t`,
        includes: "Section 4: Table 15 PCI risk model; recommendation 4.5.1 against prophylactic dialysis solely for contrast removal",
      },
    ],
  },
]);

// Unchanged values that this audit does not source-verify (retrievable primary
// text lacks them or is ambiguous). Listed so the audit never over-claims.
// Unchanged values that this audit does not source-verify (retrievable primary
// text lacks them or is ambiguous). Listed so the audit never over-claims.
const NOT_SOURCE_BOUND = Object.freeze([
  "Middle-band cut points and CIN rates (6-10 points 14.0%; 11-15 points 26.1%) and their category labels: absent from the PubMed abstract and KDIGO; the original full text is behind publisher bot protection.",
  "All four dialysis rates (0.04%, 0.12%, 1.09%, 12.6%): absent from the retrievable sources.",
  "Checkbox definitions (hypotension, CHF, anemia thresholds) in field sub-labels: not in the retrievable sources.",
  "Contrast points for volumes that are not whole multiples of 100 mL (runtime floor): Table 15 states only 1 per 100 ml.",
  "eGFR exactly 60 and eGFR strictly between 39 and 40: Table 15 row '<60' with integer labels '40–60' and '20–39' does not decide these values.",
  "eGFR-over-creatinine precedence when both are entered: app convention; Table 15 lists the renal items as alternatives ('or') without precedence.",
  "Info-text CIN timing 'Within 48-72 hours of contrast exposure' differs from the 2004 endpoint 'at 48 h after PCI' (PubMed 15464318 METHODS); unchanged from develop.",
  "KDIGO Table 15 footnote shorthand ('<5', '>16') differs from the abstract and KDIGO text ('<=5', '>=16'); runtime follows <=5 and >=16.",
]);

const ACR_STATEMENT_PAGES = Object.freeze(
  [...new Set(SOURCE_STATEMENTS.filter(({ source }) => source === "acr").map(({ locator }) => locator.pdf_page))],
);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Exact bytes first: nothing is parsed from a response that is not the pinned artifact.
export function verifySourceBytes(key, bytes, source = SOURCES[key]) {
  assert.ok(source, `${key} is not a pinned source`);
  assert.ok(Buffer.isBuffer(bytes), `${key}: source bytes missing`);
  assert.equal(
    bytes.length,
    source.bytes,
    `${key}: source byte length drifted (${bytes.length}, pinned ${source.bytes}); re-review the source before re-pinning`,
  );
  const digest = sha256(bytes);
  assert.equal(
    digest,
    source.sha256,
    `${key}: source SHA-256 drifted (${digest}); re-review the source before re-pinning`,
  );
  return digest;
}

export function verifyResponse(key, { finalUrl, contentType }, source = SOURCES[key]) {
  const expected = new URL(source.url);
  const url = new URL(finalUrl);
  assert.equal(url.protocol, "https:", `${key}: final URL left HTTPS (${url.protocol})`);
  assert.equal(url.hostname, expected.hostname, `${key}: final URL host drifted (${url.hostname})`);
  assert.equal(url.pathname, expected.pathname, `${key}: final URL path drifted (${url.pathname})`);
  assert.equal(url.search, expected.search, `${key}: final URL query drifted (${url.search})`);
  const mediaType = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, source.media_type, `${key}: media type drifted (${contentType ?? "<missing>"})`);
}

function retryDelayMs(response, attempt) {
  const retryAfter = response?.headers?.get?.("retry-after")?.trim();
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  return 500 * 2 ** (attempt - 1);
}

// Retries transport failures only: network or body-read errors, 408/425/429/5xx, and the
// source's listed transient statuses (400 for the fixed NCBI E-utilities queries). A 200
// response that misses its URL, media-type, length or digest pin is a changed source and fails
// at once, without a retry. A bot challenge is never bypassed.
export async function fetchSource(key, { fetchImpl = globalThis.fetch, sleep = delay } = {}) {
  const source = SOURCES[key];
  assert.ok(source, `${key} is not a pinned source`);
  const retryable = new Set([...TRANSIENT_HTTP_STATUSES, ...source.retry_http_statuses]);
  let lastFailure = "unknown retrieval failure";
  let made = 0;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    made = attempt;
    let response;
    try {
      response = await fetchImpl(source.url, {
        headers: { "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      lastFailure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    if (response?.ok) {
      verifyResponse(key, { finalUrl: response.url, contentType: response.headers.get("content-type") }, source);
      let bytes = null;
      try {
        bytes = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        lastFailure = error instanceof Error ? `body read failed: ${error.message}` : String(error);
      }
      if (bytes) {
        verifySourceBytes(key, bytes, source);
        return bytes;
      }
    } else if (response) {
      await response.body?.cancel?.();
      const challenge = response.headers.get("cf-mitigated") ? " (bot challenge; this audit never bypasses it)" : "";
      lastFailure = `HTTP ${response.status}${challenge}`;
      if (challenge || !retryable.has(response.status)) break;
    }
    if (attempt < FETCH_ATTEMPTS) await sleep(Math.min(retryDelayMs(response, attempt), FETCH_MAX_DELAY_MS));
  }
  assert.fail(
    `${key}: primary-source retrieval failed after ${made} of ${FETCH_ATTEMPTS} attempts (${lastFailure}) from ${source.url}`,
  );
}

export async function fetchSources(options = {}) {
  const sources = {};
  for (const [index, key] of SOURCE_KEYS.entries()) {
    if (index > 0) await (options.sleep ?? delay)(FETCH_SPACING_MS);
    sources[key] = await fetchSource(key, options);
  }
  return sources;
}

const INLINE_TAGS = new Set(["a", "b", "bold", "em", "font", "i", "italic", "sc", "small", "span", "strong", "sub", "sup", "u", "xref"]);
const NAMED_ENTITIES = Object.freeze({ amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' });

function decodeEntities(text) {
  return text.replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|([a-z]+));/gi, (entity, hex, decimal, name) => {
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    if (decimal) return String.fromCodePoint(Number(decimal));
    const value = NAMED_ENTITIES[name.toLowerCase()];
    assert.ok(value !== undefined, `unsupported markup entity ${entity}`);
    return value;
  });
}

export function markupText(fragment) {
  const stripped = fragment
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<sup>(?:[\s,–-]|<xref ref-type="bibr"[^>]*>[^<]*<\/xref>)*<\/sup>/g, "")
    .replace(/<\/?([A-Za-z][\w:-]*)\b[^>]*>/g, (_, name) => (INLINE_TAGS.has(name.toLowerCase()) ? "" : " "));
  return decodeEntities(stripped).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function compactPdfText(value) {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeText(value) {
  return String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
}

// PubMed plain-text abstract layout: blank-line separated blocks for the citation, title,
// authors, author information, optional linked-record notices, abstract, copyright, identifiers
// and conflict-of-interest statement.
export function parseRecordText(text) {
  const blocks = text.split(/\n[ \t]*\n/).map((block) => block.trim()).filter(Boolean);
  const infoIndex = blocks.findIndex((block) => block.startsWith("Author information:"));
  assert.ok(infoIndex >= 2, "PubMed record lacks the author-information block");
  const notice =
    /^(Comment (in|on)|Erratum (in|for)|Update (in|of)|Retraction (in|of)|Expression of concern (in|for)|Republished (in|from)|Conflict of interest|Copyright|©|DOI:|PMID:|PMCID:)/;
  return {
    citation: normalizeText(blocks[0] ?? ""),
    title: normalizeText(blocks[1] ?? ""),
    abstract: normalizeText(blocks.slice(infoIndex + 1).find((block) => !notice.test(block)) ?? ""),
    doi: text.match(/^DOI: (\S+)$/m)?.[1] ?? "",
    pmid: text.match(/^PMID: (\d+)/m)?.[1] ?? "",
  };
}

export function sectionText(record, label) {
  const labels = [...record.abstract.matchAll(/(?:^|\s)([A-Z][A-Z ]{3,}): /g)];
  const hits = labels.filter((match) => match[1] === label);
  assert.equal(hits.length, 1, `PubMed ${record.pmid}: abstract section ${label} must occur exactly once`);
  const start = hits[0].index + hits[0][0].length;
  const next = labels.find((match) => match.index > hits[0].index);
  return record.abstract.slice(start, next ? next.index : undefined).trim();
}

export function kdigoSection(xml, title) {
  const marker = `<sec><title>${title}</title>`;
  const start = xml.indexOf(marker);
  assert.notEqual(start, -1, `KDIGO section "${title}" is missing`);
  assert.equal(xml.indexOf(marker, start + marker.length), -1, `KDIGO section "${title}" is not unique`);
  const tagPattern = /<sec\b[^>]*>|<\/sec>/g;
  tagPattern.lastIndex = start;
  let depth = 0;
  for (let match = tagPattern.exec(xml); match; match = tagPattern.exec(xml)) {
    depth += match[0] === "</sec>" ? -1 : 1;
    if (depth === 0) return markupText(xml.slice(start, match.index + match[0].length));
  }
  assert.fail(`KDIGO section "${title}" is unterminated`);
}

export function kdigoTable15(xml) {
  const tables = xml.match(/<table-wrap id="tbl15"[\s\S]*?<\/table-wrap>/g) ?? [];
  assert.equal(tables.length, 1, "KDIGO XML must contain exactly one Table 15 (tbl15)");
  const [table] = tables;
  assert.equal(markupText(table.match(/<label>([\s\S]*?)<\/label>/)?.[1] ?? ""), "Table 15", "Table 15 label drifted");
  assert.equal(
    markupText(table.match(/<caption>([\s\S]*?)<\/caption>/)?.[1] ?? ""),
    TABLE_15_CAPTION,
    "Table 15 caption drifted",
  );
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) => markupText(cell[1])),
  );
  assert.deepEqual(rows, EXPECTED_TABLE_15_ROWS, "KDIGO Table 15 rows drifted");
  const footnoteText = markupText(table.match(/<fn id="t15-fn1">([\s\S]*?)<\/fn>/)?.[1] ?? "");
  const shorthand = footnoteText.match(/Low risk\D*<(\d+)\D*high risk\D*>(\d+)/);
  assert.ok(shorthand, "Table 15 footnote band shorthand is missing");
  return {
    rows,
    footnote: {
      low_below: Number(shorthand[1]),
      high_above: Number(shorthand[2]),
      length: footnoteText.length,
      sha256: sha256(footnoteText),
    },
  };
}

export function esurSection(html, anchor) {
  const marker = `<a name="${anchor}" id="${anchor}"></a>`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `ESUR anchor ${anchor} is missing`);
  assert.equal(html.indexOf(marker, start + marker.length), -1, `ESUR anchor ${anchor} is not unique`);
  const next = html.indexOf('<a name="', start + marker.length);
  return markupText(html.slice(start, next === -1 ? undefined : next));
}

function wordCount(value) {
  return value.trim().split(/\s+/).length;
}

function spanDigest(text, from, to, label) {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `${label}: start marker ${JSON.stringify(from)} is missing from its locator`);
  assert.equal(text.indexOf(from, start + 1), -1, `${label}: start marker ${JSON.stringify(from)} is not unique in its locator`);
  const end = text.indexOf(to, start + from.length);
  assert.ok(end >= 0, `${label}: end marker ${JSON.stringify(to)} is missing after the start marker`);
  const span = text.slice(start, end + to.length);
  return { length: span.length, sha256: sha256(span) };
}

export async function acrPages(pdfBytes, pageNumbers) {
  assert.equal(pdfBytes.subarray(0, 5).toString("ascii"), "%PDF-", "ACR artifact lacks a PDF header");
  const document = await getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true, verbosity: 0 }).promise;
  try {
    assert.equal(document.numPages, 126, "ACR manual page count drifted");
    const pages = new Map();
    for (const pageNumber of [ACR_EDITION_PAGE, ...pageNumbers]) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.set(pageNumber, content.items.map((item) => `${item.str}${item.hasEOL ? " " : ""}`).join(""));
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

// Verifies every source's exact bytes, then parses. Nothing is parsed from unverified bytes.
export async function parseSources(sources) {
  assert.ok(sources && typeof sources === "object", "source bytes missing");
  for (const key of SOURCE_KEYS) verifySourceBytes(key, sources[key]);
  const pubmed = {};
  for (const [pmid, key] of Object.entries(PUBMED_SOURCE_BY_PMID)) {
    pubmed[pmid] = parseRecordText(sources[key].toString("utf8"));
  }
  return {
    pubmed,
    kdigoXml: sources.kdigo.toString("utf8"),
    esurHtml: sources.esur.toString("utf8"),
    acr: await acrPages(sources.acr, ACR_STATEMENT_PAGES),
  };
}

export function verifyIdentities(parsed) {
  for (const [pmid, key] of Object.entries(PUBMED_SOURCE_BY_PMID)) {
    const record = parsed.pubmed[pmid];
    const source = SOURCES[key];
    assert.equal(record.pmid, pmid, `${key}: PMID drifted`);
    assert.equal(record.doi, source.doi, `${key}: DOI drifted`);
    assert.ok(record.citation.includes(source.citation), `${key}: journal citation drifted`);
    assert.ok(record.abstract.length > 0, `${key}: abstract missing`);
  }
  assert.match(parsed.kdigoXml, /<article-id pub-id-type="pmcid">PMC4089629<\/article-id>/, "kdigo: PMCID drifted");
  assert.match(parsed.kdigoXml, /<article-id pub-id-type="doi">10\.1038\/kisup\.2011\.34<\/article-id>/, "kdigo: DOI drifted");
  assert.match(parsed.kdigoXml, /<article-title>Section 4: Contrast-induced AKI<\/article-title>/, "kdigo: title drifted");
  assert.equal(
    markupText(parsed.esurHtml.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
    "ESUR guidelines on Contrast Media - B. Renal adverse reactions",
    "esur: page title drifted",
  );
  assert.ok(
    compactPdfText(parsed.acr.get(ACR_EDITION_PAGE)).startsWith(compactPdfText("ACR Manual on Contrast Media 2026")),
    `acr: PDF page ${ACR_EDITION_PAGE} edition title drifted`,
  );
  for (const pageNumber of ACR_STATEMENT_PAGES) {
    const header = compactPdfText(`${ACR_RUNNING_HEADERS[pageNumber]} ${pageNumber - ACR_PDF_PAGE_OFFSET}`);
    assert.ok(
      compactPdfText(parsed.acr.get(pageNumber)).startsWith(header),
      `acr: PDF page ${pageNumber} running header or printed page ${pageNumber - ACR_PDF_PAGE_OFFSET} drifted`,
    );
  }
}

// The normalized text a span statement is checked in, and how its markers are normalized.
export function statementLocator(parsed, statement) {
  const { locator } = statement;
  if (statement.source === "pubmed") {
    const record = parsed.pubmed[locator.pmid];
    assert.ok(record, `${statement.id}: PubMed ${locator.pmid} missing`);
    return {
      text: sectionText(record, locator.label),
      normalize: normalizeText,
      locatorText: `PubMed ${locator.pmid} abstract, ${locator.label}`,
    };
  }
  if (statement.source === "kdigo") {
    return {
      text: kdigoSection(parsed.kdigoXml, locator.section),
      normalize: (value) => value,
      locatorText: `KDIGO 2012 AKI Section 4 (PMC4089629), section "${locator.section}"`,
    };
  }
  if (statement.source === "esur") {
    return {
      text: esurSection(parsed.esurHtml, locator.anchor),
      normalize: (value) => value,
      locatorText: `ESUR B. Renal adverse reactions, section ${locator.anchor.replaceAll("_", ".")} (anchor ${locator.anchor})`,
    };
  }
  assert.equal(statement.source, "acr", `${statement.id}: unknown source`);
  const page = parsed.acr.get(locator.pdf_page);
  assert.ok(page, `${statement.id}: ACR PDF page ${locator.pdf_page} was not extracted`);
  return {
    text: compactPdfText(page),
    normalize: compactPdfText,
    locatorText: `ACR Manual on Contrast Media 2026, PDF p. ${locator.pdf_page} (printed p. ${locator.pdf_page - ACR_PDF_PAGE_OFFSET})`,
  };
}

// Actual span digests for one statement; markers must be short and must locate the span.
export function checkStatementSpans(statement, text, normalize, locatorText = statement.id) {
  assert.ok(typeof text === "string" && text.length > 0, `${statement.id}: locator is empty`);
  assert.ok(Array.isArray(statement.spans) && statement.spans.length > 0, `${statement.id}: no pinned span`);
  return statement.spans.map((span, index) => {
    for (const marker of [span.from, span.to]) {
      assert.ok(
        wordCount(marker) <= MAX_MARKER_WORDS,
        `${statement.id}: marker ${JSON.stringify(marker)} exceeds ${MAX_MARKER_WORDS} words`,
      );
    }
    assert.match(span.sha256, /^[a-f0-9]{64}$/, `${statement.id}: span ${index + 1} digest is malformed`);
    const actual = spanDigest(text, normalize(span.from), normalize(span.to), `${statement.id} span ${index + 1} (${locatorText})`);
    return {
      id: statement.id,
      span: index + 1,
      ok: actual.length === span.length && actual.sha256 === span.sha256,
      expected: { length: span.length, sha256: span.sha256 },
      actual,
    };
  });
}

export function verifyStatements(parsed, table15, statements = SOURCE_STATEMENTS) {
  const ids = new Set();
  const mismatches = [];
  const verified = statements.map((statement) => {
    assert.equal(ids.has(statement.id), false, `duplicate statement ${statement.id}`);
    ids.add(statement.id);
    assert.ok(typeof statement.paraphrase === "string" && statement.paraphrase.length > 0, `${statement.id}: paraphrase missing`);
    const base = { id: statement.id, source: statement.source };

    if ("identity" in statement) {
      assert.equal(statement.source, "pubmed", `${statement.id}: identity statements are PubMed fields`);
      const record = parsed.pubmed[statement.locator.pmid];
      assert.ok(record, `${statement.id}: PubMed ${statement.locator.pmid} missing`);
      assert.equal(
        record[statement.locator.field],
        statement.identity,
        `${statement.id}: PubMed ${statement.locator.pmid} ${statement.locator.field} drifted`,
      );
      return {
        ...base,
        locator: `PubMed ${statement.locator.pmid}, ${statement.locator.field}`,
        paraphrase: statement.paraphrase,
        identity: statement.identity,
      };
    }

    if (statement.table) {
      assert.equal(statement.locator.table, "tbl15", `${statement.id}: only Table 15 is parsed`);
      if (Object.keys(EXPECTED_TABLE_15_FOOTNOTE).some((key) => table15.footnote[key] !== EXPECTED_TABLE_15_FOOTNOTE[key])) {
        mismatches.push({ id: statement.id, span: "footnote", expected: EXPECTED_TABLE_15_FOOTNOTE, actual: table15.footnote });
      }
      return {
        ...base,
        locator: "KDIGO 2012 AKI Section 4 (PMC4089629), Table 15 (tbl15)",
        paraphrase: statement.paraphrase,
        table: { caption: TABLE_15_CAPTION, rows: table15.rows, footnote: { ...EXPECTED_TABLE_15_FOOTNOTE } },
      };
    }

    const { text, normalize, locatorText } = statementLocator(parsed, statement);
    for (const result of checkStatementSpans(statement, text, normalize, locatorText)) {
      if (!result.ok) mismatches.push({ id: result.id, span: result.span, expected: result.expected, actual: result.actual });
    }
    return {
      ...base,
      locator: locatorText,
      paraphrase: statement.paraphrase,
      spans: statement.spans.map(({ from, to, length, sha256: digest }) => ({ from, to, length, sha256: digest })),
    };
  });
  assert.equal(
    mismatches.length,
    0,
    `pinned source statements drifted (re-review each statement at its locator before re-pinning):\n${JSON.stringify(mismatches, null, 2)}`,
  );
  return verified;
}

function readPath(object, path) {
  const selector = path.match(/^refs\[u=(.+)\]\.(\w+)$/);
  if (selector) {
    const matches = object.refs.filter((reference) => reference.u === selector[1]);
    assert.equal(matches.length, 1, `runtime must cite ${selector[1]} exactly once`);
    return matches[0][selector[2]];
  }
  if (path === "fields.id") return object.fields.map((field) => field.id).join(",");
  const fieldMatch = path.match(/^fields\.(\w+)\.(\w+)$/);
  if (fieldMatch) {
    const field = object.fields.find(({ id }) => id === fieldMatch[1]);
    assert.ok(field, `runtime field ${fieldMatch[1]} is missing`);
    return field[fieldMatch[2]];
  }
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function computeVector(calculator, vectorId) {
  const inputs = RUNTIME_VECTORS[vectorId];
  assert.ok(inputs, `unknown runtime vector ${vectorId}`);
  return calculator.compute({ ...inputs });
}

function assertRuntimeCheck(calculator, claim, check, calculatorSource) {
  const label = `${claim}: ${check.kind} ${check.path ?? check.field ?? ""} @ ${check.vector ?? "metadata"}`;
  if (check.kind === "calculator-source") {
    assert.ok(calculatorSource.includes(check.includes), `${label} lacks ${JSON.stringify(check.includes)}`);
    return;
  }
  if (check.kind === "metadata") {
    const actual = String(readPath(calculator, check.path));
    if ("equals" in check) assert.equal(actual, String(check.equals), label);
    else assert.ok(actual.includes(check.includes), `${label} lacks ${JSON.stringify(check.includes)}`);
    return;
  }
  const vectorIds = check.vector === "*" ? VALID_VECTOR_IDS : [check.vector];
  for (const vectorId of vectorIds) {
    const result = computeVector(calculator, vectorId);
    if (check.kind === "error") {
      assert.ok(typeof result.Error === "string", `${label}: expected a refusal`);
      assert.ok(result.Error.includes(check.includes), `${label}: refusal lacks ${JSON.stringify(check.includes)}`);
      assert.equal(result["Mehran Score"], undefined, `${label}: refusal still produced a score`);
      assert.equal(result["CIN Risk"], undefined, `${label}: refusal still produced a rate`);
      continue;
    }
    assert.equal(result.Error, undefined, `${label} [${vectorId}]: unexpected error ${result.Error}`);
    if (check.kind === "absent") {
      assert.equal(Object.hasOwn(result, check.field), false, `${label} [${vectorId}]: forbidden field present`);
      continue;
    }
    assert.equal(check.kind, "output", `${label}: unknown check kind`);
    assert.ok(Object.hasOwn(result, check.field), `${label} [${vectorId}]: field missing`);
    const actual = String(result[check.field]);
    if ("equals" in check) assert.equal(actual, String(check.equals), `${label} [${vectorId}]`);
    else assert.ok(actual.includes(check.includes), `${label} [${vectorId}] lacks ${JSON.stringify(check.includes)}`);
  }
}

function assertForbiddenOutputsAbsent(calculator) {
  const texts = [["info.text", calculator.info.text]];
  for (const vectorId of VALID_VECTOR_IDS) {
    const result = computeVector(calculator, vectorId);
    for (const field of FORBIDDEN_OUTPUT_FIELDS) {
      assert.equal(Object.hasOwn(result, field), false, `${vectorId}: removed output ${field} reappeared`);
    }
    const { "Prevention Context": _prevention, ...clinicalOutputs } = result;
    texts.push([vectorId, JSON.stringify(clinicalOutputs)]);
    assert.equal(_prevention, PREVENTION_CONTEXT, `${vectorId}: Prevention Context drifted`);
    assert.equal(result["Model Scope"], MODEL_SCOPE, `${vectorId}: Model Scope drifted`);
  }
  for (const [where, text] of texts) {
    for (const [label, pattern] of FORBIDDEN_OUTPUT_PATTERNS) {
      assert.doesNotMatch(text, pattern, `${where}: ${label} must not be emitted`);
    }
  }
  return FORBIDDEN_OUTPUT_PATTERNS.map(([label]) => label);
}

export function parseRiskBandExtremes(results) {
  const match = results.match(
    /range ([\d.]+%) to ([\d.]+%) for a low \[<or=(\d+)\] and high \[>or=(\d+)\]/,
  );
  assert.ok(match, "PubMed 15464318 RESULTS lacks the low/high band extremes");
  return {
    low_max_score: Number(match[3]),
    low_cin_rate: match[1],
    high_min_score: Number(match[4]),
    high_cin_rate: match[2],
  };
}

function bindTable15(calculator, table) {
  const weights = new Map(table.rows.slice(1).map(([label, value]) => [label, value]));
  const baseline = { egfr: "90", contrast_volume: "0" };
  const score = (inputs) => {
    const result = calculator.compute({ ...inputs });
    assert.equal(result.Error, undefined, `${JSON.stringify(inputs)}: ${result.Error}`);
    return result;
  };
  const points = (result) => Number(/^(\d+) points$/.exec(result["Mehran Score"])?.[1]);

  const binary = TABLE_15_BINARY_FIELDS.map(([row, field, breakdownLabel]) => {
    const sourcePoints = Number(weights.get(row));
    assert.ok(Number.isInteger(sourcePoints), `Table 15 ${row} weight is not an integer`);
    const result = score({ ...baseline, [field]: true });
    assert.equal(points(result), sourcePoints, `${row}: runtime weight drifted from Table 15`);
    assert.equal(result["Score Breakdown"], `${breakdownLabel}: +${sourcePoints}`, `${row}: breakdown drifted`);
    return { source_row: row, source_points: sourcePoints, runtime_field: field, runtime_points: points(result) };
  });

  const volumeRule = /^(\d+) per (\d+) ml$/.exec(weights.get("Contrast-media volume"));
  assert.ok(volumeRule, "Table 15 contrast-media volume rule changed");
  const perStep = Number(volumeRule[1]);
  const stepMl = Number(volumeRule[2]);
  const contrast = [0, 1, 2, 3, 5].map((steps) => {
    const volume = steps * stepMl;
    const result = score({ egfr: "90", contrast_volume: String(volume) });
    assert.equal(points(result), steps * perStep, `contrast ${volume} mL: runtime drifted from Table 15`);
    return { contrast_volume_ml: volume, runtime_points: points(result) };
  });

  const creatinineRow = [...weights.keys()].find((label) => label.startsWith("SCr >"));
  const creatinineThreshold = Number(/^SCr >([\d.]+) mg\/dl/.exec(creatinineRow)?.[1]);
  const creatininePoints = Number(weights.get(creatinineRow));
  assert.equal(creatinineThreshold, 1.5, "Table 15 creatinine threshold changed");
  const creatinine = [
    [String(creatinineThreshold), 0],
    [String(creatinineThreshold + 0.01), creatininePoints],
  ].map(([value, expected]) => {
    const result = score({ creatinine: value, contrast_volume: "0" });
    assert.equal(points(result), expected, `creatinine ${value}: runtime drifted from Table 15 (>1.5 mg/dl)`);
    return { creatinine_mg_dl: value, runtime_points: points(result) };
  });

  const egfrRow = [...weights.keys()].find((label) => label.startsWith("eGFR <"));
  const tiers = [...weights.get(egfrRow).matchAll(/(\d+) for (?:(\d+)–(\d+)|<(\d+))/g)].map((match) => ({
    points: Number(match[1]),
    low: match[4] ? null : Number(match[2]),
    high: match[4] ? Number(match[4]) - 1 : Number(match[3]),
  }));
  assert.deepEqual(
    tiers,
    [
      { points: 2, low: 40, high: 60 },
      { points: 4, low: 20, high: 39 },
      { points: 6, low: null, high: 19 },
    ],
    "Table 15 eGFR tiers changed",
  );
  // Only integer values that the printed labels decide unambiguously.
  const egfrVectors = [
    [19, 6],
    [20, 4],
    [39, 4],
    [40, 2],
    [59, 2],
    [90, 0],
  ];
  const egfr = egfrVectors.map(([value, expected]) => {
    const tier = tiers.find(({ low, high }) => (low === null || value >= low) && value <= high && value < 60);
    assert.equal(tier?.points ?? 0, expected, `eGFR ${value}: expected points are not derivable from Table 15`);
    const result = score({ egfr: String(value), contrast_volume: "0" });
    assert.equal(points(result), expected, `eGFR ${value}: runtime drifted from Table 15`);
    return { egfr: value, runtime_points: points(result) };
  });

  return { binary, contrast, creatinine, egfr };
}

function bindRiskBands(calculator, extremes) {
  const vectors = [
    ["score-0", { egfr: "90", contrast_volume: "0" }, 0],
    ["score-5", { hypotension: true, egfr: "90", contrast_volume: "0" }, 5],
    ["score-16", { chf: true, iabp: true, diabetes: true, anemia: true, egfr: "90", contrast_volume: "0" }, 16],
    ["score-17", { chf: true, iabp: true, diabetes: true, anemia: true, egfr: "90", contrast_volume: "100" }, 17],
  ];
  return vectors.map(([id, inputs, expectedScore]) => {
    const result = calculator.compute({ ...inputs });
    assert.equal(result["Mehran Score"], `${expectedScore} points`, `${id}: vector score drifted`);
    const expectedRate =
      expectedScore <= extremes.low_max_score
        ? extremes.low_cin_rate
        : expectedScore >= extremes.high_min_score
          ? extremes.high_cin_rate
          : assert.fail(`${id}: not a source-bound band`);
    assert.equal(result["CIN Risk"], expectedRate, `${id}: runtime CIN rate drifted from PubMed 15464318 RESULTS`);
    return { vector: id, score: expectedScore, runtime_cin_risk: result["CIN Risk"] };
  });
}

export function verifyRuntime({ calculator, calculatorSource, table15, riskBandExtremes, statementIds }) {
  const source = Buffer.isBuffer(calculatorSource) ? calculatorSource.toString("utf8") : String(calculatorSource);
  const claimIds = new Set();
  const boundStatementIds = new Set();
  const claims = CLAIM_BINDINGS.map((binding) => {
    assert.equal(claimIds.has(binding.claim), false, `duplicate claim ${binding.claim}`);
    claimIds.add(binding.claim);
    assert.ok(binding.statements.length > 0 && binding.runtime.length > 0, `${binding.claim}: incomplete binding`);
    for (const statementId of binding.statements) {
      assert.ok(statementIds.has(statementId), `${binding.claim}: unknown statement ${statementId}`);
      boundStatementIds.add(statementId);
    }
    for (const check of binding.runtime) assertRuntimeCheck(calculator, binding.claim, check, source);
    return { claim: binding.claim, statements: [...binding.statements], runtime_checks: binding.runtime.length };
  });
  assert.deepEqual(
    [...statementIds].filter((id) => !boundStatementIds.has(id)),
    [],
    "every verified source statement must support at least one bound claim",
  );
  return {
    claims,
    forbiddenOutputChecks: assertForbiddenOutputsAbsent(calculator),
    table15Bindings: bindTable15(calculator, table15),
    riskBandBindings: bindRiskBands(calculator, riskBandExtremes),
  };
}

export async function runAudit({ sources, calculator, calculatorSource }) {
  assert.equal(`pdfjs-dist@${pdfjsVersion}`, PDF_PARSER, "PDF parser drifted from the lockfile pin");
  const parsed = await parseSources(sources);
  verifyIdentities(parsed);
  const table15 = kdigoTable15(parsed.kdigoXml);
  const statements = verifyStatements(parsed, table15);
  const riskBandExtremes = parseRiskBandExtremes(sectionText(parsed.pubmed["15464318"], "RESULTS"));
  assert.ok(
    kdigoSection(parsed.kdigoXml, "Risk models of CI-AKI").includes(
      `range ${riskBandExtremes.low_cin_rate} to ${riskBandExtremes.high_cin_rate} for a low [⩽${riskBandExtremes.low_max_score}] and high [⩾${riskBandExtremes.high_min_score}]`,
    ),
    "KDIGO and PubMed band extremes disagree",
  );
  const runtime = verifyRuntime({
    calculator,
    calculatorSource,
    table15,
    riskBandExtremes,
    statementIds: new Set(statements.map(({ id }) => id)),
  });
  const calculatorBytes = Buffer.isBuffer(calculatorSource) ? calculatorSource : Buffer.from(String(calculatorSource), "utf8");
  return {
    schema: SCHEMA,
    calculator_id: calculator.id,
    runtime_source: CALCULATOR_PATH,
    runtime_source_bytes: calculatorBytes.length,
    runtime_source_sha256: sha256(calculatorBytes),
    sources: SOURCE_KEYS.map((key) => {
      const source = SOURCES[key];
      return {
        key,
        kind: source.kind,
        authority: source.authority,
        title: source.title,
        url: source.url,
        media_type: source.media_type,
        digest_of: "raw-response-bytes",
        verified_before_parsing: true,
        bytes: source.bytes,
        sha256: source.sha256,
      };
    }),
    parsers: { pdf: PDF_PARSER, markup: MARKUP_PARSER, pubmed_text: TEXT_PARSER },
    source_statement_count: statements.length,
    source_statement_ids: statements.map(({ id }) => id),
    source_statements_sha256: sha256(JSON.stringify(statements)),
    source_statements: statements,
    claims: runtime.claims,
    table_15_bindings: runtime.table15Bindings,
    table_15_footnote_shorthand_recorded_not_bound: { ...table15.footnote },
    risk_band_extremes: riskBandExtremes,
    risk_band_bindings: runtime.riskBandBindings,
    forbidden_output_checks: runtime.forbiddenOutputChecks,
    not_source_bound: [...NOT_SOURCE_BOUND],
    source_bytes_committed: false,
  };
}

export async function loadRuntime(root = REPO_ROOT) {
  const file = path.join(root, CALCULATOR_PATH);
  const [{ MehranCIN }, calculatorSource] = await Promise.all([import(pathToFileURL(file).href), readFile(file)]);
  return { calculator: MehranCIN, calculatorSource };
}

export function passLine(audit) {
  return `Mehran primary-source audit passed: ${audit.sources.length} sources verified as exact bytes before parsing, ${audit.source_statement_count} digest-pinned source statements, ${audit.claims.length} changed-claim bindings, Table 15 and risk-band boundary vectors.`;
}

async function main() {
  const { calculator, calculatorSource } = await loadRuntime();
  const sources = await fetchSources();
  const audit = await runAudit({ sources, calculator, calculatorSource });
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(audit)}\n`);
  } else {
    console.log(passLine(audit));
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
