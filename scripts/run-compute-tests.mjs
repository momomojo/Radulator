#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const fixtureDir = join(root, "tests", "fixtures", "compute");
const calculatorDir = join(root, "src", "components", "calculators");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function loadFixtures() {
  return readdirSync(fixtureDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const path = join(fixtureDir, name);
      return { path, data: JSON.parse(readFileSync(path, "utf8")) };
    });
}

function findCalculatorFile(calculatorId) {
  for (const file of walk(calculatorDir).filter((path) => path.endsWith(".jsx"))) {
    const source = readFileSync(file, "utf8");
    if (new RegExp(`\\bid:\\s*["']${escapeRegExp(calculatorId)}["']`).test(source)) {
      return file;
    }
  }
  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadCalculator(calculatorId) {
  const file = findCalculatorFile(calculatorId);
  if (!file) throw new Error(`No calculator source found for id "${calculatorId}"`);

  const mod = await import(pathToFileURL(file).href);
  const calculator = Object.values(mod).find(
    (value) => value && typeof value === "object" && value.id === calculatorId,
  );
  if (!calculator) {
    throw new Error(`Calculator module ${relative(root, file)} did not export id "${calculatorId}"`);
  }
  if (typeof calculator.compute !== "function") {
    throw new Error(`Calculator "${calculatorId}" has no compute() function`);
  }
  return calculator;
}

function buildInputs(calculator, testCase) {
  if (testCase.inputs) return { ...testCase.inputs };
  if (!testCase.inputPreset) return {};

  const preset = testCase.inputPreset;
  if (calculator.id !== "thypro-39") {
    throw new Error(`inputPreset is only implemented for thypro-39; got ${calculator.id}`);
  }

  const ids = (calculator.fields || []).map((field) => field.id).filter(Boolean);
  const values = { assessment_mode: preset.mode || "single" };

  if (preset.mode === "delta") {
    for (const id of ids.filter((id) => id.startsWith("b_"))) {
      values[id] = preset.baselineValue;
    }
    for (const id of ids.filter((id) => id.startsWith("f_"))) {
      values[id] = preset.followupValue;
    }
    applyOverrides(values, preset.baselineOverrides || {}, "b_");
    applyOverrides(values, preset.followupOverrides || {}, "f_");
    applyOverrides(values, preset.overrides || {}, "");
  } else {
    for (const id of ids.filter(
      (id) => id !== "assessment_mode" && !id.startsWith("b_") && !id.startsWith("f_"),
    )) {
      values[id] = preset.singleValue;
    }
    applyOverrides(values, preset.overrides || {}, "");
  }

  return values;
}

function applyOverrides(values, overrides, prefix) {
  for (const [key, value] of Object.entries(overrides)) {
    if (Object.prototype.hasOwnProperty.call(values, key) || key.startsWith(prefix)) {
      values[key] = value;
    } else {
      values[`${prefix}${key}`] = value;
    }
  }
}

function assertExpectation(result, expectation, context) {
  const failures = [];
  const hasError = Object.prototype.hasOwnProperty.call(result, "Error");

  if (expectation?.noError === true && hasError) {
    failures.push(`${context}: expected no Error but got ${result.Error}`);
  }
  if (expectation?.noError === false && !hasError) {
    failures.push(`${context}: expected Error but result had none`);
  }

  for (const field of expectation?.fields || []) {
    if (!Object.prototype.hasOwnProperty.call(result, field.key)) {
      failures.push(`${context}: missing result key "${field.key}"`);
      continue;
    }
    const actual = String(result[field.key]);
    if (Object.prototype.hasOwnProperty.call(field, "equals") && actual !== String(field.equals)) {
      failures.push(`${context}: ${field.key} expected ${JSON.stringify(field.equals)} but got ${JSON.stringify(actual)}`);
    }
    if (Object.prototype.hasOwnProperty.call(field, "includes") && !actual.includes(String(field.includes))) {
      failures.push(`${context}: ${field.key} expected to include ${JSON.stringify(field.includes)} but got ${JSON.stringify(actual)}`);
    }
  }

  return failures;
}

async function main() {
  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    throw new Error(`No compute fixtures found in ${relative(root, fixtureDir)}`);
  }

  let total = 0;
  const failures = [];

  for (const fixture of fixtures) {
    const { data } = fixture;
    const calculator = await loadCalculator(data.calculatorId);
    for (const testCase of data.cases || []) {
      total += 1;
      const context = `${data.calculatorId}/${testCase.id}`;
      const inputs = buildInputs(calculator, testCase);
      let result;
      try {
        result = calculator.compute(inputs);
      } catch (error) {
        failures.push(`${context}: compute() threw ${error?.stack || error}`);
        continue;
      }
      failures.push(...assertExpectation(result, testCase.expect || {}, context));
    }
  }

  if (failures.length > 0) {
    console.error(`compute tests FAILED: ${failures.length} failure(s) across ${total} case(s)`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`compute tests OK: ${total} case(s) across ${fixtures.length} fixture file(s)`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
