import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ALBIScore } from "../src/components/calculators/ALBIScore.jsx";
import { calculateAlbi } from "../src/clinical/albi.js";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/compute/albi-score.json", import.meta.url), "utf8"),
);

test("pure ALBI results preserve the six canonical clinical vectors", () => {
  const expectedGrades = {
    "published-representative-grade-1": 1,
    "grade-1-upper-boundary": 1,
    "grade-2-lower-interior": 2,
    "grade-2-upper-boundary": 2,
    "grade-3-lower-interior": 3,
    "us-unit-equivalence": 1,
  };

  for (const vector of fixture.cases) {
    const result = calculateAlbi(vector.inputs);
    assert.equal(result.ok, true, vector.id);
    assert.equal(result.grade, expectedGrades[vector.id], vector.id);
    assert.equal(typeof result.score, "number", vector.id);
    assert.equal(typeof result.albuminSI, "number", vector.id);
    assert.equal(typeof result.bilirubinSI, "number", vector.id);
    assert.equal(result.usedUSUnits, vector.inputs.unit_system === "US", vector.id);

    const displayed = ALBIScore.compute(vector.inputs);
    assert.equal(displayed["ALBI Score"], vector.expect.fields[0].equals, vector.id);
    assert.equal(displayed["ALBI Grade"], `Grade ${result.grade}`, vector.id);
  }
});

test("pure ALBI result preserves conversion, boundary grading, and raw precision", () => {
  const result = calculateAlbi({
    unit_system: "US",
    albumin: "4",
    bilirubin: "0.5846585594013096",
  });
  assert.deepEqual(
    {
      ok: result.ok,
      score: result.score,
      grade: result.grade,
      albuminSI: result.albuminSI,
      bilirubinSI: result.bilirubinSI,
      usedUSUnits: result.usedUSUnits,
    },
    {
      ok: true,
      score: -2.74,
      grade: 1,
      albuminSI: 40,
      bilirubinSI: 10,
      usedUSUnits: true,
    },
  );

  assert.equal(calculateAlbi({ albumin: 38.35294117647059, bilirubin: 10 }).grade, 1);
  assert.equal(calculateAlbi({ albumin: 38.34117647058824, bilirubin: 10 }).grade, 2);
  assert.equal(calculateAlbi({ albumin: 24.11764705882353, bilirubin: 10 }).grade, 2);
  assert.equal(calculateAlbi({ albumin: 24.10588235294118, bilirubin: 10 }).grade, 3);
});

test("ALBI grades from raw scores before three-decimal display rounding", () => {
  const roundingAdjacentCases = [
    {
      albumin: 38.35176470588235,
      expectedScore: -2.5999,
      expectedGrade: 2,
      expectedDisplay: "-2.600",
    },
    {
      albumin: 2.0499 / 0.085,
      expectedScore: -1.3899,
      expectedGrade: 3,
      expectedDisplay: "-1.390",
    },
  ];

  for (const testCase of roundingAdjacentCases) {
    const result = calculateAlbi({ albumin: testCase.albumin, bilirubin: 10 });
    assert.equal(result.ok, true);
    assert.ok(Math.abs(result.score - testCase.expectedScore) < 1e-12);
    assert.equal(result.grade, testCase.expectedGrade);

    const displayed = ALBIScore.compute({
      unit_system: "SI",
      albumin: testCase.albumin,
      bilirubin: 10,
    });
    assert.equal(displayed["ALBI Score"], testCase.expectedDisplay);
    assert.equal(displayed["ALBI Grade"], `Grade ${testCase.expectedGrade}`);
  }
});

test("pure ALBI validation retains structured invalid-input errors", () => {
  assert.deepEqual(calculateAlbi({ albumin: "not-a-number", bilirubin: 10 }), {
    ok: false,
    code: "INVALID_INPUT",
    value: null,
  });
});

test("out-of-range ALBI arithmetic retains source grades with an input-review warning", () => {
  // Prescribed equation anchors, not evidence of clinical validity at extremes.
  for (const [albumin, bilirubin, score, grade] of [
    [40, 0.5, -3.598679797138228, 1],
    [65, 10, -4.865, 1],
    [4, 10, 0.32, 3],
    [40, 1001, -1.4197135088636499, 2],
  ]) {
    const input = { unit_system: "SI", albumin, bilirubin };
    const result = calculateAlbi(input);
    assert.equal(result.ok, true);
    assert.ok(Math.abs(result.score - score) < 1e-12);
    assert.equal(result.grade, grade);
    assert.equal(result.inputReviewRequired, true);
    const report = ALBIScore.compute(input);
    assert.equal(report["ALBI Grade"], `Grade ${grade}`);
    assert.match(report["Input Check"], /application review thresholds/i);
    assert.match(report["Input Check"], /laboratory report and units/i);
    assert.match(report["Input Check"], /does not establish clinical applicability/i);
    assert.ok(report["Input Check"].includes(String(albumin)));
    assert.ok(report["Input Check"].includes(String(bilirubin)));
    assert.notEqual(report._severity, "success");
  }
});

test("ALBI review thresholds are inclusive and operate on converted SI values", () => {
  for (const [albumin, bilirubin, warning] of [
    [5, 1, false], [60, 1000, false],
    [4.999, 10, true], [60.001, 10, true],
    [40, 0.999, true], [40, 1000.001, true],
  ]) {
    assert.equal(calculateAlbi({ albumin, bilirubin }).inputReviewRequired, warning);
  }
  const us = ALBIScore.compute({ unit_system: "US", albumin: 6.5, bilirubin: 1 });
  assert.match(us["Input Check"], /6\.5 g\/dL/);
  assert.match(us["Input Check"], /65 g\/L/);
  const usual = ALBIScore.compute({ unit_system: "SI", albumin: 40, bilirubin: 10 });
  assert.equal(usual["Input Check"], undefined);
  assert.match(usual.Applicability, /not a post-transplant outcome predictor/i);
  assert.match(usual.Applicability, /individual survival/i);
});

test("ALBI refuses nonrepresentable conversions instead of assigning a grade", () => {
  for (const input of [
    { unit_system: "US", albumin: 1e308, bilirubin: 1 },
    { unit_system: "US", albumin: 4, bilirubin: 1e308 },
    { unit_system: "SI", albumin: 40, bilirubin: "1e-400" },
  ]) {
    assert.equal(calculateAlbi(input).ok, false);
    const report = ALBIScore.compute(input);
    assert.equal(report["ALBI Grade"], undefined);
    assert.equal(typeof report.Error, "string");
  }
});

test("pure ALBI accepts only whole finite decimal inputs", () => {
  for (const inputs of [
    { albumin: " 40 ", bilirubin: "10" },
    { albumin: "4e1", bilirubin: "1e1" },
    { albumin: 40, bilirubin: 10 },
  ]) {
    assert.equal(calculateAlbi(inputs).ok, true, JSON.stringify(inputs));
  }

  const malformedValues = [
    "40mg",
    "",
    "   ",
    "0x28",
    "NaN",
    "Infinity",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    true,
    [40],
    {},
    "1e309",
  ];
  for (const field of ["albumin", "bilirubin"]) {
    for (const malformed of malformedValues) {
      const inputs = { albumin: 40, bilirubin: 10, [field]: malformed };
      assert.deepEqual(
        calculateAlbi(inputs),
        { ok: false, code: "INVALID_INPUT", value: null },
        `${field} ${String(malformed)}`,
      );
    }
  }

  const coercionTrap = {
    toString() {
      throw new Error("user coercion must not run");
    },
    valueOf() {
      throw new Error("user coercion must not run");
    },
  };
  assert.doesNotThrow(() => {
    assert.deepEqual(calculateAlbi({ albumin: coercionTrap, bilirubin: 10 }), {
      ok: false,
      code: "INVALID_INPUT",
      value: null,
    });
  });
});

test("pure ALBI defaults only when unit_system is omitted and rejects explicit unknown units", () => {
  assert.equal(calculateAlbi({ albumin: 40, bilirubin: 10 }).ok, true);

  for (const unit_system of [
    undefined,
    null,
    "",
    "si",
    "SI ",
    "unknown",
    false,
    0,
    {},
    [],
  ]) {
    assert.deepEqual(
      calculateAlbi({ unit_system, albumin: 40, bilirubin: 10 }),
      { ok: false, code: "INVALID_UNITS", value: null },
      `unit ${String(unit_system)}`,
    );
  }
});

test("adapter requires browser unit selection and preserves the independent US anchor", () => {
  assert.deepEqual(ALBIScore.compute({ albumin: "40", bilirubin: "10" }), {
    Error: "Select SI or US units before calculating.",
  });
  assert.deepEqual(ALBIScore.compute({
    unit_system: "unknown",
    albumin: "40",
    bilirubin: "10",
  }), {
    Error: "Select SI or US units before calculating.",
  });

  const si = ALBIScore.compute({
    unit_system: "SI",
    albumin: "40",
    bilirubin: "10",
  });
  assert.equal(si["Input Units"], "SI (albumin g/L; bilirubin μmol/L)");

  const us = ALBIScore.compute({
    unit_system: "US",
    albumin: "4",
    bilirubin: "1",
  });
  assert.equal(us["ALBI Score"], "-2.586");
  assert.equal(us["ALBI Grade"], "Grade 2");
  assert.equal(us["Input Units"], "US (albumin g/dL; bilirubin mg/dL)");
  assert.match(us["Clinical Context"], /does not determine treatment eligibility/);
});

test("adapter rejects malformed values instead of accepting numeric prefixes", () => {
  for (const malformed of ["40mg", "NaN", "Infinity", true, [40], {}]) {
    const result = ALBIScore.compute({
      unit_system: "SI",
      albumin: malformed,
      bilirubin: "10",
    });
    assert.match(result.Error, /valid positive values/i, String(malformed));
  }
});

test("fifth reference identifies the supporting ALBI nomogram study without claiming its model", () => {
  const fifthReference = ALBIScore.refs[4];

  assert.deepEqual(fifthReference, {
    t: "Ho SY, Hsu CY, Liu PH, et al. Albumin-bilirubin (ALBI) grade-based nomogram for patients with hepatocellular carcinoma undergoing transarterial chemoembolization. Digestive Diseases and Sciences. 2021;66(5):1730-1738. Supporting multivariable TACE nomogram research; the original two-input ALBI model implemented here does not implement that nomogram.",
    u: "https://doi.org/10.1007/s10620-020-06384-2",
  });
});
