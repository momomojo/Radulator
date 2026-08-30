#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { digest } from "./release-policy.mjs";

const GUIDELINE_DOI = "10.1148/radiol.2017161659";
const MEASUREMENT_DOI = "10.1148/radiol.2017162894";
const WRONG_MEASUREMENT_DOI = "10.1148/radiol.2017170044";
const GUIDELINE_URL = `https://pubs.rsna.org/doi/${GUIDELINE_DOI}`;
const MEASUREMENT_URL = `https://pubs.rsna.org/doi/${MEASUREMENT_DOI}`;
const MANIFEST_PATH =
  "docs/evidence/fleischner-2017-reviewed-evidence.json";
const FIXTURE_PATH = "tests/fixtures/compute/fleischner.json";
const CALCULATOR_PATH = "src/components/calculators/Fleischner.jsx";
const REGISTRY_PATH =
  "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json";
const SOLID_TABLE_URL =
  "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab1/?report=objectonly";
const SUBSOLID_TABLE_URL =
  "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab2/?report=objectonly";

const EXPECTED_PAYLOAD_SHA256 =
  "d677757521cedada4aba3573386beac5620701e2c7c36c648d960a4bfec39a11";
const EXPECTED_REVIEWED_VECTORS_SHA256 =
  "4f15e698faca2a32ebc28830ef6b94483249910d725148af4f8eb0695c0e08c8";
const EXPECTED_REVIEWER_REVISION =
  "fleischner-source-review/2026-08-30-r9";
const EXPECTED_REVIEWED_AT = "2026-08-30T23:32:19Z";

const EXPECTED_INVARIANT_IDS = [
  "fleischner-input-completeness-fail-closed",
  "fleischner-nodule-domain-boundary",
  "fleischner-measurement-input-geometry",
];

const EXPECTED_CLAIM_IDS = [
  "fleischner-2017-applicability",
  "fleischner-2017-characterization-and-ipln",
  "fleischner-2017-solid-table",
  "fleischner-2017-multiple-nodule-routing",
  "fleischner-2017-subsolid-table",
  "fleischner-2017-selected-subsolid-escalation",
  "fleischner-2017-part-solid-component-escalation",
  "fleischner-2017-risk-selection",
  "fleischner-2017-measurement-contract",
  "fleischner-2017-very-small-nodule-measurement",
  "nlm-fleischner-solid-table-cross-check",
  "nlm-fleischner-subsolid-table-cross-check",
];

const EXPECTED_SOLID_MATRIX_VECTOR_IDS = [
  "single-solid-5-low-no-routine-follow-up",
  "single-solid-5-high-optional-12-month-ct",
  "single-solid-6-low-preserves-late-ct-option",
  "single-solid-6-high-two-ct-intervals",
  "single-solid-8-low-preserves-late-ct-option",
  "single-solid-8-high-two-ct-intervals",
  "single-solid-9-consider-ct-pet-or-tissue",
  "single-solid-9-high-consider-ct-pet-or-tissue",
  "multiple-solid-5-low-no-routine-follow-up",
  "multiple-solid-5-high-optional-12-month-ct",
  "multiple-solid-6-low-preserves-late-ct-option",
  "multiple-solid-6-high-two-ct-intervals",
  "multiple-solid-8-low-preserves-late-ct-option",
  "multiple-solid-8-high-two-ct-intervals",
  "multiple-solid-9-low-uses-multiple-table-row",
  "multiple-solid-9-high-two-ct-intervals",
];

const EXPECTED_CRITICAL_VECTOR_IDS = [
  "definitively-benign-fat-or-calcification-routes-without-table",
  "typical-intrapulmonary-lymph-node-routes-without-table",
  "thick-section-characterization-fails-closed",
  "multiple-solid-any-ge6-dominant-5-uses-multiple-threshold",
  "multiple-solid-dominant-9-solitary-override",
  "multiple-subsolid-any-ge6-dominant-5-uses-cohort-threshold",
  "categorical-lte3-pure-ggo-linear-growth-claim-rejected",
  "categorical-lte3-pure-ggo-validated-volumetric-growth-claim-rejected",
  "categorical-lte3-solid-component-linear-growth-claim-rejected",
  "categorical-lte3-solid-component-missing-basis-requires-recharacterization",
  "categorical-lte3-solid-component-validated-volumetric-growth-claim-rejected",
  "categorical-lte3-solid-low-without-false-precision",
  "categorical-lte3-visually-new-component-requires-recharacterization",
  "numeric-3-mm-requires-categorical-pathway",
  "subsolid-missing-temporal-state-fails-closed",
  "single-ground-glass-6-established-growth-uses-annual-follow-up",
  "single-ground-glass-new-solid-component-reroutes-to-part-solid",
  "single-part-solid-6-component-5-persistent-uses-annual-follow-up",
  "single-part-solid-12-component-6-persistent-is-highly-suspicious",
  "part-solid-component-exceeding-overall-long-axis-rejected",
  "multiple-ground-glass-established-growth-uses-most-suspicious-route",
  "multiple-ground-glass-new-solid-component-uses-most-suspicious-route",
  "single-solid-10-valid-axes-accepted",
  "single-solid-10-axes-average-mismatch-rejected",
  "pure-ground-glass-sub2mm-change-cannot-claim-growth",
  "pure-ground-glass-missing-growth-basis-rejected",
  "solid-component-missing-growth-basis-rejected",
  "solid-component-unconfirmed-change-cannot-trigger-escalation",
  "single-ground-glass-validated-volumetric-growth-accepted",
  "uncertain-characterization-routes-without-table",
  "part-solid-categorical-linear-growth-claim-rejected",
  "part-solid-categorical-lte3-component-avoids-false-precision",
  "part-solid-categorical-new-component-escalates-without-false-precision",
  "part-solid-categorical-validated-volumetric-growth-claim-rejected",
  "part-solid-measured-component-at-3-mm-rejected",
  "part-solid-missing-component-mode-rejected",
  "single-part-solid-12-component-8-validated-volumetric-growth-escalates",
  "sub6-ground-glass-linear-component-growth-claim-rejected",
  "sub6-ground-glass-solid-component-missing-basis-requires-recharacterization",
  "sub6-ground-glass-validated-volumetric-component-growth-claim-rejected",
  "sub6-ground-glass-visually-new-component-requires-recharacterization",
  "sub6-part-solid-linear-component-growth-claim-rejected",
  "sub6-part-solid-solid-component-missing-basis-requires-recharacterization",
  "sub6-part-solid-validated-volumetric-component-growth-claim-rejected",
  "sub6-part-solid-visually-new-component-requires-recharacterization",
];

const EXPECTED_LIMITATIONS = [
  "CI retrieves hash-pinned Memento captures of RSNA-origin publisher artifacts and verifies rel=original provenance; it does not claim a successful live RSNA origin fetch.",
  "No measurement-statement PDF is pinned; measurement claims are bound to the publisher full-text HTML fragment and Figure 1 artifact.",
  "The NLM tables are secondary cross-checks and cannot prove prose exceptions, risk interpretation, or measurement guidance.",
  "Source bindings and product invariants do not approve the runtime, pull request, deployment, or live site.",
  "If Memento retrieval is not an acceptable transport, release remains blocked until equivalent licensed or RSNA-delivered bytes can be pinned and verified.",
];

const EXPECTED_RSNA_ARTIFACTS = {
  guideline: {
    id: "guideline-vor-pdf",
    origin_url:
      "https://pubs.rsna.org/doi/pdf/10.1148/radiol.2017161659",
    retrieval_url:
      "https://web.archive.org/web/20211217024152id_/https://pubs.rsna.org/doi/pdf/10.1148/radiol.2017161659",
    retrieval_host: "web.archive.org",
    memento_datetime: "2021-12-17T02:41:52Z",
    rel_original_verified: true,
    origin_last_modified: "Wed, 14 Jun 2017 08:18:33 GMT",
    origin_etag: '"e6730c98d3cf943c"',
    media_type: "application/pdf",
    content_scope: "full-version-of-record-pdf",
    content_bytes: 1983895,
    content_sha256:
      "f5bb64d6e8d64dfd49f798b586435dc78e4f22d1174e0aee701bb9cd0f8f80b1",
    page_count: 16,
    direct_origin_fetch_status: 403,
  },
  measurement: {
    id: "measurement-fulltext",
    origin_url: MEASUREMENT_URL,
    retrieval_url:
      "https://web.archive.org/web/20220119075636id_/https://pubs.rsna.org/doi/10.1148/radiol.2017162894",
    retrieval_host: "web.archive.org",
    memento_datetime: "2022-01-19T07:56:36Z",
    rel_original_verified: true,
    origin_last_modified: null,
    origin_etag: null,
    media_type: "text/html",
    content_scope: "publisher-fulltext-html",
    content_bytes: 318344,
    content_sha256:
      "633592d2253388d5a3d441ec16cd34ddb04762fc964ec023706fc0bc12e6d2d1",
    direct_origin_fetch_status: 403,
    fragment: {
      start_marker: '<div class="hlFld-Fulltext">',
      end_marker: "</div><!--/fulltext content-->",
      end_marker_inclusive: true,
      marker_occurrences: [1, 1],
      content_bytes: 194120,
      content_sha256:
        "2d78355e8e35408d888f18c212cc8ea3cf9eb71e6dbad6327560bb1bf9d60e30",
    },
  },
  figure1: {
    id: "measurement-figure-1",
    origin_url:
      "https://pubs.rsna.org/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif",
    retrieval_url:
      "https://web.archive.org/web/20201021012528id_/https://pubs.rsna.org/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif",
    retrieval_host: "web.archive.org",
    memento_datetime: "2020-10-21T01:25:28Z",
    rel_original_verified: true,
    origin_last_modified: "Thu, 15 Mar 2018 16:55:54 GMT",
    origin_etag: '"/4Dkotn4rPc"',
    media_type: "image/gif",
    content_scope: "publisher-figure-1",
    content_bytes: 62198,
    content_sha256:
      "5ec3df4bb0491f3d0eca1d84b85bd77882161d9c5628c0151b24f7e5a8f070a9",
    direct_origin_fetch_status: 403,
  },
};

const EXPECTED_TABLES = {
  solid: {
    sourceId: "nlm-fleischner-solid-table",
    url: SOLID_TABLE_URL,
    objectId: "ch5.Tab1",
    bytes: 3153,
    sha256:
      "d9cec9955406cd10d6ec93298dd61f1215dbdd18a38815a33d1af93407c1dbb9",
  },
  subsolid: {
    sourceId: "nlm-fleischner-subsolid-table",
    url: SUBSOLID_TABLE_URL,
    objectId: "ch5.Tab2",
    bytes: 1912,
    sha256:
      "7e28fe2305cd1ce68afbd6bbd25e092f8301082085c7f8c6efec16d2b5b21997",
  },
};

const RETRYABLE_HTTP_STATUSES = new Set([
  408,
  425,
  429,
  500,
  502,
  503,
  504,
]);

class NonRetryableRetrievalError extends Error {}

function sha256(value) {
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) {
    return createHash("sha256").update(value).digest("hex");
  }
  return digest(value);
}

function retryDelayMilliseconds(response, attempt, baseDelayMs, maxDelayMs) {
  const retryAfter = response?.headers?.get?.("retry-after")?.trim();
  let requestedDelay;
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      requestedDelay = seconds * 1_000;
    } else {
      const retryDate = Date.parse(retryAfter);
      if (Number.isFinite(retryDate)) {
        requestedDelay = Math.max(0, retryDate - Date.now());
      }
    }
  }
  const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
  return Math.min(maxDelayMs, requestedDelay ?? exponentialDelay);
}

function assertExactKeys(value, expectedKeys, label) {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    `${label}: expected an object`,
  );
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expectedKeys].sort(),
    `${label}: schema keys`,
  );
}

function assertUniqueStrings(values, label) {
  assert.ok(Array.isArray(values) && values.length > 0, `${label}: empty`);
  assert.equal(
    values.every((value) => typeof value === "string" && value.length > 0),
    true,
    `${label}: all entries must be non-empty strings`,
  );
  assert.equal(new Set(values).size, values.length, `${label}: duplicate entry`);
}

/**
 * Fetch and parse one resource. HTTP responses are retried only for the
 * explicitly transient statuses. Network/body-read failures remain retryable;
 * URL and content-type policy failures are deterministic and fail immediately.
 */
export async function fetchParsedResource(
  url,
  {
    label = url,
    parseAs,
    expectedContentType,
    validateFinalUrl,
    fetchImpl = globalThis.fetch,
    maxAttempts = 3,
    sleepImpl = delay,
    baseDelayMs = 250,
    maxDelayMs = 2_000,
  },
) {
  assert.ok(
    parseAs === "json" || parseAs === "text" || parseAs === "bytes",
    `${label}: parse mode`,
  );
  assert.ok(
    typeof expectedContentType === "string" && expectedContentType.length > 0,
    `${label}: expected content type`,
  );
  assert.equal(typeof fetchImpl, "function", `${label}: fetch implementation`);
  assert.ok(Number.isInteger(maxAttempts) && maxAttempts >= 1, `${label}: attempts`);
  assert.equal(typeof sleepImpl, "function", `${label}: sleep implementation`);
  assert.ok(Number.isFinite(baseDelayMs) && baseDelayMs >= 0, `${label}: base delay`);
  assert.ok(Number.isFinite(maxDelayMs) && maxDelayMs >= 0, `${label}: max delay`);

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: {
          accept:
            parseAs === "json"
              ? "application/json"
              : parseAs === "bytes"
                ? "application/pdf,image/gif,text/html,application/xhtml+xml,application/octet-stream"
              : "text/html,application/xhtml+xml",
          "user-agent": "Radulator-Fleischner-source-audit/3",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      await sleepImpl(
        retryDelayMilliseconds(null, attempt, baseDelayMs, maxDelayMs),
      );
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel?.();
      const statusError = new Error(`${label}: HTTP ${response.status}`);
      if (!RETRYABLE_HTTP_STATUSES.has(response.status)) {
        throw new NonRetryableRetrievalError(statusError.message);
      }
      lastError = statusError;
      if (attempt === maxAttempts) break;
      await sleepImpl(
        retryDelayMilliseconds(response, attempt, baseDelayMs, maxDelayMs),
      );
      continue;
    }

    try {
      if (validateFinalUrl) {
        try {
          validateFinalUrl(new URL(response.url));
        } catch (error) {
          throw new NonRetryableRetrievalError(
            `${label}: unexpected final URL ${response.url} (${error.message})`,
          );
        }
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (
        !contentType
          .toLowerCase()
          .includes(expectedContentType.toLowerCase())
      ) {
        throw new NonRetryableRetrievalError(
          `${label}: unexpected content-type ${contentType || "<missing>"}`,
        );
      }

      const body =
        parseAs === "json"
          ? await response.json()
          : parseAs === "bytes"
            ? Buffer.from(await response.arrayBuffer())
            : await response.text();
      return { body, finalUrl: response.url, contentType, headers: response.headers };
    } catch (error) {
      if (error instanceof NonRetryableRetrievalError) throw error;
      lastError = error;
      if (attempt === maxAttempts) break;
      await sleepImpl(
        retryDelayMilliseconds(response, attempt, baseDelayMs, maxDelayMs),
      );
    }
  }

  assert.fail(
    `${label}: retrieval failed after ${maxAttempts} attempts (${lastError})`,
  );
}

function bufferOccurrenceCount(buffer, marker) {
  const markerBytes = Buffer.from(marker);
  assert.ok(markerBytes.length > 0, "fragment marker must not be empty");
  let count = 0;
  let offset = 0;
  while (offset <= buffer.length - markerBytes.length) {
    const index = buffer.indexOf(markerBytes, offset);
    if (index < 0) break;
    count += 1;
    offset = index + markerBytes.length;
  }
  return count;
}

function originalLinkUrls(linkHeader) {
  const urls = [];
  const linkPattern = /<([^>]+)>([^,]*)/g;
  for (const match of String(linkHeader ?? "").matchAll(linkPattern)) {
    const parameters = match[2];
    const relMatch = parameters.match(/(?:^|;)\s*rel\s*=\s*(?:"([^"]+)"|([^;,\s]+))/i);
    const relations = (relMatch?.[1] ?? relMatch?.[2] ?? "")
      .split(/\s+/)
      .filter(Boolean);
    if (relations.includes("original")) urls.push(match[1]);
  }
  return urls;
}

function isoFromHttpDate(value, label) {
  assert.ok(value, `${label}: missing header`);
  const milliseconds = Date.parse(value);
  assert.ok(Number.isFinite(milliseconds), `${label}: invalid HTTP date`);
  return new Date(milliseconds).toISOString().replace(".000Z", "Z");
}

/**
 * Retrieve and byte-verify one exact Wayback `id_` capture. This verifies the
 * capture's publisher origin relationship; it deliberately does not contact
 * or claim success from the current publisher origin.
 */
export async function verifyMementoArtifact(
  artifact,
  {
    byteSignature = null,
    fetchImpl = globalThis.fetch,
    maxAttempts = 3,
    sleepImpl = delay,
  } = {},
) {
  assert.ok(artifact && typeof artifact === "object", "Memento artifact: object");
  const label = `Memento ${artifact.id}`;
  for (const key of [
    "id",
    "origin_url",
    "retrieval_url",
    "retrieval_host",
    "memento_datetime",
    "media_type",
    "content_scope",
    "content_sha256",
  ]) {
    assert.ok(
      typeof artifact[key] === "string" && artifact[key].length > 0,
      `${label}: ${key}`,
    );
  }
  assert.equal(artifact.retrieval_host, "web.archive.org", `${label}: host`);
  assert.equal(
    new URL(artifact.retrieval_url).hostname,
    artifact.retrieval_host,
    `${label}: retrieval URL host`,
  );
  assert.ok(
    artifact.retrieval_url.includes("id_/"),
    `${label}: exact raw-capture id_ URL`,
  );
  assert.equal(
    artifact.rel_original_verified,
    true,
    `${label}: manifest rel=original`,
  );
  assert.ok(
    Number.isInteger(artifact.content_bytes) && artifact.content_bytes > 0,
    `${label}: content bytes`,
  );
  assert.match(artifact.content_sha256, /^[a-f0-9]{64}$/, `${label}: SHA-256`);

  const { body, finalUrl, headers } = await fetchParsedResource(
    artifact.retrieval_url,
    {
      label,
      parseAs: "bytes",
      expectedContentType: artifact.media_type,
      validateFinalUrl(finalUrlValue) {
        assert.equal(finalUrlValue.href, artifact.retrieval_url);
      },
      fetchImpl,
      maxAttempts,
      sleepImpl,
    },
  );

  assert.equal(finalUrl, artifact.retrieval_url, `${label}: final URL`);
  assert.deepEqual(
    originalLinkUrls(headers.get("link")),
    [artifact.origin_url],
    `${label}: rel=original`,
  );
  assert.equal(
    isoFromHttpDate(headers.get("memento-datetime"), `${label}: Memento-Datetime`),
    artifact.memento_datetime,
    `${label}: Memento-Datetime`,
  );
  isoFromHttpDate(headers.get("x-archive-orig-date"), `${label}: origin Date`);

  for (const [manifestKey, headerName] of [
    ["origin_last_modified", "x-archive-orig-last-modified"],
    ["origin_etag", "x-archive-orig-etag"],
  ]) {
    assert.equal(
      headers.get(headerName),
      artifact[manifestKey],
      `${label}: ${headerName}`,
    );
  }

  assert.equal(body.length, artifact.content_bytes, `${label}: bytes`);
  assert.equal(sha256(body), artifact.content_sha256, `${label}: SHA-256`);
  if (byteSignature !== null) {
    assert.ok(
      typeof byteSignature === "string" && byteSignature.length > 0,
      `${label}: byte signature`,
    );
    assert.equal(
      body.subarray(0, Buffer.byteLength(byteSignature)).toString("ascii"),
      byteSignature,
      `${label}: byte signature`,
    );
  }

  let fragment = null;
  if (artifact.fragment !== undefined) {
    assertExactKeys(
      artifact.fragment,
      [
        "start_marker",
        "end_marker",
        "end_marker_inclusive",
        "marker_occurrences",
        "content_bytes",
        "content_sha256",
      ],
      `${label}: fragment`,
    );
    const startCount = bufferOccurrenceCount(body, artifact.fragment.start_marker);
    const endCount = bufferOccurrenceCount(body, artifact.fragment.end_marker);
    assert.deepEqual(
      [startCount, endCount],
      artifact.fragment.marker_occurrences,
      `${label}: fragment marker occurrences`,
    );
    assert.deepEqual(
      artifact.fragment.marker_occurrences,
      [1, 1],
      `${label}: unique fragment marker occurrences`,
    );
    assert.equal(
      artifact.fragment.end_marker_inclusive,
      true,
      `${label}: fragment end marker must be inclusive`,
    );
    const start = body.indexOf(Buffer.from(artifact.fragment.start_marker));
    const endMarkerStart = body.indexOf(
      Buffer.from(artifact.fragment.end_marker),
      start + Buffer.byteLength(artifact.fragment.start_marker),
    );
    assert.ok(start >= 0 && endMarkerStart > start, `${label}: fragment bounds`);
    const end = endMarkerStart + Buffer.byteLength(artifact.fragment.end_marker);
    const fragmentBytes = body.subarray(start, end);
    assert.equal(
      fragmentBytes.length,
      artifact.fragment.content_bytes,
      `${label}: fragment bytes`,
    );
    assert.equal(
      sha256(fragmentBytes),
      artifact.fragment.content_sha256,
      `${label}: fragment SHA-256`,
    );
    fragment = {
      content_bytes: fragmentBytes.length,
      content_sha256: sha256(fragmentBytes),
      marker_occurrences: [startCount, endCount],
      end_marker_inclusive: true,
    };
  }

  return {
    id: artifact.id,
    origin_url: artifact.origin_url,
    retrieval_url: artifact.retrieval_url,
    final_url: finalUrl,
    retrieval_host: artifact.retrieval_host,
    memento_datetime: artifact.memento_datetime,
    rel_original_verified: true,
    origin_headers_verified: true,
    origin_last_modified: artifact.origin_last_modified,
    origin_etag: artifact.origin_etag,
    media_type: artifact.media_type,
    content_scope: artifact.content_scope,
    content_bytes: body.length,
    content_sha256: sha256(body),
    byte_signature_verified: byteSignature,
    fragment,
  };
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function crossrefMetadata(message) {
  const parts = message.published?.["date-parts"]?.[0] ?? [];
  assert.ok(parts[0] && parts[1], "Crossref: missing publication year/month");
  return {
    doi: message.DOI,
    title: normalizeWhitespace(message.title?.[0]),
    publisher: message.publisher,
    journal: message["container-title"]?.[0],
    volume: message.volume,
    issue: message.issue,
    pages: message.page,
    published: `${parts[0]}-${String(parts[1]).padStart(2, "0")}`,
  };
}

async function loadCrossref(doi) {
  const encodedDoi = encodeURIComponent(doi);
  const { body } = await fetchParsedResource(
    `https://api.crossref.org/works/${encodedDoi}`,
    {
      label: `Crossref ${doi}`,
      parseAs: "json",
      expectedContentType: "application/json",
      validateFinalUrl(finalUrl) {
        assert.equal(finalUrl.protocol, "https:");
        assert.equal(finalUrl.hostname, "api.crossref.org");
        assert.equal(decodeURIComponent(finalUrl.pathname), `/works/${doi}`);
      },
    },
  );
  assertExactKeys(body, ["status", "message-type", "message-version", "message"], `Crossref ${doi}`);
  assert.equal(body.status, "ok", `Crossref ${doi}: status`);
  assert.equal(body["message-type"], "work", `Crossref ${doi}: message type`);
  return crossrefMetadata(body.message);
}

async function loadNlmTable(url, objectId) {
  const expectedPath = `/books/NBK553863/table/${objectId}/`;
  const { body } = await fetchParsedResource(url, {
    label: `NLM ${objectId}`,
    parseAs: "text",
    expectedContentType: "text/html",
    validateFinalUrl(finalUrl) {
      assert.equal(finalUrl.protocol, "https:");
      assert.equal(finalUrl.hostname, "www.ncbi.nlm.nih.gov");
      assert.equal(finalUrl.pathname, expectedPath);
      assert.equal(finalUrl.searchParams.get("report"), "objectonly");
    },
  });
  assert.ok(body.length > 500, `NLM ${objectId}: implausibly short HTML`);
  return body;
}

function extractTable(html, label) {
  const start = html.indexOf("<table");
  const end = html.indexOf("</table>", start);
  assert.ok(start >= 0 && end > start, `${label}: table fragment not found`);
  assert.equal(
    html.indexOf("<table", start + 1),
    -1,
    `${label}: expected exactly one table`,
  );
  return html.slice(start, end + "</table>".length);
}

function assertFragment(fragment, expected, label) {
  assert.equal(Buffer.byteLength(fragment), expected.bytes, `${label}: bytes`);
  assert.equal(sha256(fragment), expected.sha256, `${label}: SHA-256`);
}

function assertExpectedText(fragment, snippets, label) {
  for (const snippet of snippets) {
    assert.ok(fragment.includes(snippet), `${label}: missing ${snippet}`);
  }
}

function assertFixtureExpectation(result, expectation, context) {
  assertExactKeys(expectation, ["noError", "fields"], `${context}: expectation`);
  assert.equal(typeof expectation.noError, "boolean", `${context}: noError`);
  assert.ok(Array.isArray(expectation.fields), `${context}: fields`);

  const hasError = Object.hasOwn(result, "Error");
  if (expectation.noError) {
    assert.equal(hasError, false, `${context}: unexpected Error ${result.Error}`);
  } else {
    assert.equal(hasError, true, `${context}: expected an Error result`);
  }

  for (const field of expectation.fields) {
    const allowedKeys = Object.hasOwn(field, "equals")
      ? ["key", "equals"]
      : ["key", "includes"];
    assertExactKeys(field, allowedKeys, `${context}: expected field`);
    assert.ok(Object.hasOwn(result, field.key), `${context}: missing ${field.key}`);
    const actual = String(result[field.key]);
    if (Object.hasOwn(field, "equals")) {
      assert.equal(actual, String(field.equals), `${context}: ${field.key}`);
    } else {
      assert.ok(
        actual.includes(String(field.includes)),
        `${context}: ${field.key} missing ${field.includes}`,
      );
    }
  }
}

function claimProjection(claim) {
  return {
    id: claim.id,
    source_url: claim.source_url,
    source_sha256: claim.source_sha256,
    source_locator: claim.source_locator,
    fact: claim.fact,
    vector_ids: claim.vector_ids,
  };
}

function invariantProjection(invariant) {
  return {
    id: invariant.id,
    fact: invariant.fact,
    vector_ids: invariant.vector_ids,
  };
}

function validateManifest(manifest, fixture, registry) {
  assertExactKeys(manifest, ["schema", "payload", "review"], "manifest");
  assert.equal(manifest.schema, "radulator-reviewed-source-evidence/v2");
  assertExactKeys(
    manifest.payload,
    [
      "calculator_id",
      "guideline_version",
      "scope",
      "sources",
      "claims",
      "implementation_invariants",
      "runtime_contract",
      "limitations",
    ],
    "manifest payload",
  );
  assertExactKeys(
    manifest.review,
    [
      "schema",
      "reviewer_role",
      "reviewer_revision",
      "reviewed_at",
      "disposition",
      "payload_sha256",
      "release_authority",
    ],
    "manifest review",
  );

  assert.equal(manifest.payload.calculator_id, "fleischner");
  assert.equal(manifest.payload.guideline_version, "Fleischner 2017");
  assert.equal(
    manifest.payload.scope,
    "source-interpretation-and-product-invariants",
  );
  assert.deepEqual(manifest.payload.limitations, EXPECTED_LIMITATIONS);
  assert.equal(sha256(manifest.payload), EXPECTED_PAYLOAD_SHA256);
  assert.equal(manifest.review.payload_sha256, EXPECTED_PAYLOAD_SHA256);
  assert.equal(
    manifest.review.schema,
    "radulator-independent-source-review/v1",
  );
  assert.equal(
    manifest.review.reviewer_role,
    "independent-clinical-source-reviewer",
  );
  assert.equal(
    manifest.review.reviewer_revision,
    EXPECTED_REVIEWER_REVISION,
  );
  assert.equal(manifest.review.reviewed_at, EXPECTED_REVIEWED_AT);
  assert.equal(manifest.review.disposition, "SOURCE_INTERPRETATION_APPROVED");
  assert.equal(manifest.review.release_authority, "none");

  assert.equal(manifest.payload.sources.length, 4, "manifest source count");
  assert.deepEqual(
    manifest.payload.sources.map((source) => source.id),
    [
      "rsna-fleischner-2017-guideline",
      "rsna-fleischner-2017-measurement",
      "nlm-fleischner-solid-table",
      "nlm-fleischner-subsolid-table",
    ],
  );

  const [guidelineSource, measurementSource, solidSource, subsolidSource] =
    manifest.payload.sources;
  for (const [source, expected] of [
    [guidelineSource, { id: "rsna-fleischner-2017-guideline", url: GUIDELINE_URL, doi: GUIDELINE_DOI }],
    [measurementSource, { id: "rsna-fleischner-2017-measurement", url: MEASUREMENT_URL, doi: MEASUREMENT_DOI }],
  ]) {
    assertExactKeys(
      source,
      [
        "id",
        "authority",
        "url",
        "doi",
        "review_transport",
        "ci_full_text_fetched",
        "artifacts",
        "reviewed_locators",
      ],
      source.id,
    );
    assert.equal(source.id, expected.id);
    assert.equal(source.authority, "Fleischner Society and Radiological Society of North America");
    assert.equal(source.url, expected.url);
    assert.equal(source.doi, expected.doi);
    assert.equal(source.review_transport, "ci-http-memento");
    assert.equal(source.ci_full_text_fetched, true);
    assertUniqueStrings(source.reviewed_locators, `${source.id}: locators`);
  }
  assert.deepEqual(
    guidelineSource.artifacts,
    [EXPECTED_RSNA_ARTIFACTS.guideline],
    "guideline source artifacts",
  );
  assert.deepEqual(
    measurementSource.artifacts,
    [EXPECTED_RSNA_ARTIFACTS.measurement, EXPECTED_RSNA_ARTIFACTS.figure1],
    "measurement source artifacts",
  );

  for (const [source, expected] of [
    [solidSource, EXPECTED_TABLES.solid],
    [subsolidSource, EXPECTED_TABLES.subsolid],
  ]) {
    assertExactKeys(
      source,
      [
        "id",
        "authority",
        "url",
        "review_transport",
        "ci_full_text_fetched",
        "content_scope",
        "content_bytes",
        "content_sha256",
        "reviewed_locators",
      ],
      source.id,
    );
    assert.equal(source.id, expected.sourceId);
    assert.equal(source.authority, "National Library of Medicine Bookshelf");
    assert.equal(source.url, expected.url);
    assert.equal(source.review_transport, "ci-http");
    assert.equal(source.ci_full_text_fetched, true);
    assert.equal(source.content_scope, "exact-html-table-fragment");
    assert.equal(source.content_bytes, expected.bytes);
    assert.equal(source.content_sha256, expected.sha256);
    assert.deepEqual(source.reviewed_locators, [
      `NCBI Bookshelf object ${expected.objectId}`,
    ]);
  }

  assert.equal(manifest.payload.claims.length, 12, "manifest claim count");
  const claimIds = manifest.payload.claims.map((claim) => claim.id);
  assert.deepEqual(claimIds, EXPECTED_CLAIM_IDS);
  assertUniqueStrings(claimIds, "manifest claim IDs");
  const sourceUrls = new Set(manifest.payload.sources.map((source) => source.url));
  const sourceDigests = new Map([
    [GUIDELINE_URL, EXPECTED_RSNA_ARTIFACTS.guideline.content_sha256],
    [MEASUREMENT_URL, EXPECTED_RSNA_ARTIFACTS.measurement.content_sha256],
    [SOLID_TABLE_URL, EXPECTED_TABLES.solid.sha256],
    [SUBSOLID_TABLE_URL, EXPECTED_TABLES.subsolid.sha256],
  ]);
  for (const claim of manifest.payload.claims) {
    assertExactKeys(
      claim,
      [
        "id",
        "source_url",
        "source_sha256",
        "source_locator",
        "fact",
        "vector_ids",
      ],
      `manifest claim ${claim.id}`,
    );
    assert.ok(sourceUrls.has(claim.source_url), `${claim.id}: unknown source URL`);
    assert.equal(
      claim.source_sha256,
      sourceDigests.get(claim.source_url),
      `${claim.id}: source SHA-256`,
    );
    assert.ok(claim.source_locator.length > 0, `${claim.id}: source locator`);
    assert.ok(claim.fact.length > 0, `${claim.id}: fact`);
    assertUniqueStrings(claim.vector_ids, `${claim.id}: vector IDs`);
  }

  assert.equal(
    manifest.payload.implementation_invariants.length,
    3,
    "manifest implementation invariant count",
  );
  const implementationInvariantIds =
    manifest.payload.implementation_invariants.map((invariant) => invariant.id);
  assert.deepEqual(implementationInvariantIds, EXPECTED_INVARIANT_IDS);
  assertUniqueStrings(implementationInvariantIds, "implementation invariant IDs");
  for (const invariant of manifest.payload.implementation_invariants) {
    assertExactKeys(
      invariant,
      ["id", "fact", "vector_ids"],
      `manifest implementation invariant ${invariant.id}`,
    );
    assert.ok(invariant.fact.length > 0, `${invariant.id}: fact`);
    assertUniqueStrings(invariant.vector_ids, `${invariant.id}: vector IDs`);
  }

  assertExactKeys(
    manifest.payload.runtime_contract,
    [
      "calculator_path",
      "fixture_path",
      "fixture_version",
      "reviewed_vector_ids",
      "reviewed_vectors_sha256",
    ],
    "manifest runtime contract",
  );
  const runtime = manifest.payload.runtime_contract;
  assert.equal(runtime.calculator_path, CALCULATOR_PATH);
  assert.equal(runtime.fixture_path, FIXTURE_PATH);
  assert.equal(runtime.fixture_version, fixture.version);
  assertUniqueStrings(runtime.reviewed_vector_ids, "reviewed vector IDs");
  assert.deepEqual(
    runtime.reviewed_vector_ids,
    [...runtime.reviewed_vector_ids].sort(),
    "reviewed vector IDs must be canonical lexical order",
  );

  const fixtureIds = fixture.cases.map((testCase) => testCase.id);
  assertUniqueStrings(fixtureIds, "fixture vector IDs");
  assert.deepEqual(
    [...fixtureIds].sort(),
    runtime.reviewed_vector_ids,
    "the reviewed manifest must bind the exact fixture ID set",
  );
  assert.equal(runtime.reviewed_vector_ids.length, 113, "exact vector count");

  const fixtureById = new Map(
    fixture.cases.map((testCase) => [testCase.id, testCase]),
  );
  const reviewedVectors = runtime.reviewed_vector_ids.map((id) =>
    fixtureById.get(id),
  );
  const reviewedVectorDigest = sha256(reviewedVectors);
  assert.equal(reviewedVectorDigest, EXPECTED_REVIEWED_VECTORS_SHA256);
  assert.equal(runtime.reviewed_vectors_sha256, reviewedVectorDigest);

  const reviewedIdSet = new Set(runtime.reviewed_vector_ids);
  for (const claim of manifest.payload.claims) {
    for (const vectorId of claim.vector_ids) {
      assert.ok(reviewedIdSet.has(vectorId), `${claim.id}: unreviewed ${vectorId}`);
    }
  }
  for (const invariant of manifest.payload.implementation_invariants) {
    for (const vectorId of invariant.vector_ids) {
      assert.ok(
        reviewedIdSet.has(vectorId),
        `${invariant.id}: unreviewed ${vectorId}`,
      );
    }
  }
  const boundByClaimsOrInvariants = [
    ...new Set(
      [
        ...manifest.payload.claims,
        ...manifest.payload.implementation_invariants,
      ].flatMap((binding) => binding.vector_ids),
    ),
  ].sort();
  assert.deepEqual(
    boundByClaimsOrInvariants,
    [...fixtureIds].sort(),
    "the exact union of claim and implementation-invariant vectors must cover every fixture case",
  );

  const solidClaim = manifest.payload.claims.find(
    (claim) => claim.id === "fleischner-2017-solid-table",
  );
  assert.deepEqual(
    solidClaim.vector_ids,
    EXPECTED_SOLID_MATRIX_VECTOR_IDS,
    "solid table claim must bind the exact 2 x 4 x 2 matrix",
  );
  for (const vectorId of [
    ...EXPECTED_SOLID_MATRIX_VECTOR_IDS,
    ...EXPECTED_CRITICAL_VECTOR_IDS,
  ]) {
    assert.ok(reviewedIdSet.has(vectorId), `required vector missing: ${vectorId}`);
  }

  const registryRecord = registry.records.find(
    (record) => record.calculator_id === "fleischner",
  );
  assert.ok(registryRecord, "registry: missing Fleischner record");
  assert.equal(registryRecord.implemented_version, "Fleischner 2017");
  const registryEvidence = registryRecord.implementation_evidence;
  assert.deepEqual(registryEvidence.reviewed_evidence, {
    schema: "radulator-reviewed-source-evidence-link/v2",
    manifest_path: MANIFEST_PATH,
    payload_sha256: EXPECTED_PAYLOAD_SHA256,
    reviewer_revision: EXPECTED_REVIEWER_REVISION,
    reviewed_at: EXPECTED_REVIEWED_AT,
    review_scope: "source-interpretation-and-product-invariants",
    review_disposition: "SOURCE_INTERPRETATION_APPROVED",
    release_authority: "none",
    ci_primary_full_text_verified: true,
    reviewed_vectors_sha256: EXPECTED_REVIEWED_VECTORS_SHA256,
    reviewed_vector_count: 113,
    primary_artifacts: [
      EXPECTED_RSNA_ARTIFACTS.guideline,
      EXPECTED_RSNA_ARTIFACTS.measurement,
      EXPECTED_RSNA_ARTIFACTS.figure1,
    ],
  });
  assert.deepEqual(
    registryEvidence.claims.map(claimProjection),
    manifest.payload.claims.map(claimProjection),
    "registry claims must deep-match the reviewed manifest claim bindings",
  );
  assert.deepEqual(
    registryEvidence.implementation_invariants.map(invariantProjection),
    manifest.payload.implementation_invariants.map(invariantProjection),
    "registry implementation invariants must deep-match the reviewed manifest",
  );

  return { reviewedVectorDigest, claimIds, implementationInvariantIds };
}

function validateCalculatorSource(calculatorSource) {
  assert.ok(calculatorSource.includes(GUIDELINE_DOI));
  assert.ok(calculatorSource.includes(MEASUREMENT_DOI));
  assert.ok(!calculatorSource.includes(WRONG_MEASUREMENT_DOI));
  assert.ok(!calculatorSource.includes("large_nodule_axes_recorded"));
  assert.ok(!/mediastinal window settings/i.test(calculatorSource));
  for (const invariant of [
    "contiguous thin-section CT (≤1.5 mm)",
    "lung-window images and record whole millimeters",
    "Do not assign a false-precision measurement to nodules ≤3 mm",
    "For nodules >3 and <10 mm, enter the average of maximal long-axis and perpendicular maximal short-axis diameters",
    "For nodules ≥10 mm, enter both overall axes",
    "maximum long-axis diameter of the largest solid component",
    "Largest Solid Component Measurement",
    "≤3 mm / too small to measure reliably",
    "component >3 mm",
    "smaller solid-component measurements may be unreliable",
    "Subsolid Nodule Comparison State",
    "Pure-Ground-Glass Growth Confirmation",
    "Solid-Component Evolution Confirmation",
    "average-diameter increase of ≥2 mm",
    "Validated volumetry may be used only for a reliably measurable nodule under its reproducibility protocol",
    "A new solid component is visually established on comparable thin-section CT; no quantitative growth claim",
    "cannot establish quantitative growth by linear or volumetric measurement",
    "cannot establish quantitative solid-component growth",
    "cannot be reliably defined when the overall nodule is <6 mm",
    "cannot support an established solid-component state",
    "cannot establish quantitative component growth",
    "with measurement only when the component is >3 mm",
    "Solid-component diameter increased by ≥2 mm on comparable CT",
    "overall nodule maximum long axis",
  ]) {
    assert.ok(
      normalizeWhitespace(calculatorSource).includes(invariant),
      `calculator source missing invariant: ${invariant}`,
    );
  }
}

export async function runAudit() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  const calculatorSource = readFileSync(CALCULATOR_PATH, "utf8");

  assertExactKeys(
    fixture,
    ["version", "calculatorId", "calculatorName", "cases"],
    "fixture",
  );
  assert.equal(fixture.calculatorId, "fleischner");
  assert.equal(
    fixture.version,
    "fleischner-2017-primary-guideline-and-measurement-statement",
  );
  for (const testCase of fixture.cases) {
    assertExactKeys(testCase, ["id", "inputs", "expect"], `fixture ${testCase.id}`);
  }

  const {
    reviewedVectorDigest,
    claimIds,
    implementationInvariantIds,
  } = validateManifest(manifest, fixture, registry);
  validateCalculatorSource(calculatorSource);

  const { Fleischner } = await import(
    "../src/components/calculators/Fleischner.jsx"
  );
  assert.equal(fixture.calculatorId, Fleischner.id);
  assert.equal(Fleischner.guidelineVersion, "Fleischner 2017");

  for (const testCase of fixture.cases) {
    const result = Fleischner.compute({ ...testCase.inputs });
    assertFixtureExpectation(
      result,
      testCase.expect,
      `${fixture.calculatorId}/${testCase.id}`,
    );
  }

  const [
    guidelineMetadata,
    measurementMetadata,
    solidHtml,
    subsolidHtml,
    guidelineArtifactVerification,
    measurementArtifactVerification,
    figure1ArtifactVerification,
  ] = await Promise.all([
    loadCrossref(GUIDELINE_DOI),
    loadCrossref(MEASUREMENT_DOI),
    loadNlmTable(SOLID_TABLE_URL, EXPECTED_TABLES.solid.objectId),
    loadNlmTable(SUBSOLID_TABLE_URL, EXPECTED_TABLES.subsolid.objectId),
    verifyMementoArtifact(EXPECTED_RSNA_ARTIFACTS.guideline, {
      byteSignature: "%PDF-",
    }),
    verifyMementoArtifact(EXPECTED_RSNA_ARTIFACTS.measurement),
    verifyMementoArtifact(EXPECTED_RSNA_ARTIFACTS.figure1, {
      byteSignature: "GIF",
    }),
  ]);

  assert.deepEqual(guidelineMetadata, {
    doi: GUIDELINE_DOI,
    title:
      "Guidelines for Management of Incidental Pulmonary Nodules Detected on CT Images: From the Fleischner Society 2017",
    publisher: "Radiological Society of North America (RSNA)",
    journal: "Radiology",
    volume: "284",
    issue: "1",
    pages: "228-243",
    published: "2017-07",
  });
  assert.deepEqual(measurementMetadata, {
    doi: MEASUREMENT_DOI,
    title:
      "Recommendations for Measuring Pulmonary Nodules at CT: A Statement from the Fleischner Society",
    publisher: "Radiological Society of North America (RSNA)",
    journal: "Radiology",
    volume: "285",
    issue: "2",
    pages: "584-600",
    published: "2017-11",
  });

  const solidFragment = extractTable(solidHtml, "solid table");
  const subsolidFragment = extractTable(subsolidHtml, "subsolid table");
  assertFragment(solidFragment, EXPECTED_TABLES.solid, "solid table");
  assertFragment(subsolidFragment, EXPECTED_TABLES.subsolid, "subsolid table");

  assertExpectedText(
    solidFragment,
    [
      "No routine follow-up",
      "Optional CT at 12 months",
      "CT at 6&#x02013;12 months, then consider CT at 18&#x02013;24 months",
      "CT at 6&#x02013;12 months, then CT at 18&#x02013;24 months",
      "Consider CT, PET/CT or tissue sampling at 3 months",
      "CT at 3&#x02013;6 months, then consider CT at 18&#x02013;24 months",
      "CT at 3&#x02013;6 months, then CT at 18&#x02013;24 months",
    ],
    "solid table",
  );
  assertExpectedText(
    subsolidFragment,
    [
      "CT at 6&#x02013;12 months to confirm persistence, then CT every 2 years until 5 years",
      "If unchanged and solid component remains &#x0003c;6 mm, annual CT should be performed for 5 years",
      "CT at 3&#x02013;6 months. If stable, consider CT at 2 and 4 years",
      "CT at 3&#x02013;6 months. Subsequent management based on the most suspicious nodule(s)",
    ],
    "subsolid table",
  );

  const rsnaSources = manifest.payload.sources.slice(0, 2);
  const artifactVerifications = new Map(
    [
      guidelineArtifactVerification,
      measurementArtifactVerification,
      figure1ArtifactVerification,
    ].map((artifact) => [artifact.id, artifact]),
  );
  const sourceClaims = {
    solid: {
      single_lt6: ["No routine follow-up", "Optional CT at 12 months"],
      single_6_to_8: [
        "CT at 6–12 months, then consider CT at 18–24 months",
        "CT at 6–12 months, then CT at 18–24 months",
      ],
      single_gt8: "Consider CT, PET/CT, or tissue sampling at 3 months",
      multiple_lt6: ["No routine follow-up", "Optional CT at 12 months"],
      multiple_ge6: [
        "CT at 3–6 months, then consider CT at 18–24 months",
        "CT at 3–6 months, then CT at 18–24 months",
      ],
    },
    subsolid: {
      single_ground_glass_lt6: "No routine follow-up",
      single_ground_glass_ge6:
        "CT at 6–12 months to confirm persistence, then CT every 2 years until 5 years",
      single_part_solid_lt6: "No routine follow-up",
      single_part_solid_ge6:
        "CT at 3–6 months to confirm persistence. If unchanged and solid component remains <6 mm, annual CT should be performed for 5 years",
      multiple_lt6:
        "CT at 3–6 months. If stable, consider CT at 2 and 4 years",
      multiple_ge6:
        "CT at 3–6 months. Subsequent management based on the most suspicious nodule(s)",
    },
  };

  return {
    schema: "radulator-fleischner-primary-source-audit/v3",
    calculator_id: Fleischner.id,
    guideline_version: Fleischner.guidelineVersion,
    primary_metadata: {
      guideline: guidelineMetadata,
      measurement: measurementMetadata,
    },
    reviewed_source_evidence: {
      manifest_path: MANIFEST_PATH,
      manifest_schema: manifest.schema,
      payload_sha256: manifest.review.payload_sha256,
      reviewer_schema: manifest.review.schema,
      reviewer_role: manifest.review.reviewer_role,
      reviewer_revision: manifest.review.reviewer_revision,
      reviewed_at: manifest.review.reviewed_at,
      disposition: manifest.review.disposition,
      release_authority: manifest.review.release_authority,
      scope: manifest.payload.scope,
      claim_ids: claimIds,
      implementation_invariant_ids: implementationInvariantIds,
      limitations: manifest.payload.limitations,
      ci_does_not_verify: [
        "a successful live RSNA origin fetch",
        "a measurement-statement PDF",
        "runtime, pull request, deployment, or live-site approval",
      ],
    },
    rsna_source_transport: rsnaSources.map((source) => ({
      id: source.id,
      url: source.url,
      review_transport: source.review_transport,
      ci_full_text_fetched: source.ci_full_text_fetched,
      live_origin_fetched_by_ci: false,
      artifacts: source.artifacts.map((artifact) => ({
        ...artifactVerifications.get(artifact.id),
        direct_origin_fetch_attempted_by_ci: false,
        manifest_recorded_direct_origin_status:
          artifact.direct_origin_fetch_status,
      })),
    })),
    secondary_cross_checks: {
      solid: {
        role: "secondary-open-table-reproduction",
        url: SOLID_TABLE_URL,
        object_id: EXPECTED_TABLES.solid.objectId,
        table_fragment_bytes: Buffer.byteLength(solidFragment),
        table_fragment_sha256: sha256(solidFragment),
      },
      subsolid: {
        role: "secondary-open-table-reproduction",
        url: SUBSOLID_TABLE_URL,
        object_id: EXPECTED_TABLES.subsolid.objectId,
        table_fragment_bytes: Buffer.byteLength(subsolidFragment),
        table_fragment_sha256: sha256(subsolidFragment),
      },
    },
    source_claims: sourceClaims,
    fixture_path: FIXTURE_PATH,
    fixture_version: fixture.version,
    bound_vector_ids: manifest.payload.runtime_contract.reviewed_vector_ids,
    executed_vector_count: fixture.cases.length,
    fixture_vector_match: true,
    runtime_vector_match: true,
    claim_and_invariant_vector_match: true,
    registry_claim_match: true,
    reviewed_vectors_sha256: reviewedVectorDigest,
    solid_matrix_vector_ids: EXPECTED_SOLID_MATRIX_VECTOR_IDS,
    critical_vector_ids: EXPECTED_CRITICAL_VECTOR_IDS,
    claim_ids: claimIds,
    implementation_invariant_ids: implementationInvariantIds,
    correct_guideline_doi_present: true,
    correct_measurement_doi_present: true,
    known_wrong_measurement_doi_absent: true,
    calculator_content_invariants_match: true,
    source_bytes_committed: false,
  };
}

const isMain =
  Boolean(process.argv[1]) &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const audit = await runAudit();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(audit)}\n`);
  } else {
    console.log(
      `Fleischner source audit passed: 3 byte-pinned RSNA-origin Mementos, ${audit.claim_ids.length} reviewed claims plus ${audit.implementation_invariant_ids.length} implementation invariants, ${audit.executed_vector_count} executable vectors, primary DOI identities, and 2 hashed live table fragments.`,
    );
  }
}
