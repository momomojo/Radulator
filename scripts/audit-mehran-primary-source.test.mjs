#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-mehran-primary-source.mjs",
    "--json",
  ],
  { cwd: process.cwd(), encoding: "utf8", timeout: 240_000 },
);

assert.equal(
  run.status,
  0,
  `Mehran primary-source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);

const regressionTests = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "--test",
    "tests/mehran-safety-compute.test.mjs",
  ],
  { cwd: process.cwd(), encoding: "utf8", timeout: 120_000 },
);
assert.equal(
  regressionTests.status,
  0,
  `Mehran safety regression tests failed\nstdout:\n${regressionTests.stdout}\nstderr:\n${regressionTests.stderr}`,
);

const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-mehran-primary-source-audit/v1");
assert.equal(audit.calculator_id, "mehran-cin");
assert.equal(audit.runtime_source, "src/components/calculators/MehranCIN.jsx");
// The audited runtime is pinned: any change to the calculator must re-review this audit.
assert.equal(audit.runtime_source_bytes, 10_908);
assert.equal(
  audit.runtime_source_sha256,
  "5db4c832f7c1adbf102ce39117091207c7c5cba9cc8f0cc686df7b8b9b33fda5",
);

assert.deepEqual(
  audit.sources.map(({ key, url, final_host, final_path, media_type, digest_of, bytes, sha256 }) => ({
    key,
    url,
    final_host,
    final_path,
    media_type,
    digest_of,
    bytes,
    sha256,
  })),
  [
    {
      key: "pubmed",
      url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=15464318,34793743&retmode=xml",
      final_host: "eutils.ncbi.nlm.nih.gov",
      final_path: "/entrez/eutils/efetch.fcgi",
      media_type: "text/xml",
      digest_of: "normalized-record-fields",
      bytes: 5_891,
      sha256: "c110bcca6d33f96295d636d57b8e547b6eb9aa29363149f7497dafe0fb1ed9d9",
    },
    {
      key: "kdigo",
      url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=4089629&retmode=xml",
      final_host: "eutils.ncbi.nlm.nih.gov",
      final_path: "/entrez/eutils/efetch.fcgi",
      media_type: "text/xml",
      digest_of: "raw-artifact",
      bytes: 272_094,
      sha256: "b8775bd178b990bc0e6dd38e60fd03ffd0cee9ebf63f021bacc4eeb18ed77e22",
    },
    {
      key: "esur",
      url: "https://esur-cm.org/index.php/en/b-renal-adverse-reactions",
      final_host: "esur-cm.org",
      final_path: "/index.php/en/b-renal-adverse-reactions",
      media_type: "text/html",
      digest_of: "content-region",
      bytes: 8_558,
      sha256: "1f81890a1cc102b311e9724327d75ef27540279a3a6facdf6e5a0ddcb20a6b68",
    },
    {
      key: "acr",
      url: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/ACR-Manual-on-Contrast-Media.pdf",
      final_host: "edge.sitecorecloud.io",
      final_path:
        "/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/ACR-Manual-on-Contrast-Media.pdf",
      media_type: "application/pdf",
      digest_of: "raw-artifact",
      bytes: 1_765_419,
      sha256: "24bfacd3344310d1546636f50aabba11d6458f432b3c8b1205d9c63efe751be2",
    },
  ],
);

assert.equal(
  audit.sources.find(({ key }) => key === "esur").content_region,
  "anchor B_1 up to anchor B_6 (B.1 through the end of B.5), markupText-normalized",
);

assert.deepEqual(audit.parsers, {
  pdf: "pdfjs-dist@4.10.38",
  markup: "scripts/audit-mehran-primary-source.mjs markupText (deterministic tag/entity normalizer)",
});

// Reviewed statements: markers, span digests, identities and paraphrases (no source text).
assert.equal(audit.source_statement_count, 41);
assert.equal(audit.source_statements.length, 41);
assert.equal(
  audit.source_statements_sha256,
  "e1f3181a478462eb00abf0f5144a2dd533e4fce32ba876eda912edfc90be3fca",
);
assert.deepEqual(
  audit.source_statements.map(({ source }) => source).reduce((counts, source) => {
    counts[source] = (counts[source] ?? 0) + 1;
    return counts;
  }, {}),
  { pubmed: 11, kdigo: 9, esur: 9, acr: 12 },
);
let pinnedSpans = 0;
for (const statement of audit.source_statements) {
  assert.ok(statement.paraphrase.length > 0, `${statement.id}: paraphrase missing`);
  assert.equal("statement" in statement, false, `${statement.id}: source text must not be emitted`);
  const kinds = ["identity", "table", "spans"].filter((kind) => kind in statement);
  assert.equal(kinds.length, 1, `${statement.id}: exactly one of identity, table or spans`);
  for (const span of statement.spans ?? []) {
    pinnedSpans += 1;
    for (const marker of [span.from, span.to]) {
      assert.ok(marker.trim().split(/\s+/).length <= 6, `${statement.id}: marker over six words`);
    }
    assert.match(span.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(span.length) && span.length > 0);
  }
}
assert.equal(pinnedSpans, 47);
assert.deepEqual(
  audit.source_statements.filter((statement) => "identity" in statement).map(({ id }) => id),
  ["pm2004-title", "pm2004-doi", "pm2021-title"],
);

assert.deepEqual(
  audit.claims.map(({ claim }) => claim),
  [
    "original-2004-pci-derivation-scope",
    "contrast-associated-terminology",
    "not-a-general-iv-ct-contrast-tool",
    "not-the-2021-mehran-model",
    "rates-are-historical-cohort-estimates",
    "anticipated-procedural-inputs-are-conditional",
    "prevention-needs-separate-renal-aki-route-volume-assessment",
    "individualize-hydration-in-severe-heart-failure",
    "no-score-triggered-hydration-dose",
    "no-score-triggered-medication-hold",
    "no-prophylactic-dialysis-access",
    "no-universal-safe-contrast-maximum",
    "no-invented-egfr-from-creatinine",
    "renal-items-are-alternatives-without-double-counting",
    "contrast-volume-is-a-required-score-input",
    "cin-definition-thresholds",
    "corrected-original-study-doi",
    "added-guideline-references-resolve-to-audited-sections",
  ],
);
for (const claim of audit.claims) {
  assert.ok(claim.statements.length > 0, `${claim.claim}: no source statement`);
  assert.ok(claim.runtime_checks > 0, `${claim.claim}: no runtime binding`);
}
assert.equal(
  audit.claims.reduce((total, { runtime_checks }) => total + runtime_checks, 0),
  51,
);

assert.deepEqual(audit.table_15_bindings, {
  binary: [
    { source_row: "Hypotension", source_points: 5, runtime_field: "hypotension", runtime_points: 5 },
    { source_row: "IABP", source_points: 5, runtime_field: "iabp", runtime_points: 5 },
    { source_row: "CHF", source_points: 5, runtime_field: "chf", runtime_points: 5 },
    { source_row: "Age >75 years", source_points: 4, runtime_field: "age_over_75", runtime_points: 4 },
    { source_row: "Anemia", source_points: 3, runtime_field: "anemia", runtime_points: 3 },
    { source_row: "Diabetes", source_points: 3, runtime_field: "diabetes", runtime_points: 3 },
  ],
  contrast: [
    { contrast_volume_ml: 0, runtime_points: 0 },
    { contrast_volume_ml: 100, runtime_points: 1 },
    { contrast_volume_ml: 200, runtime_points: 2 },
    { contrast_volume_ml: 300, runtime_points: 3 },
    { contrast_volume_ml: 500, runtime_points: 5 },
  ],
  creatinine: [
    { creatinine_mg_dl: "1.5", runtime_points: 0 },
    { creatinine_mg_dl: "1.51", runtime_points: 4 },
  ],
  egfr: [
    { egfr: 19, runtime_points: 6 },
    { egfr: 20, runtime_points: 4 },
    { egfr: 39, runtime_points: 4 },
    { egfr: 40, runtime_points: 2 },
    { egfr: 59, runtime_points: 2 },
    { egfr: 90, runtime_points: 0 },
  ],
});
assert.deepEqual(audit.table_15_footnote_shorthand_recorded_not_bound, {
  low_below: 5,
  high_above: 16,
  length: 69,
  sha256: "186481efc6ba62754514c36e3618cab1d15dc4ca73db68d7a88932eac2e9c883",
});
assert.deepEqual(audit.risk_band_extremes, {
  low_max_score: 5,
  low_cin_rate: "7.5%",
  high_min_score: 16,
  high_cin_rate: "57.3%",
});
assert.deepEqual(audit.risk_band_bindings, [
  { vector: "score-0", score: 0, runtime_cin_risk: "7.5%" },
  { vector: "score-5", score: 5, runtime_cin_risk: "7.5%" },
  { vector: "score-16", score: 16, runtime_cin_risk: "57.3%" },
  { vector: "score-17", score: 17, runtime_cin_risk: "57.3%" },
]);
assert.deepEqual(audit.forbidden_output_checks, [
  "weight-based hydration dose",
  "score-triggered medication hold",
  "prophylactic renal replacement access",
  "eGFR-multiple contrast limit",
  "iso-osmolar agent mandate",
  "delay or nephrology instruction",
]);
assert.equal(audit.not_source_bound.length, 8);
assert.match(audit.not_source_bound[0], /^Middle-band cut points and CIN rates/);
assert.match(audit.not_source_bound[1], /^All four dialysis rates/);
assert.match(audit.not_source_bound[6], /'at 48 h after PCI'/);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "Mehran primary-source audit verified 4 pinned sources, 41 source statements (47 digest-pinned spans), 18 changed-claim bindings (51 runtime checks), Table 15 boundaries, published risk-band extremes, and the safety regression tests.",
);
