#!/usr/bin/env node

import assert from "node:assert/strict";
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
  "79de3bae7c63934b444c4d147d9e86c41bf7ceffd3b572fce82cb206810c3c4b";
const EXPECTED_REVIEWED_VECTORS_SHA256 =
  "c5601d60b76951af5abd097d24681dd29d174c4d162555e5d4cd227ab0ef7a47";
const EXPECTED_REVIEWER_REVISION =
  "fleischner-source-review/2026-08-30-r6";
const EXPECTED_REVIEWED_AT = "2026-08-30T20:19:37Z";

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
  "categorical-lte3-solid-low-without-false-precision",
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
  "solid-component-unconfirmed-change-cannot-trigger-escalation",
  "single-ground-glass-validated-volumetric-growth-accepted",
];

const EXPECTED_LIMITATIONS = [
  "CI verifies Crossref metadata and NLM table fragments, not RSNA full-text content.",
  "The NLM tables are secondary cross-checks and cannot prove prose exceptions, risk interpretation, or measurement guidance.",
  "This committed record preserves an independent source interpretation but does not prove that the historical browser review occurred.",
  "Source review does not approve the runtime, pull request, deployment, or live site.",
];

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
  assert.ok(parseAs === "json" || parseAs === "text", `${label}: parse mode`);
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
              : "text/html,application/xhtml+xml",
          "user-agent": "Radulator-Fleischner-source-audit/2",
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
        parseAs === "json" ? await response.json() : await response.text();
      return { body, finalUrl: response.url, contentType };
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
    source_locator: claim.source_locator,
    fact: claim.fact,
    vector_ids: claim.vector_ids,
  };
}

function validateManifest(manifest, fixture, registry) {
  assertExactKeys(manifest, ["schema", "payload", "review"], "manifest");
  assert.equal(manifest.schema, "radulator-reviewed-source-evidence/v1");
  assertExactKeys(
    manifest.payload,
    [
      "calculator_id",
      "guideline_version",
      "scope",
      "sources",
      "claims",
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
  assert.equal(manifest.payload.scope, "source-interpretation-only");
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
        "content_sha256",
        "reviewed_locators",
      ],
      source.id,
    );
    assert.equal(source.id, expected.id);
    assert.equal(source.authority, "Fleischner Society and Radiological Society of North America");
    assert.equal(source.url, expected.url);
    assert.equal(source.doi, expected.doi);
    assert.equal(source.review_transport, "interactive-browser");
    assert.equal(source.ci_full_text_fetched, false);
    assert.equal(source.content_sha256, null);
    assertUniqueStrings(source.reviewed_locators, `${source.id}: locators`);
  }

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
  for (const claim of manifest.payload.claims) {
    assertExactKeys(
      claim,
      ["id", "source_url", "source_locator", "fact", "vector_ids"],
      `manifest claim ${claim.id}`,
    );
    assert.ok(sourceUrls.has(claim.source_url), `${claim.id}: unknown source URL`);
    assert.ok(claim.source_locator.length > 0, `${claim.id}: source locator`);
    assert.ok(claim.fact.length > 0, `${claim.id}: fact`);
    assertUniqueStrings(claim.vector_ids, `${claim.id}: vector IDs`);
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
  assert.equal(runtime.reviewed_vector_ids.length, 88, "exact vector count");

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
    schema: "radulator-reviewed-source-evidence-link/v1",
    manifest_path: MANIFEST_PATH,
    payload_sha256: EXPECTED_PAYLOAD_SHA256,
    reviewer_revision: EXPECTED_REVIEWER_REVISION,
    ci_primary_full_text_verified: false,
  });
  assert.deepEqual(
    registryEvidence.claims.map(claimProjection),
    manifest.payload.claims.map(claimProjection),
    "registry claims must deep-match the reviewed manifest claim bindings",
  );

  return { reviewedVectorDigest, claimIds };
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
    "Subsolid Nodule Comparison State",
    "Pure-Ground-Glass Growth Confirmation",
    "Solid-Component Evolution Confirmation",
    "average-diameter increase of ≥2 mm",
    "Validated volumetry may be used under its reproducibility protocol",
    "A new measurable solid component developed",
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

  const { reviewedVectorDigest, claimIds } = validateManifest(
    manifest,
    fixture,
    registry,
  );
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

  const [guidelineMetadata, measurementMetadata, solidHtml, subsolidHtml] =
    await Promise.all([
      loadCrossref(GUIDELINE_DOI),
      loadCrossref(MEASUREMENT_DOI),
      loadNlmTable(SOLID_TABLE_URL, EXPECTED_TABLES.solid.objectId),
      loadNlmTable(SUBSOLID_TABLE_URL, EXPECTED_TABLES.subsolid.objectId),
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
    schema: "radulator-fleischner-primary-source-audit/v2",
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
      limitations: manifest.payload.limitations,
      ci_does_not_verify: [
        "RSNA full-text content",
        "that the historical browser review occurred",
        "runtime, pull request, deployment, or live-site approval",
      ],
    },
    rsna_source_transport: rsnaSources.map((source) => ({
      id: source.id,
      url: source.url,
      review_transport: source.review_transport,
      ci_full_text_fetched: source.ci_full_text_fetched,
      content_sha256: source.content_sha256,
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
    registry_claim_match: true,
    reviewed_vectors_sha256: reviewedVectorDigest,
    solid_matrix_vector_ids: EXPECTED_SOLID_MATRIX_VECTOR_IDS,
    critical_vector_ids: EXPECTED_CRITICAL_VECTOR_IDS,
    claim_ids: claimIds,
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
      `Fleischner source audit passed: ${audit.executed_vector_count} executable vectors, ${audit.claim_ids.length} reviewed claims, primary DOI identities, and 2 hashed live table fragments.`,
    );
  }
}
