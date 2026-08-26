#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const calculatorDirectory = path.join(root, "src", "components", "calculators");
const registryPath = path.join(
  root,
  "ops",
  "hermes",
  "radulator",
  "skills",
  "radulator-operations",
  "references",
  "guideline-versions.json",
);

const allowedBasisTypes = new Set([
  "classification-system",
  "clinical-guideline",
  "consensus-statement",
  "manufacturer-reference",
  "measurement-reference",
  "non-clinical",
  "primary-model",
  "published-formula",
  "reference-dataset",
]);
const allowedStatuses = new Set(["seed-unverified", "verified"]);
const allowedSourceRoles = new Set([
  "context-guideline",
  "official-authority",
  "primary-publication",
  "supporting-publication",
]);

function calculatorMetadata() {
  return readdirSync(calculatorDirectory)
    .filter((filename) => filename.endsWith(".jsx"))
    .sort()
    .map((filename) => {
      const source = readFileSync(path.join(calculatorDirectory, filename), "utf8");
      const anchor = source.search(/export\s+(?:default|const\s+\w+\s*=)\s*{/);
      assert.notEqual(anchor, -1, `${filename}: exported calculator object is required`);
      const scope = source.slice(anchor);
      const readStaticString = (key) => {
        const raw = scope.match(
          new RegExp(`^\\s{2}${key}:\\s*("(?:\\\\.|[^"\\\\])*")`, "m"),
        )?.[1];
        assert.ok(raw, `${filename}: static ${key} metadata is required`);
        return JSON.parse(raw);
      };
      return {
        category: readStaticString("category"),
        filename,
        id: readStaticString("id"),
      };
    });
}

function assertBoundedString(value, label, minimum, maximum) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.equal(value, value.trim(), `${label} must not have surrounding whitespace`);
  assert.ok(
    value.length >= minimum && value.length <= maximum,
    `${label} must contain ${minimum}-${maximum} characters`,
  );
}

const calculators = calculatorMetadata();
const registry = JSON.parse(readFileSync(registryPath, "utf8"));

assert.equal(registry.schema, "radulator-guideline-registry/v1");
assert.equal(registry.records.length, calculators.length);

const recordsByCalculator = new Map();
for (const [index, record] of registry.records.entries()) {
  const label = `records[${index}]`;
  assertBoundedString(record.calculator_id, `${label}.calculator_id`, 2, 80);
  assert.ok(!recordsByCalculator.has(record.calculator_id), `${record.calculator_id}: duplicate registry mapping`);
  recordsByCalculator.set(record.calculator_id, record);

  assertBoundedString(record.title, `${label}.title`, 3, 120);
  assertBoundedString(record.implemented_version, `${label}.implemented_version`, 3, 180);
  assertBoundedString(record.justification, `${label}.justification`, 20, 500);
  assert.ok(allowedBasisTypes.has(record.basis_type), `${label}.basis_type is unsupported`);
  assert.ok(allowedStatuses.has(record.verification_status), `${label}.verification_status is unsupported`);

  if (record.basis_type === "non-clinical") {
    assert.deepEqual(record.sources, [], `${label}: non-clinical rows must not invent clinical sources`);
  } else {
    assert.ok(Array.isArray(record.sources), `${label}.sources must be an array`);
    assert.ok(record.sources.length >= 1 && record.sources.length <= 6, `${label}.sources must contain 1-6 entries`);
  }

  for (const [sourceIndex, source] of record.sources.entries()) {
    const sourceLabel = `${label}.sources[${sourceIndex}]`;
    assertBoundedString(source.authority, `${sourceLabel}.authority`, 2, 120);
    assertBoundedString(source.title, `${sourceLabel}.title`, 3, 240);
    assert.ok(allowedSourceRoles.has(source.role), `${sourceLabel}.role is unsupported`);
    assertBoundedString(source.url, `${sourceLabel}.url`, 12, 400);
    const parsed = new URL(source.url);
    assert.equal(parsed.protocol, "https:", `${sourceLabel}.url must use HTTPS`);
    assert.ok(parsed.hostname.includes("."), `${sourceLabel}.url must use a bounded host`);
  }

  if (record.verification_status === "verified") {
    assert.match(record.last_verified, /^\d{4}-\d{2}-\d{2}$/, `${label}.last_verified must be an ISO date`);
    assert.ok(record.sources.some((source) => source.role !== "supporting-publication"), `${label} lacks a primary or official source`);
  } else {
    assert.equal(record.last_verified, null, `${label}: unverified rows cannot carry a verification date`);
  }
}

for (const calculator of calculators) {
  const record = recordsByCalculator.get(calculator.id);
  assert.ok(record, `${calculator.filename}: ${calculator.id} lacks a registry mapping`);
  if (calculator.category === "Feedback") {
    assert.equal(record.basis_type, "non-clinical", `${calculator.id}: feedback must be explicitly non-clinical`);
  } else {
    assert.notEqual(record.basis_type, "non-clinical", `${calculator.id}: medical calculator cannot be non-clinical`);
  }
}

for (const [calculatorId, expected] of Object.entries({
  birads: {
    basis_type: "classification-system",
    last_verified: "2026-08-25",
    source_urls: [
      "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
      "https://www.fda.gov/radiation-emitting-products/mammography-quality-standards-act-mqsa-and-mqsa-program/important-information-final-rule-amend-mammography-quality-standards-act-mqsa",
    ],
  },
  "cac-mesa": {
    basis_type: "reference-dataset",
    source_url: "https://mesa-nhlbi.org/researchers/tools/cac-score-reference-values",
  },
  "cockcroft-gault": {
    basis_type: "published-formula",
    source_url: "https://pubmed.ncbi.nlm.nih.gov/1244564/",
  },
  pesi: {
    basis_type: "primary-model",
    source_url: "https://professional.heart.org/en/guidelines-statements/2026-ahaaccaccpchestscaishmsirsvmsvn-guideline-for-the-evaluation-andcir0000000000001415",
  },
  "kidney-biopsy-bleeding-risk": {
    basis_type: "primary-model",
    source_url: "https://doi.org/10.1016/j.xkme.2026.101352",
  },
})) {
  const record = recordsByCalculator.get(calculatorId);
  assert.ok(record, `${calculatorId}: required dedicated registry row is missing`);
  assert.equal(record.basis_type, expected.basis_type);
  assert.equal(record.verification_status, "verified");
  if (expected.last_verified) assert.equal(record.last_verified, expected.last_verified);
  for (const sourceUrl of expected.source_urls ?? [expected.source_url]) {
    assert.ok(
      record.sources.some((source) => source.url === sourceUrl),
      `${calculatorId}: authoritative source is missing: ${sourceUrl}`,
    );
  }
}

console.log(`Guideline registry coverage verified for ${calculators.length} calculator exports.`);
