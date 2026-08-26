#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { RenalCystBosniak } from "../src/components/calculators/RenalCystBosniak.jsx";

const FIXTURE_PATH = "tests/fixtures/compute/bosniak.json";
const SOURCE_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/";
const SOURCE_HOST = "pmc.ncbi.nlm.nih.gov";
const BOUND_VECTOR_IDS = Object.freeze([
  "exactly-70-hu-homogeneous-noncontrast-mass-category-ii",
  "exactly-4-mm-obtuse-margin-enhancing-nodule-category-iv",
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
        headers: { "user-agent": "Radulator-Bosniak-primary-source-audit/1" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        lastFailure = `HTTP ${response.status}`;
        await response.body?.cancel();
        if (response.status !== 429 && response.status < 500) break;
      } else {
        const finalUrl = new URL(response.url);
        assert.equal(finalUrl.protocol, "https:", "primary source redirect left HTTPS");
        assert.equal(finalUrl.hostname, SOURCE_HOST, "primary source redirect left PMC");
        assert.equal(finalUrl.pathname, expected.pathname, "unexpected primary source redirect path");
        assert.match(
          response.headers.get("content-type") ?? "",
          /^text\/html\b/i,
          "primary source must be HTML",
        );
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.ok(bytes.length > 10_000, "primary source response is unexpectedly small");
        assert.ok(bytes.length <= 5_000_000, "primary source response is unexpectedly large");
        return { bytes, html: bytes.toString("utf8") };
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  assert.fail(`primary Bosniak source retrieval failed after 3 attempts (${lastFailure})`);
}

function decodeHtmlEntities(value) {
  const named = new Map([
    ["amp", "&"],
    ["apos", "'"],
    ["ge", ">="],
    ["gt", ">"],
    ["le", "<="],
    ["lt", "<"],
    ["nbsp", " "],
    ["quot", '"'],
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
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function assertFixtureExpectation(result, expectation, vectorId) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, "Error"),
    expectation.noError === false,
    `${vectorId}: Error state`,
  );
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
const primaryText = visibleText(source.html);
assert.ok(
  primaryText.includes("well-defined homogeneous masses of 70 hu or greater"),
  "primary publication lacks the inclusive 70 HU category-II boundary",
);
assert.ok(
  primaryText.includes("focal enhancing convex protrusion 4 mm or larger"),
  "primary publication lacks the inclusive 4 mm category-IV nodule boundary",
);
assert.ok(
  primaryText.includes("obtuse margins with the wall or septa"),
  "primary publication lacks the obtuse-margin nodule qualifier",
);

const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
assert.equal(fixture.calculatorId, "bosniak");
const casesById = new Map(fixture.cases.map((testCase) => [testCase.id, testCase]));
assert.equal(casesById.size, fixture.cases.length, "Bosniak fixture IDs must be unique");
for (const vectorId of BOUND_VECTOR_IDS) {
  const testCase = casesById.get(vectorId);
  assert.ok(testCase, `Bosniak fixture lacks ${vectorId}`);
  assertFixtureExpectation(
    RenalCystBosniak.compute({ ...testCase.inputs }),
    testCase.expect,
    vectorId,
  );
}

const audit = {
  schema: "radulator-bosniak-primary-source-audit/v1",
  source_authority: "Silverman et al., Radiology 2019",
  source_url: SOURCE_URL,
  source_bytes: source.bytes.length,
  source_sha256: sha256(source.bytes),
  source_claims: {
    homogeneous_noncontrast_mass_70_hu_or_greater: true,
    obtuse_margin_nodule_4_mm_or_larger: true,
  },
  bound_vector_ids: [...BOUND_VECTOR_IDS],
  runtime_vector_match: true,
  fixture_vector_match: true,
  source_bytes_committed: false,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(audit)}\n`);
} else {
  console.log(
    "Bosniak primary-source audit passed: 2 inclusive source boundaries and 2 executable vectors.",
  );
}
