import assert from "node:assert/strict";
import fs from "node:fs";

const registryPath =
  "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json";
const roadmap = fs.readFileSync("docs/ROADMAP.md", "utf8");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const records = new Map(
  registry.records.map((record) => [record.calculator_id, record]),
);

for (const [calculatorId, implementedVersion] of [
  ["bosniak", "Bosniak version 2019"],
  ["meld-na", "MELD 3.0 (OPTN Policy 9.1.D)"],
  ["birads", "FDA MQSA 2024 with ACR BI-RADS v2025 context"],
]) {
  const record = records.get(calculatorId);
  assert.ok(record, `${calculatorId}: registry row is required`);
  assert.equal(record.verification_status, "verified", `${calculatorId}: registry status`);
  assert.equal(record.implemented_version, implementedVersion, `${calculatorId}: registry version`);
  assert.ok(
    roadmap.includes(implementedVersion),
    `${calculatorId}: roadmap must name the exact verified implementation`,
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

console.log("Roadmap guideline-status integrity regression passed");
