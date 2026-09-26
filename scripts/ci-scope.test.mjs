#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scopeFor } from "./ci-scope.mjs";
import { analyzeRisk } from "./release-policy.mjs";

const pr = { eventName: "pull_request" };
const releaseFile = "package-lock.json";
const clinicalFile = "docs/evidence/fleischner-2017-nlm-table-pins.json";

for (const eventName of ["push", "workflow_dispatch", undefined]) {
  const result = scopeFor([releaseFile], analyzeRisk, { eventName });
  assert.deepEqual([result.clinical, result.deps], [true, true], `${eventName} runs every check`);
}
assert.deepEqual(
  [scopeFor([], analyzeRisk, pr).clinical, scopeFor([], analyzeRisk, pr).deps],
  [true, true],
  "an empty or unreadable diff runs every check",
);

const release = scopeFor([releaseFile, ".github/workflows/e2e-tests.yml"], analyzeRisk, pr);
assert.deepEqual([release.clinical, release.deps], [false, true], "release-control-only PRs skip only source audits");

const clinical = scopeFor([clinicalFile], analyzeRisk, pr);
assert.deepEqual([clinical.clinical, clinical.deps], [true, false], "clinical-only PRs skip only the dependency audit");

const mixed = scopeFor([releaseFile, clinicalFile], analyzeRisk, pr);
assert.deepEqual([mixed.clinical, mixed.deps], [true, true], "PRs touching both trust domains run every check");

const other = scopeFor(["README.md"], analyzeRisk, pr);
assert.deepEqual([other.clinical, other.deps], [true, true], "files outside both domains run every check");

for (const rules of ["scripts/release-policy.mjs", "scripts/ci-scope.mjs"]) {
  const result = scopeFor([rules], analyzeRisk, pr);
  assert.deepEqual([result.clinical, result.deps], [true, true], `changing ${rules} runs every check`);
  assert.match(result.why, /scope rules or the risk classifier/);
}

// A PR-supplied classifier that calls everything release-control must not matter: the workflow
// loads the classifier from the base commit, and this module never reads one from the head.
const lying = () => ({ risk: { reasonCodes: ["RELEASE_CONTROL_CHANGE"] } });
assert.deepEqual(
  [scopeFor([clinicalFile], analyzeRisk, pr).clinical, scopeFor([clinicalFile], lying, pr).clinical],
  [true, false],
  "the scope decision depends only on the classifier it is handed",
);

// The CLI fails safe: a classifier that cannot be loaded runs every check.
const here = path.dirname(fileURLToPath(import.meta.url));
const out = mkdtempSync(path.join(tmpdir(), "ci-scope-"));
try {
  const outputFile = path.join(out, "github-output");
  execFileSync(process.execPath, [path.join(here, "ci-scope.mjs"), path.join(out, "missing-policy.mjs")], {
    env: { ...process.env, EVENT_NAME: "pull_request", BASE_SHA: "HEAD", HEAD_SHA: "HEAD", GITHUB_OUTPUT: outputFile },
    stdio: "pipe",
  });
  assert.equal(readFileSync(outputFile, "utf8"), "clinical=true\ndeps=true\n", "a load failure runs every check");
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log("ci-scope tests passed");
