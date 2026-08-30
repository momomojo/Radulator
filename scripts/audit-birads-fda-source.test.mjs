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
  `BI-RADS legacy source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);

const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-birads-legacy-source-audit/v1");
assert.equal(audit.source_authority, "American College of Radiology");
assert.equal(audit.source_host, "edge.sitecorecloud.io");
assert.equal(audit.source.bytes, 621_351);
assert.equal(
  audit.source.sha256,
  "7ee3b4e3713103eba7c5618b49a5dc9112c3aa11ba8b8620b34d7ccb1b5cb410",
);
assert.match(audit.source.locator, /assessment categories 0-6/);
assert.deepEqual(audit.source_claims, {
  assessment_categories_0_through_6: true,
  category_0_modality_wording: true,
  fifth_edition_descriptor_groups: true,
  mammography_ultrasound_mri_scope: true,
});
assert.equal(audit.bound_vector_ids.length, 14);
assert.equal(audit.runtime_vector_match, true);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.temporary_rollback, true);
assert.equal(audit.full_manual_validation_complete, false);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "BI-RADS legacy source audit verified the official fifth-edition artifact and 14 executable safety vectors.",
);
