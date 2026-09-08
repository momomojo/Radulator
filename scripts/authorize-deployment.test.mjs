#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { authorizeDeployment, run } from "./authorize-deployment.mjs";

const MAIN_SHA = "a".repeat(40);
const HEAD_SHA = "b".repeat(40);
const ROLLBACK_SHA = "c".repeat(40);
const TREE_SHA = "d".repeat(40);
const DEPLOY_WORKFLOW_ID = 177436018;
const DEPLOY_WORKFLOW_PATH = ".github/workflows/deploy.yml";
const pushTitle = (sha) => `Deploy main-push:${sha}`;

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
    async listPullsForCommit() { return [{ number: validPr.number }]; },
    async getPr() { return structuredClone(validPr); },
    async getCommit(sha) { return { sha, tree: { sha: TREE_SHA } }; },
    async getDeployWorkflow() {
      return { id: DEPLOY_WORKFLOW_ID, path: DEPLOY_WORKFLOW_PATH };
    },
    async getRun() {
      return {
        id: 900,
        name: pushTitle(MAIN_SHA),
        display_title: pushTitle(MAIN_SHA),
        workflow_id: DEPLOY_WORKFLOW_ID,
        path: DEPLOY_WORKFLOW_PATH,
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
        name: pushTitle(ROLLBACK_SHA),
        display_title: pushTitle(ROLLBACK_SHA),
        workflow_id: DEPLOY_WORKFLOW_ID,
        path: DEPLOY_WORKFLOW_PATH,
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
}), {
  ok: true,
  ref: MAIN_SHA,
  mode: "main-push",
  reviewedHeadSha: HEAD_SHA,
  sourceTreeSha: TREE_SHA,
  prNumber: validPr.number,
});

assert.equal((await authorizeDeployment({
  eventName: "push",
  event: { ref: "refs/heads/feature", after: MAIN_SHA },
  api: api(),
})).ok, false);

assert.equal((await authorizeDeployment({
  eventName: "push",
  event: { ref: "refs/heads/main", after: MAIN_SHA },
  api: api({ async getMainRef() { return { object: { sha: "e".repeat(40) } }; } }),
})).reasonCode, "MAIN_REF_NOT_CURRENT", "a stale main push is rejected before PR resolution");

assert.equal((await authorizeDeployment({
  eventName: "push",
  event: { ref: "refs/heads/main", after: MAIN_SHA },
  api: api({ async listPullsForCommit() { return []; } }),
})).reasonCode, "MERGED_MAIN_PR_NOT_UNIQUE", "a main commit without one matching merged PR is rejected");

assert.equal((await authorizeDeployment({
  eventName: "push",
  event: { ref: "refs/heads/main", after: MAIN_SHA },
  api: api({ async listPullsForCommit() { return [{ number: 123 }, { number: 124 }]; } }),
})).reasonCode, "MERGED_MAIN_PR_NOT_UNIQUE", "ambiguous merged main PRs are rejected");

assert.equal((await authorizeDeployment({
  eventName: "push",
  event: { ref: "refs/heads/main", after: MAIN_SHA },
  api: api({ async getCommit() { return { sha: "e".repeat(40), tree: { sha: TREE_SHA } }; } }),
})).reasonCode, "COMMIT_IDENTITY_MISMATCH", "a commit readback with the wrong SHA is rejected");

assert.equal((await authorizeDeployment({
  eventName: "push",
  event: { ref: "refs/heads/main", after: MAIN_SHA },
  api: api({ async getCommit(sha) {
    return { sha, tree: { sha: sha === HEAD_SHA ? "not-a-tree" : TREE_SHA } };
  } }),
})).reasonCode, "COMMIT_IDENTITY_MISMATCH", "a malformed immutable tree identity is rejected");

assert.equal((await authorizeDeployment({
  eventName: "push",
  event: { ref: "refs/heads/main", after: MAIN_SHA },
  api: api({ async getCommit(sha) {
    return { sha, tree: { sha: sha === HEAD_SHA ? "e".repeat(40) : TREE_SHA } };
  } }),
})).reasonCode, "SOURCE_TREE_MISMATCH", "a merged PR whose source tree differs from main is rejected");

const dispatchEvent = {
  action: "radulator-auto-merge-deploy",
  client_payload: { ref: MAIN_SHA, prNumber: 123, sourceHeadSha: HEAD_SHA },
};
assert.deepEqual(await authorizeDeployment({
  eventName: "repository_dispatch",
  event: dispatchEvent,
  api: api(),
}), {
  ok: true,
  ref: MAIN_SHA,
  mode: "verified-auto-merge",
  reviewedHeadSha: HEAD_SHA,
  sourceTreeSha: TREE_SHA,
  prNumber: validPr.number,
});

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

assert.equal((await authorizeDeployment({
  eventName: "repository_dispatch",
  event: dispatchEvent,
  api: api({ async getPr() { return { ...validPr, number: 999 }; } }),
})).reasonCode, "MERGED_PR_READBACK_MISMATCH", "dispatch must re-read the supplied PR number");

const rollbackEvent = {
  action: "radulator-verified-rollback-deploy",
  client_payload: { ref: ROLLBACK_SHA, failedRunId: 900, sourceRunId: 850 },
};
assert.deepEqual(await authorizeDeployment({
  eventName: "repository_dispatch",
  event: rollbackEvent,
  api: api(),
}), {
  ok: true,
  ref: ROLLBACK_SHA,
  mode: "verified-rollback",
  failedRunId: 900,
  reviewedHeadSha: null,
  sourceTreeSha: TREE_SHA,
  prNumber: null,
});

assert.deepEqual(await authorizeDeployment({
  eventName: "repository_dispatch",
  event: rollbackEvent,
  api: api({ async getMainRef() { return { object: { sha: "e".repeat(40) } }; } }),
}), {
  ok: true,
  ref: ROLLBACK_SHA,
  mode: "verified-rollback",
  failedRunId: 900,
  reviewedHeadSha: null,
  sourceTreeSha: TREE_SHA,
  prNumber: null,
}, "historical rollback does not require current main equality or invent a reviewed head");

assert.equal((await authorizeDeployment({
  eventName: "repository_dispatch",
  event: rollbackEvent,
  api: api({ async getCommit(sha) { return { sha, tree: { sha: "not-a-tree" } }; } }),
})).reasonCode, "ROLLBACK_COMMIT_IDENTITY_MISMATCH", "rollback must validate the selected immutable commit tree");

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
    name: `Deploy radulator-auto-merge-deploy:${"d".repeat(40)}`,
    display_title: `Deploy radulator-auto-merge-deploy:${"d".repeat(40)}`,
    workflow_id: DEPLOY_WORKFLOW_ID,
    path: DEPLOY_WORKFLOW_PATH,
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
    name: `Deploy radulator-auto-merge-deploy:${"d".repeat(40)}`,
    display_title: `Deploy radulator-auto-merge-deploy:${"d".repeat(40)}`,
    workflow_id: DEPLOY_WORKFLOW_ID,
    path: DEPLOY_WORKFLOW_PATH,
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

{
  const temporary = await mkdtemp(join(tmpdir(), "authorize-deployment-"));
  const eventPath = join(temporary, "event.json");
  const outputPath = join(temporary, "output.txt");
  try {
    await writeFile(eventPath, JSON.stringify({ ref: "refs/heads/main", after: MAIN_SHA }), "utf8");
    await run({
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_EVENT_NAME: "push",
      GITHUB_OUTPUT: outputPath,
    }, api());
    assert.equal(
      await readFile(outputPath, "utf8"),
      `ref=${MAIN_SHA}\nmode=main-push\nreviewed_head_sha=${HEAD_SHA}\nsource_tree_sha=${TREE_SHA}\npr_number=${validPr.number}\n`,
      "ordinary deployment metadata is emitted without secrets",
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

console.log("deployment authorization tests passed");
