#!/usr/bin/env node
import assert from "node:assert/strict";

import * as rollback from "./select-rollback-deployment.mjs";

const {
  dispatchRollbackDeployment,
  dispatchRollbackRequest,
  handleRollbackRequest,
  loadCompletedDeploymentRuns,
  loadRunJobs,
  selectLastGoodDeployment,
  waitForCompletedDeploymentRun,
} = rollback;

const FAILED_SHA = "a".repeat(40);
const OLD_SHA = "b".repeat(40);
const NEWER_SHA = "c".repeat(40);
const DEPLOY_WORKFLOW_ID = 177436018;
const DEPLOY_WORKFLOW_PATH = ".github/workflows/deploy.yml";
const autoTitle = (sha) => `Deploy radulator-auto-merge-deploy:${sha}`;
const rollbackTitle = (sha) => `Deploy radulator-verified-rollback-deploy:${sha}`;
const pushTitle = (sha) => `Deploy main-push:${sha}`;

assert.equal(typeof dispatchRollbackRequest, "function", "the failed deploy can emit an explicit rollback request");
assert.equal(typeof waitForCompletedDeploymentRun, "function", "rollback handling waits for source-run finalization");
assert.equal(typeof handleRollbackRequest, "function", "the request handler re-reads and selects rollback evidence");
assert.equal(typeof loadRunJobs, "function", "the handler reads every source-run job page");

function failedRun(overrides = {}) {
  return {
    id: 900,
    name: pushTitle(FAILED_SHA),
    display_title: pushTitle(FAILED_SHA),
    workflow_id: DEPLOY_WORKFLOW_ID,
    path: DEPLOY_WORKFLOW_PATH,
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
    name: pushTitle(sha),
    display_title: pushTitle(sha),
    workflow_id: DEPLOY_WORKFLOW_ID,
    path: DEPLOY_WORKFLOW_PATH,
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

function rollbackApi({ failed = failedRun(), jobs = smokeFailureJobs } = {}) {
  const dispatches = [];
  const states = [{ ...failed, status: "in_progress", conclusion: null }, failed];
  return {
    dispatches,
    async getDeployWorkflow() { return { id: DEPLOY_WORKFLOW_ID, path: DEPLOY_WORKFLOW_PATH }; },
    async getRun() { return states.shift() || failed; },
    async getRunJobs() { return jobs; },
    async listCompletedDeployRuns() {
      return [successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z")];
    },
    async dispatchRollback(selected) { dispatches.push(selected); return { accepted: true }; },
  };
}

{
  const api = rollbackApi();
  const selected = await handleRollbackRequest({
    api,
    failedRunId: 900,
    dispatch: true,
    completionOptions: { attempts: 2, delayMs: 0, wait: async () => {} },
  });
  assert.equal(selected.ref, NEWER_SHA);
  assert.deepEqual(api.dispatches, [selected], "only the independently selected rollback is dispatched");
}

{
  const api = rollbackApi();
  const selected = await handleRollbackRequest({
    api,
    failedRunId: 900,
    completionOptions: { attempts: 2, delayMs: 0, wait: async () => {} },
  });
  assert.equal(selected.ref, NEWER_SHA);
  assert.equal(api.dispatches.length, 0, "selection-only mode preserves the existing no-dispatch CLI behavior");
}

for (const [label, failed, jobs] of [
  ["pre-Pages failure", failedRun(), [{ steps: [{ name: "Deploy to GitHub Pages", conclusion: "failure" }] }]],
  ["post-smoke ancillary failure", failedRun(), [{ steps: [
    { name: "Deploy to GitHub Pages", conclusion: "success" },
    { name: "Verify deployed site", conclusion: "success" },
    { name: "Ping search indexes", conclusion: "failure" },
  ] }]],
  ["failed rollback deployment", failedRun({
    event: "repository_dispatch",
    name: rollbackTitle(FAILED_SHA),
    display_title: rollbackTitle(FAILED_SHA),
  }), smokeFailureJobs],
]) {
  const api = rollbackApi({ failed, jobs });
  await assert.rejects(() => handleRollbackRequest({
    api,
    failedRunId: 900,
    dispatch: true,
    completionOptions: { attempts: 2, delayMs: 0, wait: async () => {} },
  }), /No prior successful main deployment/, `${label} fails closed`);
  assert.equal(api.dispatches.length, 0, `${label} never dispatches rollback`);
}

assert.deepEqual(selectLastGoodDeployment(failedRun(), [
  successRun(800, OLD_SHA, "2026-08-23T19:00:00Z"),
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], null, DEPLOY_WORKFLOW_ID), {
  ref: NEWER_SHA,
  sourceRunId: 850,
  failedRunId: 900,
  failedSha: FAILED_SHA,
});

assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, FAILED_SHA, "2026-08-23T20:00:00Z"),
], null, DEPLOY_WORKFLOW_ID), null, "the failed SHA is never selected as rollback");

assert.equal(selectLastGoodDeployment(failedRun({ event: "workflow_dispatch" }), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], null, DEPLOY_WORKFLOW_ID), null, "a rollback/manual deployment failure cannot recurse");

assert.equal(selectLastGoodDeployment(failedRun({
  event: "repository_dispatch", name: autoTitle(FAILED_SHA), display_title: autoTitle(FAILED_SHA),
}), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], [{
  name: "deploy",
  steps: [
    { name: "Deploy to GitHub Pages", status: "completed", conclusion: "success" },
    { name: "Verify deployed site", status: "completed", conclusion: "failure" },
  ],
}], DEPLOY_WORKFLOW_ID).ref, NEWER_SHA, "an automatic-merge deployment smoke failure is rollback eligible");

assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T22:00:00Z"),
], null, DEPLOY_WORKFLOW_ID), null, "a run after the failure is not last-known-good evidence");

assert.deepEqual(selectLastGoodDeployment(failedRun(), [
  successRun(800, OLD_SHA, "2026-08-23T19:00:00Z"),
  successRun(850, FAILED_SHA, "2026-08-23T20:00:00Z", {
    event: "repository_dispatch",
    name: rollbackTitle(NEWER_SHA),
    display_title: rollbackTitle(NEWER_SHA),
  }),
], null, DEPLOY_WORKFLOW_ID), {
  ref: OLD_SHA,
  sourceRunId: 800,
  failedRunId: 900,
  failedSha: FAILED_SHA,
}, "a successful rollback dispatch is not proof that its workflow head SHA was deployed");

assert.deepEqual(selectLastGoodDeployment(failedRun({
  event: "repository_dispatch", name: autoTitle(FAILED_SHA), display_title: autoTitle(FAILED_SHA),
}), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z", {
    event: "repository_dispatch",
    name: autoTitle(NEWER_SHA),
    display_title: autoTitle(NEWER_SHA),
  }),
], null, DEPLOY_WORKFLOW_ID), {
  ref: NEWER_SHA,
  sourceRunId: 850,
  failedRunId: 900,
  failedSha: FAILED_SHA,
}, "a successful trusted automatic-merge deployment is valid last-known-good evidence");

assert.equal(selectLastGoodDeployment(failedRun({
  event: "repository_dispatch",
  display_title: rollbackTitle(OLD_SHA),
}), [successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z")], smokeFailureJobs, DEPLOY_WORKFLOW_ID), null,
"a failed rollback deployment cannot recursively dispatch another rollback");

assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z", { head_branch: "feature" }),
  successRun(851, "not-a-sha", "2026-08-23T20:30:00Z"),
], null, DEPLOY_WORKFLOW_ID), null);

assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], smokeFailureJobs, DEPLOY_WORKFLOW_ID).ref, NEWER_SHA);
assert.equal(selectLastGoodDeployment(failedRun(), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], [{ name: "build", steps: [{ name: "Build", status: "completed", conclusion: "failure" }] }], DEPLOY_WORKFLOW_ID), null,
"build failures do not roll back an unchanged live site");

assert.equal(selectLastGoodDeployment(failedRun({ workflow_id: 999 }), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], smokeFailureJobs, DEPLOY_WORKFLOW_ID), null, "a failed run from another workflow is never rollback evidence");

assert.equal(selectLastGoodDeployment(failedRun({ path: ".github/workflows/other.yml" }), [
  successRun(850, NEWER_SHA, "2026-08-23T20:00:00Z"),
], smokeFailureJobs, DEPLOY_WORKFLOW_ID), null, "a failed run with the wrong workflow path is never rollback evidence");

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
  assert.equal(selectLastGoodDeployment(failedRun(), runs, null, DEPLOY_WORKFLOW_ID).ref, NEWER_SHA);
}

{
  const pages = [];
  const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: 3000 + index, name: `job-${index}` }));
  const secondPage = [{ id: 4000, name: "deploy" }];
  const jobs = await loadRunJobs("token", "momomojo/Radulator", 900, async (_token, path) => {
    const page = Number(new URL(`https://api.github.test${path}`).searchParams.get("page"));
    pages.push(page);
    return { jobs: page === 1 ? firstPage : secondPage };
  });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(jobs.length, 101);
}

{
  const states = [
    { id: 900, status: "in_progress", conclusion: null },
    { id: 900, status: "in_progress", conclusion: null },
    { id: 900, status: "completed", conclusion: "failure" },
  ];
  const waits = [];
  const completed = await waitForCompletedDeploymentRun(
    async () => states.shift(),
    900,
    { attempts: 3, delayMs: 25, wait: async (delayMs) => waits.push(delayMs) },
  );
  assert.deepEqual(completed, { id: 900, status: "completed", conclusion: "failure" });
  assert.deepEqual(waits, [25, 25], "the handler waits only between incomplete readbacks");

  await assert.rejects(() => waitForCompletedDeploymentRun(
    async () => ({ id: 901, status: "in_progress", conclusion: null }),
    901,
    { attempts: 2, delayMs: 0, wait: async () => {} },
  ), /did not complete/, "a source run that never finalizes cannot authorize rollback");
}

{
  const calls = [];
  await dispatchRollbackRequest("token", "momomojo/Radulator", 900, async (_token, path, options) => {
    calls.push({ path, options });
    return null;
  });
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    event_type: "radulator-live-smoke-rollback-request",
    client_payload: { failedRunId: 900 },
  });
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
