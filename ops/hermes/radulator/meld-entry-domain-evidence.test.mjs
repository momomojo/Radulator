#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MELDNa } from "../../../src/components/calculators/MELDNa.jsx";

const GUIDE_URL =
  "https://www.hrsa.gov/sites/default/files/hrsa/optn/meld-peld-calculator-user-guide.pdf";
const registry = JSON.parse(
  readFileSync(
    "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json",
    "utf8",
  ),
);
const record = registry.records.find(({ calculator_id }) => calculator_id === "meld-na");

assert.ok(record, "MELD registry row is required");
assert.ok(
  record.sources.some(({ url, role }) => url === GUIDE_URL && role === "official-authority"),
  "MELD registry must name the official OPTN calculator user guide as the entry-domain authority",
);

const claim = record.implementation_evidence?.claims?.find(
  ({ id }) => id === "optn-calculator-entry-domains",
);
assert.ok(claim, "MELD registry must bind calculator-entry domains to an executable claim");
assert.equal(claim.source_url, GUIDE_URL);
assert.match(claim.source_locator, /MELD Calculator.*laboratory values/i);

const baseInputs = {
  scoringModel: "meld3",
  currentAge: "45",
  ageAtRegistration: "45",
  sex: "male",
  creatinine: "1",
  bilirubin: "2",
  inr: "1.5",
  sodium: "135",
  albumin: "3",
  dialysis: false,
};

const vectors = [
  ["meld3-creatinine-entry-min", "creatinine", "0.01", true, "15"],
  ["meld3-creatinine-entry-below-min", "creatinine", "0", false, "between 0.01 and 40"],
  ["meld3-creatinine-entry-max", "creatinine", "40", true, "26"],
  ["meld3-creatinine-entry-above-max", "creatinine", "40.01", false, "between 0.01 and 40"],
  ["meld3-bilirubin-entry-min", "bilirubin", "0", true, "12"],
  ["meld3-bilirubin-entry-below-min", "bilirubin", "-0.01", false, "between 0 and 99"],
  ["meld3-bilirubin-entry-max", "bilirubin", "99", true, "31"],
  ["meld3-bilirubin-entry-above-max", "bilirubin", "99.01", false, "between 0 and 99"],
  ["meld3-inr-entry-min", "inr", "0.5", true, "11"],
  ["meld3-inr-entry-below-min", "inr", "0.49", false, "between 0.5 and 99"],
  ["meld3-inr-entry-max", "inr", "99", true, "40"],
  ["meld3-inr-entry-above-max", "inr", "99.01", false, "between 0.5 and 99"],
  ["meld3-sodium-entry-min", "sodium", "100", true, "22"],
  ["meld3-sodium-entry-below-min", "sodium", "99.99", false, "between 100 and 200"],
  ["meld3-sodium-entry-max", "sodium", "200", true, "14"],
  ["meld3-sodium-entry-above-max", "sodium", "200.01", false, "between 100 and 200"],
  ["meld3-albumin-entry-min", "albumin", "0.5", true, "18"],
  ["meld3-albumin-entry-below-min", "albumin", "0.49", false, "between 0.50 and 9.90"],
  ["meld3-albumin-entry-max", "albumin", "9.9", true, "14"],
  ["meld3-albumin-entry-above-max", "albumin", "9.91", false, "between 0.50 and 9.90"],
];

assert.deepEqual(
  [...claim.vector_ids].sort(),
  vectors.map(([id]) => id).sort(),
  "the source claim must enumerate every accepted endpoint and one value outside each endpoint",
);

for (const [id, field, value, accepted, expected] of vectors) {
  const result = MELDNa.compute({ ...baseInputs, [field]: value });
  if (accepted) {
    assert.equal(result.Error, undefined, `${id}: official endpoint must be accepted`);
    assert.equal(result["MELD 3.0 Score"], expected, `${id}: source-bound score`);
  } else {
    assert.match(result.Error ?? "", new RegExp(expected), `${id}: must fail outside domain`);
  }
}

console.log("MELD official entry-domain evidence verified: 20 endpoint vectors.");
