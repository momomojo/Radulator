#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import process from "node:process";
import {
  fetchParsedResource,
  verifyMementoArtifact,
} from "./audit-fleischner-primary-source.mjs";

const GUIDELINE_URL =
  "https://pubs.rsna.org/doi/10.1148/radiol.2017161659";
const MEASUREMENT_URL =
  "https://pubs.rsna.org/doi/10.1148/radiol.2017162894";
const MANIFEST_PATH =
  "docs/evidence/fleischner-2017-reviewed-evidence.json";
const PAYLOAD_SHA256 =
  "d677757521cedada4aba3573386beac5620701e2c7c36c648d960a4bfec39a11";
const REVIEWED_VECTORS_SHA256 =
  "4f15e698faca2a32ebc28830ef6b94483249910d725148af4f8eb0695c0e08c8";

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

function rawSha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fakeResponse({
  status = 200,
  contentType = "application/json; charset=utf-8",
  retryAfter,
  url = "https://example.test/resource",
  jsonValue = { ok: true },
  jsonError,
  textValue = "ok",
  bytesValue = Buffer.from("ok"),
  extraHeaders = {},
}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    url,
    headers: new Headers({
      "content-type": contentType,
      ...(retryAfter === undefined ? {} : { "retry-after": retryAfter }),
      ...extraHeaders,
    }),
    body: { cancel: async () => {} },
    async json() {
      if (jsonError) throw jsonError;
      return jsonValue;
    },
    async text() {
      return textValue;
    },
    async arrayBuffer() {
      return bytesValue.buffer.slice(
        bytesValue.byteOffset,
        bytesValue.byteOffset + bytesValue.byteLength,
      );
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

const parsedBytes = await fetchParsedResource("https://example.test/artifact", {
  label: "binary-artifact",
  parseAs: "bytes",
  expectedContentType: "application/pdf",
  fetchImpl: async () =>
    fakeResponse({
      contentType: "application/pdf",
      url: "https://example.test/artifact",
      bytesValue: Buffer.from("%PDF-test"),
    }),
});
assert.equal(Buffer.isBuffer(parsedBytes.body), true);
assert.equal(parsedBytes.body.toString("utf8"), "%PDF-test");
assert.equal(parsedBytes.headers.get("content-type"), "application/pdf");

const fragmentStart = '<div class="hlFld-Fulltext">';
const fragmentEnd = "</div><!--/fulltext content-->";
const archivedHtml = Buffer.from(
  `prefix${fragmentStart}<p>verified text</p>${fragmentEnd}suffix`,
);
const inclusiveFragment = Buffer.from(
  `${fragmentStart}<p>verified text</p>${fragmentEnd}`,
);
const syntheticArtifact = {
  id: "measurement-fulltext",
  origin_url: "https://publisher.example/article",
  retrieval_url:
    "https://web.archive.org/web/20220119075636id_/https://publisher.example/article",
  retrieval_host: "web.archive.org",
  memento_datetime: "2022-01-19T07:56:36Z",
  rel_original_verified: true,
  origin_last_modified: null,
  origin_etag: null,
  media_type: "text/html",
  content_scope: "publisher-fulltext-html",
  content_bytes: archivedHtml.length,
  content_sha256: rawSha256(archivedHtml),
  direct_origin_fetch_status: 403,
  fragment: {
    start_marker: fragmentStart,
    end_marker: fragmentEnd,
    end_marker_inclusive: true,
    marker_occurrences: [1, 1],
    content_bytes: inclusiveFragment.length,
    content_sha256: rawSha256(inclusiveFragment),
  },
};

function syntheticArtifactResponse(bytes = archivedHtml, overrides = {}) {
  return fakeResponse({
    contentType: "text/html; charset=UTF-8",
    url: syntheticArtifact.retrieval_url,
    bytesValue: bytes,
    extraHeaders: {
      link: `<${syntheticArtifact.origin_url}>; rel="original", <https://web.archive.org/web/timemap/link/${syntheticArtifact.origin_url}>; rel="timemap"`,
      "memento-datetime": "Wed, 19 Jan 2022 07:56:36 GMT",
      "x-archive-orig-date": "Wed, 19 Jan 2022 07:56:37 GMT",
      ...overrides,
    },
  });
}

const verifiedSyntheticArtifact = await verifyMementoArtifact(
  syntheticArtifact,
  { fetchImpl: async () => syntheticArtifactResponse() },
);
assert.deepEqual(verifiedSyntheticArtifact, {
  id: "measurement-fulltext",
  origin_url: syntheticArtifact.origin_url,
  retrieval_url: syntheticArtifact.retrieval_url,
  final_url: syntheticArtifact.retrieval_url,
  retrieval_host: "web.archive.org",
  memento_datetime: "2022-01-19T07:56:36Z",
  rel_original_verified: true,
  origin_headers_verified: true,
  origin_last_modified: null,
  origin_etag: null,
  media_type: "text/html",
  content_scope: "publisher-fulltext-html",
  content_bytes: archivedHtml.length,
  content_sha256: rawSha256(archivedHtml),
  byte_signature_verified: null,
  fragment: {
    content_bytes: inclusiveFragment.length,
    content_sha256: rawSha256(inclusiveFragment),
    marker_occurrences: [1, 1],
    end_marker_inclusive: true,
  },
});

await assert.rejects(
  verifyMementoArtifact(syntheticArtifact, {
    fetchImpl: async () =>
      syntheticArtifactResponse(Buffer.concat([archivedHtml, Buffer.from("!")])),
  }),
  /bytes|SHA-256/,
  "a byte mutation must invalidate the archived artifact",
);

await assert.rejects(
  verifyMementoArtifact(syntheticArtifact, {
    byteSignature: "%PDF-",
    fetchImpl: async () => syntheticArtifactResponse(),
  }),
  /byte signature/,
  "a declared artifact signature must match the first bytes",
);

await assert.rejects(
  verifyMementoArtifact(syntheticArtifact, {
    fetchImpl: async () =>
      syntheticArtifactResponse(archivedHtml, {
        link: "<https://attacker.example/article>; rel=\"original\"",
      }),
  }),
  /rel=original/,
  "the capture must bind the exact publisher origin URL",
);

await assert.rejects(
  verifyMementoArtifact(syntheticArtifact, {
    fetchImpl: async () =>
      syntheticArtifactResponse(archivedHtml, {
        "memento-datetime": "Thu, 20 Jan 2022 07:56:36 GMT",
      }),
  }),
  /Memento-Datetime/,
  "the capture timestamp must match the manifest",
);

const duplicateMarkerBytes = Buffer.from(
  `${fragmentStart}first${fragmentEnd}${fragmentStart}second${fragmentEnd}`,
);
await assert.rejects(
  verifyMementoArtifact(
    {
      ...syntheticArtifact,
      content_bytes: duplicateMarkerBytes.length,
      content_sha256: rawSha256(duplicateMarkerBytes),
    },
    { fetchImpl: async () => syntheticArtifactResponse(duplicateMarkerBytes) },
  ),
  /marker occurrences/,
  "the inclusive full-text fragment must have unique boundary markers",
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
assert.equal(audit.schema, "radulator-fleischner-primary-source-audit/v3");
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
  manifest_schema: "radulator-reviewed-source-evidence/v2",
  payload_sha256: PAYLOAD_SHA256,
  reviewer_schema: "radulator-independent-source-review/v1",
  reviewer_role: "independent-clinical-source-reviewer",
  reviewer_revision: "fleischner-source-review/2026-08-30-r9",
  reviewed_at: "2026-08-30T23:32:19Z",
  disposition: "SOURCE_INTERPRETATION_APPROVED",
  release_authority: "none",
  scope: "source-interpretation-and-product-invariants",
  claim_ids: EXPECTED_CLAIM_IDS,
  implementation_invariant_ids: EXPECTED_INVARIANT_IDS,
  limitations: EXPECTED_LIMITATIONS,
  ci_does_not_verify: [
    "a successful live RSNA origin fetch",
    "a measurement-statement PDF",
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
    review_transport: "ci-http-memento",
    ci_full_text_fetched: true,
    live_origin_fetched_by_ci: false,
    artifacts: [
      {
        id: "guideline-vor-pdf",
        origin_url:
          "https://pubs.rsna.org/doi/pdf/10.1148/radiol.2017161659",
        retrieval_url:
          "https://web.archive.org/web/20211217024152id_/https://pubs.rsna.org/doi/pdf/10.1148/radiol.2017161659",
        final_url:
          "https://web.archive.org/web/20211217024152id_/https://pubs.rsna.org/doi/pdf/10.1148/radiol.2017161659",
        retrieval_host: "web.archive.org",
        memento_datetime: "2021-12-17T02:41:52Z",
        rel_original_verified: true,
        origin_headers_verified: true,
        origin_last_modified: "Wed, 14 Jun 2017 08:18:33 GMT",
        origin_etag: '"e6730c98d3cf943c"',
        media_type: "application/pdf",
        content_scope: "full-version-of-record-pdf",
        content_bytes: 1983895,
        content_sha256:
          "f5bb64d6e8d64dfd49f798b586435dc78e4f22d1174e0aee701bb9cd0f8f80b1",
        byte_signature_verified: "%PDF-",
        fragment: null,
        direct_origin_fetch_attempted_by_ci: false,
        manifest_recorded_direct_origin_status: 403,
      },
    ],
  },
  {
    id: "rsna-fleischner-2017-measurement",
    url: MEASUREMENT_URL,
    review_transport: "ci-http-memento",
    ci_full_text_fetched: true,
    live_origin_fetched_by_ci: false,
    artifacts: [
      {
        id: "measurement-fulltext",
        origin_url: MEASUREMENT_URL,
        retrieval_url:
          "https://web.archive.org/web/20220119075636id_/https://pubs.rsna.org/doi/10.1148/radiol.2017162894",
        final_url:
          "https://web.archive.org/web/20220119075636id_/https://pubs.rsna.org/doi/10.1148/radiol.2017162894",
        retrieval_host: "web.archive.org",
        memento_datetime: "2022-01-19T07:56:36Z",
        rel_original_verified: true,
        origin_headers_verified: true,
        origin_last_modified: null,
        origin_etag: null,
        media_type: "text/html",
        content_scope: "publisher-fulltext-html",
        content_bytes: 318344,
        content_sha256:
          "633592d2253388d5a3d441ec16cd34ddb04762fc964ec023706fc0bc12e6d2d1",
        byte_signature_verified: null,
        fragment: {
          content_bytes: 194120,
          content_sha256:
            "2d78355e8e35408d888f18c212cc8ea3cf9eb71e6dbad6327560bb1bf9d60e30",
          marker_occurrences: [1, 1],
          end_marker_inclusive: true,
        },
        direct_origin_fetch_attempted_by_ci: false,
        manifest_recorded_direct_origin_status: 403,
      },
      {
        id: "measurement-figure-1",
        origin_url:
          "https://pubs.rsna.org/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif",
        retrieval_url:
          "https://web.archive.org/web/20201021012528id_/https://pubs.rsna.org/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif",
        final_url:
          "https://web.archive.org/web/20201021012528id_/https://pubs.rsna.org/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif",
        retrieval_host: "web.archive.org",
        memento_datetime: "2020-10-21T01:25:28Z",
        rel_original_verified: true,
        origin_headers_verified: true,
        origin_last_modified: "Thu, 15 Mar 2018 16:55:54 GMT",
        origin_etag: '"/4Dkotn4rPc"',
        media_type: "image/gif",
        content_scope: "publisher-figure-1",
        content_bytes: 62198,
        content_sha256:
          "5ec3df4bb0491f3d0eca1d84b85bd77882161d9c5628c0151b24f7e5a8f070a9",
        byte_signature_verified: "GIF",
        fragment: null,
        direct_origin_fetch_attempted_by_ci: false,
        manifest_recorded_direct_origin_status: 403,
      },
    ],
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
assert.equal(audit.executed_vector_count, 113);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.claim_and_invariant_vector_match, true);
assert.equal(audit.registry_claim_match, true);
assert.equal(audit.reviewed_vectors_sha256, REVIEWED_VECTORS_SHA256);
assert.deepEqual(audit.solid_matrix_vector_ids, EXPECTED_SOLID_MATRIX_VECTOR_IDS);
assert.deepEqual(audit.critical_vector_ids, EXPECTED_CRITICAL_VECTOR_IDS);
assert.deepEqual(audit.claim_ids, EXPECTED_CLAIM_IDS);
assert.deepEqual(audit.implementation_invariant_ids, EXPECTED_INVARIANT_IDS);
assert.equal(audit.correct_guideline_doi_present, true);
assert.equal(audit.correct_measurement_doi_present, true);
assert.equal(audit.known_wrong_measurement_doi_absent, true);
assert.equal(audit.calculator_content_invariants_match, true);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "Fleischner source audit verified 3 byte-pinned RSNA-origin Mementos, 12 claims plus 3 implementation invariants, all 113 executable vectors, primary DOI identities, and live NLM fragments.",
);
