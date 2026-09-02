import assert from "node:assert/strict";
import fs from "node:fs";

const registryPath =
  "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json";
const roadmap = fs.readFileSync("docs/ROADMAP.md", "utf8");
const e2eWorkflow = fs.readFileSync(".github/workflows/e2e-tests.yml", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const records = new Map(
  registry.records.map((record) => [record.calculator_id, record]),
);

const roadmapEvidence = [
  {
    calculatorId: "bosniak",
    implementedVersion: "Bosniak version 2019",
    roadmapLabel: "Bosniak version 2019 CT classification",
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/?report=reader",
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
];

for (const evidence of roadmapEvidence) {
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

for (const { calculatorId, command } of roadmapEvidence) {
  if (command === "npm run test:hermes-guideline-registry") continue;
  const scriptName = command.replace(/^npm run /, "");
  const scriptCommand = packageJson.scripts[scriptName];
  assert.match(
    scriptCommand,
    /^node (scripts\/audit-[a-z0-9-]+-source\.test\.mjs)$/,
    `${calculatorId}: roadmap command must resolve to a conventional discoverable source audit`,
  );
  assert.ok(
    fs.existsSync(scriptCommand.replace(/^node /, "")),
    `${calculatorId}: roadmap source-audit test must exist`,
  );
}
assert.match(
  e2eWorkflow,
  /name: Verify roadmap clinical source audits at exact head[\s\S]*?export LC_ALL=C\s+for audit in scripts\/audit-\*-source\.test\.mjs; do\s+test -f "\$audit"\s+node "\$audit"\s+done[\s\S]*?npm run test:hermes-guideline-registry/,
  "the required exact-head Smoke job must discover every conventional source audit and retain the registry check",
);
assert.equal(
  packageJson.scripts["test:primary-source"],
  'export LC_ALL=C; for audit in scripts/audit-*-source.test.mjs; do test -f "$audit" && node "$audit" || exit; done; npm run test:cac-drs-source',
  "the local primary-source aggregate must discover the same conventional audits as exact-head CI",
);
assert.ok(
  fs.readdirSync("scripts").includes("audit-fleischner-primary-source.test.mjs"),
  "the Fleischner audit must remain discoverable by local and exact-head source aggregates",
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
