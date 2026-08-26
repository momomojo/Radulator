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
assert.equal(audit.archive_member, "mmc1.pdf");
assert.equal(
  audit.direct_pdf_url,
  "https://ars.els-cdn.com/content/image/1-s2.0-S2590059526001135-mmc1.pdf",
);
assert.ok(
  ["direct-publisher-pdf", "europe-pmc-archive-fallback"].includes(
    audit.supplement_retrieval,
  ),
);
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
assert.equal(audit.runtime_equation_match, true);
assert.equal(audit.runtime_vector_match, true);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "KBRC primary-source integration audit verified the live supplement member, 22 equation terms, 4 source examples, the p0130 calibration warning, and app-only input-limit provenance.",
);
