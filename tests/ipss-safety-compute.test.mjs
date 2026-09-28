import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import test from "node:test";

const source = readFileSync(new URL("../src/components/calculators/IPSS.jsx", import.meta.url), "utf8");
const { IPSS } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const baseline = { basalLeftACTH: "100", basalRightACTH: "50", basalPeriphACTH: "20", basalLeftPRL: "30", basalRightPRL: "30", basalPeriphPRL: "10" };
const calculate = (overrides = {}) => IPSS.compute({ ...baseline, ...overrides });

const stimulated = { time: "3", leftACTH: "200", rightACTH: "100", periphACTH: "20", leftPRL: "60", rightPRL: "30", periphPRL: "10" };
test("decimal equality meets criteria without promoting truly subthreshold values", () => {
  const overrides = { basalLeftACTH:"20", basalRightACTH:"20", basalLeftPRL:"18.54", basalRightPRL:"18.54", basalPeriphPRL:"10.3" };
  const row = {time:"3",leftACTH:"30.9",rightACTH:"10",periphACTH:"10.3"};
  const equal = calculate({...overrides,ipssRows:[row]});
  assert.match(equal["Criteria Met"] ?? "", /Peak post-CRH ratio ≥3/);
  assert.match(equal["Catheterization Note"], /support adequate/);
  const below = calculate({...overrides,basalLeftPRL:"18.539999999999999",ipssRows:[{...row,leftACTH:"30.899999999999999"}]});
  assert.match(below["Localization Pattern"], /^No central ACTH gradient/);
  assert.match(below["Catheterization Note"], /Sampling caution/);
});

test("mathematically equal decimal peaks across times stay tied", () => {
  const result = calculate({ipssRows:[
    {time:"3",leftACTH:"30.9",rightACTH:"10",periphACTH:"10.3"},
    {time:"6",leftACTH:"60",rightACTH:"10",periphACTH:"20"},
  ]});
  assert.match(result["Normalization sample"], /Tied.*LEFT \+3.*LEFT \+6/);
  assert.equal(result["Basal PRL-normalized peak ACTH ratio"],undefined);
});

test("report leads with calculated ACTH findings rather than a success-colored disclaimer", () => {
  const result = calculate({ ipssRows: [stimulated] });
  const firstValue = Object.values(result)[0];
  assert.match(firstValue, /Basal maximum 5\.00/);
  assert.match(firstValue, /post-CRH peak 10\.00/);
  assert.equal(result._severity, "info");
  assert.match(calculate()["ACTH sampling summary"], /no stimulated samples/i);
  assert.match(result["Clinical Context"], /active cortisol excess/);
});

test("right-sided peak uses right-sided basal and concurrent prolactin", () => {
  const result = calculate({ basalRightPRL: "50", ipssRows: [{ ...stimulated, leftACTH: "100", rightACTH: "200", rightPRL: "40" }] });
  assert.equal(result.Error, undefined);
  assert.match(result["Normalization sample"], /RIGHT.*\+3/);
  // Peak 200/20 = 10; ipsilateral basal 50/10 = 5; concurrent 40/10 = 4.
  assert.match(result["Basal PRL-normalized peak ACTH ratio"], /^2\.0000/);
  assert.match(result["Concurrent PRL-normalized peak ACTH ratio"], /^2\.5000/);
});

test("normalization follows the unadjusted peak rather than the largest adjusted ratio", () => {
  const result = calculate({ ipssRows: [stimulated, { ...stimulated, time: "5", leftACTH: "180", leftPRL: "10" }] });
  // At +5, unadjusted 9 and concurrent-adjusted 9 exceed the +3 adjusted 10/6,
  // but +3 is still the unadjusted peak (10 > 9).
  assert.equal(result.Error, undefined);
  assert.equal(result["Peak Time Point"], "+3 minutes");
  assert.match(result["Concurrent PRL-normalized peak ACTH ratio"], /^1\.6667/);
});

test("normalization rejects overflow and underflow without returning a partial report", () => {
  for (const [leftPRL, periphPRL] of [["1e308", "1e-308"], ["1e-308", "1e308"], ["1e-308", "10"]]) {
    const result = calculate({ ipssRows: [{ ...stimulated, leftPRL, periphPRL }] });
    assert.ok(result.Error);
    assert.equal(result["Localization Pattern"], undefined);
    assert.equal(result["Concurrent PRL-normalized peak ACTH ratio"], undefined);
  }
});

test("basal and concurrent normalization stay separate with explicit denominators", () => {
  const result = calculate({ ipssRows: [stimulated] });
  assert.match(result["Basal PRL-normalized peak ACTH ratio"] ?? "", /^3\.3333/);
  assert.match(result["Concurrent PRL-normalized peak ACTH ratio"] ?? "", /^1\.6667/);
  assert.match(result["Normalization sample"] ?? "", /LEFT.*\+3/);
  assert.equal(result["Final Lateralization"], undefined);
});

test("absent prolactin preserves ACTH results without inventing normalized values", () => {
  const result = calculate({ basalLeftPRL: "", basalRightPRL: "", basalPeriphPRL: "", ipssRows: [{ ...stimulated, leftPRL: "", rightPRL: "", periphPRL: "" }] });
  assert.equal(result.Error, undefined);
  assert.equal(result["Left IPS/Peripheral (Basal)"], "5.00");
  assert.match(result["Peak IPS/Peripheral Ratio"], /^10\.00/);
  assert.match(result["Basal PRL-normalized peak ACTH ratio"], /not available/i);
  assert.match(result["Concurrent PRL-normalized peak ACTH ratio"], /not available/i);
});

test("invalid ACTH does not tell users that optional prolactin is required", () => {
  const result = calculate({basalLeftACTH:"",basalLeftPRL:"",basalRightPRL:"",basalPeriphPRL:""});
  assert.match(result.Error,/prolactin is optional/i);
});

test("partial concurrent prolactin cannot silently mix with basal measurements", () => {
  assert.ok(calculate({ ipssRows: [{ ...stimulated, periphPRL: "" }] }).Error);
});

test("tied unadjusted peaks do not silently choose a normalization side", () => {
  const result = calculate({ ipssRows: [{ ...stimulated, rightACTH: "200" }] });
  assert.equal(result.Error, undefined);
  assert.match(result["Normalization sample"] ?? "", /tied/i);
  assert.equal(result["Basal PRL-normalized peak ACTH ratio"], undefined);
});

test("preserves independently calculated basal sampling ratios", () => {
  const result = calculate();
  assert.equal(result.Error, undefined);
  assert.equal(result["Left IPS/Peripheral (Basal)"], "5.00");
  assert.equal(result["Right IPS/Peripheral (Basal)"], "2.50");
  assert.match(result["Left IPS PRL Ratio"], /^3\.00/);
  assert.match(result["Right IPS PRL Ratio"], /^3\.00/);
});

test("low bilateral prolactin cannot erase measured ACTH ratios", () => {
  const result = calculate({ basalLeftPRL: "10", basalRightPRL: "10" });
  assert.equal(result.Error, undefined);
  assert.equal(result["Left IPS/Peripheral (Basal)"], "5.00");
  assert.match(result["Catheterization Note"], /caution|review|not established/i);
});

test("exact basal ACTH and PRL boundaries use the reviewed inclusive criteria", () => {
  const result = calculate({ basalLeftACTH: "40", basalRightACTH: "20", basalLeftPRL: "18", basalRightPRL: "18" });
  assert.equal(result.Error, undefined);
  assert.match(result["Localization Pattern"], /^Central ACTH gradient present/);
  assert.match(result["Catheterization Note"], /support/i);
});

test("rejects every missing, nonpositive or malformed basal concentration", () => {
  for (const field of Object.keys(baseline)) {
    for (const value of [undefined, null, "", " ", "0", -1, "1junk", "0x10", "1e309", Infinity, NaN, true, {}, []]) {
      const result = calculate({ [field]: value });
      assert.ok(result.Error, `${field}: ${String(value)}`);
      assert.equal(result.Diagnosis, undefined);
      assert.equal(result["Left IPS PRL Ratio"], undefined);
    }
  }
});

test("rejects nonrepresentable derived ratios despite finite concentrations", () => {
  const result = calculate({ basalLeftACTH: "1e308", basalPeriphACTH: "1e-308" });
  assert.ok(result.Error);
  assert.equal(result.Diagnosis, undefined);
});

test("empty default rows are absent rather than fictitious stimulated peaks", () => {
  const result = calculate({ ipssRows: [{ time: "", leftACTH: "", rightACTH: "", periphACTH: "", leftPRL: "", rightPRL: "", periphPRL: "" }] });
  assert.equal(result.Error, undefined);
  assert.equal(result["Peak Time Point"], undefined);
  assert.equal(result["Peak IPS/Peripheral Ratio"], undefined);
  assert.equal(result.Confidence, undefined);
});

test("partial post-stimulation rows cannot silently disappear", () => {
  for (const row of [{ time: "3" }, { leftACTH: "100" }, { time: "3", leftACTH: "100", rightACTH: "50" }]) {
    const result = calculate({ ipssRows: [row] });
    assert.ok(result.Error);
    assert.match(result.Error, /row\s*1/i);
    assert.equal(result.Diagnosis, undefined);
  }
});

test("complete stimulated rows preserve measured time and independent peak ratio", () => {
  const result = calculate({ ipssRows: [{ time: "3", leftACTH: "200", rightACTH: "100", periphACTH: "20", leftPRL: "30", rightPRL: "30", periphPRL: "10" }] });
  assert.equal(result.Error, undefined);
  assert.equal(result["Peak Time Point"], "+3 minutes");
  assert.match(result["Peak IPS/Peripheral Ratio"], /^10\.00/);
});

test("invalid stimulated concentrations, times and row shapes cannot produce a report", () => {
  const complete = { time: "3", leftACTH: "200", rightACTH: "100", periphACTH: "20", leftPRL: "30", rightPRL: "30", periphPRL: "10" };
  for (const field of Object.keys(complete)) {
    for (const value of ["0", "-1", "1junk", "1e309", true, {}]) {
      const result = calculate({ ipssRows: [{ ...complete, [field]: value }] });
      assert.ok(result.Error, `${field}: ${String(value)}`);
      assert.equal(result.Diagnosis, undefined);
    }
  }
  for (const ipssRows of [{}, "invalid", [null], [true]]) {
    assert.ok(calculate({ ipssRows }).Error);
  }
});

test("sampling patterns never automatically prescribe surgery or diagnose disease", () => {
  for (const overrides of [{}, { basalLeftACTH: "20", basalRightACTH: "20" }]) {
    const result = calculate(overrides);
    assert.equal(result.Error, undefined);
    assert.equal(result.Diagnosis, undefined);
    assert.equal(result.Confidence, undefined);
    assert.doesNotMatch(JSON.stringify(result), /surgery indicated|hemihypophysectomy|consider bilateral adrenalectomy/i);
    assert.match(JSON.stringify(result), /hypercortisolism|cortisol excess/i);
  }
});
