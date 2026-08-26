#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

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
const allowedEvidenceDimensions = new Set([
  "boundary",
  "classification",
  "formula",
  "interpretation",
  "model-input",
  "output",
  "scope",
  "threshold",
  "unit",
  "version",
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

function assertComputeExpectation(result, expectation, context) {
  const hasError = Object.prototype.hasOwnProperty.call(result, "Error");
  if (expectation.noError === true) {
    assert.equal(hasError, false, `${context}: expected no Error but got ${result.Error}`);
  }
  if (expectation.noError === false) {
    assert.equal(hasError, true, `${context}: expected an Error result`);
  }

  assert.ok(
    Array.isArray(expectation.fields) && expectation.fields.length > 0,
    `${context}: evidence vectors must assert at least one observable result field`,
  );
  for (const [fieldIndex, field] of expectation.fields.entries()) {
    const fieldLabel = `${context}.expect.fields[${fieldIndex}]`;
    assertBoundedString(field.key, `${fieldLabel}.key`, 1, 120);
    assert.ok(
      Object.prototype.hasOwnProperty.call(field, "equals") !==
        Object.prototype.hasOwnProperty.call(field, "includes"),
      `${fieldLabel}: use exactly one of equals or includes`,
    );
    assert.ok(
      Object.prototype.hasOwnProperty.call(result, field.key),
      `${context}: missing result key ${JSON.stringify(field.key)}`,
    );
    const actual = String(result[field.key]);
    if (Object.prototype.hasOwnProperty.call(field, "equals")) {
      assert.equal(actual, String(field.equals), `${context}: ${field.key}`);
    } else {
      assert.ok(
        actual.includes(String(field.includes)),
        `${context}: ${field.key} must include ${JSON.stringify(field.includes)}; got ${JSON.stringify(actual)}`,
      );
    }
  }
}

function parseLinearPredictorTerms(calculatorSource, label) {
  const functionStart = calculatorSource.indexOf(
    "export function calculateKbrcMajorBleedingProbability",
  );
  assert.notEqual(functionStart, -1, `${label}: KBRC probability function is missing`);
  const expressionMatch = calculatorSource.slice(functionStart).match(
    /const\s+linearPredictor\s*=([\s\S]*?);/,
  );
  assert.ok(expressionMatch, `${label}: KBRC linear predictor expression is missing`);
  const expression = expressionMatch[1].replace(/\s+/g, "");
  const numberPattern = String.raw`\d+(?:\.\d+)?(?:e[+-]?\d+)?`;
  const intercept = expression.match(new RegExp(`^(${numberPattern})`));
  assert.ok(intercept, `${label}: source intercept could not be parsed`);

  const terms = [
    {
      sign: "+",
      coefficient: Number(intercept[1]),
      input: "constant",
    },
  ];
  const termPattern = new RegExp(
    `([+-])(${numberPattern})\\*(?:pp\\(([A-Za-z_][A-Za-z0-9_]*),(${numberPattern})\\)|Number\\(([A-Za-z_][A-Za-z0-9_]*)\\)|([A-Za-z_][A-Za-z0-9_]*))`,
    "gy",
  );
  termPattern.lastIndex = intercept[0].length;
  while (termPattern.lastIndex < expression.length) {
    const match = termPattern.exec(expression);
    assert.ok(match, `${label}: unparsed KBRC expression at ${termPattern.lastIndex}`);
    const term = {
      sign: match[1],
      coefficient: Number(match[2]),
      input: match[3] ?? match[5] ?? match[6],
    };
    if (match[3]) term.positive_part_cubic_knot = Number(match[4]);
    if (match[5]) term.transform = "number";
    terms.push(term);
  }
  return terms;
}

function assertSourceArtifactExtraction(evidence, fixture, calculatorSource, label) {
  const artifact = evidence.source_artifact;
  assert.equal(
    typeof artifact,
    "object",
    `${label}.source_artifact is required for source-exact model verification`,
  );
  assert.equal(
    artifact.schema,
    "radulator-source-artifact-extraction/v1",
    `${label}.source_artifact.schema`,
  );
  for (const key of ["full_text_xml_url", "archive_url"]) {
    assertBoundedString(artifact[key], `${label}.source_artifact.${key}`, 12, 400);
    assert.equal(new URL(artifact[key]).protocol, "https:", `${label}.source_artifact.${key}`);
  }
  assert.ok(
    evidence.claims.some((claim) => claim.source_url === artifact.full_text_xml_url),
    `${label}.source_artifact must bind to a primary-source implementation claim`,
  );
  assert.equal(artifact.archive_member, "mmc1.pdf", `${label}.source_artifact.archive_member`);
  assert.equal(
    artifact.archive_member_bytes,
    3696579,
    `${label}.source_artifact.archive_member_bytes`,
  );
  assert.equal(
    artifact.archive_member_sha256,
    "d05d344c32a94e797587c5cb79896117026199d0dacd36ea1c0f28856848f6f5",
    `${label}.source_artifact.archive_member_sha256`,
  );
  assertBoundedString(artifact.source_locator, `${label}.source_artifact.source_locator`, 3, 240);
  assert.ok(
    Array.isArray(artifact.equation_terms) &&
      artifact.equation_terms.length >= 2 &&
      artifact.equation_terms.length <= 40,
    `${label}.source_artifact.equation_terms must contain 2-40 terms`,
  );
  assert.deepEqual(
    parseLinearPredictorTerms(calculatorSource, label),
    artifact.equation_terms,
    `${label}: executable coefficients, signs, inputs, or spline knots drifted from Item S1`,
  );
  assert.ok(
    Array.isArray(artifact.published_example_vector_ids) &&
      artifact.published_example_vector_ids.length >= 2 &&
      artifact.published_example_vector_ids.length <= 12,
    `${label}.source_artifact.published_example_vector_ids must contain 2-12 vectors`,
  );
  const casesById = new Map(fixture.cases.map((testCase) => [testCase.id, testCase]));
  for (const vectorId of artifact.published_example_vector_ids) {
    assert.ok(casesById.has(vectorId), `${label}.source_artifact: missing vector ${vectorId}`);
  }
}

async function assertExecutableImplementationEvidence(record, calculator) {
  const label = `${record.calculator_id}.implementation_evidence`;
  const evidence = record.implementation_evidence;
  assert.equal(typeof evidence, "object", `${label} is required for verified rows`);
  assert.equal(evidence.schema, "radulator-source-derived-evidence/v1", `${label}.schema`);

  const expectedCalculatorPath = `src/components/calculators/${calculator.filename}`;
  assert.equal(
    evidence.calculator_path,
    expectedCalculatorPath,
    `${label}.calculator_path must identify the executable calculator export`,
  );
  assert.equal(
    evidence.fixture_path,
    `tests/fixtures/compute/${record.calculator_id}.json`,
    `${label}.fixture_path must use the calculator's canonical compute fixture`,
  );
  assert.equal(
    evidence.test_command,
    "npm run test:hermes-guideline-registry",
    `${label}.test_command must execute this exact registry-bound evidence test`,
  );
  assert.equal(
    evidence.metadata_expectation?.field,
    "guidelineVersion",
    `${label}.metadata_expectation must bind the public guideline-version metadata`,
  );
  assertBoundedString(
    evidence.metadata_expectation?.equals,
    `${label}.metadata_expectation.equals`,
    3,
    180,
  );
  assert.ok(
    Array.isArray(evidence.claims) && evidence.claims.length >= 1 && evidence.claims.length <= 12,
    `${label}.claims must contain 1-12 source-derived claims`,
  );

  const sourceUrls = new Set(record.sources.map((source) => source.url));
  const sourceArtifactDigests = new Map(
    record.sources
      .filter((source) => source.artifact_sha256 !== undefined)
      .map((source) => [source.url, source.artifact_sha256]),
  );
  const claimsBySource = new Map();
  const claimIds = new Set();
  const vectorIds = new Set();
  for (const [claimIndex, claim] of evidence.claims.entries()) {
    const claimLabel = `${label}.claims[${claimIndex}]`;
    assertBoundedString(claim.id, `${claimLabel}.id`, 3, 80);
    assert.match(claim.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${claimLabel}.id must be kebab-case`);
    assert.ok(!claimIds.has(claim.id), `${claimLabel}.id must be unique`);
    claimIds.add(claim.id);
    assert.ok(sourceUrls.has(claim.source_url), `${claimLabel}.source_url must reference a listed source`);
    if (claim.source_sha256 !== undefined) {
      assert.match(
        claim.source_sha256,
        /^[a-f0-9]{64}$/,
        `${claimLabel}.source_sha256 must be a lowercase SHA-256 digest`,
      );
      assert.equal(
        claim.source_sha256,
        sourceArtifactDigests.get(claim.source_url),
        `${claimLabel}.source_sha256 must match the listed primary-source artifact`,
      );
    }
    assertBoundedString(claim.source_locator, `${claimLabel}.source_locator`, 3, 240);
    assertBoundedString(claim.fact, `${claimLabel}.fact`, 20, 400);
    assert.ok(
      Array.isArray(claim.dimensions) && claim.dimensions.length >= 1 && claim.dimensions.length <= 6,
      `${claimLabel}.dimensions must contain 1-6 entries`,
    );
    for (const dimension of claim.dimensions) {
      assert.ok(allowedEvidenceDimensions.has(dimension), `${claimLabel}: unsupported dimension ${dimension}`);
    }
    assert.equal(
      new Set(claim.dimensions).size,
      claim.dimensions.length,
      `${claimLabel}.dimensions must not contain duplicates`,
    );
    assert.ok(
      Array.isArray(claim.vector_ids) && claim.vector_ids.length >= 1 && claim.vector_ids.length <= 24,
      `${claimLabel}.vector_ids must contain 1-24 executable case ids`,
    );
    for (const vectorId of claim.vector_ids) {
      assertBoundedString(vectorId, `${claimLabel}.vector_ids[]`, 3, 100);
      vectorIds.add(vectorId);
    }
    if (!claimsBySource.has(claim.source_url)) claimsBySource.set(claim.source_url, 0);
    claimsBySource.set(claim.source_url, claimsBySource.get(claim.source_url) + 1);
  }

  for (const source of record.sources.filter((item) =>
    ["official-authority", "primary-publication"].includes(item.role),
  )) {
    assert.ok(
      claimsBySource.has(source.url),
      `${label}: primary or official source lacks a bounded implementation claim: ${source.url}`,
    );
  }

  const fixturePath = path.join(root, evidence.fixture_path);
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  assert.equal(fixture.calculatorId, record.calculator_id, `${label}: fixture calculatorId mismatch`);
  const casesById = new Map((fixture.cases || []).map((testCase) => [testCase.id, testCase]));
  assert.equal(casesById.size, fixture.cases?.length, `${label}: fixture case ids must be unique`);

  const calculatorPath = path.join(root, evidence.calculator_path);
  const calculatorSource = readFileSync(calculatorPath, "utf8");
  const calculatorModule = await import(pathToFileURL(calculatorPath).href);
  const calculatorExport = Object.values(calculatorModule).find(
    (value) => value && typeof value === "object" && value.id === record.calculator_id,
  );
  assert.equal(
    typeof calculatorExport?.compute,
    "function",
    `${label}: calculator path must export compute() for ${record.calculator_id}`,
  );
  assert.equal(
    calculatorExport.guidelineVersion,
    evidence.metadata_expectation.equals,
    `${label}: executable calculator guidelineVersion drifted from the source-reviewed evidence`,
  );

  for (const vectorId of [...vectorIds].sort()) {
    const testCase = casesById.get(vectorId);
    assert.ok(testCase, `${label}: evidence vector does not exist: ${vectorId}`);
    assert.ok(testCase.inputs && typeof testCase.inputs === "object", `${label}: ${vectorId} needs literal inputs`);
    const result = calculatorExport.compute({ ...testCase.inputs });
    assertComputeExpectation(result, testCase.expect || {}, `${record.calculator_id}/${vectorId}`);
  }

  if (record.calculator_id === "kidney-biopsy-bleeding-risk") {
    assertSourceArtifactExtraction(evidence, fixture, calculatorSource, label);
  }
}

const calculators = calculatorMetadata();
const registry = JSON.parse(readFileSync(registryPath, "utf8"));

assert.equal(registry.schema, "radulator-guideline-registry/v1");
assert.equal(registry.records.length, calculators.length);

const recordsByCalculator = new Map();
const calculatorsById = new Map(calculators.map((calculator) => [calculator.id, calculator]));
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
    if (source.artifact_sha256 !== undefined) {
      assert.match(
        source.artifact_sha256,
        /^[a-f0-9]{64}$/,
        `${sourceLabel}.artifact_sha256 must be a lowercase SHA-256 digest`,
      );
    }
  }

  if (record.verification_status === "verified") {
    assert.match(record.last_verified, /^\d{4}-\d{2}-\d{2}$/, `${label}.last_verified must be an ISO date`);
    assert.ok(record.sources.some((source) => source.role !== "supporting-publication"), `${label} lacks a primary or official source`);
    await assertExecutableImplementationEvidence(record, calculatorsById.get(record.calculator_id));
  } else {
    assert.equal(record.last_verified, null, `${label}: unverified rows cannot carry a verification date`);
    assert.equal(
      record.implementation_evidence,
      undefined,
      `${label}: seed-unverified rows cannot claim implementation evidence`,
    );
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
