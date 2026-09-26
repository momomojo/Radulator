import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import test from "node:test";

const source = readFileSync(new URL("../src/components/calculators/MehranCIN.jsx", import.meta.url), "utf8");
const { MehranCIN } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const calculate = (values = {}) => MehranCIN.compute({ creatinine: "1", contrast_volume: "100", ...values });

test("creatinine-only input does not invent eGFR or a safe contrast maximum", () => {
  const result = calculate();
  assert.equal(result.Error, undefined);
  assert.equal(result["Estimated eGFR"], undefined);
  assert.equal(result["Contrast Limits"], undefined);
  assert.match(result["Renal Input Method"] ?? "", /creatinine/i);
});

test("even severe-risk CHF inputs cannot trigger unsupported treatment prescriptions", () => {
  for (const factors of [{}, { diabetes: true }, { hypotension: true, iabp: true, chf: true, diabetes: true }]) {
    const result = calculate({ egfr: "19", ...factors });
    assert.equal(result.Error, undefined);
    assert.doesNotMatch(JSON.stringify(result), /mL\/kg\/h|prophylactic.*access|hold metformin|ACE inhibitors|Maximum:/i);
    assert.match(result["Prevention Context"] ?? "", /individual.*hydrat|hydrat.*individual/i);
  }
});

test("invalid supplied renal measurements are rejected even if the other method is valid", () => {
  for (const field of ["creatinine", "egfr"]) {
    for (const value of [-1, 0, "1junk", "0x10", "Infinity", "1e309", NaN, true, [], {}, Symbol("x")]) {
      const result = calculate({ creatinine: "1", egfr: "60", [field]: value });
      assert.ok(result.Error, `${field}: ${String(value)}`);
      assert.equal(result["Mehran Score"], undefined);
    }
  }
});

test("unknown or invalid contrast volume cannot masquerade as zero", () => {
  for (const contrast_volume of [undefined, null, "", " ", -1, "-100", "100junk", "0x10", true, {}, Infinity]) {
    const result = calculate({ contrast_volume });
    assert.ok(result.Error, String(contrast_volume));
    assert.equal(result["Mehran Score"], undefined);
  }
  assert.equal(calculate({ contrast_volume: 0 }).Error, undefined);
});

test("explicit renal precedence is disclosed without double-counting", () => {
  const one = calculate({ creatinine: "", egfr: "60" });
  const both = calculate({ creatinine: "3", egfr: "60" });
  assert.equal(one.Error, undefined);
  assert.equal(one["Mehran Score"], both["Mehran Score"]);
  assert.match(both["Renal Input Method"] ?? "", /eGFR.*precedence/i);
  assert.equal(calculate({ creatinine: "", egfr: "" })["Mehran Score"], undefined);
});

test("malformed clinical flags do not silently add risk points", () => {
  for (const key of ["hypotension", "iabp", "chf", "age_over_75", "anemia", "diabetes"]) {
    assert.ok(calculate({ [key]: "false" }).Error, key);
    assert.ok(calculate({ [key]: 1 }).Error, key);
  }
});
