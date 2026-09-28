#!/usr/bin/env node

// Exact-head primary-source audit for the AAST grade-advance modifiers in
// src/components/calculators/AASTTraumaGrading.jsx.
//
// Retrieves (1) the AAST-hosted PDF of Kozar et al., "Organ injury scaling 2018 update:
// Spleen, liver, and kidney" (J Trauma Acute Care Surg 2018;85:1119-1122), a static PDF pinned
// by byte length and SHA-256, and (2) the PubMed records of Kozar 2018, Keihani 2025 (kidney
// 2025 update) and Notrica 2025 (pancreas 2024 revision) from NCBI E-utilities. PubMed XML
// also carries indexing data that changes after publication, so its raw bytes are not pinned;
// the enforced pin is the SHA-256 of each record's normalized citation fields and abstract.
//
// Each source statement is pinned by the SHA-256 and length of its exact normalized span
// between two short anchors at its locator, so the audit verifies literal source text at head
// without committing the copyrighted passages; `paraphrase` is Radulator's own summary. The
// statements are then bound to the calculator runtime: which organ/version shows and applies
// each modifier, the grade I-II trigger with the grade III ceiling, stale hidden values, the
// reworded subLabels and the reference list. Any drift exits non-zero.
//
// If aast.org answers with a recognised Cloudflare bot-protection page (challenge or block, not
// a content change), the Kozar statements cannot be re-read in that run: the audit says so,
// still enforces every runtime binding and the PubMed pins, and exits 0 unless --require-live
// is given.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const CALCULATOR_PATH = "src/components/calculators/AASTTraumaGrading.jsx";
const USER_AGENT = "Radulator-AAST-injury-modifier-source-audit/1";
const MAX_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MS = 20_000;
const CLOUDFLARE_CHALLENGE_STATUS = "challenged-by-cloudflare-bot-protection";

export const SOURCES = Object.freeze({
  kozar2018: Object.freeze({
    key: "kozar2018",
    authority: "American Association for the Surgery of Trauma (AAST-hosted copy of the journal article)",
    document:
      "Kozar RA, Crandall M, Shanmuganathan K, et al. Organ injury scaling 2018 update: Spleen, liver, and kidney. J Trauma Acute Care Surg. 2018;85(6):1119-1122",
    doi: "10.1097/TA.0000000000002058",
    pmid: "30462622",
    url: "https://www.aast.org/asset/1EDF1B04-6B52-4E7B-9130ACA30413089D/",
    // The AAST asset link redirects into AAST's static store. The store path is checked by
    // pattern (the asset id is the stable AAST identifier); the bytes are pinned exactly.
    final_host: "www.aast.org",
    final_path_pattern: "^/static/journal_pdf_[0-9a-f-]{36}/[0-9a-f-]{36}\\.pdf$",
    media_type: "application/pdf",
    bytes: 174_748,
    sha256: "bcd66906506efee3757ce1ea39e0da66bf30e39ffa7ccf3c33cc2678b3430965",
    pin: "raw-bytes",
    pages: 4,
  }),
  pubmed: Object.freeze({
    key: "pubmed",
    authority: "U.S. National Library of Medicine (PubMed, NCBI E-utilities efetch)",
    document: "PubMed records 30462622 (Kozar 2018), 39836096 (Keihani 2025), 39898876 (Notrica 2025)",
    url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=30462622,39836096,39898876&retmode=xml&tool=radulator-aast-audit",
    media_type: "text/xml",
    // NCBI answers valid E-utilities requests with a transient HTTP 400 at times.
    retry_http_400: true,
    pin: "pubmed-record-fields",
    pin_rationale:
      "PubMed XML carries MeSH, history and status data that change after publication; only the citation fields and abstract are pinned",
    content_digest_basis:
      "per PMID: title, authors (LastName + Initials or CollectiveName), ISO journal, year, volume, issue, pages, DOI and abstract paragraphs; entities decoded, tags removed, NFKC, quote/dash folding, whitespace collapsed; canonical JSON sorted by PMID",
    records_sha256: "20638d0a63f3574ea7a5b7c07640233d9ab8ab2c9b721b111342954f9366bca7",
  }),
});

// Kozar 2018 PDF statements. `start`/`end` bound the locator on the named PDF page
// (lower-case folded page text) before the span anchors are applied; spans are compared after
// lower-casing and removing whitespace and hyphens, so typeset line breaks and end-of-line
// hyphenation do not matter and every other character must match. `must_contain` pairs are
// mutation checks run on the real span at audit time: replacing the first token with the second
// must change the pinned digest, which also proves the span holds the rule's trigger and ceiling.
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

// PubMed abstract statements (case-preserving folded text of the named abstract).
export const PUBMED_STATEMENTS = Object.freeze([
  Object.freeze({
    id: "notrica2025-abstract-grade-v",
    pmid: "39898876",
    locator: "PubMed abstract, sentence defining grade V",
    paraphrase:
      "In the 2024 pancreas revision, grade V is a destructive pancreatic-head injury with nonviable tissue, further subgraded by ductal injury.",
    spans: [{ from: "Grade V injuries are destructive", to: "with nonviable parenchyma.", length: 91, sha256: "127e7eacbe699a3f8cf81115ac9a1fcc1cdc45440e17692c89365fd048959981" }],
  }),
]);

// PubMed identities: identifiers only (title, first authors, journal citation, DOI).
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
  }),
]);

export const RUNTIME_TEXT = Object.freeze({
  multiple_label: "Multiple Injuries in Same Organ",
  multiple_sublabel:
    "Multiple grade I–II injuries: advance one grade, up to Grade III (2018 liver/spleen OIS)",
  bilateral_label: "Bilateral Renal Injuries",
  bilateral_sublabel: "Both kidneys injured: advance one grade, up to Grade III (2018 kidney OIS)",
  kidney_2018_urinary_extrav_sublabel:
    "Excreted contrast leaking outside the collecting system on delayed (excretory) phase → Grade IV",
  pancreas_destructive_sublabel:
    "Pancreatic head destruction with nonviable parenchyma (2024 revision) → Grade V",
  multiple_finding: "Multiple injuries (+1 grade)",
  bilateral_finding: "Bilateral renal injuries (+1 grade)",
  info_lines: [
    "• Liver and spleen: multiple grade I–II injuries advance one grade, up to Grade III",
    "• Kidney (2018 scale): bilateral renal injuries advance one grade, up to Grade III",
    "• Kidney 2025 and pancreas 2024 paths: no grade-advance modifier is applied",
  ],
  kozar_reference_prefix:
    "Kozar RA, Crandall M, Shanmuganathan K, et al. Organ injury scaling 2018 update: Spleen, liver, and kidney. J Trauma Acute Care Surg. 2018;85(6):1119-1122.",
  kozar_reference_url: "https://doi.org/10.1097/TA.0000000000002058",
  keihani_reference_prefix:
    "Keihani S, Tominaga GT, Matta R, et al. Kidney organ injury scaling: 2025 update. J Trauma Acute Care Surg. 2025;98(3):448-451.",
  keihani_reference_url: "https://pubmed.ncbi.nlm.nih.gov/39836096/",
  notrica_reference_url: "https://doi.org/10.1097/TA.0000000000004522",
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
  pancreas: null,
});
const MODIFIER_FIELDS = Object.freeze(["multiple_injuries", "kidney_2018_bilateral"]);

export const CLAIM_BINDINGS = Object.freeze([
  Object.freeze({
    claim_id: "liver-2018-multiple-injury-advance",
    runtime: "liver: multiple_injuries shown; base grade I/II +1, grade III-V unchanged",
    source_statement_ids: ["kozar2018-intro-multiple-grade-i-ii", "kozar2018-table2-liver-notes"],
  }),
  Object.freeze({
    claim_id: "spleen-2018-multiple-injury-advance",
    runtime: "spleen: multiple_injuries shown; base grade I/II +1, grade III-V unchanged",
    source_statement_ids: ["kozar2018-intro-multiple-grade-i-ii", "kozar2018-table1-spleen-notes"],
  }),
  Object.freeze({
    claim_id: "kidney-2018-bilateral-advance",
    runtime: "kidney 2018: kidney_2018_bilateral shown; base grade I/II +1, grade III-V unchanged",
    source_statement_ids: ["kozar2018-table3-kidney-notes"],
  }),
  Object.freeze({
    claim_id: "kidney-2018-no-multiple-injury-advance",
    runtime: "kidney 2018: multiple_injuries hidden and never applied",
    source_statement_ids: ["kozar2018-table3-kidney-notes"],
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
// verified, none is shown or applied, and stale hidden values never change a grade.
export const FAIL_SAFE_PATHS = Object.freeze(["kidney2025", "kidneyDefault", "pancreas"]);

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

// ---------------------------------------------------------------------------------------------
// Retrieval

/**
 * Recognise a page generated by Cloudflare's bot protection (challenge interstitial or block
 * page) rather than by AAST. It needs a 403/429/503 status, at least two signals, and at least
 * one Cloudflare page marker: a Cloudflare-served origin error alone is not enough, so any
 * other failure takes the ordinary fail-closed path.
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

function isRetryableStatus(source, status) {
  return status === 429 || status >= 500 || (source.retry_http_400 === true && status === 400);
}

// Retries transport failures only (network errors, HTTP 429, HTTP 5xx and, for NCBI, HTTP 400).
// A served artifact that misses a pin is a changed source and fails at once.
export async function retrieve(source, { fetchImpl = fetch, sleepImpl = delay, allowChallenge = false } = {}) {
  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(source.url, {
        headers: { "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (response?.ok) {
      return {
        mode: "live",
        bytes: Buffer.from(await response.arrayBuffer()),
        finalUrl: new URL(response.url),
        contentType: response.headers.get("content-type") ?? "",
      };
    }
    if (response) {
      if (allowChallenge && [403, 429, 503].includes(response.status)) {
        const body = await response.text().catch(() => "");
        const challenge = detectCloudflareChallenge({ status: response.status, headers: response.headers, body });
        if (challenge.challenged) {
          return { mode: CLOUDFLARE_CHALLENGE_STATUS, status: response.status, signals: challenge.signals };
        }
      } else {
        await response.body?.cancel?.();
      }
      lastFailure = `HTTP ${response.status}`;
      if (!isRetryableStatus(source, response.status)) break;
    }
    if (attempt < MAX_ATTEMPTS) await sleepImpl(retryDelayMs(response, attempt));
  }
  assert.fail(`${source.key}: primary-source retrieval failed after ${MAX_ATTEMPTS} attempts (${lastFailure})`);
}

export function assertKozarArtifact(retrieved, source = SOURCES.kozar2018) {
  const { finalUrl } = retrieved;
  assert.equal(finalUrl.protocol, "https:", `${source.key}: final URL left HTTPS`);
  assert.equal(finalUrl.hostname, source.final_host, `${source.key}: final URL host drifted`);
  assert.match(finalUrl.pathname, new RegExp(source.final_path_pattern), `${source.key}: final URL path drifted`);
  assert.equal(finalUrl.search, "", `${source.key}: final URL query drifted`);
  const mediaType = retrieved.contentType.split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, source.media_type, `${source.key}: media type drifted`);
  assert.equal(retrieved.bytes.subarray(0, 5).toString("latin1"), "%PDF-", `${source.key}: artifact lacks a PDF header`);
  assert.equal(retrieved.bytes.length, source.bytes, `${source.key}: artifact byte length drifted`);
  assert.equal(sha256(retrieved.bytes), source.sha256, `${source.key}: artifact SHA-256 drifted`);
}

export function assertPubmedArtifact(retrieved, source = SOURCES.pubmed) {
  const expected = new URL(source.url);
  const { finalUrl } = retrieved;
  assert.equal(finalUrl.protocol, "https:", "pubmed: final URL left HTTPS");
  assert.equal(finalUrl.hostname, expected.hostname, "pubmed: final URL host drifted");
  assert.equal(finalUrl.pathname, expected.pathname, "pubmed: final URL path drifted");
  assert.equal(finalUrl.search, expected.search, "pubmed: final URL query drifted");
  assert.equal(finalUrl.searchParams.get("tool"), "radulator-aast-audit", "pubmed: tool parameter drifted");
  assert.equal(finalUrl.searchParams.has("email"), false, "pubmed: request must not carry an email parameter");
  const mediaType = retrieved.contentType.split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, source.media_type, "pubmed: media type drifted");
}

// ---------------------------------------------------------------------------------------------
// Kozar 2018 PDF

export async function pdfPages(bytes, source = SOURCES.kozar2018) {
  const document = await getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    useSystemFonts: true,
    verbosity: 0,
  }).promise;
  assert.equal(document.numPages, source.pages, `${source.key}: PDF page count drifted`);
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

export function verifyKozarStatements(pages, mismatches, statements = KOZAR_STATEMENTS) {
  const verified = new Map();
  const mutationChecks = [];
  for (const statement of statements) {
    const pageText = pages.get(statement.pdf_page);
    assert.ok(pageText, `${statement.id}: PDF page ${statement.pdf_page} was not extracted`);
    const slice = compact(paragraphSlice(pageText, statement));
    for (const absent of statement.must_not_contain ?? []) {
      assert.equal(
        slice.includes(compact(absent)),
        false,
        `${statement.id}: locator unexpectedly contains ${JSON.stringify(absent)}`,
      );
    }
    const spans = checkSpans(statement, slice, compact, mismatches);
    for (const [token, replacement] of statement.must_contain ?? []) {
      const span = spans.find((candidate) => candidate.value.includes(token));
      assert.ok(span, `${statement.id}: no pinned span contains ${JSON.stringify(token)}`);
      const mutated = span.value.replace(token, replacement);
      const rejected = sha256(mutated) !== span.sha256;
      assert.ok(rejected, `${statement.id}: replacing ${JSON.stringify(token)} did not change the span digest`);
      mutationChecks.push({ statement_id: statement.id, replaced: token, with: replacement, rejected });
    }
    verified.set(statement.id, {
      id: statement.id,
      source: "kozar2018",
      pdf_page: statement.pdf_page,
      printed_page: statement.printed_page,
      locator: statement.locator,
      paraphrase: statement.paraphrase,
      spans: spans.map(({ from, to, length, sha256: digest }) => ({ from, to, length, sha256: digest })),
      ...(statement.must_not_contain ? { absent_anchors: [...statement.must_not_contain] } : {}),
    });
  }
  return { verified, mutationChecks };
}

// ---------------------------------------------------------------------------------------------
// PubMed

function xmlText(fragment) {
  return foldText(decodeEntities(String(fragment ?? "").replace(/<[^>]+>/g, " ")));
}

function firstTag(block, tag) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(block);
  return match ? xmlText(match[1]) : "";
}

export function parsePubmed(xml) {
  const records = new Map();
  for (const [block] of String(xml).matchAll(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g)) {
    const pmid = /<PMID Version="\d+">(\d+)<\/PMID>/.exec(block)?.[1];
    assert.ok(pmid, "pubmed: record without PMID");
    const authorList = /<AuthorList\b[^>]*>([\s\S]*?)<\/AuthorList>/.exec(block)?.[1] ?? "";
    const authors = [...authorList.matchAll(/<Author\b[^>]*>([\s\S]*?)<\/Author>/g)].map(([, author]) => {
      const collective = firstTag(author, "CollectiveName");
      return collective || `${firstTag(author, "LastName")} ${firstTag(author, "Initials")}`.trim();
    });
    const pubDate = /<PubDate>([\s\S]*?)<\/PubDate>/.exec(block)?.[1] ?? "";
    const doi = /<ArticleId IdType="doi">([^<]+)<\/ArticleId>/.exec(block)?.[1] ?? "";
    const abstract = [...block.matchAll(/<AbstractText\b[^>]*>([\s\S]*?)<\/AbstractText>/g)].map(([, text]) => xmlText(text));
    records.set(pmid, {
      pmid,
      title: firstTag(block, "ArticleTitle"),
      authors,
      journal: firstTag(block, "ISOAbbreviation"),
      year: firstTag(pubDate, "Year"),
      volume: firstTag(block, "Volume"),
      issue: firstTag(block, "Issue"),
      pages: firstTag(block, "MedlinePgn"),
      doi: foldText(doi),
      abstract,
    });
  }
  return records;
}

function expandPages(pages) {
  // PubMed abbreviates page ranges (1119-1122 -> "1119-1122" or "1119-22").
  const match = /^(\d+)-(\d+)$/.exec(pages);
  if (!match) return pages;
  const [, first, last] = match;
  return last.length < first.length ? `${first}-${first.slice(0, first.length - last.length)}${last}` : pages;
}

export function pubmedRecordsDigest(records) {
  const canonical = [...records.values()].sort((left, right) => left.pmid.localeCompare(right.pmid));
  return sha256(JSON.stringify(canonical));
}

export function verifyPubmed(records, mismatches) {
  const verified = new Map();
  for (const identity of PUBMED_IDENTITIES) {
    const record = records.get(identity.pmid);
    assert.ok(record, `${identity.id}: PubMed record ${identity.pmid} is missing`);
    assert.equal(record.title, identity.title, `${identity.id}: title drifted`);
    assert.deepEqual(record.authors.slice(0, identity.first_authors.length), identity.first_authors, `${identity.id}: first authors drifted`);
    assert.equal(record.journal, identity.journal, `${identity.id}: journal drifted`);
    assert.equal(record.year, identity.year, `${identity.id}: year drifted`);
    assert.equal(record.volume, identity.volume, `${identity.id}: volume drifted`);
    assert.equal(record.issue, identity.issue, `${identity.id}: issue drifted`);
    assert.equal(expandPages(record.pages), identity.pages, `${identity.id}: pages drifted`);
    assert.equal(record.doi.toLowerCase(), identity.doi.toLowerCase(), `${identity.id}: DOI drifted`);
    verified.set(identity.id, {
      id: identity.id,
      source: "pubmed",
      pmid: identity.pmid,
      locator: `PubMed ${identity.pmid} citation fields`,
      paraphrase: `PubMed identifies PMID ${identity.pmid} as ${identity.first_authors[0]} et al., ${identity.journal} ${identity.year};${identity.volume}(${identity.issue}):${identity.pages}, DOI ${identity.doi}.`,
      identity: {
        title: identity.title,
        first_authors: [...identity.first_authors],
        citation: `${identity.journal}. ${identity.year};${identity.volume}(${identity.issue}):${identity.pages}`,
        doi: identity.doi,
      },
    });
  }
  for (const statement of PUBMED_STATEMENTS) {
    const record = records.get(statement.pmid);
    assert.ok(record, `${statement.id}: PubMed record ${statement.pmid} is missing`);
    const abstract = record.abstract.join("\n");
    assert.ok(abstract.length > 0, `${statement.id}: abstract is missing`);
    const spans = checkSpans(statement, abstract, foldText, mismatches);
    verified.set(statement.id, {
      id: statement.id,
      source: "pubmed",
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
    [{ organ: "pancreas" }, false, false],
    [{ organ: "liver", kidney_ois_version: "2018" }, true, false],
    [{ organ: "pancreas", kidney_ois_version: "2018" }, false, false],
  ];
  for (const [vals, showMultiple, showBilateral] of visibility) {
    assert.equal(Boolean(multiple.showIf(vals)), showMultiple, `multiple_injuries visibility for ${JSON.stringify(vals)}`);
    assert.equal(Boolean(bilateral.showIf(vals)), showBilateral, `kidney_2018_bilateral visibility for ${JSON.stringify(vals)}`);
  }

  // Grade matrix: every path x base grade x modifier x on/off.
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

  // Wording of the modifier boxes and the two reworded subLabels; scoring unchanged.
  assert.equal(multiple.label, RUNTIME_TEXT.multiple_label, "multiple_injuries label drifted");
  assert.equal(multiple.subLabel, RUNTIME_TEXT.multiple_sublabel, "multiple_injuries subLabel drifted");
  assert.equal(bilateral.label, RUNTIME_TEXT.bilateral_label, "kidney_2018_bilateral label drifted");
  assert.equal(bilateral.subLabel, RUNTIME_TEXT.bilateral_sublabel, "kidney_2018_bilateral subLabel drifted");
  assert.equal(field("kidney_2018_urinary_extrav").subLabel, RUNTIME_TEXT.kidney_2018_urinary_extrav_sublabel, "kidney_2018_urinary_extrav subLabel drifted");
  assert.equal(field("pancreas_destructive").subLabel, RUNTIME_TEXT.pancreas_destructive_sublabel, "pancreas_destructive subLabel drifted");
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

  return {
    vectors,
    bindings: {
      "liver-2018-multiple-injury-advance": { path: "liver", modifier: "multiple_injuries", base_grades: [1, 2, 3, 4, 5], ceiling: 3 },
      "spleen-2018-multiple-injury-advance": { path: "spleen", modifier: "multiple_injuries", base_grades: [1, 2, 3, 4, 5], ceiling: 3 },
      "kidney-2018-bilateral-advance": { path: "kidney2018", modifier: "kidney_2018_bilateral", base_grades: [1, 2, 3, 4, 5], ceiling: 3 },
      "kidney-2018-no-multiple-injury-advance": { path: "kidney2018", modifier: "multiple_injuries", shown: false, applied: false },
      "kidney-2018-urinary-extravasation-sublabel": { field: "kidney_2018_urinary_extrav", sublabel: RUNTIME_TEXT.kidney_2018_urinary_extrav_sublabel, grade: 4 },
      "pancreas-2024-grade-v-sublabel": { field: "pancreas_destructive", sublabel: RUNTIME_TEXT.pancreas_destructive_sublabel, grade: 5 },
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
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Audit

export async function runAudit({ calculator, fetchImpl = fetch, sleepImpl = delay, requireLive = false } = {}) {
  assert.ok(calculator?.id === "aast-trauma-grading", "runAudit needs the AAST calculator export");
  const [kozarRetrieved, pubmedRetrieved] = await Promise.all([
    retrieve(SOURCES.kozar2018, { fetchImpl, sleepImpl, allowChallenge: true }),
    retrieve(SOURCES.pubmed, { fetchImpl, sleepImpl }),
  ]);

  const mismatches = [];
  let kozar = { verified: new Map(), mutationChecks: [] };
  const notices = [];
  if (kozarRetrieved.mode === "live") {
    assertKozarArtifact(kozarRetrieved);
    kozar = verifyKozarStatements(await pdfPages(kozarRetrieved.bytes), mismatches);
  } else {
    const notice = `kozar2018: live source challenged by Cloudflare bot protection (HTTP ${kozarRetrieved.status}; ${kozarRetrieved.signals.join(", ")}); the ${KOZAR_STATEMENTS.length} Kozar 2018 statements were not re-read in this run`;
    assert.ok(!requireLive, `${notice} and --require-live was given`);
    notices.push(notice);
  }

  assertPubmedArtifact(pubmedRetrieved);
  const records = parsePubmed(pubmedRetrieved.bytes.toString("utf8"));
  assert.deepEqual([...records.keys()].sort(), ["30462622", "39836096", "39898876"], "pubmed: unexpected record set");
  const recordsSha256 = pubmedRecordsDigest(records);
  assert.equal(
    recordsSha256,
    SOURCES.pubmed.records_sha256,
    "pubmed: normalized citation fields or abstracts drifted (re-review the PubMed statements before re-pinning)",
  );
  const pubmedVerified = verifyPubmed(records, mismatches);

  assert.equal(
    mismatches.length,
    0,
    `pinned source spans drifted (re-review each statement at its locator before re-pinning):\n${JSON.stringify(mismatches, null, 2)}`,
  );

  const verified = new Map([...kozar.verified, ...pubmedVerified]);
  const kozarIds = new Set(KOZAR_STATEMENTS.map((statement) => statement.id));
  const boundIds = new Set(CLAIM_BINDINGS.flatMap((binding) => binding.source_statement_ids));
  for (const binding of CLAIM_BINDINGS) {
    for (const statementId of binding.source_statement_ids) {
      const knownPubmed = PUBMED_IDENTITIES.some((identity) => identity.id === statementId) || PUBMED_STATEMENTS.some((statement) => statement.id === statementId);
      assert.ok(kozarIds.has(statementId) || knownPubmed, `${binding.claim_id}: unknown source statement ${statementId}`);
      if (kozarRetrieved.mode === "live" || !kozarIds.has(statementId)) {
        assert.ok(verified.has(statementId), `${binding.claim_id}: source statement ${statementId} is not verified`);
      }
    }
  }
  for (const statementId of [...kozarIds, ...PUBMED_IDENTITIES.map((identity) => identity.id), ...PUBMED_STATEMENTS.map((statement) => statement.id)]) {
    assert.ok(boundIds.has(statementId), `${statementId}: source statement has no runtime binding`);
  }

  const runtime = verifyRuntime(calculator);
  for (const binding of CLAIM_BINDINGS) {
    assert.ok(runtime.bindings[binding.claim_id], `${binding.claim_id}: runtime binding was not exercised`);
  }

  return {
    schema: "radulator-aast-injury-modifier-source-audit/v1",
    calculator_id: calculator.id,
    calculator_path: CALCULATOR_PATH,
    sources: [
      {
        key: SOURCES.kozar2018.key,
        authority: SOURCES.kozar2018.authority,
        document: SOURCES.kozar2018.document,
        doi: SOURCES.kozar2018.doi,
        pmid: SOURCES.kozar2018.pmid,
        url: SOURCES.kozar2018.url,
        mode: kozarRetrieved.mode,
        final_url: kozarRetrieved.mode === "live" ? kozarRetrieved.finalUrl.href : null,
        media_type: SOURCES.kozar2018.media_type,
        pin: SOURCES.kozar2018.pin,
        bytes: SOURCES.kozar2018.bytes,
        sha256: SOURCES.kozar2018.sha256,
        pages: SOURCES.kozar2018.pages,
      },
      {
        key: SOURCES.pubmed.key,
        authority: SOURCES.pubmed.authority,
        document: SOURCES.pubmed.document,
        url: SOURCES.pubmed.url,
        mode: pubmedRetrieved.mode,
        final_url: pubmedRetrieved.finalUrl.href,
        media_type: SOURCES.pubmed.media_type,
        pin: SOURCES.pubmed.pin,
        pin_rationale: SOURCES.pubmed.pin_rationale,
        content_digest_basis: SOURCES.pubmed.content_digest_basis,
        records_sha256: recordsSha256,
        observed_raw: { bytes: pubmedRetrieved.bytes.length, sha256: sha256(pubmedRetrieved.bytes), enforced: false },
      },
    ],
    source_statements: [...verified.values()],
    source_mutation_checks: kozar.mutationChecks,
    claim_bindings: CLAIM_BINDINGS.map((binding) => ({
      claim_id: binding.claim_id,
      source_statement_ids: [...binding.source_statement_ids],
      source_verified_this_run: binding.source_statement_ids.every((statementId) => verified.has(statementId)),
      runtime: runtime.bindings[binding.claim_id],
    })),
    runtime: { vectors: runtime.vectors, fail_safe: runtime.fail_safe },
    notices,
    scope: {
      not_asserted: [
        "whether the 2025 kidney revision (Keihani 2025) keeps any grade-advance rule: full text not openly retrievable",
        "whether the 2024 pancreas revision (Notrica 2025) keeps any grade-advance rule: full text not openly retrievable",
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
  const audit = await runAudit({ calculator: AASTTraumaGrading, requireLive: process.argv.includes("--require-live") });
  for (const notice of audit.notices) process.stderr.write(`${notice}\n`);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(audit)}\n`);
  } else {
    console.log(
      `AAST injury-modifier source audit passed: Kozar 2018 PDF ${audit.sources[0].mode === "live" ? "byte-pinned live" : "challenged (statements not re-read)"}, PubMed records pinned, ${audit.source_statements.length} source statements, ${audit.source_mutation_checks.length} source mutation checks, ${audit.claim_bindings.length} runtime claim bindings and ${audit.runtime.vectors} runtime vectors.`,
    );
  }
}
