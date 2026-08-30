#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fetchParsedResource } from "./audit-fleischner-primary-source.mjs";

const GUIDELINE_URL =
  "https://pubs.rsna.org/doi/10.1148/radiol.2017161659";
const MEASUREMENT_URL =
  "https://pubs.rsna.org/doi/10.1148/radiol.2017162894";
const MANIFEST_PATH =
  "docs/evidence/fleischner-2017-reviewed-evidence.json";
const PAYLOAD_SHA256 =
  "bbc8d5cd2c33a93a8632324482587f9689e0536994efe5f9faaf89196f96582a";
const REVIEWED_VECTORS_SHA256 =
  "c50cc61eb5fc6626986dea76e2ac1b4cf09cca378b40349e0741774a92127061";

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
  "uncertain-characterization-routes-without-table",
  "part-solid-categorical-linear-growth-claim-rejected",
  "part-solid-categorical-lte3-component-avoids-false-precision",
  "part-solid-categorical-new-component-escalates-without-false-precision",
  "part-solid-measured-component-at-3-mm-rejected",
  "part-solid-missing-component-mode-rejected",
  "single-part-solid-12-component-8-validated-volumetric-growth-escalates",
];

const EXPECTED_LIMITATIONS = [
  "CI verifies Crossref metadata and NLM table fragments, not RSNA full-text content.",
  "The NLM tables are secondary cross-checks and cannot prove prose exceptions, risk interpretation, or measurement guidance.",
  "This committed record preserves an independent source interpretation but does not prove that the historical browser review occurred.",
  "Source review does not approve the runtime, pull request, deployment, or live site.",
];

function fakeResponse({
  status = 200,
  contentType = "application/json; charset=utf-8",
  retryAfter,
  url = "https://example.test/resource",
  jsonValue = { ok: true },
  jsonError,
  textValue = "ok",
}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    url,
    headers: new Headers({
      "content-type": contentType,
      ...(retryAfter === undefined ? {} : { "retry-after": retryAfter }),
    }),
    body: { cancel: async () => {} },
    async json() {
      if (jsonError) throw jsonError;
      return jsonValue;
    },
    async text() {
      return textValue;
    },
  };
}

const noSleep = async () => {};

for (const status of [408, 425, 429, 500, 502, 503, 504]) {
  let calls = 0;
  const parsed = await fetchParsedResource("https://example.test/resource", {
    label: `retryable-${status}`,
    parseAs: "json",
    expectedContentType: "application/json",
    sleepImpl: noSleep,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? fakeResponse({ status })
        : fakeResponse({ jsonValue: { recovered: status } });
    },
  });
  assert.deepEqual(parsed.body, { recovered: status });
  assert.equal(calls, 2, `HTTP ${status} must be retried exactly once here`);
}

for (const status of [400, 401, 403, 404, 409, 422, 501]) {
  let calls = 0;
  await assert.rejects(
    fetchParsedResource("https://example.test/resource", {
      label: `non-retryable-${status}`,
      parseAs: "json",
      expectedContentType: "application/json",
      sleepImpl: noSleep,
      fetchImpl: async () => {
        calls += 1;
        return fakeResponse({ status });
      },
    }),
    new RegExp(`HTTP ${status}`),
  );
  assert.equal(calls, 1, `HTTP ${status} must fail without a retry`);
}

let parseAttempts = 0;
const parsedAfterTruncatedBody = await fetchParsedResource(
  "https://example.test/resource",
  {
    label: "truncated-json",
    parseAs: "json",
    expectedContentType: "application/json",
    sleepImpl: noSleep,
    fetchImpl: async () => {
      parseAttempts += 1;
      return parseAttempts === 1
        ? fakeResponse({ jsonError: new SyntaxError("truncated JSON") })
        : fakeResponse({ jsonValue: { parsed: true } });
    },
  },
);
assert.deepEqual(parsedAfterTruncatedBody.body, { parsed: true });
assert.equal(
  parseAttempts,
  2,
  "body parsing must occur inside the retry boundary",
);

let contentTypeAttempts = 0;
await assert.rejects(
  fetchParsedResource("https://example.test/resource", {
    label: "wrong-content-type",
    parseAs: "json",
    expectedContentType: "application/json",
    sleepImpl: noSleep,
    fetchImpl: async () => {
      contentTypeAttempts += 1;
      return fakeResponse({ contentType: "text/html" });
    },
  }),
  /content-type/i,
);
assert.equal(
  contentTypeAttempts,
  1,
  "a deterministic content-type mismatch must not be retried",
);

const retryDelays = [];
let retryAfterCalls = 0;
await fetchParsedResource("https://example.test/resource", {
  label: "bounded-retry-after",
  parseAs: "json",
  expectedContentType: "application/json",
  maxDelayMs: 1_500,
  sleepImpl: async (milliseconds) => retryDelays.push(milliseconds),
  fetchImpl: async () => {
    retryAfterCalls += 1;
    return retryAfterCalls === 1
      ? fakeResponse({ status: 429, retryAfter: "120" })
      : fakeResponse({ jsonValue: { recovered: true } });
  },
});
assert.deepEqual(
  retryDelays,
  [1_500],
  "Retry-After must be honored without exceeding the configured delay bound",
);

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-fleischner-primary-source.mjs",
    "--json",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);

assert.equal(
  run.status,
  0,
  `Fleischner primary-source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);

const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-fleischner-primary-source-audit/v2");
assert.deepEqual(audit.primary_metadata.guideline, {
  doi: "10.1148/radiol.2017161659",
  title:
    "Guidelines for Management of Incidental Pulmonary Nodules Detected on CT Images: From the Fleischner Society 2017",
  publisher: "Radiological Society of North America (RSNA)",
  journal: "Radiology",
  volume: "284",
  issue: "1",
  pages: "228-243",
  published: "2017-07",
});
assert.deepEqual(audit.primary_metadata.measurement, {
  doi: "10.1148/radiol.2017162894",
  title:
    "Recommendations for Measuring Pulmonary Nodules at CT: A Statement from the Fleischner Society",
  publisher: "Radiological Society of North America (RSNA)",
  journal: "Radiology",
  volume: "285",
  issue: "2",
  pages: "584-600",
  published: "2017-11",
});

assert.deepEqual(audit.reviewed_source_evidence, {
  manifest_path: MANIFEST_PATH,
  manifest_schema: "radulator-reviewed-source-evidence/v1",
  payload_sha256: PAYLOAD_SHA256,
  reviewer_schema: "radulator-independent-source-review/v1",
  reviewer_role: "independent-clinical-source-reviewer",
  reviewer_revision: "fleischner-source-review/2026-08-30-r7",
  reviewed_at: "2026-08-30T21:04:45Z",
  disposition: "SOURCE_INTERPRETATION_APPROVED",
  release_authority: "none",
  scope: "source-interpretation-only",
  claim_ids: EXPECTED_CLAIM_IDS,
  limitations: EXPECTED_LIMITATIONS,
  ci_does_not_verify: [
    "RSNA full-text content",
    "that the historical browser review occurred",
    "runtime, pull request, deployment, or live-site approval",
  ],
});
assert.equal(
  Object.hasOwn(audit.reviewed_source_evidence, "reviewed_in_browser"),
  false,
  "committed manifest evidence must replace the old hard-coded browser boolean",
);

assert.deepEqual(audit.rsna_source_transport, [
  {
    id: "rsna-fleischner-2017-guideline",
    url: GUIDELINE_URL,
    review_transport: "interactive-browser",
    ci_full_text_fetched: false,
    content_sha256: null,
  },
  {
    id: "rsna-fleischner-2017-measurement",
    url: MEASUREMENT_URL,
    review_transport: "interactive-browser",
    ci_full_text_fetched: false,
    content_sha256: null,
  },
]);

assert.deepEqual(audit.secondary_cross_checks.solid, {
  role: "secondary-open-table-reproduction",
  url: "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab1/?report=objectonly",
  object_id: "ch5.Tab1",
  table_fragment_bytes: 3153,
  table_fragment_sha256:
    "d9cec9955406cd10d6ec93298dd61f1215dbdd18a38815a33d1af93407c1dbb9",
});
assert.deepEqual(audit.secondary_cross_checks.subsolid, {
  role: "secondary-open-table-reproduction",
  url: "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab2/?report=objectonly",
  object_id: "ch5.Tab2",
  table_fragment_bytes: 1912,
  table_fragment_sha256:
    "7e28fe2305cd1ce68afbd6bbd25e092f8301082085c7f8c6efec16d2b5b21997",
});

assert.equal(audit.calculator_id, "fleischner");
assert.equal(audit.guideline_version, "Fleischner 2017");
assert.equal(audit.fixture_path, "tests/fixtures/compute/fleischner.json");
assert.equal(
  audit.fixture_version,
  "fleischner-2017-primary-guideline-and-measurement-statement",
);
assert.equal(audit.executed_vector_count, 95);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.registry_claim_match, true);
assert.equal(audit.reviewed_vectors_sha256, REVIEWED_VECTORS_SHA256);
assert.deepEqual(audit.solid_matrix_vector_ids, EXPECTED_SOLID_MATRIX_VECTOR_IDS);
assert.deepEqual(audit.critical_vector_ids, EXPECTED_CRITICAL_VECTOR_IDS);
assert.deepEqual(audit.claim_ids, EXPECTED_CLAIM_IDS);
assert.equal(audit.correct_guideline_doi_present, true);
assert.equal(audit.correct_measurement_doi_present, true);
assert.equal(audit.known_wrong_measurement_doi_absent, true);
assert.equal(audit.calculator_content_invariants_match, true);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "Fleischner source audit verified the reviewed-source manifest, 12 claims, 95 executable vectors, primary DOI identities, and live NLM fragments.",
);
