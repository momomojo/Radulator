import assert from "node:assert/strict";
import test from "node:test";
import { calculateBmi, computeKidneyBiopsyBleedingRisk as compute } from "../src/components/calculators/KidneyBiopsyBleedingRisk.jsx";

const profile = { age: 45, weight: 86.7, height: 170, platelets: 300, hemoglobin: 110, kidney_size: 12, kidney_type: "allograft" };
const riskKey = "Estimated major bleeding risk after kidney biopsy";

test("equal BMI preserves the published 0.4% case across the old independent weight limit", () => {
  const regular = compute(profile);
  const taller = compute({ ...profile, weight: 132.3, height: 210 });
  for (const result of [regular, taller]) {
    assert.equal(result.Error, undefined);
    assert.equal(result[riskKey], "0.4%");
    assert.equal(result["Calculated BMI"], "30.00 kg/m²");
    assert.ok(Math.abs(result._probability - 0.004143549144826474) < 1e-12);
  }
  assert.equal(regular["Input Review"], undefined);
  assert.match(taller["Input Review"], /weight.*height.*units/i);
  assert.match(taller["Input Review"], /not.*validated/i);
  assert.match(taller["Input Review"], /clinical judgment/i);
});

test("old weight endpoints remain usable and crossing them adds review rather than blocking or clamping", () => {
  for (const [weight, warning] of [[29.99, true], [30, false], [30.01, false], [129.99, false], [130, false], [130.01, true]]) {
    const result = compute({ ...profile, weight });
    assert.equal(result.Error, undefined, `weight ${weight}`);
    assert.equal(Boolean(result["Input Review"]), warning, `weight ${weight}`);
    assert.ok(Number.isFinite(result._probability));
  }
  assert.notEqual(compute({ ...profile, weight: 29.99 })._probability, compute({ ...profile, weight: 30 })._probability);
});

test("numeric inputs reject nondecimal and coercible objects without throwing", () => {
  for (const field of ["weight", "height", "age", "platelets", "hemoglobin", "kidney_size"]) {
    for (const value of ["", null, undefined, "80kg", "0x50", Infinity, NaN, true, [80], { toString() { throw new Error("must not coerce"); } }, Symbol("invalid")]) {
      assert.ok(compute({ ...profile, [field]: value }).Error, `${field}: ${typeof value}`);
    }
  }
  for (const weight of [-1, 0, "-0"]) assert.ok(compute({ ...profile, weight }).Error);
  for (const weight of [86.7, "86.7", " 86.7 ", "8.67e1"]) assert.equal(compute({ ...profile, weight })[riskKey], "0.4%");
});

test("unrepresentable BMI or model intermediates cannot produce a reported zero or certain risk", () => {
  for (const weight of ["5e-324", "1e200", "1e308", "1e309"]) {
    const result = compute({ ...profile, weight, height: 210 });
    assert.ok(result.Error, weight);
    assert.equal(result[riskKey], undefined);
  }
  for (const weight of [0, -1, "80kg", "5e-324"]) assert.ok(Number.isNaN(calculateBmi(weight, 210)));
});

test("other application boundaries remain enforced", () => {
  for (const [field, value] of [["age", 17], ["age", 91], ["height", 139.99], ["height", 210.01], ["platelets", 49.99], ["platelets", 700.01], ["hemoglobin", 69.99], ["hemoglobin", 180.01], ["kidney_size", 7.99], ["kidney_size", 16.01]]) {
    assert.ok(compute({ ...profile, [field]: value }).Error, `${field} ${value}`);
  }
});

test("a finite probability below one never rounds to apparent certainty", () => {
  const result = compute({ age: 90, weight: 400, height: 140, platelets: 50, hemoglobin: 70, kidney_size: 8, kidney_type: "native" });
  assert.ok(result._probability > 0.9995 && result._probability < 1);
  assert.equal(result[riskKey], ">99.9%");
  assert.ok(result["Input Review"]);
  assert.ok(result["Calibration Warning"]);
});
