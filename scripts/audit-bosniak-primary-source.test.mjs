#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const registry = JSON.parse(
  readFileSync(
    "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json",
    "utf8",
  ),
);
const bosniakRecord = registry.records.find((record) => record.calculator_id === "bosniak");
assert.ok(bosniakRecord, "Bosniak registry record is required");
const registryAudit = bosniakRecord.implementation_evidence?.source_audit;
assert.ok(registryAudit, "Bosniak registry source audit is required");

const fixtureRun = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-bosniak-primary-source.mjs",
    "--self-test",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);
assert.equal(
  fixtureRun.status,
  0,
  `Bosniak source retrieval fixture tests failed\nstdout:\n${fixtureRun.stdout}\nstderr:\n${fixtureRun.stderr}`,
);
assert.match(fixtureRun.stdout, /Bosniak source retrieval fixture tests passed/);

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
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/?report=reader",
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/?report=reader",
]);
assert.deepEqual(audit.source_urls, registryAudit.source_urls);
const expectedSourceTextVerification = {
  silverman: [
    {
      claim_id: "bosniak-v2019-category-ii",
      section_id: "s5",
      locator:
        "HTML section #s5 (Recent Developments to Improve Characterization of Cystic Renal Masses)",
      required_text: "well-defined homogeneous masses of 70 hu or greater",
    },
    {
      claim_id: "bosniak-v2019-iif-iii-iv-features",
      section_id: "sec17",
      locator: "HTML section #sec17 (Bosniak IV)",
      required_text: "focal enhancing convex protrusion 4 mm or larger",
    },
    {
      claim_id: "bosniak-v2019-iif-iii-iv-features",
      section_id: "sec17",
      locator: "HTML section #sec17 (Bosniak IV)",
      required_text: "obtuse margins with the wall or septa",
    },
  ],
  cua: [
    {
      id: "cua-title",
      identity: "h1",
      locator: "PMC HTML article H1 title",
      required_text: "2023 update - canadian urological association guideline: management of cystic renal lesions",
    },
    {
      id: "cua-doi",
      identity: "citation_doi",
      locator: "PMC HTML citation_doi metadata",
      required_text: "10.5489/cuaj.8389",
    },
    {
      id: "cua-iif-interval",
      section_id: "sec15",
      locator: "PMC HTML section #sec15 (Bosniak category IIF), recommendation 6",
      required_text:
        "for patients with a bosniak iif cyst, a followup every 6-12 months is suggested for the first year, and then yearly if the cyst is stable",
    },
    {
      id: "cua-iif-interval-evidence",
      section_id: "sec15",
      locator: "PMC HTML section #sec15 (Bosniak category IIF), recommendation 6 evidence grade",
      required_text: "expert opinion",
    },
    {
      id: "cua-iif-duration",
      section_id: "sec15",
      locator: "PMC HTML section #sec15 (Bosniak category IIF), recommendation 7",
      required_text:
        "for patients with a bosniak iif cyst that do not demonstrate progression on imaging, a followup of five years is suggested",
    },
    {
      id: "cua-iif-duration-evidence",
      section_id: "sec15",
      locator: "PMC HTML section #sec15 (Bosniak category IIF), recommendation 7 evidence grade",
      required_text: "conditional recommendation, very low certainty in evidence of effects",
    },
  ],
};
assert.deepEqual(audit.source_text_verification, expectedSourceTextVerification);
assert.deepEqual(audit.source_text_verification, registryAudit.source_text_verification);
assert.deepEqual(audit.artifacts, [
  {
    id: "silverman-pmc-html",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/?report=reader",
    host: "pmc.ncbi.nlm.nih.gov",
    path: "/articles/PMC6677285/",
    media_type: "text/html",
    raw_source_min_bytes: 300_000,
    raw_source_max_bytes: 1_000_000,
    canonical_source_bytes: 111_115,
    canonical_source_sha256:
      "007a4c01927d5a9fb4f8b0458dedc5793fe0f3d7c051fcb8f3267b76b57c95e5",
  },
  {
    id: "cua-pmc-html",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/?report=reader",
    host: "pmc.ncbi.nlm.nih.gov",
    path: "/articles/PMC10263289/",
    media_type: "text/html",
    raw_source_min_bytes: 300_000,
    raw_source_max_bytes: 1_000_000,
    canonical_source_bytes: 77_293,
    canonical_source_sha256:
      "320f8aa91a3143c45a93856f840d4d81d39f0a6d4636eb10340bbd4293180324",
  },
]);
assert.deepEqual(audit.artifacts, registryAudit.artifacts);
assert.deepEqual(audit.bound_vector_ids, registryAudit.vector_ids);
assert.equal(registryAudit.command, "npm run test:bosniak-source");
assert.equal(registryAudit.authority, "Silverman et al., Radiology 2019 and CUA 2023");
const claimsById = new Map(
  bosniakRecord.implementation_evidence.claims.map((claim) => [claim.id, claim]),
);
assert.equal(
  claimsById.get("bosniak-v2019-category-ii").source_locator,
  "Silverman HTML section #s5 (Recent Developments to Improve Characterization of Cystic Renal Masses): well-defined homogeneous masses of 70 HU or greater",
);
assert.equal(
  claimsById.get("bosniak-v2019-iif-iii-iv-features").source_locator,
  "Silverman HTML section #sec17 (Bosniak IV): focal enhancing convex protrusion 4 mm or larger and obtuse margins with the wall or septa",
);
assert.equal(
  claimsById.get("cua-2023-bosniak-iif-followup").source_locator,
  "CUA 2023 PMC HTML section #sec15 (Bosniak category IIF), recommendations 6-7 and their evidence grades",
);
assert.ok(audit.source_bytes.silverman >= 300_000);
assert.ok(audit.source_bytes.silverman <= 1_000_000);
assert.ok(audit.source_bytes.cua >= 300_000);
assert.ok(audit.source_bytes.cua <= 1_000_000);
assert.deepEqual(audit.source_canonical_bytes, { silverman: 111_115, cua: 77_293 });
assert.deepEqual(audit.source_canonical_sha256, {
  silverman: "007a4c01927d5a9fb4f8b0458dedc5793fe0f3d7c051fcb8f3267b76b57c95e5",
  cua: "320f8aa91a3143c45a93856f840d4d81d39f0a6d4636eb10340bbd4293180324",
});
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
