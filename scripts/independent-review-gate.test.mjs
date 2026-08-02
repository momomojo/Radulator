#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  deriveStateEpoch,
  evaluateGate,
  gateStateFingerprint,
  RECORD_SCHEMA,
  relevantLabelsDigest,
  REQUIRED_CONTEXT,
  requiredCiForBase,
  resolveRequiredCi,
} from "./independent-review-gate.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const WORKFLOW_ID = 227376261;
const CI_APP_ID = 15368;
const CHECK_SUITE_ID = 700;
const REVIEWER = {
  botLogin: "radulator-independent-review[bot]",
  botUserId: 9001,
  appId: 8001,
  appSlug: "radulator-independent-review",
  installationId: 7001,
  appOwnerId: 6001,
  appOwnerLogin: "independent-review-org",
  system: "independent-security-review/v2",
};
const CLOUD_MERGER = {
  botLogin: "radulator-cloud-merger[bot]",
  botUserId: 9002,
  appId: 8002,
  appSlug: "radulator-cloud-merger",
  installationId: 7002,
  appOwnerId: 6002,
  appOwnerLogin: "cloud-merge-org",
  system: "cloud-merge-routine/v2",
};

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function prFixture(overrides = {}) {
  const labels = overrides.labels || [];
  const labelState = relevantLabelsDigest(labels);
  return {
    repositoryId: 1027532341,
    number: 99,
    state: "open",
    draft: false,
    headSha: HEAD,
    baseSha: BASE,
    baseRef: "develop",
    author: "implementation-worker",
    authorId: 5001,
    authorType: "User",
    createdAt: "2026-07-27T23:20:00Z",
    stateEpoch: { eventId: 42, eventCreatedAt: "2026-07-27T23:21:00Z" },
    labels: labelState.labels,
    labelsDigest: labelState.sha256,
    ...overrides,
    ...(overrides.labels ? { labels: labelState.labels, labelsDigest: labelState.sha256 } : {}),
  };
}

function workflowRun(pr, overrides = {}) {
  return {
    id: 1001,
    workflow_id: WORKFLOW_ID,
    path: ".github/workflows/e2e-tests.yml",
    event: "pull_request",
    head_sha: pr.headSha,
    check_suite_id: CHECK_SUITE_ID,
    run_attempt: 1,
    status: "completed",
    conclusion: "success",
    created_at: "2026-07-27T23:22:00Z",
    pull_requests: [{
      number: pr.number,
      head: { sha: pr.headSha },
      base: { sha: pr.baseSha, ref: pr.baseRef },
    }],
    ...overrides,
  };
}

function checkRun(pr, name, index, overrides = {}) {
  return {
    id: 2000 + index,
    name,
    head_sha: pr.headSha,
    check_suite: { id: CHECK_SUITE_ID },
    app: { id: CI_APP_ID, slug: "github-actions" },
    status: "completed",
    conclusion: "success",
    completed_at: `2026-07-27T23:23:${40 + index}Z`,
    ...overrides,
  };
}

function ciFixture(pr, { workflowRuns, checkRuns } = {}) {
  const requiredCi = requiredCiForBase(pr.baseRef);
  const runs = workflowRuns || [workflowRun(pr)];
  const checks = checkRuns || requiredCi.map((name, index) => checkRun(pr, name, index));
  return {
    requiredCi,
    workflowRuns: runs,
    checkRuns: checks,
    result: resolveRequiredCi({
      pr,
      workflowRuns: runs,
      checkRuns: checks,
      requiredCi,
      expectedWorkflowId: WORKFLOW_ID,
      expectedCiAppId: CI_APP_ID,
    }),
  };
}

function recordPayload(pr, ci, overrides = {}) {
  const payload = {
    schema: RECORD_SCHEMA,
    repository_id: pr.repositoryId,
    pr: pr.number,
    verdict: "PASS",
    head_sha: pr.headSha,
    base_sha: pr.baseSha,
    base_ref: pr.baseRef,
    state_epoch: {
      event_id: pr.stateEpoch.eventId,
      event_created_at: pr.stateEpoch.eventCreatedAt,
    },
    labels_sha256: pr.labelsDigest,
    ci: ci.evidence,
    reviewer: {
      github_app_id: REVIEWER.appId,
      installation_id: REVIEWER.installationId,
      bot_user_id: REVIEWER.botUserId,
      app_owner_id: REVIEWER.appOwnerId,
      run_id: "review-run-123",
      system: REVIEWER.system,
    },
    reviewed_at: "2026-07-27T23:23:55Z",
    ...overrides,
  };
  payload.evidence_sha256 = digest(payload);
  return payload;
}

function reviewComment(pr, ci, overrides = {}) {
  const id = overrides.id || 812;
  const createdAt = overrides.createdAt || "2026-07-27T23:24:00Z";
  const payload = overrides.payload || recordPayload(pr, ci, overrides.record || {});
  return {
    id,
    author: REVIEWER.botLogin,
    authorId: REVIEWER.botUserId,
    authorType: "Bot",
    createdAt,
    updatedAt: overrides.updatedAt || createdAt,
    body: overrides.body || JSON.stringify(payload),
    performedViaGithubApp: {
      id: REVIEWER.appId,
      slug: REVIEWER.appSlug,
      owner: { id: REVIEWER.appOwnerId, login: REVIEWER.appOwnerLogin, type: "Organization" },
    },
    ...overrides.comment,
  };
}

function gateFixture(options = {}) {
  const pr = prFixture(options.pr || {});
  const ciSetup = ciFixture(pr, options.ciSetup);
  const comment = reviewComment(pr, ciSetup.result, options.comment || {});
  const reviews = options.reviews || [comment];
  return {
    pr,
    reviewerIdentity: { ...REVIEWER, ...(options.reviewerIdentity || {}) },
    cloudMergerIdentity: { ...CLOUD_MERGER, ...(options.cloudMergerIdentity || {}) },
    requiredCi: ciSetup.requiredCi,
    ci: options.ci || ciSetup.result,
    reviews,
    trigger: {
      eventName: "issue_comment",
      action: "created",
      commentId: comment.id,
      installationId: REVIEWER.installationId,
      appId: REVIEWER.appId,
      senderId: REVIEWER.botUserId,
      senderLogin: REVIEWER.botLogin,
      ...(options.trigger || {}),
    },
  };
}

function expectBlocked(reasonCode, options = {}) {
  const result = evaluateGate(gateFixture(options));
  assert.equal(result.context, REQUIRED_CONTEXT);
  assert.equal(result.conclusion, "failure");
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, reasonCode);
  return result;
}

// A fully valid exact-state record is only a candidate. Repo-only code cannot
// atomically CAS mutable same-head PR metadata, so success is code-disabled.
{
  const result = evaluateGate(gateFixture());
  assert.equal(result.context, REQUIRED_CONTEXT);
  assert.equal(result.conclusion, "failure");
  assert.equal(result.eligible, true);
  assert.equal(result.reasonCode, "ACTIVATION_BLOCKED");
  assert.match(result.summary, /success publication is code-disabled/);
}

expectBlocked("UNSUPPORTED_BASE", { pr: { baseRef: "feature" } });
expectBlocked("PR_NOT_OPEN_READY", { pr: { state: "closed" } });
expectBlocked("PR_NOT_OPEN_READY", { pr: { draft: true } });
expectBlocked("HOLD_PRESENT", { pr: { labels: ["hold"] } });
expectBlocked("CI_NOT_EXACT_SUCCESS", { ci: { ok: false, summary: "latest run failed", evidence: [] } });
expectBlocked("MISSING_REVIEW", { reviews: [] });

// Review records are append-only. Editing any newest carrier invalidates it.
expectBlocked("MALFORMED_REVIEW", { comment: { updatedAt: "2026-07-27T23:25:00Z" } });

// Same-second newest records are ambiguous even though IDs provide stable
// diagnostics. Do not choose whichever API item happened to arrive first.
{
  const base = gateFixture();
  const second = reviewComment(base.pr, base.ci, { id: 813, createdAt: base.reviews[0].createdAt });
  const result = evaluateGate({ ...base, reviews: [second, base.reviews[0]], trigger: { ...base.trigger, commentId: second.id } });
  assert.equal(result.reasonCode, "AMBIGUOUS_REVIEW");
  assert.equal(result.conclusion, "failure");
}

// A malformed newer trusted carrier blocks instead of falling back to PASS.
{
  const base = gateFixture();
  const malformed = reviewComment(base.pr, base.ci, {
    id: 813,
    createdAt: "2026-07-27T23:25:00Z",
    body: "not-json",
  });
  const result = evaluateGate({ ...base, reviews: [base.reviews[0], malformed], trigger: { ...base.trigger, commentId: malformed.id } });
  assert.equal(result.reasonCode, "MALFORMED_REVIEW");
}

expectBlocked("NEEDS_FIX", { comment: { record: { verdict: "NEEDS_FIX" } } });
expectBlocked("MALFORMED_REVIEW", { trigger: { installationId: 9999 } });
expectBlocked("MALFORMED_REVIEW", { trigger: { appId: 9999 } });
expectBlocked("MALFORMED_REVIEW", { trigger: { action: "edited" } });
expectBlocked("MALFORMED_REVIEW", { comment: { comment: { authorType: "User" } } });
expectBlocked("MALFORMED_REVIEW", { comment: { comment: { performedViaGithubApp: { id: 9999 } } } });

// Numeric App/Bot/installation/owner identities, not display strings alone,
// must establish independence.
expectBlocked("REVIEWER_NOT_INDEPENDENT", { reviewerIdentity: { botLogin: "momomojo", botUserId: 35302851 } });
expectBlocked("REVIEWER_NOT_INDEPENDENT", { reviewerIdentity: { botLogin: "implementation-worker", botUserId: 5001 } });
expectBlocked("REVIEWER_NOT_INDEPENDENT", { cloudMergerIdentity: { appId: REVIEWER.appId } });
expectBlocked("REVIEWER_NOT_INDEPENDENT", { cloudMergerIdentity: { installationId: REVIEWER.installationId } });
expectBlocked("REVIEWER_NOT_INDEPENDENT", { reviewerIdentity: { appId: CI_APP_ID } });

// Relevant label add/remove cycles advance a monotonic epoch even when the
// final label set returns to empty.
{
  const epoch = deriveStateEpoch([
    { id: 100, event: "labeled", created_at: "2026-07-27T23:21:01Z", label: { name: "hold" } },
    { id: 101, event: "unlabeled", created_at: "2026-07-27T23:21:02Z", label: { name: "hold" } },
  ], "2026-07-27T23:20:00Z");
  assert.deepEqual(epoch, { eventId: 101, eventCreatedAt: "2026-07-27T23:21:02Z" });
  assert.throws(
    () => deriveStateEpoch([{ id: null, event: "labeled", created_at: null, label: { name: "hold" } }], "2026-07-27T23:20:00Z"),
    /malformed/
  );
  const before = gateFixture();
  const after = structuredClone(before);
  after.pr.stateEpoch = epoch;
  assert.notEqual(gateStateFingerprint(before), gateStateFingerprint(after));
}

// CI is resolved as one pinned workflow-run unit, not by API overwrite order.
{
  const pr = prFixture();
  const setup = ciFixture(pr);
  assert.equal(setup.result.ok, true);
  const reversed = resolveRequiredCi({
    pr,
    workflowRuns: [...setup.workflowRuns].reverse(),
    checkRuns: [...setup.checkRuns].reverse(),
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
  });
  assert.deepEqual(reversed, setup.result);

  const failedLatest = workflowRun(pr, {
    id: 1002,
    check_suite_id: 701,
    created_at: "2026-07-27T23:26:00Z",
    conclusion: "failure",
  });
  assert.equal(resolveRequiredCi({
    pr,
    workflowRuns: [setup.workflowRuns[0], failedLatest],
    checkRuns: setup.checkRuns,
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
  }).ok, false, "a newer failed run must not be masked by an older success");

  const duplicate = { ...setup.checkRuns[0], id: 2999 };
  assert.match(resolveRequiredCi({
    pr,
    workflowRuns: setup.workflowRuns,
    checkRuns: [...setup.checkRuns, duplicate],
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
  }).summary, /ambiguous/);

  const wrongApp = setup.checkRuns.map((check, index) => index ? check : { ...check, app: { id: 9999, slug: "other" } });
  assert.match(resolveRequiredCi({
    pr,
    workflowRuns: setup.workflowRuns,
    checkRuns: wrongApp,
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
  }).summary, /wrong GitHub App/);

  assert.equal(resolveRequiredCi({
    pr: { ...pr, baseSha: "c".repeat(40) },
    workflowRuns: setup.workflowRuns,
    checkRuns: setup.checkRuns,
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
  }).ok, false);
  assert.equal(resolveRequiredCi({
    pr,
    workflowRuns: setup.workflowRuns,
    checkRuns: setup.checkRuns,
    requiredCi: setup.requiredCi,
    expectedWorkflowId: 9999,
    expectedCiAppId: CI_APP_ID,
  }).ok, false);
}

{
  const mainPr = prFixture({ baseRef: "main" });
  const mainCi = ciFixture(mainPr);
  assert.deepEqual(mainCi.requiredCi, ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"]);
  assert.equal(mainCi.result.ok, true);
}

// Workflow contract: all three E2E jobs explicitly execute the PR source head;
// publisher scope is develop/main and has read-only Actions access.
{
  const e2e = readFileSync(new URL("../.github/workflows/e2e-tests.yml", import.meta.url), "utf8");
  const exactCheckout = "ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}";
  assert.equal(e2e.split(exactCheckout).length - 1, 3);
  assert.match(e2e, /permissions:\n\s{2}contents: read/);
  const gateWorkflow = readFileSync(new URL("../.github/workflows/independent-review-gate.yml", import.meta.url), "utf8");
  assert.match(gateWorkflow, /pull_request_target:\n\s{4}branches: \[develop, main\]/);
  assert.match(gateWorkflow, /actions: read/);
  assert.match(gateWorkflow, /RADULATOR_INDEPENDENT_REVIEW_EVALUATION_ENABLED == 'true'/);
  assert.match(gateWorkflow, /successful required-check publication is deliberately code-disabled/);
}

console.log("independent review exact-head gate tests passed (evaluation-only, fail-closed)");
