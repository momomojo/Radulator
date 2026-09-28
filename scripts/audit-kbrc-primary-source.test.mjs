#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-kbrc-primary-source.mjs",
    "--json",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);

assert.equal(
  run.status,
  0,
  `primary-source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);
const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-kbrc-primary-source-audit/v1");
assert.equal(audit.article_pmcid, "PMC13156734");
// The article XML is byte-pinned (NCBI E-utilities efetch) and verified before parsing.
assert.equal(
  audit.article_xml_url,
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=13156734&retmode=xml&tool=radulator-kbrc-source-audit",
);
assert.equal(audit.article_xml_bytes, 60058);
assert.equal(
  audit.article_xml_sha256,
  "b7610352254424f1da36127082993ff981abb72cf090acff624b0e5b993209c7",
);
assert.equal(audit.archive_member, "mmc1.pdf");
assert.equal(
  audit.direct_pdf_url,
  "https://ars.els-cdn.com/content/image/1-s2.0-S2590059526001135-mmc1.pdf",
);
// Only the byte-pinned publisher PDF is retrieved; the unpinnable Europe PMC archive is not.
assert.equal(audit.supplement_retrieval, "direct-publisher-pdf");
assert.equal(audit.archive_member_bytes, 3696579);
assert.equal(
  audit.archive_member_sha256,
  "d05d344c32a94e797587c5cb79896117026199d0dacd36ea1c0f28856848f6f5",
);
assert.equal(audit.license, "CC BY-NC-ND 4.0");
assert.equal(audit.equation_term_count, 22);
assert.deepEqual(audit.source_example_displays, ["2.5%", "1.0%", "7.4%", "0.4%"]);
assert.deepEqual(audit.calibration_warning, {
  source_locator: "full-text XML paragraph p0130",
  threshold_probability: 0.25,
  calibration_direction: "overpredict",
});
assert.equal(audit.runtime_calibration_warning_match, true);
assert.deepEqual(audit.input_limits, {
  provenance: "radulator-data-entry-guardrail",
  publication_derived: false,
  enforcement: {
    age: "reject", weight: "warn", height: "reject", platelets: "reject",
    hemoglobin: "reject", kidney_size: "reject",
  },
  values: {
    age: { min: 18, max: 90, unit: "years" },
    weight: { min: 30, max: 130, unit: "kg" },
    height: { min: 140, max: 210, unit: "cm" },
    platelets: { min: 50, max: 700, unit: "×10⁹/L" },
    hemoglobin: { min: 70, max: 180, unit: "g/L" },
    kidney_size: { min: 8, max: 16, unit: "cm" },
  },
});
assert.equal(audit.runtime_input_limit_claims_match, true);
// Weight-input review: BMI (not weight) is the modeled spline predictor, the source publishes no
// weight domain, and the runtime reviews rather than rejects outside 30-130 kg without altering
// the Item S1 estimate.
assert.deepEqual(audit.weight_input_evidence, {
  model_inputs: ["age", "bmi", "hemoglobin", "kidneySize", "native", "platelets"],
  xml_statements: [
    {
      id: "derivation-variables-weight-height",
      locator: "full-text XML paragraph p0030",
      sha256: "51c44ab46c16785b204b67277337c04aeee46665820d43573981d00e0c583b2a",
    },
    {
      id: "bmi-continuous-spline",
      locator: "full-text XML paragraph p0050",
      sha256: "38eb635fa905e18639037a3ffc09702a44fbdee015ddc4c26ab20a27657183c4",
    },
    {
      id: "no-arbitrary-cutoffs",
      locator: "full-text XML paragraph p0050",
      sha256: "3edc662aad097233d73509c1d4111eb0f28d5361396717cae485847fc5056767",
    },
  ],
  pdf_statements: [
    {
      id: "item-s1-bmi-unit",
      locator: "mmc1.pdf page 5 Item S1 footnote",
      sha256: "7c026216f9f696ce042003f6faa8585c1c558ed9dbe32058b68a2536b1efa0ab",
    },
    {
      id: "table-s1-predictors",
      locator: "mmc1.pdf page 6 Table S1",
      predictors: {
        "Age(years)": "continuous restricted cubic spline, 3 knots",
        "Kidneylength(cm)": "continuous restricted cubic spline, 3 knots",
        "Pre-procedurehemoglobin(g/L)": "continuous restricted cubic spline, 3 knots",
        "Plateletcount(x109/L)": "continuous restricted cubic spline, 3 knots",
        "Bodymassindex(kg/m2)": "continuous restricted cubic spline, 3 knots",
        "Targetkidney(Nativevs.Allograft)": "binary, reference allograft",
      },
    },
  ],
  weight_mentions: ["abstract", "p0030"],
  table1_bmi_combined: { median: 28.28, iqr: [24.6, 32.59] },
  table1_weight_or_height_rows: 0,
  publication_defines_weight_domain: false,
  review_interval_kg: [30, 130],
  review_probes_kg: [29.99, 30, 30.01, 129.99, 130, 130.01],
  review_flags: [true, false, false, false, false, true],
  equal_bmi_pair_display: "0.4%",
  regressions_detected: [
    "hard-weight-cutoff",
    "weight-clamped",
    "input-review-removed",
    "input-review-claims-model-domain",
  ],
});
assert.equal(audit.runtime_weight_review_match, true);
assert.equal(audit.runtime_equation_match, true);
assert.equal(audit.runtime_vector_match, true);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.source_bytes_committed, false);

// Pinned-artifact drift, offline: when a retrieval returns HTTP 200 with drifted bytes, the audit
// must fail at once, before parsing and without printing a result, and must never retry it. A
// preloaded fake fetch serves the drifted bytes for one URL, leaves every other retrieval pending,
// and reports how often each URL was requested.
const { readFile } = await import("node:fs/promises");
const registry = JSON.parse(
  await readFile(
    "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json",
    "utf8",
  ),
);
const pinned = registry.records.find(
  ({ calculator_id }) => calculator_id === "kidney-biopsy-bleeding-risk",
).implementation_evidence.source_artifact;
assert.equal(pinned.full_text_xml_url, audit.article_xml_url);
assert.equal(pinned.full_text_xml_bytes, audit.article_xml_bytes);
assert.equal(pinned.full_text_xml_sha256, audit.article_xml_sha256);

const DRIFTED_FETCH = `
  const target = process.env.KBRC_DRIFT_URL;
  const length = Number(process.env.KBRC_DRIFT_BYTES);
  const requests = {};
  process.on("exit", () => {
    process.stderr.write("\\nKBRC_DRIFT_REQUESTS=" + JSON.stringify(requests) + "\\n");
  });
  globalThis.fetch = async (url) => {
    requests[String(url)] = (requests[String(url)] ?? 0) + 1;
    if (String(url) !== target) return new Promise(() => {});
    return new Response(Buffer.alloc(length, 0x20), { status: 200 });
  };
`;

function auditWithDriftedResponse(url, bytes) {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/register-jsx-loader.mjs",
      "--import",
      `data:text/javascript,${encodeURIComponent(DRIFTED_FETCH)}`,
      "scripts/audit-kbrc-primary-source.mjs",
      "--json",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, KBRC_DRIFT_URL: url, KBRC_DRIFT_BYTES: String(bytes) },
      timeout: 60_000,
    },
  );
  const requests = result.stderr.match(/KBRC_DRIFT_REQUESTS=(\{.*\})/)?.[1];
  return { ...result, requests: requests ? JSON.parse(requests) : null };
}

const driftTargets = [
  ["article XML", pinned.full_text_xml_url, pinned.full_text_xml_bytes],
  ["supplement PDF", pinned.direct_pdf_url, pinned.archive_member_bytes],
];
for (const [artifact, url, pinnedBytes] of driftTargets) {
  for (const [kind, bytes, failure] of [
    ["same-length digest drift", pinnedBytes, "SHA-256 drifted from the pin"],
    ["byte-length drift, one byte short", pinnedBytes - 1, "byte length drifted from the pin"],
    ["byte-length drift, one byte long", pinnedBytes + 1, "byte length drifted from the pin"],
  ]) {
    const drift = auditWithDriftedResponse(url, bytes);
    const label = `${artifact} ${kind}`;
    const detail = `\nstatus ${drift.status} signal ${drift.signal}\nstderr:\n${drift.stderr}`;
    assert.equal(drift.status, 1, `${label}: the audit must fail${detail}`);
    assert.ok(drift.stderr.includes(`${artifact}: ${failure}`), `${label}: wrong failure${detail}`);
    assert.equal(drift.stdout, "", `${label}: no audit result may be printed`);
    assert.equal(
      drift.requests?.[url],
      1,
      `${label}: a drifted HTTP 200 must fail at once and never be retried${detail}`,
    );
    assert.equal(
      drift.requests?.[pinned.archive_url],
      undefined,
      `${label}: the unpinnable supplement archive must never be retrieved${detail}`,
    );
  }
}

console.log(
  "KBRC primary-source integration audit verified the byte-pinned article XML and supplement PDF, 22 equation terms, 4 source examples, the p0130 calibration warning, app-only input-limit provenance, and the BMI-based weight-review binding (p0030, p0050, Table 1, Item S1, Table S1); same-length, one-byte-short and one-byte-long drift of either artifact failed at once with a single request and no fallback.",
);
