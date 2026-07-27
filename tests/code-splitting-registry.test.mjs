import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registrySource = readFileSync(
  new URL("../src/components/calculators/registry.js", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  registrySource,
  /import\.meta\.glob\([^\n]+\{\s*eager:\s*true\s*\}/,
  "calculator implementations must not be eagerly imported into the initial bundle",
);
assert.match(
  registrySource,
  /virtual:calculator-registry/,
  "registry must use build-generated metadata and dynamic loaders",
);
assert.match(
  registrySource,
  /calc\.load\(\)/,
  "registry entries must expose a dynamic calculator loader",
);

console.log("calculator registry code-splitting contract passed");
