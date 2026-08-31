#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import process from "node:process";
import * as auditModule from "./audit-fleischner-primary-source.mjs";
import { digest } from "./release-policy.mjs";

const { fetchParsedResource, verifyMementoArtifact } = auditModule;

const GUIDELINE_URL =
  "https://pubs.rsna.org/doi/10.1148/radiol.2017161659";
const MEASUREMENT_URL =
  "https://pubs.rsna.org/doi/10.1148/radiol.2017162894";
const MANIFEST_PATH =
  "docs/evidence/fleischner-2017-reviewed-evidence.json";
const PAYLOAD_SHA256 =
  "e6446ba442742e612bc55b12f8f3f3f46c9d004cc326131013762f1e62b68811";
const REVIEWED_VECTORS_SHA256 =
  "4f15e698faca2a32ebc28830ef6b94483249910d725148af4f8eb0695c0e08c8";

const EXPECTED_INVARIANT_IDS = [
  "fleischner-input-completeness-fail-closed",
  "fleischner-nodule-domain-boundary",
  "fleischner-measurement-input-geometry",
  "fleischner-state-consistency-fail-closed",
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
  "No measurement-statement PDF is pinned; HTML claims are machine-extracted from the publisher full-text fragment, while Figure 1 text is a hash-bound reviewed raster transcription whose exact link, bytes, format, and dimensions are verified by CI.",
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
assert.equal(
  Buffer.isBuffer(verifiedSyntheticArtifact.verified_bytes),
  true,
  "verified artifact bytes must remain available for literal source parsing",
);
assert.equal(
  verifiedSyntheticArtifact.verified_bytes.equals(archivedHtml),
  true,
  "literal parsing must receive the exact byte-verified artifact",
);
assert.equal(
  Buffer.isBuffer(verifiedSyntheticArtifact.verified_fragment_bytes),
  true,
  "the exact verified full-text fragment must remain available for anchor parsing",
);
assert.equal(
  verifiedSyntheticArtifact.verified_fragment_bytes.equals(inclusiveFragment),
  true,
  "anchor parsing must receive the exact byte-verified fragment",
);
const serializedSyntheticVerification = JSON.stringify(verifiedSyntheticArtifact);
assert.equal(serializedSyntheticVerification.includes("verified_bytes"), false);
assert.equal(serializedSyntheticVerification.includes("verified_fragment_bytes"), false);
assert.equal(
  serializedSyntheticVerification.includes("alpha"),
  false,
  "verified source bytes must not leak into JSON audit evidence",
);

assert.equal(
  typeof auditModule.extractPdfPageTexts,
  "function",
  "the audit must expose page-bounded PDF text extraction",
);
assert.equal(
  typeof auditModule.extractHtmlLocatorTexts,
  "function",
  "the audit must expose anchor-bounded HTML text extraction",
);
assert.equal(
  typeof auditModule.extractHtmlLiteralText,
  "function",
  "the audit must expose canonical HTML literal normalization",
);
assert.equal(
  auditModule.extractHtmlLiteralText(Buffer.from("<p>A&nbsp;B &ge; 2</p>")),
  "A B >= 2",
);
assert.equal(
  typeof auditModule.verifyLiteralSourceBindings,
  "function",
  "the audit must expose claim-to-source-text verification",
);

const syntheticPdfPages = await auditModule.extractPdfPageTexts(
  Buffer.from("synthetic-pdf"),
  [2, 3],
  {
    expectedPageCount: 3,
    getDocumentImpl({ data }) {
      assert.equal(data instanceof Uint8Array, true);
      assert.equal(Buffer.from(data).toString("utf8"), "synthetic-pdf");
      return {
        promise: Promise.resolve({
          numPages: 3,
          async getPage(pageNumber) {
            const items =
              pageNumber === 2
                ? [
                    { str: "adult patients who are at least 35 years old" },
                    { str: "known primary cancers" },
                    { str: "immuno-", hasEOL: true },
                    { str: "compromised patients" },
                    { str: "long-" },
                    { str: "and short axes" },
                  ]
                : [
                    { str: "No routine follow-up" },
                    { str: "Use most suspicious nodule as guide" },
                  ];
            return {
              async getTextContent() {
                return { items };
              },
            };
          },
          async destroy() {},
        }),
      };
    },
  },
);
assert.deepEqual(syntheticPdfPages, new Map([
  ["guideline-vor-pdf:pdf-page:2", "adult patients who are at least 35 years old known primary cancers immunocompromised patients long- and short axes"],
  ["guideline-vor-pdf:pdf-page:3", "No routine follow-up Use most suspicious nodule as guide"],
]));

const detachablePdfBytes = Buffer.allocUnsafeSlow(13);
detachablePdfBytes.write("synthetic-pdf");
const detachablePdfDigest = rawSha256(detachablePdfBytes);
await auditModule.extractPdfPageTexts(detachablePdfBytes, [1], {
  expectedPageCount: 1,
  getDocumentImpl({ data }) {
    structuredClone(data.buffer, { transfer: [data.buffer] });
    return {
      promise: Promise.resolve({
        numPages: 1,
        async getPage() {
          return {
            async getTextContent() {
              return { items: [{ str: "retained source text" }] };
            },
          };
        },
        async destroy() {},
      }),
    };
  },
});
assert.equal(
  detachablePdfBytes.length,
  13,
  "pdf.js must not detach the retained byte-verified artifact",
);
assert.equal(
  rawSha256(detachablePdfBytes),
  detachablePdfDigest,
  "literal parsing must preserve the retained artifact hash",
);
await assert.rejects(
  auditModule.extractPdfPageTexts(Buffer.from("wrong-page-count"), [1], {
    expectedPageCount: 16,
    getDocumentImpl() {
      return {
        promise: Promise.resolve({
          numPages: 15,
          async getPage() {
            return {
              async getTextContent() {
                return { items: [{ str: "unexpected" }] };
              },
            };
          },
          async destroy() {},
        }),
      };
    },
  }),
  /expected 16 PDF pages, received 15/i,
  "the pinned guideline parser must reject a changed page count",
);

const syntheticFullText = Buffer.from(
  '<div class="hlFld-Fulltext"><h3 id="_i5">Dimensions</h3><p>Small nodules use average long and short axes.</p><h3 id="_i8">Measurement Unit</h3><p>Record the nearest whole millimeter.</p><figure id="fig6"><figcaption>Nodules 3 mm or smaller should not be measured.</figcaption></figure></div><!--/fulltext content-->',
);
const syntheticHtmlLocators = auditModule.extractHtmlLocatorTexts(
  syntheticFullText,
  { sectionIds: ["_i5", "_i8"], figureIds: ["fig6"] },
);
assert.deepEqual(syntheticHtmlLocators, new Map([
  ["measurement-fulltext:html-section:#_i5", "Dimensions Small nodules use average long and short axes."],
  ["measurement-fulltext:html-section:#_i8", "Measurement Unit Record the nearest whole millimeter. Nodules 3 mm or smaller should not be measured."],
  ["measurement-fulltext:html-figure:#fig6", "Nodules 3 mm or smaller should not be measured."],
]));
assert.throws(
  () =>
    auditModule.extractHtmlLocatorTexts(
      Buffer.from('<h3 id="_i5">one</h3><h3 id="_i5">two</h3>'),
      { sectionIds: ["_i5"], figureIds: [] },
    ),
  /exactly one.*_i5/i,
  "ambiguous anchors must fail closed",
);
assert.throws(
  () =>
    auditModule.extractHtmlLocatorTexts(syntheticFullText, {
      sectionIds: ["_i8", "_i5"],
      figureIds: [],
    }),
  /section anchors must follow document order/i,
  "reordered requested anchors must fail closed",
);

assert.equal(
  typeof auditModule.verifyPinnedFigureArtifact,
  "function",
  "the audit must expose exact publisher-figure linkage and dimension verification",
);
const syntheticFigureHtml = Buffer.from(
  '<figure id="fig1"><img src="/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif" data-src="/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif" data-lg-src="/cms/10.1148/radiol.2017162894/asset/images/large/radiol.2017162894.fig1.jpeg"><figcaption>Figure 1: Measurement recommendations.</figcaption></figure>',
);
const syntheticFigureGif = Buffer.alloc(10);
syntheticFigureGif.write("GIF87a", 0, "ascii");
syntheticFigureGif.writeUInt16LE(387, 6);
syntheticFigureGif.writeUInt16LE(500, 8);
assert.deepEqual(
  auditModule.verifyPinnedFigureArtifact(
    syntheticFigureHtml,
    syntheticFigureGif,
    {
      artifactId: "measurement-figure-1",
      figureId: "fig1",
      expectedOriginUrl:
        "https://pubs.rsna.org/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif",
      expectedWidth: 387,
      expectedHeight: 500,
    },
  ),
  {
    artifact_id: "measurement-figure-1",
    figure_id: "fig1",
    linked_origin_url:
      "https://pubs.rsna.org/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif",
    format: "GIF87a",
    width: 387,
    height: 500,
  },
);
assert.throws(
  () =>
    auditModule.verifyPinnedFigureArtifact(
      Buffer.from(
        '<figure id="fig1"><img src="/wrong.gif"></figure>',
      ),
      syntheticFigureGif,
      {
        artifactId: "measurement-figure-1",
        figureId: "fig1",
        expectedOriginUrl:
          "https://pubs.rsna.org/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif",
        expectedWidth: 387,
        expectedHeight: 500,
      },
    ),
  /publisher figure link/i,
  "a relinked figure must fail closed",
);
const wrongDimensionGif = Buffer.from(syntheticFigureGif);
wrongDimensionGif.writeUInt16LE(386, 6);
assert.throws(
  () =>
    auditModule.verifyPinnedFigureArtifact(
      syntheticFigureHtml,
      wrongDimensionGif,
      {
        artifactId: "measurement-figure-1",
        figureId: "fig1",
        expectedOriginUrl:
          "https://pubs.rsna.org/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif",
        expectedWidth: 387,
        expectedHeight: 500,
      },
    ),
  /GIF width/i,
  "a dimension-changed figure must fail closed",
);

const syntheticLocatorText =
  "adult patients who are at least 35 years old known primary cancers";
const syntheticLocatorSha = rawSha256(Buffer.from(syntheticLocatorText));
const syntheticFixtureCases = [
  {
    id: "vector-a",
    inputs: { applicability: "eligible" },
    expect: { fields: [{ key: "Recommendation", includes: "CT" }] },
  },
];
assert.throws(
  () =>
    auditModule.assertFixtureExpectation(
      { Error: "invalid input", Recommendation: "unsafe schedule" },
      {
        noError: false,
        fields: [{ key: "Error", includes: "invalid" }],
      },
      "mixed-error-output",
    ),
  /error result must contain only Error/i,
  "an error result must never carry a simultaneous clinical recommendation",
);
assert.equal(
  auditModule.verifyClaimSourceProvenance(
    [
      {
        id: "valid-source-claim",
        source_url: GUIDELINE_URL,
        source_text_assertions: [{ artifact_id: "guideline-vor-pdf" }],
      },
    ],
    [
      {
        id: "rsna-guideline",
        url: GUIDELINE_URL,
        artifacts: [{ id: "guideline-vor-pdf" }],
      },
      {
        id: "rsna-measurement",
        url: MEASUREMENT_URL,
        artifacts: [{ id: "measurement-fulltext" }],
      },
    ],
  ),
  true,
);
assert.throws(
  () =>
    auditModule.verifyClaimSourceProvenance(
      [
        {
          id: "cross-source-claim",
          source_url: GUIDELINE_URL,
          source_text_assertions: [{ artifact_id: "measurement-fulltext" }],
        },
      ],
      [
        {
          id: "rsna-guideline",
          url: GUIDELINE_URL,
          artifacts: [{ id: "guideline-vor-pdf" }],
        },
        {
          id: "rsna-measurement",
          url: MEASUREMENT_URL,
          artifacts: [{ id: "measurement-fulltext" }],
        },
      ],
    ),
  /artifact measurement-fulltext is not declared by source/i,
  "a claim must not borrow a literal assertion from another declared source",
);
assert.throws(
  () =>
    auditModule.verifyClaimSourceProvenance(
      [
        {
          id: "ambiguous-owner-claim",
          source_url: GUIDELINE_URL,
          source_text_assertions: [{ artifact_id: "shared-artifact" }],
        },
      ],
      [
        {
          id: "rsna-guideline",
          url: GUIDELINE_URL,
          artifacts: [{ id: "shared-artifact" }],
        },
        {
          id: "rsna-measurement",
          url: MEASUREMENT_URL,
          artifacts: [{ id: "shared-artifact" }],
        },
      ],
    ),
  /duplicate artifact ID shared-artifact/i,
  "artifact ownership must remain globally unique across declared sources",
);
const syntheticBindings = auditModule.verifyLiteralSourceBindings(
  [
    {
      id: "fleischner-test-claim",
      vector_ids: ["vector-a"],
      source_text_assertions: [
        {
          artifact_id: "guideline-vor-pdf",
          locator: "pdf-page:2",
          locator_text_sha256: syntheticLocatorSha,
          required_snippets: [
            "adult patients who are at least 35 years old",
            "known primary cancers",
          ],
        },
      ],
    },
  ],
  new Map([
    ["guideline-vor-pdf:pdf-page:2", syntheticLocatorText],
  ]),
  {
    expectedClaimIds: ["fleischner-test-claim"],
    fixtureCases: syntheticFixtureCases,
  },
);
assert.deepEqual(syntheticBindings, [
  {
    claim_id: "fleischner-test-claim",
    vector_ids: ["vector-a"],
    vector_count: 1,
    vector_binding_sha256: digest(syntheticFixtureCases),
    locator_assertions: [
      {
        artifact_id: "guideline-vor-pdf",
        locator: "pdf-page:2",
        locator_text_sha256: syntheticLocatorSha,
        required_snippet_count: 2,
      },
    ],
  },
]);
assert.throws(
  () =>
    auditModule.verifyLiteralSourceBindings(
      [
        {
          id: "mutated-claim",
          vector_ids: ["vector-a"],
          source_text_assertions: [
            {
              artifact_id: "guideline-vor-pdf",
              locator: "pdf-page:2",
              locator_text_sha256: syntheticLocatorSha,
              required_snippets: ["immunocompromised patients"],
            },
          ],
        },
      ],
      new Map([
        ["guideline-vor-pdf:pdf-page:2", syntheticLocatorText],
      ]),
      {
        expectedClaimIds: ["mutated-claim"],
        fixtureCases: syntheticFixtureCases,
      },
    ),
  /missing literal snippet/i,
  "a source-text mutation must invalidate its bound clinical claim",
);
assert.throws(
  () =>
    auditModule.verifyLiteralSourceBindings(
      [
        {
          id: "duplicate-claim",
          vector_ids: ["vector-a"],
          source_text_assertions: [
            {
              artifact_id: "guideline-vor-pdf",
              locator: "pdf-page:2",
              locator_text_sha256: syntheticLocatorSha,
              required_snippets: ["known primary cancers"],
            },
          ],
        },
        {
          id: "duplicate-claim",
          vector_ids: ["vector-a"],
          source_text_assertions: [
            {
              artifact_id: "guideline-vor-pdf",
              locator: "pdf-page:2",
              locator_text_sha256: syntheticLocatorSha,
              required_snippets: ["known primary cancers"],
            },
          ],
        },
      ],
      new Map([
        ["guideline-vor-pdf:pdf-page:2", syntheticLocatorText],
      ]),
      {
        expectedClaimIds: ["duplicate-claim", "another-claim"],
        fixtureCases: syntheticFixtureCases,
      },
    ),
  /claim IDs: duplicate entry/i,
  "duplicate literal claim IDs must fail closed",
);
assert.throws(
  () =>
    auditModule.verifyLiteralSourceBindings(
      [
        {
          id: "duplicate-locator-claim",
          vector_ids: ["vector-a"],
          source_text_assertions: [
            {
              artifact_id: "guideline-vor-pdf",
              locator: "pdf-page:2",
              locator_text_sha256: syntheticLocatorSha,
              required_snippets: ["known primary cancers"],
            },
            {
              artifact_id: "guideline-vor-pdf",
              locator: "pdf-page:2",
              locator_text_sha256: syntheticLocatorSha,
              required_snippets: ["adult patients"],
            },
          ],
        },
      ],
      new Map([
        ["guideline-vor-pdf:pdf-page:2", syntheticLocatorText],
      ]),
      {
        expectedClaimIds: ["duplicate-locator-claim"],
        fixtureCases: syntheticFixtureCases,
      },
    ),
  /literal locator keys: duplicate entry/i,
  "duplicate locator bindings within one claim must fail closed",
);
assert.throws(
  () =>
    auditModule.verifyLiteralSourceBindings(
      [
        {
          id: "missing-vector-claim",
          vector_ids: ["vector-not-in-fixture"],
          source_text_assertions: [
            {
              artifact_id: "guideline-vor-pdf",
              locator: "pdf-page:2",
              locator_text_sha256: syntheticLocatorSha,
              required_snippets: ["known primary cancers"],
            },
          ],
        },
      ],
      new Map([
        ["guideline-vor-pdf:pdf-page:2", syntheticLocatorText],
      ]),
      {
        expectedClaimIds: ["missing-vector-claim"],
        fixtureCases: syntheticFixtureCases,
      },
    ),
  /missing fixture vector vector-not-in-fixture/i,
  "literal bindings must fail when a sealed fixture vector is absent",
);

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
assert.equal(audit.schema, "radulator-fleischner-primary-source-audit/v4");
assert.equal(
  Object.hasOwn(audit, "source_claims"),
  false,
  "v4 must remove the legacy hard-coded source_claims object",
);
assert.equal(
  audit.source_text_verification.schema,
  "radulator-literal-source-bindings/v1",
);
assert.equal(audit.source_text_verification.claim_count, 12);
assert.equal(audit.source_text_verification.locator_assertion_count, 27);
assert.equal(audit.source_text_verification.required_snippet_count, 37);
assert.deepEqual(
  audit.source_text_verification.claims.map((claim) => claim.claim_id),
  EXPECTED_CLAIM_IDS,
);
assert.deepEqual(audit.source_text_verification.figure_artifact, {
  artifact_id: "measurement-figure-1",
  figure_id: "fig1",
  linked_origin_url:
    "https://pubs.rsna.org/cms/10.1148/radiol.2017162894/asset/images/medium/radiol.2017162894.fig1.gif",
  format: "GIF87a",
  width: 387,
  height: 500,
});
assert.deepEqual(audit.source_text_verification.reviewed_transcriptions, [
  {
    id: "fleischner-measurement-figure1-solid-component",
    claim_id: "fleischner-2017-measurement-contract",
    artifact_id: "measurement-figure-1",
    artifact_sha256:
      "5ec3df4bb0491f3d0eca1d84b85bd77882161d9c5628c0151b24f7e5a8f070a9",
    review_mode: "hash-bound-reviewed-raster-transcription",
    width: 387,
    height: 500,
    transcription:
      "For all part-solid nodules, the maximum diameter of the solid component should be measured if this component is >3 mm, understanding that measurements may be unreliable for small solid components. Dimensions of both solid and nonsolid components should be recorded to document change in the future (grade 2B evidence).",
    vector_ids: [
      "part-solid-categorical-lte3-component-avoids-false-precision",
      "part-solid-measured-component-at-3-mm-rejected",
    ],
  },
]);
assert.equal(
  audit.source_runtime_bindings.schema,
  "radulator-source-runtime-bindings/v1",
);
assert.deepEqual(
  audit.source_runtime_bindings.claims.map((claim) => claim.claim_id),
  EXPECTED_CLAIM_IDS,
);
assert.equal(
  audit.source_runtime_bindings.claims.every(
    (claim) =>
      claim.synthesis_vector_count === claim.synthesis_vector_ids.length &&
      /^[a-f0-9]{64}$/.test(claim.synthesis_vector_sha256),
  ),
  true,
  "each reviewed synthesis must bind its exact sealed fixture vectors",
);
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
  manifest_schema: "radulator-reviewed-source-evidence/v3",
  payload_sha256: PAYLOAD_SHA256,
  reviewer_schema: "radulator-independent-source-review/v1",
  reviewer_role: "independent-clinical-source-reviewer",
  reviewer_revision: "fleischner-source-review/2026-08-31-r10",
  reviewed_at: "2026-08-31T01:21:01Z",
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
  "Fleischner source audit verified 3 byte-pinned RSNA-origin Mementos, 27 literal locator assertions with 37 required snippets across 12 claims, 4 implementation invariants, all 113 executable vectors, primary DOI identities, and live NLM fragments.",
);
