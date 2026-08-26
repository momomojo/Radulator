#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-birads-fda-source.mjs",
    "--json",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);

assert.equal(
  run.status,
  0,
  `BI-RADS FDA source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);

const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-birads-fda-source-audit/v1");
assert.equal(audit.source_authority, "U.S. Food and Drug Administration");
assert.equal(audit.source_host, "www.fda.gov");
assert.equal(audit.sources.length, 4);
for (const source of audit.sources) {
  assert.match(source.sha256, /^[a-f0-9]{64}$/);
  assert.ok(source.bytes > 1_000);
}
assert.deepEqual(audit.source_claims, {
  alternative_standard_12_marker_placement: true,
  alternative_standard_25_additional_imaging: true,
  prior_comparison_follow_up_within_30_days: true,
  provider_report_and_patient_summary_within_7_days: true,
  self_referred_referral_system: true,
});
assert.deepEqual(audit.bound_vector_ids, [
  "category-3",
  "category-4",
  "category-5",
  "incomplete-prior-comparison",
  "post-procedure-marker",
]);
assert.equal(audit.runtime_vector_match, true);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "BI-RADS FDA source audit verified four official pages and five executable evidence vectors.",
);
