#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CACMesa } from "../../../src/components/calculators/CACMesa.jsx";

const AUC_XML_URL =
  "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10585920/fullTextXML";
const MARON_XML_URL =
  "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11462328/fullTextXML";
const boundaryVectors = [
  ["cac-drs-score-299", "299", "A2 / N not reported"],
  ["cac-drs-score-300", "300", "A3 / N not reported"],
  ["cac-drs-score-301", "301", "A3 / N not reported"],
];
const maronStageVectors = [
  ["maron-stage-0", "0", "0", "No calcified atherosclerotic burden"],
  ["maron-stage-1", "1", "1", "Mild calcified atherosclerotic burden"],
  ["maron-stage-2-percentile-equality", "68", "2", "Moderate calcified atherosclerotic burden"],
  ["maron-stage-2-lower", "100", "2", "Moderate calcified atherosclerotic burden"],
  ["maron-stage-2-upper", "299", "2", "Moderate calcified atherosclerotic burden"],
  ["maron-stage-3-lower", "300", "3", "Severe calcified atherosclerotic burden"],
  ["maron-stage-3-upper", "999", "3", "Severe calcified atherosclerotic burden"],
  ["maron-stage-4-lower", "1000", "4", "Extensive calcified atherosclerotic burden"],
];

for (const [id, score, expected] of boundaryVectors) {
  const result = CACMesa.compute({
    score,
    age: "55",
    sex: "male",
    race: "white",
    vessel_count: "not_reported",
  });
  assert.equal(result.Error, undefined, `${id}: boundary input must be accepted`);
  assert.equal(result["CAC-DRS"], expected, `${id}: 2023 multi-society AUC Table 1.2`);
}
assert.equal(
  CACMesa.guidelineVersion,
  "MESA reference values + CAC-DRS (SCCT 2018; AUC 2023 boundary)",
  "public metadata must disclose the authority used to resolve exact 300",
);

const registry = JSON.parse(
  readFileSync(
    "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json",
    "utf8",
  ),
);
const record = registry.records.find(({ calculator_id }) => calculator_id === "cac-mesa");
assert.ok(record, "CAC/MESA registry row is required");
assert.ok(
  record.sources.some(({ url, role }) => url === AUC_XML_URL && role === "primary-publication"),
  "CAC/MESA registry must name the accessible primary multi-society AUC",
);
const claim = record.implementation_evidence?.claims?.find(
  ({ id }) => id === "multisociety-auc-cac-drs-bands",
);
assert.ok(claim, "CAC/MESA registry must bind the AUC boundary to executable vectors");
assert.equal(claim.source_url, AUC_XML_URL);
assert.match(claim.source_locator, /Table 1\.2.*18.*21/i);
assert.deepEqual(
  [...claim.vector_ids].sort(),
  boundaryVectors.map(([id]) => id).sort(),
);

const response = await fetch(AUC_XML_URL, {
  headers: { "user-agent": "Radulator-CAC-DRS-primary-source-audit/1" },
});
assert.equal(response.ok, true, `AUC source returned HTTP ${response.status}`);
const xml = await response.text();
const table = xml.match(/<table-wrap id="Tab2"[\s\S]*?<\/table-wrap>/)?.[0];
assert.ok(table, "primary AUC XML lacks Table 1.2");
const text = table
  .replace(/<[^>]+>/g, " ")
  .replaceAll("&#x02265;", "≥")
  .replace(/\s+/g, " ");
assert.match(text, /Table 1\.2/);
assert.match(text, /CAC score 100[–-]299 \(CAC-DRS 2\)/);
assert.match(text, /CAC score\s*≥\s*300 \(CAC-DRS 3\)/);

for (const [id, score, expectedStage, expectedBurden] of maronStageVectors) {
  const result = CACMesa.compute({
    score,
    age: "55",
    sex: "male",
    race: "white",
    vessel_count: "not_reported",
  });
  assert.equal(result.Error, undefined, `${id}: staging input must be accepted`);
  assert.equal(result["Maron CAC Stage"], expectedStage, `${id}: stage boundary`);
  assert.equal(result["CAC Staging Burden"], expectedBurden, `${id}: burden label`);
}

const maronClaim = record.implementation_evidence?.claims?.find(
  ({ id }) => id === "maron-percentile-adjusted-staging",
);
assert.ok(maronClaim, "CAC/MESA registry must bind the proposed Maron staging table");
assert.equal(maronClaim.source_url, MARON_XML_URL);
assert.match(maronClaim.source_locator, /proposed.*staging.*table.*stages 0 through 4/i);

const maronResponse = await fetch(MARON_XML_URL, {
  headers: { "user-agent": "Radulator-Maron-staging-primary-source-audit/1" },
});
assert.equal(
  maronResponse.ok,
  true,
  `Maron staging source returned HTTP ${maronResponse.status}`,
);
const maronXml = await maronResponse.text();
const maronTable = maronXml.match(/<table-wrap id="tbl1"[\s\S]*?<\/table-wrap>/)?.[0];
assert.ok(maronTable, "primary Maron XML lacks the proposed staging table");
const maronText = maronTable
  .replace(/<[^>]+>/g, " ")
  .replaceAll("&#x02013;", "–")
  .replaceAll("&#x02265;", "≥")
  .replaceAll("&lt;", "<")
  .replace(/\s+/g, " ");
assert.match(maronText, /CAC Score:\s*0\s*•\s*No calcified plaque/);
assert.match(maronText, /CAC Score:\s*1[–-]99 and\s*<\s*75th percentile/);
assert.match(maronText, /CAC Score:\s*100[–-]299 or\s*≥\s*75th percentile/);
assert.match(maronText, /CAC Score:\s*300[–-]999/);
assert.match(maronText, /CAC Score:\s*≥\s*1,000/);

console.log(
  "CAC-DRS and Maron stage boundaries verified against the primary AUC and staging tables.",
);
