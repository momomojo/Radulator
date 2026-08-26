import assert from "node:assert/strict";
import fs from "node:fs";

const registryPath =
  "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json";
const roadmap = fs.readFileSync("docs/ROADMAP.md", "utf8");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const records = new Map(
  registry.records.map((record) => [record.calculator_id, record]),
);

for (const evidence of [
  {
    calculatorId: "bosniak",
    implementedVersion: "Bosniak version 2019",
    roadmapLabel: "Bosniak version 2019 CT classification",
    sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/",
    command: "npm run test:bosniak-source",
    vectorId: "exactly-4-mm-obtuse-margin-enhancing-nodule-category-iv",
  },
  {
    calculatorId: "meld-na",
    implementedVersion: "MELD 3.0 (OPTN Policy 9.1.D)",
    roadmapLabel: "MELD 3.0 (OPTN Policy 9.1.D)",
    sourceUrl: "https://www.hrsa.gov/sites/default/files/hrsa/optn/optn_policies.pdf",
    command: "npm run test:hermes-guideline-registry",
    vectorId: "meld3-adult-female-sex-term",
  },
  {
    calculatorId: "birads",
    implementedVersion: "FDA MQSA 2024 with ACR BI-RADS v2025 context",
    roadmapLabel:
      "FDA 2023 MQSA Final Rule (enforced September 10, 2024) with ACR BI-RADS v2025 context",
    sourceUrl:
      "https://www.fda.gov/radiation-emitting-products/mammography-quality-standards-act-mqsa-and-mqsa-program/important-information-final-rule-amend-mammography-quality-standards-act-mqsa",
    command: "npm run test:birads-fda-source",
    vectorId: "category-4",
  },
]) {
  const { calculatorId, implementedVersion, roadmapLabel, sourceUrl, command, vectorId } =
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
    record.implementation_evidence.claims.some(
      (claim) => claim.source_url === sourceUrl && claim.vector_ids.includes(vectorId),
    ),
    `${calculatorId}: roadmap vector must remain bound to the cited source`,
  );
  assert.ok(
    roadmap.includes(sourceUrl) && roadmap.includes(command) && roadmap.includes(vectorId),
    `${calculatorId}: roadmap must expose its exact source, command, and executable vector`,
  );
}

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
