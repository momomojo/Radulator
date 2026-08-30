#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

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
assert.equal(audit.schema, "radulator-fleischner-primary-source-audit/v1");
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
assert.deepEqual(audit.primary_full_text_transport, {
  official_url: "https://pubs.rsna.org/doi/10.1148/radiol.2017161659",
  reviewed_in_browser: true,
  fetched_by_ci: false,
  limitation:
    "RSNA primary full text was independently reviewed in a browser; the deterministic CI audit verifies DOI metadata and open table cross-checks without claiming it downloaded the bot-protected RSNA full text.",
});
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
assert.deepEqual(audit.source_claims.solid, {
  single_lt6: ["No routine follow-up", "Optional CT at 12 months"],
  single_6_to_8: [
    "CT at 6–12 months, then consider CT at 18–24 months",
    "CT at 6–12 months, then CT at 18–24 months",
  ],
  single_gt8: "Consider CT, PET/CT, or tissue sampling at 3 months",
  multiple_lt6: ["No routine follow-up", "Optional CT at 12 months"],
  multiple_ge6: [
    "CT at 3–6 months, then consider CT at 18–24 months",
    "CT at 3–6 months, then CT at 18–24 months",
  ],
});
assert.deepEqual(audit.source_claims.subsolid, {
  single_ground_glass_lt6: "No routine follow-up",
  single_ground_glass_ge6:
    "CT at 6–12 months to confirm persistence, then CT every 2 years until 5 years",
  single_part_solid_lt6: "No routine follow-up",
  single_part_solid_ge6:
    "CT at 3–6 months to confirm persistence. If unchanged and solid component remains <6 mm, annual CT should be performed for 5 years",
  multiple_lt6:
    "CT at 3–6 months. If stable, consider CT at 2 and 4 years",
  multiple_ge6:
    "CT at 3–6 months. Subsequent management based on the most suspicious nodule(s)",
});
assert.equal(audit.calculator_id, "fleischner");
assert.equal(audit.guideline_version, "Fleischner 2017");
assert.equal(
  audit.fixture_path,
  "tests/fixtures/compute/fleischner.json",
);
assert.equal(audit.fixture_version, "fleischner-2017-primary-guideline-and-measurement-statement");
assert.ok(audit.bound_vector_ids.includes("single-solid-6-low-preserves-late-ct-option"));
assert.ok(audit.bound_vector_ids.includes("multiple-ground-glass-5-initial-and-optional-late-ct"));
assert.ok(audit.bound_vector_ids.includes("single-part-solid-12-component-9-escalates-by-size"));
assert.ok(audit.bound_vector_ids.includes("screening-routes-away-without-schedule"));
assert.ok(audit.bound_vector_ids.includes("fractional-overall-size-rejected"));
assert.equal(audit.runtime_vector_match, true);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.correct_measurement_doi_present, true);
assert.equal(audit.known_wrong_measurement_doi_absent, true);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "Fleischner source audit verified primary DOI identities, open table cross-checks, scope, measurement, and executable clinical vectors.",
);
