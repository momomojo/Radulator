#!/usr/bin/env node
import assert from "node:assert/strict";

import { selectLastGoodDeployment } from "./select-rollback-deployment.mjs";

const FAILED_SHA = "a".repeat(40);
const OLD_SHA = "b".repeat(40);
const NEWER_SHA = "c".repeat(40);

function failedRun(overrides = {}) {
  return {
    id: 900,
    name: "Deploy to GitHub Pages",
    event: "push",
    head_branch: "main",
    head_sha: FAILED_SHA,
    status: "completed",
    conclusion: "failure",
    created_at: "2026-08-23T21:00:00Z",
    ...overrides,
  };
}

function successRun(id, sha, createdAt, overrides = {}) {
  return {
    id,
    name: "Deploy to GitHub Pages",
    event: "push",
    head_branch: "main",
    head_sha: sha,
    status: "completed",
    conclusion: "success",
    created_at: createdAt,
    ...overrides,
  };
}

assert.deepEqual(selectLastGoodDeployment(failedRun(), [
  successRun(800, OLD_SHA, "2026-08-23T19:00:00Z"),
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
]), {
  ref: NEWER_SHA,
  sourceRunId: 850,
  failedRunId: 900,
  failedSha: FAILED_SHA,
});

assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, FAILED_SHA, "2026-08-23T20:00:00Z"),
]), null, "the failed SHA is never selected as rollback");

assert.equal(selectLastGoodDeployment(failedRun({ event: "workflow_dispatch" }), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
]), null, "a rollback/manual deployment failure cannot recurse");

assert.equal(selectLastGoodDeployment(failedRun({ event: "repository_dispatch" }), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], [{
  name: "deploy",
  steps: [
    { name: "Deploy to GitHub Pages", status: "completed", conclusion: "success" },
    { name: "Verify deployed site", status: "completed", conclusion: "failure" },
  ],
}]).ref, NEWER_SHA, "an automatic-merge deployment smoke failure is rollback eligible");

assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T22:00:00Z"),
]), null, "a run after the failure is not last-known-good evidence");

assert.deepEqual(selectLastGoodDeployment(failedRun(), [
  successRun(800, OLD_SHA, "2026-08-23T19:00:00Z"),
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z", { event: "workflow_dispatch" }),
]), {
  ref: OLD_SHA,
  sourceRunId: 800,
  failedRunId: 900,
  failedSha: FAILED_SHA,
}, "a successful rollback dispatch is not proof that its workflow head SHA was deployed");

assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z", { head_branch: "feature" }),
  successRun(851, "not-a-sha", "2026-08-23T20:30:00Z"),
]), null);

const smokeFailureJobs = [{
  name: "deploy",
  steps: [
    { name: "Deploy to GitHub Pages", status: "completed", conclusion: "success" },
    { name: "Verify deployed site", status: "completed", conclusion: "failure" },
  ],
}];
assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], smokeFailureJobs).ref, NEWER_SHA);
assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], [{ name: "build", steps: [{ name: "Build", status: "completed", conclusion: "failure" }] }]), null,
"build failures do not roll back an unchanged live site");

console.log("rollback deployment selection tests passed");
