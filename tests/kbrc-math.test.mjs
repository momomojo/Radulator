import assert from "node:assert/strict";
import {
  calculateBmi,
  calculateKbrcMajorBleedingProbability,
  computeKidneyBiopsyBleedingRisk,
} from "../src/components/calculators/KidneyBiopsyBleedingRisk.jsx";

const NUMERIC_RANGES = {
  age: { label: "Age", min: 18, max: 90 },
  weight: { label: "Weight", min: 30, max: 130 },
  height: { label: "Height", min: 140, max: 210 },
  platelets: { label: "Platelet count", min: 50, max: 700 },
  hemoglobin: { label: "Hemoglobin", min: 70, max: 180 },
  kidney_size: { label: "Target kidney length", min: 8, max: 16 },
};

const PAPER_VECTORS = [
  {
    id: "typical native",
    age: 57,
    bmi: 28.28,
    platelets: 220,
    hemoglobin: 107,
    kidneySize: 11.4,
    native: true,
    probability: 0.024952020553775368,
    display: "2.5%",
  },
  {
    id: "typical allograft",
    age: 57,
    bmi: 28.28,
    platelets: 220,
    hemoglobin: 107,
    kidneySize: 11.4,
    native: false,
    probability: 0.010262687251744273,
    display: "1.0%",
  },
  {
    id: "higher-risk native",
    age: 65,
    bmi: 24,
    platelets: 150,
    hemoglobin: 100,
    kidneySize: 10,
    native: true,
    probability: 0.07433902992419608,
    display: "7.4%",
  },
  {
    id: "lower-risk allograft",
    age: 45,
    bmi: 30,
    platelets: 300,
    hemoglobin: 110,
    kidneySize: 12,
    native: false,
    probability: 0.004143549144826474,
    display: "0.4%",
  },
];

function pp(value, knot) {
  return Math.max(value - knot, 0) ** 3;
}

// Kept as a literal test oracle so a production coefficient or knot change
// cannot silently update both sides of the differential assertion.
function referenceProbability({
  age,
  bmi,
  platelets,
  hemoglobin,
  kidneySize,
  native,
}) {
  const lp =
    2.0998143 +
    0.059035592 * age -
    1.9209284e-5 * pp(age, 31) +
    4.8213766e-5 * pp(age, 57) -
    2.9004482e-5 * pp(age, 74.219456) -
    0.16226705 * kidneySize +
    0.014154593 * pp(kidneySize, 9.5) -
    0.027601456 * pp(kidneySize, 11.4) +
    0.013446863 * pp(kidneySize, 13.4) -
    0.038695221 * hemoglobin -
    8.4544322e-6 * pp(hemoglobin, 79) +
    1.5416906e-5 * pp(hemoglobin, 107) -
    6.9624735e-6 * pp(hemoglobin, 141) -
    0.0033086696 * platelets -
    6.7231169e-9 * pp(platelets, 128.1) +
    1.120357e-8 * pp(platelets, 220) -
    4.4804528e-9 * pp(platelets, 357.9) +
    0.90339297 * Number(native) -
    0.10722806 * bmi +
    0.00051289958 * pp(bmi, 21.67) -
    0.00088913491 * pp(bmi, 28.291414) +
    0.00037623533 * pp(bmi, 37.318);
  return 1 / (1 + Math.exp(-lp));
}

function inputsForBmi(vector) {
  const height = 170;
  return {
    age: vector.age,
    weight: vector.bmi * (height / 100) ** 2,
    height,
    platelets: vector.platelets,
    hemoglobin: vector.hemoglobin,
    kidney_size: vector.kidneySize,
    kidney_type: vector.native ? "native" : "allograft",
  };
}

function assertClose(actual, expected, context) {
  assert.ok(
    Math.abs(actual - expected) <= 1e-12,
    `${context}: expected ${expected}, received ${actual}`,
  );
}

for (const vector of PAPER_VECTORS) {
  const actual = calculateKbrcMajorBleedingProbability(vector);
  assertClose(actual.probability, vector.probability, vector.id);
  assertClose(actual.probability, referenceProbability(vector), vector.id);

  const result = computeKidneyBiopsyBleedingRisk(inputsForBmi(vector));
  assert.equal(
    result["Estimated major bleeding risk after kidney biopsy"],
    vector.display,
    `${vector.id} display`,
  );
  assertClose(result._probability, vector.probability, `${vector.id} compute`);
}

assertClose(calculateBmi(81.7292, 170), 28.28, "BMI decimal precision");
assert.ok(Number.isNaN(calculateBmi("", 170)));
assert.ok(Number.isNaN(calculateBmi(70, 0)));

const splineKnots = {
  age: [31, 57, 74.219456],
  bmi: [21.67, 28.291414, 37.318],
  platelets: [128.1, 220, 357.9],
  hemoglobin: [79, 107, 141],
  kidneySize: [9.5, 11.4, 13.4],
};
const knotBaseline = {
  age: 52,
  bmi: 26,
  platelets: 200,
  hemoglobin: 120,
  kidneySize: 12,
  native: true,
};
for (const [variable, knots] of Object.entries(splineKnots)) {
  for (const knot of knots) {
    const vector = { ...knotBaseline, [variable]: knot };
    const actual = calculateKbrcMajorBleedingProbability(vector).probability;
    assertClose(actual, referenceProbability(vector), `${variable} knot ${knot}`);
  }
}

const validInputs = {
  age: 57,
  weight: 81.7292,
  height: 170,
  platelets: 220,
  hemoglobin: 107,
  kidney_size: 11.4,
  kidney_type: "native",
};

for (const [field, range] of Object.entries(NUMERIC_RANGES)) {
  for (const [state, value] of [
    ["empty", ""],
    ["nonnumeric", "not-a-number"],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["below range", range.min - 0.01],
    ["above range", range.max + 0.01],
  ]) {
    const result = computeKidneyBiopsyBleedingRisk({
      ...validInputs,
      [field]: value,
    });
    assert.ok(result.Error, `${field} ${state} should fail closed`);
    assert.match(result.Error, new RegExp(range.label, "i"));
  }

  for (const boundary of [range.min, range.max]) {
    for (const kidney_type of ["native", "allograft"]) {
      const result = computeKidneyBiopsyBleedingRisk({
        ...validInputs,
        [field]: boundary,
        kidney_type,
      });
      assert.equal(
        result.Error,
        undefined,
        `${field} boundary ${boundary} (${kidney_type}) should be accepted`,
      );
      assert.ok(result._probability >= 0 && result._probability <= 1);
    }
  }
}

for (const kidney_type of [undefined, "", "unknown", 1, true]) {
  const result = computeKidneyBiopsyBleedingRisk({
    ...validInputs,
    kidney_type,
  });
  assert.match(result.Error, /native or transplanted\/allograft/i);
}

const veryLowResult = computeKidneyBiopsyBleedingRisk({
  age: 18,
  weight: 86.7,
  height: 170,
  platelets: 700,
  hemoglobin: 180,
  kidney_size: 16,
  kidney_type: "allograft",
});
assert.equal(
  veryLowResult["Estimated major bleeding risk after kidney biopsy"],
  "<0.1%",
  "positive probabilities that round to zero must not display as 0.0%",
);

const pairedProfile = {
  age: 57,
  bmi: 28.28,
  platelets: 220,
  hemoglobin: 107,
  kidneySize: 11.4,
};
const nativeProbability = calculateKbrcMajorBleedingProbability({
  ...pairedProfile,
  native: true,
}).probability;
const allograftProbability = calculateKbrcMajorBleedingProbability({
  ...pairedProfile,
  native: false,
}).probability;
assert.ok(nativeProbability > allograftProbability);
assertClose(
  Math.log(nativeProbability / (1 - nativeProbability)) -
    Math.log(allograftProbability / (1 - allograftProbability)),
  0.90339297,
  "native/allograft log-odds pair",
);

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random, min, max) {
  return min + random() * (max - min);
}

const random = mulberry32(0x4b425243);
for (let index = 0; index < 600; index += 1) {
  const weight = between(random, 30, 130);
  const height = between(random, 140, 210);
  const vector = {
    age: between(random, 18, 90),
    bmi: calculateBmi(weight, height),
    platelets: between(random, 50, 700),
    hemoglobin: between(random, 70, 180),
    kidneySize: between(random, 8, 16),
    native: index % 2 === 0,
  };
  const actual = calculateKbrcMajorBleedingProbability(vector).probability;
  assertClose(actual, referenceProbability(vector), `seeded vector ${index}`);
  assert.ok(Number.isFinite(actual) && actual >= 0 && actual <= 1);
}

console.log(
  "KBRC math regression passed: 4 source examples, 15 knots, validation/boundary matrix, <0.1% formatting, native/allograft pair, and 600 seeded differential vectors",
);
