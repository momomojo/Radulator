#!/usr/bin/env node

// Exact-head primary-source audit for the AAST grade-advance modifiers and related wording in
// src/components/calculators/AASTTraumaGrading.jsx.
//
// Every retrieved artifact is pinned by its exact byte length and SHA-256, and both pins are
// verified before anything is parsed. A served artifact (HTTP 2xx) that misses its URL, media
// type, provenance, length or digest pin is a changed source: it fails at once and is never
// retried or replaced by another host. Transport failures (network errors, HTTP 429 and 5xx, a
// Cloudflare challenge or block page and, for NCBI only, HTTP 400) are retried with 1/2/4/8 s
// backoff or Retry-After (capped); after the last attempt on the last host the audit fails loudly.
// No path passes without verifying the pinned bytes.
//
// Artifacts:
// - Kozar et al., "Organ injury scaling 2018 update: Spleen, liver, and kidney" (J Trauma Acute
//   Care Surg 2018;85:1119-1122): the AAST-hosted PDF. The Internet Archive capture of that same
//   AAST file (identical pinned bytes) is used only after the AAST host's transport retries are
//   exhausted.
// - The AAST's own injury scoring scale page as served by aast.org on 2020-11-01 (Internet
//   Archive capture; the live page no longer carries the tables): pancreas table note.
// - PubMed plain-text abstracts (efetch rettype=abstract, retmode=text, tool parameter, no email)
//   for Kozar 2018, Keihani 2025 and Notrica 2025. This form carries no retrieval metadata, so it
//   changes only when the record changes.
//
// Each source statement is pinned by the SHA-256 and length of its exact normalized span between
// two anchors of at most six words at its locator; `paraphrase` is Radulator's own summary and no
// source passage is committed. The statements are bound to the calculator runtime. Any drift
// exits non-zero.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const CALCULATOR_PATH = "src/components/calculators/AASTTraumaGrading.jsx";
const USER_AGENT = "Radulator-AAST-injury-modifier-source-audit/2";
export const MAX_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MS = 20_000;
const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
export const NCBI_TOOL = "radulator-aast-audit";

const KOZAR_STATIC_URL =
  "https://www.aast.org/static/journal_pdf_1ea6c353-e5b1-40d7-85ab-2a7cb76e886a/1ea6c353-e5b1-40d7-85ab-2a7cb76e886a.pdf";
const AAST_SCALE_PAGE_URL = "https://www.aast.org/resources-detail/injury-scoring-scale";

function pubmedArtifact(pmid, bytes, sha256, document) {
  return Object.freeze({
    key: `pubmed${pmid}`,
    authority: "U.S. National Library of Medicine (PubMed plain-text abstract, NCBI E-utilities)",
    document,
    pmid,
    media_type: "text/plain",
    bytes,
    sha256,
    hosts: Object.freeze([
      Object.freeze({
        key: "ncbi",
        url: `${EFETCH}?db=pubmed&id=${pmid}&rettype=abstract&retmode=text&tool=${NCBI_TOOL}`,
        final_url_exact: true,
        // NCBI answers valid E-utilities requests with a transient HTTP 400 at times.
        retry_http_400: true,
      }),
    ]),
  });
}

export const ARTIFACTS = Object.freeze({
  kozar2018: Object.freeze({
    key: "kozar2018",
    authority: "American Association for the Surgery of Trauma (AAST-hosted copy of the journal article)",
    document:
      "Kozar RA, Crandall M, Shanmuganathan K, et al. Organ injury scaling 2018 update: Spleen, liver, and kidney. J Trauma Acute Care Surg. 2018;85(6):1119-1122",
    doi: "10.1097/TA.0000000000002058",
    pmid: "30462622",
    media_type: "application/pdf",
    bytes: 174_748,
    sha256: "bcd66906506efee3757ce1ea39e0da66bf30e39ffa7ccf3c33cc2678b3430965",
    pages: 4,
    hosts: Object.freeze([
      Object.freeze({
        key: "aast",
        // The AAST asset link redirects into AAST's static store; the store path is checked by
        // pattern (the asset id is the stable AAST identifier), the bytes exactly.
        url: "https://www.aast.org/asset/1EDF1B04-6B52-4E7B-9130ACA30413089D/",
        final_host: "www.aast.org",
        final_path_pattern: "^/static/journal_pdf_[0-9a-f-]{36}/[0-9a-f-]{36}\\.pdf$",
      }),
      Object.freeze({
        key: "internet-archive",
        // Same AAST file, captured 2026-04-19; immutable, identical bytes.
        url: `https://web.archive.org/web/20260419100016id_/${KOZAR_STATIC_URL}`,
        final_url_exact: true,
        memento_datetime: "Sun, 19 Apr 2026 10:00:16 GMT",
        memento_original: KOZAR_STATIC_URL,
      }),
    ]),
  }),
  aastScalePage2020: Object.freeze({
    key: "aastScalePage2020",
    authority: "American Association for the Surgery of Trauma (injury scoring scale page, archived)",
    document:
      "AAST Injury Scoring Scale page with the organ injury scale tables, as served by aast.org on 2020-11-01",
    media_type: "text/html",
    bytes: 274_891,
    sha256: "e60dd713368a7ceddf61d368cf9d8ac9dc70d183d64096753c93cb218816481b",
    hosts: Object.freeze([
      Object.freeze({
        key: "internet-archive",
        url: `https://web.archive.org/web/20201101034458id_/${AAST_SCALE_PAGE_URL}`,
        final_url_exact: true,
        memento_datetime: "Sun, 01 Nov 2020 03:44:58 GMT",
        memento_original: AAST_SCALE_PAGE_URL,
      }),
    ]),
  }),
  pubmed30462622: pubmedArtifact(
    "30462622",
    1_474,
    "da35009c9ef5910296f34614591307c25c4b1d2b6ca4deeae109932ae7a5eec8",
    "PubMed 30462622 (Kozar 2018, organ injury scaling 2018 update)",
  ),
  pubmed39836096: pubmedArtifact(
    "39836096",
    2_069,
    "909f136488d4777571f78604db5b9183751e88f61fc338a54f70ee45f0f723ec",
    "PubMed 39836096 (Keihani 2025, kidney organ injury scaling 2025 update)",
  ),
  pubmed39898876: pubmedArtifact(
    "39898876",
    3_705,
    "fad50e9dcbc52c90879d1d7fdf6100de46cd94481ce9c1e2a27c9bf7f4d62911",
    "PubMed 39898876 (Notrica 2025, pancreatic organ injury scale 2024 revision)",
  ),
});

// Kozar 2018 PDF statements. `start`/`end` bound the locator on the named PDF page
// (lower-case folded page text) before the span anchors are applied; spans are compared after
// lower-casing and removing whitespace and hyphens, so typeset line breaks and end-of-line
// hyphenation do not matter and every other character must match. `must_contain` pairs are
// mutation checks run on the real span at audit time: replacing the first token with the second
// must change the pinned digest, which also proves the span holds that token.
export const KOZAR_STATEMENTS = Object.freeze([
  Object.freeze({
    id: "kozar2018-identity",
    pdf_page: 1,
    printed_page: 1119,
    locator: "Title block and DOI line",
    start: null,
    end: null,
    paraphrase: "The PDF is Kozar et al., the AAST 2018 organ injury scaling update for spleen, liver and kidney (DOI 10.1097/TA.0000000000002058).",
    spans: [
      { from: "Organ injury scaling 2018 update:", to: "liver, and kidney", length: 51, sha256: "88ec8a4410db1854f187ac5ce0a79ae2251970b574386210149af10809938cc3" },
      { from: "DOI: 10.1097/TA.", to: "0000000002058", length: 31, sha256: "c29765dcd66549c4ab11858411d17f15416420dda9bcc959c9c85082b3a3a882" },
    ],
  }),
  Object.freeze({
    id: "kozar2018-intro-multiple-grade-i-ii",
    pdf_page: 2,
    printed_page: 1120,
    locator: "Introduction, paragraph on the three grading criteria",
    start: "the solid organ injury scale includes",
    end: "it is recognized that pathologic",
    paraphrase:
      "The final grade is the highest of the imaging, operative and pathologic grades; when two or more grade I-II injuries coexist, the grade rises by one, capped at grade III.",
    spans: [{ from: "Additionally, if multiple grade I", to: "up to a grade III.", length: 100, sha256: "ef31c680b05fae8abab6ca881f2239599503fe5ff6218189da8c4d7115c8707e" }],
    must_contain: [["multiple", "bilateral"], ["gradeiii", "gradeiv"]],
  }),
  Object.freeze({
    id: "kozar2018-table1-spleen-notes",
    pdf_page: 2,
    printed_page: 1120,
    locator: "Table 1 (Spleen Organ Injury Scale, 2018 Revision), table notes",
    start: "table 1. spleen organ injury scale",
    end: null,
    paraphrase:
      "Spleen: several injury grades are classified by the highest one, and multiple injuries advance the grade by one up to grade III.",
    spans: [
      { from: "More than one grade of splenic", to: "higher grade of injury.", length: 89, sha256: "cfe3115003f594c7db901176958e61f2e95bc36e40121d68921df686566aadab" },
      { from: "Advance one grade for multiple", to: "a grade III.", length: 48, sha256: "b85de582ee4b5967f096d3e7c059b002806955b901bfb4423e4c806be6c9dbf8" },
    ],
    must_contain: [["multiple", "bilateral"], ["gradeiii", "gradeiv"]],
    must_not_contain: ["Advance one grade for bilateral"],
  }),
  Object.freeze({
    id: "kozar2018-table2-liver-notes",
    pdf_page: 3,
    printed_page: 1121,
    locator: "Table 2 (Liver Injury Scale, 2018 Revision), table notes",
    start: "table 2. liver injury scale",
    end: "table 3. kidney injury scale",
    paraphrase:
      "Liver: several injury grades are classified by the highest one, and multiple injuries advance the grade by one up to grade III.",
    spans: [
      { from: "More than one grade of liver", to: "higher grade of injury.", length: 87, sha256: "06919be0ee7d77a806f173d1c16209dee7450ba48bfe6416d40a9e3ee6f5b7b1" },
      { from: "Advance one grade for multiple", to: "a grade III.", length: 48, sha256: "b85de582ee4b5967f096d3e7c059b002806955b901bfb4423e4c806be6c9dbf8" },
    ],
    must_contain: [["multiple", "bilateral"], ["gradeiii", "gradeiv"]],
    must_not_contain: ["Advance one grade for bilateral"],
  }),
  Object.freeze({
    id: "kozar2018-table2-liver-grade-ii-laceration-length",
    pdf_page: 3,
    printed_page: 1121,
    locator: "Table 2, grade II row, Imaging Criteria (CT Findings), laceration item",
    start: "ii 2 - subcapsular hematoma 10-50%",
    end: "length - subcapsular hematoma",
    paraphrase: "On the 2018 liver scale, a grade II laceration is 1-3 cm deep and no more than 10 cm long (≤10 cm).",
    spans: [{ from: "Laceration 1-3 cm in depth", to: "≤ 10 cm", length: 29, sha256: "7fadb0444b9ddd8503b61f3e45cdf342f7b6eeeedda4625ba46ac8826328f63e" }],
    must_contain: [["≤10cm", "<10cm"]],
  }),
  Object.freeze({
    id: "kozar2018-table3-kidney-notes",
    pdf_page: 3,
    printed_page: 1121,
    locator: "Table 3 (Kidney Injury Scale, 2018 Revision), table notes",
    start: "table 3. kidney injury scale",
    end: null,
    paraphrase:
      "Kidney: several injury grades in one kidney are classified by the highest one; the one-grade advance (to at most grade III) is for bilateral injuries. The kidney table has no multiple-injury advance.",
    spans: [
      { from: "More than one grade of kidney", to: "higher grade of injury.", length: 88, sha256: "b039c9dd44be2b078d880698ef176fdfb197aafaed3ab9a94784c1cdc204182a" },
      { from: "Advance one grade for bilateral", to: "Grade III.", length: 48, sha256: "9890ed6ae41178c64c3064697c32e9b08671b5b90b7f507959a7cf8f9ef2ca67" },
    ],
    must_contain: [["bilateral", "multiple"], ["gradeiii", "gradeiv"]],
    must_not_contain: ["Advance one grade for multiple"],
  }),
  Object.freeze({
    id: "kozar2018-table3-kidney-grade-iv-urinary-extravasation",
    pdf_page: 3,
    printed_page: 1121,
    locator: "Table 3, grade IV row, Imaging Criteria (CT Findings), first item",
    start: "iv 4 - parenchymal laceration extending",
    end: "- renal pelvis laceration",
    paraphrase:
      "On the 2018 kidney scale, a laceration that reaches the collecting system with urinary extravasation is an imaging grade IV finding.",
    spans: [{ from: "Parenchymal laceration extending into urinary", to: "with urinary extravasation", length: 81, sha256: "ba301142e155798c128d133ae86f5101f060db61ab5283901f84a1f752808d33" }],
    must_contain: [["urinaryextravasation", "activebleeding"]],
  }),
  Object.freeze({
    id: "kozar2018-table3-active-bleeding-delayed-phase",
    pdf_page: 3,
    printed_page: 1121,
    locator: "Table 3, table note defining vascular injury and active bleeding",
    start: "table 3. kidney injury scale",
    end: null,
    paraphrase:
      "Active bleeding is vascular contrast that grows in size or attenuation on the delayed phase, so 'contrast on the delayed phase' alone does not identify urinary extravasation.",
    spans: [{ from: "Active bleeding from a vascular", to: "in delayed phase.", length: 122, sha256: "8dc2fd2aabf33458d53d4fad76d0a787c1cbcf04549be3a2c695baaa90886461" }],
    must_contain: [["delayedphase", "arterialphase"]],
  }),
  Object.freeze({
    id: "kozar2018-delayed-excretory-phase",
    pdf_page: 4,
    printed_page: 1122,
    locator: "Closing paragraph on CT technique",
    start: null,
    end: "we sincerely hope that these",
    paraphrase: "If renal injury is known or suspected, the CT should also include a delayed excretory phase.",
    spans: [{ from: "when a renal injury is known", to: "obtained as well.", length: 86, sha256: "ed61ef1979296cde1e9e8f45cfaf22a09d43d2bad0eb6519a02dbba3cd9fae48" }],
    must_contain: [["excretory", "arterial"]],
  }),
]);

// Statements on the AAST scale page (case-preserving folded text of the page with scripts,
// styles and tags removed). `start`/`end` bound the locator region.
export const AAST_PAGE_STATEMENTS = Object.freeze([
  Object.freeze({
    id: "aast-scale-page-pancreas-multiple-injury-note",
    locator: "AAST Injury Scoring Scale page, Table 10 (Pancreas Injury Scale), table note",
    start: "Table 10 Pancreas Injury Scale",
    end: "Back to Top",
    paraphrase:
      "The AAST's pancreas injury scale table (the pre-2024 scale) notes that multiple injuries raise the grade by one, to at most grade III.",
    spans: [{ from: "*Advance one grade for multiple", to: "up to grade III.", length: 57, sha256: "939484753d687225e497a3ee438eb597c0601b067a8f28bb080a90da75ecc2c4" }],
    must_contain: [["multiple", "bilateral"], ["grade III", "grade IV"]],
  }),
  Object.freeze({
    id: "aast-scale-page-pancreas-table-credit",
    locator: "AAST Injury Scoring Scale page, Table 10 (Pancreas Injury Scale), credit line",
    start: "Table 10 Pancreas Injury Scale",
    end: "Back to Top",
    paraphrase: "The AAST credits its pancreas table to Moore et al. (the original AAST organ injury scaling series), reprinted with permission.",
    spans: [{ from: "From Moore et al.", to: "with permission.", length: 39, sha256: "6f5d493a025d0e1e31e25b07c3d77c46a06a62d981599d859664f64a2220764c" }],
    must_contain: [["Moore", "Kozar"]],
  }),
]);

// PubMed abstract statements (folded text of the parsed abstract block).
export const PUBMED_STATEMENTS = Object.freeze([
  Object.freeze({
    id: "notrica2025-abstract-grade-v",
    pmid: "39898876",
    locator: "PubMed abstract, sentence defining grade V",
    paraphrase:
      "In the 2024 pancreas revision, grade V is a destructive pancreatic-head injury with nonviable tissue, further subgraded by ductal injury.",
    spans: [{ from: "Grade V injuries are destructive", to: "with nonviable parenchyma.", length: 91, sha256: "127e7eacbe699a3f8cf81115ac9a1fcc1cdc45440e17692c89365fd048959981" }],
  }),
  Object.freeze({
    id: "notrica2025-abstract-duct-location",
    pmid: "39898876",
    locator: "PubMed abstract, sentences on grade III and grade IV duct injuries",
    paraphrase:
      "In the 2024 revision a duct injury in the neck, body or tail stays grade III (subclassified as no ductal interrogation, partial, or complete transection), while the same injury located right of the portal vein/SMV, in the head, is grade IV. The grade therefore depends on the location.",
    spans: [
      { from: "Injuries to the duct in", to: "complete ductal transection.", length: 231, sha256: "9faf71e7e381594585e50b298613b78e5dfa487cdc5ecd71a10bc27af4ddb774" },
      { from: "Grade IV injuries follow the", to: "superior mesenteric vein.", length: 124, sha256: "a78807cbc064ef6bb0d10e7a0e0f9ee9a93ff7229d28b4db5aadef6033777c4a" },
    ],
  }),
  Object.freeze({
    id: "notrica2025-abstract-original-1990",
    pmid: "39898876",
    locator: "PubMed abstract, first sentence",
    paraphrase: "The AAST OIS committee published the original pancreatic scale in 1990; the 2024 revision replaces it.",
    spans: [{ from: "published the original pancreatic OIS", to: "in 1990", length: 45, sha256: "c8f32dbbd30785e396f4a2282c8288dfeb9e6286dcd5b85f3b16938729bba9b3" }],
  }),
]);

// PubMed identities: identifiers only (title, first authors, journal citation, DOI, linked errata).
export const PUBMED_IDENTITIES = Object.freeze([
  Object.freeze({
    id: "kozar2018-pubmed-identity",
    pmid: "30462622",
    title: "Organ injury scaling 2018 update: Spleen, liver, and kidney.",
    first_authors: ["Kozar RA", "Crandall M", "Shanmuganathan K"],
    journal: "J Trauma Acute Care Surg",
    year: "2018",
    volume: "85",
    issue: "6",
    pages: "1119-1122",
    doi: "10.1097/TA.0000000000002058",
    // The only linked erratum (author-name correction; its text is not openly retrievable).
    errata: ["J Trauma Acute Care Surg. 2019 Aug;87(2):512. doi: 10.1097/TA.0000000000002419."],
  }),
  Object.freeze({
    id: "keihani2025-pubmed-identity",
    pmid: "39836096",
    title: "Kidney organ injury scaling: 2025 update.",
    first_authors: ["Keihani S", "Tominaga GT", "Matta R"],
    journal: "J Trauma Acute Care Surg",
    year: "2025",
    volume: "98",
    issue: "3",
    pages: "448-451",
    doi: "10.1097/TA.0000000000004509",
    errata: [],
  }),
  Object.freeze({
    id: "notrica2025-pubmed-identity",
    pmid: "39898876",
    title: "American Association for the Surgery of Trauma pancreatic organ injury scale: 2024 revision.",
    first_authors: ["Notrica DM", "Tominaga GT", "Gross JA"],
    journal: "J Trauma Acute Care Surg",
    year: "2025",
    volume: "98",
    issue: "3",
    pages: "442-447",
    doi: "10.1097/TA.0000000000004522",
    errata: [],
  }),
]);

export const RUNTIME_TEXT = Object.freeze({
  multiple_label: "Multiple Injuries in Same Organ",
  multiple_sublabel:
    "Multiple grade I–II injuries: advance one grade, up to Grade III (2018 liver/spleen OIS; 1990 AAST pancreas scale)",
  bilateral_label: "Bilateral Renal Injuries",
  bilateral_sublabel: "Both kidneys injured: advance one grade, up to Grade III (2018 kidney OIS)",
  kidney_2018_urinary_extrav_sublabel:
    "Excreted contrast leaking outside the collecting system on delayed (excretory) phase → Grade IV",
  pancreas_destructive_sublabel:
    "Pancreatic head destruction with nonviable parenchyma (2024 revision) → Grade V",
  liver_grade_ii_laceration_label: "1-3 cm parenchymal depth, ≤10 cm length (Grade II)",
  duct_location_error:
    "Select the Location of Duct Injury (neck/body/tail or head) to grade this pancreatic duct injury: it is Grade III in the neck, body or tail and Grade IV in the head.",
  kidney_2025_note:
    "No grade-advance modifier (for multiple or bilateral injuries) is applied on the 2025 kidney OIS path because the revision's full text could not be verified for one. Clinical judgment applies.",
  pancreas_2024_note:
    "The 2024 pancreas OIS revision's table notes could not be verified, so the multiple-injury advance of the earlier 1990 AAST pancreas scale is kept: multiple injuries raise a grade I–II result by one, to at most Grade III. Clinical judgment applies.",
  multiple_finding: "Multiple injuries (+1 grade)",
  bilateral_finding: "Bilateral renal injuries (+1 grade)",
  info_lines: [
    "• Liver and spleen: multiple grade I–II injuries advance one grade, up to Grade III",
    "• Kidney (2018 scale): bilateral renal injuries advance one grade, up to Grade III",
    "• Pancreas: the 1990 scale's multiple-injury advance is kept, up to Grade III, until the 2024 revision's notes are verified",
    "• Kidney 2025 path: no grade-advance modifier is applied",
  ],
  kozar_reference_prefix:
    "Kozar RA, Crandall M, Shanmuganathan K, et al. Organ injury scaling 2018 update: Spleen, liver, and kidney. J Trauma Acute Care Surg. 2018;85(6):1119-1122.",
  kozar_reference_url: "https://doi.org/10.1097/TA.0000000000002058",
  keihani_reference_prefix:
    "Keihani S, Tominaga GT, Matta R, et al. Kidney organ injury scaling: 2025 update. J Trauma Acute Care Surg. 2025;98(3):448-451.",
  keihani_reference_url: "https://pubmed.ncbi.nlm.nih.gov/39836096/",
  notrica_reference_url: "https://doi.org/10.1097/TA.0000000000004522",
  aast_reference_text: "AAST Official Website - Organ Injury Scale",
  aast_dead_reference_url_part: "resources-detail/injury-scoring-scale",
});

// One single-finding input per base grade for every organ/version path.
export const BASE_VECTORS = Object.freeze({
  liver: Object.freeze({
    1: { organ: "liver", liver_hematoma: "subcapsular_lt10" },
    2: { organ: "liver", liver_hematoma: "subcapsular_10_50" },
    3: { organ: "liver", liver_laceration: "gt3cm" },
    4: { organ: "liver", liver_laceration: "disruption_25_75" },
    5: { organ: "liver", liver_laceration: "disruption_gt75" },
  }),
  spleen: Object.freeze({
    1: { organ: "spleen", spleen_hematoma: "subcapsular_lt10" },
    2: { organ: "spleen", spleen_laceration: "1_3cm" },
    3: { organ: "spleen", spleen_laceration: "gt3cm" },
    4: { organ: "spleen", spleen_vascular: "psa_avf" },
    5: { organ: "spleen", spleen_laceration: "shattered" },
  }),
  kidney2018: Object.freeze({
    1: { organ: "kidney", kidney_ois_version: "2018", kidney_2018_hematoma: "contusion" },
    2: { organ: "kidney", kidney_ois_version: "2018", kidney_2018_hematoma: "perirenal_gerota" },
    3: { organ: "kidney", kidney_ois_version: "2018", kidney_2018_laceration: "gt1cm_no_cs" },
    4: { organ: "kidney", kidney_ois_version: "2018", kidney_2018_laceration: "into_collecting" },
    5: { organ: "kidney", kidney_ois_version: "2018", kidney_2018_laceration: "shattered" },
  }),
  kidney2025: Object.freeze({
    1: { organ: "kidney", kidney_ois_version: "2025", kidney_hematoma: "contusion" },
    2: { organ: "kidney", kidney_ois_version: "2025", kidney_laceration: "lt2_5cm" },
    3: { organ: "kidney", kidney_ois_version: "2025", kidney_laceration: "gte2_5cm_no_cs" },
    4: { organ: "kidney", kidney_ois_version: "2025", kidney_hematoma: "pararenal_extension" },
    5: { organ: "kidney", kidney_ois_version: "2025", kidney_vascular: "main_vessel" },
  }),
  kidneyDefault: Object.freeze({
    1: { organ: "kidney", kidney_hematoma: "contusion" },
    2: { organ: "kidney", kidney_laceration: "lt2_5cm" },
    3: { organ: "kidney", kidney_laceration: "gte2_5cm_no_cs" },
    4: { organ: "kidney", kidney_hematoma: "pararenal_extension" },
    5: { organ: "kidney", kidney_vascular: "main_vessel" },
  }),
  pancreas: Object.freeze({
    1: { organ: "pancreas", pancreas_parenchymal: "minor_contusion" },
    2: { organ: "pancreas", pancreas_parenchymal: "major_contusion" },
    3: { organ: "pancreas", pancreas_duct: "partial", pancreas_duct_location: "body_tail" },
    4: { organ: "pancreas", pancreas_duct: "partial", pancreas_duct_location: "head" },
    5: { organ: "pancreas", pancreas_destructive: true },
  }),
});

// The modifier each path owns; null means no modifier is verified and none may apply.
export const OWNED_MODIFIER = Object.freeze({
  liver: "multiple_injuries",
  spleen: "multiple_injuries",
  kidney2018: "kidney_2018_bilateral",
  kidney2025: null,
  kidneyDefault: null,
  pancreas: "multiple_injuries", // the 1990 AAST pancreas scale's advance, kept until the 2024 notes are verified
});
const MODIFIER_FIELDS = Object.freeze(["multiple_injuries", "kidney_2018_bilateral"]);
const NOTE_BY_PATH = Object.freeze({
  kidney2025: RUNTIME_TEXT.kidney_2025_note,
  kidneyDefault: RUNTIME_TEXT.kidney_2025_note,
  pancreas: RUNTIME_TEXT.pancreas_2024_note,
});
const DUCT_SUBGRADES = Object.freeze(["deep_no_interrogation", "partial", "complete_transection"]);

export const CLAIM_BINDINGS = Object.freeze([
  Object.freeze({
    claim_id: "liver-2018-multiple-injury-advance",
    runtime: "liver: multiple_injuries shown; base grade I/II +1 (ceiling III), described at the final grade",
    source_statement_ids: ["kozar2018-intro-multiple-grade-i-ii", "kozar2018-table2-liver-notes"],
  }),
  Object.freeze({
    claim_id: "spleen-2018-multiple-injury-advance",
    runtime: "spleen: multiple_injuries shown; base grade I/II +1 (ceiling III), described at the final grade",
    source_statement_ids: ["kozar2018-intro-multiple-grade-i-ii", "kozar2018-table1-spleen-notes"],
  }),
  Object.freeze({
    claim_id: "kidney-2018-bilateral-advance",
    runtime: "kidney 2018: kidney_2018_bilateral shown; base grade I/II +1 (ceiling III), described at the final grade",
    source_statement_ids: ["kozar2018-table3-kidney-notes"],
  }),
  Object.freeze({
    claim_id: "kidney-2018-no-multiple-injury-advance",
    runtime: "kidney 2018: multiple_injuries hidden and never applied",
    source_statement_ids: ["kozar2018-table3-kidney-notes"],
  }),
  Object.freeze({
    claim_id: "liver-2018-grade-ii-laceration-length",
    runtime: "liver_laceration 1_3cm option says ≤10 cm length; grade II kept",
    source_statement_ids: ["kozar2018-table2-liver-grade-ii-laceration-length"],
  }),
  Object.freeze({
    claim_id: "kidney-2018-urinary-extravasation-sublabel",
    runtime: "kidney_2018_urinary_extrav subLabel names excreted contrast on the excretory phase; grade IV kept",
    source_statement_ids: [
      "kozar2018-table3-kidney-grade-iv-urinary-extravasation",
      "kozar2018-table3-active-bleeding-delayed-phase",
      "kozar2018-delayed-excretory-phase",
    ],
  }),
  Object.freeze({
    claim_id: "pancreas-2024-grade-v-sublabel",
    runtime: "pancreas_destructive subLabel uses the 2024 grade V definition; grade V kept",
    source_statement_ids: ["notrica2025-abstract-grade-v"],
  }),
  Object.freeze({
    claim_id: "pancreas-2024-duct-location-required",
    runtime: "a duct injury grades III (neck/body/tail) or IV (head); without a location compute returns only an Error, unless a destructive head injury already makes it grade V",
    source_statement_ids: ["notrica2025-abstract-duct-location"],
  }),
  Object.freeze({
    claim_id: "pancreas-1990-multiple-injury-advance-kept",
    runtime: "the pancreas keeps the 1990 scale's multiple-injury advance (base grade I-II +1, ceiling III) and its base grade I-II note says why",
    source_statement_ids: [
      "aast-scale-page-pancreas-multiple-injury-note",
      "aast-scale-page-pancreas-table-credit",
      "notrica2025-abstract-original-1990",
    ],
  }),
  Object.freeze({
    claim_id: "reference-list-identities",
    runtime: "Kozar 2018 and Keihani 2025 reference strings and links, Notrica 2025 DOI link",
    source_statement_ids: [
      "kozar2018-identity",
      "kozar2018-pubmed-identity",
      "keihani2025-pubmed-identity",
      "notrica2025-pubmed-identity",
    ],
  }),
]);

// App-owned fail-safe policy (provenance only, not a source claim): where no modifier is
// verified, none is shown or applied, stale hidden values never change a grade, and grade I-II
// results say so.
export const FAIL_SAFE_PATHS = Object.freeze(["kidney2025", "kidneyDefault"]);

// ---------------------------------------------------------------------------------------------
// Text handling

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function decodeEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&(amp|apos|gt|lt|nbsp|quot);/g, (_, name) => named[name]);
}

export function foldText(value) {
  return String(value)
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

export function htmlText(html) {
  return foldText(
    decodeEntities(
      String(html)
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

export function spanText(text, from, to, label) {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `${label}: span start anchor ${JSON.stringify(from)} is missing`);
  assert.equal(
    text.indexOf(from, start + 1),
    -1,
    `${label}: span start anchor ${JSON.stringify(from)} is not unique in its locator`,
  );
  const toIndex = text.indexOf(to, start + from.length);
  assert.ok(toIndex >= 0, `${label}: span end anchor ${JSON.stringify(to)} is missing`);
  return text.slice(start, toIndex + to.length);
}

export function checkSpans(statement, text, normalize, mismatches) {
  return statement.spans.map((span, index) => {
    const value = spanText(text, normalize(span.from), normalize(span.to), `${statement.id} span ${index + 1}`);
    const actual = { length: value.length, sha256: sha256(value) };
    if (actual.length !== span.length || actual.sha256 !== span.sha256) {
      mismatches.push({ id: statement.id, span: index + 1, expected: { length: span.length, sha256: span.sha256 }, actual });
    }
    return { from: span.from, to: span.to, ...actual, value };
  });
}

export function paragraphSlice(pageText, statement) {
  const start = statement.start ? pageText.indexOf(statement.start) : 0;
  assert.ok(start >= 0, `${statement.id}: start locator ${JSON.stringify(statement.start)} is missing`);
  if (statement.start) {
    assert.equal(
      pageText.indexOf(statement.start, start + 1),
      -1,
      `${statement.id}: start locator ${JSON.stringify(statement.start)} is not unique on its page`,
    );
  }
  const end = statement.end ? pageText.indexOf(statement.end, start + 1) : pageText.length;
  assert.ok(end > start, `${statement.id}: end locator ${JSON.stringify(statement.end)} is missing or out of order`);
  return pageText.slice(start, end);
}

// Runs a statement's span checks, its absent-anchor checks and its mutation checks on `slice`.
function verifyStatement(statement, slice, normalize, mismatches, mutationChecks) {
  for (const absent of statement.must_not_contain ?? []) {
    assert.equal(slice.includes(normalize(absent)), false, `${statement.id}: locator unexpectedly contains ${JSON.stringify(absent)}`);
  }
  const spans = checkSpans(statement, slice, normalize, mismatches);
  for (const [token, replacement] of statement.must_contain ?? []) {
    const span = spans.find((candidate) => candidate.value.includes(token));
    assert.ok(span, `${statement.id}: no pinned span contains ${JSON.stringify(token)}`);
    const rejected = sha256(span.value.replace(token, replacement)) !== span.sha256;
    assert.ok(rejected, `${statement.id}: replacing ${JSON.stringify(token)} did not change the span digest`);
    mutationChecks.push({ statement_id: statement.id, replaced: token, with: replacement, rejected });
  }
  return spans.map(({ from, to, length, sha256: digest }) => ({ from, to, length, sha256: digest }));
}

// ---------------------------------------------------------------------------------------------
// Retrieval: exact bytes first, nothing is parsed from bytes that miss a pin.

/**
 * Recognise a page generated by Cloudflare's bot protection (challenge or block page) rather
 * than by the origin. It needs a 403/429/503 status, at least two signals and at least one
 * Cloudflare page marker. A recognised page is a transport failure (retried, then fatal); it
 * is never a pass.
 */
export function detectCloudflareChallenge({ status, headers, body }) {
  const text = String(body ?? "");
  const markers = [];
  if (String(headers?.get?.("cf-mitigated") ?? "").toLowerCase() === "challenge") markers.push("cf-mitigated header");
  if (/<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(text)) markers.push("challenge title");
  if (text.includes("challenges.cloudflare.com")) markers.push("challenge script origin");
  if (/<title>\s*(?:Attention Required! \| Cloudflare|Access denied \| [^<]* used Cloudflare to restrict access)\s*<\/title>/i.test(text)) {
    markers.push("block page title");
  }
  if (text.includes('id="cf-error-details"')) markers.push("block page details");
  const served = [];
  if (String(headers?.get?.("server") ?? "").toLowerCase() === "cloudflare" || headers?.get?.("cf-ray")) {
    served.push("served by Cloudflare");
  }
  const signals = [...markers, ...served];
  const challenged = [403, 429, 503].includes(status) && markers.length >= 1 && signals.length >= 2;
  return { challenged, signals };
}

export function retryDelayMs(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.("retry-after") ?? Number.NaN);
  const wanted = Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter * 1_000 : 1_000 * 2 ** (attempt - 1);
  return Math.min(wanted, MAX_RETRY_DELAY_MS);
}

function isTransientStatus(host, status) {
  return status === 429 || status >= 500 || (host.retry_http_400 === true && status === 400);
}

export function verifyArtifactBytes(artifact, bytes) {
  assert.ok(Buffer.isBuffer(bytes), `${artifact.key}: artifact bytes missing`);
  assert.equal(
    bytes.length,
    artifact.bytes,
    `${artifact.key}: artifact byte length drifted (${bytes.length}, pinned ${artifact.bytes}); re-review the source before re-pinning`,
  );
  const digest = sha256(bytes);
  assert.equal(
    digest,
    artifact.sha256,
    `${artifact.key}: artifact SHA-256 drifted (${digest}); re-review the source before re-pinning`,
  );
  return digest;
}

export function verifyArtifactResponse(artifact, host, { finalUrl, contentType, headers }) {
  const label = `${artifact.key} (${host.key})`;
  assert.equal(finalUrl.protocol, "https:", `${label}: final URL left HTTPS`);
  if (host.final_url_exact) {
    assert.equal(finalUrl.href, new URL(host.url).href, `${label}: final URL drifted`);
  } else {
    assert.equal(finalUrl.hostname, host.final_host, `${label}: final URL host drifted`);
    assert.match(finalUrl.pathname, new RegExp(host.final_path_pattern), `${label}: final URL path drifted`);
    assert.equal(finalUrl.search, "", `${label}: final URL query drifted`);
  }
  if (host.key === "ncbi") {
    assert.equal(finalUrl.searchParams.get("tool"), NCBI_TOOL, `${label}: tool parameter drifted`);
    assert.equal(finalUrl.searchParams.has("email"), false, `${label}: request must not carry an email parameter`);
  }
  const mediaType = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, artifact.media_type, `${label}: media type drifted (${contentType || "<missing>"})`);
  if (host.memento_datetime) {
    assert.equal(headers?.get?.("memento-datetime"), host.memento_datetime, `${label}: Memento-Datetime drifted`);
    assert.ok(
      String(headers?.get?.("link") ?? "").includes(`<${host.memento_original}>; rel="original"`),
      `${label}: Memento original drifted`,
    );
  }
}

/**
 * Retrieve an artifact's exact pinned bytes. Hosts are tried in order; only transport failures
 * move on (after MAX_ATTEMPTS on a host). A served artifact is verified (URL, media type,
 * provenance, exact length and SHA-256) and either returned or rejected at once.
 */
export async function fetchArtifact(artifact, { fetchImpl = fetch, sleepImpl = delay } = {}) {
  const failedHosts = [];
  for (const host of artifact.hosts) {
    let lastFailure = "unknown retrieval failure";
    let attempts = 0;
    let transient = true;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      let response;
      try {
        response = await fetchImpl(host.url, {
          headers: { "user-agent": USER_AGENT },
          redirect: "follow",
          signal: AbortSignal.timeout(45_000),
        });
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : String(error);
      }
      if (response?.ok) {
        const finalUrl = new URL(response.url);
        verifyArtifactResponse(artifact, host, {
          finalUrl,
          contentType: response.headers.get("content-type") ?? "",
          headers: response.headers,
        });
        const bytes = Buffer.from(await response.arrayBuffer());
        verifyArtifactBytes(artifact, bytes);
        return { bytes, host: host.key, url: host.url, final_url: finalUrl.href, attempts: attempt, failed_hosts: failedHosts };
      }
      if (response) {
        let challenge = { challenged: false, signals: [] };
        if ([403, 429, 503].includes(response.status)) {
          const body = await response.text().catch(() => "");
          challenge = detectCloudflareChallenge({ status: response.status, headers: response.headers, body });
        } else {
          await response.body?.cancel?.();
        }
        lastFailure = `HTTP ${response.status}${challenge.challenged ? ` (Cloudflare bot protection: ${challenge.signals.join(", ")})` : ""}`;
        if (!challenge.challenged && !isTransientStatus(host, response.status)) {
          transient = false;
          break;
        }
      }
      if (attempt < MAX_ATTEMPTS) await sleepImpl(retryDelayMs(response, attempt));
    }
    failedHosts.push({ host: host.key, attempts, last_failure: lastFailure });
    // A non-transient failure (for example HTTP 404) is a changed source: no fallback host.
    if (!transient) break;
  }
  assert.fail(
    `${artifact.key}: the pinned bytes were not verified on any host (${failedHosts
      .map((failure) => `${failure.host}: ${failure.attempts} attempt(s), ${failure.last_failure}`)
      .join("; ")})`,
  );
}

// ---------------------------------------------------------------------------------------------
// Kozar 2018 PDF

export async function pdfPages(bytes, artifact = ARTIFACTS.kozar2018) {
  verifyArtifactBytes(artifact, bytes);
  const document = await getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    useSystemFonts: true,
    verbosity: 0,
  }).promise;
  assert.equal(document.numPages, artifact.pages, `${artifact.key}: PDF page count drifted`);
  const pages = new Map();
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
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

export function verifyKozarStatements(pages, mismatches, mutationChecks, statements = KOZAR_STATEMENTS) {
  const verified = new Map();
  for (const statement of statements) {
    const pageText = pages.get(statement.pdf_page);
    assert.ok(pageText, `${statement.id}: PDF page ${statement.pdf_page} was not extracted`);
    const slice = compact(paragraphSlice(pageText, statement));
    const spans = verifyStatement(statement, slice, compact, mismatches, mutationChecks);
    verified.set(statement.id, {
      id: statement.id,
      source: "kozar2018",
      pdf_page: statement.pdf_page,
      printed_page: statement.printed_page,
      locator: statement.locator,
      paraphrase: statement.paraphrase,
      spans,
      ...(statement.must_not_contain ? { absent_anchors: [...statement.must_not_contain] } : {}),
    });
  }
  return verified;
}

// ---------------------------------------------------------------------------------------------
// AAST scale page (archived)

export function verifyAastPageStatements(bytes, mismatches, mutationChecks, artifact = ARTIFACTS.aastScalePage2020) {
  verifyArtifactBytes(artifact, bytes);
  const text = htmlText(bytes.toString("utf8"));
  const verified = new Map();
  for (const statement of AAST_PAGE_STATEMENTS) {
    const slice = paragraphSlice(text, statement);
    const spans = verifyStatement(statement, slice, foldText, mismatches, mutationChecks);
    verified.set(statement.id, {
      id: statement.id,
      source: artifact.key,
      locator: statement.locator,
      paraphrase: statement.paraphrase,
      spans,
    });
  }
  return verified;
}

// ---------------------------------------------------------------------------------------------
// PubMed plain-text records

// PubMed plain-text abstract layout: blank-line separated blocks for the citation, title, authors,
// author information, linked-record notices, abstract, copyright and identifiers. Adapted from
// parseRecordText in scripts/audit-nirads-legacy-rates-source.mjs, plus the author list and the
// linked errata.
const NOTICE = /^(Comment (in|on)|Erratum (in|for)|Update (in|of)|Retraction (in|of)|Expression of concern (in|for)|Republished (in|from)|Conflict of interest|Copyright|©|DOI:|PMID:|PMCID:)/;

export function parseRecordText(text) {
  const blocks = String(text).split(/\n[ \t]*\n/).map((block) => block.trim()).filter(Boolean);
  const citation = foldText(blocks[0] ?? "");
  const title = foldText(blocks[1] ?? "");
  const infoIndex = blocks.findIndex((block) => block.startsWith("Author information:"));
  assert.equal(infoIndex, 3, "record must list citation, title, authors, then author information");
  const authors = foldText(blocks[2])
    .replace(/\.$/, "")
    .split(/[,;]\s*/)
    .map((author) => author.replace(/\(\d+\)/g, "").trim())
    .filter(Boolean);
  const after = blocks.slice(infoIndex + 1);
  const abstract = foldText(after.find((block) => !NOTICE.test(block)) ?? "");
  // A linked-record block lists one citation per indented line; unindented lines continue it.
  const errata = [];
  for (const block of after.filter((candidate) => candidate.startsWith("Erratum in"))) {
    for (const line of block.split("\n").slice(1)) {
      if (/^\s+\S/.test(line)) errata.push(line.trim());
      else if (errata.length > 0) errata[errata.length - 1] += ` ${line.trim()}`;
    }
  }
  for (let index = 0; index < errata.length; index += 1) errata[index] = foldText(errata[index]);
  const cite = /^\d+\. (.+?)\. (\d{4})\b[^;]*;(\d+)\((\d+)\):(\d+-\d+)\./.exec(citation);
  return {
    citation,
    title,
    authors,
    abstract,
    errata,
    journal: cite?.[1] ?? "",
    year: cite?.[2] ?? "",
    volume: cite?.[3] ?? "",
    issue: cite?.[4] ?? "",
    pages: cite?.[5] ?? "",
    doi: String(text).match(/^DOI: (\S+)$/m)?.[1] ?? "",
    pmid: String(text).match(/^PMID: (\d+)/m)?.[1] ?? "",
  };
}

export function verifyPubmed(recordBytes, mismatches) {
  const verified = new Map();
  const records = new Map();
  for (const identity of PUBMED_IDENTITIES) {
    const artifact = ARTIFACTS[`pubmed${identity.pmid}`];
    verifyArtifactBytes(artifact, recordBytes[identity.pmid]);
    const record = parseRecordText(recordBytes[identity.pmid].toString("utf8"));
    records.set(identity.pmid, record);
    assert.equal(record.pmid, identity.pmid, `${identity.id}: PMID drifted`);
    assert.equal(record.title, identity.title, `${identity.id}: title drifted`);
    assert.deepEqual(record.authors.slice(0, identity.first_authors.length), identity.first_authors, `${identity.id}: first authors drifted`);
    assert.equal(record.journal, identity.journal, `${identity.id}: journal drifted`);
    assert.equal(record.year, identity.year, `${identity.id}: year drifted`);
    assert.equal(record.volume, identity.volume, `${identity.id}: volume drifted`);
    assert.equal(record.issue, identity.issue, `${identity.id}: issue drifted`);
    assert.equal(record.pages, identity.pages, `${identity.id}: pages drifted`);
    assert.equal(record.doi, identity.doi, `${identity.id}: DOI drifted`);
    assert.deepEqual(record.errata, identity.errata, `${identity.id}: linked errata drifted`);
    verified.set(identity.id, {
      id: identity.id,
      source: artifact.key,
      pmid: identity.pmid,
      locator: `PubMed ${identity.pmid} citation, title, author and linked-record blocks`,
      paraphrase: `PubMed identifies PMID ${identity.pmid} as ${identity.first_authors[0]} et al., ${identity.journal} ${identity.year};${identity.volume}(${identity.issue}):${identity.pages}, DOI ${identity.doi}${identity.errata.length ? `, with ${identity.errata.length} linked erratum` : ""}.`,
      identity: {
        title: identity.title,
        first_authors: [...identity.first_authors],
        citation: `${identity.journal}. ${identity.year};${identity.volume}(${identity.issue}):${identity.pages}`,
        doi: identity.doi,
        errata: [...identity.errata],
      },
    });
  }
  for (const statement of PUBMED_STATEMENTS) {
    const record = records.get(statement.pmid);
    assert.ok(record?.abstract, `${statement.id}: abstract of PMID ${statement.pmid} is missing`);
    const spans = checkSpans(statement, record.abstract, foldText, mismatches);
    verified.set(statement.id, {
      id: statement.id,
      source: `pubmed${statement.pmid}`,
      pmid: statement.pmid,
      locator: statement.locator,
      paraphrase: statement.paraphrase,
      spans: spans.map(({ from, to, length, sha256: digest }) => ({ from, to, length, sha256: digest })),
    });
  }
  return verified;
}

// ---------------------------------------------------------------------------------------------
// Runtime

function gradeOf(result, label) {
  assert.equal(result.Error, undefined, `${label}: unexpected Error ${result.Error}`);
  const match = /^Grade ([1-5])$/.exec(result["AAST Grade"] ?? "");
  assert.ok(match, `${label}: AAST Grade missing`);
  return Number(match[1]);
}

function expectedGrade(path, base, modifier, checked) {
  const owned = checked && OWNED_MODIFIER[path] === modifier;
  return owned && (base === 1 || base === 2) ? base + 1 : base;
}

export function verifyRuntime(calculator) {
  const field = (id) => calculator.fields.find((candidate) => candidate.id === id);
  const multiple = field("multiple_injuries");
  const bilateral = field("kidney_2018_bilateral");
  assert.ok(multiple && bilateral, "both modifier fields must exist");
  assert.equal(multiple.type, "checkbox", "multiple_injuries must be a checkbox");
  assert.equal(bilateral.type, "checkbox", "kidney_2018_bilateral must be a checkbox");
  assert.equal(typeof multiple.showIf, "function", "multiple_injuries must be conditional");
  assert.equal(typeof bilateral.showIf, "function", "kidney_2018_bilateral must be conditional");

  // Visibility: each box is shown only on the organ/version that owns its rule.
  const visibility = [
    [{}, false, false],
    [{ organ: "liver" }, true, false],
    [{ organ: "spleen" }, true, false],
    [{ organ: "kidney" }, false, false],
    [{ organ: "kidney", kidney_ois_version: "2025" }, false, false],
    [{ organ: "kidney", kidney_ois_version: "2018" }, false, true],
    [{ organ: "pancreas" }, true, false],
    [{ organ: "liver", kidney_ois_version: "2018" }, true, false],
    [{ organ: "pancreas", kidney_ois_version: "2018" }, true, false],
  ];
  for (const [vals, showMultiple, showBilateral] of visibility) {
    assert.equal(Boolean(multiple.showIf(vals)), showMultiple, `multiple_injuries visibility for ${JSON.stringify(vals)}`);
    assert.equal(Boolean(bilateral.showIf(vals)), showBilateral, `kidney_2018_bilateral visibility for ${JSON.stringify(vals)}`);
  }

  // Grade matrix: every path x base grade x modifier x on/off.
  const describe = (path, grade) => calculator.compute({ ...BASE_VECTORS[path][grade] })["Grade Description"];
  let vectors = 0;
  for (const [path, byGrade] of Object.entries(BASE_VECTORS)) {
    for (const [baseText, inputs] of Object.entries(byGrade)) {
      const base = Number(baseText);
      assert.equal(gradeOf(calculator.compute({ ...inputs }), `${path}/${base}`), base, `${path}/${base}: base grade`);
      for (const modifier of MODIFIER_FIELDS) {
        for (const checked of [false, true]) {
          const label = `${path}/${base}/${modifier}=${checked}`;
          const result = calculator.compute({ ...inputs, [modifier]: checked });
          const expected = expectedGrade(path, base, modifier, checked);
          assert.equal(gradeOf(result, label), expected, `${label}: grade`);
          assert.equal(result["Grade Description"], describe(path, expected), `${label}: description of the final grade`);
          const advanced = expected !== base;
          const findings = String(result["Key Findings"] ?? "");
          assert.equal(findings.includes(RUNTIME_TEXT.multiple_finding), advanced && modifier === "multiple_injuries", `${label}: multiple finding`);
          assert.equal(findings.includes(RUNTIME_TEXT.bilateral_finding), advanced && modifier === "kidney_2018_bilateral", `${label}: bilateral finding`);
          assert.equal(
            result["Multiple Injury Adjustment"],
            advanced && modifier === "multiple_injuries" ? `Base grade ${base} advanced to Grade ${expected} due to multiple injuries` : undefined,
            `${label}: multiple adjustment line`,
          );
          assert.equal(
            result["Bilateral Injury Adjustment"],
            advanced && modifier === "kidney_2018_bilateral"
              ? `Base grade ${base} advanced to Grade ${expected} due to bilateral renal injuries (2018 kidney OIS)`
              : undefined,
            `${label}: bilateral adjustment line`,
          );
          assert.equal(
            result["Grade-Advance Note"],
            (path === "pancreas" ? base <= 2 : expected <= 2) ? NOTE_BY_PATH[path] : undefined,
            `${label}: grade-advance note`,
          );
          vectors += 1;
        }
      }
      // Both boxes stale at once: at most the owned modifier applies, once.
      const both = calculator.compute({ ...inputs, multiple_injuries: true, kidney_2018_bilateral: true });
      const owned = OWNED_MODIFIER[path];
      const expectedBoth = owned ? expectedGrade(path, base, owned, true) : base;
      assert.equal(gradeOf(both, `${path}/${base}/both`), expectedBoth, `${path}/${base}: both modifiers checked`);
      vectors += 1;
      // Only an explicit boolean true applies.
      for (const loose of ["true", 1]) {
        for (const modifier of MODIFIER_FIELDS) {
          assert.equal(gradeOf(calculator.compute({ ...inputs, [modifier]: loose }), `${path}/${base}/${modifier}=${loose}`), base, `${path}/${base}: ${modifier}=${JSON.stringify(loose)} must not apply`);
          vectors += 1;
        }
      }
    }
  }

  // Pancreatic duct injuries: location decides grade III/IV; no location, no grade.
  for (const duct of DUCT_SUBGRADES) {
    for (const location of [undefined, "", "neck", "HEAD"]) {
      for (const extra of [{}, { pancreas_parenchymal: "major_contusion" }]) {
        const inputs = { organ: "pancreas", pancreas_duct: duct, ...extra };
        if (location !== undefined) inputs.pancreas_duct_location = location;
        assert.deepEqual(calculator.compute(inputs), { Error: RUNTIME_TEXT.duct_location_error }, `duct ${duct} without a location must fail closed`);
        vectors += 1;
      }
      // A destructive head injury is Grade V whatever the duct location: it never waits for one.
      const destructive = { organ: "pancreas", pancreas_duct: duct, pancreas_destructive: true };
      if (location !== undefined) destructive.pancreas_duct_location = location;
      assert.equal(gradeOf(calculator.compute(destructive), `duct ${duct} destructive`), 5, `duct ${duct}: a destructive head injury is grade V without a location`);
      vectors += 1;
    }
    assert.equal(gradeOf(calculator.compute({ organ: "pancreas", pancreas_duct: duct, pancreas_duct_location: "body_tail" }), duct), 3, `${duct}: neck/body/tail is grade III`);
    assert.equal(gradeOf(calculator.compute({ organ: "pancreas", pancreas_duct: duct, pancreas_duct_location: "head" }), duct), 4, `${duct}: head is grade IV`);
    vectors += 2;
  }

  // Wording of the modifier boxes, the reworded subLabels and the liver grade II option; scoring unchanged.
  assert.equal(multiple.label, RUNTIME_TEXT.multiple_label, "multiple_injuries label drifted");
  assert.equal(multiple.subLabel, RUNTIME_TEXT.multiple_sublabel, "multiple_injuries subLabel drifted");
  assert.equal(bilateral.label, RUNTIME_TEXT.bilateral_label, "kidney_2018_bilateral label drifted");
  assert.equal(bilateral.subLabel, RUNTIME_TEXT.bilateral_sublabel, "kidney_2018_bilateral subLabel drifted");
  assert.equal(field("kidney_2018_urinary_extrav").subLabel, RUNTIME_TEXT.kidney_2018_urinary_extrav_sublabel, "kidney_2018_urinary_extrav subLabel drifted");
  assert.equal(field("pancreas_destructive").subLabel, RUNTIME_TEXT.pancreas_destructive_sublabel, "pancreas_destructive subLabel drifted");
  const liverLaceration = field("liver_laceration").opts.find((opt) => opt.value === "1_3cm");
  assert.equal(liverLaceration?.label, RUNTIME_TEXT.liver_grade_ii_laceration_label, "liver grade II laceration option drifted");
  assert.equal(gradeOf(calculator.compute({ organ: "liver", liver_laceration: "1_3cm" }), "liver 1-3 cm"), 2, "liver 1-3 cm laceration must stay grade II");
  assert.equal(gradeOf(calculator.compute({ organ: "kidney", kidney_ois_version: "2018", kidney_2018_urinary_extrav: true }), "2018 extravasation"), 4, "2018 urinary extravasation must stay grade IV");
  assert.equal(gradeOf(calculator.compute({ organ: "kidney", kidney_ois_version: "2018", kidney_2018_laceration: "into_collecting" }), "2018 collecting system"), 4, "2018 collecting-system laceration must stay grade IV");
  assert.equal(gradeOf(calculator.compute({ organ: "pancreas", pancreas_destructive: true }), "pancreas destructive"), 5, "destructive pancreatic head injury must stay grade V");
  for (const line of RUNTIME_TEXT.info_lines) {
    assert.ok(calculator.info.text.includes(line), `info text lacks ${JSON.stringify(line)}`);
  }

  // Reference list.
  const refs = calculator.refs ?? [];
  const byUrl = (url) => refs.filter((ref) => ref.u === url);
  assert.equal(byUrl(RUNTIME_TEXT.kozar_reference_url).length, 1, "Kozar 2018 must be cited once by DOI");
  assert.ok(byUrl(RUNTIME_TEXT.kozar_reference_url)[0].t.startsWith(RUNTIME_TEXT.kozar_reference_prefix), "Kozar 2018 reference text drifted");
  assert.equal(byUrl(RUNTIME_TEXT.keihani_reference_url).length, 1, "Keihani 2025 must be cited once by PubMed link");
  assert.ok(byUrl(RUNTIME_TEXT.keihani_reference_url)[0].t.startsWith(RUNTIME_TEXT.keihani_reference_prefix), "Keihani 2025 reference authors/title drifted");
  assert.equal(byUrl(RUNTIME_TEXT.notrica_reference_url).length, 1, "Notrica 2025 must be cited once by DOI");
  assert.equal(calculator.info.link.url, RUNTIME_TEXT.kozar_reference_url, "info link must point at Kozar 2018");
  const aastRefs = refs.filter((ref) => ref.t === RUNTIME_TEXT.aast_reference_text);
  assert.equal(aastRefs.length, 1, "the AAST website citation text must be kept once");
  assert.equal(aastRefs[0].u, undefined, "the AAST website citation must not link a page that no longer serves the scales");
  assert.ok(
    refs.every((ref) => !String(ref.u ?? "").includes(RUNTIME_TEXT.aast_dead_reference_url_part)),
    "no reference may link the AAST permissions page",
  );

  return {
    vectors,
    bindings: {
      "liver-2018-multiple-injury-advance": { path: "liver", modifier: "multiple_injuries", base_grades: [1, 2, 3, 4, 5], ceiling: 3, description_follows_final_grade: true },
      "spleen-2018-multiple-injury-advance": { path: "spleen", modifier: "multiple_injuries", base_grades: [1, 2, 3, 4, 5], ceiling: 3, description_follows_final_grade: true },
      "kidney-2018-bilateral-advance": { path: "kidney2018", modifier: "kidney_2018_bilateral", base_grades: [1, 2, 3, 4, 5], ceiling: 3, description_follows_final_grade: true },
      "kidney-2018-no-multiple-injury-advance": { path: "kidney2018", modifier: "multiple_injuries", shown: false, applied: false },
      "liver-2018-grade-ii-laceration-length": { field: "liver_laceration", option: "1_3cm", label: RUNTIME_TEXT.liver_grade_ii_laceration_label, grade: 2 },
      "kidney-2018-urinary-extravasation-sublabel": { field: "kidney_2018_urinary_extrav", sublabel: RUNTIME_TEXT.kidney_2018_urinary_extrav_sublabel, grade: 4 },
      "pancreas-2024-grade-v-sublabel": { field: "pancreas_destructive", sublabel: RUNTIME_TEXT.pancreas_destructive_sublabel, grade: 5 },
      "pancreas-2024-duct-location-required": { subgrades: [...DUCT_SUBGRADES], body_tail: 3, head: 4, destructive: 5, missing_location: RUNTIME_TEXT.duct_location_error },
      "pancreas-1990-multiple-injury-advance-kept": { path: "pancreas", modifier: "multiple_injuries", base_grades: [1, 2, 3, 4, 5], ceiling: 3, note_base_grades: [1, 2], note: RUNTIME_TEXT.pancreas_2024_note },
      "reference-list-identities": {
        kozar_url: RUNTIME_TEXT.kozar_reference_url,
        keihani_url: RUNTIME_TEXT.keihani_reference_url,
        notrica_url: RUNTIME_TEXT.notrica_reference_url,
      },
    },
    fail_safe: {
      provenance: "radulator-fail-safe-policy",
      publication_derived: false,
      paths: [...FAIL_SAFE_PATHS],
      modifiers_shown: false,
      stale_values_applied: false,
      grade_i_ii_note: { kidney2025: RUNTIME_TEXT.kidney_2025_note },
      aast_reference: { text: RUNTIME_TEXT.aast_reference_text, linked: false },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Audit

export async function runAudit({ calculator, fetchImpl = fetch, sleepImpl = delay } = {}) {
  assert.ok(calculator?.id === "aast-trauma-grading", "runAudit needs the AAST calculator export");
  const retrieved = {};
  for (const artifact of Object.values(ARTIFACTS)) {
    retrieved[artifact.key] = await fetchArtifact(artifact, { fetchImpl, sleepImpl });
  }

  const mismatches = [];
  const mutationChecks = [];
  const kozar = verifyKozarStatements(await pdfPages(retrieved.kozar2018.bytes), mismatches, mutationChecks);
  const aastPage = verifyAastPageStatements(retrieved.aastScalePage2020.bytes, mismatches, mutationChecks);
  const pubmed = verifyPubmed(
    Object.fromEntries(PUBMED_IDENTITIES.map(({ pmid }) => [pmid, retrieved[`pubmed${pmid}`].bytes])),
    mismatches,
  );
  assert.equal(
    mismatches.length,
    0,
    `pinned source spans drifted (re-review each statement at its locator before re-pinning):\n${JSON.stringify(mismatches, null, 2)}`,
  );

  const verified = new Map([...kozar, ...aastPage, ...pubmed]);
  const boundIds = new Set(CLAIM_BINDINGS.flatMap((binding) => binding.source_statement_ids));
  for (const binding of CLAIM_BINDINGS) {
    for (const statementId of binding.source_statement_ids) {
      assert.ok(verified.has(statementId), `${binding.claim_id}: source statement ${statementId} is not verified`);
    }
  }
  for (const statementId of verified.keys()) {
    assert.ok(boundIds.has(statementId), `${statementId}: verified statement has no runtime binding`);
  }

  const runtime = verifyRuntime(calculator);
  for (const binding of CLAIM_BINDINGS) {
    assert.ok(runtime.bindings[binding.claim_id], `${binding.claim_id}: runtime binding was not exercised`);
  }

  return {
    schema: "radulator-aast-injury-modifier-source-audit/v2",
    calculator_id: calculator.id,
    calculator_path: CALCULATOR_PATH,
    artifacts: Object.values(ARTIFACTS).map((artifact) => ({
      key: artifact.key,
      authority: artifact.authority,
      document: artifact.document,
      ...(artifact.doi ? { doi: artifact.doi } : {}),
      ...(artifact.pmid ? { pmid: artifact.pmid } : {}),
      media_type: artifact.media_type,
      pin: "raw-bytes",
      bytes: artifact.bytes,
      sha256: artifact.sha256,
      hosts: artifact.hosts.map((host) => host.url),
      verified_host: retrieved[artifact.key].host,
      final_url: retrieved[artifact.key].final_url,
      attempts: retrieved[artifact.key].attempts,
      failed_hosts: retrieved[artifact.key].failed_hosts,
    })),
    source_statements: [...verified.values()],
    source_mutation_checks: mutationChecks,
    claim_bindings: CLAIM_BINDINGS.map((binding) => ({
      claim_id: binding.claim_id,
      source_statement_ids: [...binding.source_statement_ids],
      runtime: runtime.bindings[binding.claim_id],
    })),
    runtime: { vectors: runtime.vectors, fail_safe: runtime.fail_safe },
    scope: {
      not_asserted: [
        "whether the 2025 kidney revision (Keihani 2025) keeps any grade-advance rule: full text not openly retrievable",
        "whether the 2024 pancreas revision (Notrica 2025) keeps any grade-advance rule: full text not openly retrievable",
        "content of the Kozar 2018 erratum (PMID 31348410): not openly retrievable; indirect evidence points to an author-name correction",
        "2024 pancreas grade V ductal subgrades (not modeled by the calculator)",
        "whole-calculator clinical acceptance",
      ],
    },
    source_bytes_committed: false,
  };
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const { AASTTraumaGrading } = await import("../src/components/calculators/AASTTraumaGrading.jsx");
  const audit = await runAudit({ calculator: AASTTraumaGrading });
  for (const artifact of audit.artifacts) {
    if (artifact.failed_hosts.length) {
      process.stderr.write(`${artifact.key}: verified on ${artifact.verified_host} after transport failures on ${artifact.failed_hosts.map((failure) => failure.host).join(", ")}\n`);
    }
  }
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(audit)}\n`);
  } else {
    console.log(
      `AAST injury-modifier source audit passed: ${audit.artifacts.length} byte-pinned artifacts (${audit.artifacts.map((artifact) => `${artifact.key}@${artifact.verified_host}`).join(", ")}), ${audit.source_statements.length} source statements, ${audit.source_mutation_checks.length} source mutation checks, ${audit.claim_bindings.length} runtime claim bindings and ${audit.runtime.vectors} runtime vectors.`,
    );
  }
}
