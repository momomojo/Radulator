#!/usr/bin/env node

// Offline tests for the NLM bot-challenge fallback in
// scripts/audit-fleischner-primary-source.mjs. No network access.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  EXPECTED_TABLES,
  PINNED_NLM_TABLES_PATH,
  detectNlmBotChallenge,
  extractHtmlLiteralText,
  loadNlmTable,
  verifyLiteralSourceBindings,
  verifyNlmTableEvidence,
  verifyPinnedNlmPrimaryComparison,
  verifyPinnedNlmTables,
} from "./audit-fleischner-primary-source.mjs";
import { digest } from "./release-policy.mjs";

const PINNED_RECORD_SHA256 =
  "9b6afdb68a3fef320333320f07e5267f4c3d8b495a500a9de135b8dcfa41446f";
const CHALLENGE_MESSAGE = /live source challenged by NLM bot protection; verified against pinned copy [a-f0-9]{64}$/;

const record = JSON.parse(readFileSync(PINNED_NLM_TABLES_PATH, "utf8"));
const manifest = JSON.parse(
  readFileSync("docs/evidence/fleischner-2017-reviewed-evidence.json", "utf8"),
);
const fixture = JSON.parse(
  readFileSync("tests/fixtures/compute/fleischner.json", "utf8"),
);
const TABLES = Object.values(EXPECTED_TABLES);

// Structural skeleton of the page NLM served for both table URLs on
// 2026-09-24/25. Scripts, CSP nonces, the site key and the session token are
// removed; only the challenge signature the audit relies on is kept.
const CHALLENGE_HTML = [
  '<!doctype html><html lang="en-US" dir="ltr"><head>',
  '<base href="https://www.google.com/recaptcha/challengepage/">',
  '<link rel="canonical" href="https://www.google.com/recaptcha/challengepage">',
  "<title>Checking your browser - reCAPTCHA</title>",
  "</head><body>",
  '<div class="fBEGtb">Checking your browser before accessing www.ncbi.nlm.nih.gov ...</div>',
  '<div class="cqQpAf">Click <a href="#">here</a> if you are not automatically redirected after 5 seconds.</div>',
  '<div class="g-recaptcha" data-sitekey="REDACTED" data-callback="onSuccess" data-size="invisible"></div>',
  `<script>/* ${"challenge script removed from fixture; ".repeat(12)}*/</script>`,
  "</body></html>",
].join("");

const NOT_FOUND_HTML = [
  "<!DOCTYPE html><html><head><title>Page not available - NCBI Bookshelf</title></head>",
  `<body><h1>Page not available</h1><p>${"The requested table could not be displayed. ".repeat(12)}</p></body></html>`,
].join("");

function pinnedTables() {
  return verifyPinnedNlmTables(record);
}

function recordTable(objectId, source = record) {
  return source.tables.find((table) => table.object_id === objectId);
}

// Render pinned cells the way NLM Bookshelf encodes them (numeric entities
// for dashes and comparison signs) inside an otherwise ordinary page.
function nlmEntities(text) {
  return text
    .replace(/(\d)-(\d)/g, "$1&#x02013;$2")
    .replace(/>=/g, "&#x02265;")
    .replace(/</g, "&#x0003c;")
    .replace(/>/g, "&#x0003e;");
}

function tablePage(table, mutateFragment = (fragment) => fragment) {
  const row = (tag, cells) =>
    `<tr>${cells.map((cell) => `<${tag}>${nlmEntities(cell)}</${tag}>`).join("")}</tr>`;
  const fragment = mutateFragment(
    `<table><thead>${row("th", table.header_cells)}</thead><tbody>${table.body_rows
      .map((cells) => row("td", cells))
      .join("")}</tbody></table>`,
  );
  return {
    fragment,
    html: `<!DOCTYPE html><html><head><title>${table.label}</title></head><body><div class="large_tbl">${fragment}</div></body></html>`,
  };
}

// Expected identity of a synthetic live page: same object and snippets as the
// real audit, with fragment bytes/SHA-256 of the synthetic markup.
function liveSpec(expected, fragment) {
  return { ...expected, bytes: Buffer.byteLength(fragment), sha256: digest(fragment) };
}

function response({ status = 200, url, body, contentType = "text/html; charset=utf-8" }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    url,
    headers: new Headers({ "content-type": contentType }),
    body: { cancel: async () => {} },
    async text() {
      return body;
    },
  };
}

const noSleep = async () => {};

function clone(value) {
  return structuredClone(value);
}

test("recognises only the NLM reCAPTCHA interstitial as a bot challenge", () => {
  assert.deepEqual(detectNlmBotChallenge(CHALLENGE_HTML), {
    challenged: true,
    title: "Checking your browser - reCAPTCHA",
    markers: [
      "https://www.google.com/recaptcha/challengepage",
      'class="g-recaptcha"',
    ],
  });
  const notChallenges = {
    "a page that contains a table": CHALLENGE_HTML.replace(
      "</body>",
      "<table><tr><td>x</td></tr></table></body>",
    ),
    "another title": CHALLENGE_HTML.replace(
      "Checking your browser - reCAPTCHA",
      "NCBI Bookshelf",
    ),
    "no reCAPTCHA widget": CHALLENGE_HTML.replace('class="g-recaptcha"', 'class="widget"'),
    "no reCAPTCHA challenge page": CHALLENGE_HTML.replaceAll(
      "https://www.google.com/recaptcha/challengepage",
      "https://example.test/check",
    ),
    "an ordinary page without the table": NOT_FOUND_HTML,
    "an empty body": "",
  };
  for (const [name, html] of Object.entries(notChallenges)) {
    assert.equal(detectNlmBotChallenge(html).challenged, false, name);
  }
});

test("challenge page is verified against the pinned copy with an explicit message", async () => {
  const pinned = pinnedTables();
  const locatorTexts = new Map();
  for (const expected of TABLES) {
    let calls = 0;
    const html = await loadNlmTable(expected.url, expected.objectId, {
      sleepImpl: noSleep,
      fetchImpl: async (url) => {
        calls += 1;
        return response({ url, body: CHALLENGE_HTML });
      },
    });
    assert.equal(calls, 1, "a challenge page is a successful response and is not retried");
    const evidence = verifyNlmTableEvidence(html, expected, pinned);
    assert.equal(evidence.mode, "pinned");
    assert.equal(
      evidence.message,
      `NLM ${expected.objectId} (${expected.label}): live source challenged by NLM bot protection; verified against pinned copy ${PINNED_RECORD_SHA256}`,
    );
    assert.match(evidence.message, CHALLENGE_MESSAGE);
    assert.equal(digest(evidence.locatorText), expected.locatorTextSha256);
    locatorTexts.set(
      `${expected.sourceId}:html-table:${expected.objectId}`,
      evidence.locatorText,
    );
  }

  // The reviewed NLM claims (exact locator hash plus required snippets) hold
  // against the pinned copies, with the manifest and vectors unchanged.
  const nlmClaims = manifest.payload.claims.filter((claim) =>
    claim.source_text_assertions.some((binding) =>
      binding.artifact_id.startsWith("nlm-"),
    ),
  );
  const bindings = verifyLiteralSourceBindings(nlmClaims, locatorTexts, {
    expectedClaimIds: [
      "nlm-fleischner-solid-table-cross-check",
      "nlm-fleischner-subsolid-table-cross-check",
    ],
    fixtureCases: fixture.cases,
  });
  assert.deepEqual(
    bindings.map((binding) => binding.locator_assertions[0].locator),
    ["html-table:ch5.Tab1", "html-table:ch5.Tab2"],
  );
});

test("a served table takes the unchanged live path without consulting the pinned copy", async () => {
  for (const expected of TABLES) {
    const page = tablePage(recordTable(expected.objectId));
    const html = await loadNlmTable(expected.url, expected.objectId, {
      sleepImpl: noSleep,
      fetchImpl: async (url) => response({ url, body: page.html }),
    });
    const evidence = verifyNlmTableEvidence(
      html,
      liveSpec(expected, page.fragment),
      new Map(),
    );
    assert.equal(evidence.mode, "live");
    assert.equal(evidence.fragment, page.fragment);
    assert.equal(evidence.message, undefined);
    assert.equal(
      evidence.locatorText,
      extractHtmlLiteralText(page.fragment),
    );
    assert.equal(
      digest(evidence.locatorText),
      expected.locatorTextSha256,
      "the same table content served live reproduces the reviewed locator hash",
    );
  }
});

test("changed table values fail on the live path and in the pinned copy", () => {
  const expected = EXPECTED_TABLES.solid;
  const page = tablePage(recordTable(expected.objectId));
  const changed = tablePage(recordTable(expected.objectId), (fragment) =>
    fragment.replace("Optional CT at 12 months", "Optional CT at 24 months"),
  );
  assert.throws(
    () => verifyNlmTableEvidence(changed.html, liveSpec(expected, page.fragment), pinnedTables()),
    /solid table: SHA-256/,
    "a changed live cell must fail its reviewed fragment identity",
  );

  const tampered = clone(record);
  recordTable(expected.objectId, tampered).body_rows[0][2] = "Optional CT at 24 months";
  assert.throws(
    () => verifyPinnedNlmTables(tampered),
    /pinned NLM table record: SHA-256 mismatch/,
  );
  assert.throws(
    () => verifyPinnedNlmTables(tampered, { expectedRecordSha256: digest(tampered) }),
    /pinned NLM ch5\.Tab1: normalized text SHA-256/,
    "a re-hashed record still cannot hide a changed cell",
  );
  const table = recordTable(expected.objectId, tampered);
  table.normalized_text_sha256 = digest(
    [...table.header_cells, ...table.body_rows.flat()].join(" "),
  );
  assert.throws(
    () => verifyPinnedNlmTables(tampered, { expectedRecordSha256: digest(tampered) }),
    /pinned cells must reproduce the reviewed locator text SHA-256/,
    "the pinned cells stay bound to the reviewed manifest locator hash",
  );
});

test("non-challenge HTML without the table and non-challenge failures still fail closed", async () => {
  const pinned = pinnedTables();
  const expected = EXPECTED_TABLES.solid;
  for (const html of [
    NOT_FOUND_HTML,
    CHALLENGE_HTML.replace('class="g-recaptcha"', 'class="widget"'),
    CHALLENGE_HTML.replace("Checking your browser - reCAPTCHA", "Checking your browser"),
  ]) {
    assert.throws(
      () => verifyNlmTableEvidence(html, expected, pinned),
      /solid table: table fragment not found/,
    );
  }
  assert.throws(
    () =>
      verifyNlmTableEvidence(
        CHALLENGE_HTML.replace("</body>", "<table><tr><td>Changed</td></tr></table></body>"),
        expected,
        pinned,
      ),
    /solid table: bytes/,
    "a page that has a table is never treated as a challenge",
  );
  assert.throws(
    () => verifyNlmTableEvidence(CHALLENGE_HTML, expected, new Map()),
    /live source challenged by NLM bot protection and no verified pinned copy is available/,
  );

  let forbiddenCalls = 0;
  await assert.rejects(
    loadNlmTable(expected.url, expected.objectId, {
      sleepImpl: noSleep,
      fetchImpl: async (url) => {
        forbiddenCalls += 1;
        return response({ status: 403, url, body: CHALLENGE_HTML });
      },
    }),
    /NLM ch5\.Tab1: HTTP 403/,
    "a challenge that is not a successful response keeps failing",
  );
  assert.equal(forbiddenCalls, 1);
  await assert.rejects(
    loadNlmTable(expected.url, expected.objectId, {
      sleepImpl: noSleep,
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    }),
    /NLM ch5\.Tab1: retrieval failed after 3 attempts/,
  );
  await assert.rejects(
    loadNlmTable(expected.url, expected.objectId, {
      sleepImpl: noSleep,
      fetchImpl: async () =>
        response({
          url: "https://www.google.com/recaptcha/challengepage/",
          body: CHALLENGE_HTML,
        }),
    }),
    /NLM ch5\.Tab1: unexpected final URL/,
  );
});

test("a pinned record hash mismatch fails", () => {
  assert.equal(digest(record), PINNED_RECORD_SHA256);
  const edits = [
    (copy) => {
      copy.independent_comparison.second_retrieval_path.package_sha256 = "0".repeat(64);
    },
    (copy) => {
      copy.authorization.scope = `${copy.authorization.scope} Also skip the live check.`;
    },
    (copy) => {
      copy.tables[1].primary_comparison.cells[0].agreement = "equivalent-wording";
    },
  ];
  for (const edit of edits) {
    const copy = clone(record);
    edit(copy);
    assert.throws(
      () => verifyPinnedNlmTables(copy),
      /pinned NLM table record: SHA-256 mismatch/,
    );
  }
  assert.throws(
    () => verifyPinnedNlmTables(record, { expectedRecordSha256: "f".repeat(64) }),
    /pinned NLM table record: SHA-256 mismatch/,
  );
});

test("the recorded RSNA Table 1 comparison is re-checked cell by cell", () => {
  const rsnaPage = record.tables
    .flatMap((table) =>
      table.primary_comparison.rsna_rows.map((row) =>
        [row.text_layer_label, ...row.cells].join(" "),
      ),
    )
    .join(" Comment text. ");
  const locatorTexts = new Map([["guideline-vor-pdf:pdf-page:3", rsnaPage]]);
  assert.deepEqual(verifyPinnedNlmPrimaryComparison(pinnedTables(), locatorTexts), [
    {
      object_id: "ch5.Tab1",
      rsna_table: "Table 1A (solid nodules)",
      locator: "guideline-vor-pdf:pdf-page:3",
      compared_cells: 12,
      agreement_counts: { identical: 8, "equivalent-wording": 4 },
    },
    {
      object_id: "ch5.Tab2",
      rsna_table: "Table 1B (subsolid nodules)",
      locator: "guideline-vor-pdf:pdf-page:3",
      compared_cells: 6,
      agreement_counts: { identical: 5, "identical-except-text-layer-glyph": 1 },
    },
  ]);
  assert.match(
    record.independent_comparison.primary_publication.result,
    /13 identical, 4 equivalent wording and 1 identical apart from a PDF text-layer glyph/,
  );

  assert.throws(
    () =>
      verifyPinnedNlmPrimaryComparison(
        pinnedTables(),
        new Map([
          [
            "guideline-vor-pdf:pdf-page:3",
            rsnaPage.replace("then at 18-24 months CT", "then at 12-24 months CT"),
          ],
        ]),
      ),
    /RSNA row "Multiple, high risk" not found/,
    "the recorded RSNA wording must exist in the primary page text",
  );

  const cellEdits = [
    [
      (copy) => {
        copy.tables[0].primary_comparison.cells[4].agreement = "identical";
        delete copy.tables[0].primary_comparison.cells[4].note;
      },
      /cells recorded as identical differ/,
    ],
    [
      // NLM ">8 mm, low risk" (3 months) mapped onto RSNA "6-8 mm, low risk".
      (copy) => {
        copy.tables[0].primary_comparison.cells[4].rsna_column = 1;
      },
      /intervals differ/,
    ],
    [
      // Required follow-up must never be matched to optional ("consider") wording.
      (copy) => {
        copy.tables[0].primary_comparison.cells[9].rsna_row = 2;
      },
      /follow-up qualifiers differ/,
    ],
    [
      (copy) => {
        copy.tables[1].primary_comparison.cells.pop();
      },
      /duplicate RSNA cell mapping|compared exactly once/,
    ],
  ];
  for (const [edit, error] of cellEdits) {
    const copy = clone(record);
    edit(copy);
    const tables = verifyPinnedNlmTables(copy, { expectedRecordSha256: digest(copy) });
    assert.throws(() => verifyPinnedNlmPrimaryComparison(tables, locatorTexts), error);
  }
});
