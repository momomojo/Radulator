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
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

assert.deepEqual(
  e2e.on.pull_request?.types,
  ["opened", "reopened", "synchronize", "edited"],
  "editing the canonical high-risk marker must launch a fresh exact-head E2E run",
);
const fullSuite = e2e.jobs["full-tests"];
const smoke = e2e.jobs["smoke-tests"];
const releaseControl = e2e.jobs["hermes-release-control-tests"];
const smokeCheckout = smoke.steps.find((step) => step.name === "Checkout");
const releaseControlCheckout = releaseControl.steps.find((step) => step.name === "Checkout exact PR head");
const releaseControlEvidence = releaseControl.steps.find(
  (step) => step.name === "Run release-control, intake, and production dependency evidence",
);
assert.equal(releaseControl.if, undefined, "Hermes Release Control Tests must also run on push and manual dispatch");
assert.equal(
  releaseControlCheckout.with.ref,
  smokeCheckout.with.ref,
  "push/manual control runs must use the same exact-head checkout expression as Smoke",
);
assert.deepEqual(
  smoke.needs,
  ["hermes-release-control-tests"],
  "Smoke must wait for the protected release-control job",
);
assert.equal(smoke.if, "always()", "Smoke must run its dependency guard even when control is skipped or cancelled");
const dependencyGuard = smoke.steps[0];
assert.match(
  dependencyGuard.if,
  /needs\.hermes-release-control-tests\.result\s*!=\s*'success'/,
  "Smoke's first step must fail closed on every non-success control result",
);
assert.match(dependencyGuard.run, /exit 1/, "Smoke's dependency guard must fail explicitly");
assert.equal(smoke["continue-on-error"], undefined, "Smoke must not mask a failed dependency guard");
assert.equal(releaseControl["continue-on-error"], undefined, "release-control must remain fail closed");
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
assert.equal(smoke.name, "Smoke Tests", "the Smoke check name must stay stable");
assert.equal(releaseControl.name, "Hermes Release Control Tests", "the release-control check name must stay stable");
assert.equal(e2e.jobs["targeted-tests"].name, "Targeted Calculator Tests", "the targeted check name must stay stable");
assert.equal(smoke.steps.find((step) => step.name === "Run tooling checks"), undefined, "Smoke must not duplicate release tooling");
assert.equal(
  smoke.steps.find((step) => step.name === "Verify Hermes release-control suites in Smoke evidence"),
  undefined,
  "Smoke must not duplicate Hermes control suites",
);

const controlRun = releaseControlEvidence.run;
const controlCommandLines = [
  "npm audit --omit=dev --audit-level=high",
  "node --check scripts/capture-feature-proof.mjs",
  "node --check scripts/check-radulator-invariants.mjs",
  "node --check scripts/check-radulator-invariants.test.mjs",
  "node --check scripts/collect-loop-metrics.mjs",
  "node --check scripts/independent-review-gate.mjs",
  "node --check scripts/release-workflow-permissions.test.mjs",
  "node --check scripts/release-policy.mjs",
  "node --check scripts/auto-merge.mjs",
  "node --check scripts/authorize-deployment.mjs",
  "node --check scripts/deployment-run-identity.mjs",
  "node --check scripts/reconcile-deployment.mjs",
  "node --check scripts/post-deploy-smoke.mjs",
  "node --check scripts/write-release-marker.mjs",
  "node --check scripts/rollback-request.mjs",
  "node --check scripts/select-rollback-deployment.mjs",
  "node --check ops/hermes/radulator/judge-candidates.mjs",
  "node --check ops/hermes/radulator/judge-attest.mjs",
  "node --check scripts/search-verification-meta.mjs",
  "node --check scripts/ping-search-indexes.mjs",
  "python3 -m py_compile \\",
  "bash -n scripts/dev-local.sh",
  "npm run test:search-verification",
  "npm run test:calculator-helper",
  "npm run test:invariants",
  "npm run test:release-policy",
  "npm run test:independent-review-gate",
  "npm run test:auto-merge",
  "npm run test:release-workflow-permissions",
  "npm run test:authorize-deployment",
  "npm run test:reconcile-deployment",
  "npm run test:post-deploy-smoke",
  "npm run test:release-marker",
  "npm run test:rollback-deployment",
  "npm run test:hermes-judge-candidates",
  "npm run test:hermes-judge-attest",
  "npm run test:hermes-lifecycle",
  "npm run test:hermes-learning",
  "npm run test:hermes-feedback-intake",
  "npm run test:hermes-seed-convert",
  "npm run test:hermes-install-core",
  "npm run check:invariants",
];
for (const command of controlCommandLines) {
  assert.equal(
    controlRun.split(/\r?\n/).filter((line) => line.trim() === command).length,
    1,
    `release-control must own ${command} exactly once`,
  );
}
for (const source of [
  "ops/hermes/radulator/lifecycle_controller.py",
  "ops/hermes/radulator/learning_context.py",
  "ops/hermes/radulator/formspree_feedback_intake.py",
  "ops/hermes/radulator/seed_convert_gate_dedupe.py",
  "ops/hermes/radulator/install.py",
]) {
  assert.equal((controlRun.match(new RegExp(source.replaceAll(".", "\\."), "g")) ?? []).length, 1, `${source} must remain in control exactly once`);
}
assert.equal(
  (controlRun.match(/npm run test:bosniak-source/g) ?? []).length,
  1,
  "the protected release-control job must run Bosniak exactly once",
);
assert.doesNotMatch(controlRun, /^\s*npm run test:cac-drs-source\s*$/m, "Smoke owns the CAC source audit");
assert.doesNotMatch(controlRun, /^\s*npm run test:hermes-guideline-registry\s*$/m, "Smoke owns the guideline registry audit");
assert.equal(
  (e2e.jobs["smoke-tests"].steps.flatMap((step) => step.run || []).join("\n").match(/npm run test:cac-drs-source/g) ?? []).length,
  1,
  "CAC source audit must remain owned by Smoke exactly once",
);
assert.equal(
  (e2e.jobs["smoke-tests"].steps.flatMap((step) => step.run || []).join("\n").match(/npm run test:hermes-guideline-registry/g) ?? []).length,
  1,
  "guideline registry audit must remain owned by Smoke exactly once",
);

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
const authorizeJob = deploy.jobs.authorize;
const buildJob = deploy.jobs.build;
const deployJob = deploy.jobs.deploy;
const authorizeCheckout = authorizeJob.steps.find((step) => step.name === "Checkout trusted deployment authorizer");
const authorizeCapture = authorizeJob.steps.find((step) => step.id === "capture-controller");
const buildCheckout = buildJob.steps.find((step) => step.name === "Checkout authorized source");
const controllerCheckout = buildJob.steps.find((step) => step.name === "Checkout pinned release controller");
const buildSmoke = buildJob.steps.find((step) => step.id === "build-smoke");
const markerWrite = buildJob.steps.find((step) => step.id === "write-marker");
const markerVerify = buildJob.steps.find((step) => step.id === "verify-marker");
const pagesUploads = buildJob.steps.filter((step) => step.uses === "actions/upload-pages-artifact@v3");
assert.ok(authorizeCapture, "authorize must capture the immutable controller SHA");
assert.ok(buildCheckout, "build must checkout the authorized source");
assert.ok(controllerCheckout, "build must checkout the pinned release controller");
assert.ok(buildSmoke, "build must run the existing smoke spec");
assert.ok(markerWrite, "build must write the release marker");
assert.ok(markerVerify, "build must verify the marker before upload");
assert.equal(pagesUploads.length, 1, "build must upload exactly one Pages artifact");
assert.equal(authorizeCheckout.with.ref, "${{ github.event.repository.default_branch }}");
assert.match(authorizeCapture.run, /git rev-parse HEAD/);
assert.match(authorizeCapture.run, /controller_sha=/);
for (const [name, expected] of Object.entries({
  ref: "${{ steps.authorize.outputs.ref }}",
  source_tree_sha: "${{ steps.authorize.outputs.source_tree_sha }}",
  reviewed_head_sha: "${{ steps.authorize.outputs.reviewed_head_sha }}",
  mode: "${{ steps.authorize.outputs.mode }}",
  controller_sha: "${{ steps.capture-controller.outputs.controller_sha }}",
})) {
  assert.equal(authorizeJob.outputs[name], expected, `authorize must expose ${name}`);
}
assert.equal(buildCheckout.with.ref, "${{ needs.authorize.outputs.ref }}");
assert.equal(controllerCheckout.with.ref, "${{ needs.authorize.outputs.controller_sha }}");
assert.equal(controllerCheckout.with.path, ".radulator-controller");
assert.match(buildSmoke.run, /npx playwright test tests\/e2e\/smoke\.spec\.js --project=chromium/);
assert.equal(buildSmoke.env.CI, true);
assert.doesNotMatch(buildSmoke.run, /npm run test:smoke/);
assert.equal(buildJob.steps.filter((step) => step.name === "Build").length, 1);
assert.equal(buildJob.steps.filter((step) => step.uses === "actions/upload-pages-artifact@v3").length, 1);
assert.equal(buildJob.steps.findIndex((step) => step.id === "build-smoke") > buildJob.steps.findIndex((step) => step.name === "Build"), true);
assert.equal(buildJob.steps.filter((step) => (step.run || "").includes("npm run build")).length, 1);
assert.equal(markerVerify.run.includes("--verify"), true);
assert.ok(buildJob.steps.indexOf(markerVerify) > buildJob.steps.indexOf(buildSmoke));
assert.ok(buildJob.steps.indexOf(markerVerify) < buildJob.steps.indexOf(pagesUploads[0]));
assert.equal(buildJob.steps.indexOf(pagesUploads[0]) - buildJob.steps.indexOf(markerVerify), 1);
assert.match(markerWrite.run, /--source-tree-sha/);
assert.match(markerWrite.run, /--rollback/);
assert.match(markerWrite.run, /--reviewed-head-sha/);
assert.equal(buildJob.outputs.build_run_id, "${{ steps.capture-build-identity.outputs.build_run_id }}");
assert.equal(buildJob.outputs.build_attempt, "${{ steps.capture-build-identity.outputs.build_attempt }}");
assert.equal(buildJob.outputs.artifact_name, "${{ steps.capture-build-identity.outputs.artifact_name }}");
assert.equal(buildJob.outputs.artifact_id, "${{ steps.upload-pages.outputs.artifact_id }}");
assert.equal(buildJob.outputs.payload_digest, "${{ steps.write-marker.outputs.payload_digest }}");
assert.match(pagesUploads[0].with.name, /steps\.capture-build-identity\.outputs\.artifact_name/);
assert.match(
  buildJob.steps.find((step) => step.name === "Upload build smoke evidence").with.name,
  /github\.run_attempt/,
);
assert.equal(packageJson.scripts["test:verify-release-artifact"], "node scripts/verify-release-artifact.test.mjs");

const reauthorize = deployJob.steps.find((step) => step.id === "re-authorize");
const identityGuard = deployJob.steps.find((step) => step.id === "compare-build-identity");
const artifactVerification = deployJob.steps.find((step) => step.id === "verify-artifact");
const artifactReceiptUpload = deployJob.steps.find((step) => step.name === "Upload artifact receipt");
const deployAction = deployJob.steps.find((step) => step.uses === "actions/deploy-pages@v4");
assert.equal(deployJob.needs.join(","), "authorize,build");
assert.equal(deployJob.steps.find((step) => step.name === "Checkout pinned deployment controller").with.ref, "${{ needs.authorize.outputs.controller_sha }}");
assert.equal(reauthorize.run, "node scripts/authorize-deployment.mjs");
assert.equal(reauthorize.env.GITHUB_TOKEN, "${{ github.token }}");
assert.match(identityGuard.run, /SOURCE_TREE_SHA/);
assert.match(identityGuard.run, /REVIEWED_HEAD_SHA/);
assert.match(identityGuard.run, /verified-rollback/);
assert.match(identityGuard.run, /exit 1/);
assert.doesNotMatch(identityGuard.run, /rollback source must remain historical/);
assert.match(artifactVerification.run, /node scripts\/verify-release-artifact\.mjs/);
assert.match(artifactVerification.run, /--build-run-id/);
assert.match(artifactVerification.run, /--build-attempt/);
assert.match(artifactVerification.run, /--artifact-id/);
assert.match(artifactVerification.run, /--artifact-name/);
assert.match(artifactVerification.run, /--payload-digest/);
assert.match(artifactVerification.run, /--source-tree-sha/);
assert.match(artifactVerification.run, /--rollback/);
assert.doesNotMatch(artifactVerification.run, /github\.run_attempt/);
assert.equal(artifactReceiptUpload.if, "always()");
assert.match(artifactReceiptUpload.with.name, /github\.run_attempt/);
assert.equal(deployAction.with.artifact_name, "${{ needs.build.outputs.artifact_name }}");
const liveSmoke = deployJob.steps.find((step) => step.id === "smoke");
assert.match(liveSmoke.run, /--expected-source-tree-sha/);
assert.match(liveSmoke.run, /--expected-payload-digest/);
const smokeEvidence = deployJob.steps.find((step) => step.name === "Upload production smoke evidence");
assert.equal(smokeEvidence.if, "always()");
assert.match(smokeEvidence.with.name, /github\.run_attempt/);
assert.equal(deployJob.steps.filter((step) => step["continue-on-error"] !== undefined).length, 0);
const rollbackClassification = deployJob.steps.find((step) => step.id === "rollback-classification");
assert.equal(rollbackClassification.if, "always()");
assert.equal(rollbackClassification.run, "node scripts/rollback-request.mjs");
assert.equal(rollbackClassification.env.DEPLOYMENT_MODE, "${{ needs.authorize.outputs.mode }}");
const requestRollback = deploy.jobs["request-rollback"];
assert.equal(requestRollback.permissions.contents, "write", "only the rollback-request job can emit repository_dispatch");
assert.deepEqual(requestRollback.needs, ["authorize", "deploy"]);
assert.match(requestRollback.if, /needs\.deploy\.outputs\.rollback_required == 'true'/);
assert.match(requestRollback.if, /needs\.authorize\.outputs\.mode != 'verified-rollback'/);
assert.equal(
  requestRollback.steps.find((step) => step.name === "Checkout pinned rollback requester").with.ref,
  "${{ needs.authorize.outputs.controller_sha }}",
);
assert.equal(
  requestRollback.steps.at(-1).run,
  "node scripts/select-rollback-deployment.mjs --request --failed-run-id ${{ github.run_id }}",
);

assert.match(
  releaseControlEvidence.run,
  /(?:^|\n)\s*npm run test:hermes-install-core\s*(?:\n|$)/,
  "the protected exact-head check must execute the offline installer aggregate",
);
const protectedBosniakCommandLines = releaseControlEvidence.run
  .split(/\r?\n/)
  .filter((line) => line.trim() === "npm run test:bosniak-source");
assert.equal(
  protectedBosniakCommandLines.length,
  1,
  "the protected exact-head check must contain exactly one standalone Bosniak primary-source command",
);
assert.equal(
  (releaseControlEvidence.run.match(/npm run test:bosniak-source/g) ?? []).length,
  1,
  "the protected exact-head check must not duplicate the Bosniak primary-source command",
);
for (const command of [
  "node --check scripts/verify-release-artifact.mjs",
  "npm run test:verify-release-artifact",
]) {
  assert.equal(
    controlRun.split(/\r?\n/).filter((line) => line.trim() === command).length,
    1,
    `release-control must own ${command} exactly once`,
  );
}
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
