#!/usr/bin/env node
import assert from "node:assert/strict";

import {
  evaluateAutoMerge,
  evaluateProductionSingleFlight,
  loadProductionSingleFlightEvidence,
  runAutoMerge,
} from "./auto-merge.mjs";
import { REQUIRED_CONTEXT } from "./independent-review-gate.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const FINGERPRINT = "c".repeat(64);
const ACTIONS_APP_ID = 15368;
const ACTIONS_BOT_ID = 41898282;
const ENFORCEMENT_CONTEXT = "Radulator Clinical Release Authorization";
const MAIN = "d".repeat(40);
const DEPLOY_WORKFLOW_ID = 7001;

function prFixture(overrides = {}) {
  return {
    number: 123,
    state: "open",
    draft: false,
    merged: false,
    headSha: HEAD,
    baseSha: BASE,
    baseRef: "develop",
    ...overrides,
  };
}

function gateFixture(overrides = {}) {
  return {
    context: REQUIRED_CONTEXT,
    conclusion: "success",
    eligible: true,
    reasonCode: "PASS",
    headSha: HEAD,
    baseSha: BASE,
    fingerprint: FINGERPRINT,
    ...overrides,
  };
}

function checkFixture(overrides = {}) {
  return {
    id: 5001,
    name: REQUIRED_CONTEXT,
    head_sha: HEAD,
    app: { id: ACTIONS_APP_ID, slug: "github-actions" },
    status: "completed",
    conclusion: "success",
    completed_at: "2026-08-23T20:10:00Z",
    external_id: `radulator-clinical-gate/v1/${FINGERPRINT}`,
    html_url: "https://github.com/momomojo/Radulator/runs/5001",
    ...overrides,
  };
}

function statusFixture(overrides = {}) {
  return {
    id: 6001,
    context: ENFORCEMENT_CONTEXT,
    state: "success",
    created_at: "2026-08-23T20:10:01Z",
    creator: { id: ACTIONS_BOT_ID, login: "github-actions[bot]" },
    description: `PASS ${FINGERPRINT}`,
    target_url: "https://github.com/momomojo/Radulator/runs/5001",
    ...overrides,
  };
}

function decisionFixture(overrides = {}) {
  return {
    pr: prFixture(overrides.pr),
    gateResult: gateFixture(overrides.gateResult),
    checkRuns: overrides.checkRuns || [checkFixture()],
    commitStatuses: overrides.commitStatuses || [statusFixture()],
    branchRules: overrides.branchRules || [{
      type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: true,
        required_status_checks: [{ context: ENFORCEMENT_CONTEXT, integration_id: ACTIONS_APP_ID }],
      },
    }],
    expectedGateAppId: ACTIONS_APP_ID,
  };
}

function productionLaneFixture(overrides = {}) {
  return {
    pr: prFixture(),
    mainRef: { object: { sha: MAIN } },
    developRef: { object: { sha: BASE } },
    comparison: {
      status: "ahead",
      ahead_by: 4,
      behind_by: 0,
      merge_base_commit: { sha: BASE },
    },
    deployWorkflow: {
      id: DEPLOY_WORKFLOW_ID,
      path: ".github/workflows/deploy.yml",
      state: "active",
    },
    deployRun: {
      id: 8001,
      workflow_id: DEPLOY_WORKFLOW_ID,
      path: ".github/workflows/deploy.yml",
      event: "push",
      head_branch: "main",
      head_sha: MAIN,
      status: "completed",
      conclusion: "success",
    },
    deployJobs: [{
      steps: [
        { name: "Authorize immutable deployment source", conclusion: "success" },
        { name: "Deploy to GitHub Pages", conclusion: "success" },
        { name: "Verify deployed site", conclusion: "success" },
      ],
    }],
    marker: {
      ok: true,
      status: 200,
      data: { schema: "radulator-release/v1", sha: MAIN },
    },
    ...overrides,
  };
}

function productionLaneApi(overrides = {}) {
  return {
    async loadProductionSingleFlightEvidence() {
      return productionLaneFixture(overrides);
    },
  };
}

{
  const result = evaluateAutoMerge(decisionFixture());
  assert.deepEqual(result, {
    ok: true,
    reasonCode: "MERGE_AUTHORIZED",
    payload: {
      sha: HEAD,
      merge_method: "squash",
      commit_title: "PR #123: exact-head clinical gate passed",
    },
  });
}

{
  const production = evaluateAutoMerge(decisionFixture({ pr: { baseRef: "main" } }));
  assert.equal(production.ok, true);
  assert.equal(
    production.payload.merge_method,
    "merge",
    "production promotions must preserve the exact develop head as a main parent",
  );
}

{
  const open = evaluateProductionSingleFlight(productionLaneFixture());
  assert.deepEqual(open, {
    ok: true,
    reasonCode: "PRODUCTION_LANE_OPEN",
    mainSha: MAIN,
    developSha: BASE,
    deployRunId: 8001,
  });
  assert.equal(evaluateProductionSingleFlight(productionLaneFixture({
    pr: prFixture({ baseSha: "e".repeat(40) }),
  })).reasonCode, "DEVELOP_BASE_DRIFT");
  assert.equal(evaluateProductionSingleFlight(productionLaneFixture({
    comparison: {
      status: "behind",
      ahead_by: 0,
      behind_by: 1,
      merge_base_commit: { sha: "f".repeat(40) },
    },
  })).reasonCode, "UNRELEASED_DEVELOP_HEAD");
  assert.equal(evaluateProductionSingleFlight(productionLaneFixture({
    pr: prFixture({ labels: ["ready-for-gate", "release-remediation"] }),
    comparison: {
      status: "behind",
      ahead_by: 0,
      behind_by: 1,
      merge_base_commit: { sha: "f".repeat(40) },
    },
  })).reasonCode, "PRODUCTION_REMEDIATION_LANE_OPEN");
  assert.equal(evaluateProductionSingleFlight(productionLaneFixture({
    deployRun: {
      ...productionLaneFixture().deployRun,
      status: "in_progress",
      conclusion: null,
    },
  })).reasonCode, "CURRENT_MAIN_DEPLOYMENT_NOT_COMPLETE");
  assert.equal(evaluateProductionSingleFlight(productionLaneFixture({
    deployJobs: [{ steps: [
      { name: "Authorize immutable deployment source", conclusion: "success" },
      { name: "Deploy to GitHub Pages", conclusion: "success" },
      { name: "Verify deployed site", conclusion: "failure" },
    ] }],
  })).reasonCode, "CURRENT_MAIN_LIVE_SMOKE_NOT_PASSING");
  assert.equal(evaluateProductionSingleFlight(productionLaneFixture({
    marker: {
      ok: true,
      status: 200,
      data: { schema: "radulator-release/v1", sha: "0".repeat(40) },
    },
  })).reasonCode, "CURRENT_MAIN_MARKER_MISMATCH");
}

{
  const older = {
    ...productionLaneFixture().deployRun,
    id: 8000,
    created_at: "2026-08-23T20:00:00Z",
  };
  const newer = {
    ...productionLaneFixture().deployRun,
    id: 8002,
    created_at: "2026-08-23T20:05:00Z",
    status: "in_progress",
    conclusion: null,
  };
  const jobReads = [];
  const evidence = await loadProductionSingleFlightEvidence({
    async getRef(branch) {
      return branch === "main" ? { object: { sha: MAIN } } : { object: { sha: BASE } };
    },
    async getDeployWorkflow() { return productionLaneFixture().deployWorkflow; },
    async compare() { return productionLaneFixture().comparison; },
    async listDeployRuns() { return [older, newer]; },
    async getReleaseMarker() { return productionLaneFixture().marker; },
    async getRunJobs(runId) {
      jobReads.push(runId);
      return productionLaneFixture().deployJobs;
    },
  }, prFixture());
  assert.equal(evidence.deployRun.id, 8002, "the newest exact-main attempt owns the lane state");
  assert.deepEqual(jobReads, [8002]);
  assert.equal(
    evaluateProductionSingleFlight(evidence).reasonCode,
    "CURRENT_MAIN_DEPLOYMENT_NOT_COMPLETE",
    "an older success cannot hide a newer incomplete deployment",
  );
}
assert.equal(evaluateAutoMerge(decisionFixture({ pr: { merged: true, state: "closed" } })).reasonCode, "ALREADY_MERGED");
assert.equal(evaluateAutoMerge(decisionFixture({ pr: { state: "closed" } })).reasonCode, "PR_NOT_OPEN_READY");
assert.equal(evaluateAutoMerge(decisionFixture({ pr: { draft: true } })).reasonCode, "PR_NOT_OPEN_READY");
assert.equal(evaluateAutoMerge(decisionFixture({ pr: { baseRef: "feature" } })).reasonCode, "UNSUPPORTED_BASE");
assert.equal(evaluateAutoMerge(decisionFixture({ gateResult: { conclusion: "failure", eligible: false } })).reasonCode, "LIVE_GATE_NOT_PASSING");
assert.equal(evaluateAutoMerge(decisionFixture({ gateResult: { headSha: "d".repeat(40) } })).reasonCode, "GATE_STATE_MISMATCH");
assert.equal(evaluateAutoMerge(decisionFixture({ gateResult: { baseSha: "d".repeat(40) } })).reasonCode, "GATE_STATE_MISMATCH");
assert.equal(evaluateAutoMerge(decisionFixture({
  branchRules: [{
    type: "required_status_checks",
    parameters: { strict_required_status_checks_policy: false, required_status_checks: [{ context: REQUIRED_CONTEXT }] },
  }],
})).reasonCode, "BASE_UPDATE_NOT_SERVER_ENFORCED");
assert.equal(evaluateAutoMerge(decisionFixture({
  branchRules: [{
    type: "required_status_checks",
    parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: [{ context: REQUIRED_CONTEXT }],
    },
  }],
})).reasonCode, "BASE_UPDATE_NOT_SERVER_ENFORCED");
assert.equal(evaluateAutoMerge(decisionFixture({
  branchRules: [{
    type: "required_status_checks",
    parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: [{ context: REQUIRED_CONTEXT, integration_id: 9999 }],
    },
  }],
})).reasonCode, "BASE_UPDATE_NOT_SERVER_ENFORCED");
assert.equal(evaluateAutoMerge(decisionFixture({
  branchRules: [{
    type: "required_status_checks",
    parameters: { strict_required_status_checks_policy: true, required_status_checks: [{ context: "Other" }] },
  }],
})).reasonCode, "BASE_UPDATE_NOT_SERVER_ENFORCED");
assert.equal(evaluateAutoMerge(decisionFixture({ checkRuns: [] })).reasonCode, "MISSING_GATE_CHECK");
assert.equal(
  evaluateAutoMerge(decisionFixture({ commitStatuses: [] })).reasonCode,
  "MISSING_GATE_AUTHORIZATION_STATUS",
);
assert.equal(
  evaluateAutoMerge(decisionFixture({
    commitStatuses: [statusFixture({ creator: { id: 1, login: "momomojo" } })],
  })).reasonCode,
  "GATE_AUTHORIZATION_STATUS_IDENTITY_MISMATCH",
);
assert.equal(
  evaluateAutoMerge(decisionFixture({ commitStatuses: [statusFixture({ state: "pending" })] })).reasonCode,
  "GATE_AUTHORIZATION_STATUS_NOT_SUCCESS",
);
assert.equal(
  evaluateAutoMerge(decisionFixture({
    commitStatuses: [statusFixture({ description: `PASS ${"d".repeat(64)}` })],
  })).reasonCode,
  "GATE_AUTHORIZATION_STATUS_FINGERPRINT_MISMATCH",
);
assert.equal(
  evaluateAutoMerge(decisionFixture({
    commitStatuses: [statusFixture({ target_url: "https://example.org/not-the-gate" })],
  })).reasonCode,
  "GATE_AUTHORIZATION_STATUS_CHECK_LINK_MISMATCH",
);
assert.equal(evaluateAutoMerge(decisionFixture({
  checkRuns: [checkFixture({ app: { id: 9999, slug: "other" } })],
})).reasonCode, "GATE_CHECK_IDENTITY_MISMATCH");
assert.equal(evaluateAutoMerge(decisionFixture({
  checkRuns: [checkFixture({ head_sha: "d".repeat(40) })],
})).reasonCode, "MISSING_GATE_CHECK");
assert.equal(evaluateAutoMerge(decisionFixture({
  checkRuns: [checkFixture({ external_id: "wrong" })],
})).reasonCode, "GATE_CHECK_FINGERPRINT_MISMATCH");

{
  const olderSuccess = checkFixture({ id: 5000, completed_at: "2026-08-23T20:09:00Z" });
  const newerFailure = checkFixture({ id: 5002, conclusion: "failure", completed_at: "2026-08-23T20:11:00Z" });
  assert.equal(evaluateAutoMerge(decisionFixture({ checkRuns: [olderSuccess, newerFailure] })).reasonCode, "GATE_CHECK_NOT_SUCCESS");
  const newestSuccess = checkFixture({ id: 5003, completed_at: "2026-08-23T20:12:00Z" });
  assert.equal(evaluateAutoMerge(decisionFixture({ checkRuns: [newerFailure, newestSuccess] })).ok, true);
}

{
  const olderSuccess = statusFixture({ id: 6000, created_at: "2026-08-23T20:09:00Z" });
  const newerPending = statusFixture({ id: 6002, state: "pending", created_at: "2026-08-23T20:11:00Z" });
  assert.equal(
    evaluateAutoMerge(decisionFixture({ commitStatuses: [olderSuccess, newerPending] })).reasonCode,
    "GATE_AUTHORIZATION_STATUS_NOT_SUCCESS",
  );
  const newestSuccess = statusFixture({ id: 6003, created_at: "2026-08-23T20:12:00Z" });
  assert.equal(evaluateAutoMerge(decisionFixture({ commitStatuses: [newerPending, newestSuccess] })).ok, true);
}

console.log("approval-bound automatic merge tests passed");

{
  const state = {
    pr: prFixture(),
    requiredCi: ["Smoke Tests", "Targeted Calculator Tests"],
    ci: { ok: true, evidence: [] },
    files: [{ filename: "README.md", status: "modified", patch: "@@ -1 +1 @@\n-old\n+new" }],
    reviews: [],
    publicKeys: {},
  };
  const calls = [];
  const statusHeadShas = [];
  const api = {
    ...productionLaneApi(),
    async findPullNumbers() { return [123]; },
    async loadGateState() { return structuredClone(state); },
    async getBranchRules() { return decisionFixture().branchRules; },
    async listCheckRuns() { return [checkFixture()]; },
    async listCommitStatuses(headSha) {
      statusHeadShas.push(headSha);
      return [statusFixture()];
    },
    async merge(number, payload) {
      calls.push({ number, payload });
      return { merged: true, sha: "e".repeat(40), message: "merged" };
    },
    async getMergeability() { return { mergeable: true, mergeable_state: "clean", head: { sha: HEAD } }; },
    async getPr() { return { merged: true, state: "closed", merge_commit_sha: "e".repeat(40) }; },
  };
  const evaluateGateImpl = () => gateFixture();
  const fingerprintImpl = () => "stable";
  const dry = await runAutoMerge({
    env: { RADULATOR_AUTO_MERGE_ENABLED: "false" },
    api,
    evaluateGateImpl,
    fingerprintImpl,
  });
  assert.equal(dry[0].dryRun, true);
  assert.equal(calls.length, 0);

  const live = await runAutoMerge({
    env: { RADULATOR_AUTO_MERGE_ENABLED: "true" },
    api,
    evaluateGateImpl,
    fingerprintImpl,
  });
  assert.equal(live[0].merged, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.sha, HEAD);
  assert.ok(statusHeadShas.length >= 3);
  assert.ok(statusHeadShas.every((headSha) => headSha === HEAD), "every status query must be scoped to the exact current head");
}

{
  const mergeSha = "e".repeat(40);
  const state = {
    pr: prFixture({ baseRef: "main" }),
    requiredCi: ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"],
    ci: { ok: true, evidence: [] },
    files: [{ filename: "README.md", status: "modified", patch: "@@ -1 +1 @@\n-old\n+new" }],
    reviews: [],
    publicKeys: {},
  };
  const deploymentDispatches = [];
  const result = await runAutoMerge({
    env: { RADULATOR_AUTO_MERGE_ENABLED: "true" },
    api: {
      ...productionLaneApi(),
      async findPullNumbers() { return [123]; },
      async loadGateState() { return structuredClone(state); },
      async getBranchRules() { return decisionFixture().branchRules; },
      async listCheckRuns() { return [checkFixture()]; },
      async listCommitStatuses() { return [statusFixture()]; },
      async merge() { return { merged: true, sha: mergeSha }; },
      async getMergeability() { return { mergeable: true, mergeable_state: "clean", head: { sha: HEAD } }; },
      async getPr() { return { merged: true, state: "closed", merge_commit_sha: mergeSha }; },
      async dispatchDeployment(payload) {
        deploymentDispatches.push(payload);
        return { accepted: true, eventType: "radulator-auto-merge-deploy" };
      },
    },
    evaluateGateImpl: () => gateFixture(),
    fingerprintImpl: () => "stable",
  });
  assert.deepEqual(deploymentDispatches, [{ ref: mergeSha, prNumber: 123, sourceHeadSha: HEAD }]);
  assert.equal(result[0].deploymentDispatched, true);
}

{
  const state = { pr: prFixture() };
  let loads = 0;
  let merged = false;
  const result = await runAutoMerge({
    env: { RADULATOR_AUTO_MERGE_ENABLED: "true" },
    api: {
      ...productionLaneApi(),
      async findPullNumbers() { return [123]; },
      async loadGateState() { loads += 1; return structuredClone(state); },
      async getBranchRules() { return decisionFixture().branchRules; },
      async listCheckRuns() { return [checkFixture()]; },
      async listCommitStatuses() { return [statusFixture()]; },
      async merge() { merged = true; return { merged: true, sha: "e".repeat(40) }; },
      async getPr() { return { merged: true, state: "closed", merge_commit_sha: "e".repeat(40) }; },
    },
    evaluateGateImpl: () => gateFixture(),
    fingerprintImpl: () => loads === 1 ? "before" : "after",
  });
  assert.equal(result[0].reasonCode, "CONCURRENT_GATE_STATE_CHANGE");
  assert.equal(merged, false);
}

{
  const state = {
    pr: prFixture(),
    requiredCi: ["Smoke Tests", "Targeted Calculator Tests"],
    ci: { ok: true, evidence: [] },
    files: [{ filename: "README.md", status: "modified", patch: "@@ -1 +1 @@\n-old\n+new" }],
    reviews: [],
    publicKeys: {},
  };
  const updates = [];
  let merged = false;
  const result = await runAutoMerge({
    env: { RADULATOR_AUTO_MERGE_ENABLED: "true" },
    api: {
      ...productionLaneApi(),
      async findPullNumbers() { return [123]; },
      async loadGateState() { return structuredClone(state); },
      async getBranchRules() { return decisionFixture().branchRules; },
      async listCheckRuns() { return [checkFixture()]; },
      async listCommitStatuses() { return [statusFixture()]; },
      async getMergeability() {
        return { mergeable: true, mergeable_state: "behind", head: { sha: HEAD } };
      },
      async updateBranch(number, payload) {
        updates.push({ number, payload });
        return { accepted: true };
      },
      async merge() { merged = true; return { merged: true, sha: "e".repeat(40) }; },
      async getPr() { return { merged: true, state: "closed", merge_commit_sha: "e".repeat(40) }; },
    },
    evaluateGateImpl: () => gateFixture(),
    fingerprintImpl: () => "stable",
  });
  assert.equal(merged, false, "a behind pull request must not attempt a stale-base merge");
  assert.deepEqual(updates, [{ number: 123, payload: { expected_head_sha: HEAD } }]);
  assert.equal(result[0].reasonCode, "BASE_REFRESH_REQUESTED");
  assert.equal(result[0].baseRefreshRequested, true);
}

{
  const state = {
    pr: prFixture(),
    requiredCi: ["Smoke Tests", "Targeted Calculator Tests"],
    ci: { ok: true, evidence: [] },
    files: [{ filename: "README.md", status: "modified", patch: "@@ -1 +1 @@\n-old\n+new" }],
    reviews: [],
    publicKeys: {},
  };
  const updates = [];
  let mergeabilityReads = 0;
  const mergeRefusal = Object.assign(new Error("strict required checks are expected"), { status: 405 });
  const result = await runAutoMerge({
    env: { RADULATOR_AUTO_MERGE_ENABLED: "true" },
    api: {
      ...productionLaneApi(),
      async findPullNumbers() { return [123]; },
      async loadGateState() { return structuredClone(state); },
      async getBranchRules() { return decisionFixture().branchRules; },
      async listCheckRuns() { return [checkFixture()]; },
      async listCommitStatuses() { return [statusFixture()]; },
      async getMergeability() {
        mergeabilityReads += 1;
        return {
          mergeable: true,
          mergeable_state: mergeabilityReads === 1 ? "clean" : "behind",
          head: { sha: HEAD },
        };
      },
      async updateBranch(number, payload) {
        updates.push({ number, payload });
        return { accepted: true };
      },
      async merge() { throw mergeRefusal; },
      async getPr() { throw new Error("merge readback must not run after a refused merge"); },
    },
    evaluateGateImpl: () => gateFixture(),
    fingerprintImpl: () => "stable",
  });
  assert.equal(mergeabilityReads, 2, "a protected merge refusal must re-read authoritative mergeability");
  assert.deepEqual(updates, [{ number: 123, payload: { expected_head_sha: HEAD } }]);
  assert.equal(result[0].reasonCode, "BASE_REFRESH_REQUESTED");
  assert.equal(result[0].mergeRefusalRecovered, true);
}

console.log("automatic merge runtime orchestration tests passed");
