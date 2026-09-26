import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/components/calculators/DLPDose.jsx", import.meta.url), "utf8");
const { DLPDose } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const calculate = (values = {}) => DLPDose.compute({ dlp: "500", body_region: "chest", age_group: "adult", ...values });

test("preserves source-supported adult chest conversion without asserting individual cancer probability", () => {
  // AAPM96 Table3: adult chest k=.014; 500 × .014 = 7 mSv.
  assert.equal(calculate()["Effective Dose"], "7.00 mSv");
  for (const dlp of ["0.1", "500", "100000"]) {
    const result = calculate({ dlp });
    assert.equal(result["Estimated Additional Lifetime Cancer Risk"], undefined);
    assert.doesNotMatch(JSON.stringify(result), /negligible|\d[\d.]*%/i);
    assert.match(result["Interpretation"] ?? "", /does not.*individual.*cancer/i);
  }
});

test("rejects incomplete, nondecimal and nonfinite DLP without emitting dose results", () => {
  for (const dlp of ["500junk", "Infinity", "NaN", "1e309", "0x10", "", " ", null, true, [], {}, -1, 0]) {
    const result = calculate({ dlp });
    assert.ok(result.Error, `must reject ${JSON.stringify(dlp)}`);
    assert.equal(result["Effective Dose"], undefined);
  }
});

test("accepts complete positive finite decimal inputs", () => {
  for (const dlp of [500, "500", " 500 ", "5e2", "+500.0"]) {
    assert.equal(calculate({ dlp })["Effective Dose"], "7.00 mSv");
  }
});

test("requires recognized age and region instead of silent adult fallback", () => {
  for (const age_group of ["", "invalid", null, 5, "toString", "__proto__"]) {
    assert.ok(calculate({ age_group }).Error, `invalid age ${age_group}`);
  }
  for (const body_region of ["", "invalid", null, "toString", "__proto__"]) {
    assert.ok(calculate({ body_region }).Error, `invalid region ${body_region}`);
  }
  for (const age_group of ["adult", "child_10", "child_5", "child_1", "newborn"]) {
    assert.equal(calculate({ age_group }).Error, undefined);
  }
});

test("rejects dose underflow instead of returning a zero estimate for a positive input", () => {
  assert.ok(calculate({ dlp: "5e-324" }).Error);
});
