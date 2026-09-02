#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parse } from "yaml";

const clinicalJudgeSkill = await readFile(
  new URL("../ops/hermes/radulator/skills/radulator-clinical-judge/SKILL.md", import.meta.url),
  "utf8",
);

async function workflow(path) {
  return parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

const gate = await workflow("../.github/workflows/independent-review-gate.yml");
const merge = await workflow("../.github/workflows/auto-merge.yml");
const deploy = await workflow("../.github/workflows/deploy.yml");
const rollback = await workflow("../.github/workflows/rollback-deployment.yml");
const e2e = await workflow("../.github/workflows/e2e-tests.yml");

assert.deepEqual(
  e2e.on.pull_request?.types,
  ["opened", "reopened", "synchronize", "edited"],
  "editing the canonical high-risk marker must launch a fresh exact-head E2E run",
);
const fullSuite = e2e.jobs["full-tests"];
assert.equal(fullSuite.name, "Full Test Suite", "the signed CI context name must stay stable");
assert.equal(
  fullSuite.if,
  "github.event.inputs.full_suite == 'true' || (github.event_name == 'pull_request' && (github.base_ref == 'main' || contains(github.event.pull_request.body, '<!-- radulator-risk: high -->')))",
  "only manual dispatch, main PRs, or the canonical high-risk marker may schedule Full Test Suite",
);
assert.equal(
  fullSuite.steps.find((step) => step.name === "Checkout").with.ref,
  "${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}",
  "Full Test Suite must continue to execute the exact PR source head",
);
assert.equal(
  fullSuite.steps.find((step) => step.name === "Run full test suite").run,
  "npx playwright test --project=chromium",
);
assert.equal(e2e.permissions.contents, "read", "PR-controlled full-suite code keeps a read-only token");

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
  /(?:^|\n)\s*npm run test:hermes-install-core\s*(?:\n|$)/,
  "the protected exact-head check must execute the offline installer aggregate",
);
assert.match(
  releaseControlEvidence.run,
  /(?:^|\n)\s*npm run test:cac-drs-source\s*(?:\n|$)/,
  "the protected exact-head check must execute the CAC primary-source audit",
);
assert.match(
  releaseControlEvidence.run,
  /(?:^|\n)\s*npm run test:bosniak-source\s*(?:\n|$)/,
  "the protected exact-head check must execute the Bosniak primary-source audit",
);
const sourceAuditEvidence = e2e.jobs["smoke-tests"].steps.find(
  (step) => step.name === "Verify roadmap clinical source audits at exact head",
);
const expectedSourceAuditBody = [
  "export LC_ALL=C",
  "for audit in scripts/audit-*-source.test.mjs; do",
  '  test -f "$audit"',
  '  if [ "$audit" = "scripts/audit-bosniak-primary-source.test.mjs" ]; then',
  "    # Bosniak runs only in the protected exact-head lane to avoid duplicate live-source fetches.",
  "    continue",
  "  fi",
  '  node "$audit"',
  "done",
  "npm run test:cac-drs-source",
  "npm run test:hermes-guideline-registry",
  "node tests/roadmap-guideline-status.test.mjs",
].join("\n");
assert.equal(
  sourceAuditEvidence.run.trim(),
  expectedSourceAuditBody,
  "the exact-head Smoke source-audit body must remain deterministic and fail closed",
);
assert.equal(
  (sourceAuditEvidence.run.match(/audit-bosniak-primary-source\.test\.mjs/g) ?? []).length,
  1,
  "Smoke must name the Bosniak audit exactly once as the protected-lane exclusion",
);
assert.doesNotMatch(
  sourceAuditEvidence.run,
  /^\s*(?:node\s+.*audit-bosniak-primary-source\.test\.mjs|npm run\s+test:bosniak-source)\s*$/m,
  "Smoke must not invoke the Bosniak live audit a second time",
);
assert.match(
  clinicalJudgeSkill,
  /Never run a candidate-declared source-audit command from the judge checkout/,
  "the judge must not execute candidate commands from a stale checkout",
);
assert.match(
  clinicalJudgeSkill,
  /hardcoded claim flags are not source evidence/i,
  "the judge protocol must reject hardcoded claim booleans as source evidence",
);
assert.match(
  clinicalJudgeSkill,
  /extracts the cited source text from the verified bytes with a pinned parser/i,
  "the judge protocol must require deterministic source-text extraction",
);
assert.match(
  clinicalJudgeSkill,
  /trusted exact-head CI check ran that audit/i,
  "the judge protocol must bind deterministic audit execution to trusted exact-head CI",
);

console.log("release workflow permission contract tests passed");
