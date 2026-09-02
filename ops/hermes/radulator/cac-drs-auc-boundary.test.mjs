#!/usr/bin/env node

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CACMesa } from "../../../src/components/calculators/CACMesa.jsx";

const AUC_SOURCE_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC10585920/";
const AUC_SOURCE_HOST = "pmc.ncbi.nlm.nih.gov";
const AUC_DOI = "10.1186/s12968-023-00958-5";
const AUC_TITLE =
  "ACC/AHA/ASE/ASNC/ASPC/HFSA/HRS/SCAI/SCCT/SCMR/STS 2023 Multimodality Appropriate Use Criteria for the Detection and Risk Assessment of Chronic Coronary Disease";
const MARON_SOURCE_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC11462328/";
const MARON_SOURCE_HOST = "pmc.ncbi.nlm.nih.gov";
const MARON_DOI = "10.1016/j.jacadv.2024.101287";
const MARON_TITLE =
  "Coronary Artery Calcium Staging to Guide Preventive Interventions: A Proposal and Call to Action";
const AUC_BIOC_JSON_URL =
  "https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC10585920/unicode";
const AUC_BIOC_HOST = "www.ncbi.nlm.nih.gov";
const AUC_BIOC_PATH =
  "/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC10585920/unicode";
const AUC_BIOC_MEDIA_TYPE = "application/json";
const EXPECTED_BIOC_RAW_BYTES = 216_779;
const EXPECTED_BIOC_RAW_SHA256 =
  "e13e2353c894a67bd9092255f89a682ef43ce638aa26873a54e8ef4ae63d351a";
const EXPECTED_BIOC_CANONICAL_BYTES = 207_915;
const EXPECTED_BIOC_CANONICAL_SHA256 =
  "3870526ebbef77ece57d8ea89f0d32d2a63c2fd47013aa425ced7ceaa0c9d3f2";
const RETRY_ATTEMPTS = 3;
const HTML_MAX_BYTES = 2_000_000;
const BIOC_MAX_BYTES = 1_000_000;

const boundaryVectors = [
  ["cac-drs-score-299", "299", "A2 / N not reported"],
  ["cac-drs-score-300", "300", "A3 / N not reported"],
  ["cac-drs-score-301", "301", "A3 / N not reported"],
];
const maronStageVectors = [
  ["maron-stage-0", "0", "0", "No calcified atherosclerotic burden"],
  ["maron-stage-1", "1", "1", "Mild calcified atherosclerotic burden"],
  [
    "maron-stage-2-percentile-equality",
    "68",
    "2",
    "Moderate calcified atherosclerotic burden",
  ],
  [
    "maron-stage-2-lower",
    "100",
    "2",
    "Moderate calcified atherosclerotic burden",
  ],
  [
    "maron-stage-2-upper",
    "299",
    "2",
    "Moderate calcified atherosclerotic burden",
  ],
  [
    "maron-stage-3-lower",
    "300",
    "3",
    "Severe calcified atherosclerotic burden",
  ],
  [
    "maron-stage-3-upper",
    "999",
    "3",
    "Severe calcified atherosclerotic burden",
  ],
  [
    "maron-stage-4-lower",
    "1000",
    "4",
    "Extensive calcified atherosclerotic burden",
  ],
];

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
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
  for (const component of [
    "protocol",
    "username",
    "password",
    "hostname",
    "port",
    "pathname",
    "search",
    "hash",
  ]) {
    if (actual[component] !== expected[component]) {
      fail(`${label} final URL ${component} is not exact`);
    }
  }
}

function assertMediaType(response, expectedMediaType, label) {
  const contentType = response.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== expectedMediaType) {
    fail(`${label} media type must be ${expectedMediaType}, got ${contentType || "missing"}`);
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
      const chunk = value instanceof ArrayBuffer
        ? Buffer.from(value)
        : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      chunks.push(chunk);
    }
  } catch (error) {
    await cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
}

async function retrieveWithRetries({
  url,
  label,
  userAgent,
  mediaType,
  maxBytes,
  validate,
  fetchImpl = globalThis.fetch,
  sleepImpl = wait,
}) {
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
        await response.body?.cancel();
      } else if (response.status !== 200) {
        lastFailure = `HTTP ${response.status}`;
        await response.body?.cancel();
        if (response.status !== 429 && response.status >= 300 && response.status < 500) {
          break;
        }
      } else {
        assertExactFinalUrl(response, url, label);
        assertMediaType(response, mediaType, label);
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
  const named = new Map([
    ["amp", "&"],
    ["apos", "'"],
    ["ge", ">="],
    ["gt", ">"],
    ["le", "<="],
    ["lt", "<"],
    ["nbsp", " "],
    ["quot", '"'],
    ["thinsp", " "],
  ]);
  return value
    .replace(/&#x([a-f0-9]+);/gi, (_, digits) =>
      String.fromCodePoint(Number.parseInt(digits, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&([a-z]+);/gi, (entity, name) => named.get(name.toLowerCase()) ?? entity);
}

function visibleText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
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

function metaContent(html, name, expectedValue, label) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)].map(([, key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    return attrs;
  });
  const matches = metas.filter((attrs) => attrs.name === name);
  if (matches.length !== 1 || matches[0].content !== expectedValue) {
    fail(`${label} must contain exactly one exact ${name} citation meta`);
  }
}

function sectionById(html, id, label) {
  const sections = [
    ...html.matchAll(
      new RegExp(`<section\\b[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/section>`, "gi"),
    ),
  ];
  if (sections.length !== 1) fail(`${label} must contain exactly one section id=${id}`);
  return sections[0][0];
}

function validateAucHtml(html) {
  metaContent(html, "citation_fulltext_html_url", AUC_SOURCE_URL, "AUC primary HTML");
  metaContent(html, "citation_doi", AUC_DOI, "AUC primary HTML");
  metaContent(html, "citation_title", AUC_TITLE, "AUC primary HTML");
  const table = sectionById(html, "Tab2", "AUC primary HTML");
  const text = visibleText(table);
  for (const row of [
    /cac score\s*=\s*0\s*\(cac-drs\s*0\)/,
    /cac score\s*1-99\s*\(cac-drs\s*1\)/,
    /cac score\s*100-299\s*\(cac-drs\s*2\)/,
    /cac score\s*>=\s*300\s*\(cac-drs\s*3\)/,
  ]) {
    if (!row.test(text)) fail(`AUC primary HTML Table 1.2 lacks ${row}`);
  }
  return { table, text };
}

function validateMaronHtml(html) {
  metaContent(html, "citation_fulltext_html_url", MARON_SOURCE_URL, "Maron primary HTML");
  metaContent(html, "citation_doi", MARON_DOI, "Maron primary HTML");
  metaContent(html, "citation_title", MARON_TITLE, "Maron primary HTML");
  const table = sectionById(html, "tbl1", "Maron primary HTML");
  const text = visibleText(table);
  for (const row of [
    /cac score:\s*0\s*•\s*no calcified plaque/,
    /cac score:\s*1-99 and\s*<\s*75th percentile/,
    /cac score:\s*100-299 or\s*>=\s*75th percentile/,
    /cac score:\s*300-999/,
    /cac score:\s*>=\s*1,000/,
  ]) {
    if (!row.test(text)) fail(`Maron primary HTML table lacks ${row}`);
  }
  return { table, text };
}

const HTML_SPECS = Object.freeze({
  auc: Object.freeze({
    label: "AUC primary HTML",
    url: AUC_SOURCE_URL,
    host: AUC_SOURCE_HOST,
    userAgent: "Radulator-CAC-DRS-primary-source-audit/1",
    validate: ({ bytes, response }) => {
      const html = bytes.toString("utf8");
      return { bytes, html, response, ...validateAucHtml(html) };
    },
  }),
  maron: Object.freeze({
    label: "Maron primary HTML",
    url: MARON_SOURCE_URL,
    host: MARON_SOURCE_HOST,
    userAgent: "Radulator-Maron-staging-primary-source-audit/1",
    validate: ({ bytes, response }) => {
      const html = bytes.toString("utf8");
      return { bytes, html, response, ...validateMaronHtml(html) };
    },
  }),
});

async function fetchPrimaryHtml(spec, { fetchImpl = globalThis.fetch, sleepImpl = wait } = {}) {
  const source = await retrieveWithRetries({
    url: spec.url,
    label: spec.label,
    userAgent: spec.userAgent,
    mediaType: "text/html",
    maxBytes: HTML_MAX_BYTES,
    validate: spec.validate,
    fetchImpl,
    sleepImpl,
  });
  assert.equal(new URL(spec.url).hostname, spec.host);
  return source;
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJsonValue(value[key])]),
    );
  }
  return value;
}

function canonicalJsonBytes(payload) {
  return Buffer.from(JSON.stringify(stableJsonValue(payload)), "utf8");
}

function validateAucBioc({ bytes, verifyDigest = true } = {}) {
  if (verifyDigest) {
    assert.equal(bytes.length, EXPECTED_BIOC_RAW_BYTES, "BioC raw byte length drifted");
    assert.equal(sha256(bytes), EXPECTED_BIOC_RAW_SHA256, "BioC raw SHA256 drifted");
  }
  let collection;
  try {
    collection = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail(`AUC BioC JSON is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
  assert.ok(Array.isArray(collection) && collection.length === 1, "AUC BioC collection identity is malformed");
  assert.equal(collection[0].source, "PMC", "AUC BioC source must be PMC");
  assert.equal(collection[0].date, "20240128", "AUC BioC source date drifted");
  assert.ok(Array.isArray(collection[0].documents) && collection[0].documents.length === 1);
  const document = collection[0].documents[0];
  assert.equal(document.id, "10585920", "AUC BioC document identity must be PMC10585920");
  assert.equal(document.infons?.license, "CC BY", "AUC BioC license identity drifted");
  assert.ok(Array.isArray(document.passages), "AUC BioC passages are malformed");
  const titlePassages = document.passages.filter(
    ({ infons }) => infons?.section_type === "TITLE" && infons?.type === "front",
  );
  assert.equal(titlePassages.length, 1, "AUC BioC title identity is not unique");
  const title = titlePassages[0];
  assert.equal(title.text, AUC_TITLE, "AUC BioC title drifted");
  assert.equal(title.infons["article-id_pmc"], "10585920", "AUC BioC PMCID drifted");
  assert.equal(title.infons["article-id_doi"], AUC_DOI, "AUC BioC DOI drifted");
  const tab2 = document.passages.filter(({ infons }) => infons?.id === "Tab2");
  const captions = tab2.filter(({ infons }) => infons?.type === "table_caption");
  const tables = tab2.filter(({ infons }) => infons?.type === "table");
  assert.equal(captions.length, 1, "AUC BioC Tab2 caption identity is not unique");
  assert.equal(tables.length, 1, "AUC BioC Tab2 table identity is not unique");
  assert.equal(captions[0].text, "Symptomatic Patients Without Known CCD and With Prior Testing*");
  const table = tables[0];
  assert.equal(table.infons.section_type, "TABLE");
  assert.match(table.infons.xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  const text = visibleText(table.text);
  for (const row of [
    /cac score\s*=\s*0\s*\(cac-drs\s*0\)/,
    /cac score\s*1-99\s*\(cac-drs\s*1\)/,
    /cac score\s*100-299\s*\(cac-drs\s*2\)/,
    /cac score\s*>=\s*300\s*\(cac-drs\s*3\)/,
  ]) {
    if (!row.test(text)) fail(`AUC BioC Tab2 lacks ${row}`);
  }
  const canonical = canonicalJsonBytes(collection);
  if (verifyDigest) {
    assert.equal(canonical.length, EXPECTED_BIOC_CANONICAL_BYTES, "BioC canonical byte length drifted");
    assert.equal(
      sha256(canonical),
      EXPECTED_BIOC_CANONICAL_SHA256,
      "BioC canonical SHA256 drifted",
    );
  }
  return { collection, document, table, canonical, canonicalSha256: sha256(canonical) };
}

async function fetchAucBiocJson({
  fetchImpl = globalThis.fetch,
  sleepImpl = wait,
  verifyDigest = true,
} = {}) {
  return retrieveWithRetries({
    url: AUC_BIOC_JSON_URL,
    label: "AUC NCBI PMC BioC JSON fallback",
    userAgent: "Radulator-CAC-DRS-NCBI-BioC-audit/1",
    mediaType: AUC_BIOC_MEDIA_TYPE,
    maxBytes: BIOC_MAX_BYTES,
    fetchImpl,
    sleepImpl,
    validate: ({ bytes }) => validateAucBioc({ bytes, verifyDigest }),
  });
}

async function fetchAucEvidence({
  htmlFetch = globalThis.fetch,
  biocFetch = globalThis.fetch,
  sleepImpl = wait,
  verifyBioCDigest = true,
} = {}) {
  let primaryFailure;
  try {
    return { kind: "primary-html", source: await fetchPrimaryHtml(HTML_SPECS.auc, { fetchImpl: htmlFetch, sleepImpl }) };
  } catch (error) {
    primaryFailure = error;
  }
  try {
    return {
      kind: "ncbi-pmc-bioc-json",
      source: await fetchAucBiocJson({
        fetchImpl: biocFetch,
        sleepImpl,
        verifyDigest: verifyBioCDigest,
      }),
    };
  } catch (error) {
    const fallbackFailure = error instanceof Error ? error.message : String(error);
    throw new Error(
      `AUC primary HTML and exact NCBI PMC BioC JSON fallback failed: ${
        primaryFailure instanceof Error ? primaryFailure.message : String(primaryFailure)
      }; ${fallbackFailure}`,
    );
  }
}

function mockResponse({
  body,
  status = 200,
  url,
  contentType,
  contentLength = String(Buffer.byteLength(body)),
  redirected = false,
  chunkSize = 16_384,
  streamStats = null,
}) {
  const bytes = Buffer.from(body);
  const headers = new Headers({ "content-type": contentType });
  if (contentLength !== null) headers.set("content-length", contentLength);
  let offset = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(Uint8Array.from(bytes.subarray(offset, end)));
      offset = end;
      if (streamStats) streamStats.enqueuedBytes = offset;
    },
    cancel(reason) {
      if (streamStats) {
        streamStats.cancelCount = (streamStats.cancelCount || 0) + 1;
        streamStats.cancelReason = reason;
      }
    },
  });
  return {
    status,
    url,
    redirected,
    headers,
    body: stream,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  };
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

const MINIMAL_AUC_HTML = `<!doctype html><html><head>
<meta name="citation_fulltext_html_url" content="${AUC_SOURCE_URL}">
<meta name="citation_doi" content="${AUC_DOI}">
<meta name="citation_title" content="${AUC_TITLE}">
</head><body><section id="Tab2"><h3>Table 1.2.</h3>
CAC score = 0 (CAC-DRS 0); CAC score 1-99 (CAC-DRS 1); CAC score 100-299 (CAC-DRS 2); CAC score >= 300 (CAC-DRS 3)
</section></body></html>`;
const MINIMAL_BIOC_JSON = JSON.stringify([
  {
    source: "PMC",
    date: "20240128",
    key: "pmc.key",
    infons: {},
    documents: [
      {
        id: "10585920",
        infons: { license: "CC BY" },
        passages: [
          {
            offset: 0,
            infons: {
              "article-id_doi": AUC_DOI,
              "article-id_pmc": "10585920",
              section_type: "TITLE",
              type: "front",
            },
            text: AUC_TITLE,
          },
          {
            offset: 1,
            infons: { file: "Tab2.xml", id: "Tab2", section_type: "TABLE", type: "table_caption" },
            text: "Symptomatic Patients Without Known CCD and With Prior Testing*",
          },
          {
            offset: 2,
            infons: {
              file: "Tab2.xml",
              id: "Tab2",
              section_type: "TABLE",
              type: "table",
              xml: '<?xml version="1.0" encoding="UTF-8"?><table><tr><td>CAC score = 0 (CAC-DRS 0)</td><td>CAC score 1-99 (CAC-DRS 1)</td><td>CAC score 100-299 (CAC-DRS 2)</td><td>CAC score >= 300 (CAC-DRS 3)</td></tr></table>',
            },
            text: "CAC score = 0 (CAC-DRS 0)\tCAC score 1-99 (CAC-DRS 1)\tCAC score 100-299 (CAC-DRS 2)\tCAC score >= 300 (CAC-DRS 3)",
          },
        ],
      },
    ],
  },
]);

for (const [id, score, expected] of boundaryVectors) {
  const result = CACMesa.compute({
    score,
    age: "55",
    sex: "male",
    race: "white",
    vessel_count: "not_reported",
  });
  assert.equal(result.Error, undefined, `${id}: boundary input must be accepted`);
  assert.equal(result["CAC-DRS"], expected, `${id}: 2023 multi-society AUC Table 1.2`);
}
assert.equal(
  CACMesa.guidelineVersion,
  "MESA reference values + CAC-DRS (SCCT 2018; AUC 2023 boundary)",
  "public metadata must disclose the authority used to resolve exact 300",
);

const registry = JSON.parse(
  readFileSync(
    "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json",
    "utf8",
  ),
);
const record = registry.records.find(({ calculator_id }) => calculator_id === "cac-mesa");
assert.ok(record, "CAC/MESA registry row is required");
assert.ok(
  record.sources.some(
    ({ url, role }) => url === AUC_SOURCE_URL && role === "primary-publication",
  ),
  "CAC/MESA registry must name the accessible primary multi-society AUC",
);
const claim = record.implementation_evidence?.claims?.find(
  ({ id }) => id === "multisociety-auc-cac-drs-bands",
);
assert.ok(claim, "CAC/MESA registry must bind the AUC boundary to executable vectors");
assert.equal(claim.source_url, AUC_SOURCE_URL);
assert.match(claim.source_locator, /Table 1\.2.*18.*21/i);
assert.deepEqual(
  [...claim.vector_ids].sort(),
  boundaryVectors.map(([id]) => id).sort(),
);

const aucHtml = await fetchPrimaryHtml(HTML_SPECS.auc);
assert.equal(aucHtml.response.status, 200);
assertExactFinalUrl(aucHtml.response, AUC_SOURCE_URL, "AUC primary HTML");
assertMediaType(aucHtml.response, "text/html", "AUC primary HTML");
assert.equal(aucHtml.html.includes(`citation_doi" content="${AUC_DOI}`), true);

const aucEvidence = await fetchAucEvidence();
assert.equal(aucEvidence.kind, "primary-html", "valid primary HTML must suppress fallback");

for (const [id, score, expectedStage, expectedBurden] of maronStageVectors) {
  const result = CACMesa.compute({
    score,
    age: "55",
    sex: "male",
    race: "white",
    vessel_count: "not_reported",
  });
  assert.equal(result.Error, undefined, `${id}: staging input must be accepted`);
  assert.equal(result["Maron CAC Stage"], expectedStage, `${id}: stage boundary`);
  assert.equal(result["CAC Staging Burden"], expectedBurden, `${id}: burden label`);
}

const maronClaim = record.implementation_evidence?.claims?.find(
  ({ id }) => id === "maron-percentile-adjusted-staging",
);
assert.ok(maronClaim, "CAC/MESA registry must bind the proposed Maron staging table");
assert.equal(maronClaim.source_url, MARON_SOURCE_URL);
assert.match(maronClaim.source_locator, /proposed.*staging.*table.*stages 0 through 4/i);

const maronHtml = await fetchPrimaryHtml(HTML_SPECS.maron);
assert.equal(maronHtml.response.status, 200);
assertExactFinalUrl(maronHtml.response, MARON_SOURCE_URL, "Maron primary HTML");
assertMediaType(maronHtml.response, "text/html", "Maron primary HTML");

const aucBioc = await fetchAucBiocJson();
assert.equal(aucBioc.document.id, "10585920");
assert.equal(aucBioc.document.passages.find(({ infons }) => infons?.id === "Tab2").infons.id, "Tab2");
assert.equal(aucBioc.canonical.length, EXPECTED_BIOC_CANONICAL_BYTES);
assert.equal(aucBioc.canonicalSha256, EXPECTED_BIOC_CANONICAL_SHA256);

const primaryFailureCalls = [];
const malformedPrimaryResponse = mockResponse({
  body: "<html><body>gateway placeholder</body></html>",
  url: AUC_SOURCE_URL,
  contentType: "text/html; charset=utf-8",
});
await assert.rejects(
  fetchPrimaryHtml(HTML_SPECS.auc, {
    fetchImpl: sequenceFetch([malformedPrimaryResponse], primaryFailureCalls),
    sleepImpl: noWait,
  }),
  /retrieval failed after 3 attempts/,
  "malformed HTTP 200 HTML must retry within the content boundary",
);
assert.equal(primaryFailureCalls.length, 3, "malformed HTTP 200 HTML must consume exactly three attempts");

const fallbackPrimaryCalls = [];
const fallbackBiocCalls = [];
const fallbackEvidence = await fetchAucEvidence({
  htmlFetch: sequenceFetch([malformedPrimaryResponse], fallbackPrimaryCalls),
  biocFetch: sequenceFetch(
    [
      mockResponse({
        body: MINIMAL_BIOC_JSON,
        url: AUC_BIOC_JSON_URL,
        contentType: AUC_BIOC_MEDIA_TYPE,
      }),
    ],
    fallbackBiocCalls,
  ),
  sleepImpl: noWait,
  verifyBioCDigest: false,
});
assert.equal(fallbackEvidence.kind, "ncbi-pmc-bioc-json");
assert.equal(fallbackEvidence.source.document.id, "10585920");
assert.equal(fallbackPrimaryCalls.length, 3);
assert.equal(fallbackBiocCalls.length, 1, "fallback must use only the exact NCBI PMC BioC URL");
assert.equal(fallbackBiocCalls[0].url, AUC_BIOC_JSON_URL);

const followedRedirectCalls = [];
const followedRedirectResponse = mockResponse({
  body: MINIMAL_AUC_HTML,
  url: AUC_SOURCE_URL,
  contentType: "text/html",
  redirected: true,
});
await assert.rejects(
  fetchPrimaryHtml(HTML_SPECS.auc, {
    fetchImpl: async (url, options) => {
      followedRedirectCalls.push({ url, options });
      return followedRedirectResponse;
    },
    sleepImpl: noWait,
  }),
  /retrieval failed after 3 attempts/,
  "a followed redirect with an otherwise valid final response must fail closed",
);
assert.equal(followedRedirectCalls.length, 3);
assert.ok(
  followedRedirectCalls.every(({ options }) => options.redirect === "error"),
  "all source fetches must disable redirect following",
);

for (const [label, status] of [["raw redirect", 302], ["non-retryable client error", 404]]) {
  const nonRetryableCalls = [];
  await assert.rejects(
    fetchPrimaryHtml(HTML_SPECS.auc, {
      fetchImpl: sequenceFetch([
        mockResponse({ body: "", status, url: AUC_SOURCE_URL, contentType: "text/html" }),
      ], nonRetryableCalls),
      sleepImpl: noWait,
    }),
    new RegExp(`retrieval failed after 1 attempt \\(HTTP ${status}\\)`),
    `${label} must report the one request actually made`,
  );
  assert.equal(nonRetryableCalls.length, 1, `${label} must not consume retry attempts`);
}

const boundedCases = [
  {
    label: "HTML",
    size: HTML_MAX_BYTES,
    contentType: "text/html",
    url: AUC_SOURCE_URL,
    retrieve: (fetchImpl) => fetchPrimaryHtml(HTML_SPECS.auc, { fetchImpl, sleepImpl: noWait }),
  },
  {
    label: "BioC",
    size: BIOC_MAX_BYTES,
    contentType: AUC_BIOC_MEDIA_TYPE,
    url: AUC_BIOC_JSON_URL,
    retrieve: (fetchImpl) => fetchAucBiocJson({ fetchImpl, sleepImpl: noWait, verifyDigest: false }),
  },
];
for (const { label, size, contentType, url, retrieve: retrieveSource } of boundedCases) {
  const oversized = "x".repeat(size + 100_000);
  for (const [lengthLabel, contentLength] of [["absent", null], ["understated", String(size)]]) {
    const streamStats = { enqueuedBytes: 0, cancelCount: 0 };
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return mockResponse({
        body: oversized,
        url,
        contentType,
        contentLength,
        chunkSize: 1_024,
        streamStats,
      });
    };
    const retrieve = retrieveSource(fetchImpl);
    await assert.rejects(
      retrieve,
      /retrieval failed after 3 attempts/,
      `${label} ${lengthLabel} Content-Length oversized stream must fail closed`,
    );
    assert.equal(calls, 3);
    assert.ok(streamStats.cancelCount >= 1, `${label} ${lengthLabel} oversized stream must be cancelled promptly: ${JSON.stringify(streamStats)}`);
    assert.ok(streamStats.enqueuedBytes < Buffer.byteLength(oversized), `${label} oversized stream must cut off before full body`);
  }
}

const primaryNegativeCases = [
  ["redirect", mockResponse({ body: "", status: 302, url: AUC_SOURCE_URL, contentType: "text/html" })],
  [
    "port",
    mockResponse({ body: MINIMAL_AUC_HTML, url: "https://pmc.ncbi.nlm.nih.gov:8443/articles/PMC10585920/", contentType: "text/html" }),
  ],
  ["media", mockResponse({ body: MINIMAL_AUC_HTML, url: AUC_SOURCE_URL, contentType: "application/json" })],
  ["identity", mockResponse({ body: MINIMAL_AUC_HTML.replace(AUC_DOI, "10.0000/wrong"), url: AUC_SOURCE_URL, contentType: "text/html" })],
  ["206", mockResponse({ body: MINIMAL_AUC_HTML, status: 206, url: AUC_SOURCE_URL, contentType: "text/html" })],
  ["wrong-table", mockResponse({ body: MINIMAL_AUC_HTML.replace('id="Tab2"', 'id="Tab1"'), url: AUC_SOURCE_URL, contentType: "text/html" })],
];
for (const [name, response] of primaryNegativeCases) {
  const attemptsMade = response.status >= 300 && response.status < 500 && response.status !== 429 ? 1 : 3;
  await assert.rejects(
    fetchPrimaryHtml(HTML_SPECS.auc, {
      fetchImpl: sequenceFetch([response]),
      sleepImpl: noWait,
    }),
    new RegExp(`retrieval failed after ${attemptsMade} attempt${attemptsMade === 1 ? "" : "s"}`),
    `primary negative case must fail closed: ${name}`,
  );
}

const biocNegativeCases = [
  ["redirect", mockResponse({ body: "", status: 302, url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE })],
  [
    "port",
    mockResponse({ body: MINIMAL_BIOC_JSON, url: "https://www.ncbi.nlm.nih.gov:8443/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC10585920/unicode", contentType: AUC_BIOC_MEDIA_TYPE }),
  ],
  ["media", mockResponse({ body: MINIMAL_BIOC_JSON, url: AUC_BIOC_JSON_URL, contentType: "text/plain" })],
  ["identity", mockResponse({ body: MINIMAL_BIOC_JSON.replace(AUC_DOI, "10.0000/wrong"), url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE })],
  ["206", mockResponse({ body: MINIMAL_BIOC_JSON, status: 206, url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE })],
  ["malformed-200", mockResponse({ body: "{not-json", url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE })],
  ["wrong-table", mockResponse({ body: MINIMAL_BIOC_JSON.replaceAll('"id":"Tab2"', '"id":"Tab1"'), url: AUC_BIOC_JSON_URL, contentType: AUC_BIOC_MEDIA_TYPE })],
];
for (const [name, response] of biocNegativeCases) {
  const attemptsMade = response.status >= 300 && response.status < 500 && response.status !== 429 ? 1 : 3;
  await assert.rejects(
    fetchAucBiocJson({
      fetchImpl: sequenceFetch([response]),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    new RegExp(`retrieval failed after ${attemptsMade} attempt${attemptsMade === 1 ? "" : "s"}`),
    `BioC negative case must fail closed: ${name}`,
  );
}

assert.equal(AUC_BIOC_JSON_URL, `https://${AUC_BIOC_HOST}${AUC_BIOC_PATH}`);
assert.equal(new URL(AUC_BIOC_JSON_URL).hostname, AUC_BIOC_HOST);
assert.equal(new URL(AUC_BIOC_JSON_URL).pathname, AUC_BIOC_PATH);
assert.equal(AUC_BIOC_MEDIA_TYPE, "application/json");

console.log(
  `CAC-DRS and Maron boundaries verified; primary HTML and exact NCBI PMC BioC fallback sealed (canonical SHA256 ${EXPECTED_BIOC_CANONICAL_SHA256}).`,
);
