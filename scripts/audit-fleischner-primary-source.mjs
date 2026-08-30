#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import process from "node:process";
import { Fleischner } from "../src/components/calculators/Fleischner.jsx";

const GUIDELINE_DOI = "10.1148/radiol.2017161659";
const MEASUREMENT_DOI = "10.1148/radiol.2017162894";
const WRONG_MEASUREMENT_DOI = "10.1148/radiol.2017170044";
const FIXTURE_PATH = "tests/fixtures/compute/fleischner.json";
const CALCULATOR_PATH = "src/components/calculators/Fleischner.jsx";
const SOLID_TABLE_URL =
  "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab1/?report=objectonly";
const SUBSOLID_TABLE_URL =
  "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab2/?report=objectonly";

const EXPECTED_TABLES = {
  solid: {
    objectId: "ch5.Tab1",
    bytes: 3153,
    sha256:
      "d9cec9955406cd10d6ec93298dd61f1215dbdd18a38815a33d1af93407c1dbb9",
  },
  subsolid: {
    objectId: "ch5.Tab2",
    bytes: 1912,
    sha256:
      "7e28fe2305cd1ce68afbd6bbd25e092f8301082085c7f8c6efec16d2b5b21997",
  },
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function fetchResponse(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Radulator-Fleischner-source-audit/1" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  assert.fail(`${url}: retrieval failed after 3 attempts (${lastError})`);
}

async function fetchText(url) {
  return (await fetchResponse(url)).text();
}

async function fetchJson(url) {
  return (await fetchResponse(url)).json();
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function crossrefMetadata(message) {
  const parts = message.published?.["date-parts"]?.[0] ?? [];
  const published = `${parts[0]}-${String(parts[1]).padStart(2, "0")}`;
  return {
    doi: message.DOI,
    title: normalizeWhitespace(message.title?.[0]),
    publisher: message.publisher,
    journal: message["container-title"]?.[0],
    volume: message.volume,
    issue: message.issue,
    pages: message.page,
    published,
  };
}

async function loadCrossref(doi) {
  const payload = await fetchJson(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
  );
  return crossrefMetadata(payload.message);
}

function extractTable(html, label) {
  const start = html.indexOf("<table");
  const end = html.indexOf("</table>", start);
  assert.ok(start >= 0 && end > start, `${label}: table fragment not found`);
  return html.slice(start, end + "</table>".length);
}

function assertFragment(fragment, expected, label) {
  assert.equal(Buffer.byteLength(fragment), expected.bytes, `${label}: bytes`);
  assert.equal(sha256(fragment), expected.sha256, `${label}: SHA-256`);
}

function assertExpectedText(fragment, snippets, label) {
  for (const snippet of snippets) {
    assert.ok(fragment.includes(snippet), `${label}: missing ${snippet}`);
  }
}

function assertFixtureExpectation(result, expectation, context) {
  const hasError = Object.hasOwn(result, "Error");
  if (expectation.noError === true) {
    assert.equal(hasError, false, `${context}: unexpected Error ${result.Error}`);
  }
  if (expectation.noError === false) {
    assert.equal(hasError, true, `${context}: expected an Error result`);
  }
  for (const field of expectation.fields ?? []) {
    assert.ok(Object.hasOwn(result, field.key), `${context}: missing ${field.key}`);
    const actual = String(result[field.key]);
    if (Object.hasOwn(field, "equals")) {
      assert.equal(actual, String(field.equals), `${context}: ${field.key}`);
    }
    if (Object.hasOwn(field, "includes")) {
      assert.ok(
        actual.includes(String(field.includes)),
        `${context}: ${field.key} missing ${field.includes}`,
      );
    }
  }
}

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
const calculatorSource = readFileSync(CALCULATOR_PATH, "utf8");

assert.equal(fixture.calculatorId, Fleischner.id);
assert.equal(Fleischner.guidelineVersion, "Fleischner 2017");
assert.equal(
  fixture.version,
  "fleischner-2017-primary-guideline-and-measurement-statement",
);
assert.ok(fixture.cases.length >= 40, "canonical fixture must cover the full audited table and invalid states");
assert.equal(
  new Set(fixture.cases.map((testCase) => testCase.id)).size,
  fixture.cases.length,
  "canonical vector ids must be unique",
);

for (const testCase of fixture.cases) {
  const result = Fleischner.compute({ ...testCase.inputs });
  assertFixtureExpectation(
    result,
    testCase.expect,
    `${fixture.calculatorId}/${testCase.id}`,
  );
}

const [guidelineMetadata, measurementMetadata, solidHtml, subsolidHtml] =
  await Promise.all([
    loadCrossref(GUIDELINE_DOI),
    loadCrossref(MEASUREMENT_DOI),
    fetchText(SOLID_TABLE_URL),
    fetchText(SUBSOLID_TABLE_URL),
  ]);

assert.deepEqual(guidelineMetadata, {
  doi: GUIDELINE_DOI,
  title:
    "Guidelines for Management of Incidental Pulmonary Nodules Detected on CT Images: From the Fleischner Society 2017",
  publisher: "Radiological Society of North America (RSNA)",
  journal: "Radiology",
  volume: "284",
  issue: "1",
  pages: "228-243",
  published: "2017-07",
});
assert.deepEqual(measurementMetadata, {
  doi: MEASUREMENT_DOI,
  title:
    "Recommendations for Measuring Pulmonary Nodules at CT: A Statement from the Fleischner Society",
  publisher: "Radiological Society of North America (RSNA)",
  journal: "Radiology",
  volume: "285",
  issue: "2",
  pages: "584-600",
  published: "2017-11",
});

const solidFragment = extractTable(solidHtml, "solid table");
const subsolidFragment = extractTable(subsolidHtml, "subsolid table");
assertFragment(solidFragment, EXPECTED_TABLES.solid, "solid table");
assertFragment(subsolidFragment, EXPECTED_TABLES.subsolid, "subsolid table");

assertExpectedText(
  solidFragment,
  [
    "No routine follow-up",
    "Optional CT at 12 months",
    "CT at 6&#x02013;12 months, then consider CT at 18&#x02013;24 months",
    "CT at 6&#x02013;12 months, then CT at 18&#x02013;24 months",
    "Consider CT, PET/CT or tissue sampling at 3 months",
    "CT at 3&#x02013;6 months, then consider CT at 18&#x02013;24 months",
    "CT at 3&#x02013;6 months, then CT at 18&#x02013;24 months",
  ],
  "solid table",
);
assertExpectedText(
  subsolidFragment,
  [
    "CT at 6&#x02013;12 months to confirm persistence, then CT every 2 years until 5 years",
    "If unchanged and solid component remains &#x0003c;6 mm, annual CT should be performed for 5 years",
    "CT at 3&#x02013;6 months. If stable, consider CT at 2 and 4 years",
    "CT at 3&#x02013;6 months. Subsequent management based on the most suspicious nodule(s)",
  ],
  "subsolid table",
);

assert.ok(calculatorSource.includes(MEASUREMENT_DOI));
assert.ok(!calculatorSource.includes(WRONG_MEASUREMENT_DOI));
assert.ok(!/mediastinal window settings/i.test(calculatorSource));

const sourceClaims = {
  solid: {
    single_lt6: ["No routine follow-up", "Optional CT at 12 months"],
    single_6_to_8: [
      "CT at 6–12 months, then consider CT at 18–24 months",
      "CT at 6–12 months, then CT at 18–24 months",
    ],
    single_gt8: "Consider CT, PET/CT, or tissue sampling at 3 months",
    multiple_lt6: ["No routine follow-up", "Optional CT at 12 months"],
    multiple_ge6: [
      "CT at 3–6 months, then consider CT at 18–24 months",
      "CT at 3–6 months, then CT at 18–24 months",
    ],
  },
  subsolid: {
    single_ground_glass_lt6: "No routine follow-up",
    single_ground_glass_ge6:
      "CT at 6–12 months to confirm persistence, then CT every 2 years until 5 years",
    single_part_solid_lt6: "No routine follow-up",
    single_part_solid_ge6:
      "CT at 3–6 months to confirm persistence. If unchanged and solid component remains <6 mm, annual CT should be performed for 5 years",
    multiple_lt6:
      "CT at 3–6 months. If stable, consider CT at 2 and 4 years",
    multiple_ge6:
      "CT at 3–6 months. Subsequent management based on the most suspicious nodule(s)",
  },
};

const audit = {
  schema: "radulator-fleischner-primary-source-audit/v1",
  calculator_id: Fleischner.id,
  guideline_version: Fleischner.guidelineVersion,
  primary_metadata: {
    guideline: guidelineMetadata,
    measurement: measurementMetadata,
  },
  primary_full_text_transport: {
    official_url: `https://pubs.rsna.org/doi/${GUIDELINE_DOI}`,
    reviewed_in_browser: true,
    fetched_by_ci: false,
    limitation:
      "RSNA primary full text was independently reviewed in a browser; the deterministic CI audit verifies DOI metadata and open table cross-checks without claiming it downloaded the bot-protected RSNA full text.",
  },
  secondary_cross_checks: {
    solid: {
      role: "secondary-open-table-reproduction",
      url: SOLID_TABLE_URL,
      object_id: EXPECTED_TABLES.solid.objectId,
      table_fragment_bytes: Buffer.byteLength(solidFragment),
      table_fragment_sha256: sha256(solidFragment),
    },
    subsolid: {
      role: "secondary-open-table-reproduction",
      url: SUBSOLID_TABLE_URL,
      object_id: EXPECTED_TABLES.subsolid.objectId,
      table_fragment_bytes: Buffer.byteLength(subsolidFragment),
      table_fragment_sha256: sha256(subsolidFragment),
    },
  },
  source_claims: sourceClaims,
  fixture_path: FIXTURE_PATH,
  fixture_version: fixture.version,
  bound_vector_ids: fixture.cases.map((testCase) => testCase.id),
  runtime_vector_match: true,
  fixture_vector_match: true,
  correct_measurement_doi_present: true,
  known_wrong_measurement_doi_absent: true,
  source_bytes_committed: false,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(audit)}\n`);
} else {
  console.log(
    `Fleischner source audit passed: ${audit.bound_vector_ids.length} executable vectors, primary DOI identities, and 2 hashed open table cross-checks.`,
  );
}
