import assert from "node:assert/strict";
import fs from "node:fs";

const registryPath =
  "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json";
const roadmap = fs.readFileSync("docs/ROADMAP.md", "utf8");
const e2eWorkflow = fs.readFileSync(".github/workflows/e2e-tests.yml", "utf8");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const fleischnerManifest = JSON.parse(
  fs.readFileSync(
    "docs/evidence/fleischner-2017-reviewed-evidence.json",
    "utf8",
  ),
);
const fleischnerFixture = JSON.parse(
  fs.readFileSync("tests/fixtures/compute/fleischner.json", "utf8"),
);
const records = new Map(
  registry.records.map((record) => [record.calculator_id, record]),
);

const expectedFleischnerClaimIds = [
  "fleischner-2017-applicability",
  "fleischner-2017-characterization-and-ipln",
  "fleischner-2017-solid-table",
  "fleischner-2017-multiple-nodule-routing",
  "fleischner-2017-subsolid-table",
  "fleischner-2017-selected-subsolid-escalation",
  "fleischner-2017-part-solid-component-escalation",
  "fleischner-2017-risk-selection",
  "fleischner-2017-measurement-contract",
  "fleischner-2017-very-small-nodule-measurement",
  "nlm-fleischner-solid-table-cross-check",
  "nlm-fleischner-subsolid-table-cross-check",
];

const roadmapFleischnerVectorIds = [
  "definitively-benign-fat-or-calcification-routes-without-table",
  "typical-intrapulmonary-lymph-node-routes-without-table",
  "thick-section-characterization-fails-closed",
  "multiple-solid-any-ge6-dominant-5-uses-multiple-threshold",
  "multiple-solid-dominant-9-solitary-override",
  "multiple-subsolid-any-ge6-dominant-5-uses-cohort-threshold",
  "multiple-ground-glass-established-growth-uses-most-suspicious-route",
  "multiple-ground-glass-new-solid-component-uses-most-suspicious-route",
  "single-ground-glass-6-established-growth-uses-annual-follow-up",
  "single-ground-glass-new-solid-component-reroutes-to-part-solid",
  "single-ground-glass-validated-volumetric-growth-accepted",
  "pure-ground-glass-sub2mm-change-cannot-claim-growth",
  "solid-component-unconfirmed-change-cannot-trigger-escalation",
  "single-part-solid-6-component-5-persistent-uses-annual-follow-up",
  "single-part-solid-12-component-6-persistent-is-highly-suspicious",
  "single-solid-10-valid-axes-accepted",
  "single-solid-10-axes-average-mismatch-rejected",
  "part-solid-component-exceeding-overall-long-axis-rejected",
  "subsolid-missing-temporal-state-fails-closed",
  "categorical-lte3-solid-low-without-false-precision",
  "numeric-3-mm-requires-categorical-pathway",
  "part-solid-categorical-lte3-component-avoids-false-precision",
  "part-solid-categorical-new-component-escalates-without-false-precision",
  "part-solid-categorical-linear-growth-claim-rejected",
  "part-solid-measured-component-at-3-mm-rejected",
  "part-solid-missing-component-mode-rejected",
  "single-part-solid-12-component-8-validated-volumetric-growth-escalates",
  "categorical-lte3-pure-ggo-linear-growth-claim-rejected",
  "categorical-lte3-pure-ggo-validated-volumetric-growth-claim-rejected",
  "categorical-lte3-solid-component-linear-growth-claim-rejected",
  "categorical-lte3-solid-component-missing-basis-requires-recharacterization",
  "categorical-lte3-solid-component-validated-volumetric-growth-claim-rejected",
  "categorical-lte3-visually-new-component-requires-recharacterization",
  "sub6-ground-glass-linear-component-growth-claim-rejected",
  "sub6-ground-glass-solid-component-missing-basis-requires-recharacterization",
  "sub6-ground-glass-validated-volumetric-component-growth-claim-rejected",
  "sub6-ground-glass-visually-new-component-requires-recharacterization",
  "sub6-part-solid-linear-component-growth-claim-rejected",
  "sub6-part-solid-solid-component-missing-basis-requires-recharacterization",
  "sub6-part-solid-validated-volumetric-component-growth-claim-rejected",
  "sub6-part-solid-visually-new-component-requires-recharacterization",
  "part-solid-categorical-validated-volumetric-growth-claim-rejected",
  "pure-ground-glass-missing-growth-basis-rejected",
  "solid-component-missing-growth-basis-rejected",
  "uncertain-characterization-routes-without-table",
];

for (const evidence of [
  {
    calculatorId: "bosniak",
    implementedVersion: "Bosniak version 2019",
    roadmapLabel: "Bosniak version 2019 CT classification",
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/",
    command: "npm run test:bosniak-source",
    claimIds: ["bosniak-v2019-category-ii", "bosniak-v2019-iif-iii-iv-features"],
  },
  {
    calculatorId: "meld-na",
    implementedVersion: "MELD 3.0 (OPTN Policy 9.1.D)",
    roadmapLabel: "MELD 3.0 (OPTN Policy 9.1.D)",
    sourceUrl: "https://www.hrsa.gov/sites/default/files/hrsa/optn/optn_policies.pdf",
    command: "npm run test:hermes-guideline-registry",
    claimIds: [
      "optn-adult-meld3-equation",
      "optn-laboratory-bounds-and-dialysis",
      "optn-calculator-entry-domains",
    ],
  },
  {
    calculatorId: "birads",
    implementedVersion:
      "Legacy ACR BI-RADS Fifth Edition (2013) temporary rollback with public 2025 assessment-summary constraints",
    roadmapLabel:
      "Legacy ACR BI-RADS Fifth Edition (2013) temporary rollback with public 2025 assessment-summary constraints",
    sourceUrl:
      "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BIRADS-Poster.pdf",
    command: "npm run test:birads-fda-source",
    claimIds: [
      "acr-birads-three-modality-scope",
      "acr-fifth-edition-descriptor-groups",
      "acr-fifth-edition-assessment-labels",
      "acr-mammography-assessment-boundaries-and-management",
      "acr-ultrasound-assessment-boundaries-and-management",
      "acr-mri-assessment-boundaries-and-management",
    ],
  },
  {
    calculatorId: "fleischner",
    implementedVersion: "Fleischner 2017",
    roadmapLabel: "Fleischner 2017 incidental pulmonary nodule guidance",
    sourceUrl: "https://pubs.rsna.org/doi/10.1148/radiol.2017161659",
    command: "npm run test:fleischner-source",
    claimIds: expectedFleischnerClaimIds,
  },
]) {
  const { calculatorId, implementedVersion, roadmapLabel, sourceUrl, command, claimIds } =
    evidence;
  const record = records.get(calculatorId);
  assert.ok(record, `${calculatorId}: registry row is required`);
  assert.equal(record.verification_status, "verified", `${calculatorId}: registry status`);
  assert.equal(record.implemented_version, implementedVersion, `${calculatorId}: registry version`);
  assert.ok(
    roadmap.includes(roadmapLabel),
    `${calculatorId}: roadmap must name the reviewed implementation without version ambiguity`,
  );
  assert.ok(
    record.sources.some((source) => source.url === sourceUrl),
    `${calculatorId}: roadmap source must remain registered`,
  );
  assert.ok(
    roadmap.includes(sourceUrl) && roadmap.includes(command),
    `${calculatorId}: roadmap must expose its exact source and command`,
  );
  for (const claimId of claimIds) {
    const claim = record.implementation_evidence.claims.find((item) => item.id === claimId);
    assert.ok(claim, `${calculatorId}: roadmap claim ${claimId} must remain registered`);
    assert.ok(
      record.sources.some((source) => source.url === claim.source_url),
      `${calculatorId}: ${claimId} must remain bound to a registered source`,
    );
    assert.ok(
      Array.isArray(claim.vector_ids) && claim.vector_ids.length > 0,
      `${calculatorId}: ${claimId} must remain bound to executable vectors`,
    );
    assert.ok(
      roadmap.includes(claimId),
      `${calculatorId}: roadmap must name the exact evidence claim ${claimId}`,
    );
  }
}

assert.equal(
  fleischnerManifest.schema,
  "radulator-reviewed-source-evidence/v1",
  "Fleischner roadmap evidence must use the reviewed-source manifest schema",
);
assert.equal(
  fleischnerManifest.payload.scope,
  "source-interpretation-only",
  "Fleischner source review must remain scoped to source interpretation",
);
assert.equal(
  fleischnerManifest.review.disposition,
  "SOURCE_INTERPRETATION_APPROVED",
  "Fleischner manifest must preserve the bounded source-review disposition",
);
assert.equal(
  fleischnerManifest.review.release_authority,
  "none",
  "Fleischner source review must not acquire release authority",
);

const fleischnerManifestClaimIds = fleischnerManifest.payload.claims.map(
  (claim) => claim.id,
);
assert.deepEqual(
  [...fleischnerManifestClaimIds].sort(),
  [...expectedFleischnerClaimIds].sort(),
  "Fleischner roadmap claims must match the exact expanded reviewed-source manifest",
);

const fleischnerRecordClaimIds = records
  .get("fleischner")
  .implementation_evidence.claims.map((claim) => claim.id);
assert.deepEqual(
  [...fleischnerRecordClaimIds].sort(),
  [...expectedFleischnerClaimIds].sort(),
  "Fleischner registry claims must match the exact expanded reviewed-source manifest",
);

const fleischnerFixtureIds = new Set(
  fleischnerFixture.cases.map((testCase) => testCase.id),
);
const reviewedRuntimeVectorIds = new Set(
  fleischnerManifest.payload.runtime_contract.reviewed_vector_ids,
);
for (const claim of fleischnerManifest.payload.claims) {
  for (const vectorId of claim.vector_ids) {
    assert.ok(
      fleischnerFixtureIds.has(vectorId),
      `Fleischner manifest vector ${vectorId} must remain executable in the canonical fixture`,
    );
    assert.ok(
      reviewedRuntimeVectorIds.has(vectorId),
      `Fleischner manifest vector ${vectorId} must remain in the reviewed runtime contract`,
    );
  }
}

for (const vectorId of roadmapFleischnerVectorIds) {
  assert.ok(
    roadmap.includes(vectorId),
    `Fleischner roadmap must name the corrected runtime vector ${vectorId}`,
  );
}

assert.ok(
  roadmap.includes("evidence/fleischner-2017-reviewed-evidence.json"),
  "Fleischner roadmap must link the committed reviewed-source manifest",
);
assert.match(
  roadmap,
  /CI-bound runtime vectors/i,
  "Fleischner roadmap must distinguish CI-bound runtime vectors from source review",
);
assert.match(
  roadmap,
  /CI does not (?:fetch|download|inspect)[^\n]*RSNA[^\n]*full text/i,
  "Fleischner roadmap must state that CI does not obtain RSNA full text",
);
assert.match(
  roadmap,
  /source review alone does not approve[^\n]*runtime[^\n]*(?:pull request|release)[^\n]*deployment[^\n]*live site/i,
  "Fleischner roadmap must not promote source review into runtime or release approval",
);

for (const sourceUrl of [
  "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
  "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/LI-RADS",
  "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/NI-RADS",
  "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/PE-RADS",
]) {
  assert.ok(roadmap.includes(sourceUrl), `roadmap must directly cite ${sourceUrl}`);
}

const vectorClaims = new Map();
for (const record of registry.records) {
  for (const claim of record.implementation_evidence?.claims ?? []) {
    for (const vectorId of claim.vector_ids) {
      const bindings = vectorClaims.get(vectorId) ?? [];
      bindings.push({ calculatorId: record.calculator_id, claimId: claim.id });
      vectorClaims.set(vectorId, bindings);
    }
  }
}
for (const [, vectorId] of roadmap.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+){2,})`/g)) {
  if (!vectorClaims.has(vectorId)) continue;
  assert.ok(
    vectorClaims.get(vectorId).length > 0,
    `roadmap vector ${vectorId} must remain bound to a registered source claim`,
  );
}

assert.match(
  e2eWorkflow,
  /name: Verify roadmap clinical source audits at exact head[\s\S]*?npm run test:bosniak-source[\s\S]*?npm run test:hermes-guideline-registry[\s\S]*?npm run test:birads-fda-source[\s\S]*?npm run test:fleischner-source/,
  "the required exact-head Smoke job must run the cited roadmap source-audit commands explicitly",
);

for (const calculatorId of ["lirads", "nirads"]) {
  const record = records.get(calculatorId);
  assert.ok(record, `${calculatorId}: registry row is required`);
  assert.equal(
    record.verification_status,
    "seed-unverified",
    `${calculatorId}: future-review item must remain unverified`,
  );
  assert.ok(
    roadmap.includes(record.implemented_version),
    `${calculatorId}: roadmap must preserve the current runtime version`,
  );
}

assert.match(roadmap, /\*\*Implemented and source-verified\*\*:/);
assert.match(
  roadmap,
  /guideline-versions\.json/,
  "roadmap must link readers to the authoritative per-calculator registry",
);
assert.match(roadmap, /PE-RADS v2026.*new-calculator candidate/i);
assert.doesNotMatch(roadmap, /items under clinical review: Bosniak/i);
assert.doesNotMatch(roadmap, /MELD-Na the calculator implements today/i);
assert.doesNotMatch(roadmap, /calculator implements the 5th edition/i);
assert.doesNotMatch(roadmap, /all 43.*(?:current|verified)/i);
assert.doesNotMatch(
  roadmap,
  /\*\*Implemented and source-verified\*\*:[^\n]*FDA MQSA 2024/i,
  "roadmap must use the 2023 Final Rule and its 2024 enforcement date, not an ambiguous MQSA 2024 label",
);

console.log("Roadmap guideline-status integrity regression passed");
