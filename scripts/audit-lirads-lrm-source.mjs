#!/usr/bin/env node

// Exact-head primary-source audit for the LI-RADS v2018 LR-M ordering fix.
//
// Retrieves the ACR CT/MRI LI-RADS v2018 Core (the PDF linked as "CT/MRI v2018 Core" on
// acr.org's LI-RADS page). The PDF is static, so it is pinned by its final URL (host, path,
// query), media type, byte length and SHA-256 of the raw response bytes. Each source statement
// is then pinned by the SHA-256 and length of its exact normalized text span, found between two
// short markers (at most six words each) on a named PDF page. Only the markers are stored here;
// `paraphrase` is Radulator's own wording, so no copyrighted passage is republished. Layout
// facts that text order cannot show (the Step 1 branch order, the diagnostic-table cells, which
// LR-M branch carries the LR-5 condition, where the tiebreak label sits) are checked from the
// PDF's text coordinates. Finally the statements are bound to the calculator runtime, and any
// drift in the source, the layout or the runtime exits non-zero.
//
// Fetching retries network errors, HTTP 408/425/429 and 5xx with exponential backoff, honoring
// Retry-After (capped), because Smoke runs every scripts/audit-*-source.test.mjs on every PR.
// The raw-byte pins (length and SHA-256), final URL and media type are verified on the HTTP 200
// before anything is parsed; a 200 that misses a pin fails at once and is never retried.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { LIRADS } from "../src/components/calculators/LIRADS.jsx";

const CALCULATOR_PATH = "src/components/calculators/LIRADS.jsx";
const USER_AGENT = "Radulator-LI-RADS-LRM-source-audit/1";
export const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 2_000;
export const MAX_RETRY_AFTER_MS = 60_000;
const FETCH_TIMEOUT_MS = 90_000;

export const SOURCE = Object.freeze({
  key: "acr-lirads-ctmri-v2018-core",
  authority: "American College of Radiology",
  document: "ACR CT/MRI LI-RADS v2018 Core",
  landing_page:
    "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/LI-RADS",
  url: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/LI-RADS/LI-RADS-CT-MRI-2018-Core.pdf",
  media_type: "application/pdf",
  pin: "raw-bytes",
  bytes: 1_840_136,
  sha256: "89fddfbd66641f37055fc16082f338bc4fec880f3d3e0042a7a9b6b69f4acfb4",
  pages: 61,
});

// Each span runs from the `from` marker to the next `to` marker on the PDF page, after
// normalization: NFKC, quote/dash folding, lower case, whitespace and hyphens removed (so
// typeset line breaks do not matter; every other character must match). PDF page N is printed
// page N - 3.
export const STATEMENTS = Object.freeze([
  Object.freeze({
    id: "core-identity",
    pdf_page: 1,
    locator: "Cover",
    paraphrase: "The PDF is ACR's CT/MRI LI-RADS v2018 Core (2018).",
    spans: [
      {
        from: "CT/MRI v2018 Core",
        to: "American College of Radiology",
        length: 46,
        sha256: "dac6972eebaae2fef0c2eb336dd0a7b9f0cb69580d032bb4eb05e0cbb13d84f8",
      },
    ],
  }),
  Object.freeze({
    id: "whats-new-lr5-criteria-are-table",
    pdf_page: 7,
    printed_page: 4,
    locator: "What's New in v2018, revised LR-5 criteria",
    paraphrase:
      "v2018 revised the LR-5 criteria to match AASLD; the new criteria are size and major-feature combinations summarized in the Diagnostic Table.",
    spans: [
      {
        from: "Revised, simplified criteria for LR-5",
        to: "summarized in Diagnostic Table (page 8)",
        length: 201,
        sha256: "c5d1738d5adcc0ca7fd2293c0114cfd52328b2495d1a769ee49026f902c7214c",
      },
    ],
  }),
  Object.freeze({
    id: "getting-started-population",
    pdf_page: 9,
    printed_page: 6,
    locator: "Getting Started, population",
    paraphrase:
      "LI-RADS is meant for adults at high HCC risk: cirrhosis, chronic hepatitis B, or HCC now or in the past, transplant candidates and recipients included. It is not meant for anyone without those risks, anyone under 18, or cirrhosis from congenital hepatic fibrosis or a vascular cause (for example HHT, Budd-Chiari, chronic portal vein occlusion, congestive hepatopathy or diffuse NRH).",
    spans: [
      {
        from: "Apply in patients at high risk",
        to: "recipients posttransplant",
        length: 178,
        sha256: "a72fcc1a125bb4ceff17de7f5823a7530e32d213ea6bd2cbf85536a894dda389",
      },
      {
        from: "Do not apply in patients",
        to: "nodular regenerative hyperplasia",
        length: 285,
        sha256: "a085aa617dbecd29e7cef2b2a0b91a48626d0765381d5e4371c26d27b73ffe57",
      },
    ],
  }),
  Object.freeze({
    id: "categories-lr-nc",
    pdf_page: 10,
    printed_page: 7,
    locator: "Categories, LR-NC",
    paraphrase: "LR-NC means the observation cannot be categorized because images are missing or degraded.",
    spans: [
      {
        from: "Not categorizable",
        to: "or degradation)",
        length: 49,
        sha256: "b94dbbea8e6c49874cc29a81692ddef5e51b2a6fa172c5adaf4fca6614bc7d46",
      },
    ],
  }),
  Object.freeze({
    id: "step1-diagnostic-algorithm",
    pdf_page: 11,
    printed_page: 8,
    locator: "Step 1, diagnostic algorithm branches",
    paraphrase:
      "Step 1 checks an untreated, unproven observation in a high-risk patient against, in order: not categorizable (LR-NC), definite tumor in vein (LR-TIV), definitely benign (LR-1), probably benign (LR-2), probably or definitely malignant but not HCC-specific, for example targetoid (LR-M); otherwise the CT/MRI diagnostic table assigns LR-3, LR-4 or LR-5.",
    spans: [
      {
        from: "Step 1. Apply CT/MRI",
        to: "Diagnostic Algorithm",
        length: 43,
        sha256: "0d2bee42bf7b2cdf5d8adeae991e244aecc6e9e55c46af23f4c15435331788ab",
      },
      {
        from: "Untreated observation without pathologic proof",
        to: "(e.g., if targetoid)",
        length: 376,
        sha256: "3f9290cfbe05a36f459e5fc0a73cb0dce21ab3d07cf94b3e6705de0c581ed7d2",
      },
    ],
  }),
  Object.freeze({
    id: "step1-diagnostic-table",
    pdf_page: 11,
    printed_page: 8,
    locator: "Step 1, CT/MRI Diagnostic Table and its split cell",
    paraphrase:
      "The diagnostic table crosses APHE (none or nonrim) and size with how many of the three additional major features are present (capsule, washout, threshold growth). The 10-19 mm nonrim-APHE cell with one additional feature is LR-4 for capsule and LR-5 for washout or threshold growth.",
    spans: [
      {
        from: "Arterial phase hyperenhancement (APHE)",
        to: "OR threshold growth",
        length: 342,
        sha256: "3ec838d383ad68e8da92cee3f9c7faa3c95f4f78a201cbd10b4dd374b2876a25",
      },
    ],
  }),
  Object.freeze({
    id: "step2-ancillary-features",
    pdf_page: 12,
    printed_page: 9,
    locator: "Step 2, ancillary features",
    paraphrase:
      "Ancillary features are optional and come after Step 1. At least one feature favoring malignancy upgrades one category, no higher than LR-4; at least one favoring benignity downgrades one category; with both kinds present the category is not adjusted; ancillary features never upgrade to LR-5.",
    spans: [
      {
        from: "Step 2. Optional: Apply Ancillary",
        to: "Features (AFs)",
        length: 42,
        sha256: "b40ea2271a94b02f9160888f0b2bcd5c06bb4bae4a755f63d8fbfd887917430a",
      },
      {
        from: "For category adjustment (upgrade or downgrade)",
        to: "Do not adjust category",
        length: 142,
        sha256: "bcf5daf2506a7fd1a748be8befb2411c401c06e6aa833d831c2c6e0c7106e3b0",
      },
      {
        from: "Ancillary features cannot",
        to: "to LR-5",
        length: 45,
        sha256: "8ea908939807307f37de2436107c33ff8dd6ee1e928c31fa057da55c735d4a82",
      },
      {
        from: "AF favoring malignancy: upgrade by",
        to: "be used to upgrade)",
        length: 176,
        sha256: "2dca9611cd2c173d4b9b7116369cd7f3ac17525c88794147744ac5d086b748ec",
      },
    ],
  }),
  Object.freeze({
    id: "whats-new-threshold-growth",
    pdf_page: 7,
    printed_page: 4,
    locator: "What's New in v2018, threshold growth",
    paraphrase:
      "v2018 narrowed threshold growth to a mass growing by at least 50% within 6 months, matching AASLD and OPTN. A new observation of 10 mm or more within 24 months, or growth of 100% or more across exams over 6 months apart, no longer counts as threshold growth; both are now subthreshold growth.",
    spans: [
      {
        from: "Revised, simplified definition of threshold",
        to: "exams > 6 months apart",
        length: 420,
        sha256: "a228100c6bb75b8e8e30c4c6d3b67f4824464907d665d8db1528bc1ac275daad",
      },
    ],
  }),
  Object.freeze({
    id: "threshold-growth-definition",
    pdf_page: 23,
    printed_page: 20,
    locator: "Major Imaging Features, threshold growth",
    paraphrase:
      "Threshold growth is a size increase of at least 50% in 6 months or less. It applies only to an observation that is unequivocally a mass, only against a prior CT or MRI of adequate quality (never a prior US or CEUS), measured on matching phase, sequence and plane where possible.",
    spans: [
      {
        from: "Threshold growth Size increase",
        to: "US or CEUS exams",
        length: 471,
        sha256: "7a4e216900f4bee184a598d7c96ce0271dcff34ffafcc2ed80c208b7741bb505",
      },
    ],
  }),
  Object.freeze({
    id: "ancillary-subthreshold-growth",
    pdf_page: 27,
    printed_page: 24,
    locator: "Ancillary features favoring malignancy, subthreshold growth",
    paraphrase:
      "Subthreshold growth, an ancillary feature favoring malignancy (not HCC in particular), is an unequivocal increase in the size of a mass that falls short of threshold growth.",
    spans: [
      {
        from: "Subthreshold growth Unequivocal size",
        to: "definition of threshold growth",
        length: 112,
        sha256: "779434719ec7815f159c2e6d51e57b53f6968ed3403cf08acab3b6d515dc3185",
      },
    ],
  }),
  Object.freeze({
    id: "step3-tiebreaking",
    pdf_page: 13,
    printed_page: 10,
    locator: "Step 3, tiebreaking rules",
    paraphrase:
      "Tiebreaking: when tumor in vein is uncertain, do not assign LR-TIV; when torn between two categories, take the one with lower certainty. The figure marks the step from LR-4 or LR-5 down to LR-M as lower certainty of hepatocellular origin.",
    spans: [
      {
        from: "Step 3. Apply Tiebreaking Rules",
        to: "if Needed",
        length: 35,
        sha256: "4d388c3d746830cd7eac65732556a7ffb0b9f928cb355f98046ff3df47f73a2e",
      },
      {
        from: "If unsure about presence",
        to: "as LR-TIV",
        length: 49,
        sha256: "171b889bb4239d2a774354155730918e9bd42e0473ad98a4ee0603e0c7529370",
      },
      {
        from: "If unsure between two",
        to: "lower certainty",
        length: 65,
        sha256: "5e7ce025c3b462dd10ff48ec2ba52d60cf0cc3ed61510c7253d17fe70281e9e7",
      },
      {
        from: "Lower certainty of hepatocellular",
        to: "origin",
        length: 36,
        sha256: "c206896ffc31c102ad84e489043515544072cba440c258d82cd50735a17b1204",
      },
    ],
  }),
  Object.freeze({
    id: "tumor-in-vein-definition",
    pdf_page: 24,
    printed_page: 21,
    locator: "Tumor in Vein, definition",
    paraphrase:
      "Tumor in vein is unequivocal enhancing soft tissue inside a vein, whether or not a parenchymal mass is seen.",
    spans: [
      {
        from: "Unequivocal enhancing soft tissue",
        to: "of parenchymal mass",
        length: 79,
        sha256: "f1aec3c02927d34e37bed11ad408cfb9c768868e6e7bdcb94357116617455dac",
      },
    ],
  }),
  Object.freeze({
    id: "lrm-criteria",
    pdf_page: 25,
    printed_page: 22,
    locator: "LR-M Criteria",
    paraphrase:
      "LR-M is a targetoid mass, OR a nontargetoid mass with at least one of: infiltrative appearance, marked diffusion restriction, necrosis/severe ischemia, or another feature the radiologist judges to suggest non-HCC malignancy. The box stating no tumor in vein and not meeting LR-5 criteria belongs to the nontargetoid branch. Targetoid appearances are rim APHE, peripheral washout, delayed central enhancement, targetoid diffusion restriction and targetoid transitional or hepatobiliary phase appearance.",
    spans: [
      {
        from: "Targetoid mass (see",
        to: "imaging appearances)",
        length: 57,
        sha256: "1b904b7c1dfe0362cb7da7f4d39e74ac65b7b51be9b79812f9a2e62c8f582fcd",
      },
      {
        from: "Nontargetoid mass with one or more",
        to: "Not meeting LR-5 criteria",
        length: 305,
        sha256: "26bca7eaa599779fb3a1d4d6675a515e29cde8cf371da1a37482f92a3d252ba3",
      },
      {
        from: "Targetoid dynamic enhancement:",
        to: "milder hypointensity in center",
        length: 649,
        sha256: "88c511367b897af59943889ac16f60d9e1ee44972a4e797f303f078a2ca8b9d3",
      },
    ],
  }),
  Object.freeze({
    id: "faq-infiltrative-not-lr5-is-lrm",
    pdf_page: 42,
    printed_page: 39,
    locator: "FAQs, Diagnosis: infiltrative mass",
    paraphrase:
      "FAQ: a mass with infiltrative appearance that meets neither LR-TIV nor LR-5 criteria is categorized LR-M.",
    spans: [
      {
        from: "How do I categorize a mass",
        to: "most appropriate category",
        length: 395,
        sha256: "35587bc5aec1467370a80a59e46c5b7262ba3526ea2de69958a3e2de249ae116",
      },
    ],
  }),
  Object.freeze({
    id: "management-lrm-tailored-workup",
    pdf_page: 17,
    printed_page: 14,
    locator: "LI-RADS-Based Management table, LR-M row",
    paraphrase: "For LR-M, management is multidisciplinary discussion for a tailored workup, which often includes biopsy.",
    spans: [
      {
        from: "for tailored workup Often includes biopsy",
        to: "LR-M",
        length: 39,
        sha256: "07c9637198ea4193633feeda1045f9a8e21f130a4eb573004d6097b7255c6b9e",
      },
    ],
  }),
  Object.freeze({
    id: "management-lr2-surveillance",
    pdf_page: 17,
    printed_page: 14,
    locator: "LI-RADS-Based Management table, LR-2 row",
    paraphrase: "For LR-2, return to surveillance in 6 months and consider repeat diagnostic imaging in 6 months or less.",
    spans: [
      {
        from: "If biopsy Return to surveillance",
        to: "Consider repeat",
        length: 51,
        sha256: "31efdfa5d5de1fc4e4a380d777b3f9f0b56b4ceafbadc221453ae3bc4cfb1226",
      },
      {
        from: "Consider repeat diagnostic imaging",
        to: "6 months LR-2",
        length: 44,
        sha256: "4963e0c42568a1fac5d4432242344a3c664235923115ddbfe0a6920454173d52",
      },
    ],
  }),
  Object.freeze({
    id: "reporting-avoid-compelling-biopsy",
    pdf_page: 19,
    printed_page: 16,
    locator: "Reporting considerations, biopsy language",
    paraphrase: "Reports should avoid language that compels biopsy or another invasive procedure.",
    spans: [
      {
        from: "Avoid language that compels biopsy",
        to: "or other invasive procedure",
        length: 54,
        sha256: "daedd395c0bfeb5e5a4478ee99f57e03589022b907eaf3f142795e4832b85835",
      },
    ],
  }),
]);

// Step 1 branches in the order the flowchart draws them (top to bottom). Each marker is the
// start (or the whole) of one PDF text item; `outcome` is the category box on the same row.
export const STEP1_BRANCHES = Object.freeze([
  Object.freeze({ step: "LR-NC", startsWith: "If cannot be categorized", outcome: "LR-NC" }),
  Object.freeze({ step: "LR-TIV", equals: "If definite", outcome: "LR-TIV" }),
  Object.freeze({ step: "LR-1", equals: "If definitely benign", outcome: "LR-1" }),
  Object.freeze({ step: "LR-2", equals: "probably benign", outcome: "LR-2" }),
  Object.freeze({ step: "LR-M", startsWith: "If probably or definitely malignant", outcome: "LR-M" }),
  Object.freeze({ step: "diagnostic-table", startsWith: "Otherwise, use CT/MRI diagnostic", outcome: null }),
  Object.freeze({ step: "LR-3", equals: "If intermediate", outcome: "LR-3" }),
  Object.freeze({ step: "LR-4", equals: "If probably HCC", outcome: "LR-4" }),
  Object.freeze({ step: "LR-5", equals: "If definitely HCC", outcome: "LR-5" }),
]);

// Diagnostic table cells (facts, not prose): rows = count of additional major features,
// columns = no APHE <20 mm, no APHE >=20 mm, nonrim APHE <10 mm, 10-19 mm, >=20 mm.
// "LR-4|LR-5" is the split cell (capsule -> LR-4; washout or threshold growth -> LR-5).
export const EXPECTED_TABLE = Object.freeze({
  none: Object.freeze(["LR-3", "LR-3", "LR-3", "LR-3", "LR-4"]),
  one: Object.freeze(["LR-3", "LR-4", "LR-4", "LR-4|LR-5", "LR-5"]),
  two: Object.freeze(["LR-4", "LR-4", "LR-4", "LR-5", "LR-5"]),
});

const LRM_CATEGORY = "LR-M (Probably/Definitely Malignant, Not HCC-Specific)";
const TABLE_LABELS = Object.freeze({
  "LR-3": "LR-3 (Intermediate Probability)",
  "LR-4": "LR-4 (Probably HCC)",
  "LR-5": "LR-5 (Definitely HCC)",
});
export const TARGETOID_FIELDS = Object.freeze([
  "lrm_rim_aphe",
  "lrm_peripheral_washout",
  "lrm_delayed_central_enhancement",
  "lrm_targetoid_restriction",
  "lrm_targetoid_hbp",
]);
export const NONTARGETOID_FIELDS = Object.freeze([
  "lrm_infiltrative",
  "lrm_marked_restriction",
  "lrm_necrosis",
  "lrm_other",
]);
const MAJOR_FIELDS = Object.freeze([
  "observation_size",
  "aphe",
  "washout",
  "capsule",
  "threshold_growth",
  "ancillary_malignancy",
  "ancillary_hcc",
  "ancillary_benign",
]);
const INDETERMINATE = Object.freeze({
  high_risk_population: true,
  study_adequate: true,
  tumor_in_vein: false,
  benign_status: "indeterminate",
});

export const RUNTIME_SUBLABELS = Object.freeze({
  high_risk_population:
    "Adults (≥18 y) with cirrhosis, chronic hepatitis B, or current/prior HCC; excludes cirrhosis from congenital hepatic fibrosis or vascular disorders (required)",
  study_adequate: "No image omission or degradation that prevents categorization (otherwise LR-NC)",
  tumor_in_vein:
    "Unequivocal enhancing soft tissue within a vein, with or without a visible parenchymal mass; if unsure, leave unchecked",
  has_lrm_features:
    "Targetoid mass, or a nontargetoid mass not meeting LR-5 criteria with infiltrative appearance, marked diffusion restriction, necrosis/severe ischemia, or another non-HCC feature",
});
// The LR-TIV result states the same any-vein definition as the field (Core printed p. 21).
// Management wording for LR-M and LR-2 (Core printed p. 14 management table; p. 16: no language that compels biopsy).
export const RUNTIME_LRM_RECOMMENDATION = "Multidisciplinary discussion for tailored workup, which often includes biopsy";
export const RUNTIME_LR2_RECOMMENDATION = "Return to surveillance in 6 months; consider repeat diagnostic imaging in ≤6 months";
export const RUNTIME_TIV_DEFINITION =
  "Definite tumor in vein: unequivocal enhancing soft tissue in a vein, with or without a visible parenchymal mass";
export const RUNTIME_THRESHOLD_GROWTH = Object.freeze({
  subLabel:
    "Mass size up ≥50% within ≤6 months vs a prior CT/MRI. A new ≥10 mm observation in ≤24 months, or ≥100% growth over >6 months, is subthreshold growth (ancillary feature), not threshold growth",
  note: "Threshold growth (v2018): a mass grew ≥50% within ≤6 months vs a prior CT/MRI. A new ≥10 mm observation in ≤24 months or ≥100% growth over >6 months is subthreshold growth instead, an ancillary feature that upgrades at most to LR-4",
  subthresholdOption:
    "Subthreshold growth (growth below threshold, e.g. new ≥10 mm observation in ≤24 months or ≥100% over >6 months)",
});
const BENIGN_ANCILLARY_VALUES = Object.freeze([
  "size_stability",
  "size_reduction",
  "parallels_blood_pool",
  "undistorted_vessels",
  "iron_in_mass",
  "marked_t2",
  "hbp_iso",
]);
const ONE_CATEGORY_DOWN = Object.freeze({ "LR-5": "LR-4", "LR-4": "LR-3", "LR-3": "LR-2" });
const LR2_LABEL = "LR-2 (Probably Benign)";
// The calculator's former ACR reference; it has returned HTTP 404 since ACR moved its site.
const DEAD_ACR_REFERENCE = "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/LI-RADS";
export const RUNTIME_TIEBREAK_NOTE =
  "Nontargetoid LR-M features give LR-M only when LR-5 criteria are not met. If unsure between LR-M and this category, choose LR-M (v2018 tiebreaking: lower certainty of hepatocellular origin)";
const RUNTIME_ERRORS = Object.freeze({
  lrmWithoutFeature:
    '"LR-M Features Present" is checked but no LR-M feature is selected. Select each LR-M feature present, or uncheck "LR-M Features Present" to use the diagnostic table.',
  benignityUnselected:
    "Select an Observation Benignity option to continue (Indeterminate opens the LR-M and major-feature inputs).",
  nontargetoidIncomplete:
    "Nontargetoid LR-M features make the observation LR-M only if it does not meet LR-5 criteria. Complete observation size, APHE, washout, capsule and threshold growth so LR-5 criteria can be checked.",
});

export const CLAIM_BINDINGS = Object.freeze([
  Object.freeze({
    claim_id: "step1-order",
    source_statement_ids: ["step1-diagnostic-algorithm", "categories-lr-nc"],
  }),
  Object.freeze({
    claim_id: "targetoid-mass-is-lrm",
    source_statement_ids: ["lrm-criteria"],
  }),
  Object.freeze({
    claim_id: "nontargetoid-lrm-only-if-not-lr5",
    source_statement_ids: [
      "lrm-criteria",
      "whats-new-lr5-criteria-are-table",
      "step1-diagnostic-table",
      "faq-infiltrative-not-lr5-is-lrm",
    ],
  }),
  Object.freeze({
    claim_id: "lr5-criteria-are-the-diagnostic-table",
    source_statement_ids: ["step1-diagnostic-table", "whats-new-lr5-criteria-are-table"],
  }),
  Object.freeze({
    claim_id: "lrm-decided-before-ancillary-features",
    source_statement_ids: ["step1-diagnostic-algorithm", "step2-ancillary-features"],
  }),
  Object.freeze({
    claim_id: "tiebreak-note-lrm-vs-lr5",
    source_statement_ids: ["step3-tiebreaking"],
  }),
  Object.freeze({
    claim_id: "sublabel-high-risk-population",
    source_statement_ids: ["getting-started-population"],
  }),
  Object.freeze({
    claim_id: "sublabel-study-adequate",
    source_statement_ids: ["categories-lr-nc", "step1-diagnostic-algorithm"],
  }),
  Object.freeze({
    claim_id: "sublabel-tumor-in-vein",
    source_statement_ids: ["tumor-in-vein-definition", "step3-tiebreaking"],
  }),
  Object.freeze({
    claim_id: "result-tumor-in-vein-definition",
    source_statement_ids: ["tumor-in-vein-definition"],
  }),
  Object.freeze({
    claim_id: "sublabel-has-lrm-features",
    source_statement_ids: ["lrm-criteria"],
  }),
  Object.freeze({
    claim_id: "threshold-growth-v2018",
    source_statement_ids: [
      "whats-new-threshold-growth",
      "threshold-growth-definition",
      "ancillary-subthreshold-growth",
      "step2-ancillary-features",
    ],
  }),
  Object.freeze({
    claim_id: "benign-ancillary-downgrade-one-category",
    source_statement_ids: ["step2-ancillary-features"],
  }),
  Object.freeze({
    claim_id: "acr-reference-is-live-landing-page",
    source_statement_ids: ["core-identity"],
  }),
  Object.freeze({
    claim_id: "lrm-management-tailored-workup",
    source_statement_ids: ["management-lrm-tailored-workup", "reporting-avoid-compelling-biopsy"],
  }),
  Object.freeze({
    claim_id: "lr2-management-surveillance",
    source_statement_ids: ["management-lr2-surveillance"],
  }),
]);

// In-memory edits of the real extracted page text (never written anywhere). Each must break the
// named statement's pin, which shows the pin would catch that kind of source change.
export const SOURCE_MUTATIONS = Object.freeze([
  Object.freeze({ statement_id: "whats-new-threshold-growth", find: "≥ 50%", replace: "≥ 40%" }),
  Object.freeze({ statement_id: "whats-new-threshold-growth", find: "≤ 24 months", replace: "≤ 12 months" }),
  Object.freeze({ statement_id: "threshold-growth-definition", find: "≤ 6 months", replace: "≤ 12 months" }),
  Object.freeze({ statement_id: "ancillary-subthreshold-growth", find: "less than threshold", replace: "more than threshold" }),
  Object.freeze({ statement_id: "step2-ancillary-features", find: "downgrade by 1", replace: "downgrade by 2" }),
  Object.freeze({ statement_id: "lrm-criteria", find: "Not meeting LR", replace: "Meeting LR" }),
  Object.freeze({ statement_id: "management-lrm-tailored-workup", find: "Often includes biopsy", replace: "Requires biopsy" }),
  Object.freeze({ statement_id: "management-lr2-surveillance", find: "≤ 6 months", replace: "≤ 3 months" }),
  Object.freeze({ statement_id: "reporting-avoid-compelling-biopsy", find: "compels biopsy", replace: "recommends biopsy" }),
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// ---------------------------------------------------------------------------------------------
// Retrieval

export function parseRetryAfter(value, now = Date.now()) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text) * 1_000;
  const at = Date.parse(text);
  if (Number.isFinite(at)) return Math.max(0, at - now);
  return null;
}

export function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

// Returns only bytes that already match every pin: final URL, media type, PDF header, byte
// length and SHA-256 are checked on the HTTP 200 before anything is parsed. A completed 200 that
// misses any pin throws at once and is never retried (retrying could mask a source that serves
// varying content). Only transport failures (network errors, an aborted body read) and HTTP
// 408/425/429/5xx are retried.
export async function retrieve(
  source,
  { fetchImpl = fetch, sleep = delay, attempts = MAX_ATTEMPTS, timeoutMs = FETCH_TIMEOUT_MS } = {},
) {
  let lastFailure = "unknown retrieval failure";
  const waits = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let waitMs = BASE_BACKOFF_MS * 2 ** (attempt - 1);
    let completed = null;
    try {
      const response = await fetchImpl(source.url, {
        headers: { "user-agent": USER_AGENT, accept: source.media_type },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) {
        completed = {
          bytes: Buffer.from(await response.arrayBuffer()),
          finalUrl: new URL(response.url || source.url),
          contentType: response.headers.get("content-type") ?? "",
          attempts: attempt,
          waits,
        };
      } else {
        lastFailure = `HTTP ${response.status}`;
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        await response.body?.cancel?.();
        if (!isRetryableStatus(response.status)) break;
        if (retryAfter !== null) waitMs = Math.min(Math.max(retryAfter, waitMs), MAX_RETRY_AFTER_MS);
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (completed) {
      // Outside the try: a pin miss on a completed 200 is final, never a retry.
      assertArtifactIdentity(source, completed);
      assertRawBytePin(source, completed.bytes);
      return completed;
    }
    if (attempt < attempts) {
      waits.push(waitMs);
      await sleep(waitMs);
    }
  }
  assert.fail(`${source.key}: primary-source retrieval failed after ${waits.length + 1} attempt(s) (${lastFailure})`);
}

export function assertArtifactIdentity(source, retrieved) {
  const expected = new URL(source.url);
  const { finalUrl } = retrieved;
  assert.equal(finalUrl.protocol, "https:", `${source.key}: final URL left HTTPS`);
  assert.equal(finalUrl.hostname, expected.hostname, `${source.key}: final URL host drifted`);
  assert.equal(finalUrl.pathname, expected.pathname, `${source.key}: final URL path drifted`);
  assert.equal(finalUrl.search, expected.search, `${source.key}: final URL query drifted`);
  const mediaType = retrieved.contentType.split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, source.media_type, `${source.key}: media type drifted`);
  assert.equal(
    retrieved.bytes.subarray(0, 5).toString("latin1"),
    "%PDF-",
    `${source.key}: artifact lacks a PDF header`,
  );
}

export function assertRawBytePin(source, bytes) {
  assert.equal(source.pin, "raw-bytes", `${source.key}: raw-byte pin requested for a ${source.pin} source`);
  assert.equal(bytes.length, source.bytes, `${source.key}: artifact byte length drifted`);
  assert.equal(sha256(bytes), source.sha256, `${source.key}: artifact SHA-256 drifted`);
}

// ---------------------------------------------------------------------------------------------
// Text normalization and span pins

export function foldText(value) {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function compact(value) {
  return foldText(value).toLowerCase().replace(/[\s\-­]+/g, "");
}

export function spanDigest(text, from, to, label) {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `${label}: span start marker ${JSON.stringify(from)} is missing`);
  assert.equal(
    text.indexOf(from, start + 1),
    -1,
    `${label}: span start marker ${JSON.stringify(from)} is not unique on its page`,
  );
  const toIndex = text.indexOf(to, start + from.length);
  assert.ok(toIndex >= 0, `${label}: span end marker ${JSON.stringify(to)} is missing`);
  const value = text.slice(start, toIndex + to.length);
  return { length: value.length, sha256: sha256(value) };
}

export function checkSpans(statement, pageText, mismatches) {
  const text = compact(pageText);
  return statement.spans.map((span, index) => {
    for (const marker of [span.from, span.to]) {
      assert.ok(
        marker.trim().split(/\s+/).length <= 6,
        `${statement.id} span ${index + 1}: marker ${JSON.stringify(marker)} exceeds six words`,
      );
    }
    const actual = spanDigest(text, compact(span.from), compact(span.to), `${statement.id} span ${index + 1}`);
    if (actual.length !== span.length || actual.sha256 !== span.sha256) {
      mismatches.push({
        id: statement.id,
        span: index + 1,
        expected: { length: span.length, sha256: span.sha256 },
        actual,
      });
    }
    return { from: span.from, to: span.to, ...actual };
  });
}

// ---------------------------------------------------------------------------------------------
// Layout checks from PDF text coordinates (points; y grows upward)

function findItem(items, matcher, label) {
  const matches = items.filter((item) => {
    const text = foldText(item.str);
    return matcher.equals !== undefined ? text === matcher.equals : text.startsWith(matcher.startsWith);
  });
  assert.equal(matches.length, 1, `${label}: expected exactly one text item for ${JSON.stringify(matcher)}`);
  return matches[0];
}

// "LR", "-", "5" (or "NC", "TIV", "M") items typeset side by side -> one category token.
export function categoryTokens(items) {
  const tokens = [];
  for (let index = 0; index + 2 < items.length; index += 1) {
    const [lr, dash, suffix] = items.slice(index, index + 3).map((item) => foldText(item.str));
    if (lr === "LR" && dash === "-" && /^(?:[1-5]|M|NC|TIV)$/.test(suffix)) {
      tokens.push({ category: `LR-${suffix}`, x: items[index].x, y: items[index].y });
    }
  }
  return tokens;
}

export function checkStep1Order(items) {
  const rows = STEP1_BRANCHES.map((branch) => ({
    step: branch.step,
    outcome: branch.outcome,
    y: findItem(items, branch, `step 1 ${branch.step}`).y,
  }));
  for (let index = 1; index < rows.length; index += 1) {
    assert.ok(
      rows[index].y < rows[index - 1].y,
      `step 1: ${rows[index].step} must be drawn below ${rows[index - 1].step}`,
    );
  }
  const boxes = categoryTokens(items).filter((token) => token.x > 470);
  for (const row of rows.filter((candidate) => candidate.outcome)) {
    const box = boxes.filter((token) => Math.abs(token.y - row.y) <= 1.5);
    assert.equal(box.length, 1, `step 1 ${row.step}: expected one outcome box on its row`);
    assert.equal(box[0].category, row.outcome, `step 1 ${row.step}: outcome box drifted`);
  }
  const header = findItem(items, { startsWith: "Untreated observation without" }, "step 1 header");
  assert.ok(header.y > rows[0].y, "step 1: the untreated-observation header must sit above every branch");
  return rows.map(({ step, y }) => ({ step, y: Number(y.toFixed(1)) }));
}

export function parseDiagnosticTable(items) {
  const tokens = categoryTokens(items).filter((token) => token.x > 250 && token.y < 260);
  const rowY = {
    none: findItem(items, { equals: "None" }, "table row None").y,
    one: findItem(items, { equals: "One" }, "table row One").y,
    two: findItem(items, { equals: "≥ Two" }, "table row Two").y,
  };
  assert.ok(rowY.none > rowY.one && rowY.one > rowY.two, "table rows must read None, One, Two downward");
  const onRow = (y) => tokens.filter((token) => Math.abs(token.y - y) <= 1.5).sort((a, b) => a.x - b.x);
  const none = onRow(rowY.none);
  const one = onRow(rowY.one);
  const two = onRow(rowY.two);
  assert.equal(none.length, 5, "table row None must have five cells");
  assert.equal(two.length, 5, "table row Two must have five cells");
  assert.equal(one.length, 4, "table row One must have four whole cells plus the split cell");
  const columns = none.map((token) => token.x);
  two.forEach((token, index) => assert.ok(Math.abs(token.x - columns[index]) <= 4, "table columns misaligned"));

  // Column headers: no APHE <20 / >=20, nonrim APHE <10 / 10-19 / >=20.
  const headerY = findItem(items, { equals: "Observation size (mm)" }, "table size header").y;
  const headers = items
    .filter((item) => Math.abs(item.y - headerY) <= 1.5 && item.x > 250)
    .sort((a, b) => a.x - b.x)
    .map((item) => ({ text: foldText(item.str), x: item.x }));
  const headerText = (column) =>
    headers
      .filter((header) => header.x >= columns[column] - 12 && header.x < columns[column] + 30)
      .map((header) => header.text)
      .join("");
  assert.deepEqual(
    columns.map((_, column) => headerText(column)),
    ["< 20", "≥ 20", "<10", "10-19", "≥ 20"],
    "table size columns drifted",
  );
  const noAphe = findItem(items, { equals: "No APHE" }, "table header No APHE");
  const nonrim = findItem(items, { equals: "Nonrim APHE" }, "table header Nonrim APHE");
  assert.ok(noAphe.x > columns[0] && noAphe.x < columns[2], "No APHE must head the first two columns");
  assert.ok(nonrim.x > columns[2] && nonrim.x < columns[4], "Nonrim APHE must head the last three columns");

  const cellAt = (row, column) => row.find((token) => Math.abs(token.x - columns[column]) <= 4)?.category ?? null;
  assert.equal(cellAt(one, 3), null, "row One, 10-19 mm must be the split cell");
  const split = categoryTokens(items).filter(
    (token) =>
      token.x > columns[3] - 15 &&
      token.x < columns[4] - 10 &&
      Math.abs(token.y - rowY.one) > 1.5 &&
      Math.abs(token.y - rowY.one) < 8,
  );
  assert.deepEqual(
    split.map((token) => token.category),
    ["LR-4", "LR-5"],
    "split cell must hold LR-4 (upper left) and LR-5 (lower right)",
  );
  assert.ok(split[0].y > split[1].y && split[0].x < split[1].x, "split cell layout drifted");

  return {
    none: none.map((token) => token.category),
    one: [cellAt(one, 0), cellAt(one, 1), cellAt(one, 2), "LR-4|LR-5", cellAt(one, 4)],
    two: two.map((token) => token.category),
  };
}

export function checkLrmConditionPlacement(items) {
  // "Targetoid" alone appears three times on the page; its criteria line is the unique
  // "mass (see below ...)" item on the same row.
  const targetoid = findItem(items, { startsWith: "mass (see below for" }, "LR-M targetoid line");
  const or = findItem(items, { equals: "OR" }, "LR-M OR");
  const nontargetoid = findItem(items, { equals: "Nontargetoid mass" }, "LR-M nontargetoid heading");
  const bullets = [
    findItem(items, { startsWith: "Infiltrative appearance" }, "LR-M infiltrative"),
    findItem(items, { startsWith: "Marked diffusion restriction" }, "LR-M marked restriction"),
    findItem(items, { startsWith: "Necrosis or severe ischemia" }, "LR-M necrosis"),
    findItem(items, { startsWith: "Other feature that in" }, "LR-M other feature"),
    findItem(items, { startsWith: "malignancy (specify in report)" }, "LR-M other feature, line 2"),
  ];
  const conditions = [
    findItem(items, { equals: "No tumor in vein" }, "LR-M condition TIV"),
    findItem(items, { equals: "Not meeting LR" }, "LR-M condition LR-5"),
  ];
  assert.ok(targetoid.y > or.y && or.y > nontargetoid.y, "LR-M: targetoid line, OR, nontargetoid heading order drifted");
  const top = Math.max(...bullets.map((item) => item.y));
  const bottom = Math.min(...bullets.map((item) => item.y));
  const left = Math.max(...bullets.map((item) => item.x));
  for (const condition of conditions) {
    assert.ok(
      condition.y < nontargetoid.y && condition.y <= top && condition.y >= bottom,
      "LR-M: the no-TIV / not-LR-5 box must sit within the nontargetoid list",
    );
    assert.ok(condition.x > left + 100, "LR-M: the no-TIV / not-LR-5 box must sit beside the nontargetoid list");
  }
  return {
    targetoid_line_y: Number(targetoid.y.toFixed(1)),
    or_y: Number(or.y.toFixed(1)),
    nontargetoid_list_y: [Number(bottom.toFixed(1)), Number(top.toFixed(1))],
    condition_box_y: conditions.map((item) => Number(item.y.toFixed(1))),
  };
}

export function checkTiebreakLabelPlacement(items) {
  const tokens = categoryTokens(items);
  const single = (category) => {
    const found = tokens.filter((token) => token.category === category);
    assert.equal(found.length, 1, `tiebreak figure: expected one ${category} box`);
    return found[0];
  };
  const lr4 = single("LR-4");
  const lr5 = single("LR-5");
  const lrm = single("LR-M");
  const label = [
    findItem(items, { equals: "hepatocellular" }, "tiebreak label hepatocellular"),
    findItem(items, { equals: "origin" }, "tiebreak label origin"),
  ];
  assert.ok(lrm.y < lr4.y && lrm.y < lr5.y, "tiebreak figure: LR-M must sit below LR-4 and LR-5");
  for (const item of label) {
    assert.ok(item.x > lr5.x, "tiebreak figure: hepatocellular-origin label must sit right of LR-5");
    assert.ok(item.y < lr5.y && item.y > lrm.y, "tiebreak figure: label must span from LR-4/LR-5 down to LR-M");
  }
  return {
    lr4_lr5_row_y: Number(lr5.y.toFixed(1)),
    lrm_y: Number(lrm.y.toFixed(1)),
    label_y: label.map((item) => Number(item.y.toFixed(1))),
  };
}

// Step 2 figure: the LR-1..LR-5 bar reads left to right on one row, the only "✘" marks the
// upgrade from LR-4 into LR-5 (between those boxes, above the bar, under the upgrade label), and
// the downgrade label sits under the whole bar, so the one-category downgrade has no exception.
export function checkStep2Ladder(items) {
  const tokens = categoryTokens(items).filter((token) => /^LR-[1-5]$/.test(token.category));
  assert.equal(tokens.length, 5, "step 2 figure: expected one LR-1..LR-5 bar");
  const barY = tokens[0].y;
  assert.ok(tokens.every((token) => Math.abs(token.y - barY) <= 1.5), "step 2 figure: bar must be one row");
  const bar = [...tokens].sort((a, b) => a.x - b.x);
  assert.deepEqual(
    bar.map((token) => token.category),
    ["LR-1", "LR-2", "LR-3", "LR-4", "LR-5"],
    "step 2 figure: bar must read LR-1 to LR-5 left to right",
  );
  const upgrade = findItem(items, { startsWith: "≥ 1 AF favoring malignancy: upgrade" }, "step 2 upgrade label");
  const downgrade = findItem(items, { startsWith: "≥ 1 AF favoring benignity: downgrade" }, "step 2 downgrade label");
  const crosses = items.filter((item) => foldText(item.str) === "✘");
  assert.equal(crosses.length, 1, "step 2 figure: expected exactly one forbidden-move mark");
  const [cross] = crosses;
  assert.ok(cross.x > bar[3].x && cross.x < bar[4].x, "step 2 figure: the forbidden move must sit between LR-4 and LR-5");
  assert.ok(cross.y > barY && cross.y < upgrade.y, "step 2 figure: the forbidden move must be on the upgrade side");
  assert.ok(downgrade.y < barY, "step 2 figure: the downgrade label must sit under the bar");
  return {
    bar_y: Number(barY.toFixed(1)),
    bar_order: bar.map((token) => token.category),
    forbidden_move_x: Number(cross.x.toFixed(1)),
    upgrade_label_y: Number(upgrade.y.toFixed(1)),
    downgrade_label_y: Number(downgrade.y.toFixed(1)),
  };
}

// ---------------------------------------------------------------------------------------------
// Runtime binding

function shownIds(calculator, vals) {
  return new Set(
    calculator.fields.filter((field) => !field.showIf || field.showIf(vals)).map((field) => field.id),
  );
}

function majors(size, aphe, { washout = false, capsule = false, growth = false } = {}) {
  return {
    observation_size: size,
    aphe,
    washout: washout ? "present" : "absent",
    capsule: capsule ? "present" : "absent",
    threshold_growth: growth ? "present" : "absent",
  };
}

const COLUMN_PROBES = Object.freeze([
  { aphe: "none", sizes: ["5", "15", "19.9"] },
  { aphe: "none", sizes: ["20", "25", "40"] },
  { aphe: "nonrim", sizes: ["5", "9.9"] },
  { aphe: "nonrim", sizes: ["10", "15", "19.9"] },
  { aphe: "nonrim", sizes: ["20", "30"] },
]);
const ROW_PROBES = Object.freeze({
  none: [{}],
  one: [{ capsule: true }, { washout: true }, { growth: true }],
  two: [
    { washout: true, capsule: true },
    { washout: true, growth: true },
    { capsule: true, growth: true },
    { washout: true, capsule: true, growth: true },
  ],
});

function expectedCell(cell, features) {
  if (cell === "LR-4|LR-5") return features.capsule ? "LR-4" : "LR-5";
  return cell;
}

export function tableVectors(table) {
  const vectors = [];
  for (const [row, featureSets] of Object.entries(ROW_PROBES)) {
    COLUMN_PROBES.forEach((probe, column) => {
      for (const size of probe.sizes) {
        for (const features of featureSets) {
          vectors.push({
            id: `${row}/${column}/${size}/${Object.keys(features).join("+") || "none"}`,
            values: majors(size, probe.aphe, features),
            expected: expectedCell(table[row][column], features),
          });
        }
      }
    });
  }
  return vectors;
}

export function verifyRuntime(calculator, table = EXPECTED_TABLE) {
  const compute = (vals) => calculator.compute({ ...vals });
  const field = (id) => {
    const found = calculator.fields.find((candidate) => candidate.id === id);
    assert.ok(found, `runtime field ${id} is missing`);
    return found;
  };
  const bindings = {};

  // Field structure: the five targetoid and four nontargetoid LR-M checkboxes.
  for (const id of [...TARGETOID_FIELDS, ...NONTARGETOID_FIELDS, "has_lrm_features"]) {
    assert.equal(field(id).type, "checkbox", `${id} must be a checkbox`);
  }

  // Step 1 order: each earlier branch wins over every later branch.
  const everything = {
    high_risk_population: true,
    study_adequate: true,
    tumor_in_vein: true,
    benign_status: "definitely_benign",
    has_lrm_features: true,
    lrm_rim_aphe: true,
    ...majors("25", "nonrim", { washout: true }),
  };
  const ladder = [
    ["LR-NC", { study_adequate: false }, /^LR-NC /],
    ["LR-TIV", {}, /^LR-TIV /],
    ["LR-1", { tumor_in_vein: false }, /^LR-1 /],
    ["LR-2", { tumor_in_vein: false, benign_status: "probably_benign" }, /^LR-2 /],
    ["LR-M", { tumor_in_vein: false, benign_status: "indeterminate" }, /^LR-M /],
    ["diagnostic-table", { tumor_in_vein: false, benign_status: "indeterminate", has_lrm_features: false }, /^LR-5 /],
  ];
  for (const [step, overrides, expected] of ladder) {
    const category = compute({ ...everything, ...overrides })["LI-RADS Category"] ?? "";
    assert.match(category, expected, `step 1 ${step}: runtime precedence drifted`);
  }
  assert.match(
    compute({ ...everything, study_adequate: false })["LI-RADS Category"] ?? "",
    /^LR-NC /,
    "LR-NC when the study is not adequate",
  );
  bindings["step1-order"] = { runtime_order: ladder.map(([step]) => step) };

  // Diagnostic table sweep, with no LR-M feature, with each nontargetoid and each targetoid one.
  const vectors = tableVectors(table);
  let nontargetoidLr5 = 0;
  let nontargetoidLrm = 0;
  for (const vector of vectors) {
    const plain = compute({ ...INDETERMINATE, ...vector.values });
    assert.equal(plain["LI-RADS Category"], TABLE_LABELS[vector.expected], `table ${vector.id}`);
    for (const id of NONTARGETOID_FIELDS) {
      const result = compute({ ...INDETERMINATE, has_lrm_features: true, [id]: true, ...vector.values });
      if (vector.expected === "LR-5") {
        assert.equal(result["LI-RADS Category"], TABLE_LABELS["LR-5"], `nontargetoid ${id} ${vector.id}: LR-5 criteria met`);
        assert.match(
          result["Nontargetoid LR-M Features"] ?? "",
          /\(LR-M not assigned: LR-5 criteria met\)$/,
          `nontargetoid ${id} ${vector.id}: LR-M-not-assigned row missing`,
        );
        assert.ok(
          (result["Clinical Notes"] ?? "").includes(RUNTIME_TIEBREAK_NOTE),
          `nontargetoid ${id} ${vector.id}: tiebreak note missing`,
        );
        nontargetoidLr5 += 1;
      } else {
        assert.equal(result["LI-RADS Category"], LRM_CATEGORY, `nontargetoid ${id} ${vector.id}: LR-5 criteria not met`);
        assert.equal(
          result["LR-M Basis"],
          `Nontargetoid mass with LR-M feature(s); LR-5 criteria not met (diagnostic table: ${vector.expected})`,
          `nontargetoid ${id} ${vector.id}: LR-M basis drifted`,
        );
        nontargetoidLrm += 1;
      }
    }
    for (const id of TARGETOID_FIELDS) {
      const result = compute({ ...INDETERMINATE, has_lrm_features: true, [id]: true, ...vector.values });
      assert.equal(result["LI-RADS Category"], LRM_CATEGORY, `targetoid ${id} ${vector.id}`);
      assert.equal(result["LR-M Basis"], "Targetoid mass", `targetoid ${id} ${vector.id}`);
    }
  }
  const rim = compute({ ...INDETERMINATE, has_lrm_features: true, lrm_necrosis: true, observation_size: "25", aphe: "rim" });
  assert.equal(rim["LI-RADS Category"], LRM_CATEGORY, "rim APHE is a targetoid appearance");
  bindings["lr5-criteria-are-the-diagnostic-table"] = { table_vectors: vectors.length, table: structuredClone(table) };
  bindings["targetoid-mass-is-lrm"] = {
    targetoid_fields: [...TARGETOID_FIELDS],
    vectors: vectors.length * TARGETOID_FIELDS.length + 1,
    major_features_hidden_when_targetoid: true,
  };
  bindings["nontargetoid-lrm-only-if-not-lr5"] = {
    nontargetoid_fields: [...NONTARGETOID_FIELDS],
    lr5_kept: nontargetoidLr5,
    lrm_assigned: nontargetoidLrm,
    major_features_visible_when_nontargetoid: true,
  };
  bindings["tiebreak-note-lrm-vs-lr5"] = { note: RUNTIME_TIEBREAK_NOTE, results_checked: nontargetoidLr5 };

  // Visibility: nontargetoid features keep the major features on screen; targetoid ones hide them.
  const lrmOn = { ...INDETERMINATE, has_lrm_features: true };
  for (const id of NONTARGETOID_FIELDS) {
    const shown = shownIds(calculator, { ...lrmOn, [id]: true });
    for (const major of MAJOR_FIELDS) assert.ok(shown.has(major), `${id}: ${major} must stay visible`);
  }
  for (const id of TARGETOID_FIELDS) {
    const shown = shownIds(calculator, { ...lrmOn, [id]: true });
    for (const major of MAJOR_FIELDS) assert.ok(!shown.has(major), `${id}: ${major} must be hidden`);
  }
  for (const broken of [{ benign_status: "definitely_benign" }, { benign_status: "" }, { tumor_in_vein: true }]) {
    const shown = shownIds(calculator, { ...lrmOn, lrm_rim_aphe: true, ...broken });
    for (const id of [...TARGETOID_FIELDS, ...NONTARGETOID_FIELDS]) {
      assert.ok(!shown.has(id), `${id} must be hidden when ${JSON.stringify(broken)}`);
    }
  }

  // Step 2 comes after the LR-M decision.
  const necrosis = { ...INDETERMINATE, has_lrm_features: true, lrm_necrosis: true };
  for (const ancillary of [{ ancillary_malignancy: "corona" }, { ancillary_benign: "size_stability" }]) {
    assert.equal(
      compute({ ...necrosis, ...majors("15", "none"), ...ancillary })["LI-RADS Category"],
      LRM_CATEGORY,
      `ancillary ${JSON.stringify(ancillary)} must not act on LR-M`,
    );
  }
  const downgraded = compute({ ...necrosis, ...majors("25", "nonrim", { washout: true }), ancillary_benign: "size_stability" });
  assert.equal(downgraded["LI-RADS Category"], TABLE_LABELS["LR-4"], "LR-5 from step 1, then step 2 downgrade");
  assert.equal(downgraded["Base Category (before ancillary)"], "LR-5");
  const conflicting = compute({
    ...necrosis,
    ...majors("25", "nonrim", { washout: true }),
    ancillary_malignancy: "corona",
    ancillary_benign: "size_stability",
  });
  assert.equal(conflicting["LI-RADS Category"], TABLE_LABELS["LR-5"], "conflicting ancillary features: no adjustment");
  const noUpgrade = compute({ ...INDETERMINATE, ...majors("25", "nonrim"), ancillary_hcc: "mosaic" });
  assert.equal(noUpgrade["LI-RADS Category"], TABLE_LABELS["LR-4"], "ancillary features never upgrade to LR-5");
  bindings["lrm-decided-before-ancillary-features"] = {
    lrm_unaffected_by_ancillary: true,
    lr5_then_benign_downgrade: downgraded["LI-RADS Category"],
    conflicting_no_adjustment: true,
    no_upgrade_to_lr5: true,
  };

  // Reworded subLabels.
  for (const [id, text] of Object.entries(RUNTIME_SUBLABELS)) {
    assert.equal(field(id).subLabel, text, `${id} subLabel drifted`);
  }
  bindings["sublabel-high-risk-population"] = { field: "high_risk_population", subLabel: RUNTIME_SUBLABELS.high_risk_population };
  bindings["sublabel-study-adequate"] = { field: "study_adequate", subLabel: RUNTIME_SUBLABELS.study_adequate };
  bindings["sublabel-tumor-in-vein"] = { field: "tumor_in_vein", subLabel: RUNTIME_SUBLABELS.tumor_in_vein };
  bindings["sublabel-has-lrm-features"] = { field: "has_lrm_features", subLabel: RUNTIME_SUBLABELS.has_lrm_features };

  // The LR-TIV result repeats the field's definition: tumor in any vein, not only portal or hepatic.
  const tiv = compute({ high_risk_population: true, study_adequate: true, tumor_in_vein: true });
  assert.equal(tiv["LI-RADS Category"], "LR-TIV (Tumor in Vein)", "tumor in vein is LR-TIV");
  assert.equal(tiv.Definition, RUNTIME_TIV_DEFINITION, "LR-TIV result definition drifted");
  bindings["result-tumor-in-vein-definition"] = { category: tiv["LI-RADS Category"], definition: tiv.Definition };

  // Threshold growth (v2018): the field, the result note and the subthreshold-growth option.
  assert.equal(
    field("threshold_growth").subLabel,
    RUNTIME_THRESHOLD_GROWTH.subLabel,
    "threshold_growth subLabel drifted",
  );
  const subthreshold = (field("ancillary_malignancy").opts ?? []).find((opt) => opt.value === "subthreshold_growth");
  assert.equal(subthreshold?.label, RUNTIME_THRESHOLD_GROWTH.subthresholdOption, "subthreshold growth option drifted");
  const visibleText = JSON.stringify(
    calculator.fields.map((candidate) => [candidate.label, candidate.subLabel, (candidate.opts ?? []).map((opt) => opt.label)]),
  );
  assert.doesNotMatch(visibleText, /or new observation ≥\s?10\s?mm/i, "a new observation is still offered as threshold growth");
  let growthVectors = 0;
  for (const vector of vectors) {
    const withSubthreshold = compute({
      ...INDETERMINATE,
      ...vector.values,
      ancillary_malignancy: "subthreshold_growth",
    });
    const expected = vector.expected === "LR-3" ? "LR-4" : vector.expected;
    assert.equal(
      withSubthreshold["LI-RADS Category"],
      TABLE_LABELS[expected],
      `subthreshold growth ${vector.id}: an ancillary feature upgrades one category, never to LR-5`,
    );
    if (vector.values.threshold_growth === "present") {
      const plain = compute({ ...INDETERMINATE, ...vector.values });
      assert.ok(
        (plain["Clinical Notes"] ?? "").includes(RUNTIME_THRESHOLD_GROWTH.note),
        `threshold growth note missing for ${vector.id}`,
      );
    }
    growthVectors += 1;
  }
  const newObservationAsSubthreshold = compute({
    ...INDETERMINATE,
    ...majors("15", "nonrim"),
    ancillary_malignancy: "subthreshold_growth",
  });
  assert.equal(
    newObservationAsSubthreshold["LI-RADS Category"],
    TABLE_LABELS["LR-4"],
    "subthreshold growth: a new 10-19 mm nonrim-APHE observation must stay below LR-5",
  );
  bindings["threshold-growth-v2018"] = {
    field_subLabel: RUNTIME_THRESHOLD_GROWTH.subLabel,
    result_note: RUNTIME_THRESHOLD_GROWTH.note,
    subthreshold_option: RUNTIME_THRESHOLD_GROWTH.subthresholdOption,
    subthreshold_vectors: growthVectors,
    new_observation_10_19mm_nonrim_aphe: newObservationAsSubthreshold["LI-RADS Category"],
  };

  // Benign ancillary features: exactly one category down, LR-3 to LR-2 included; none when mixed.
  let downgradeVectors = 0;
  for (const vector of vectors) {
    for (const benign of BENIGN_ANCILLARY_VALUES) {
      const result = compute({ ...INDETERMINATE, ...vector.values, ancillary_benign: benign });
      const expected = ONE_CATEGORY_DOWN[vector.expected];
      assert.equal(
        result["LI-RADS Category"],
        expected === "LR-2" ? LR2_LABEL : TABLE_LABELS[expected],
        `benign downgrade ${vector.id} + ${benign}: exactly one category down`,
      );
      assert.equal(result["Base Category (before ancillary)"], vector.expected, `benign downgrade ${vector.id}: base category`);
      downgradeVectors += 1;
    }
    const mixed = compute({
      ...INDETERMINATE,
      ...vector.values,
      ancillary_benign: "size_stability",
      ancillary_malignancy: "corona",
    });
    assert.equal(mixed["LI-RADS Category"], TABLE_LABELS[vector.expected], `benign downgrade ${vector.id}: mixed means no change`);
  }
  const lr2 = compute({ ...INDETERMINATE, ...majors("15", "none"), ancillary_benign: "size_stability" });
  assert.equal(lr2["HCC Probability"], "~14%", "benign downgrade to LR-2: probably-benign figures");
  assert.equal(lr2._severity, "success", "benign downgrade to LR-2: severity");
  bindings["benign-ancillary-downgrade-one-category"] = {
    benign_values: [...BENIGN_ANCILLARY_VALUES],
    downgrade_vectors: downgradeVectors,
    lr3_to_lr2: lr2["LI-RADS Category"],
    mixed_no_adjustment: true,
  };

  // ACR reference: the live LI-RADS page that links the pinned Core PDF, not the dead path.
  const refUrls = (calculator.refs ?? []).map((ref) => ref.u);
  assert.ok(refUrls.includes(SOURCE.landing_page), "ACR reference must be the live LI-RADS page");
  assert.ok(!refUrls.includes(DEAD_ACR_REFERENCE), "ACR reference still points to the dead page");
  bindings["acr-reference-is-live-landing-page"] = { reference_url: SOURCE.landing_page };

  // Management wording (Core printed p. 14; p. 16 forbids language that compels biopsy): every LR-M result, targetoid
  // or nontargetoid, and both LR-2 results (probably benign, and the one-step downgrade of LR-3) state it exactly.
  const lrmTargetoid = compute({ ...INDETERMINATE, has_lrm_features: true, lrm_necrosis: true, observation_size: "25", aphe: "rim" });
  const lrmNontargetoid = compute({ ...INDETERMINATE, has_lrm_features: true, lrm_necrosis: true, ...majors("15", "none") });
  for (const [label, result] of [["targetoid", lrmTargetoid], ["nontargetoid", lrmNontargetoid]]) {
    assert.equal(result["LI-RADS Category"], LRM_CATEGORY, `${label} LR-M vector`);
    assert.equal(result.Recommendation, RUNTIME_LRM_RECOMMENDATION, `LR-M recommendation drifted (${label})`);
  }
  bindings["lrm-management-tailored-workup"] = { recommendation: RUNTIME_LRM_RECOMMENDATION, paths: ["targetoid", "nontargetoid"] };
  const lr2Direct = compute({ ...INDETERMINATE, benign_status: "probably_benign" });
  for (const [label, result] of [["probably benign", lr2Direct], ["LR-3 downgraded", lr2]]) {
    assert.equal(result["LI-RADS Category"], LR2_LABEL, `${label} LR-2 vector`);
    assert.equal(result.Recommendation, RUNTIME_LR2_RECOMMENDATION, `LR-2 recommendation drifted (${label})`);
  }
  bindings["lr2-management-surveillance"] = { recommendation: RUNTIME_LR2_RECOMMENDATION, paths: ["probably benign", "LR-3 downgraded"] };

  return { bindings, guardrails: verifyGuardrails(calculator) };
}

// Radulator data-entry guardrails (not publication-derived): actionable prompts instead of dead
// ends, and hidden-field values never reach the result.
export function verifyGuardrails(calculator) {
  const compute = (vals) => calculator.compute({ ...vals });
  const lrmOn = { ...INDETERMINATE, has_lrm_features: true };
  for (const values of [{}, majors("25", "nonrim", { washout: true }), majors("25", "none")]) {
    assert.deepEqual(compute({ ...lrmOn, ...values }), { Error: RUNTIME_ERRORS.lrmWithoutFeature }, "LR-M box without a feature");
  }
  const base = { high_risk_population: true, study_adequate: true, tumor_in_vein: false };
  assert.deepEqual(
    compute({ ...base, ...majors("25", "nonrim", { washout: true }) }),
    { Error: RUNTIME_ERRORS.benignityUnselected },
    "benignity not chosen",
  );
  assert.deepEqual(
    compute({ ...lrmOn, lrm_infiltrative: true }),
    { Error: RUNTIME_ERRORS.nontargetoidIncomplete },
    "nontargetoid feature without major features",
  );

  const scenarios = [
    {},
    { high_risk_population: true },
    { ...base },
    { ...base, tumor_in_vein: true },
    { ...INDETERMINATE, benign_status: "definitely_benign" },
    { ...INDETERMINATE, benign_status: "probably_benign" },
    { ...INDETERMINATE },
    { ...INDETERMINATE, ...majors("15", "nonrim", { washout: true }) },
    { ...INDETERMINATE, ...majors("15", "none"), ancillary_malignancy: "corona" },
    { ...lrmOn },
    { ...lrmOn, lrm_targetoid_restriction: true },
    { ...lrmOn, lrm_marked_restriction: true, ...majors("25", "nonrim", { capsule: true }) },
    { ...lrmOn, lrm_other: true, ...majors("25", "nonrim") },
    { ...INDETERMINATE, observation_size: "25", aphe: "rim" },
  ];
  const valuesFor = (field) => {
    if (field.type === "checkbox") return [true, false];
    if (field.type === "number") return ["5", "15", "25"];
    return [...(field.opts ?? []).map((opt) => opt.value), ""];
  };
  let hiddenMutations = 0;
  for (const scenario of scenarios) {
    const baseline = compute(scenario);
    const shown = shownIds(calculator, scenario);
    for (const field of calculator.fields.filter((candidate) => !shown.has(candidate.id))) {
      for (const value of valuesFor(field)) {
        assert.deepEqual(
          compute({ ...scenario, [field.id]: value }),
          baseline,
          `hidden ${field.id}=${JSON.stringify(value)} changed the result for ${JSON.stringify(scenario)}`,
        );
        hiddenMutations += 1;
      }
    }
  }
  return {
    provenance: "radulator-data-entry-guardrail",
    publication_derived: false,
    actionable_errors: Object.keys(RUNTIME_ERRORS),
    hidden_field_scenarios: scenarios.length,
    hidden_field_mutations: hiddenMutations,
  };
}

// ---------------------------------------------------------------------------------------------
// PDF extraction and the audit run

export async function pdfPages(bytes, wanted) {
  const document = await getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    useSystemFonts: true,
    verbosity: 0,
  }).promise;
  assert.equal(document.numPages, SOURCE.pages, `${SOURCE.key}: PDF page count drifted`);
  const pages = new Map();
  for (const pageNumber of [...new Set(wanted)].sort((left, right) => left - right)) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => typeof item.str === "string")
      .map((item) => ({ str: item.str, hasEOL: Boolean(item.hasEOL), x: item.transform[4], y: item.transform[5] }));
    pages.set(pageNumber, {
      text: items.map((item) => `${item.str}${item.hasEOL ? " " : ""}`).join(""),
      items: items.filter((item) => item.str.trim() !== ""),
    });
  }
  await document.destroy();
  return pages;
}

export function verifyStatements(pages, statements = STATEMENTS) {
  const mismatches = [];
  const verified = new Map();
  for (const statement of statements) {
    const page = pages.get(statement.pdf_page);
    assert.ok(page, `${statement.id}: PDF page ${statement.pdf_page} was not extracted`);
    verified.set(statement.id, {
      id: statement.id,
      pdf_page: statement.pdf_page,
      ...(statement.printed_page ? { printed_page: statement.printed_page } : {}),
      locator: statement.locator,
      paraphrase: statement.paraphrase,
      spans: checkSpans(statement, page.text, mismatches),
    });
  }
  return { verified, mismatches };
}

export function assertBindingsCoverStatements(verified, bindings = CLAIM_BINDINGS) {
  const bound = new Set(bindings.flatMap((binding) => binding.source_statement_ids));
  for (const binding of bindings) {
    for (const id of binding.source_statement_ids) {
      assert.ok(verified.has(id), `${binding.claim_id}: source statement ${id} is not verified`);
    }
  }
  for (const id of verified.keys()) {
    if (id.endsWith("-identity")) continue;
    assert.ok(bound.has(id), `${id}: verified statement has no runtime binding`);
  }
}

// Applies each SOURCE_MUTATIONS edit to the real page text in memory and requires the named
// statement's pin to break (a digest mismatch or a vanished marker). Nothing is written.
export function verifySourceMutations(pages, statements = STATEMENTS, mutations = SOURCE_MUTATIONS) {
  return mutations.map((mutation) => {
    const statement = statements.find((candidate) => candidate.id === mutation.statement_id);
    assert.ok(statement, `source mutation: unknown statement ${mutation.statement_id}`);
    const text = foldText(pages.get(statement.pdf_page)?.text ?? "");
    assert.ok(
      text.includes(mutation.find),
      `source mutation: ${JSON.stringify(mutation.find)} is not on PDF page ${statement.pdf_page}`,
    );
    const mutated = text.split(mutation.find).join(mutation.replace);
    let detected;
    try {
      const mismatches = [];
      checkSpans(statement, mutated, mismatches);
      detected = mismatches.length > 0;
    } catch {
      detected = true;
    }
    assert.ok(
      detected,
      `source mutation ${mutation.statement_id} (${mutation.find} -> ${mutation.replace}) was not caught by its pin`,
    );
    return { statement_id: mutation.statement_id, find: mutation.find, replace: mutation.replace, detected };
  });
}

function verifyCalculatorSource(calculatorSource) {
  for (const [removed, reason] of [
    ["!vals.has_lrm_features", "calculator still hides the major features behind the LR-M checkbox"],
    ["or new observation ≥10mm", "calculator still counts a new observation as threshold growth"],
    ["no further downgrade possible", "calculator still stops the benign downgrade at LR-3"],
    [DEAD_ACR_REFERENCE, "calculator still links the dead ACR page"],
  ]) {
    assert.ok(!calculatorSource.includes(removed), reason);
  }
}

async function main() {
  // retrieve() returns only bytes whose final URL, media type, byte length and SHA-256 already
  // match the pins; nothing below parses the PDF before that.
  const [retrieved, calculatorSource] = await Promise.all([retrieve(SOURCE), readFile(CALCULATOR_PATH, "utf8")]);

  const pages = await pdfPages(retrieved.bytes, STATEMENTS.map((statement) => statement.pdf_page));
  const { verified, mismatches } = verifyStatements(pages);
  assert.equal(
    mismatches.length,
    0,
    `pinned source spans drifted (re-review each statement at its locator before re-pinning):\n${JSON.stringify(mismatches, null, 2)}`,
  );
  assertBindingsCoverStatements(verified);
  const sourceMutations = verifySourceMutations(pages);

  const layout = {
    step1_order: checkStep1Order(pages.get(11).items),
    diagnostic_table: parseDiagnosticTable(pages.get(11).items),
    step2_ladder: checkStep2Ladder(pages.get(12).items),
    lrm_condition_box: checkLrmConditionPlacement(pages.get(25).items),
    tiebreak_label: checkTiebreakLabelPlacement(pages.get(13).items),
  };
  assert.deepEqual(layout.diagnostic_table, EXPECTED_TABLE, "diagnostic table cells drifted from the pinned facts");

  verifyCalculatorSource(calculatorSource);
  const runtime = verifyRuntime(LIRADS, layout.diagnostic_table);
  for (const binding of CLAIM_BINDINGS) {
    assert.ok(runtime.bindings[binding.claim_id], `${binding.claim_id}: runtime binding was not exercised`);
  }
  const pdfOrder = layout.step1_order.map((row) => row.step).slice(0, 6);
  assert.deepEqual(pdfOrder, runtime.bindings["step1-order"].runtime_order, "runtime step 1 order differs from the PDF");

  const audit = {
    schema: "radulator-lirads-lrm-source-audit/v1",
    calculator_id: LIRADS.id,
    calculator_path: CALCULATOR_PATH,
    source: {
      key: SOURCE.key,
      authority: SOURCE.authority,
      document: SOURCE.document,
      landing_page: SOURCE.landing_page,
      url: SOURCE.url,
      final_url: retrieved.finalUrl.href,
      media_type: SOURCE.media_type,
      pin: SOURCE.pin,
      bytes: SOURCE.bytes,
      sha256: SOURCE.sha256,
      pages: SOURCE.pages,
      retrieval_attempts: retrieved.attempts,
    },
    source_statements: [...verified.values()],
    source_mutations: sourceMutations,
    layout,
    claim_bindings: CLAIM_BINDINGS.map((binding) => ({
      claim_id: binding.claim_id,
      source_statement_ids: [...binding.source_statement_ids],
      runtime: runtime.bindings[binding.claim_id],
    })),
    app_guardrails: runtime.guardrails,
    scope: {
      not_asserted: [
        "ancillary-feature adjustment of LR-1 and LR-2 chosen directly in the benignity question",
        "LR-M and LR-5 probability figures",
        "management recommendations",
        "whole-calculator clinical acceptance",
      ],
    },
    source_bytes_committed: false,
  };

  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(audit)}\n`);
  } else {
    console.log(
      `LI-RADS LR-M primary-source audit passed: 1 pinned artifact, ${verified.size} source statements, ${CLAIM_BINDINGS.length} runtime claim bindings, ${runtime.bindings["lr5-criteria-are-the-diagnostic-table"].table_vectors} table vectors and ${runtime.guardrails.hidden_field_mutations} hidden-field mutations.`,
    );
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  await main();
}
