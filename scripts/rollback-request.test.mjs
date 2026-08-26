#!/usr/bin/env node
import assert from "node:assert/strict";

const subject = await import("./rollback-request.mjs").catch(() => null);
assert.ok(subject, "rollback request classification must be independently testable");

const { rollbackRequestRequired } = subject;
assert.equal(typeof rollbackRequestRequired, "function");

for (const [label, input, expected] of [
  ["main push live-smoke failure", { pagesOutcome: "success", smokeOutcome: "failure", mode: "main-push" }, true],
  ["automatic merge live-smoke failure", { pagesOutcome: "success", smokeOutcome: "failure", mode: "verified-auto-merge" }, true],
  ["Pages deployment failure", { pagesOutcome: "failure", smokeOutcome: "skipped", mode: "verified-auto-merge" }, false],
  ["pre-smoke failure", { pagesOutcome: "success", smokeOutcome: "skipped", mode: "verified-auto-merge" }, false],
  ["successful smoke with ancillary failure", { pagesOutcome: "success", smokeOutcome: "success", mode: "verified-auto-merge" }, false],
  ["failed rollback smoke", { pagesOutcome: "success", smokeOutcome: "failure", mode: "verified-rollback" }, false],
]) {
  assert.equal(rollbackRequestRequired(input), expected, label);
}

console.log("rollback request classification tests passed");
