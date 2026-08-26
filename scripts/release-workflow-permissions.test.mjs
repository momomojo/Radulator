#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parse } from "yaml";

async function workflow(path) {
  return parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

const gate = await workflow("../.github/workflows/independent-review-gate.yml");
const merge = await workflow("../.github/workflows/auto-merge.yml");

assert.equal(gate.jobs.evaluate.permissions.statuses, "write");
assert.equal(
  gate.jobs["reconcile-merge"].permissions.statuses,
  "read",
  "the reusable merge caller must pass commit-status read permission",
);
assert.equal(
  merge.permissions.statuses,
  "read",
  "the reusable merge workflow must request commit-status read permission",
);
assert.equal(
  gate.jobs.evaluate.steps[0].with.ref,
  "${{ github.event.pull_request.base.ref || github.event.repository.default_branch }}",
  "trusted gate checkout must follow the current protected base branch instead of a stale event SHA",
);

console.log("release workflow permission contract tests passed");
