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
      albumin: 24.116470588235293,
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

    const displayed = ALBIScore.compute({ albumin: testCase.albumin, bilirubin: 10 });
    assert.equal(displayed["ALBI Score"], testCase.expectedDisplay);
    assert.equal(displayed["ALBI Grade"], `Grade ${testCase.expectedGrade}`);
  }
});

test("pure ALBI validation is structured and retains parseFloat-or-zero behavior", () => {
  assert.deepEqual(calculateAlbi({ albumin: "not-a-number", bilirubin: 10 }), {
    ok: false,
    code: "INVALID_INPUT",
    value: null,
  });
  assert.deepEqual(calculateAlbi({ albumin: 4, bilirubin: 10 }), {
    ok: false,
    code: "ALBUMIN_RANGE",
    value: 4,
  });
  assert.deepEqual(calculateAlbi({ albumin: 40, bilirubin: 1001 }), {
    ok: false,
    code: "BILIRUBIN_RANGE",
    value: 1001,
  });
});
