#!/usr/bin/env node

// Exact-head primary-source audit for the adrenal CT washout (adrenal-ct) and
// adrenal MRI chemical-shift (adrenal-mri) calculators.
//
// It retrieves three official artifacts, pins their identity, verifies source
// statements at named locators and binds them to the checked-out runtime:
//
// 1. ESE/ENSAT 2023 adrenal incidentaloma guideline (Fassnacht et al., CC BY),
//    published-version PDF deposited in White Rose Research Online (University of
//    Sheffield). Pinned: final URL host/path, media type, byte length and SHA-256
//    of the artifact bytes.
// 2. Schloetelburg et al. 2021, the study the guideline cites (ref 72) for washout
//    error rates: PMC8679842 JATS XML from NCBI E-utilities (CC BY 4.0). Pinned:
//    final URL host/path, media type, byte length and SHA-256 of the artifact bytes.
// 3. Nine PubMed records of the primary washout and chemical-shift studies, each
//    retrieved on its own as PubMed's plain-text abstract (efetch rettype=abstract,
//    retmode=text; no DTD header or retrieval metadata). Pinned: final URL host, path
//    and query, media type, byte length and SHA-256 of the artifact bytes.
//
// Every artifact's exact bytes are verified before anything is parsed; a 200 response
// that misses its URL, media-type, length or digest pin fails at once and is never
// retried. Only transport failures are retried. NCBI requests run one at a time,
// spaced to stay under the unauthenticated rate limit.
//
// Source statements are not reproduced here. Each one is pinned by the length and
// SHA-256 of the exact normalized source span that runs from a short start marker
// to the next end marker (both inclusive, at most six words each) inside its
// locator, plus a one-line paraphrase in Radulator's own words. Open the source at
// the locator to read the statement itself. Numeric criteria are parsed from the
// verified spans in memory. Source bytes are never committed. Any drift, missing
// locator or runtime mismatch fails with an assertion.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { AdrenalCTWashout } from "../src/components/calculators/AdrenalCTWashout.jsx";
import { AdrenalMRICSI } from "../src/components/calculators/AdrenalMRICSI.jsx";

const USER_AGENT = "Radulator-adrenal-primary-source-audit/2";
const NCBI_TOOL = "radulator-adrenal-primary-source-audit";
const APP_PATH = "src/App.jsx";
const CT_PATH = "src/components/calculators/AdrenalCTWashout.jsx";
const MRI_PATH = "src/components/calculators/AdrenalMRICSI.jsx";
export const MAX_MARKER_WORDS = 6;
const DEFAULT_RETRY_STATUSES = Object.freeze([429, 500, 502, 503, 504]);
// NCBI E-utilities occasionally answer a valid, unchanged request with a transient 400.
const NCBI_RETRY_STATUSES = Object.freeze([400, 429, 500, 502, 503, 504]);
// NCBI allows about 3 requests per second without an API key.
export const NCBI_SPACING_MS = 400;
const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

export const ESE_PDF = Object.freeze({
  id: "ese-ensat-2023-guideline-pdf",
  citation:
    "Fassnacht M, et al. European Society of Endocrinology clinical practice guidelines on the management of adrenal incidentalomas, in collaboration with the European Network for the Study of Adrenal Tumors. Eur J Endocrinol. 2023;189(1):G1-G42",
  doi: "10.1093/ejendo/lvad066",
  deposit_record: "https://eprints.whiterose.ac.uk/id/eprint/208070/",
  url: "https://eprints.whiterose.ac.uk/id/eprint/208070/1/lvad066.pdf",
  host: "eprints.whiterose.ac.uk",
  path: "/id/eprint/208070/1/lvad066.pdf",
  media_type: "application/pdf",
  bytes: 2_086_909,
  sha256: "70faac5423838b806d5be7abe489a8bd35b7ae12714d32d821fcdc083f80d47f",
  digest_scope: "artifact-bytes",
  pages: 43,
  license: "CC BY",
});

export const PMC_ARTICLE = Object.freeze({
  id: "schloetelburg-2021-pmc-jats",
  citation: "Schloetelburg W, et al. Eur J Endocrinol. 2021;186(2):183-193 (ESE/ENSAT 2023 reference 72)",
  doi: "10.1530/EJE-21-0650",
  pmcid: "PMC8679842",
  url: `${EFETCH}?db=pmc&id=8679842&tool=${NCBI_TOOL}`,
  host: "eutils.ncbi.nlm.nih.gov",
  path: "/entrez/eutils/efetch.fcgi",
  query: Object.freeze({ db: "pmc", id: "8679842" }),
  media_type: "text/xml",
  bytes: 116_668,
  sha256: "9210b41674e56030b538fc9329a94b540a0079e64ba4e162819eb16a33221d75",
  digest_scope: "artifact-bytes",
  license: "CC BY 4.0",
  retry_statuses: NCBI_RETRY_STATUSES,
});

// One plain-text abstract per record, pinned by its exact bytes. `labels` are the
// abstract's section labels in order; `notices` are PubMed's linked-record notices
// (comments, errata) printed between the author information and the abstract.
function pubmedText(pmid, fields) {
  return Object.freeze({
    id: `pubmed-${pmid}`,
    pmid,
    url: `${EFETCH}?db=pubmed&id=${pmid}&rettype=abstract&retmode=text&tool=${NCBI_TOOL}`,
    host: "eutils.ncbi.nlm.nih.gov",
    path: "/entrez/eutils/efetch.fcgi",
    query: Object.freeze({ db: "pubmed", id: pmid, rettype: "abstract", retmode: "text" }),
    media_type: "text/plain",
    digest_scope: "artifact-bytes",
    retry_statuses: NCBI_RETRY_STATUSES,
    pmcid: null,
    ...fields,
  });
}

export const PUBMED_RECORDS = Object.freeze({
  "11044054": pubmedText("11044054", {
    citation: "Caoili EM, et al. Delayed enhanced CT of lipid-poor adrenal adenomas. AJR 2000;175:1411-1415",
    doi: "10.2214/ajr.175.5.1751411",
    year: "2000",
    labels: ["OBJECTIVE", "SUBJECTS AND METHODS", "RESULTS", "CONCLUSION"],
    notices: [],
    bytes: 2_319,
    sha256: "533378781edb78cb27d3f85a57e6bfea12e7fcace5e6468443dc178ae205a1fb",
  }),
  "11867777": pubmedText("11867777", {
    citation: "Caoili EM, et al. Adrenal masses: characterization with combined unenhanced and delayed enhanced CT. Radiology 2002;222:629-633",
    doi: "10.1148/radiol.2223010766",
    year: "2002",
    labels: ["PURPOSE", "MATERIALS AND METHODS", "RESULTS", "CONCLUSION"],
    notices: ["Comment in Radiology. 2003 Jan;226(1):289-90; author reply 290. doi: 10.1148/radiol.2261020528."],
    bytes: 1_817,
    sha256: "6b8d55c2ed177f02157c5818e924e698835e55fd90dadd126223ed1ce5d73cb9",
  }),
  "23151828": pubmedText("23151828", {
    citation: "Choi YA, et al. Evaluation of adrenal metastases from renal cell carcinoma and hepatocellular carcinoma: use of delayed contrast-enhanced CT. Radiology 2013;266:514-520",
    doi: "10.1148/radiol.12120110",
    year: "2013",
    labels: ["PURPOSE", "MATERIALS AND METHODS", "RESULTS", "CONCLUSION"],
    notices: ["Comment in J Urol. 2013 Dec;190(6):2018-9. doi: 10.1016/j.juro.2013.08.045."],
    bytes: 2_736,
    sha256: "db1c71d63ce9d190012e6935f294a51650e8a7350f8c3ee7c4aa55c345266765",
  }),
  "26254908": pubmedText("26254908", {
    citation: "Park SY, et al. CT sensitivity for adrenal adenoma according to lesion size. Abdom Imaging 2015;40:3152-3160",
    doi: "10.1007/s00261-015-0521-x",
    year: "2015",
    labels: ["PURPOSE", "MATERIALS AND METHODS", "RESULTS", "CONCLUSIONS"],
    notices: [],
    bytes: 2_363,
    sha256: "27ed92335099d70d3e52d3f8eb62a48f58134935775b918f5218e00febdef54f",
  }),
  "23789665": pubmedText("23789665", {
    citation: "Patel J, et al. Can established CT attenuation and washout criteria for adrenal adenoma accurately exclude pheochromocytoma? AJR 2013;201:122-127",
    doi: "10.2214/AJR.12.9620",
    year: "2013",
    labels: ["OBJECTIVE", "MATERIALS AND METHODS", "RESULTS", "CONCLUSION"],
    notices: [],
    bytes: 2_296,
    sha256: "88c37516abae3f430580d8bbd6b9155ab13eed75842e52d6386b6d1f1def4203",
  }),
  "12760936": pubmedText("12760936", {
    citation: "Fujiyoshi F, et al. Characterization of adrenal tumors by chemical shift fast low-angle shot MR imaging: comparison of four methods of quantitative evaluation. AJR 2003;180:1649-1657",
    doi: "10.2214/ajr.180.6.1801649",
    year: "2003",
    labels: ["OBJECTIVE", "MATERIALS AND METHODS", "RESULTS", "CONCLUSION"],
    notices: [],
    bytes: 1_822,
    sha256: "0f35b836be2f938cfecc1d2220c59c5ed98db3af367bd3821172a0e47b7f18c4",
  }),
  "15208141": pubmedText("15208141", {
    citation: "Israel GM, et al. Comparison of unenhanced CT and chemical shift MRI in evaluating lipid-rich adrenal adenomas. AJR 2004;183:215-219",
    doi: "10.2214/ajr.183.1.1830215",
    year: "2004",
    labels: ["OBJECTIVE", "MATERIALS AND METHODS", "RESULTS", "CONCLUSION"],
    notices: [],
    bytes: 2_337,
    sha256: "1f91c231176f8f88f6fd2f2e813dd038cad6f24fed6b1dd6400c0a9396b4588a",
  }),
  "8756926": pubmedText("8756926", {
    citation: "Outwater EK, et al. Adrenal masses: correlation between CT attenuation value and chemical shift ratio at MR imaging with in-phase and opposed-phase sequences. Radiology 1996;200:749-752",
    doi: "10.1148/radiology.200.3.8756926",
    year: "1996",
    labels: ["PURPOSE", "MATERIALS AND METHODS", "RESULTS", "CONCLUSION"],
    notices: ["Erratum in Radiology 1996 Dec;201(3):880."],
    bytes: 1_957,
    sha256: "f47817ca86d7ce242a0b01dfe83d85b98d93526b4fc29b8c53eaaf88fd626928",
  }),
  "8598820": pubmedText("8598820", {
    citation: "Gudbjartsson H, Patz S. The Rician distribution of noisy MRI data. Magn Reson Med 1995;34:910-914",
    doi: "10.1002/mrm.1910340618",
    year: "1995",
    pmcid: "PMC2254141",
    labels: [],
    notices: ["Erratum in Magn Reson Med 1996 Aug;36(2):332."],
    bytes: 944,
    sha256: "86fe91c16e25c6f3f46866730bdc68893c01f58d3b57e5282b3b947543e4acaf",
  }),
});

// Statement pins. `from` and `to` are short markers that only locate the span;
// `length`/`sha256` pin the exact normalized span between them, both inclusive.
// ESE spans: pdf.js text layer of the stated PDF page, NFKC, lower-cased, with
// whitespace, dashes and quotation marks removed (superscript reference numbers
// stay inline). PubMed spans: one labelled section of the verified plain-text
// abstract, NFC, whitespace collapsed. PMC spans: one titled <sec> of the abstract
// or body, tags removed, XML entities decoded, NFC, whitespace collapsed. The start
// marker must be unique in its locator and the span unique in its document.
export const STATEMENTS = Object.freeze([
  {
    id: "ese-hu-scale",
    source: "ese",
    page: 9,
    printed: "G8",
    locator: "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G8 (PDF page 9)",
    after: "2.3. Short overview on adrenal imaging",
    from: "HUs and quantify X-ray absorption",
    to: "allocated a HU value of 0.",
    length: 95,
    sha256: "e045075c40fb71cdf0a16bec0114b33c54a42a8e9bea9fd0593324564b73add0",
    paraphrase: "Hounsfield units express X-ray attenuation relative to water, which is defined as 0 HU.",
  },
  {
    id: "ese-washout-timing",
    source: "ese",
    page: 10,
    printed: "G9",
    locator: "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G9 (PDF page 10)",
    from: "prior to injection of contrast",
    to: "minutes after contrast injection.",
    length: 139,
    sha256: "86a8c839ba090790fdc057d34743c9071746b46a499acb8194f5f25c61a6b19f",
    paraphrase: "Washout CT samples the lesion before contrast (HUnativ), at 60 s (HUmax) and at 10 or 15 min.",
  },
  {
    id: "ese-chemical-shift-lipid",
    source: "ese",
    page: 10,
    printed: "G9",
    locator: "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G9 (PDF page 10)",
    from: "Adrenal adenomas with a high",
    to: "retain their signal.",
    length: 261,
    sha256: "0029c943d5729476d3f94845155c76331687da9cddfae1c792c2c34c983530e2",
    paraphrase:
      "Lipid-rich adenomas drop in signal from in-phase to out-of-phase; lesions lacking intracellular lipid (malignancies, pheochromocytomas, some lipid-poor adenomas) do not.",
  },
  {
    id: "ese-mr-arbitrary-units",
    source: "ese",
    page: 10,
    printed: "G9",
    locator: "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G9 (PDF page 10)",
    from: "MR signal intensity units are",
    to: "numerous technical variations.",
    length: 101,
    sha256: "7a98625ab4bae9b1baeb37975ad27091058efc9d9afb191501ff5d3d86e0fd55",
    paraphrase: "Unlike CT numbers, MR signal intensities are arbitrary units that vary with technique.",
  },
  {
    id: "ese-mr-quantitative-measures",
    source: "ese",
    page: 10,
    printed: "G9",
    locator: "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G9 (PDF page 10)",
    from: "Quantitative analysis can be made",
    to: "the signal intensity index.",
    length: 90,
    sha256: "f25b98b38c21310950d1bf1d5bd656a71edf081237ab9fd0ba39bb83e14b6b22",
    paraphrase: "Quantitative chemical-shift assessment uses the adrenal-to-spleen ratio and the signal intensity index.",
  },
  {
    id: "ese-washout-cutoffs-low-evidence",
    source: "ese",
    page: 14,
    printed: "G13",
    locator: "ESE/ENSAT 2023 §4.1.1, paragraph 'Washout-CT.', printed p. G13 (PDF page 14)",
    after: "Washout-CT. Washout (absolute and relative)",
    before: "MRI. No new studies reporting",
    from: "Notably, while a cutoff of",
    to: "incidentalomas was very low.76",
    length: 198,
    sha256: "a26fc67e73c8467d6bd931c0324f6f0190846ba74d486914c94a86bf10e0f375",
    paraphrase:
      "APW 60% and RPW 40% are widely proposed cutoffs (also in the panel's earlier guideline), but evidence for their accuracy in incidentalomas is very low.",
  },
  {
    id: "ese-washout-malignant-misses",
    source: "ese",
    page: 14,
    printed: "G13",
    locator: "ESE/ENSAT 2023 §4.1.1, paragraph 'Washout-CT.', printed p. G13 (PDF page 14)",
    after: "Washout-CT. Washout (absolute and relative)",
    before: "MRI. No new studies reporting",
    from: "A recent study demonstrated that",
    to: "not correctly identified.72",
    length: 151,
    sha256: "d95ea1c6fd72baadbdeb6955f2cee2c0b149b47108c2114de5b013736ecac1b3",
    paraphrase: "In one recent study those cutoffs missed 22% (APW) and 8% (RPW) of malignant tumours.",
  },
  {
    id: "ese-washout-58-needs-validation",
    source: "ese",
    page: 14,
    printed: "G13",
    locator: "ESE/ENSAT 2023 §4.1.1, paragraph 'Washout-CT.', printed p. G13 (PDF page 14)",
    after: "Washout-CT. Washout (absolute and relative)",
    before: "MRI. No new studies reporting",
    from: "To detect all malignant tumors,",
    to: "need of external validation.",
    length: 171,
    sha256: "7a938dcc11d8b9b39ae43776a4bb9f1afc5136bd8f3f0bc8e67f7a56a0e3581f",
    paraphrase: "An RPW cutoff of 58% caught every malignancy but had only 15% specificity and still needs external validation.",
  },
  {
    id: "ese-mri-quantitation-not-standardized",
    source: "ese",
    page: 20,
    printed: "G19",
    locator: "ESE/ENSAT 2023 §5.2 R.2.3 Reasoning, printed p. G19 (PDF page 20)",
    from: "However, the quantitative assessment of",
    to: "to make strong recommendations",
    length: 218,
    sha256: "de324ed7b55a5ce0f6ae375077642bb1e89025e909b724a5af22bbc89edec7f9",
    paraphrase: "Quantitative MRI signal-loss measures differ between studies, so the evidence cannot support strong recommendations.",
  },
  {
    id: "ese-table4-mri-row",
    source: "ese",
    page: 20,
    printed: "G19",
    locator: "ESE/ENSAT 2023 §5.2 Table 4, row 'MRI\u2014chemical shift', printed p. G19 (PDF page 20)",
    after: "Table 4. Imaging criteria to discriminate",
    from: "MRI\u2014chemical shift Loss of signal",
    to: "consistent with lipid-rich adenoma",
    length: 84,
    sha256: "83ff5038b674f3aa22557a6c27403f8cc212bee344ba7aa19fd5566094763de0",
    paraphrase: "Table 4: chemical-shift MRI signal loss consistent with a lipid-rich adenoma favours a benign mass.",
  },
  {
    id: "ese-table4-washout-row",
    source: "ese",
    page: 20,
    printed: "G19",
    locator: "ESE/ENSAT 2023 §5.2 Table 4, row 'CT with delayed contrast media washout', printed p. G19 (PDF page 20)",
    after: "Table 4. Imaging criteria to discriminate",
    before: "aThese criteria apply only",
    from: "CT with delayed contrast media",
    to: "Relative washout > 58%f",
    length: 54,
    sha256: "a53163ff468c9bb11f3cd0f1baa7fd2bcdf779951ff65793e2d14ea795a33d4a",
    paraphrase: "Table 4: the washout-CT criterion favouring a benign mass is RPW > 58%.",
  },
  {
    id: "ese-table4-footnote-a",
    source: "ese",
    page: 20,
    printed: "G19",
    locator: "ESE/ENSAT 2023 §5.2 Table 4 footnote a, printed p. G19 (PDF page 20)",
    after: "Table 4. Imaging criteria to discriminate",
    from: "aThese criteria apply only for",
    to: "for further characterization.",
    length: 427,
    sha256: "d802b679fdf36bff9c1fc4cfafaae61fd14be87c36e17cf01dea2563398fbe6b",
    paraphrase:
      "Table 4 criteria apply only to homogeneous (or otherwise clearly benign) masses; ROIs should cover at least 75% of the lesion without outside tissue; heterogeneous lesions should not be characterized by MRI or washout CT.",
  },
  {
    id: "ese-table4-footnote-f",
    source: "ese",
    page: 20,
    printed: "G19",
    locator: "ESE/ENSAT 2023 §5.2 Table 4 footnote f, printed p. G19 (PDF page 20)",
    after: "Table 4. Imaging criteria to discriminate",
    from: "fThis cutoff based on a",
    to: "suggest a cutoff of 40%.",
    length: 125,
    sha256: "1a0fe6310f6eb0242bec3fbc25767e44a1541dfc9122d283bc3512f831e34f61",
    paraphrase: "The 58% cutoff rests on one study of 253 tumours and needs caution; several older studies suggest 40%.",
  },
  {
    id: "ese-reference-72",
    source: "ese",
    page: 36,
    printed: "G35",
    locator: "ESE/ENSAT 2023 References, entry 72, printed p. G35 (PDF page 36)",
    from: "72. Schloetelburg W, Ebert I,",
    to: "https://doi.org/10.1530/EJE-21-0650",
    length: 197,
    sha256: "630ef8c7884cea3f35c69c4f3e1ee8db6417bf32f0fbc847b91d2539c2b15a65",
    paraphrase: "Reference 72 is Schloetelburg et al., Eur J Endocrinol 2021;186(2):183-193, doi:10.1530/EJE-21-0650.",
  },
  {
    id: "caoili-2000-thresholds",
    source: "pubmed",
    pmid: "11044054",
    label: "CONCLUSION",
    locator: "PMID 11044054 (Caoili 2000) abstract CONCLUSION",
    from: "lipid-poor adrenal adenomas show enhancement",
    to: "relative percentage washout of 40%.",
    length: 261,
    sha256: "a84cf8326fab5f0410d8aca746a77d47d41966d8a2dee525df683c2804ab1881",
    paraphrase: "Lipid-poor adenomas wash out like lipid-rich ones and separate from nonadenomas at APW 60% and RPW 40%.",
  },
  {
    id: "caoili-2002-apw-inclusive",
    source: "pubmed",
    pmid: "11867777",
    label: "MATERIALS AND METHODS",
    locator: "PMID 11867777 (Caoili 2002) abstract MATERIALS AND METHODS",
    from: "An adenoma was diagnosed if",
    to: "value of 60% or higher.",
    length: 153,
    sha256: "c6cbb3ba4f59f2c13df2943848ce97d9bd7d4533c0955cdd751bd5481e473034",
    paraphrase: "The protocol called a mass an adenoma if unenhanced attenuation was <= 10 HU or APW was >= 60%.",
  },
  {
    id: "caoili-2002-accuracy",
    source: "pubmed",
    pmid: "11867777",
    label: "RESULTS",
    locator: "PMID 11867777 (Caoili 2002) abstract RESULTS",
    from: "The sensitivity and specificity of",
    to: "92%, respectively.",
    length: 80,
    sha256: "016217b29d7fac4db80f62d58143136aec22fd4de4791657b6f156652729bf03",
    paraphrase: "That protocol had 98% sensitivity and 92% specificity.",
  },
  {
    id: "choi-2013-metastases-meet-thresholds",
    source: "pubmed",
    pmid: "23151828",
    label: "RESULTS",
    locator: "PMID 23151828 (Choi 2013) abstract RESULTS",
    from: "With a threshold of 60%",
    to: "lipid-poor adenomas by each observer.",
    length: 178,
    sha256: "f99fbd92bc4597824a93d63d0b012e30c6a6705a46ab00f9c62c1977ce98a851",
    paraphrase: "Using APW 60% or RPW 40%, 95% (18/19) and 89% (17/19) of RCC/HCC adrenal metastases were misread as lipid-poor adenomas.",
  },
  {
    id: "choi-2013-conclusion",
    source: "pubmed",
    pmid: "23151828",
    label: "CONCLUSION",
    locator: "PMID 23151828 (Choi 2013) abstract CONCLUSION",
    from: "In patients with RCC and",
    to: "tissue confirmation is needed.",
    length: 275,
    sha256: "b7681ac955490c1a73461af8776733d10fca49e818141e154c837b3b3743f96e",
    paraphrase: "In RCC or HCC patients, adrenal metastases wash out like lipid-poor adenomas, so imaging follow-up or tissue proof is required.",
  },
  {
    id: "park-2015-criteria",
    source: "pubmed",
    pmid: "26254908",
    label: "MATERIALS AND METHODS",
    locator: "PMID 26254908 (Park 2015) abstract MATERIALS AND METHODS",
    from: "Adenoma was diagnosed when a",
    to: "relative percentage washout ≥ 40%.",
    length: 196,
    sha256: "7b7360853d8bc16a119689e0cee93088e5392fc1d1012a2e1c453f44075712ac",
    paraphrase: "A lesion was called an adenoma if any criterion held: unenhanced <= 10 HU, APW >= 60% or RPW >= 40%.",
  },
  {
    id: "park-2015-large-adenoma-sensitivity",
    source: "pubmed",
    pmid: "26254908",
    label: "RESULTS",
    locator: "PMID 26254908 (Park 2015) abstract RESULTS",
    from: "CT sensitivities were 100% (60/60)",
    to: "(P < 0.001).",
    length: 139,
    sha256: "a41a02e2914c5bfb91695c937bcbf30578683b4ebf005e71fec1339054bbd477",
    paraphrase: "CT protocol sensitivity was 100% (60/60), 97.9% (46/47) and 66.7% (22/33) for small, medium and large adenomas.",
  },
  {
    id: "patel-2013-pheochromocytoma-overlap",
    source: "pubmed",
    pmid: "23789665",
    label: "RESULTS",
    locator: "PMID 23789665 (Patel 2013) abstract RESULTS",
    from: "Eight of 24 (33%) met",
    to: "diagnosis of a lipid-poor adenoma.",
    length: 128,
    sha256: "2e45cac4c3c2b21b543bde1ea8fad37464f4d11c9bfd65971efffdd79a3a3e74",
    paraphrase: "8 of 24 pheochromocytomas (33%) met relative (6/24) or absolute (7/24) washout criteria for lipid-poor adenoma.",
  },
  {
    id: "patel-2013-conclusion",
    source: "pubmed",
    pmid: "23789665",
    label: "CONCLUSION",
    locator: "PMID 23789665 (Patel 2013) abstract CONCLUSION",
    from: "A substantial minority of pheochromocytomas",
    to: "those of lipid-poor adenomas.",
    length: 141,
    sha256: "cbfe9b87f2055d37d2b46125409bd28a0398e6b29710148de5f6b28370c5eef8",
    paraphrase: "Washout values of a sizeable minority of pheochromocytomas overlap with lipid-poor adenomas.",
  },
  {
    id: "fujiyoshi-2003-sii-formula",
    source: "pubmed",
    pmid: "12760936",
    label: "MATERIALS AND METHODS",
    locator: "PMID 12760936 (Fujiyoshi 2003) abstract MATERIALS AND METHODS",
    from: "signal intensity index, calculated as",
    to: "x 100%",
    length: 170,
    sha256: "1b33964bf6005981e7c14617365aad4856163cdff94e1f998ee3a4e152124a62",
    paraphrase: "SII = 100 x (SI in-phase - SI opposed-phase) / SI in-phase.",
  },
  {
    id: "fujiyoshi-2003-sii-cutoff",
    source: "pubmed",
    pmid: "12760936",
    label: "RESULTS",
    locator: "PMID 12760936 (Fujiyoshi 2003) abstract RESULTS",
    from: "The accuracy in distinguishing adenomas",
    to: "selected was 11.2-16.5%.",
    length: 146,
    sha256: "10901e15a82e2bb2e1f660ba1fec798d7e844b32be03ce78bce1f2131821ada4",
    paraphrase: "Any SII cutoff from 11.2% to 16.5% separated adenomas from metastases with 100% accuracy in this cohort.",
  },
  {
    id: "israel-2004-sii-criterion",
    source: "pubmed",
    pmid: "15208141",
    label: "MATERIALS AND METHODS",
    locator: "PMID 15208141 (Israel 2004) abstract MATERIALS AND METHODS",
    from: "A lipid-rich adenoma was diagnosed",
    to: "follow-up imaging without change.",
    length: 300,
    sha256: "930015e47e5c9192a8e3b5fe9e9e8acaf75a9c428d36dc82897fd3b781798b6b",
    paraphrase: "Lipid-rich adenoma criteria: <= 10 HU, adrenal-to-spleen ratio < 0.71 and SII > 16.5%, or two of these plus stable follow-up.",
  },
  {
    id: "outwater-1996-lesion-to-spleen-ratios",
    source: "pubmed",
    pmid: "8756926",
    label: "MATERIALS AND METHODS",
    locator: "PMID 8756926 (Outwater 1996) abstract MATERIALS AND METHODS",
    from: "Lesion-to-spleen signal intensity ratios",
    to: "determined for each lesion.",
    length: 287,
    sha256: "77412c407885adf58267202a18b85fbcc731bf0b4115a3fcb0e3a30673b8e737",
    paraphrase: "The chemical-shift ratio compares lesion-to-spleen SI ratios measured on in-phase versus opposed-phase images.",
  },
  {
    id: "gudbjartsson-1995-magnitude-rician",
    source: "pubmed",
    pmid: "8598820",
    label: null,
    locator: "PMID 8598820 (Gudbjartsson 1995, PMC2254141) abstract",
    from: "The image intensity in magnetic",
    to: "biased due to the noise.",
    length: 205,
    sha256: "d06684a5d7e09790b0b9db9344ad86c1b88f3a0a399436999de57524a667fbb6",
    paraphrase: "Noisy MR magnitude intensities follow a Rician distribution, so low signals (SNR < 2) carry a noise bias.",
  },
  {
    id: "gudbjartsson-1995-phase-differs",
    source: "pubmed",
    pmid: "8598820",
    label: null,
    locator: "PMID 8598820 (Gudbjartsson 1995, PMC2254141) abstract",
    from: "The noise characteristics in phase",
    to: "those of the magnitude images.",
    length: 125,
    sha256: "c1427a8926210928054103c997928555dd4d9ab8bb7c8797f61a6e249b6b161e",
    paraphrase: "Noise in phase images behaves very differently from noise in magnitude images.",
  },
  {
    id: "schloetelburg-2021-apw-malignant-above-60",
    source: "pmc",
    container: "body",
    section: "Absolute percentage wash-out",
    locator: "PMC8679842 Results > 'Absolute percentage wash-out'",
    from: "Twenty-two percent of all (potentially)",
    to: "although they were not",
    length: 139,
    sha256: "c94e2a1ec6197fe598e3b03bb2e644b9430249a1e0ee92f25c1051d9caa7a623",
    paraphrase: "22% of (potentially) malignant lesions had APW above 60% and would have been misread as benign.",
  },
  {
    id: "schloetelburg-2021-rcc-metastasis-example",
    source: "pmc",
    container: "body",
    section: "Absolute percentage wash-out",
    locator: "PMC8679842 Results > 'Absolute percentage wash-out', Figure 2 caption",
    from: "APW of 78.3% and RWP",
    to: "metastasis of renal cell cancer.",
    length: 113,
    sha256: "76292dc9af70176e0985731aa5a946c799f8a6f1da0b6ae926aa42be95c41fa6",
    paraphrase: "Figure 2: an RCC metastasis with APW 78.3% and RPW 57.7% looked benign on washout.",
  },
  {
    id: "schloetelburg-2021-rpw-malignant-above-40",
    source: "pmc",
    container: "body",
    section: "Relative percentage wash-out",
    locator: "PMC8679842 Results > 'Relative percentage wash-out'",
    from: "whereas in 8% of all",
    to: "showed results higher than 40%",
    length: 136,
    sha256: "fed5b72a6c67d0c279334d782008ba6614ed96b6970a4fd59c942d50e2e5272c",
    paraphrase: "8% of (potentially) malignant lesions (one pheochromocytoma, three metastases) had RPW above 40%.",
  },
  {
    id: "schloetelburg-2021-conclusion",
    source: "pmc",
    container: "abstract",
    section: "Conclusions",
    locator: "PMC8679842 Abstract > Conclusions",
    from: "Wash-out CT with the established",
    to: "reliably diagnose adrenal masses.",
    length: 112,
    sha256: "dbddc6e4bd1edda83e0b4135064a8f9e8126a1cb755b0eaea5a2dcccf4d8f94f",
    paraphrase: "With the established APW/RPW thresholds, washout CT cannot reliably diagnose adrenal masses.",
  },
]);

// Printed equations (math). Only whitespace is removed and the typographic minus
// is mapped to "-" before comparison.
export const ESE_EQUATIONS = Object.freeze({
  page: 10,
  printed: "G9",
  locator: "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G9 (PDF page 10)",
  relative: "relative contrast enhancement washout (=100 × [HUmax\u2212HU10/15min]/HUmax)",
  absolute: "absolute contrast enhancement washout (=100 × [HUmax\u2212HU10/15min]/[HUmax\u2212HUnativ])",
});

const CT_ADENOMA = "Suggests adrenal adenoma";
const CT_INDETERMINATE = "Indeterminate / non\u2011adenoma";
const MRI_ADENOMA = "Suggests lipid\u2011rich adenoma";
const MRI_OTHER = "Non\u2011adenoma / lipid\u2011poor";
const CT_APW = "Absolute Washout (%)";
const CT_RPW = "Relative Washout (%)";
const MRI_SII = "Signal Intensity Index (%)";
const MRI_ASR = "Adrenal\u2011to\u2011Spleen CSI Ratio";
const WORD_NUMBERS = Object.freeze({ "Twenty-two": 22 });

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Final URL (host, path and pinned query parameters) and media type of a 200 response.
export function verifyArtifactResponse(artifact, { finalUrl, contentType }) {
  const url = new URL(finalUrl);
  assert.equal(url.protocol, "https:", `${artifact.id}: final URL left HTTPS`);
  assert.equal(url.hostname, artifact.host, `${artifact.id}: final URL host drifted`);
  assert.equal(url.pathname, artifact.path, `${artifact.id}: final URL path drifted`);
  for (const [name, value] of Object.entries(artifact.query ?? {})) {
    assert.equal(url.searchParams.get(name), value, `${artifact.id}: final URL query ${name} drifted`);
  }
  const mediaType = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, artifact.media_type, `${artifact.id}: media type drifted (${contentType ?? "<missing>"})`);
  return { final_url: url.href, media_type: mediaType };
}

// Exact bytes first: nothing is parsed from a response that is not the pinned artifact.
export function verifyArtifactBytes(artifact, bytes) {
  assert.ok(Buffer.isBuffer(bytes), `${artifact.id}: source bytes missing`);
  assert.equal(
    bytes.length,
    artifact.bytes,
    `${artifact.id}: source byte length drifted (${bytes.length}, pinned ${artifact.bytes}); re-review the source before re-pinning`,
  );
  const digest = sha256(bytes);
  assert.equal(
    digest,
    artifact.sha256,
    `${artifact.id}: source SHA-256 drifted (${digest}); re-review the source before re-pinning`,
  );
  return digest;
}

// Retries transport failures only (network errors and the artifact's retry statuses).
// A 200 response that misses its URL, media-type, length or digest pin is a changed
// source and fails at once.
export async function fetchArtifact(artifact, { fetchImpl = fetch, sleep = delay } = {}) {
  const attempts = 5;
  const retryStatuses = artifact.retry_statuses ?? DEFAULT_RETRY_STATUSES;
  let lastFailure = "unknown retrieval failure";
  let made = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    made = attempt;
    let response = null;
    let retryAfterMs = 0;
    try {
      response = await fetchImpl(artifact.url, {
        headers: { "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (response?.ok) {
      const identity = verifyArtifactResponse(artifact, {
        finalUrl: response.url,
        contentType: response.headers.get("content-type"),
      });
      let bytes = null;
      try {
        bytes = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        lastFailure = `body read failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      if (bytes) {
        verifyArtifactBytes(artifact, bytes);
        return { bytes, ...identity, attempts: attempt };
      }
    } else if (response) {
      let detail = "";
      if (typeof response.text === "function") {
        detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 160);
      } else {
        await response.body?.cancel?.();
      }
      lastFailure = `HTTP ${response.status}${detail ? `: ${detail}` : ""}`;
      if (!retryStatuses.includes(response.status)) break;
      const retryAfter = Number(response.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = Math.min(retryAfter, 30) * 1_000;
    }
    if (attempt < attempts) await sleep(Math.max(retryAfterMs, attempt * 2_000));
  }
  assert.fail(`${artifact.id}: primary-source retrieval failed after ${made} attempt(s) (${lastFailure})`);
}

const DASHES = /[\u002D\u00AD\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;
const QUOTES = /[\u0022\u0027\u2018\u2019\u201C\u201D]/g;

// PDF comparison: case-folded; whitespace, dashes (line-break hyphenation) and
// quotation marks removed. Digits, punctuation and symbols such as % > ≥ remain.
export function compactProse(text) {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, "").replace(DASHES, "").replace(QUOTES, "");
}

// Equation comparison: whitespace removed and the typographic minus mapped to "-".
export function compactEquation(text) {
  return text.normalize("NFKC").replace(/\s+/g, "").replace(/[\u2212\u2013]/g, "-");
}

// XML (PubMed/PMC) comparison: NFC with whitespace collapsed; case preserved.
export function normalizeSentence(text) {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

// Counts words the strict way: hyphenated and dash-joined words count separately.
export function markerWordCount(marker) {
  return marker.trim().split(/[\s\u2010-\u2015\u2212-]+/).filter(Boolean).length;
}

function countOccurrences(haystack, needle) {
  let count = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) count += 1;
  return count;
}

async function pdfPages(bytes) {
  const document = await getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(({ str }) => str).join(" "));
  }
  await document.destroy();
  return pages;
}

function printedFooter(label) {
  const number = Number(label.slice(1));
  return number % 2 === 1
    ? compactProse(`Fassnacht et al. ${label} Downloaded from`)
    : compactProse(`${label} European Journal of Endocrinology, 2023, Vol. 189, No. 1 Downloaded from`);
}

export function assertEseEquations(pages) {
  const page = pages[ESE_EQUATIONS.page - 1] ?? "";
  assert.ok(
    compactProse(page).includes(printedFooter(ESE_EQUATIONS.printed)),
    `ESE equations: PDF page ${ESE_EQUATIONS.page} is not printed page ${ESE_EQUATIONS.printed}`,
  );
  const equationText = compactEquation(page);
  for (const key of ["relative", "absolute"]) {
    assert.equal(
      countOccurrences(equationText, compactEquation(ESE_EQUATIONS[key])),
      1,
      `ESE ${key} washout equation is missing from or repeated on ${ESE_EQUATIONS.locator}`,
    );
  }
}

function decodeXml(fragment) {
  const named = new Map([
    ["amp", "&"],
    ["lt", "<"],
    ["gt", ">"],
    ["quot", '"'],
    ["apos", "'"],
  ]);
  return normalizeSentence(
    fragment
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
      .replace(/&([a-z]+);/gi, (entity, name) => named.get(name.toLowerCase()) ?? entity),
  );
}

const NOTICE_BLOCK =
  /^(Comment (in|on)|Erratum (in|for)|Update (in|of)|Retraction (in|of)|Expression of concern (in|for)|Republished (in|from)|Conflict of interest|Copyright|©|DOI:|PMID:|PMCID:)/;
const LINKED_NOTICE = /^(Comment (in|on)|Erratum (in|for)|Update (in|of)|Retraction (in|of)|Expression of concern (in|for)|Republished (in|from))/;

// PubMed plain-text abstract layout: blank-line separated blocks for the citation,
// title, authors, author information, linked-record notices, abstract, copyright and
// identifiers. The abstract is the first block after the author information that is
// not a notice.
export function parseRecordText(text) {
  const blocks = text.split(/\n[ \t]*\n/).map((block) => block.trim()).filter(Boolean);
  const infoIndex = blocks.findIndex((block) => block.startsWith("Author information:"));
  assert.ok(infoIndex >= 2, "PubMed record lacks the author-information block");
  const after = blocks.slice(infoIndex + 1);
  const abstractIndex = after.findIndex((block) => !NOTICE_BLOCK.test(block));
  assert.ok(abstractIndex >= 0, "PubMed record lacks an abstract block");
  const notices = after.slice(0, abstractIndex).map(normalizeSentence);
  for (const notice of notices) {
    assert.match(notice, LINKED_NOTICE, "PubMed record has an unexpected block before its abstract");
  }
  const citation = normalizeSentence(blocks[0]);
  return {
    citation,
    title: normalizeSentence(blocks[1]),
    notices,
    abstract: normalizeSentence(after[abstractIndex]),
    year: citation.match(/\. (\d{4}) [A-Z][a-z]{2}\b/)?.[1] ?? "",
    doi: text.match(/^DOI: (\S+)$/m)?.[1] ?? "",
    pmid: text.match(/^PMID: (\d+)/m)?.[1] ?? "",
    pmcid: text.match(/^PMCID: (PMC\d+)$/m)?.[1] ?? null,
  };
}

// Splits a labelled abstract ("LABEL: text ...") into its sections; an unlabelled
// abstract is one section keyed null. The labels must match the pinned sequence.
export function recordSections(record, expectedLabels) {
  const labels = [...record.abstract.matchAll(/(?:^|\s)([A-Z][A-Z ]{3,}): /g)];
  assert.deepEqual(
    labels.map((label) => label[1]),
    [...expectedLabels],
    `PMID ${record.pmid}: abstract section labels drifted`,
  );
  if (labels.length === 0) return new Map([[null, record.abstract]]);
  assert.equal(labels[0].index, 0, `PMID ${record.pmid}: text precedes the first abstract label`);
  const sections = new Map();
  labels.forEach((label, index) => {
    const end = index + 1 < labels.length ? labels[index + 1].index : record.abstract.length;
    sections.set(label[1], record.abstract.slice(label.index + label[0].length, end).trim());
  });
  return sections;
}

export function verifyRecord(artifact, record) {
  assert.equal(record.pmid, artifact.pmid, `PMID ${artifact.pmid}: record identifier drifted`);
  assert.equal(record.doi, artifact.doi, `PMID ${artifact.pmid}: DOI drifted`);
  assert.equal(record.year, artifact.year, `PMID ${artifact.pmid}: publication year drifted`);
  assert.equal(record.pmcid, artifact.pmcid, `PMID ${artifact.pmid}: PMCID drifted`);
  assert.deepEqual(record.notices, [...artifact.notices], `PMID ${artifact.pmid}: linked-record notices drifted`);
  assert.ok(record.abstract.length > 0, `PMID ${artifact.pmid}: abstract missing`);
  return { ...record, sections: recordSections(record, artifact.labels) };
}

function pmcSections(xml, container) {
  const scope = xml.match(new RegExp(`<${container}(?=[\\s>])[^>]*>([\\s\\S]*?)</${container}>`))?.[1];
  assert.ok(scope, `PMC article lacks <${container}>`);
  const sections = new Map();
  for (const opening of scope.matchAll(/<sec(?=[\s>])[^>]*>\s*<title>([\s\S]*?)<\/title>/g)) {
    const title = decodeXml(opening[1]);
    const tag = /<\/?sec(?=[\s>])[^>]*>/g;
    tag.lastIndex = opening.index;
    let depth = 0;
    let end = -1;
    for (let token = tag.exec(scope); token; token = tag.exec(scope)) {
      depth += token[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = token.index;
        break;
      }
    }
    assert.notEqual(end, -1, `PMC ${container} section "${title}" is unterminated`);
    assert.ok(!sections.has(title), `PMC ${container} section title "${title}" is not unique`);
    sections.set(title, decodeXml(scope.slice(opening.index, end)));
  }
  return { sections, text: decodeXml(scope) };
}

// Retrieves all eleven artifacts. The White Rose PDF is fetched in parallel; NCBI
// requests (PMC, then the nine PubMed records) run one at a time, spaced.
export async function retrieveSources({ fetchImpl = fetch, sleep = delay, spacingMs = NCBI_SPACING_MS } = {}) {
  const options = { fetchImpl, sleep };
  const esePromise = fetchArtifact(ESE_PDF, options);
  esePromise.catch(() => {});
  const pubmedArtifacts = Object.values(PUBMED_RECORDS);
  const ncbi = [];
  for (const [index, artifact] of [PMC_ARTICLE, ...pubmedArtifacts].entries()) {
    if (index > 0) await sleep(spacingMs);
    ncbi.push(await fetchArtifact(artifact, options));
  }
  const [pmc, ...pubmed] = ncbi;
  return {
    ese: await esePromise,
    pmc,
    pubmed: new Map(pubmedArtifacts.map((artifact, index) => [artifact.pmid, pubmed[index]])),
  };
}

// Verifies the exact bytes of all eleven artifacts again before any of them is
// parsed, then prepares the normalized locator texts the statements are checked
// against.
export async function parseSources(retrieved) {
  verifyArtifactBytes(ESE_PDF, retrieved.ese?.bytes);
  verifyArtifactBytes(PMC_ARTICLE, retrieved.pmc?.bytes);
  for (const artifact of Object.values(PUBMED_RECORDS)) {
    verifyArtifactBytes(artifact, retrieved.pubmed?.get(artifact.pmid)?.bytes);
  }

  const pages = await pdfPages(retrieved.ese.bytes);
  assert.equal(pages.length, ESE_PDF.pages, "ESE/ENSAT PDF page count drifted");
  const cover = compactProse(pages[0]);
  for (const identity of [
    "https://eprints.whiterose.ac.uk/id/eprint/208070/",
    "Version: Published Version",
    "https://doi.org/10.1093/ejendo/lvad066",
    "Creative Commons Attribution (CC BY) licence",
  ]) {
    assert.ok(cover.includes(compactProse(identity)), `ESE/ENSAT deposit cover lacks: ${identity}`);
  }
  assertEseEquations(pages);

  const pmcXml = retrieved.pmc.bytes.toString("utf8");
  assert.match(pmcXml, /<article-id pub-id-type="pmcid">PMC8679842<\/article-id>/, "PMC article id drifted");
  assert.match(pmcXml, /<article-id pub-id-type="doi">10\.1530\/EJE-21-0650<\/article-id>/, "PMC DOI drifted");
  assert.match(pmcXml, /creativecommons\.org\/licenses\/by\/4\.0\//, "PMC license is no longer CC BY 4.0");

  const pubmed = new Map();
  for (const artifact of Object.values(PUBMED_RECORDS)) {
    const text = retrieved.pubmed.get(artifact.pmid).bytes.toString("utf8");
    pubmed.set(artifact.pmid, verifyRecord(artifact, parseRecordText(text)));
  }
  return {
    retrieved,
    ese: { pages: pages.map(compactProse), document: compactProse(pages.join(" ")) },
    pmc: { abstract: pmcSections(pmcXml, "abstract"), body: pmcSections(pmcXml, "body") },
    pubmed,
  };
}

export async function loadSources(options) {
  return parseSources(await retrieveSources(options));
}

function normalizerFor(statement) {
  return statement.source === "ese" ? compactProse : normalizeSentence;
}

// Normalized text of a statement's locator, plus the enclosing document text used
// for the uniqueness check.
export function locateStatement(sources, statement) {
  if (statement.source === "ese") {
    const page = sources.ese.pages[statement.page - 1];
    assert.ok(page !== undefined, `${statement.id}: PDF page ${statement.page} is missing`);
    assert.ok(
      page.includes(printedFooter(statement.printed)),
      `${statement.id}: PDF page ${statement.page} is not printed page ${statement.printed}`,
    );
    return { text: page, scope: sources.ese.document, scopeName: "the ESE/ENSAT guideline" };
  }
  if (statement.source === "pubmed") {
    const record = sources.pubmed.get(statement.pmid);
    assert.ok(record, `${statement.id}: PMID ${statement.pmid} was not retrieved`);
    const section = record.sections.get(statement.label);
    assert.ok(section !== undefined, `${statement.id}: PMID ${statement.pmid} lacks abstract section ${statement.label ?? "(unlabelled)"}`);
    return { text: section, scope: record.abstract, scopeName: `PMID ${statement.pmid} abstract` };
  }
  assert.equal(statement.source, "pmc", `${statement.id}: unknown source ${statement.source}`);
  const container = sources.pmc[statement.container];
  assert.ok(container, `${statement.id}: PMC ${statement.container} is missing`);
  const section = container.sections.get(statement.section);
  assert.ok(section, `${statement.id}: PMC ${statement.container} section "${statement.section}" is missing`);
  return { text: section, scope: container.text, scopeName: `PMC8679842 ${statement.container}` };
}

export function spanOf(text, statement) {
  const normalize = normalizerFor(statement);
  const from = normalize(statement.from);
  const to = normalize(statement.to);
  const start = text.indexOf(from);
  assert.ok(start >= 0, `${statement.id}: start marker ${JSON.stringify(statement.from)} is missing at ${statement.locator}`);
  assert.equal(text.indexOf(from, start + 1), -1, `${statement.id}: start marker is not unique at ${statement.locator}`);
  const toAt = text.indexOf(to, start + from.length);
  assert.ok(toAt >= 0, `${statement.id}: end marker ${JSON.stringify(statement.to)} is missing after the start marker`);
  const end = toAt + to.length;
  if (statement.after) {
    const after = text.indexOf(normalize(statement.after));
    assert.ok(after >= 0 && after < start, `${statement.id}: span is not after ${JSON.stringify(statement.after)}`);
  }
  if (statement.before) {
    assert.notEqual(
      text.indexOf(normalize(statement.before), end),
      -1,
      `${statement.id}: span is not before ${JSON.stringify(statement.before)}`,
    );
  }
  return { start, end, interiorStart: start + from.length, interiorEnd: toAt, value: text.slice(start, end) };
}

export function checkStatementText(statement, text, scope, scopeName = "its source") {
  const span = spanOf(text, statement);
  const length = span.value.length;
  const digest = sha256(span.value);
  assert.ok(
    length === statement.length && digest === statement.sha256,
    `${statement.id}: pinned span drifted at ${statement.locator} (expected ${statement.length}/${statement.sha256}, got ${length}/${digest}); re-review the source before re-pinning`,
  );
  assert.equal(countOccurrences(scope, span.value), 1, `${statement.id}: span is not unique in ${scopeName}`);
  return { length, sha256: digest, value: span.value };
}

export function verifyStatements(sources) {
  const verified = new Map();
  for (const statement of STATEMENTS) {
    const { text, scope, scopeName } = locateStatement(sources, statement);
    verified.set(statement.id, checkStatementText(statement, text, scope, scopeName));
  }
  return verified;
}

function onlyMatch(spans, id, pattern, label) {
  const span = spans.get(id);
  assert.ok(span, `${label}: statement ${id} was not verified`);
  const matches = [...span.value.matchAll(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`))];
  assert.equal(matches.length, 1, `${label}: expected exactly one match in ${id}`);
  return matches[0];
}

// Numeric criteria are read from the verified spans (never hard-coded) and cross-checked.
export function sourceThresholds(spans) {
  // Park 2015 (calculator reference): adenoma when any one criterion holds.
  onlyMatch(spans, "park-2015-criteria", /one of the following criteria/, "Park 2015 any-criterion rule");
  onlyMatch(spans, "park-2015-criteria", /, or \(c\) relative/, "Park 2015 or-combination");
  const parkApw = onlyMatch(spans, "park-2015-criteria", /absolute percentage washout (≥) (\d+)%/, "Park 2015 APW");
  const parkRpw = onlyMatch(spans, "park-2015-criteria", /relative percentage washout (≥) (\d+)%/, "Park 2015 RPW");
  const apw = Number(parkApw[2]);
  const rpw = Number(parkRpw[2]);

  const caoiliApw = onlyMatch(spans, "caoili-2000-thresholds", /threshold value of (\d+)%/, "Caoili 2000 APW");
  const caoiliRpw = onlyMatch(spans, "caoili-2000-thresholds", /relative percentage washout of (\d+)%/, "Caoili 2000 RPW");
  const caoili2002 = onlyMatch(spans, "caoili-2002-apw-inclusive", /washout value of (\d+)% or higher/, "Caoili 2002 APW");
  assert.equal(Number(caoiliApw[1]), apw, "Caoili 2000 and Park 2015 APW thresholds disagree");
  assert.equal(Number(caoiliRpw[1]), rpw, "Caoili 2000 and Park 2015 RPW thresholds disagree");
  assert.equal(Number(caoili2002[1]), apw, "Caoili 2002 and Park 2015 APW thresholds disagree");

  const choiThresholds = onlyMatch(spans, "choi-2013-metastases-meet-thresholds", /(\d+)% for APW or (\d+)% for RPW/, "Choi 2013 thresholds");
  const choi = onlyMatch(
    spans,
    "choi-2013-metastases-meet-thresholds",
    /(\d+)% \((\d+) of (\d+)\) and (\d+)% \((\d+) of (\d+)\)/,
    "Choi 2013 misclassification",
  );
  assert.equal(Number(choiThresholds[1]), apw, "Choi 2013 tested a different APW threshold");
  assert.equal(Number(choiThresholds[2]), rpw, "Choi 2013 tested a different RPW threshold");
  assert.equal(Math.round((100 * Number(choi[2])) / Number(choi[3])), Number(choi[1]), "Choi 2013 APW fraction");
  assert.equal(Math.round((100 * Number(choi[5])) / Number(choi[6])), Number(choi[4]), "Choi 2013 RPW fraction");

  const large = onlyMatch(spans, "park-2015-large-adenoma-sensitivity", /(\d+\.\d)% \((\d+)\/(\d+)\) for large adenomas/, "Park 2015 large adenomas");
  assert.equal(Math.round((1000 * Number(large[2])) / Number(large[3])) / 10, Number(large[1]), "Park 2015 large-adenoma fraction");

  // ESE/ENSAT 2023 (compacted PDF text) and the study it cites.
  const eseApw = onlyMatch(spans, "ese-washout-cutoffs-low-evidence", /cutoffof(\d+)%forabsolutewashout/, "ESE APW cutoff");
  const eseRpw = onlyMatch(spans, "ese-washout-cutoffs-low-evidence", /cutoffof(\d+)%forrelativewashout/, "ESE RPW cutoff");
  const eseMissed = onlyMatch(spans, "ese-washout-malignant-misses", /(\d+)%\(usingabsolutewashout\)and(\d+)%\(relativewashout\)/, "ESE missed malignancies");
  const table4 = onlyMatch(spans, "ese-table4-washout-row", /relativewashout>(\d+)%/, "ESE Table 4 RPW criterion");
  const olderRpw = onlyMatch(spans, "ese-table4-footnote-f", /suggestacutoffof(\d+)%/, "ESE Table 4 footnote f");
  assert.equal(Number(eseApw[1]), apw, "ESE and Park 2015 APW cutoffs disagree");
  assert.equal(Number(eseRpw[1]), rpw, "ESE and Park 2015 RPW cutoffs disagree");
  assert.equal(Number(olderRpw[1]), rpw, "ESE footnote f no longer cites the conventional RPW cutoff");
  const studyApw = onlyMatch(spans, "schloetelburg-2021-apw-malignant-above-60", /^(Twenty-two) percent of all .* APW above (\d+)%/, "Schloetelburg APW");
  const studyRpw = onlyMatch(spans, "schloetelburg-2021-rpw-malignant-above-40", /^whereas in (\d+)% of all .* higher than (\d+)%$/, "Schloetelburg RPW");
  assert.equal(WORD_NUMBERS[studyApw[1]], Number(eseMissed[1]), "ESE and Schloetelburg APW miss rates disagree");
  assert.equal(Number(studyRpw[1]), Number(eseMissed[2]), "ESE and Schloetelburg RPW miss rates disagree");
  assert.equal(Number(studyApw[2]), apw, "Schloetelburg APW threshold differs");
  assert.equal(Number(studyRpw[2]), rpw, "Schloetelburg RPW threshold differs");

  const fujiyoshi = onlyMatch(spans, "fujiyoshi-2003-sii-cutoff", /selected was (\d+\.\d)-(\d+\.\d)%/, "Fujiyoshi 2003 cutoff range");
  const israel = onlyMatch(spans, "israel-2004-sii-criterion", /index of (greater than) (\d+\.\d)%/, "Israel 2004 SII criterion");
  const sii = Number(fujiyoshi[2]);
  assert.equal(Number(israel[2]), sii, "Israel 2004 and Fujiyoshi 2003 SII values disagree");

  return {
    ct: {
      apw,
      rpw,
      apwOperator: parkApw[1],
      rpwOperator: parkRpw[1],
      combination: "or",
      largeAdenomaSensitivity: Number(large[1]),
    },
    choi: { apw: `${choi[1]}% (${choi[2]}/${choi[3]})`, rpw: `${choi[4]}% (${choi[5]}/${choi[6]})` },
    ese: {
      missedApw: Number(eseMissed[1]),
      missedRpw: Number(eseMissed[2]),
      table4Rpw: Number(table4[1]),
      olderRpw: Number(olderRpw[1]),
    },
    park: { largeAdenomas: `${large[1]}% (${large[2]}/${large[3]})` },
    mri: { sii, siiRangeLow: Number(fujiyoshi[1]), laterCriterion: `${israel[1]} ${israel[2]}%` },
  };
}

const numeric = (inputs) => Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, Number(value)]));
// ESE/ENSAT 2023 §2.3 equations, transcribed from the verified printed equations.
const eseRpw = ({ portal, delayed }) => (100 * (portal - delayed)) / portal;
const eseApw = ({ unenh, portal, delayed }) => (100 * (portal - delayed)) / (portal - unenh);
// Fujiyoshi 2003 signal intensity index (pinned statement fujiyoshi-2003-sii-formula).
const fujiyoshiSii = ({ a_ip, a_op }) => ((a_ip - a_op) / a_ip) * 100;

function assertErrorOnly(result, label) {
  assert.deepEqual(Object.keys(result), ["Error"], `${label}: must return an Error and nothing else`);
  assert.equal(typeof result.Error, "string", `${label}: Error must be text`);
  assert.doesNotMatch(result.Error, /NaN|Infinity|adenoma/i, `${label}: Error must not carry a diagnosis`);
}

export const CT_FORMULA_VECTORS = Object.freeze([
  { unenh: "10", portal: "100", delayed: "40" },
  { unenh: "20", portal: "80", delayed: "70" },
  { unenh: "-20", portal: "100", delayed: "40" },
  { unenh: "5", portal: "80", delayed: "35" },
  { unenh: "35", portal: "120", delayed: "95" },
]);

export function ctBoundaryVectors({ apw, rpw }) {
  return [
    { id: "apw-at-threshold", inputs: { unenh: "50", portal: "100", delayed: "70" }, apw: apw.toFixed(1), rpw: "30.0", interpretation: CT_ADENOMA },
    { id: "apw-below-threshold", inputs: { unenh: "50", portal: "100", delayed: "70.05" }, apw: (apw - 0.1).toFixed(1), rpw: "30.0", interpretation: CT_INDETERMINATE },
    { id: "rpw-at-threshold", inputs: { unenh: "20", portal: "100", delayed: "60" }, apw: "50.0", rpw: rpw.toFixed(1), interpretation: CT_ADENOMA },
    { id: "rpw-below-threshold", inputs: { unenh: "20", portal: "100", delayed: "60.1" }, apw: "49.9", rpw: (rpw - 0.1).toFixed(1), interpretation: CT_INDETERMINATE },
    { id: "smoke-5-80-35", inputs: { unenh: "5", portal: "80", delayed: "35" }, apw: "60.0", rpw: "56.3", interpretation: CT_ADENOMA },
  ];
}

export function bindCtRuntime(thresholds, { appSource, ctSource }) {
  const { apw: apwThreshold, rpw: rpwThreshold } = thresholds;
  assert.match(ctSource, /const enhancement = portal - unenh;/, "runtime APW denominator drifted from ESE §2.3");
  assert.match(ctSource, /const decrease = portal - delayed;/, "runtime washout numerator drifted from ESE §2.3");
  assert.match(ctSource, /const apw = \(decrease \/ enhancement\) \* 100;/, "runtime APW expression drifted");
  assert.match(ctSource, /const rpw = \(decrease \/ portal\) \* 100;/, "runtime RPW expression drifted");
  assert.match(
    ctSource,
    new RegExp(`apw >= ${apwThreshold} \\|\\| rpw >= ${rpwThreshold}`),
    "runtime CT decision rule no longer matches the source criteria",
  );
  const labels = Object.fromEntries(AdrenalCTWashout.fields.map(({ id, label }) => [id, label]));
  assert.match(labels.unenh, /^Pre/, "CT unenhanced (HUnativ) field label drifted");
  assert.match(labels.portal, /60/, "CT HUmax field must remain the 60-second phase");
  assert.match(labels.delayed, /15 min/, "CT delayed field must remain the 15-minute phase");

  for (const inputs of CT_FORMULA_VECTORS) {
    const result = AdrenalCTWashout.compute({ ...inputs });
    const values = numeric(inputs);
    assert.equal(result.Error, undefined, `CT ${JSON.stringify(inputs)}: unexpected Error`);
    assert.equal(result[CT_APW], eseApw(values).toFixed(1), `CT ${JSON.stringify(inputs)}: APW differs from ESE equation`);
    assert.equal(result[CT_RPW], eseRpw(values).toFixed(1), `CT ${JSON.stringify(inputs)}: RPW differs from ESE equation`);
  }

  const boundaries = ctBoundaryVectors(thresholds);
  for (const boundary of boundaries) {
    const result = AdrenalCTWashout.compute({ ...boundary.inputs });
    const values = numeric(boundary.inputs);
    const sourceAdenoma = eseApw(values) >= apwThreshold || eseRpw(values) >= rpwThreshold;
    assert.equal(result[CT_APW], boundary.apw, `${boundary.id}: APW display`);
    assert.equal(result[CT_RPW], boundary.rpw, `${boundary.id}: RPW display`);
    assert.equal(
      result.Interpretation,
      sourceAdenoma ? CT_ADENOMA : CT_INDETERMINATE,
      `${boundary.id}: runtime interpretation differs from the source criteria`,
    );
    assert.equal(result.Interpretation, boundary.interpretation, `${boundary.id}: boundary vector drifted`);
    assert.equal(result._severity, sourceAdenoma ? "success" : "warning", `${boundary.id}: severity`);
    if (sourceAdenoma) {
      assert.doesNotMatch(
        Object.values(result).join(" "),
        /benign|indicates|diagnostic of|confirms|definite/i,
        `${boundary.id}: runtime overstates certainty`,
      );
    }
  }

  // Undefined source equations must not produce a diagnosis.
  assertErrorOnly(AdrenalCTWashout.compute({}), "CT missing inputs");
  assertErrorOnly(AdrenalCTWashout.compute({ unenh: "10", portal: "0", delayed: "5" }), "CT HUmax = 0 (RPW denominator)");
  assertErrorOnly(AdrenalCTWashout.compute({ unenh: "10", portal: "10", delayed: "0" }), "CT HUmax = HUnativ (APW denominator)");
  assertErrorOnly(AdrenalCTWashout.compute({ unenh: "10", portal: "100", delayed: "Infinity" }), "CT non-finite delayed HU");
  assert.equal(
    AdrenalCTWashout.compute({ unenh: "-20", portal: "100", delayed: "40" }).Error,
    undefined,
    "CT must accept signed HU (water is 0 HU)",
  );

  // The removed App.jsx banner turned APW >= 60% into benignity. ESE §4.1.1,
  // Schloetelburg 2021, Choi 2013 and Patel 2013 report malignant lesions and
  // pheochromocytomas above that threshold.
  assert.doesNotMatch(appSource, /benign adenoma/i, "App.jsx still asserts benign adenoma");
  assert.doesNotMatch(appSource, /def\.id === "adrenal-ct"/, "App.jsx still has an adrenal-ct interpretive banner");
  assert.ok(
    AdrenalCTWashout.info.text.includes(
      "Caveat: Washout measurements may be the same in adenomas and metastases from hypervascular extraadrenal primary tumors, e.g. renal cell carcinoma (RCC) or hepatocellular carcinoma (HCC).",
    ),
    "CT hypervascular-metastasis caveat (Choi 2013) is missing",
  );
  assert.ok(
    AdrenalCTWashout.info.text.includes(`(${thresholds.largeAdenomaSensitivity}%)`) &&
      AdrenalCTWashout.info.text.includes("(≥ 3 cm)"),
    "CT large-adenoma caveat no longer matches Park 2015",
  );
  return boundaries.map(({ id, apw, rpw, interpretation }) => ({ id, apw, rpw, interpretation }));
}

export function mriBoundaryVectors({ sii }) {
  return [
    { id: "sii-above-threshold", inputs: { a_ip: "1000", a_op: "834", s_ip: "100", s_op: "100" }, sii: (sii + 0.1).toFixed(1), interpretation: MRI_ADENOMA },
    { id: "sii-at-threshold", inputs: { a_ip: "200", a_op: "167", s_ip: "100", s_op: "100" }, sii: sii.toFixed(1), interpretation: MRI_ADENOMA },
    { id: "sii-below-threshold", inputs: { a_ip: "1000", a_op: "836", s_ip: "100", s_op: "100" }, sii: (sii - 0.1).toFixed(1), interpretation: MRI_OTHER },
    { id: "zero-opposed-phase-magnitude", inputs: { a_ip: "100", a_op: "0", s_ip: "100", s_op: "100" }, sii: "100.0", interpretation: MRI_ADENOMA },
  ];
}

export function bindMriRuntime(thresholds, { mriSource }) {
  const { sii: siiThreshold } = thresholds;
  assert.match(mriSource, /const siIdx = \(\(a_ip - a_op\) \/ a_ip\) \* 100;/, "runtime SII drifted from Fujiyoshi 2003");
  assert.match(mriSource, /const opposedRatio = a_op \/ s_op;/, "runtime opposed-phase lesion-to-spleen ratio drifted");
  assert.match(mriSource, /const inPhaseRatio = a_ip \/ s_ip;/, "runtime in-phase lesion-to-spleen ratio drifted");
  assert.match(mriSource, /const csiRatio = opposedRatio \/ inPhaseRatio;/, "runtime chemical-shift ratio drifted");
  assert.match(
    mriSource,
    new RegExp(`siIdx >= ${String(siiThreshold).replace(".", "\\.")}\\b`),
    "runtime SII threshold no longer matches the source cutoff",
  );

  const boundaries = mriBoundaryVectors(thresholds);
  for (const boundary of boundaries) {
    const result = AdrenalMRICSI.compute({ ...boundary.inputs });
    const values = numeric(boundary.inputs);
    assert.equal(result.Error, undefined, `${boundary.id}: unexpected Error`);
    assert.equal(result[MRI_SII], fujiyoshiSii(values).toFixed(1), `${boundary.id}: SII differs from Fujiyoshi 2003`);
    assert.equal(result[MRI_SII], boundary.sii, `${boundary.id}: SII display`);
    assert.equal(
      result[MRI_ASR],
      (values.a_op / values.s_op / (values.a_ip / values.s_ip)).toFixed(2),
      `${boundary.id}: lesion-to-spleen chemical-shift ratio`,
    );
    const sourceSide = fujiyoshiSii(values) > siiThreshold ? MRI_ADENOMA : fujiyoshiSii(values) < siiThreshold ? MRI_OTHER : null;
    if (sourceSide) {
      assert.equal(result.Interpretation, sourceSide, `${boundary.id}: runtime interpretation differs from the source cutoff`);
    }
    assert.equal(result.Interpretation, boundary.interpretation, `${boundary.id}: boundary vector drifted`);
  }

  // Magnitude-image domain (Gudbjartsson 1995) and undefined ratios.
  assertErrorOnly(AdrenalMRICSI.compute({}), "MRI missing inputs");
  assertErrorOnly(AdrenalMRICSI.compute({ a_ip: "100", a_op: "-1", s_ip: "100", s_op: "100" }), "MRI negative magnitude");
  assertErrorOnly(AdrenalMRICSI.compute({ a_ip: "0", a_op: "0", s_ip: "100", s_op: "100" }), "MRI SII denominator = 0");
  assertErrorOnly(AdrenalMRICSI.compute({ a_ip: "100", a_op: "50", s_ip: "0", s_op: "100" }), "MRI in-phase spleen = 0");
  assertErrorOnly(AdrenalMRICSI.compute({ a_ip: "100", a_op: "50", s_ip: "100", s_op: "0" }), "MRI opposed-phase spleen = 0");
  for (const sentence of [
    "Enter magnitude-image ROI signal intensities, not signed phase, real/imaginary, or background-subtracted values.",
    "Use technically adequate matched ROIs; defined arithmetic does not establish reliable interpretation of near-zero or noisy signals.",
    "Lipid-poor adenomas, metastases, hemorrhage, and technical factors can overlap",
  ]) {
    assert.ok(AdrenalMRICSI.info.text.includes(sentence), `MRI info text lacks: ${sentence}`);
  }
  const exact = AdrenalMRICSI.compute({ ...boundaries[1].inputs });
  return {
    boundaries: boundaries.map(({ id, sii, interpretation }) => ({ id, sii, interpretation })),
    exactThresholdInterpretation: exact.Interpretation,
  };
}

async function main() {
  const sources = await loadSources();
  const spans = verifyStatements(sources);
  const thresholds = sourceThresholds(spans);

  const [appSource, ctSource, mriSource] = await Promise.all([
    readFile(APP_PATH, "utf8"),
    readFile(CT_PATH, "utf8"),
    readFile(MRI_PATH, "utf8"),
  ]);
  const ctBoundaries = bindCtRuntime(thresholds.ct, { appSource, ctSource });
  const mri = bindMriRuntime(thresholds.mri, { mriSource });
  const { ese, pmc, pubmed } = sources.retrieved;

  const audit = {
    schema: "radulator-adrenal-primary-source-audit/v1",
    calculator_ids: ["adrenal-ct", "adrenal-mri"],
    artifacts: [
      {
        id: ESE_PDF.id,
        doi: ESE_PDF.doi,
        final_url: ese.final_url,
        media_type: ese.media_type,
        bytes: ese.bytes.length,
        sha256: sha256(ese.bytes),
        digest_scope: ESE_PDF.digest_scope,
        pages: ESE_PDF.pages,
        license: ESE_PDF.license,
      },
      {
        id: PMC_ARTICLE.id,
        doi: PMC_ARTICLE.doi,
        pmcid: PMC_ARTICLE.pmcid,
        final_url: pmc.final_url,
        media_type: pmc.media_type,
        bytes: pmc.bytes.length,
        sha256: sha256(pmc.bytes),
        digest_scope: PMC_ARTICLE.digest_scope,
        license: PMC_ARTICLE.license,
      },
      ...Object.values(PUBMED_RECORDS).map((artifact) => {
        const retrieved = pubmed.get(artifact.pmid);
        return {
          id: artifact.id,
          pmid: artifact.pmid,
          doi: artifact.doi,
          final_url: retrieved.final_url,
          media_type: retrieved.media_type,
          bytes: retrieved.bytes.length,
          sha256: sha256(retrieved.bytes),
          digest_scope: artifact.digest_scope,
          linked_notices: [...artifact.notices],
        };
      }),
    ],
    source_statements: STATEMENTS.map(({ id, source, locator, from, to, paraphrase }) => ({
      id,
      source,
      locator,
      from,
      to,
      length: spans.get(id).length,
      sha256: spans.get(id).sha256,
      paraphrase,
    })),
    ese_equations: ESE_EQUATIONS.locator,
    source_claims: {
      rpw_equation: "100 x (HUmax - HU10/15min) / HUmax",
      apw_equation: "100 x (HUmax - HU10/15min) / (HUmax - HUnativ)",
      washout_criteria: `APW ${thresholds.ct.apwOperator} ${thresholds.ct.apw}% ${thresholds.ct.combination} RPW ${thresholds.ct.rpwOperator} ${thresholds.ct.rpw}%`,
      malignant_tumors_missed_at_conventional_cutoffs: { apw: `${thresholds.ese.missedApw}%`, rpw: `${thresholds.ese.missedRpw}%` },
      rcc_hcc_metastases_falsely_adenoma: { apw: thresholds.choi.apw, rpw: thresholds.choi.rpw },
      large_adenoma_ct_sensitivity: thresholds.park.largeAdenomas,
      ese_2023_table4_washout_criterion: `RPW > ${thresholds.ese.table4Rpw}%`,
      ese_2023_older_rpw_cutoff: `${thresholds.ese.olderRpw}%`,
      sii_equation: "100 x (SI in-phase - SI opposed-phase) / SI in-phase",
      sii_cutoff: thresholds.mri.sii,
      sii_cutoff_range: `${thresholds.mri.siiRangeLow}-${thresholds.mri.sii}%`,
      sii_later_criterion: thresholds.mri.laterCriterion,
    },
    runtime_bindings: {
      app_benign_adenoma_banner_absent: true,
      ct_formula_vectors: CT_FORMULA_VECTORS.length,
      ct_boundaries: ctBoundaries,
      ct_undefined_equations_error_only: ["missing", "HUmax=0", "HUmax=HUnativ", "non-finite"],
      mri_boundaries: mri.boundaries,
      mri_invalid_domain_error_only: ["missing", "negative magnitude", "adrenal in-phase=0", "spleen in-phase=0", "spleen opposed-phase=0"],
      mri_magnitude_instruction_present: true,
    },
    open_discrepancies: [
      {
        id: "ct-conventional-thresholds-vs-ese-2023-table4",
        status: "pre-existing; not changed by this branch; not certified by this audit",
        runtime: `APW >= ${thresholds.ct.apw}% or RPW >= ${thresholds.ct.rpw}% -> ${CT_ADENOMA}`,
        source: `ESE/ENSAT 2023 Table 4 lists RPW > ${thresholds.ese.table4Rpw}% (single study, lowest evidence grade) and applies imaging criteria only to homogeneous masses`,
      },
      {
        id: "mri-sii-exact-threshold-inclusivity",
        status: "pre-existing; not changed by this branch; not certified by this audit",
        runtime: `SII ${thresholds.mri.sii.toFixed(1)}% -> ${mri.exactThresholdInterpretation}`,
        source: `Fujiyoshi 2003 cutoff range ${thresholds.mri.siiRangeLow}-${thresholds.mri.sii}% (inclusivity not stated); Israel 2004 ${thresholds.mri.laterCriterion}`,
      },
    ],
    source_text_committed: false,
    source_bytes_committed: false,
  };

  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(audit)}\n`);
  } else {
    console.log(
      `Adrenal primary-source audit passed: ${2 + Object.keys(PUBMED_RECORDS).length} byte-pinned artifacts, ${STATEMENTS.length} span-pinned statements, 2 printed equations, ${ctBoundaries.length} CT and ${mri.boundaries.length} MRI runtime boundaries.`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
