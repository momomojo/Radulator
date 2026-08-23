#!/usr/bin/env node
import assert from "node:assert/strict";

import { reconcileCurrentMainDeployment } from "./reconcile-deployment.mjs";

const MAIN_SHA = "a".repeat(40);
const HEAD_SHA = "b".repeat(40);
const autoTitle = `Deploy radulator-auto-merge-deploy:${MAIN_SHA}`;
const AUTHORIZED_JOBS = [{
  name: "authorize",
  steps: [{ name: "Authorize immutable deployment source", conclusion: "success" }],
}];

function api(overrides = {}) {
  const dispatches = [];
  return {
    dispatches,
    async getMainRef() { return { object: { sha: MAIN_SHA } }; },
    async listPullsForCommit() { return [{ number: 123 }]; },
    async getPr() {
      return {
        number: 123,
        state: "closed",
        merged: true,
        base: { ref: "main" },
        head: { sha: HEAD_SHA },
        merge_commit_sha: MAIN_SHA,
      };
    },
    async listDeployRunsForHead() { return []; },
    async getRunJobs() { return []; },
    async dispatchDeployment(payload) { dispatches.push(payload); return { accepted: true }; },
    ...overrides,
  };
}

{
  const client = api();
  const result = await reconcileCurrentMainDeployment({ api: client });
  assert.deepEqual(client.dispatches, [{ ref: MAIN_SHA, prNumber: 123, sourceHeadSha: HEAD_SHA }]);
  assert.equal(result.status, "dispatched");
}

{
  const client = api({
    async listDeployRunsForHead() {
      return [{
        id: 500, name: "Deploy to GitHub Pages", head_branch: "main", head_sha: MAIN_SHA,
        event: "repository_dispatch", display_title: autoTitle, status: "in_progress", conclusion: null,
      }];
    },
  });
  const result = await reconcileCurrentMainDeployment({ api: client });
  assert.equal(result.status, "already-satisfied");
  assert.equal(client.dispatches.length, 0);
}

{
  const client = api({
    async listDeployRunsForHead() {
      return [{
        id: 501, name: "Deploy to GitHub Pages", head_branch: "main", head_sha: MAIN_SHA,
        event: "repository_dispatch", display_title: autoTitle, status: "completed", conclusion: "failure",
      }];
    },
  });
  const result = await reconcileCurrentMainDeployment({ api: client });
  assert.equal(result.status, "dispatched", "a pre-deploy failure remains a retryable obligation");
  assert.equal(client.dispatches.length, 1);
}

{
  const client = api({
    async listDeployRunsForHead() {
      return Array.from({ length: 3 }, (_, index) => ({
        id: 510 + index, name: "Deploy to GitHub Pages", head_branch: "main", head_sha: MAIN_SHA,
        event: "repository_dispatch", display_title: autoTitle, status: "completed", conclusion: "failure",
        created_at: "2026-08-23T20:00:00Z",
      }));
    },
    async getRunJobs() { return AUTHORIZED_JOBS; },
  });
  const result = await reconcileCurrentMainDeployment({ api: client, now: Date.parse("2026-08-23T20:05:00Z") });
  assert.equal(result.status, "retry-cooldown");
  assert.equal(client.dispatches.length, 0, "a permanently broken build is not dispatched forever");
}

{
  const client = api({
    async listDeployRunsForHead() {
      return Array.from({ length: 3 }, (_, index) => ({
        id: 515 + index, name: "Deploy to GitHub Pages", head_branch: "main", head_sha: MAIN_SHA,
        event: "repository_dispatch", display_title: autoTitle, status: "completed", conclusion: "failure",
        created_at: "2026-08-23T19:00:00Z",
      }));
    },
    async getRunJobs() { return AUTHORIZED_JOBS; },
  });
  const result = await reconcileCurrentMainDeployment({ api: client, now: Date.parse("2026-08-23T20:05:00Z") });
  assert.equal(result.status, "dispatched", "pre-deploy failures resume automatically after a cooldown");
  assert.equal(client.dispatches.length, 1);
}

{
  const client = api({
    async listDeployRunsForHead() {
      return Array.from({ length: 3 }, (_, index) => ({
        id: 518 + index, name: "Deploy to GitHub Pages", head_branch: "main", head_sha: MAIN_SHA,
        event: "repository_dispatch", display_title: autoTitle, status: "completed", conclusion: "failure",
        created_at: "2026-08-23T20:00:00Z",
      }));
    },
    async getRunJobs() {
      return [{ name: "authorize", steps: [{ name: "Authorize immutable deployment source", conclusion: "failure" }] }];
    },
  });
  const result = await reconcileCurrentMainDeployment({ api: client, now: Date.parse("2026-08-23T20:05:00Z") });
  assert.equal(result.status, "dispatched", "unauthorized dispatch failures cannot consume the retry budget");
  assert.equal(client.dispatches.length, 1);
}

{
  const client = api({
    async listDeployRunsForHead() {
      return [{
        id: 520, name: "Deploy to GitHub Pages", head_branch: "main", head_sha: MAIN_SHA,
        event: "repository_dispatch", display_title: autoTitle, status: "completed", conclusion: "failure",
      }];
    },
    async getRunJobs() {
      return [{ steps: [
        { name: "Deploy to GitHub Pages", conclusion: "success" },
        { name: "Verify deployed site", conclusion: "failure" },
     ] }];
    },
  });
  const result = await reconcileCurrentMainDeployment({ api: client });
  assert.equal(result.status, "rollback-required");
  assert.equal(client.dispatches.length, 0, "live smoke failure is owned by rollback, not redeployment retry");
}

{
  const client = api({
    async listDeployRunsForHead() {
      return [{
        id: 521, name: "Deploy to GitHub Pages", head_branch: "main", head_sha: MAIN_SHA,
        event: "repository_dispatch", display_title: autoTitle, status: "completed", conclusion: "failure",
      }];
    },
    async getRunJobs() {
      return [{ steps: [
        { name: "Authorize immutable deployment source", conclusion: "success" },
        { name: "Deploy to GitHub Pages", conclusion: "success" },
        { name: "Verify deployed site", conclusion: "success" },
        { name: "Ping search indexes", conclusion: "failure" },
      ] }];
    },
  });
  const result = await reconcileCurrentMainDeployment({ api: client });
  assert.equal(result.status, "already-satisfied", "post-smoke ancillary failure does not redeploy a healthy site");
  assert.equal(result.ancillaryFailure, true);
  assert.equal(client.dispatches.length, 0);
}

{
  const client = api({ async getPr() { return { number: 123, merged: false, base: { ref: "main" } }; } });
  const result = await reconcileCurrentMainDeployment({ api: client });
  assert.equal(result.status, "not-auto-merge-main");
  assert.equal(client.dispatches.length, 0);
}

{
  const client = api({ async dispatchDeployment() { throw new Error("transient API failure"); } });
  await assert.rejects(() => reconcileCurrentMainDeployment({ api: client }), /transient API failure/);
}

console.log("durable deployment reconciliation tests passed");
