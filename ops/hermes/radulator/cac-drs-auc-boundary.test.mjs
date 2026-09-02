#!/usr/bin/env node

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CACMesa } from "../../../src/components/calculators/CACMesa.jsx";

const AUC_PUBLICATION_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC10585920/";
const AUC_DOI = "10.1186/s12968-023-00958-5";
const AUC_TITLE =
  "ACC/AHA/ASE/ASNC/ASPC/HFSA/HRS/SCAI/SCCT/SCMR/STS 2023 Multimodality Appropriate Use Criteria for the Detection and Risk Assessment of Chronic Coronary Disease";
const MARON_PUBLICATION_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC11462328/";
const MARON_DOI = "10.1016/j.jacadv.2024.101287";
const MARON_TITLE =
  "Coronary Artery Calcium Staging to Guide Preventive Interventions";
const AUC_BIOC_JSON_URL =
  "https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC10585920/unicode";
const AUC_BIOC_HOST = "www.ncbi.nlm.nih.gov";
const AUC_BIOC_PATH =
  "/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC10585920/unicode";
const AUC_BIOC_MEDIA_TYPE = "application/json";
const MARON_BIOC_JSON_URL =
  "https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC11462328/unicode";
const MARON_BIOC_HOST = "www.ncbi.nlm.nih.gov";
const MARON_BIOC_PATH =
  "/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC11462328/unicode";
const MARON_BIOC_MEDIA_TYPE = "application/json";
const EXPECTED_BIOC_RAW_BYTES = 216_779;
const EXPECTED_BIOC_RAW_SHA256 =
  "e13e2353c894a67bd9092255f89a682ef43ce638aa26873a54e8ef4ae63d351a";
const EXPECTED_BIOC_CANONICAL_BYTES = 207_915;
const EXPECTED_BIOC_CANONICAL_SHA256 =
  "3870526ebbef77ece57d8ea89f0d32d2a63c2fd47013aa425ced7ceaa0c9d3f2";
const EXPECTED_MARON_BIOC_RAW_BYTES = 26_452;
const EXPECTED_MARON_BIOC_RAW_SHA256 =
  "f9513adaa3fecf0163a04eaf21f18ff1faefb9045cedc504ee9e505ebde596e0";
const EXPECTED_MARON_BIOC_CANONICAL_BYTES = 25_322;
const EXPECTED_MARON_BIOC_CANONICAL_SHA256 =
  "9fc8b5ffb054f03de2539911da77296e5435a9c60848859b6728c98cd81cf997";
const RETRY_ATTEMPTS = 3;
const BIOC_MAX_BYTES = 1_000_000;

const BIOC_SPECS = Object.freeze({
  auc: Object.freeze({
    id: "auc-pmc-bioc-json",
    label: "AUC NCBI PMC BioC JSON",
    url: AUC_BIOC_JSON_URL,
    host: AUC_BIOC_HOST,
    path: AUC_BIOC_PATH,
    mediaType: AUC_BIOC_MEDIA_TYPE,
    rawBytes: EXPECTED_BIOC_RAW_BYTES,
    rawSha256: EXPECTED_BIOC_RAW_SHA256,
    canonicalBytes: EXPECTED_BIOC_CANONICAL_BYTES,
    canonicalSha256: EXPECTED_BIOC_CANONICAL_SHA256,
    userAgent: "Radulator-CAC-DRS-NCBI-BioC-audit/1",
  }),
  maron: Object.freeze({
    id: "maron-pmc-bioc-json",
    label: "Maron NCBI PMC BioC JSON",
    url: MARON_BIOC_JSON_URL,
    host: MARON_BIOC_HOST,
    path: MARON_BIOC_PATH,
    mediaType: MARON_BIOC_MEDIA_TYPE,
    rawBytes: EXPECTED_MARON_BIOC_RAW_BYTES,
    rawSha256: EXPECTED_MARON_BIOC_RAW_SHA256,
    canonicalBytes: EXPECTED_MARON_BIOC_CANONICAL_BYTES,
    canonicalSha256: EXPECTED_MARON_BIOC_CANONICAL_SHA256,
    userAgent: "Radulator-CAC-Maron-NCBI-BioC-audit/1",
  }),
});

const boundaryVectors = [
  ["cac-drs-score-299", "299", "A2 / N not reported"],
  ["cac-drs-score-300", "300", "A3 / N not reported"],
  ["cac-drs-score-301", "301", "A3 / N not reported"],
];
const maronStageVectors = [
  ["maron-stage-0", "0", "0", "No calcified atherosclerotic burden"],
  ["maron-stage-1", "1", "1", "Mild calcified atherosclerotic burden"],
  ["maron-stage-2-percentile-equality", "68", "2", "Moderate calcified atherosclerotic burden"],
  ["maron-stage-2-lower", "100", "2", "Moderate calcified atherosclerotic burden"],
  ["maron-stage-2-upper", "299", "2", "Moderate calcified atherosclerotic burden"],
  ["maron-stage-3-lower", "300", "3", "Severe calcified atherosclerotic burden"],
  ["maron-stage-3-upper", "999", "3", "Severe calcified atherosclerotic burden"],
  ["maron-stage-4-lower", "1000", "4", "Extensive calcified atherosclerotic burden"],
];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const noWait = async () => {};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(message) {
  throw new Error(message);
}

function assertExactFinalUrl(response, expectedUrl, label) {
  if (response.url !== expectedUrl) {
    fail(`${label} final URL is not the exact requested URL: ${response.url}`);
  }
  const actual = new URL(response.url);
  const expected = new URL(expectedUrl);
  for (const component of ["protocol", "username", "password", "hostname", "port", "pathname", "search", "hash"]) {
    if (actual[component] !== expected[component]) fail(`${label} final URL ${component} is not exact`);
  }
}

function assertMediaType(response, expectedMediaType, label) {
  const contentType = response.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== expectedMediaType) {
    fail(`${label} media type must be ${expectedMediaType}, got ${contentType || "missing"}`);
  }
}

async function cancelResponseBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // Cleanup failure must not replace the redirect or HTTP failure being reported.
  }
}

async function readBoundedBody(response, maxBytes, label) {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      await response.body?.cancel();
      fail(`${label} content-length is malformed`);
    }
    if (declaredLength > maxBytes) {
      await response.body?.cancel();
      fail(`${label} body exceeds the exact ${maxBytes}-byte content boundary`);
    }
  }
  if (!response.body || typeof response.body.getReader !== "function") {
    fail(`${label} response body is not stream-readable`);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  let cancelled = false;
  const cancel = async () => {
    if (cancelled) return;
    cancelled = true;
    try {
      await reader.cancel();
    } catch {
      // The read may already have closed the body; the size failure remains authoritative.
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) {
        await cancel();
        fail(`${label} response body yielded a malformed chunk`);
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await cancel();
        fail(`${label} body exceeds the exact ${maxBytes}-byte content boundary`);
      }
      chunks.push(value instanceof ArrayBuffer
        ? Buffer.from(value)
        : Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
  } catch (error) {
    await cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
}

async function retrieveWithRetries({ url, label, userAgent, mediaType, maxBytes, validate, fetchImpl = globalThis.fetch, sleepImpl = wait }) {
  let lastFailure = "unknown retrieval failure";
  let attemptsMade = 0;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    attemptsMade = attempt;
    try {
      const response = await fetchImpl(url, {
        headers: { "user-agent": userAgent },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      if (response.redirected === true) {
        lastFailure = "redirected response";
        await cancelResponseBody(response);
      } else if (response.status !== 200) {
        lastFailure = `HTTP ${response.status}`;
        await cancelResponseBody(response);
        if (response.status !== 429 && response.status >= 300 && response.status < 500) break;
      } else {
        try {
          assertExactFinalUrl(response, url, label);
          assertMediaType(response, mediaType, label);
        } catch (error) {
          try {
            await response.body?.cancel();
          } catch {
            // The URL or media-type failure remains authoritative.
          }
          throw error;
        }
        const bytes = await readBoundedBody(response, maxBytes, label);
        return await validate({ bytes, response });
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < RETRY_ATTEMPTS) await sleepImpl(attempt * 500);
  }
  const attemptWord = attemptsMade === 1 ? "attempt" : "attempts";
  throw new Error(`${label} retrieval failed after ${attemptsMade} ${attemptWord} (${lastFailure})`);
}

function decodeHtmlEntities(value) {
  const named = new Map([["amp", "&"], ["apos", "'"], ["ge", ">="], ["gt", ">"], ["le", "<="], ["lt", "<"], ["nbsp", " "], ["quot", '"'], ["thinsp", " "]]);
  return value
    .replace(/&#x([a-f0-9]+);/gi, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 16)))
    .replace(/&#([0-9]+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&([a-z]+);/gi, (entity, name) => named.get(name.toLowerCase()) ?? entity);
}

function visibleText(value) {
  return decodeHtmlEntities(value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])]));
  }
  return value;
}

function canonicalJsonBytes(payload) {
  return Buffer.from(JSON.stringify(stableJsonValue(payload)), "utf8");
}

function parseBiocCollection(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail(`${label} is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertPinnedDigest(bytes, source, verifyDigest) {
  if (!verifyDigest) return;
  assert.equal(bytes.length, source.rawBytes, `${source.label} raw byte length drifted`);
  assert.equal(sha256(bytes), source.rawSha256, `${source.label} raw SHA256 drifted`);
}

function assertCanonicalDigest(canonical, source, verifyDigest) {
  if (!verifyDigest) return;
  assert.equal(canonical.length, source.canonicalBytes, `${source.label} canonical byte length drifted`);
  assert.equal(sha256(canonical), source.canonicalSha256, `${source.label} canonical SHA256 drifted`);
}

function assertSourceIdentity(collection, source, expected) {
  assert.ok(Array.isArray(collection) && collection.length === 1, `${source.label} collection identity is malformed`);
  assert.equal(collection[0].source, "PMC", `${source.label} source must be PMC`);
  assert.equal(collection[0].date, expected.date, `${source.label} source date drifted`);
  assert.ok(Array.isArray(collection[0].documents) && collection[0].documents.length === 1, `${source.label} document identity is malformed`);
  const document = collection[0].documents[0];
  assert.equal(document.id, expected.documentId, `${source.label} document identity drifted`);
  assert.equal(document.infons?.license, expected.license, `${source.label} license identity drifted`);
  assert.ok(Array.isArray(document.passages), `${source.label} passages are malformed`);
  const titlePassages = document.passages.filter(({ infons }) => infons?.section_type === "TITLE" && infons?.type === "front");
  assert.equal(titlePassages.length, 1, `${source.label} title identity is not unique`);
  const title = titlePassages[0];
  assert.equal(title.text, expected.title, `${source.label} title drifted`);
  assert.equal(title.infons?.["article-id_pmc"], expected.pmcId, `${source.label} PMCID drifted`);
  assert.equal(title.infons?.["article-id_doi"], expected.doi, `${source.label} DOI drifted`);
  return document;
}

function tablePassage(document, tableId, source) {
  const passages = document.passages.filter(({ infons }) => infons?.id === tableId);
  const captions = passages.filter(({ infons }) => infons?.type === "table_caption");
  const tables = passages.filter(({ infons }) => infons?.type === "table");
  assert.equal(captions.length, 1, `${source.label} ${tableId} caption identity is not unique`);
  assert.equal(tables.length, 1, `${source.label} ${tableId} table identity is not unique`);
  const table = tables[0];
  assert.equal(table.infons?.section_type, "TABLE", `${source.label} ${tableId} section type drifted`);
  assert.match(table.infons?.xml ?? "", /^<\?xml version="1\.0" encoding="UTF-8"\?>/, `${source.label} ${tableId} XML identity drifted`);
  return { caption: captions[0], table, text: visibleText(table.text ?? "") };
}

function validateAucBioc({ bytes, source = BIOC_SPECS.auc, verifyDigest = true } = {}) {
  assertPinnedDigest(bytes, source, verifyDigest);
  const collection = parseBiocCollection(bytes, source.label);
  const document = assertSourceIdentity(collection, source, { date: "20240128", documentId: "10585920", license: "CC BY", title: AUC_TITLE, pmcId: "10585920", doi: AUC_DOI });
  const { caption, table, text } = tablePassage(document, "Tab2", source);
  assert.equal(caption.text, "Symptomatic Patients Without Known CCD and With Prior Testing*");
  for (const row of [
    /18\.\s*cac score\s*=\s*0\s*\(cac-drs\s*0\)/,
    /19\.\s*cac score\s*1-99\s*\(cac-drs\s*1\)/,
    /20\.\s*cac score\s*100-299\s*\(cac-drs\s*2\)/,
    /21\.\s*cac score\s*>=\s*300\s*\(cac-drs\s*3\)/,
  ]) assert.match(text, row, `${source.label} Tab2 lacks ${row}`);
  const canonical = canonicalJsonBytes(collection);
  assertCanonicalDigest(canonical, source, verifyDigest);
  return { collection, document, table, canonical, canonicalSha256: sha256(canonical) };
}

function validateMaronBioc({ bytes, source = BIOC_SPECS.maron, verifyDigest = true } = {}) {
  assertPinnedDigest(bytes, source, verifyDigest);
  const collection = parseBiocCollection(bytes, source.label);
  const document = assertSourceIdentity(collection, source, { date: "20260202", documentId: "PMC11462328", license: "CC BY-NC-ND", title: MARON_TITLE, pmcId: "PMC11462328", doi: MARON_DOI });
  const titlePassage = document.passages.find(({ infons }) => infons?.section_type === "TITLE" && infons?.type === "front");
  assert.equal(titlePassage.infons?.subtitle, "A Proposal and Call to Action", `${source.label} subtitle identity drifted`);
  const { caption, table, text } = tablePassage(document, "tbl1", source);
  assert.equal(caption.text, "Proposed Coronary Artery Calcium Staging Guide to Therapy");
  for (const row of [
    /0\s*cac score:\s*0\s*no calcified plaque\s*visual score:\s*cac absent/,
    /1\s*cac score:\s*1-99 and\s*<\s*75th percentile for age and sex\s*mild atherosclerotic burden/,
    /2\s*cac score:\s*100-299 or\s*>=\s*75th percentile for age and sex\s*moderate atherosclerotic burden/,
    /3\s*cac score:\s*300-999\s*severe atherosclerotic burden/,
    /4\s*cac score:\s*>=\s*1,000\s*extensive atherosclerotic burden/,
  ]) assert.match(text, row, `${source.label} tbl1 lacks ${row}`);
  const canonical = canonicalJsonBytes(collection);
  assertCanonicalDigest(canonical, source, verifyDigest);
  return { collection, document, table, canonical, canonicalSha256: sha256(canonical) };
}

async function fetchBioc(source, validate, { fetchImpl = globalThis.fetch, sleepImpl = wait, verifyDigest = true } = {}) {
  return retrieveWithRetries({
    url: source.url,
    label: source.label,
    userAgent: source.userAgent,
    mediaType: source.mediaType,
    maxBytes: BIOC_MAX_BYTES,
    fetchImpl,
    sleepImpl,
    validate: ({ bytes }) => validate({ bytes, source, verifyDigest }),
  });
}
const fetchAucBiocJson = (options = {}) => fetchBioc(BIOC_SPECS.auc, validateAucBioc, options);
const fetchMaronBiocJson = (options = {}) => fetchBioc(BIOC_SPECS.maron, validateMaronBioc, options);

function mockResponse({ body, status = 200, url, contentType, contentLength = String(Buffer.byteLength(body)), redirected = false, chunkSize = 16_384, streamStats = null, cancelError = null }) {
  const bytes = Buffer.from(body);
  const headers = new Headers({ "content-type": contentType });
  if (contentLength !== null) headers.set("content-length", contentLength);
  let offset = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      const end = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(Uint8Array.from(bytes.subarray(offset, end)));
      offset = end;
      if (streamStats) streamStats.enqueuedBytes = offset;
    },
    cancel(reason) {
      if (streamStats) { streamStats.cancelCount = (streamStats.cancelCount || 0) + 1; streamStats.cancelReason = reason; }
      if (cancelError) throw cancelError;
    },
  });
  return { status, url, redirected, headers, body: stream, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
}

function sequenceFetch(responses, calls = []) {
  let index = 0;
  return async (url, options) => {
    calls.push({ url, options });
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return response;
  };
}

const MINIMAL_AUC_BIOC_JSON = JSON.stringify([{ source: "PMC", date: "20240128", key: "pmc.key", infons: {}, documents: [{ id: "10585920", infons: { license: "CC BY" }, passages: [
  { offset: 0, infons: { "article-id_doi": AUC_DOI, "article-id_pmc": "10585920", section_type: "TITLE", type: "front" }, text: AUC_TITLE },
  { offset: 1, infons: { file: "Tab2.xml", id: "Tab2", section_type: "TABLE", type: "table_caption" }, text: "Symptomatic Patients Without Known CCD and With Prior Testing*" },
  { offset: 2, infons: { file: "Tab2.xml", id: "Tab2", section_type: "TABLE", type: "table", xml: '<?xml version="1.0" encoding="UTF-8"?><table><tr><td>18. CAC score = 0 (CAC-DRS 0)</td></tr></table>' }, text: "18. CAC score = 0 (CAC-DRS 0)\t19. CAC score 1-99 (CAC-DRS 1)\t20. CAC score 100-299 (CAC-DRS 2)\t21. CAC score >= 300 (CAC-DRS 3)" },
] }] }]);
const MINIMAL_MARON_BIOC_JSON = JSON.stringify([{ source: "PMC", date: "20260202", key: "pmc.key", infons: {}, documents: [{ id: "PMC11462328", infons: { license: "CC BY-NC-ND" }, passages: [
  { offset: 0, infons: { "article-id_doi": MARON_DOI, "article-id_pmc": "PMC11462328", subtitle: "A Proposal and Call to Action", section_type: "TITLE", type: "front" }, text: MARON_TITLE },
  { offset: 1, infons: { file: "tbl1.xml", id: "tbl1", section_type: "TABLE", type: "table_caption" }, text: "Proposed Coronary Artery Calcium Staging Guide to Therapy" },
  { offset: 2, infons: { file: "tbl1.xml", id: "tbl1", section_type: "TABLE", type: "table", xml: '<?xml version="1.0" encoding="UTF-8"?><table><tr><td>Stage</td></tr></table>' }, text: "Stage\t0\tCAC Score: 0\tNo calcified plaque\tVisual score: CAC absent\t1\tCAC Score: 1-99 and <75th percentile for age and sex\tMild atherosclerotic burden\t2\tCAC Score: 100-299 or >=75th percentile for age and sex\tModerate atherosclerotic burden\t3\tCAC Score: 300-999\tSevere atherosclerotic burden\t4\tCAC Score: >=1,000\tExtensive atherosclerotic burden" },
] }] }]);

for (const [id, score, expected] of boundaryVectors) {
  const result = CACMesa.compute({ score, age: "55", sex: "male", race: "white", vessel_count: "not_reported" });
  assert.equal(result.Error, undefined, `${id}: boundary input must be accepted`);
  assert.equal(result["CAC-DRS"], expected, `${id}: 2023 multi-society AUC Table 1.2`);
}
assert.equal(CACMesa.guidelineVersion, "MESA reference values + CAC-DRS (SCCT 2018; AUC 2023 boundary)", "public metadata must disclose the authority used to resolve exact 300");
for (const [id, score, expectedStage, expectedBurden] of maronStageVectors) {
  const result = CACMesa.compute({ score, age: "55", sex: "male", race: "white", vessel_count: "not_reported" });
  assert.equal(result.Error, undefined, `${id}: staging input must be accepted`);
  assert.equal(result["Maron CAC Stage"], expectedStage, `${id}: stage boundary`);
  assert.equal(result["CAC Staging Burden"], expectedBurden, `${id}: burden label`);
}

const registry = JSON.parse(readFileSync("ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json", "utf8"));
const record = registry.records.find(({ calculator_id }) => calculator_id === "cac-mesa");
assert.ok(record, "CAC/MESA registry row is required");
assert.ok(record.sources.some(({ url, role }) => url === AUC_PUBLICATION_URL && role === "primary-publication"), "CAC/MESA registry must name the multi-society AUC publication");
const claim = record.implementation_evidence?.claims?.find(({ id }) => id === "multisociety-auc-cac-drs-bands");
assert.ok(claim, "CAC/MESA registry must bind the AUC boundary to executable vectors");
assert.equal(claim.source_url, AUC_PUBLICATION_URL);
assert.match(claim.source_locator, /Table 1\.2.*18.*21/i);
assert.deepEqual([...claim.vector_ids].sort(), boundaryVectors.map(([id]) => id).sort());
const maronClaim = record.implementation_evidence?.claims?.find(({ id }) => id === "maron-percentile-adjusted-staging");
assert.ok(maronClaim, "CAC/MESA registry must bind the proposed Maron staging table");
assert.equal(maronClaim.source_url, MARON_PUBLICATION_URL);
assert.match(maronClaim.source_locator, /proposed.*staging.*table.*stages 0 through 4/i);

const sourceAudit = record.implementation_evidence?.source_audit;
assert.ok(sourceAudit, "CAC/MESA registry must pin the live source audit");
assert.equal(sourceAudit.schema, "radulator-live-source-audit/v1");
assert.equal(sourceAudit.command, "npm run test:cac-drs-source");
assert.equal(sourceAudit.trusted_exact_head_check, "Hermes Release Control Tests");
assert.deepEqual(sourceAudit.source_urls, Object.values(BIOC_SPECS).map(({ url }) => url));
assert.deepEqual(sourceAudit.artifacts, Object.values(BIOC_SPECS).map((source) => ({
  id: source.id, url: source.url, host: source.host, path: source.path, media_type: source.mediaType,
  raw_source_bytes: source.rawBytes, raw_source_sha256: source.rawSha256,
  canonical_source_bytes: source.canonicalBytes, canonical_source_sha256: source.canonicalSha256,
})));
assert.deepEqual(sourceAudit.vector_ids, [...boundaryVectors.map(([id]) => id), ...maronStageVectors.map(([id]) => id)]);
assert.equal(sourceAudit.source_bytes_committed, false);

for (const source of Object.values(BIOC_SPECS)) {
  const parsed = new URL(source.url);
  assert.equal(source.url, `https://${source.host}${source.path}`);
  assert.equal(parsed.hostname, source.host);
  assert.equal(parsed.pathname, source.path);
  assert.equal(parsed.search, "");
  assert.equal(parsed.hash, "");
  assert.equal(source.mediaType, "application/json");
}

const aucBioc = await fetchAucBiocJson();
assert.equal(aucBioc.document.id, "10585920");
assert.equal(aucBioc.canonical.length, EXPECTED_BIOC_CANONICAL_BYTES);
assert.equal(aucBioc.canonicalSha256, EXPECTED_BIOC_CANONICAL_SHA256);
const maronBioc = await fetchMaronBiocJson();
assert.equal(maronBioc.document.id, "PMC11462328");
assert.equal(maronBioc.canonical.length, EXPECTED_MARON_BIOC_CANONICAL_BYTES);
assert.equal(maronBioc.canonicalSha256, EXPECTED_MARON_BIOC_CANONICAL_SHA256);

for (const source of Object.values(BIOC_SPECS)) {
  const fixture = source.id === BIOC_SPECS.auc.id ? MINIMAL_AUC_BIOC_JSON : MINIMAL_MARON_BIOC_JSON;
  const fetchSource = source.id === BIOC_SPECS.auc.id ? fetchAucBiocJson : fetchMaronBiocJson;
  for (const [failure, responseUrl, contentType] of [["wrong final URL", `${source.url}?unexpected=1`, source.mediaType], ["wrong media type", source.url, "application/octet-stream"]]) {
    const streamStats = { enqueuedBytes: 0, cancelCount: 0 };
    await assert.rejects(fetchSource({ fetchImpl: sequenceFetch([mockResponse({ body: fixture, url: responseUrl, contentType, streamStats })]), sleepImpl: noWait, verifyDigest: false }), /retrieval failed after 3 attempts/, `${source.label} ${failure} must fail closed`);
    assert.ok(streamStats.cancelCount >= 1, `${source.label} ${failure} must cancel its unread response body: ${JSON.stringify(streamStats)}`);
  }
}

for (const source of Object.values(BIOC_SPECS)) {
  const fixture = source.id === BIOC_SPECS.auc.id ? MINIMAL_AUC_BIOC_JSON : MINIMAL_MARON_BIOC_JSON;
  const fetchSource = source.id === BIOC_SPECS.auc.id ? fetchAucBiocJson : fetchMaronBiocJson;
  const followedRedirectCalls = [];
  const redirectCleanupStats = { cancelCount: 0 };
  const redirectFetch = async (url, options) => {
    followedRedirectCalls.push({ url, options });
    return mockResponse({ body: fixture, url: source.url, contentType: source.mediaType, redirected: true, streamStats: redirectCleanupStats, cancelError: new Error("redirect body cleanup failed") });
  };
  await assert.rejects(fetchSource({ fetchImpl: redirectFetch, sleepImpl: noWait, verifyDigest: false }), /retrieval failed after 3 attempts \(redirected response\)/, `${source.label} followed redirect must preserve the redirect failure when body cleanup rejects`);
  assert.equal(followedRedirectCalls.length, 3);
  assert.ok(redirectCleanupStats.cancelCount >= 1, `${source.label} must attempt cleanup before retrying a redirect response`);
  assert.ok(followedRedirectCalls.every(({ options }) => options.redirect === "error"), `${source.label} fetches must disable redirect following`);
}

const malformedAucCalls = [];
await assert.rejects(fetchAucBiocJson({ fetchImpl: sequenceFetch([mockResponse({ body: MINIMAL_AUC_BIOC_JSON.replace(AUC_DOI, "10.0000/wrong"), url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE })], malformedAucCalls), sleepImpl: noWait, verifyDigest: false }), /retrieval failed after 3 attempts/, "malformed AUC BioC identity must consume exactly three attempts");
assert.equal(malformedAucCalls.length, 3);

for (const [label, status] of [["raw redirect", 302], ["non-retryable client error", 404]]) {
  const nonRetryableCalls = [];
  const cleanupStats = { cancelCount: 0 };
  const statusFetch = async (url, options) => {
    nonRetryableCalls.push({ url, options });
    return mockResponse({ body: MINIMAL_AUC_BIOC_JSON, status, url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE, streamStats: cleanupStats, cancelError: new Error("status body cleanup failed") });
  };
  await assert.rejects(fetchAucBiocJson({ fetchImpl: statusFetch, sleepImpl: noWait, verifyDigest: false }), new RegExp(`retrieval failed after 1 attempt \\(HTTP ${status}\\)`), `${label} must preserve the HTTP failure when body cleanup rejects`);
  assert.equal(nonRetryableCalls.length, 1, `${label} must not consume retry attempts`);
  assert.equal(cleanupStats.cancelCount, 1, `${label} must attempt cleanup once before stopping`);
}

for (const source of Object.values(BIOC_SPECS)) {
  const fetchSource = source.id === BIOC_SPECS.auc.id ? fetchAucBiocJson : fetchMaronBiocJson;
  const oversized = "x".repeat(BIOC_MAX_BYTES + 100_000);
  for (const [lengthLabel, contentLength] of [["absent", null], ["understated", String(BIOC_MAX_BYTES)]]) {
    const streamStats = { enqueuedBytes: 0, cancelCount: 0 };
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return mockResponse({ body: oversized, url: source.url, contentType: source.mediaType, contentLength, chunkSize: 1_024, streamStats });
    };
    await assert.rejects(fetchSource({ fetchImpl, sleepImpl: noWait, verifyDigest: false }), /retrieval failed after 3 attempts/, `${source.label} ${lengthLabel} oversized stream must fail closed`);
    assert.equal(calls, 3);
    assert.ok(streamStats.cancelCount >= 1, `${source.label} ${lengthLabel} oversized stream must be cancelled promptly: ${JSON.stringify(streamStats)}`);
    assert.ok(streamStats.enqueuedBytes < Buffer.byteLength(oversized), `${source.label} oversized stream must cut off before full body`);
  }
}

for (const [name, response] of [
  ["port", mockResponse({ body: MINIMAL_AUC_BIOC_JSON, url: "https://www.ncbi.nlm.nih.gov:8443/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC10585920/unicode", contentType: AUC_BIOC_MEDIA_TYPE })],
  ["media", mockResponse({ body: MINIMAL_AUC_BIOC_JSON, url: AUC_BIOC_JSON_URL, contentType: "text/plain" })],
  ["identity", mockResponse({ body: MINIMAL_AUC_BIOC_JSON.replace(AUC_DOI, "10.0000/wrong"), url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE })],
  ["206", mockResponse({ body: MINIMAL_AUC_BIOC_JSON, status: 206, url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE })],
  ["malformed-200", mockResponse({ body: "{not-json", url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE })],
  ["wrong-table", mockResponse({ body: MINIMAL_AUC_BIOC_JSON.replaceAll('"id":"Tab2"', '"id":"Tab1"'), url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE })],
]) {
  const attemptsMade = response.status >= 300 && response.status < 500 && response.status !== 429 ? 1 : 3;
  await assert.rejects(fetchAucBiocJson({ fetchImpl: sequenceFetch([response]), sleepImpl: noWait, verifyDigest: false }), new RegExp(`retrieval failed after ${attemptsMade} attempt${attemptsMade === 1 ? "" : "s"}`), `AUC BioC negative case must fail closed: ${name}`);
}

for (const [name, response] of [
  ["port", mockResponse({ body: MINIMAL_MARON_BIOC_JSON, url: "https://www.ncbi.nlm.nih.gov:8443/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC11462328/unicode", contentType: MARON_BIOC_MEDIA_TYPE })],
  ["media", mockResponse({ body: MINIMAL_MARON_BIOC_JSON, url: MARON_BIOC_JSON_URL, contentType: "text/plain" })],
  ["identity", mockResponse({ body: MINIMAL_MARON_BIOC_JSON.replace(MARON_DOI, "10.0000/wrong"), url: MARON_BIOC_JSON_URL, contentType: MARON_BIOC_MEDIA_TYPE })],
  ["206", mockResponse({ body: MINIMAL_MARON_BIOC_JSON, status: 206, url: MARON_BIOC_JSON_URL, contentType: MARON_BIOC_MEDIA_TYPE })],
  ["malformed-200", mockResponse({ body: "{not-json", url: MARON_BIOC_JSON_URL, contentType: MARON_BIOC_MEDIA_TYPE })],
  ["wrong-table", mockResponse({ body: MINIMAL_MARON_BIOC_JSON.replaceAll('"id":"tbl1"', '"id":"wrong"'), url: MARON_BIOC_JSON_URL, contentType: MARON_BIOC_MEDIA_TYPE })],
]) {
  const attemptsMade = response.status >= 300 && response.status < 500 && response.status !== 429 ? 1 : 3;
  await assert.rejects(fetchMaronBiocJson({ fetchImpl: sequenceFetch([response]), sleepImpl: noWait, verifyDigest: false }), new RegExp(`retrieval failed after ${attemptsMade} attempt${attemptsMade === 1 ? "" : "s"}`), `Maron BioC negative case must fail closed: ${name}`);
}

console.log(`CAC-DRS and Maron boundaries verified from exact AUC and Maron NCBI PMC BioC JSON artifacts (AUC canonical SHA256 ${EXPECTED_BIOC_CANONICAL_SHA256}; Maron canonical SHA256 ${EXPECTED_MARON_BIOC_CANONICAL_SHA256}).`);
