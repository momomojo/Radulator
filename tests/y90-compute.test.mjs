import assert from "node:assert/strict";
import test from "node:test";

import { Y90RadiationSegmentectomy } from "../src/components/calculators/Y90RadiationSegmentectomy.jsx";

const base = {
  treatment_intent: "lobectomy",
  dosimetry_model: "mird",
  segment_volume: "1000",
  tumor_volume: "",
  target_dose: "100",
  lung_shunt: "10",
  tn_ratio: "",
  vial_residual: "0",
  microsphere_type: "glass",
  patient_weight: "",
  patient_height: "",
};

function compute(overrides = {}) {
  return Y90RadiationSegmentectomy.compute({ ...base, ...overrides });
}

function text(result) {
  return Object.entries(result)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

test("uniform dosimetry uses the shunt denominator and injected activity for lung dose", () => {
  const noShunt = compute({ lung_shunt: "0" });
  const tenPercent = compute();
  const residual = compute({ vial_residual: "10" });

  assert.equal(noShunt["Activity at Treatment Time"], "2.07 GBq (56.0 mCi)");
  assert.equal(noShunt["Estimated Lung Dose"], "0.0 Gy");
  assert.equal(tenPercent["Activity at Treatment Time"], "2.30 GBq (62.3 mCi)");
  assert.equal(tenPercent["Expected Injected Activity"], "2.30 GBq (62.3 mCi)");
  assert.match(tenPercent["Activity Definitions"], /includes expected residual compensation/);
  assert.match(tenPercent["Activity Definitions"], /activity entering the patient/);
  assert.equal(tenPercent["Estimated Lung Dose"], "11.4 Gy");
  assert.equal(residual["Activity at Treatment Time"], "2.56 GBq (69.2 mCi)");
  assert.equal(residual["Expected Injected Activity"], "2.30 GBq (62.3 mCi)");
  assert.equal(residual["Estimated Lung Dose"], "11.4 Gy");
});

test("partition dosimetry mass-weights tumor and normal energy", () => {
  const partition = compute({
    dosimetry_model: "partition",
    tumor_volume: "200",
    target_dose: "300",
    tn_ratio: "3",
  });
  const residual = compute({
    dosimetry_model: "partition",
    tumor_volume: "200",
    target_dose: "300",
    tn_ratio: "3",
    vial_residual: "10",
  });
  const ratioOne = compute({
    dosimetry_model: "partition",
    tumor_volume: "200",
    target_dose: "300",
    tn_ratio: "1",
  });

  assert.equal(partition["Activity at Treatment Time"], "3.23 GBq (87.2 mCi)");
  assert.equal(partition["Expected Injected Activity"], "3.23 GBq (87.2 mCi)");
  assert.equal(partition["Normal Tissue Dose"], "100.0 Gy");
  assert.equal(partition["Mean Segment Dose"], "140.0 Gy");
  assert.equal(partition["Estimated Lung Dose"], "16.0 Gy");
  assert.equal(residual["Activity at Treatment Time"], "3.58 GBq (96.9 mCi)");
  assert.equal(residual["Expected Injected Activity"], "3.23 GBq (87.2 mCi)");
  assert.equal(residual["Estimated Lung Dose"], "16.0 Gy");
  assert.equal(ratioOne["Activity at Treatment Time"], "6.91 GBq (186.8 mCi)");
  assert.equal(ratioOne["Normal Tissue Dose"], "300.0 Gy");
  assert.equal(ratioOne["Mean Segment Dose"], "300.0 Gy");
  assert.equal(ratioOne["Estimated Lung Dose"], "34.3 Gy");
});

test("activity increases with shunt and T/N=1 is partition-fraction invariant", () => {
  const a0 = compute({ lung_shunt: "0" })["Expected Injected Activity"];
  const a10 = compute({ lung_shunt: "10" })["Expected Injected Activity"];
  const a20 = compute({ lung_shunt: "20" })["Expected Injected Activity"];
  assert.ok(Number.parseFloat(a0) < Number.parseFloat(a10));
  assert.ok(Number.parseFloat(a10) < Number.parseFloat(a20));

  const pSmall = compute({ dosimetry_model: "partition", tumor_volume: "100", target_dose: "300", tn_ratio: "1" });
  const pLarge = compute({ dosimetry_model: "partition", tumor_volume: "900", target_dose: "300", tn_ratio: "1" });
  assert.equal(pSmall["Expected Injected Activity"], pLarge["Expected Injected Activity"]);
});

test("uniform mode ignores partition-only values and fields are exact supported enums", () => {
  const ordinary = compute();
  const noisy = compute({ tumor_volume: "not-a-number", tn_ratio: "not-a-number" });
  assert.equal(noisy["Expected Injected Activity"], ordinary["Expected Injected Activity"]);
  assert.ok(Object.hasOwn(ordinary, "Treatment Suitability"));

  for (const field of ["treatment_intent", "dosimetry_model", "microsphere_type"]) {
    const invalid = compute({ [field]: "unknown" });
    assert.match(invalid.Error, /select|supported|invalid/i, `${field} should reject unknown enum`);
  }
});

test("numeric inputs reject malformed values instead of parseFloat prefixes", () => {
  for (const [field, value] of [
    ["segment_volume", "100mL"],
    ["target_dose", "100Gy"],
    ["lung_shunt", "10%"],
    ["vial_residual", "1%"],
    ["segment_volume", []],
    ["target_dose", true],
    ["lung_shunt", null],
    ["vial_residual", Infinity],
  ]) {
    const result = compute({ [field]: value });
    assert.ok(result.Error, `${field}=${String(value)} should fail`);
  }
});

test("lung reference check uses unrounded dose and does not claim treatment clearance", () => {
  const below = compute({ segment_volume: "1000", target_dose: "115", lung_shunt: "20" });
  const above = compute({ segment_volume: "1000", target_dose: "117", lung_shunt: "20" });
  assert.match(below["Single-Treatment Lung Dose Check"], /At or below 30 Gy reference/);
  assert.match(above["Single-Treatment Lung Dose Check"], /Above 30 Gy reference/);
  assert.equal(above["Treatment Suitability"], "Not assessed");
  const allText = `${Y90RadiationSegmentectomy.info.text}\n${text(above)}`;
  for (const forbidden of [
    "CONTRAINDICATION",
    "Safety Status",
    "recommended 190",
    "≥190",
    "80 Gy",
    "normal limits (<10 Gy)",
    "acceptable but monitor",
    "vial size",
    "Activity to Order",
    "decay correction",
  ]) {
    assert.equal(allText.toLowerCase().includes(forbidden.toLowerCase()), false, `stale claim: ${forbidden}`);
  }
});

test("scope and formula output are explicit and copy/print-safe strings", () => {
  const result = compute();
  const allText = text(result);
  const scope = "Educational compartment dosimetry for clinician-selected targets. Assumes 1.0 kg lung mass and 1.03 g/mL liver density. Does not assess cumulative lung dose, hepatic reserve, extrahepatic deposition, product-specific eligibility, or treatment suitability. No calibration-to-treatment decay or vial-order calculation.";
  assert.match(allText, new RegExp(scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(result.Formula, /49\.67/);
  assert.match(result.Notes, /49\.67/);
  assert.equal(Object.keys(result).some((key) => /vial|prescribed|order/i.test(key)), false);
});
