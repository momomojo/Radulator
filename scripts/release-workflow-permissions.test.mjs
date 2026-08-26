#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parse } from "yaml";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

async function workflow(path) {
  return parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

const gate = await workflow("../.github/workflows/independent-review-gate.yml");
const merge = await workflow("../.github/workflows/auto-merge.yml");
const deploy = await workflow("../.github/workflows/deploy.yml");
const rollback = await workflow("../.github/workflows/rollback-deployment.yml");
const e2e = await workflow("../.github/workflows/e2e-tests.yml");

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

assert.deepEqual(
  rollback.on.repository_dispatch?.types,
  ["radulator-live-smoke-rollback-request"],
  "rollback selection must use the explicit dispatch event that GITHUB_TOKEN is allowed to trigger",
);
assert.equal(
  rollback.on.workflow_run,
  undefined,
  "rollback must not rely on a suppressed workflow_run chain from an automated deployment",
);
assert.equal(
  rollback.jobs.rollback.steps.find((step) => step.id === "select").env?.FAILED_RUN_ID,
  "${{ github.event.client_payload.failedRunId }}",
  "untrusted repository-dispatch payload data must enter through the environment rather than shell interpolation",
);
assert.equal(
  rollback.jobs.rollback.steps.find((step) => step.id === "select").run,
  "node scripts/select-rollback-deployment.mjs --failed-run-id \"$FAILED_RUN_ID\" --output rollback-selection.json --dispatch",
  "the rollback handler must treat the request payload only as a run ID and re-read all evidence",
);
assert.equal(deploy.permissions.contents, "read", "the deploy workflow remains read-only by default");
assert.equal(
  deploy.jobs.authorize.outputs.mode,
  "${{ steps.authorize.outputs.mode }}",
  "the trusted deployment authorizer exposes its verified source mode",
);
const rollbackClassification = deploy.jobs.deploy.steps.find((step) => step.id === "rollback-classification");
assert.equal(rollbackClassification.if, "always()");
assert.equal(rollbackClassification.run, "node scripts/rollback-request.mjs");
assert.equal(rollbackClassification.env.DEPLOYMENT_MODE, "${{ needs.authorize.outputs.mode }}");
const requestRollback = deploy.jobs["request-rollback"];
assert.equal(requestRollback.permissions.contents, "write", "only the rollback-request job can emit repository_dispatch");
assert.deepEqual(requestRollback.needs, ["authorize", "deploy"]);
assert.match(requestRollback.if, /needs\.deploy\.outputs\.rollback_required == 'true'/);
assert.match(requestRollback.if, /needs\.authorize\.outputs\.mode != 'verified-rollback'/);
assert.equal(
  requestRollback.steps.at(-1).run,
  "node scripts/select-rollback-deployment.mjs --request --failed-run-id ${{ github.run_id }}",
);

const releaseControlEvidence = e2e.jobs["hermes-release-control-tests"].steps.find(
  (step) => step.name === "Run release-control, intake, and production dependency evidence",
);
assert.match(
  releaseControlEvidence.run,
  /npm run test:hermes-install/,
  "the protected exact-head check must execute the installer aggregate",
);
assert.match(
  packageJson.scripts["test:hermes-install"],
  /npm run test:primary-source/,
  "the installer aggregate must retain primary-source evidence",
);
assert.match(
  packageJson.scripts["test:primary-source"],
  /npm run test:kbrc-source/,
  "the exact-head aggregate must execute the KBRC primary-source audit",
);
assert.match(
  packageJson.scripts["test:primary-source"],
  /npm run test:cac-drs-source/,
  "the exact-head aggregate must execute the CAC staging primary-source audit",
);

console.log("release workflow permission contract tests passed");
