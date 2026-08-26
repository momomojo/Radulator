#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CACMesa } from "../../../src/components/calculators/CACMesa.jsx";

const AUC_XML_URL =
  "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10585920/fullTextXML";
const boundaryVectors = [
  ["cac-drs-score-299", "299", "A2 / N not reported"],
  ["cac-drs-score-300", "300", "A3 / N not reported"],
  ["cac-drs-score-301", "301", "A3 / N not reported"],
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

console.log("CAC-DRS 299/300/301 boundary verified against primary AUC Table 1.2.");
