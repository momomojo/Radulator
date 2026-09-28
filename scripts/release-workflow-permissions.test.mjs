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
const scopeStep = e2e.jobs["smoke-tests"].steps.find((step) => step.id === "scope");
assert.ok(scopeStep, "Smoke keeps its trust-domain scope step");
assert.match(scopeStep.run, /git show "\$BASE_SHA:scripts\/ci-scope\.mjs"/, "scope rules come from the base commit");
assert.match(scopeStep.run, /git show "\$BASE_SHA:scripts\/release-policy\.mjs"/, "the classifier comes from the base commit");
assert.doesNotMatch(scopeStep.run, /\.\/scripts\/(release-policy|ci-scope)\.mjs/, "the PR head never decides its own scope");
assert.match(scopeStep.run, /clinical=true\\ndeps=true/, "any failure runs every world-state check");
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

// Network source audits run only in "Clinical Source Audits (exact head)". Smoke and Hermes Release
// Control Tests keep the offline evidence and the lane's own unit tests.
const NETWORK_AUDIT_COMMAND =
  /npm run test:(?:[a-z-]+-source|primary-source|source-audits)\b|scripts\/run-source-audits\.mjs|cac-drs-auc-boundary\.test\.mjs|audit-\*-source|audit-(?!fleischner-nlm-pinned-)[a-z0-9-]+-source\.test\.mjs/;
for (const jobId of ["smoke-tests", "hermes-release-control-tests"]) {
  for (const step of e2e.jobs[jobId].steps) {
    assert.doesNotMatch(step.run ?? "", NETWORK_AUDIT_COMMAND, `${jobId} step "${step.name}" must not run a network source audit`);
  }
}
const guardedSelectionTests =
  "if [ -f scripts/select-source-audits.test.mjs ]; then npm run test:source-audit-selection; fi";
for (const [jobId, stepName] of [
  ["smoke-tests", "Run tooling checks"],
  ["hermes-release-control-tests", "Run release-control, intake, and production dependency evidence"],
]) {
  const lines = e2e.jobs[jobId].steps.find((step) => step.name === stepName).run.split("\n").map((line) => line.trim());
  assert.equal(
    lines.filter((line) => line === guardedSelectionTests).length,
    1,
    `${jobId} runs the lane's unit tests exactly once, guarded for heads that predate the lane`,
  );
  assert.equal(lines.filter((line) => line.includes("test:source-audit-selection")).length, 1);
}
const offlineEvidence = e2e.jobs["smoke-tests"].steps.find(
  (step) => step.name === "Verify offline clinical evidence at exact head",
);
assert.equal(offlineEvidence.if, undefined, "deterministic offline evidence runs on every head");
assert.equal(
  offlineEvidence.run.trim(),
  [
    "npm run test:hermes-guideline-registry",
    "node tests/roadmap-guideline-status.test.mjs",
    "# Guarded: some open PR heads predate this offline audit (the old glob loop skipped them too).",
    "if [ -f scripts/audit-fleischner-nlm-pinned-source.test.mjs ]; then node scripts/audit-fleischner-nlm-pinned-source.test.mjs; fi",
    "for test_file in scripts/lib/*.test.mjs; do",
    '  [ -e "$test_file" ] || continue',
    '  node "$test_file"',
    "done",
    "echo \"Network source audits for this head: see job 'Clinical Source Audits (exact head)' in this run.\"",
  ].join("\n"),
  "the exact-head Smoke evidence body must stay deterministic and offline",
);
assert.equal(
  e2e.jobs["smoke-tests"].steps.some((step) => step.name === "Verify roadmap clinical source audits at exact head"),
  false,
  "Smoke no longer loops over the network audits",
);

// The protected source-audit lane.
const sourceAuditManifest = JSON.parse(await readFile(new URL("./source-audit-manifest.json", import.meta.url), "utf8"));
const audits = e2e.jobs["source-audits"];
assert.ok(audits, "the E2E workflow has the protected source-audit job");
assert.equal(audits.name, "Clinical Source Audits (exact head)");
assert.equal(audits.name, sourceAuditManifest.trusted_exact_head_check, "the manifest names the job the judges cite");
assert.equal(audits.if, "github.event_name == 'pull_request' || github.event_name == 'workflow_dispatch'");
assert.equal(audits.permissions, undefined, "the audit job keeps the workflow's read-only token");
assert.ok(Number.isInteger(audits["timeout-minutes"]) && audits["timeout-minutes"] <= 60);
const jobOrder = Object.keys(e2e.jobs);
assert.ok(
  jobOrder.indexOf("source-audits") > jobOrder.indexOf("hermes-release-control-tests"),
  "the lane follows Hermes Release Control Tests, whose workflow slice other contract tests read",
);
for (const [jobId, job] of Object.entries(e2e.jobs)) {
  assert.equal(job["continue-on-error"], undefined, `${jobId} must never continue on error`);
  for (const step of job.steps) {
    assert.equal(step["continue-on-error"], undefined, `${jobId} step "${step.name}" must never continue on error`);
  }
}
const auditCheckout = audits.steps.find((step) => step.name === "Checkout exact PR head");
assert.equal(
  auditCheckout.with.ref,
  "${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}",
  "the lane executes the exact PR head",
);
assert.equal(auditCheckout.with["fetch-depth"], 0, "the selector needs the merge base");
const selectStep = audits.steps.find((step) => step.name === "Select source audits for this exact head");
for (const file of ["select-source-audits.mjs", "run-source-audits.mjs", "source-audit-manifest.json"]) {
  assert.ok(
    selectStep.run.includes(`git show "$BASE_SHA:scripts/${file}"`),
    `${file} is read from the PR's BASE commit`,
  );
}
assert.doesNotMatch(selectStep.run, /node\s+(?:\.\/)?scripts\/select-source-audits\.mjs/, "the PR head never selects its own audits");
assert.match(selectStep.run, /node "\$trusted\/select-source-audits\.mjs" --manifest "\$trusted\/source-audit-manifest\.json"/);
assert.match(selectStep.run, /\{"schema":"radulator-source-audit-selection\/v1","mode":"all"/, "any failure runs every audit");
assert.match(selectStep.run, /rm -f "\$trusted"\/\*/, "partial base copies are never used");
assert.equal(selectStep.env.BASE_SHA, "${{ github.event.pull_request.base.sha }}");
assert.equal(selectStep.env.AUDIT_MODE, "${{ vars.RADULATOR_SOURCE_AUDIT_MODE }}");
const runStep = audits.steps.find((step) => step.name === "Run selected source audits with bounded retries");
assert.equal(runStep.env.NCBI_API_KEY, "${{ secrets.NCBI_API_KEY }}");
assert.match(runStep.run, /^runner="\$RUNNER_TEMP\/source-audit-trusted\/run-source-audits\.mjs"$/m, "the runner comes from the base");
assert.match(
  runStep.run,
  /if \[ ! -s "\$runner" \]; then\n(?:\s*#[^\n]*\n)*\s*runner=scripts\/run-source-audits\.mjs\n\s*fi/,
  "the checked-out runner is only a bootstrap fallback when the base has none",
);
for (const flag of ["--attempts 3", "--backoff-seconds 60,180", "--audit-timeout-seconds 600", "--budget-seconds 3000"]) {
  assert.ok(runStep.run.includes(flag), `the runner is bounded by ${flag}`);
}
const e2eText = await readFile(new URL("../.github/workflows/e2e-tests.yml", import.meta.url), "utf8");
assert.equal((e2eText.match(/secrets\.NCBI_API_KEY/g) ?? []).length, 1, "the NCBI key reaches the runner step only");
assert.equal(e2e.env, undefined, "no workflow-level environment");
const uploadStep = audits.steps.find((step) => step.name === "Upload source-audit evidence");
assert.equal(uploadStep.if, "always()");
assert.equal(uploadStep.with["retention-days"], 90);
assert.match(uploadStep.with.path, /source-audit-results\.json/);

// The nightly drift lane.
const nightly = await workflow("../.github/workflows/source-audit-nightly.yml");
const nightlyText = await readFile(new URL("../.github/workflows/source-audit-nightly.yml", import.meta.url), "utf8");
assert.deepEqual(Object.keys(nightly.on).sort(), ["schedule", "workflow_dispatch"], "the nightly never runs for pull requests");
assert.deepEqual(nightly.on.schedule, [{ cron: "23 9 * * *" }]);
assert.deepEqual(nightly.permissions, { contents: "read" });
const nightlyAudit = nightly.jobs.audit;
assert.equal(nightlyAudit.permissions, undefined, "the job that runs audits cannot write issues");
assert.equal(
  nightlyAudit.steps.find((step) => step.name === "Checkout trusted runner (default branch)").with.ref,
  "${{ github.event.repository.default_branch }}",
);
const nightlyRuns = nightlyAudit.steps.filter((step) => (step.run ?? "").includes("run-source-audits.mjs"));
assert.equal(nightlyRuns.length, 2, "main and develop each get one full run");
for (const step of nightlyRuns) {
  assert.match(step.run, /^node controller\/scripts\/run-source-audits\.mjs --all --manifest controller\/scripts\/source-audit-manifest\.json /);
  assert.equal(step.env.NCBI_API_KEY, "${{ secrets.NCBI_API_KEY }}");
}
assert.equal((nightlyText.match(/secrets\.NCBI_API_KEY/g) ?? []).length, 2, "the NCBI key reaches the two audit steps only");
assert.equal(nightlyAudit.steps.find((step) => step.name === "Upload nightly results").with["retention-days"], 90);
const report = nightly.jobs.report;
assert.equal(report.needs, "audit");
assert.equal(report.if, "${{ !cancelled() }}");
assert.deepEqual(report.permissions, { contents: "read", issues: "write", actions: "read" });
assert.equal(
  report.steps.find((step) => step.name === "Checkout trusted reporter (default branch)").with.ref,
  "${{ github.event.repository.default_branch }}",
);
assert.match(report.steps.at(-1).run, /node scripts\/report-source-audit-drift\.mjs /);
for (const job of Object.values(nightly.jobs)) {
  assert.equal(job["continue-on-error"], undefined);
  for (const step of job.steps) assert.equal(step["continue-on-error"], undefined, `nightly step "${step.name}"`);
}

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
assert.match(
  clinicalJudgeSkill,
  /`Clinical Source Audits \(exact head\)`/,
  "the judge protocol names the job that holds network source-audit evidence",
);
assert.match(clinicalJudgeSkill, /SOURCE-AUDIT SELECTION/, "the judge protocol explains the selection record");
assert.match(clinicalJudgeSkill, /SOURCE-AUDIT RESULT/, "the judge protocol explains the per-audit results");
assert.match(
  clinicalJudgeSkill,
  /that a network source audit covers but that has no selected `PASS` at `headSha` is `NEEDS_FIX`/,
  "a covered clinical change without a selected exact-head audit PASS fails closed",
);

console.log("release workflow permission contract tests passed");
