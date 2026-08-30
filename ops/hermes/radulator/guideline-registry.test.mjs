#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { digest } from "../../../scripts/release-policy.mjs";
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
  "interval",
  "duration",
  "management",
  "model-input",
  "output",
  "scope",
  "threshold",
  "unit",
  "version",
]);

function assertFleischnerReviewedEvidenceLink(evidence, label) {
  const link = evidence.reviewed_evidence;
  assert.equal(typeof link, "object", `${label}.reviewed_evidence is required`);
  assert.equal(
    link.schema,
    "radulator-reviewed-source-evidence-link/v1",
    `${label}.reviewed_evidence.schema`,
  );
  assert.equal(
    link.manifest_path,
    "docs/evidence/fleischner-2017-reviewed-evidence.json",
    `${label}.reviewed_evidence.manifest_path`,
  );
  assert.equal(
    link.ci_primary_full_text_verified,
    false,
    `${label}.reviewed_evidence must not claim CI verification of RSNA full text`,
  );

  const manifestPath = path.join(root, link.manifest_path);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.schema, "radulator-reviewed-source-evidence/v1");
  assert.equal(manifest.payload.calculator_id, "fleischner");
  assert.equal(manifest.payload.scope, "source-interpretation-only");
  assert.equal(manifest.review.schema, "radulator-independent-source-review/v1");
  assert.equal(manifest.review.disposition, "SOURCE_INTERPRETATION_APPROVED");
  assert.equal(manifest.review.release_authority, "none");
  assert.equal(
    digest(manifest.payload),
    manifest.review.payload_sha256,
    `${label}.reviewed_evidence manifest payload digest`,
  );
  assert.equal(
    link.payload_sha256,
    manifest.review.payload_sha256,
    `${label}.reviewed_evidence.payload_sha256`,
  );
  assert.equal(
    link.reviewer_revision,
    manifest.review.reviewer_revision,
    `${label}.reviewed_evidence.reviewer_revision`,
  );

  const primarySources = manifest.payload.sources.filter(
    (source) => source.review_transport === "interactive-browser",
  );
  assert.ok(primarySources.length >= 2, `${label}: reviewed primary sources are required`);
  assert.ok(
    primarySources.every(
      (source) => source.ci_full_text_fetched === false && source.content_sha256 === null,
    ),
    `${label}: manifest must preserve the primary full-text CI limitation`,
  );

  const claimProjection = (claim) => ({
    id: claim.id,
    source_url: claim.source_url,
    source_locator: claim.source_locator,
    fact: claim.fact,
    vector_ids: claim.vector_ids,
  });
  assert.equal(manifest.payload.claims.length, 12, `${label}: manifest must contain 12 claims`);
  assert.deepEqual(
    evidence.claims.map(claimProjection),
    manifest.payload.claims.map(claimProjection),
    `${label}: registry claims must exactly match manifest ids, sources, locators, and vectors`,
  );

  const expectedDimensions = new Map([
    ["fleischner-2017-applicability", ["scope", "management", "output"]],
    [
      "fleischner-2017-characterization-and-ipln",
      ["scope", "classification", "management", "output"],
    ],
    [
      "fleischner-2017-solid-table",
      ["threshold", "boundary", "interval", "management", "output"],
    ],
    [
      "fleischner-2017-multiple-nodule-routing",
      ["model-input", "threshold", "boundary", "management", "output"],
    ],
    [
      "fleischner-2017-subsolid-table",
      ["classification", "threshold", "interval", "duration", "management", "output"],
    ],
    [
      "fleischner-2017-selected-subsolid-escalation",
      ["classification", "threshold", "management", "output"],
    ],
    [
      "fleischner-2017-part-solid-component-escalation",
      ["classification", "threshold", "boundary", "management", "output"],
    ],
    ["fleischner-2017-risk-selection", ["model-input", "classification", "scope", "output"]],
    [
      "fleischner-2017-measurement-contract",
      ["model-input", "unit", "threshold", "scope", "output"],
    ],
    [
      "fleischner-2017-very-small-nodule-measurement",
      ["model-input", "unit", "threshold", "scope", "output"],
    ],
    ["nlm-fleischner-solid-table-cross-check", ["version", "threshold", "interval", "management"]],
    [
      "nlm-fleischner-subsolid-table-cross-check",
      ["version", "classification", "duration", "management"],
    ],
  ]);
  assert.deepEqual(
    evidence.claims.map((claim) => [claim.id, claim.dimensions]),
    [...expectedDimensions],
    `${label}: registry claims must preserve the reviewed evidence dimensions`,
  );
}

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
  for (const key of ["full_text_xml_url", "direct_pdf_url", "archive_url"]) {
    assertBoundedString(artifact[key], `${label}.source_artifact.${key}`, 12, 400);
    assert.equal(new URL(artifact[key]).protocol, "https:", `${label}.source_artifact.${key}`);
  }
  assert.ok(
    evidence.claims.some((claim) => claim.source_url === artifact.full_text_xml_url),
    `${label}.source_artifact must bind to a primary-source implementation claim`,
  );
  assert.equal(
    artifact.direct_pdf_url,
    "https://ars.els-cdn.com/content/image/1-s2.0-S2590059526001135-mmc1.pdf",
    `${label}.source_artifact.direct_pdf_url`,
  );
  assert.ok(
    evidence.claims.some((claim) => claim.source_url === artifact.direct_pdf_url),
    `${label}.source_artifact must bind the directly reviewable supplement to a claim`,
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
  assert.equal(
    artifact.license,
    "CC BY-NC-ND 4.0",
    `${label}.source_artifact.license`,
  );
  assert.equal(
    artifact.source_audit_command,
    "npm run test:kbrc-source",
    `${label}.source_artifact.source_audit_command`,
  );
  assert.equal(
    artifact.source_bytes_committed,
    false,
    `${label}.source_artifact must not vendor the no-derivatives source artifact`,
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
  if (record.calculator_id === "albi-score") {
    const audit = evidence.source_audit;
    assert.equal(typeof audit, "object", `${label}.source_audit is required`);
    assert.equal(audit.schema, "radulator-live-source-audit/v1", `${label}.source_audit.schema`);
    assert.equal(audit.command, "npm run test:albi-source", `${label}.source_audit.command`);
    assert.equal(
      audit.authority,
      "Johnson et al., Journal of Clinical Oncology 2015",
      `${label}.source_audit.authority`,
    );
    assert.deepEqual(
      audit.source_urls,
      ["https://pmc.ncbi.nlm.nih.gov/articles/PMC4322258/"],
      `${label}.source_audit.source_urls`,
    );
    assert.equal(audit.raw_source_bytes, 276155, `${label}.source_audit.raw_source_bytes`);
    assert.equal(audit.canonical_source_bytes, 276075, `${label}.source_audit.canonical_source_bytes`);
    assert.equal(
      audit.canonical_source_sha256,
      "fccc2f40b9ae8a85fcd7dbc093886be078a554db8f425322db6cffc3bd2499b0",
      `${label}.source_audit.canonical_source_sha256`,
    );
    assert.deepEqual(audit.canonicalization, [
      "replace ncbi_phid value with [volatile]",
      "replace csrfmiddlewaretoken value with [volatile]",
    ]);
    assert.deepEqual(audit.enforced_source_locators, {
      population: "Abstract > Patients and Methods (abstract1/sec2)",
      equation: "RESULTS (sec16), paragraph immediately before Table 2 (T2)",
      boundaries: "RESULTS (sec16), paragraph immediately after Table 2 (T2)",
    });
    assert.deepEqual(audit.vector_ids, [
      "published-representative-grade-1",
      "grade-1-upper-boundary",
      "grade-2-lower-interior",
      "grade-2-upper-boundary",
      "grade-3-lower-interior",
      "us-unit-equivalence",
    ]);
    assert.equal(audit.source_bytes_committed, false, `${label}.source_audit.source_bytes_committed`);
    for (const vectorId of audit.vector_ids) {
      assert.ok(casesById.has(vectorId), `${label}.source_audit: missing vector ${vectorId}`);
    }
  }
  if (record.calculator_id === "birads") {
    const audit = evidence.source_audit;
    assert.equal(typeof audit, "object", `${label}.source_audit is required`);
    assert.equal(
      audit.schema,
      "radulator-live-source-audit/v1",
      `${label}.source_audit.schema`,
    );
    assert.equal(
      audit.command,
      "npm run test:birads-fda-source",
      `${label}.source_audit.command`,
    );
    assert.equal(
      audit.authority,
      "American College of Radiology",
      `${label}.source_audit.authority`,
    );
    assert.deepEqual(
      audit.source_urls,
      [
        "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BIRADS-Poster.pdf",
        "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-Mammography.pdf",
        "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-Ultrasound.pdf",
        "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-MRI.pdf",
      ],
      `${label}.source_audit.source_urls`,
    );
    assert.deepEqual(
      audit.vector_ids,
      [
        "missing-modality-fails-closed",
        "invalid-finding-type-fails-closed",
        "mammography-incomplete",
        "ultrasound-incomplete",
        "mri-incomplete",
        "known-biopsy-proven-malignancy",
        "negative-finding-requires-radiologist-assessment",
        "negative-screening",
        "benign-finding-requires-radiologist-assessment",
        "benign-finding",
        "typically-benign-calcifications-require-radiologist-assessment",
        "probably-benign-mass",
        "invalid-active-descriptor-fails-closed",
        "low-suspicion-mass",
        "moderate-suspicion-calcifications",
        "high-suspicion-spiculated-mass",
        "highly-suggestive-linear-calcifications",
        "category-5-inclusive-95-boundary",
        "probably-benign-selection-does-not-infer-from-descriptors",
        "screening-mammography-probably-benign-no-uncited-warning",
        "hidden-calcification-distribution-does-not-leak",
        "developing-asymmetry",
        "associated-features",
        "ultrasound-associated-features-source-exact",
        "mri-rejects-category-4-subdivision",
        "ultrasound-calcifications-use-unsplit-category-4",
        "ultrasound-mass-ignores-stale-mammography-density",
        "ultrasound-suspicious-category-4",
      ],
      `${label}.source_audit.vector_ids`,
    );
    assert.equal(
      audit.source_bytes_committed,
      false,
      `${label}.source_audit.source_bytes_committed`,
    );
    for (const vectorId of audit.vector_ids) {
      assert.ok(casesById.has(vectorId), `${label}.source_audit: missing vector ${vectorId}`);
    }
  }
  if (record.calculator_id === "bosniak") {
    const audit = evidence.source_audit;
    assert.equal(typeof audit, "object", `${label}.source_audit is required`);
    assert.equal(
      audit.schema,
      "radulator-live-source-audit/v1",
      `${label}.source_audit.schema`,
    );
    assert.equal(
      audit.command,
      "npm run test:bosniak-source",
      `${label}.source_audit.command`,
    );
    assert.equal(
      audit.authority,
      "Silverman et al., Radiology 2019 and CUA 2023",
      `${label}.source_audit.authority`,
    );
    assert.deepEqual(
      audit.source_urls,
      [
        "https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/",
        "https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/",
      ],
      `${label}.source_audit.source_urls`,
    );
    assert.deepEqual(
      audit.vector_ids,
      [
        "exactly-70-hu-homogeneous-noncontrast-mass-category-ii",
        "exactly-4-mm-obtuse-margin-enhancing-nodule-category-iv",
        "minimally-thick-enhancing-wall-category-iif",
      ],
      `${label}.source_audit.vector_ids`,
    );
    assert.equal(
      audit.source_bytes_committed,
      false,
      `${label}.source_audit.source_bytes_committed`,
    );
    for (const vectorId of audit.vector_ids) {
      assert.ok(casesById.has(vectorId), `${label}.source_audit: missing vector ${vectorId}`);
    }
  }
  if (record.calculator_id === "fleischner") {
    assertFleischnerReviewedEvidenceLink(evidence, label);
    const audit = evidence.source_audit;
    const expectedSources = [
      "https://pubs.rsna.org/doi/10.1148/radiol.2017161659",
      "https://pubs.rsna.org/doi/10.1148/radiol.2017162894",
      "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab1/?report=objectonly",
      "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab2/?report=objectonly",
    ];
    assert.equal(typeof audit, "object", `${label}.source_audit is required`);
    assert.equal(audit.schema, "radulator-live-source-audit/v1", `${label}.source_audit.schema`);
    assert.equal(
      audit.command,
      "node scripts/audit-fleischner-primary-source.test.mjs",
      `${label}.source_audit.command`,
    );
    assert.equal(
      audit.authority,
      "Fleischner Society and RSNA 2017 with NLM open table cross-checks",
      `${label}.source_audit.authority`,
    );
    assert.deepEqual(audit.source_urls, expectedSources, `${label}.source_audit.source_urls`);
    assert.deepEqual(
      audit.primary_metadata_dois,
      ["10.1148/radiol.2017161659", "10.1148/radiol.2017162894"],
      `${label}.source_audit.primary_metadata_dois`,
    );
    assert.equal(
      audit.primary_full_text_fetched_by_ci,
      false,
      `${label}.source_audit must not claim the RSNA full text was fetched by CI`,
    );
    assert.deepEqual(
      audit.secondary_table_fragments,
      {
        "ch5.Tab1": {
          bytes: 3153,
          sha256: "d9cec9955406cd10d6ec93298dd61f1215dbdd18a38815a33d1af93407c1dbb9",
        },
        "ch5.Tab2": {
          bytes: 1912,
          sha256: "7e28fe2305cd1ce68afbd6bbd25e092f8301082085c7f8c6efec16d2b5b21997",
        },
      },
      `${label}.source_audit.secondary_table_fragments`,
    );
    assert.deepEqual(
      audit.vector_ids,
      [
        "single-solid-5-low-no-routine-follow-up",
        "single-solid-6-low-preserves-late-ct-option",
        "single-solid-9-consider-ct-pet-or-tissue",
        "multiple-solid-6-low-preserves-late-ct-option",
        "single-ground-glass-5-selected-suspicious-option",
        "single-ground-glass-6-until-year-5",
        "single-ground-glass-6-persistent-continues-to-year-5",
        "single-ground-glass-6-established-growth-uses-annual-follow-up",
        "single-ground-glass-new-solid-component-reroutes-to-part-solid",
        "single-ground-glass-validated-volumetric-growth-accepted",
        "multiple-ground-glass-5-initial-and-optional-late-ct",
        "multiple-ground-glass-6-defers-to-most-suspicious-nodule",
        "multiple-ground-glass-established-growth-uses-most-suspicious-route",
        "multiple-ground-glass-new-solid-component-uses-most-suspicious-route",
        "single-part-solid-6-component-5-baseline-persistence-check",
        "single-part-solid-6-component-5-persistent-uses-annual-follow-up",
        "single-part-solid-12-component-6-baseline-persistence-check",
        "single-part-solid-12-component-6-persistent-is-highly-suspicious",
        "single-part-solid-12-component-8-growing-escalates",
        "single-part-solid-12-component-8-validated-volumetric-growth-escalates",
        "single-part-solid-12-component-9-escalates-by-size",
        "screening-routes-away-without-schedule",
        "uncertain-characterization-routes-without-table",
        "fractional-overall-size-rejected",
        "ten-mm-legacy-axis-attestation-cannot-bypass-numeric-axes",
        "single-solid-10-valid-axes-accepted",
        "single-solid-10-axes-average-mismatch-rejected",
        "solid-component-long-axis-may-exceed-overall-average",
        "part-solid-component-exceeding-overall-long-axis-rejected",
        "categorical-lte3-pure-ggo-linear-growth-claim-rejected",
        "categorical-lte3-pure-ggo-validated-volumetric-growth-claim-rejected",
        "categorical-lte3-solid-component-linear-growth-claim-rejected",
        "categorical-lte3-solid-component-missing-basis-requires-recharacterization",
        "categorical-lte3-solid-component-validated-volumetric-growth-claim-rejected",
        "categorical-lte3-visually-new-component-requires-recharacterization",
        "part-solid-categorical-linear-growth-claim-rejected",
        "part-solid-categorical-lte3-component-avoids-false-precision",
        "part-solid-categorical-new-component-escalates-without-false-precision",
        "part-solid-categorical-validated-volumetric-growth-claim-rejected",
        "part-solid-measured-component-at-3-mm-rejected",
        "part-solid-missing-component-mode-rejected",
        "pure-ground-glass-missing-growth-basis-rejected",
        "pure-ground-glass-sub2mm-change-cannot-claim-growth",
        "solid-component-missing-growth-basis-rejected",
        "sub6-ground-glass-linear-component-growth-claim-rejected",
        "sub6-ground-glass-solid-component-missing-basis-requires-recharacterization",
        "sub6-ground-glass-validated-volumetric-component-growth-claim-rejected",
        "sub6-ground-glass-visually-new-component-requires-recharacterization",
        "sub6-part-solid-linear-component-growth-claim-rejected",
        "sub6-part-solid-solid-component-missing-basis-requires-recharacterization",
        "sub6-part-solid-validated-volumetric-component-growth-claim-rejected",
        "sub6-part-solid-visually-new-component-requires-recharacterization",
        "solid-component-unconfirmed-change-cannot-trigger-escalation",
      ],
      `${label}.source_audit.vector_ids`,
    );
    assert.equal(audit.source_bytes_committed, false, `${label}.source_audit.source_bytes_committed`);
    for (const vectorId of audit.vector_ids) {
      assert.ok(casesById.has(vectorId), `${label}.source_audit: missing vector ${vectorId}`);
    }
  }
  if (record.calculator_id === "contrast-dosing") {
    const audit = evidence.source_audit;
    const expectedSources = [
      "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/ACR-Manual-on-Contrast-Media.pdf",
      "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/Contrast-Reaction-Card-Adult.pdf",
      "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/Contrast-Reaction-Card-Pediatric.pdf",
    ];
    assert.equal(typeof audit, "object", `${label}.source_audit is required`);
    assert.equal(audit.schema, "radulator-live-source-audit/v1", `${label}.source_audit.schema`);
    assert.equal(audit.command, "npm run test:contrast-source", `${label}.source_audit.command`);
    assert.equal(audit.authority, "American College of Radiology", `${label}.source_audit.authority`);
    assert.deepEqual(audit.source_urls, expectedSources, `${label}.source_audit.source_urls`);
    assert.deepEqual(
      audit.vector_ids,
      [
        "egfr-without-stability-status-fails-closed",
        "stable-egfr-45-no-prophylaxis",
        "stable-egfr-30-no-routine-prophylaxis",
        "stable-egfr-44-individual-high-risk-only",
        "stable-egfr-29-isotonic-prophylaxis",
        "aki-egfr-is-unreliable",
        "anuric-dialysis-no-ciaki-prophylaxis",
        "dialysis-residual-function-higher-risk",
        "lower-viscosity-300-no-routine-warming",
        "higher-viscosity-370-selective-warming",
      ],
      `${label}.source_audit.vector_ids`,
    );
    assert.equal(audit.source_bytes_committed, false, `${label}.source_audit.source_bytes_committed`);
    for (const vectorId of audit.vector_ids) {
      assert.ok(casesById.has(vectorId), `${label}.source_audit: missing vector ${vectorId}`);
    }
    assert.deepEqual(
      calculatorExport.refs.slice(0, 3).map((reference) => reference.u),
      expectedSources,
      `${label}: runtime references must expose the exact ACR manual and reaction cards`,
    );
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
    last_verified: "2026-08-29",
    source_urls: [
      "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
      "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BIRADS-Poster.pdf",
      "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-Mammography.pdf",
      "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-Ultrasound.pdf",
      "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-MRI.pdf",
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
    source_url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2718410/",
  },
  "kidney-biopsy-bleeding-risk": {
    basis_type: "primary-model",
    source_url: "https://doi.org/10.1016/j.xkme.2026.101352",
  },
  fleischner: {
    basis_type: "clinical-guideline",
    last_verified: "2026-08-30",
    source_urls: [
      "https://pubs.rsna.org/doi/10.1148/radiol.2017161659",
      "https://pubs.rsna.org/doi/10.1148/radiol.2017162894",
    ],
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
