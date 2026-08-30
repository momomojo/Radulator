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
assert.equal(audit.schema, "radulator-birads-legacy-source-audit/v2");
assert.equal(audit.source_authority, "American College of Radiology");
assert.equal(audit.source_host, "edge.sitecorecloud.io");
assert.deepEqual(
  audit.sources.map(({ id, bytes, sha256 }) => ({ id, bytes, sha256 })),
  [
    {
      id: "fifth-edition-quick-reference",
      bytes: 621_351,
      sha256: "7ee3b4e3713103eba7c5618b49a5dc9112c3aa11ba8b8620b34d7ccb1b5cb410",
    },
    {
      id: "mammography-summary",
      bytes: 64_921,
      sha256: "98d88679deb266ac030de0d96d9f15a5fcde3b0a1a4d6a7aeb29aa49b85daae6",
    },
    {
      id: "ultrasound-summary",
      bytes: 67_317,
      sha256: "38f24a245a9ea992f5f29e221f6000eb4a60c9d8d78f4a3dce68130179adec1d",
    },
    {
      id: "mri-summary",
      bytes: 63_321,
      sha256: "75900dbd050ec22266db01cf5e18a8caae1e07e0d5e5f819195af7cf0b569dd9",
    },
  ],
);
assert.deepEqual(audit.source_claims, {
  assessment_categories_0_through_6: true,
  category_0_source_literal_management: true,
  descriptor_to_category_inference_absent: true,
  fifth_edition_bounded_descriptor_groups: true,
  hidden_modality_descriptors_do_not_leak: true,
  mammography_ultrasound_mri_scope: true,
  modality_input_required: true,
  source_literal_probability_endpoints: true,
  source_literal_management_wording: true,
  v2025_modality_specific_category_4_structure: true,
});
assert.equal(audit.bound_vector_ids.length, 28);
assert.equal(audit.runtime_vector_match, true);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.temporary_rollback, true);
assert.equal(audit.full_manual_validation_complete, false);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "BI-RADS legacy source audit verified four official ACR artifacts and 28 executable safety vectors.",
);
