import assert from "node:assert/strict";
import test from "node:test";
import { AdrenalCTWashout as CT } from "../src/components/calculators/AdrenalCTWashout.jsx";
import { AdrenalMRICSI as MRI } from "../src/components/calculators/AdrenalMRICSI.jsx";

const ct = { unenh: "10", portal: "100", delayed: "40" };
const mri = { a_ip: "100", a_op: "50", s_ip: "100", s_op: "100" };
function rejects(def, inputs) {
  const result = def.compute(inputs);
  assert.equal(typeof result.Error, "string", JSON.stringify(inputs));
  assert.ok(result.Error.length > 10);
  assert.equal(result.Interpretation, undefined);
  assert.deepEqual(Object.keys(result), ["Error"]);
}

test("CT preserves independently calculated washout values, including signed HU", () => {
  for (const [inputs, absolute, relative] of [
    [ct, "66.7", "60.0"],
    [{ unenh: 20, portal: 80, delayed: 70 }, "16.7", "12.5"],
    [{ unenh: -20, portal: 100, delayed: 40 }, "50.0", "60.0"],
    [{ unenh: 0, portal: " 1e2 ", delayed: 40 }, "60.0", "60.0"],
  ]) {
    const result = CT.compute(inputs);
    assert.equal(result.Error, undefined);
    assert.equal(result["Absolute Washout (%)"], absolute);
    assert.equal(result["Relative Washout (%)"], relative);
  }
});

test("MRI preserves both independently calculated ratios and zero opposed-phase signal", () => {
  for (const [opposed, index, ratio] of [[50, "50.0", "0.50"], [90, "10.0", "0.90"], [0, "100.0", "0.00"]]) {
    const result = MRI.compute({ ...mri, a_op: opposed });
    assert.equal(result.Error, undefined);
    assert.equal(result["Signal Intensity Index (%)"], index);
    assert.equal(result["Adrenal‑to‑Spleen CSI Ratio"], ratio);
  }
});

for (const [name, def, base] of [["CT", CT, ct], ["MRI", MRI, mri]]) {
  test(`${name} withholds interpretation for missing or malformed measurements`, () => {
    rejects(def, {});
    for (const field of Object.keys(base)) {
      for (const value of [undefined, null, "", " ", true, false, [], {}, "10HU", "0x10", "Infinity", "NaN", Infinity, NaN, "1e999"]) {
        rejects(def, { ...base, [field]: value });
      }
    }
  });
}

test("CT refuses zero denominators and overflow rather than inferring an adenoma", () => {
  rejects(CT, { unenh: 10, portal: 10, delayed: 0 });
  rejects(CT, { unenh: 10, portal: 0, delayed: 5 });
  rejects(CT, { unenh: -1e308, portal: 1e308, delayed: 0 });
  rejects(CT, { unenh: 0, portal: 1e-308, delayed: -1e308 });
});

test("MRI refuses invalid magnitude domains and nonfinite normalized ratios", () => {
  for (const field of ["a_ip", "s_ip", "s_op"]) rejects(MRI, { ...mri, [field]: 0 });
  for (const field of Object.keys(mri)) rejects(MRI, { ...mri, [field]: -1 });
  rejects(MRI, { a_ip: 1e-308, a_op: 1e308, s_ip: 100, s_op: 100 });
  rejects(MRI, { a_ip: 100, a_op: 50, s_ip: 100, s_op: 1e-308 });
});
