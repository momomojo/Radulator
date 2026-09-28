import assert from "node:assert/strict";
import test from "node:test";

import { ContrastDosing } from "../src/components/calculators/ContrastDosing.jsx";

function compute(overrides = {}) {
  return ContrastDosing.compute({
    weight_unit: "kg",
    weight: "110",
    height_unit: "cm",
    height: "200",
    sex: "male",
    egfr: "60",
    renal_status: "stable",
    contrast_agent: "300",
    study_type: "hepatic",
    iv_access: "18g",
    ...overrides,
  });
}

test("CAPPED-TBW reports iodine from final volume and preserves the uncapped target", () => {
  const result = compute();

  assert.equal(result["Recommended Contrast Volume"], "150 mL");
  assert.equal(
    result["Total Iodine Dose"],
    "45,000 mg I (409 mg I/kg Total Body Weight)",
  );
  assert.equal(
    result["Uncapped Iodine Target"],
    "60,500 mg I (550 mg I/kg Total Body Weight; before 150 mL cap)",
  );
  assert.match(result.WARNINGS, /cap reduces planned iodine below target/i);
  assert.match(result.WARNINGS, /confirm diagnostic adequacy against the local protocol/i);
  assert.match(result.WARNINGS, /planning value, not proof of an administered dose/i);
});

test("UNCAPPED-TBW keeps the existing total-dose presentation without an uncapped duplicate", () => {
  const result = compute({
    weight: "70",
    height: "175",
    study_type: "routine",
  });

  assert.equal(result["Recommended Contrast Volume"], "93 mL");
  assert.equal(result["Total Iodine Dose"], "28,000 mg I (400 mg I/kg Total Body Weight)");
  assert.equal(result["Uncapped Iodine Target"], undefined);
  assert.equal(result.WARNINGS, undefined);
});

test("UNCAPPED-TBW preserves the existing half-mg rounding boundary", () => {
  const result = compute({
    weight: "50.02125",
    height: "175",
    study_type: "routine",
  });

  assert.equal(result["Recommended Contrast Volume"], "67 mL");
  assert.equal(result["Total Iodine Dose"], "20,009 mg I (400 mg I/kg Total Body Weight)");
  assert.equal(result["Uncapped Iodine Target"], undefined);
});

test("CAP-EXACT does not treat a volume exactly at the cap as capped", () => {
  const result = compute({
    weight: "112.5",
    study_type: "routine",
  });

  assert.equal(result["Recommended Contrast Volume"], "150 mL");
  assert.equal(result["Total Iodine Dose"], "45,000 mg I (400 mg I/kg Total Body Weight)");
  assert.equal(result["Uncapped Iodine Target"], undefined);
});

test("CAP-NEIGHBORS reports final-volume iodine only above the cap boundary", () => {
  const below = compute({ weight: "112.49", study_type: "routine" });
  const above = compute({ weight: "112.51", study_type: "routine" });

  assert.equal(below["Recommended Contrast Volume"], "150 mL");
  assert.equal(below["Total Iodine Dose"], "44,996 mg I (400 mg I/kg Total Body Weight)");
  assert.equal(below["Uncapped Iodine Target"], undefined);
  assert.equal(above["Recommended Contrast Volume"], "150 mL");
  assert.equal(above["Total Iodine Dose"], "45,000 mg I (400 mg I/kg Total Body Weight)");
  assert.equal(
    above["Uncapped Iodine Target"],
    "45,004 mg I (400 mg I/kg Total Body Weight; before 150 mL cap)",
  );
});

test("CAPPED-LBW reports capped iodine while preserving the existing LBW basis", () => {
  const result = compute({
    weight: "120",
    height: "190",
    study_type: "hepatic",
  });

  assert.equal(result["Recommended Contrast Volume"], "150 mL");
  assert.equal(result["Total Iodine Dose"], "45,000 mg I (560 mg I/kg LBW (BMI ≥30))");
  assert.equal(
    result["Uncapped Iodine Target"],
    "50,633 mg I (630 mg I/kg LBW (BMI ≥30); before 150 mL cap)",
  );
});
