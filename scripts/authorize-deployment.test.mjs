#!/usr/bin/env node
import assert from "node:assert/strict";

import { authorizeDeployment } from "./authorize-deployment.mjs";

const MAIN_SHA = "a".repeat(40);
const HEAD_SHA = "b".repeat(40);
const ROLLBACK_SHA = "c".repeat(40);

const validPr = {
  number: 123,
  state: "closed",
  merged: true,
  base: { ref: "main" },
  head: { sha: HEAD_SHA },
  merge_commit_sha: MAIN_SHA,
};

function api(overrides = {}) {
  return {
    async getMainRef() { return { object: { sha: MAIN_SHA } }; },
    async getPr() { return structuredClone(validPr); },
    async getRun() {
      return {
        id: 900,
        name: "Deploy to GitHub Pages",
        event: "push",
        head_branch: "main",
        head_sha: MAIN_SHA,
        status: "completed",
        conclusion: "failure",
        created_at: "2026-08-23T21:00:00Z",
      };
    },
    async getRunJobs() {
      return [{ steps: [
        { name: "Deploy to GitHub Pages", conclusion: "success" },
        { name: "Verify deployed site", conclusion: "failure" },
      ] }];
    },
    async listCompletedDeployRuns() {
      return [{
        id: 850,
        name: "Deploy to GitHub Pages",
        event: "push",
        head_branch: "main",
        head_sha: ROLLBACK_SHA,
        status: "completed",
        conclusion: "success",
        created_at: "2026-08-23T20:00:00Z",
      }];
    },
    ...overrides,
  };
}

assert.deepEqual(await authorizeDeployment({
  eventName: "push",
  event: { ref: "refs/heads/main", after: MAIN_SHA },
  api: api(),
}), { ok: true, ref: MAIN_SHA, mode: "main-push" });

assert.equal((await authorizeDeployment({
  eventName: "push",
  event: { ref: "refs/heads/feature", after: MAIN_SHA },
  api: api(),
})).ok, false);

const dispatchEvent = {
  action: "radulator-auto-merge-deploy",
  client_payload: { ref: MAIN_SHA, prNumber: 123, sourceHeadSha: HEAD_SHA },
};
assert.deepEqual(await authorizeDeployment({
  eventName: "repository_dispatch",
  event: dispatchEvent,
  api: api(),
}), { ok: true, ref: MAIN_SHA, mode: "verified-auto-merge" });

assert.equal((await authorizeDeployment({
  eventName: "repository_dispatch",
  event: dispatchEvent,
  api: api({ async getMainRef() { return { object: { sha: "d".repeat(40) } }; } }),
})).ok, false, "an arbitrary or stale repository-dispatch ref is rejected");

assert.equal((await authorizeDeployment({
  eventName: "repository_dispatch",
  event: dispatchEvent,
  api: api({ async getPr() { return { ...validPr, merged: false }; } }),
})).ok, false, "the dispatch must identify the exact merged PR");

const rollbackEvent = {
  action: "radulator-verified-rollback-deploy",
  client_payload: { ref: ROLLBACK_SHA, failedRunId: 900, sourceRunId: 850 },
};
assert.deepEqual(await authorizeDeployment({
  eventName: "repository_dispatch",
  event: rollbackEvent,
  api: api(),
}), { ok: true, ref: ROLLBACK_SHA, mode: "verified-rollback", failedRunId: 900 });

assert.equal((await authorizeDeployment({
  eventName: "repository_dispatch",
  event: { ...rollbackEvent, client_payload: { ...rollbackEvent.client_payload, ref: MAIN_SHA } },
  api: api(),
})).ok, false, "manual workflow dispatch cannot choose a non-selected ref");

assert.equal((await authorizeDeployment({
  eventName: "workflow_dispatch",
  event: { inputs: { ref: ROLLBACK_SHA, rollback_of_run: "900" } },
  api: api(),
})).ok, false, "direct workflow dispatch is never an authorized deployment entrypoint");

{
  const newerRun = {
    id: 901,
    name: "Deploy to GitHub Pages",
    event: "repository_dispatch",
    head_branch: "main",
    head_sha: "d".repeat(40),
    status: "completed",
    conclusion: "success",
    created_at: "2026-08-23T21:01:00Z",
  };
  const result = await authorizeDeployment({
    eventName: "repository_dispatch",
    event: rollbackEvent,
    api: api({
      async listCompletedDeployRuns() {
        return [...await api().listCompletedDeployRuns(), newerRun];
      },
      async getRunJobs(id) {
        if (id === 901) return [{ steps: [{ name: "Deploy to GitHub Pages", conclusion: "success" }] }];
        return api().getRunJobs(id);
      },
    }),
  });
  assert.equal(result.reasonCode, "ROLLBACK_SUPERSEDED", "a newer actual Pages deployment supersedes rollback of an older failure");
}

{
  const newerPreDeployFailure = {
    id: 901,
    name: "Deploy to GitHub Pages",
    event: "repository_dispatch",
    head_branch: "main",
    head_sha: "d".repeat(40),
    status: "completed",
    conclusion: "failure",
    created_at: "2026-08-23T21:01:00Z",
  };
  const result = await authorizeDeployment({
    eventName: "repository_dispatch",
    event: rollbackEvent,
    api: api({
      async listCompletedDeployRuns() {
        return [...await api().listCompletedDeployRuns(), newerPreDeployFailure];
      },
      async getRunJobs(id) {
        if (id === 901) return [{ steps: [{ name: "Build", conclusion: "failure" }] }];
        return api().getRunJobs(id);
      },
    }),
  });
  assert.equal(result.ok, true, "a newer pre-deploy failure does not leave the live site newer than the rollback target");
}

console.log("deployment authorization tests passed");
