#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const checkerPath = fileURLToPath(new URL("./check-radulator-invariants.mjs", import.meta.url));

function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  writeFileSync(fullPath, content);
}

function writeRegistry(root) {
  writeFixtureFile(
    root,
    path.join("src", "components", "calculators", "registry.js"),
    "export const categoryOrder = [\"Test\"];\n"
  );
}

function validCalculatorSource(index) {
  const padded = String(index).padStart(2, "0");
  return `export const Valid${padded} = {
  id: "valid-${padded}",
  name: "Valid ${padded}",
  category: "Test",
  desc: "Valid fixture ${padded}",
  metaDesc: "Valid fixture ${padded}",
  info: { text: "Fixture calculator" },
  refs: [],
  fields: [],
  compute: () => ({ result: ${index} }),
};
`;
}

function nestedMetadataTrapSource() {
  return `export const BrokenNestedMetadata = {
  category: "Test",
  desc: "Broken fixture",
  metaDesc: "Broken fixture",
  info: { text: "This object intentionally omits top-level id/name/compute." },
  refs: [],
  fields: [
    {
      id: "nested-field-id",
      name: "Nested field name",
      category: "Test",
    },
  ],
  Component: function BrokenNestedMetadataComponent() {
    return {
      id: "nested-component-id",
      name: "Nested component name",
      category: "Test",
      compute: true,
    };
  },
};
`;
}

function makeFixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "radulator-invariants-"));
  mkdirSync(path.join(root, "src", "components", "calculators"), { recursive: true });
  mkdirSync(path.join(root, "public"), { recursive: true });
  writeRegistry(root);
  writeFixtureFile(
    root,
    "README.md",
    "It features **38 specialized calculators across 1 specialty category**.\n" +
      "│   │   ├── calculators/       # 38 calculator components (one .jsx each)\n"
  );
  writeFixtureFile(
    root,
    path.join("public", "about.html"),
    "<p>Radulator currently offers <strong>38 calculators</strong> across multiple specialties:</p>\n"
  );
  return root;
}

function writeValidCalculators(root, count = 38) {
  for (let index = 1; index <= count; index += 1) {
    writeFixtureFile(
      root,
      path.join("src", "components", "calculators", `Valid${String(index).padStart(2, "0")}.jsx`),
      validCalculatorSource(index)
    );
  }
}

function runChecker(root) {
  const result = spawnSync(process.execPath, [checkerPath], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    parsed: JSON.parse(result.stdout),
  };
}

function withFixture(callback) {
  const root = makeFixtureRoot();
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

withFixture((root) => {
  writeValidCalculators(root);
  const result = runChecker(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.parsed.ok, true);
  assert.equal(result.parsed.metadata.idCount, 38);
});

withFixture((root) => {
  writeValidCalculators(root, 37);
  writeFixtureFile(
    root,
    path.join("src", "components", "calculators", "BrokenNestedMetadata.jsx"),
    nestedMetadataTrapSource()
  );

  const result = runChecker(root);
  assert.notEqual(result.status, 0, "checker should fail when required metadata exists only in nested objects");
  assert.equal(result.parsed.ok, false);
  assert.equal(result.parsed.metadata.idCount, 37);
  assert.match(result.stdout, /missing required top-level calculator metadata key 'id'/);
  assert.match(result.stdout, /missing required top-level calculator metadata key 'name'/);
  assert.match(result.stdout, /id is empty or not a top-level double-quoted static string/);
  assert.match(result.stdout, /name is empty or not a top-level double-quoted static string/);
  assert.match(result.stdout, /non-custom calculator missing top-level compute/);
});

withFixture((root) => {
  writeValidCalculators(root);
  writeFixtureFile(
    root,
    "README.md",
    "It features **37 specialized calculators across 1 specialty category**.\n" +
      "│   │   ├── calculators/       # 38 calculator components (one .jsx each)\n"
  );

  const result = runChecker(root);
  assert.notEqual(result.status, 0, "checker should reject a stale README calculator count");
  assert.match(result.stdout, /README\.md: advertised calculator count 37 does not match canonical count 38/);
});

withFixture((root) => {
  writeValidCalculators(root);
  writeFixtureFile(
    root,
    path.join("public", "about.html"),
    "<p>Radulator currently offers <strong>37 calculators</strong> across multiple specialties:</p>\n"
  );

  const result = runChecker(root);
  assert.notEqual(result.status, 0, "checker should reject a stale public/about.html calculator count");
  assert.match(result.stdout, /public\/about\.html: advertised calculator count 37 does not match canonical count 38/);
});

console.log("check-radulator-invariants regression tests passed");
