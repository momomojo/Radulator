#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-bosniak-primary-source.mjs",
    "--json",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);

assert.equal(
  run.status,
  0,
  `Bosniak primary-source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);

const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-bosniak-primary-source-audit/v1");
assert.equal(audit.source_authority, "Silverman et al., Radiology 2019 and CUA 2023");
assert.deepEqual(audit.source_urls, [
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/",
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/",
]);
assert.match(audit.source_sha256.silverman, /^[a-f0-9]{64}$/);
assert.match(audit.source_sha256.cua, /^[a-f0-9]{64}$/);
assert.ok(audit.source_bytes.silverman > 10_000);
assert.ok(audit.source_bytes.cua > 10_000);
assert.deepEqual(audit.source_claims, {
  homogeneous_noncontrast_mass_70_hu_or_greater: true,
  obtuse_margin_nodule_4_mm_or_larger: true,
  iif_first_year_followup_months: [6, 12],
  iif_yearly_if_stable: true,
  iif_followup_years_if_no_progression: 5,
  iif_interval_evidence: "expert opinion",
  iif_duration_evidence: "conditional recommendation, very low certainty",
});
assert.deepEqual(audit.bound_vector_ids, [
  "exactly-70-hu-homogeneous-noncontrast-mass-category-ii",
  "exactly-4-mm-obtuse-margin-enhancing-nodule-category-iv",
  "minimally-thick-enhancing-wall-category-iif",
]);
assert.equal(audit.runtime_vector_match, true);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "Bosniak primary-source audit verified classification boundaries and CUA IIF management against executable vectors.",
);
