#!/usr/bin/env node
// NI-RADS MRI v2025 neck new/enlarging-node categories: exact-head primary-source audit.
//
// The MRI v2025 classifier refuses a neck-1 finding when Neck Node Timing says the node is new or
// enlarging, and keeps every neck 2-4 finding for such a node. This audit binds that rule, and the
// neck pattern categories it relies on, to the official ACR table:
//   American College of Radiology. NI-RADS MRI v2025 Assessment Categories (updated August 2025),
//   https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/NI-RADS/NIRADS-MRI-2025-Assessment-Categories.pdf
//   - page 1, table row "Low Suspicion 2a 2": the neck descriptor for a new or enlarging node without
//     definitively abnormal morphology;
//   - page 1, row "High Suspicion 3 3": the neck descriptor for a new or enlarging node with necrosis,
//     cystic change, irregular borders or focal intense FDG uptake;
//   - page 1, row "Definitive Recurrence 4 4": pathologically proven or definite progression;
//   - page 1, row "No Evidence of Recurrence 1 1": no new or enlarging node descriptor at all;
//   - page 2, footnote "Neck (2, 3)": the definition of a new or enlarging node, attached to neck
//     categories 2 and 3 only.
//
// The PDF is verified as bytes before parsing: final URL, media type, PDF header, exact byte length and
// SHA-256. Each statement is also pinned by the SHA-256 of the exact normalized span between two short
// markers. No source prose is committed.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const SOURCE = Object.freeze({
  id: "acr-nirads-mri-v2025-assessment-categories",
  url: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/NI-RADS/NIRADS-MRI-2025-Assessment-Categories.pdf",
  bytes: 234_959,
  sha256: "b220dab013cd674bf4716cd4a35b9cc19bf3fa61051be494758606f1a6a929c9",
  pages: 2,
});
export const SOURCE_HOST = "edge.sitecorecloud.io";
export const SOURCE_MEDIA_TYPE = "application/pdf";

// Page-1 table rows, in order. Each row runs from its label to the next row's label.
export const ROW_LABELS = Object.freeze([
  ["1", "No Evidence of Recurrence 1 1"],
  ["2", "Low Suspicion 2a 2"],
  ["3", "High Suspicion 3 3"],
  ["4", "Definitive Recurrence 4 4"],
]);
export const TITLE_MARKERS = Object.freeze(["MRI v2025 Assessment Categories", "Updated: August 2025"]);
export const NEW_NODE_MARKER = "New or enlarging lymph node";

// Each span runs from the first character of `from` through the last character of `to` (inclusive),
// inside the named section: a page-1 table row ("row-1" to "row-4") or "notes" (page 2). Markers are
// at most six words; `from` must occur exactly once in its section.
export const STATEMENTS = Object.freeze([
  Object.freeze({
    id: "acr-neck-2-new-node",
    section: "row-2",
    from: "New or enlarging lymph node",
    to: "abnormal morphologic features",
    length: 78,
    sha256: "eb57dfa4420255bb37a18f60c370ecf0bc88267075ac02014efca752a080c359",
    paraphrase: "Neck category 2 includes a new or enlarging node that lacks definitively abnormal morphology.",
  }),
  Object.freeze({
    id: "acr-neck-3-new-node-suspicious",
    section: "row-3",
    from: "New or enlarging lymph node",
    to: "if PET is available",
    length: 126,
    sha256: "d35d57d6702ebcce28d9fb91e1ebcefe14a752bd429bc22d48954a78f95b7bbf",
    paraphrase:
      "Neck category 3 includes a new or enlarging node with necrosis, cystic change, irregular borders, or intense focal FDG uptake on PET.",
  }),
  Object.freeze({
    id: "acr-neck-4-definitive",
    section: "row-4",
    from: "Pathologically proven or definite",
    to: "clinical progression",
    length: 69,
    sha256: "66e4f86464b072a7749ef0a370a17d955ea68ca143596669a08516f17f41b912",
    paraphrase: "Category 4 is pathologically proven recurrence or definite radiologic and clinical progression.",
  }),
  Object.freeze({
    id: "acr-new-node-footnote-neck-2-3",
    section: "notes",
    from: "Neck (2, 3)",
    to: "during the course of surveillance",
    length: 108,
    sha256: "10f2952a48b587e8330e3a02ace31c6a47c54f2be535212d88dff156859ae0b8",
    paraphrase:
      "The footnote defining a new or enlarging node (one that appears or grows during surveillance) belongs to neck categories 2 and 3 only.",
  }),
]);

// Runtime error code for a new/enlarging node described by a neck-1 finding.
export const BELOW_CATEGORY_2_ERROR = "new_or_enlarging_node_below_category_2";
export const PRESERVED_NEW_NODE_VECTORS = Object.freeze([
  ["n2_new_enlarging_no_definitive_morphology", "2"],
  ["n3_new_enlarging_necrosis_cystic", "3"],
  ["n4_definitive_recurrence", "4"],
  ["n2_pet_mri_discordance", "2"],
]);

const FETCH_ATTEMPTS = 5;
const FETCH_MAX_DELAY_MS = 20_000;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalize(value) {
  return String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
}

// Exact bytes first: nothing is parsed from a response that is not the pinned artifact.
export function verifySourceBytes(bytes, source = SOURCE) {
  assert.ok(Buffer.isBuffer(bytes), `${source.id}: source bytes missing`);
  assert.equal(
    bytes.length,
    source.bytes,
    `${source.id}: source byte length drifted (${bytes.length}, pinned ${source.bytes}); re-review the table before re-pinning`,
  );
  const digest = sha256(bytes);
  assert.equal(
    digest,
    source.sha256,
    `${source.id}: source SHA-256 drifted (${digest}); re-review the table before re-pinning`,
  );
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-", `${source.id}: source lacks a PDF header`);
  return digest;
}

export async function extractPages(bytes) {
  const document = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  assert.equal(document.numPages, SOURCE.pages, `${SOURCE.id}: page count drifted`);
  const pages = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const content = await (await document.getPage(number)).getTextContent();
    pages.push(normalize(content.items.map((item) => `${item.str}${item.hasEOL ? " " : ""}`).join("")));
  }
  return pages;
}

// Splits page 1 into its category rows and keeps page 2 as the footnotes.
export function sectionsFromPages(pages) {
  const [table, notes] = pages;
  for (const marker of TITLE_MARKERS) {
    assert.ok(table.includes(marker), `${SOURCE.id}: page 1 lacks the title marker ${JSON.stringify(marker)}`);
  }
  const starts = ROW_LABELS.map(([, label]) => {
    const at = table.indexOf(label);
    assert.ok(at >= 0, `${SOURCE.id}: table row ${JSON.stringify(label)} not found`);
    assert.equal(table.lastIndexOf(label), at, `${SOURCE.id}: table row ${JSON.stringify(label)} is not unique`);
    return at;
  });
  starts.forEach((at, index) => {
    if (index > 0) assert.ok(at > starts[index - 1], `${SOURCE.id}: table rows are out of order`);
  });
  const sections = { notes };
  ROW_LABELS.forEach(([category], index) => {
    sections[`row-${category}`] = table.slice(starts[index], starts[index + 1] ?? undefined);
  });
  return sections;
}

export function extractSpan(text, from, to) {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `start marker not found: ${from}`);
  assert.equal(text.lastIndexOf(from), start, `start marker is not unique: ${from}`);
  const end = text.indexOf(to, start + from.length);
  assert.ok(end >= 0, `end marker not found after start: ${to}`);
  return text.slice(start, end + to.length);
}

export function verifyStatements(sections, statements = STATEMENTS) {
  const spans = {};
  for (const statement of statements) {
    for (const marker of [statement.from, statement.to]) {
      assert.ok(marker.split(/\s+/).length <= 6, `${statement.id}: marker longer than six words`);
    }
    const text = sections[statement.section];
    assert.ok(typeof text === "string", `${statement.id}: section ${statement.section} missing`);
    const span = extractSpan(text, statement.from, statement.to);
    assert.equal(span.length, statement.length, `${statement.id}: pinned statement length drifted`);
    assert.equal(sha256(span), statement.sha256, `${statement.id}: pinned statement drifted`);
    spans[statement.id] = span;
  }
  return spans;
}

// Facts from the pinned table: which neck categories describe a new or enlarging node.
export function extractFacts(sections, spans) {
  const rowsWithNewNode = ROW_LABELS.map(([category]) => category).filter((category) =>
    sections[`row-${category}`].includes(NEW_NODE_MARKER));
  assert.deepEqual(rowsWithNewNode, ["2", "3"], "only the category 2 and 3 rows may describe a new or enlarging node");
  assert.ok(
    !/new or enlarging/i.test(sections["row-1"]),
    "the category 1 row must not describe a new or enlarging node",
  );
  const footnote = spans["acr-new-node-footnote-neck-2-3"].match(/^Neck \((\d(?:, \d)*)\)/);
  assert.ok(footnote, "the new/enlarging-node footnote must name its neck categories");
  const footnoteCategories = footnote[1].split(", ");
  assert.deepEqual(footnoteCategories, rowsWithNewNode, "the footnote categories must match the table rows");
  return {
    newNodeCategories: rowsWithNewNode,
    minimumNewNodeCategory: Math.min(...rowsWithNewNode.map(Number)),
    definitiveCategory: "4",
  };
}

// Binds the classifier and its neck pattern set to the facts.
export function bindRuntime(runtime, facts) {
  const { MRI_2025_PATTERN_DEFINITIONS: patterns, classifyNiradsMri2025: classify, NIRADS } = runtime;
  assert.equal(
    patterns.n2_new_enlarging_no_definitive_morphology?.category,
    "2",
    "the new/enlarging node without definitive morphology must be neck 2 (ACR row 2)",
  );
  for (const id of ["n3_new_enlarging_necrosis_cystic", "n3_new_enlarging_irregular_ene", "n3_new_enlarging_intense_fdg"]) {
    assert.equal(patterns[id]?.category, "3", `${id} must be neck 3 (ACR row 3)`);
  }
  assert.equal(patterns.n4_definitive_recurrence?.category, facts.definitiveCategory, "definitive recurrence must be neck 4 (ACR row 4)");

  const neckPatterns = Object.entries(patterns).filter(([, definition]) => definition.site === "neck");
  for (const [id, definition] of neckPatterns) {
    if (definition.category === "1") {
      assert.ok(!/\bnew\b|enlarg/i.test(definition.label), `${id}: a neck-1 finding must not describe a new or enlarging node`);
    }
  }

  const newNode = {
    version: "mri_2025",
    assessment_site: "neck",
    during_treatment: false,
    assessable: true,
    prior_status: "available",
    node_temporal_status: "new_or_enlarging",
    original_tumor_fdg_avid: "yes",
  };
  // Every neck finding for a new or enlarging node either fails closed or classifies at the ACR minimum or above.
  let swept = 0;
  for (const [id, definition] of neckPatterns) {
    if (definition.category === "0") continue;
    const result = classify({ ...newNode, pattern_ids: [id] });
    swept += 1;
    if (result.status === "classified") {
      assert.ok(
        Number(result.category) >= facts.minimumNewNodeCategory,
        `${id}: a new or enlarging node classified below neck ${facts.minimumNewNodeCategory}`,
      );
    } else {
      assert.equal(result.status, "error", `${id}: unexpected classifier status ${result.status}`);
    }
  }

  const failClosed = [{ pattern_ids: ["n1_no_abnormal_nodes"] }, { pattern_id: "n1_no_abnormal_nodes" }];
  for (const vector of failClosed) {
    assert.deepEqual(
      classify({ ...newNode, ...vector }),
      { status: "error", error: BELOW_CATEGORY_2_ERROR },
      "a neck-1 finding for a new or enlarging node must fail closed",
    );
  }
  for (const [id, category] of PRESERVED_NEW_NODE_VECTORS) {
    const result = classify({ ...newNode, pattern_ids: [id] });
    assert.equal(result.status, "classified", `${id}: a valid finding for a new or enlarging node must still classify`);
    assert.equal(result.category, category, `${id}: must classify as neck ${category}`);
  }
  const output = NIRADS.compute({
    nirads_version: "mri_2025",
    during_treatment: "no",
    assessment_site: "neck",
    assessable: "yes",
    prior_status: "available",
    node_temporal_status: "new_or_enlarging",
    neck_pattern_id: "n1_no_abnormal_nodes",
  });
  assert.equal(output["Error Code"], BELOW_CATEGORY_2_ERROR, "the calculator must report the fail-closed error");
  assert.equal(output["Neck NI-RADS"], undefined, "the calculator must show no neck category for the contradiction");
  return { swept, failClosed: failClosed.length, preserved: PRESERVED_NEW_NODE_VECTORS.length };
}

export function verifyResponse({ finalUrl, contentType }, source = SOURCE) {
  const expected = new URL(source.url);
  const url = new URL(finalUrl);
  assert.equal(url.protocol, "https:", `${source.id}: final URL protocol ${url.protocol}`);
  assert.equal(url.host, SOURCE_HOST, `${source.id}: final URL host ${url.host}`);
  assert.equal(url.pathname, expected.pathname, `${source.id}: final URL path ${url.pathname}`);
  const mediaType = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, SOURCE_MEDIA_TYPE, `${source.id}: media type ${contentType ?? "<missing>"}`);
}

// Retry-After (seconds) is honoured only when the header is present; the caller caps every wait at
// FETCH_MAX_DELAY_MS. Without it the exponential backoff applies.
function retryDelayMs(response, attempt) {
  const header = response?.headers?.get?.("retry-after");
  const retryAfter = header == null || String(header).trim() === "" ? Number.NaN : Number(header);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter * 1_000;
  return 1_500 * 2 ** (attempt - 1);
}

// Retries transport failures only: network errors, 408, 425, 429 and 5xx. A 200 response that misses
// its URL, media-type, length or digest pin is a changed source and fails at once.
export async function fetchSource({ fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let lastFailure = "unknown retrieval failure";
  let made = 0;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    made = attempt;
    let response;
    try {
      response = await fetchImpl(SOURCE.url, {
        headers: { accept: SOURCE_MEDIA_TYPE, "user-agent": "Radulator-NIRADS-MRI-neck-source-audit/1" },
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (response?.ok) {
      verifyResponse({ finalUrl: response.url, contentType: response.headers.get("content-type") });
      const bytes = Buffer.from(await response.arrayBuffer());
      verifySourceBytes(bytes);
      return bytes;
    }
    if (response) {
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel?.();
      if (![408, 425, 429].includes(response.status) && response.status < 500) break;
    }
    if (attempt < FETCH_ATTEMPTS) await sleep(Math.min(retryDelayMs(response, attempt), FETCH_MAX_DELAY_MS));
  }
  assert.fail(`${SOURCE.id}: ACR retrieval failed after ${made} of ${FETCH_ATTEMPTS} attempts (${lastFailure})`);
}

// `bytes` is the exact response body. Bytes are verified before anything is parsed.
export async function runAudit({ bytes, runtime }) {
  verifySourceBytes(bytes);
  const sections = sectionsFromPages(await extractPages(bytes));
  const spans = verifyStatements(sections);
  const facts = extractFacts(sections, spans);
  const binding = bindRuntime(runtime, facts);
  return { sections, spans, facts, binding };
}

export async function loadRuntime(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  return import(pathToFileURL(path.join(root, "src/components/calculators/NIRADS.jsx")).href);
}

export function passLine({ facts, binding }) {
  return (
    `NI-RADS MRI v2025 neck source audit PASS: ACR assessment categories ${SOURCE.bytes} bytes ` +
    `sha256=${SOURCE.sha256.slice(0, 12)} (application/pdf, raw bytes, ${SOURCE.pages} pages); ` +
    `${STATEMENTS.length} digest-pinned statements; new/enlarging node rows ${facts.newNodeCategories.join(" and ")} only ` +
    `(footnote "Neck (2, 3)"), none in row 1 -> runtime minimum neck ${facts.minimumNewNodeCategory}: ` +
    `${binding.swept} neck findings swept, neck-1 findings rejected (${binding.failClosed} vectors), ` +
    `neck 2/3/4 findings kept (${binding.preserved} vectors)`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await runAudit({ bytes: await fetchSource(), runtime: await loadRuntime() });
  console.log(passLine(result));
}
