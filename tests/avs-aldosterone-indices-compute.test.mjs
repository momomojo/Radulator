import test from "node:test";
import assert from "node:assert/strict";
import { calculateAldosteroneIndices } from "../src/components/calculators/avsAldosteroneIndices.js";

// Independent one-pair standard-unit examples; discovered by test:compute.
const anchor = () => ({
  peripheral: { aldosterone: 10, cortisol: 10 },
  left: { aldosterone: 1000, cortisol: 100 },
  right: { aldosterone: 100, cortisol: 100 },
});
const unavailable = metric => {
  assert.equal(metric.value, null);
  assert.ok(metric.reason.length > 0);
};

test("single-pair indices retain independent anchor values", () => {
  const result = calculateAldosteroneIndices(anchor());
  for (const [key, expected] of Object.entries({ leftSI: 10, rightSI: 10, leftAC: 10, rightAC: 1, peripheralAC: 1, li: 10, cr: 1, avIvc: 10 })) {
    assert.deepEqual(result[key], { value: expected, reason: null });
  }
  assert.equal(result.numericHigherSide, "Left");
});

test("missing peripheral aldosterone preserves SI and LI but not peripheral-normalized indices", () => {
  const input = anchor();
  delete input.peripheral.aldosterone;
  const result = calculateAldosteroneIndices(input);
  assert.equal(result.leftSI.value, 10);
  assert.equal(result.rightSI.value, 10);
  assert.equal(result.li.value, 10);
  for (const key of ["peripheralAC", "cr", "avIvc"]) unavailable(result[key]);
});

test("missing peripheral cortisol preserves both adrenal ratios and LI", () => {
  const input = anchor();
  delete input.peripheral.cortisol;
  const result = calculateAldosteroneIndices(input);
  assert.equal(result.leftAC.value, 10);
  assert.equal(result.rightAC.value, 1);
  assert.equal(result.li.value, 10);
  for (const key of ["leftSI", "rightSI", "peripheralAC", "cr", "avIvc"]) unavailable(result[key]);
});

test("missing adrenal aldosterone preserves its SI and the opposite adrenal ratio", () => {
  const input = anchor();
  delete input.left.aldosterone;
  const result = calculateAldosteroneIndices(input);
  assert.equal(result.leftSI.value, 10);
  assert.equal(result.rightAC.value, 1);
  unavailable(result.leftAC);
  unavailable(result.li);
  assert.equal(result.numericHigherSide, null);
});

test("zero, negative, nonfinite and nonnumeric inputs cannot become indices", () => {
  for (const value of [0, -1, Infinity, -Infinity, NaN, "10", "", null]) {
    const input = anchor();
    input.peripheral.aldosterone = value;
    const result = calculateAldosteroneIndices(input);
    for (const key of ["peripheralAC", "cr", "avIvc"]) unavailable(result[key]);
    assert.equal(result.li.value, 10);
  }
});

test("finite division overflow and underflow are unavailable rather than infinite or zero indices", () => {
  for (const [aldosterone, cortisol] of [[Number.MAX_VALUE, Number.MIN_VALUE], [Number.MIN_VALUE, Number.MAX_VALUE]]) {
    const input = anchor();
    input.left = { aldosterone, cortisol };
    const result = calculateAldosteroneIndices(input);
    unavailable(result.leftAC);
    assert.match(result.leftAC.reason, /range/i);
    unavailable(result.li);
  }
});

test("equal adrenal ratios have LI one but no unique higher side", () => {
  const input = anchor();
  input.right.aldosterone = 1000;
  const result = calculateAldosteroneIndices(input);
  assert.equal(result.li.value, 1);
  assert.equal(result.numericHigherSide, null);
});

test("final ratio range checks apply even when constituent A/C values are valid", () => {
  const max = Number.MAX_VALUE;
  const min = Number.MIN_VALUE;
  const cases = [
    { key: "leftSI", peripheral: { aldosterone: min, cortisol: min }, left: { aldosterone: max, cortisol: max } },
    { key: "leftSI", peripheral: { aldosterone: max, cortisol: max }, left: { aldosterone: min, cortisol: min } },
    { key: "li", left: { aldosterone: max, cortisol: 1 }, right: { aldosterone: min, cortisol: 1 } },
    { key: "cr", peripheral: { aldosterone: max, cortisol: 1 }, right: { aldosterone: min, cortisol: 1 } },
    { key: "cr", peripheral: { aldosterone: min, cortisol: 1 }, left: { aldosterone: max, cortisol: 1 }, right: { aldosterone: max, cortisol: 1 } },
    { key: "avIvc", peripheral: { aldosterone: min, cortisol: 1 }, left: { aldosterone: max, cortisol: 1 } },
    { key: "avIvc", peripheral: { aldosterone: max, cortisol: 1 }, left: { aldosterone: min, cortisol: 1 }, right: { aldosterone: min, cortisol: 1 } },
  ];
  for (const { key, ...inputs } of cases) {
    const result = calculateAldosteroneIndices({ ...anchor(), ...inputs });
    for (const name of ["leftAC", "rightAC", "peripheralAC"]) {
      assert.equal(result[name].reason, null);
      assert.ok(Number.isFinite(result[name].value) && result[name].value > 0);
    }
    unavailable(result[key]);
    assert.match(result[key].reason, /range/i);
  }
});

test("changing right aldosterone changes LI and suppression but not selectivity", () => {
  const input = anchor();
  input.right.aldosterone = 200;
  const result = calculateAldosteroneIndices(input);
  assert.equal(result.li.value, 5);
  assert.equal(result.cr.value, 2);
  assert.equal(result.leftSI.value, 10);
  assert.equal(result.rightSI.value, 10);
});
