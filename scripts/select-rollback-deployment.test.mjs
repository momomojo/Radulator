#!/usr/bin/env node
import assert from "node:assert/strict";

import {
  dispatchRollbackDeployment,
  loadCompletedDeploymentRuns,
  selectLastGoodDeployment,
} from "./select-rollback-deployment.mjs";

const FAILED_SHA = "a".repeat(40);
const OLD_SHA = "b".repeat(40);
const NEWER_SHA = "c".repeat(40);
const autoTitle = (sha) => `Deploy radulator-auto-merge-deploy:${sha}`;
const rollbackTitle = (sha) => `Deploy radulator-verified-rollback-deploy:${sha}`;

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

const smokeFailureJobs = [{
  name: "deploy",
  steps: [
    { name: "Deploy to GitHub Pages", status: "completed", conclusion: "success" },
    { name: "Verify deployed site", status: "completed", conclusion: "failure" },
  ],
}];

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

assert.equal(selectLastGoodDeployment(failedRun({ event: "repository_dispatch", display_title: autoTitle(FAILED_SHA) }), [
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
  successRun(850, FAILED_SHA, "2026-08-23T20:00:00Z", {
    event: "repository_dispatch",
    display_title: rollbackTitle(NEWER_SHA),
  }),
]), {
  ref: OLD_SHA,
  sourceRunId: 800,
  failedRunId: 900,
  failedSha: FAILED_SHA,
}, "a successful rollback dispatch is not proof that its workflow head SHA was deployed");

assert.deepEqual(selectLastGoodDeployment(failedRun({ event: "repository_dispatch", display_title: autoTitle(FAILED_SHA) }), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z", {
    event: "repository_dispatch",
    display_title: autoTitle(NEWER_SHA),
  }),
]), {
  ref: NEWER_SHA,
  sourceRunId: 850,
  failedRunId: 900,
  failedSha: FAILED_SHA,
}, "a successful trusted automatic-merge deployment is valid last-known-good evidence");

assert.equal(selectLastGoodDeployment(failedRun({
  event: "repository_dispatch",
  display_title: rollbackTitle(OLD_SHA),
}), [successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z")], smokeFailureJobs), null,
"a failed rollback deployment cannot recursively dispatch another rollback");

assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z", { head_branch: "feature" }),
  successRun(851, "not-a-sha", "2026-08-23T20:30:00Z"),
]), null);

assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], smokeFailureJobs).ref, NEWER_SHA);
assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], [{ name: "build", steps: [{ name: "Build", status: "completed", conclusion: "failure" }] }]), null,
"build failures do not roll back an unchanged live site");

{
  const pages = [];
  const firstPage = Array.from({ length: 100 }, (_, index) => successRun(
    1000 + index,
    `${(index + 1).toString(16).padStart(40, "0")}`,
    "2026-08-23T18:00:00Z",
  ));
  const secondPage = [successRun(2000, NEWER_SHA, "2026-08-23T20:00:00Z")];
  const runs = await loadCompletedDeploymentRuns("token", "momomojo/Radulator", async (_token, path) => {
    const page = Number(new URL(`https://api.github.test${path}`).searchParams.get("page"));
    pages.push(page);
    return { workflow_runs: page === 1 ? firstPage : secondPage };
  });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(runs.length, 101);
  assert.equal(selectLastGoodDeployment(failedRun(), runs).ref, NEWER_SHA);
}

{
  const calls = [];
  const selection = {
    ref: NEWER_SHA,
    sourceRunId: 850,
    failedRunId: 900,
    failedSha: FAILED_SHA,
  };
  await dispatchRollbackDeployment("token", "momomojo/Radulator", selection, async (_token, path, options) => {
    calls.push({ path, options });
    return null;
  });
  assert.equal(calls[0].path, "/repos/momomojo/Radulator/dispatches");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    event_type: "radulator-verified-rollback-deploy",
    client_payload: { ref: NEWER_SHA, sourceRunId: 850, failedRunId: 900 },
  });
}

console.log("rollback deployment selection tests passed");
