#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { ALBIScore } from "../src/components/calculators/ALBIScore.jsx";

const SOURCE_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC4322258/";
const SOURCE_HOST = "pmc.ncbi.nlm.nih.gov";
const ARTICLE_DOI = "10.1200/JCO.2014.57.9151";
const FIXTURE_PATH = "tests/fixtures/compute/albi-score.json";
const CALCULATOR_PATH = "src/components/calculators/ALBIScore.jsx";
const BOUND_VECTOR_IDS = Object.freeze([
  "published-representative-grade-1",
  "grade-1-upper-boundary",
  "grade-2-lower-interior",
  "grade-2-upper-boundary",
  "grade-3-lower-interior",
  "us-unit-equivalence",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fetchPrimaryHtml() {
  const expected = new URL(SOURCE_URL);
  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(SOURCE_URL, {
        headers: { "user-agent": "Radulator-ALBI-primary-source-audit/1" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        lastFailure = `HTTP ${response.status}`;
        await response.body?.cancel();
        if (response.status !== 429 && response.status < 500) break;
      } else {
        const finalUrl = new URL(response.url);
        assert.equal(finalUrl.protocol, "https:", "ALBI source redirect left HTTPS");
        assert.equal(finalUrl.hostname, SOURCE_HOST, "ALBI source redirect left PMC");
        assert.equal(finalUrl.pathname, expected.pathname, "unexpected ALBI source redirect path");
        assert.match(
          response.headers.get("content-type") ?? "",
          /^text\/html\b/i,
          "ALBI primary source must be HTML",
        );
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.ok(bytes.length > 100_000, "ALBI source response is unexpectedly small");
        assert.ok(bytes.length <= 2_000_000, "ALBI source response is unexpectedly large");
        return { bytes, html: bytes.toString("utf8") };
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  assert.fail(`ALBI primary-source retrieval failed after 3 attempts (${lastFailure})`);
}

function decodeHtmlEntities(value) {
  const named = new Map([
    ["amp", "&"],
    ["apos", "'"],
    ["ge", ">="],
    ["gt", ">"],
    ["le", "<="],
    ["lt", "<"],
    ["micro", "u"],
    ["minus", "-"],
    ["nbsp", " "],
    ["quot", '"'],
    ["times", "x"],
  ]);
  return value
    .replace(/&#x([a-f0-9]+);/gi, (_, digits) =>
      String.fromCodePoint(Number.parseInt(digits, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&([a-z]+);/gi, (entity, name) => named.get(name.toLowerCase()) ?? entity);
}

function visibleText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/×/g, "x")
    .replace(/μ/g, "u")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function assertFixtureExpectation(result, expectation, vectorId) {
  const hasError = Object.prototype.hasOwnProperty.call(result, "Error");
  assert.equal(hasError, expectation.noError === false, `${vectorId}: Error state`);
  for (const field of expectation.fields) {
    assert.ok(Object.prototype.hasOwnProperty.call(result, field.key), `${vectorId}: missing ${field.key}`);
    const actual = String(result[field.key]);
    if (Object.prototype.hasOwnProperty.call(field, "equals")) {
      assert.equal(actual, String(field.equals), `${vectorId}: ${field.key}`);
    } else {
      assert.ok(
        actual.includes(String(field.includes)),
        `${vectorId}: ${field.key} lacks ${JSON.stringify(field.includes)}`,
      );
    }
  }
}

const source = await fetchPrimaryHtml();
const sourceText = visibleText(source.html);
assert.ok(sourceText.includes(ARTICLE_DOI.toLowerCase()), "PMC article lacks the expected DOI");
assert.ok(
  sourceText.includes(
    "linear predictor = (log 10 bilirubin x 0.66) + (albumin x -0.085), where bilirubin is in umol/l and albumin in g/l",
  ),
  "primary paper lacks the printed ALBI equation, coefficients, or units",
);
assert.ok(
  sourceText.includes(
    "xb <= -2.60 (albi grade 1), more than -2.60 to <= -1.39 (albi grade 2), and xb more than -1.39 (albi grade 3)",
  ),
  "primary paper lacks the three printed ALBI grade intervals",
);
assert.ok(
  sourceText.includes("based on 1,313 patients with hcc of all stages from japan"),
  "primary paper lacks the HCC development-population statement",
);

const calculatorSource = await readFile(CALCULATOR_PATH, "utf8");
const formula = calculatorSource.match(
  /Math\.log10\(biliSI\)\s*\*\s*([0-9.]+)\s*\+\s*albSI\s*\*\s*(-[0-9.]+)/,
);
assert.ok(formula, "runtime ALBI formula could not be parsed");
assert.equal(Number(formula[1]), 0.66, "runtime bilirubin coefficient drifted from source");
assert.equal(Number(formula[2]), -0.085, "runtime albumin coefficient drifted from source");
assert.match(calculatorSource, /if \(albiScore <= -2\.6\)/, "runtime Grade 1 boundary drifted");
assert.match(
  calculatorSource,
  /else if \(albiScore <= -1\.39\)/,
  "runtime Grade 2/3 boundary drifted",
);
for (const unsupported of [
  "Median survival in original cohort",
  "Suitable for curative therapies",
  "May be suitable for locoregional therapies",
  "consider best supportive care or clinical trials",
]) {
  assert.ok(!calculatorSource.includes(unsupported), `unsupported runtime claim remains: ${unsupported}`);
}
assert.ok(
  calculatorSource.includes("does not determine treatment eligibility for an individual patient"),
  "runtime lacks the source-scope safety boundary",
);

const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
assert.equal(fixture.calculatorId, "albi-score");
const casesById = new Map(fixture.cases.map((testCase) => [testCase.id, testCase]));
assert.equal(casesById.size, fixture.cases.length, "ALBI fixture IDs must be unique");
for (const vectorId of BOUND_VECTOR_IDS) {
  const testCase = casesById.get(vectorId);
  assert.ok(testCase, `ALBI fixture lacks ${vectorId}`);
  assertFixtureExpectation(ALBIScore.compute({ ...testCase.inputs }), testCase.expect, vectorId);
}

const audit = {
  schema: "radulator-albi-primary-source-audit/v1",
  article_pmcid: "PMC4322258",
  article_doi: ARTICLE_DOI,
  source_url: SOURCE_URL,
  source_bytes: source.bytes.length,
  source_sha256: sha256(source.bytes),
  source_claims: {
    bilirubin_transform: "log10",
    bilirubin_coefficient: 0.66,
    bilirubin_unit: "umol/L",
    albumin_coefficient: -0.085,
    albumin_unit: "g/L",
    grade_1: "xb <= -2.60",
    grade_2: "xb > -2.60 to <= -1.39",
    grade_3: "xb > -1.39",
    development_population: "patients with HCC",
  },
  bound_vector_ids: [...BOUND_VECTOR_IDS],
  runtime_vector_match: true,
  fixture_vector_match: true,
  unsupported_original_cohort_claims_removed: true,
  source_bytes_committed: false,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(audit)}\n`);
} else {
  console.log(
    "ALBI primary-source audit passed: printed equation, units, grade intervals, source scope, and 6 executable vectors.",
  );
}
