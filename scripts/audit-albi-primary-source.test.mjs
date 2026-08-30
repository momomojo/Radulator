#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-albi-primary-source.mjs",
    "--json",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);

assert.equal(
  run.status,
  0,
  `ALBI primary-source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);

const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-albi-primary-source-audit/v1");
assert.equal(audit.article_pmcid, "PMC4322258");
assert.equal(audit.article_doi, "10.1200/JCO.2014.57.9151");
assert.equal(
  audit.source_url,
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC4322258/",
);
assert.equal(audit.source_bytes, 276_155);
assert.equal(audit.canonical_source_bytes, 276_075);
assert.equal(
  audit.canonical_source_sha256,
  "fccc2f40b9ae8a85fcd7dbc093886be078a554db8f425322db6cffc3bd2499b0",
);
assert.deepEqual(audit.canonicalization, [
  "replace ncbi_phid value with [volatile]",
  "replace csrfmiddlewaretoken value with [volatile]",
]);
assert.deepEqual(audit.enforced_source_locators, {
  population: "Abstract > Patients and Methods (abstract1/sec2)",
  equation: "RESULTS (sec16), paragraph immediately before Table 2 (T2)",
  boundaries: "RESULTS (sec16), paragraph immediately after Table 2 (T2)",
});
assert.deepEqual(audit.source_claims, {
  bilirubin_transform: "log10",
  bilirubin_coefficient: 0.66,
  bilirubin_unit: "umol/L",
  albumin_coefficient: -0.085,
  albumin_unit: "g/L",
  grade_1: "xb <= -2.60",
  grade_2: "xb > -2.60 to <= -1.39",
  grade_3: "xb > -1.39",
  development_population: "patients with HCC",
});
assert.deepEqual(audit.bound_vector_ids, [
  "published-representative-grade-1",
  "grade-1-upper-boundary",
  "grade-2-lower-interior",
  "grade-2-upper-boundary",
  "grade-3-lower-interior",
  "us-unit-equivalence",
]);
assert.equal(audit.runtime_vector_match, true);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.unsupported_original_cohort_claims_removed, true);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "ALBI primary-source audit verified the published equation, units, grade boundaries, source scope, and executable vectors.",
);
