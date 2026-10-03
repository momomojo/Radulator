#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";

import * as independentGate from "./independent-review-gate.mjs";

import {
  ATTESTATION_MARKER,
  checkCompletionPayload,
  checkRunsPath,
  deriveStateEpoch,
  evaluateGate,
  gateStateFingerprint,
  relevantLabelsDigest,
  REQUIRED_CONTEXT,
  requiredCiForBase,
  resolveRequiredCi,
} from "./independent-review-gate.mjs";
import {
  ATTESTATION_SCHEMA,
  canonicalJson,
  classifyRisk,
  digest,
} from "./release-policy.mjs";
import {
  GATE_CHECK_CONTEXT,
  gatePassFingerprint,
  PROMOTION_CHAIN_SCHEMA,
  STATE_EPOCH_EVENTS,
  STATE_EPOCH_LABELS,
  stateEpochAt,
  unavailablePromotionChain,
} from "./promotion-chain.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const WORKFLOW_ID = 227376261;
const CI_APP_ID = 15368;
const CHECK_SUITE_ID = 700;
const E2E_WORKFLOW_NAME = "E2E Tests";
const REPOSITORY = "momomojo/Radulator";

assert.deepEqual(
  relevantLabelsDigest(["ready-for-gate", "release-remediation", "unrelated"]).labels,
  ["ready-for-gate", "release-remediation"],
  "the single-flight remediation exception must be bound into the gate fingerprint",
);

assert.equal(
  typeof independentGate.authorizationStatusPayload,
  "function",
  "the gate must expose a suite-independent authorization status payload",
);
assert.equal(
  typeof independentGate.pendingAuthorizationStatusPayload,
  "function",
  "the gate must revoke an earlier authorization before re-evaluating the same head",
);
assert.equal(
  typeof independentGate.publishAuthorizationStatus,
  "function",
  "the gate must publish and authoritatively read back its suite-independent status",
);
assert.equal(
  typeof independentGate.runGateForPullRequest,
  "function",
  "the exact-head publication lifecycle must be directly regression-testable",
);
assert.equal(
  typeof independentGate.requiredCiForPullRequest,
  "function",
  "the trusted gate must derive CI requirements from the current PR and complete changed-file evidence",
);
assert.equal(
  typeof independentGate.attemptJobsPath,
  "function",
  "the gate must expose its attempt-scoped workflow-jobs API boundary",
);

function keyFixture(keyId, role, profile) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    keyId,
    role,
    profile,
    privateKey,
    publicKey: publicKey.export({ type: "spki", format: "pem" }),
  };
}

const PRIMARY = keyFixture("primary-2026-08", "primary", "radulator");
const VERIFICATION = keyFixture("verification-2026-08", "verification", "default");
const PUBLIC_KEYS = {
  [PRIMARY.keyId]: { role: PRIMARY.role, profile: PRIMARY.profile, publicKey: PRIMARY.publicKey },
  [VERIFICATION.keyId]: { role: VERIFICATION.role, profile: VERIFICATION.profile, publicKey: VERIFICATION.publicKey },
};

const STANDARD_FILES = [{
  filename: "src/components/calculators/FeedbackForm.jsx",
  status: "modified",
  patch: "@@ -1 +1 @@\n-old label\n+clearer feedback label",
}];
const HIGH_FILES = [{
  filename: "src/components/calculators/MELDNa.jsx",
  status: "modified",
  patch: "@@ -10 +10 @@\n-const score = 1\n+const score = 2",
}];

function prFixture(overrides = {}) {
  const labels = overrides.labels || ["ready-for-gate"];
  const labelState = relevantLabelsDigest(labels);
  return {
    repositoryId: 1027532341,
    repositoryFullName: REPOSITORY,
    number: 99,
    changedFiles: 1,
    state: "open",
    draft: false,
    headSha: HEAD,
    baseSha: BASE,
    baseRef: "develop",
    author: "implementation-worker",
    authorId: 5001,
    authorType: "User",
    createdAt: "2026-08-23T19:50:00Z",
    stateEpoch: { eventId: 42, eventCreatedAt: "2026-08-23T19:55:00Z" },
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
    name: E2E_WORKFLOW_NAME,
    path: ".github/workflows/e2e-tests.yml",
    event: "pull_request",
    head_sha: pr.headSha,
    check_suite_id: CHECK_SUITE_ID,
    run_attempt: 1,
    status: "completed",
    conclusion: "success",
    created_at: "2026-08-23T19:56:00Z",
    pull_requests: [{
      number: pr.number,
      head: { sha: pr.headSha },
      base: { sha: pr.baseSha, ref: pr.baseRef },
    }],
    ...overrides,
  };
}

function workflowJob(pr, name, index, overrides = {}) {
  return {
    id: 2000 + index,
    name,
    run_id: 1001,
    run_attempt: 1,
    head_sha: pr.headSha,
    workflow_name: E2E_WORKFLOW_NAME,
    status: "completed",
    conclusion: "success",
    check_run_url: `https://api.github.com/repos/momomojo/Radulator/check-runs/${2000 + index}`,
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
    completed_at: `2026-08-23T20:00:${10 + index}Z`,
    ...overrides,
  };
}

function ciFixture(pr, files = STANDARD_FILES, { workflowRuns, checkRuns, attemptJobs } = {}) {
  const requiredCi = typeof independentGate.requiredCiForPullRequest === "function"
    ? independentGate.requiredCiForPullRequest(pr, files)
    : requiredCiForBase(pr.baseRef);
  const runs = workflowRuns || [workflowRun(pr)];
  const checks = checkRuns || requiredCi.map((name, index) => checkRun(pr, name, index));
  const jobs = attemptJobs || requiredCi.map((name, index) => workflowJob(pr, name, index));
  return {
    requiredCi,
    workflowRuns: runs,
    checkRuns: checks,
    attemptJobs: jobs,
    result: resolveRequiredCi({
      pr,
      workflowRuns: runs,
      checkRuns: checks,
      attemptJobs: jobs,
      requiredCi,
      expectedWorkflowId: WORKFLOW_ID,
      expectedCiAppId: CI_APP_ID,
      expectedRepositoryFullName: REPOSITORY,
    }),
  };
}

function exactState(pr, ci, files) {
  const risk = classifyRisk(files, pr);
  return {
    repositoryId: pr.repositoryId,
    pr: pr.number,
    headSha: pr.headSha,
    baseSha: pr.baseSha,
    baseRef: pr.baseRef,
    stateEpoch: { event_id: pr.stateEpoch.eventId, event_created_at: pr.stateEpoch.eventCreatedAt },
    labelsSha256: pr.labelsDigest,
    risk,
    ci: ci.evidence,
    ciSha256: digest(ci.evidence),
  };
}

function signedRecord(key, state, overrides = {}) {
  const record = {
    schema: ATTESTATION_SCHEMA,
    repository_id: state.repositoryId,
    pr: state.pr,
    head_sha: state.headSha,
    base_sha: state.baseSha,
    base_ref: state.baseRef,
    state_epoch: state.stateEpoch,
    labels_sha256: state.labelsSha256,
    risk: state.risk,
    ci: state.ci,
    ci_sha256: state.ciSha256,
    verdict: "PASS",
    clinical_analysis: "Exact diff, citations, and regression evidence support release.",
    citations: ["https://example.org/source"],
    judge: {
      key_id: key.keyId,
      role: key.role,
      profile: key.profile,
      model: "gpt-5.6-sol",
      provider: "openai-codex",
    },
    reviewed_at: "2026-08-23T20:01:00Z",
    ...overrides,
  };
  record.signature = sign(null, Buffer.from(canonicalJson(record)), key.privateKey).toString("base64");
  return record;
}

function carrier(record, id = 812, overrides = {}) {
  return {
    id,
    author: "judge-carrier",
    authorId: 9001,
    authorType: "User",
    createdAt: record.reviewed_at,
    updatedAt: record.reviewed_at,
    body: `${ATTESTATION_MARKER}\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\``,
    performedViaGithubApp: null,
    ...overrides,
  };
}

function gateFixture(options = {}) {
  const pr = prFixture(options.pr || {});
  const files = options.files || STANDARD_FILES;
  const ciSetup = ciFixture(pr, files, options.ciSetup || {});
  const state = exactState(pr, ciSetup.result, files);
  const primary = signedRecord(PRIMARY, state, options.primaryRecord || {});
  return {
    pr,
    requiredCi: ciSetup.requiredCi,
    ci: options.ci || ciSetup.result,
    files,
    reviews: options.reviews || [carrier(primary)],
    publicKeys: options.publicKeys || PUBLIC_KEYS,
  };
}

const TARGET = { html_url: "https://github.com/momomojo/Radulator/runs/5001" };

function expectBlocked(reasonCode, options = {}) {
  const result = evaluateGate(gateFixture(options));
  assert.equal(result.context, REQUIRED_CONTEXT);
  assert.equal(result.conclusion, "failure");
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, reasonCode);
  assert.equal(checkCompletionPayload(result).output.title, "Clinical release gate blocked");
  assert.equal(independentGate.authorizationStatusPayload(result, TARGET).state, "failure");
  return result;
}

// Parked or in-flight states: a neutral check and a pending required authorization, so the PR still
// cannot merge (the ruleset needs Authorization to be success) but is not reported as failing.
function expectWaiting(reasonCode, options = {}) {
  const result = evaluateGate(gateFixture(options));
  assert.equal(result.context, REQUIRED_CONTEXT);
  assert.equal(result.conclusion, "neutral");
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, reasonCode);
  const check = checkCompletionPayload(result);
  assert.equal(check.conclusion, "neutral");
  assert.equal(check.output.title, "Clinical release gate waiting");
  assert.equal(JSON.parse(check.output.text).eligible, false);
  const authorization = independentGate.authorizationStatusPayload(result, TARGET);
  assert.equal(authorization.state, "pending", `${reasonCode} must never publish a success authorization`);
  assert.equal(authorization.description, `${reasonCode} ${result.fingerprint}`);
  return result;
}

{
  const payload = {
    state: "success",
    context: "Radulator Clinical Release Authorization",
    description: `PASS ${"f".repeat(64)}`,
    target_url: "https://github.com/momomojo/Radulator/runs/5001",
  };
  const created = {
    id: 7001,
    ...payload,
    creator: { id: 41898282, login: "github-actions[bot]" },
  };
  const calls = [];
  const readback = await independentGate.publishAuthorizationStatus(
    "token",
    "momomojo",
    "Radulator",
    HEAD,
    payload,
    {
      async request(token, path, options) {
        calls.push({ token, path, options });
        return created;
      },
      async list(token, path) {
        calls.push({ token, path });
        return [created];
      },
    },
  );
  assert.ok(readback, "status readback must be returned");
  assert.equal(readback.id, 7001);
  assert.equal(calls[0].path, `/repos/momomojo/Radulator/statuses/${HEAD}`);
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
  assert.equal(calls[1].path, `/repos/momomojo/Radulator/commits/${HEAD}/statuses`);
}

{
  const payload = {
    state: "success",
    context: "Radulator Clinical Release Authorization",
    description: `PASS ${"f".repeat(64)}`,
    target_url: "https://github.com/momomojo/Radulator/runs/5001",
  };
  const created = {
    id: 7002,
    ...payload,
    creator: { id: 1, login: "untrusted-bot" },
  };
  await assert.rejects(
    independentGate.publishAuthorizationStatus(
      "token",
      "momomojo",
      "Radulator",
      HEAD,
      payload,
      {
        async request() { return created; },
        async list() { return [created]; },
      },
    ),
    /failed exact readback verification/,
    "a status whose readback source is not GitHub Actions must fail closed",
  );
}

{
  const nextHead = "d".repeat(40);
  const states = [
    { pr: { headSha: HEAD, baseSha: BASE }, snapshot: "stable" },
    { pr: { headSha: HEAD, baseSha: BASE }, snapshot: "stable" },
    { pr: { headSha: nextHead, baseSha: BASE }, snapshot: "changed" },
  ];
  const log = [];
  let checkId = 8000;
  const outcome = await independentGate.runGateForPullRequest({
    prNumber: 99,
    initial: { headSha: HEAD, baseSha: BASE },
    runId: "45001",
    runUrl: "https://github.com/momomojo/Radulator/actions/runs/45001",
    dryRun: false,
    api: {
      async loadState() { return structuredClone(states.shift()); },
      async publishStatus(headSha, payload) {
        log.push({ operation: "status", headSha, state: payload.state, description: payload.description });
      },
      async createCheck(headSha) {
        checkId += 1;
        log.push({ operation: "create-check", headSha });
        return { id: checkId, head_sha: headSha, html_url: `https://github.com/momomojo/Radulator/runs/${checkId}` };
      },
      async completeAndVerify(check, result) {
        log.push({ operation: "complete-check", headSha: check.head_sha, conclusion: result.conclusion, reasonCode: result.reasonCode });
        return check;
      },
    },
    evaluateGateImpl: () => ({
      conclusion: "success",
      eligible: true,
      reasonCode: "PASS",
      headSha: HEAD,
      baseSha: BASE,
      fingerprint: "f".repeat(64),
    }),
    fingerprintImpl: (state) => state.snapshot,
  });
  assert.ok(outcome, "publication lifecycle must return its terminal result");
  assert.equal(outcome.result.reasonCode, "POST_PUBLISH_STATE_CHANGE");
  assert.equal(outcome.result.headSha, nextHead);
  assert.deepEqual(
    log.map(({ operation, headSha, state, conclusion, reasonCode }) => ({ operation, headSha, state, conclusion, reasonCode })),
    [
      { operation: "status", headSha: HEAD, state: "pending", conclusion: undefined, reasonCode: undefined },
      { operation: "create-check", headSha: HEAD, state: undefined, conclusion: undefined, reasonCode: undefined },
      { operation: "complete-check", headSha: HEAD, state: undefined, conclusion: "success", reasonCode: "PASS" },
      { operation: "status", headSha: HEAD, state: "success", conclusion: undefined, reasonCode: undefined },
      { operation: "complete-check", headSha: HEAD, state: undefined, conclusion: "failure", reasonCode: "POST_PUBLISH_STATE_CHANGE" },
      { operation: "status", headSha: HEAD, state: "failure", conclusion: undefined, reasonCode: undefined },
      { operation: "status", headSha: nextHead, state: "pending", conclusion: undefined, reasonCode: undefined },
      { operation: "create-check", headSha: nextHead, state: undefined, conclusion: undefined, reasonCode: undefined },
      { operation: "complete-check", headSha: nextHead, state: undefined, conclusion: "failure", reasonCode: "POST_PUBLISH_STATE_CHANGE" },
      { operation: "status", headSha: nextHead, state: "failure", conclusion: undefined, reasonCode: undefined },
    ],
  );
}

{
  const nextHead = "e".repeat(40);
  const states = [
    { pr: { headSha: HEAD, baseSha: BASE }, snapshot: "stable" },
    { pr: { headSha: HEAD, baseSha: BASE }, snapshot: "stable" },
    { pr: { headSha: nextHead, baseSha: BASE }, snapshot: "changed" },
  ];
  const log = [];
  let checkId = 8100;
  let injected = false;
  const outcome = await independentGate.runGateForPullRequest({
    prNumber: 99,
    initial: { headSha: HEAD, baseSha: BASE },
    runId: "45002",
    runUrl: "https://github.com/momomojo/Radulator/actions/runs/45002",
    dryRun: false,
    api: {
      async loadState() { return structuredClone(states.shift()); },
      async publishStatus(headSha, payload) {
        log.push({ operation: "status", headSha, state: payload.state, description: payload.description });
        if (headSha === nextHead && payload.state === "failure" && !injected) {
          injected = true;
          throw new Error("injected current-head terminal status failure");
        }
      },
      async createCheck(headSha) {
        checkId += 1;
        log.push({ operation: "create-check", headSha });
        return { id: checkId, head_sha: headSha, html_url: `https://github.com/momomojo/Radulator/runs/${checkId}` };
      },
      async completeAndVerify(check, result) {
        log.push({ operation: "complete-check", headSha: check.head_sha, conclusion: result.conclusion, reasonCode: result.reasonCode });
        return check;
      },
    },
    evaluateGateImpl: () => ({
      conclusion: "success",
      eligible: true,
      reasonCode: "PASS",
      headSha: HEAD,
      baseSha: BASE,
      fingerprint: "f".repeat(64),
    }),
    fingerprintImpl: (state) => state.snapshot,
  });
  assert.match(outcome.error.message, /injected current-head terminal status failure/);
  assert.equal(outcome.publicationError, null);
  assert.equal(outcome.result.reasonCode, "EVALUATION_ERROR");
  assert.equal(outcome.result.headSha, nextHead, "catch publication must stay bound to the current head");
  assert.ok(
    log.some((entry) => entry.operation === "complete-check" && entry.headSha === nextHead && entry.reasonCode === "EVALUATION_ERROR"),
    "the current-head check must be terminally failed after a transient publication error",
  );
  assert.ok(
    log.some((entry) => entry.operation === "status" && entry.headSha === nextHead && entry.description.startsWith("EVALUATION_ERROR ")),
    "the current-head failure status must be retried and published",
  );
  assert.equal(
    log.some((entry) => entry.operation === "complete-check" && entry.headSha === HEAD && entry.reasonCode === "EVALUATION_ERROR"),
    false,
    "the catch path must never write its evaluation error back to the stale head",
  );
}

{
  const result = evaluateGate(gateFixture());
  assert.equal(result.context, REQUIRED_CONTEXT);
  assert.equal(result.conclusion, "success");
  assert.equal(result.eligible, true);
  assert.equal(result.reasonCode, "PASS");
  assert.equal(result.risk.tier, "standard");
  assert.deepEqual(result.judgeRoles, ["primary"]);
  const update = checkCompletionPayload(result);
  assert.equal(update.conclusion, "success");
  assert.equal(update.output.title, "Clinical release gate passed");
  const authorization = independentGate.authorizationStatusPayload(result, {
    html_url: "https://github.com/momomojo/Radulator/runs/5001",
  });
  assert.deepEqual(authorization, {
    state: "success",
    context: "Radulator Clinical Release Authorization",
    description: `PASS ${result.fingerprint}`,
    target_url: "https://github.com/momomojo/Radulator/runs/5001",
  });
  assert.deepEqual(
    independentGate.pendingAuthorizationStatusPayload(
      "https://github.com/momomojo/Radulator/actions/runs/45001",
      99,
      "45001",
    ),
    {
      state: "pending",
      context: "Radulator Clinical Release Authorization",
      description: "Evaluating exact state for PR #99 in run 45001",
      target_url: "https://github.com/momomojo/Radulator/actions/runs/45001",
    },
  );
}

{
  const base = gateFixture({ files: HIGH_FILES });
  assert.equal(evaluateGate(base).reasonCode, "MISSING_JUDGE_ROLE");
  const state = exactState(base.pr, base.ci, base.files);
  const primary = signedRecord(PRIMARY, state);
  const verification = signedRecord(VERIFICATION, state, { reviewed_at: "2026-08-23T20:01:30Z" });
  const result = evaluateGate({ ...base, reviews: [carrier(primary), carrier(verification, 813)] });
  assert.equal(result.conclusion, "success");
  assert.equal(result.risk.tier, "high");
  assert.deepEqual(result.judgeRoles, ["primary", "verification"]);
}

{
  const files = [
    ...HIGH_FILES,
    {
      filename: ".github/workflows/e2e-tests.yml",
      status: "modified",
      patch: "@@ -1 +1 @@\n-npx playwright test\n+echo skipped",
    },
  ];
  const base = gateFixture({ pr: { changedFiles: files.length }, files });
  const state = exactState(base.pr, base.ci, base.files);
  const primary = signedRecord(PRIMARY, state);
  const verification = signedRecord(VERIFICATION, state, { reviewed_at: "2026-08-23T20:01:30Z" });
  assert.equal(
    evaluateGate({ ...base, reviews: [carrier(primary), carrier(verification, 813)] }).reasonCode,
    "MIXED_TRUST_DOMAIN_CHANGE",
    "clinical runtime and release-control changes must be split so the candidate cannot redefine its own evidence",
  );
}

{
  const files = [
    ...HIGH_FILES,
    {
      filename: "ops/hermes/radulator/guideline-registry.test.mjs",
      status: "modified",
      patch: "@@ -1 +1 @@\n-old clinical evidence\n+new clinical evidence",
    },
  ];
  const base = gateFixture({ pr: { changedFiles: files.length }, files });
  const state = exactState(base.pr, base.ci, base.files);
  const primary = signedRecord(PRIMARY, state);
  const verification = signedRecord(VERIFICATION, state, { reviewed_at: "2026-08-23T20:01:30Z" });
  assert.equal(
    evaluateGate({ ...base, reviews: [carrier(primary), carrier(verification, 813)] }).reasonCode,
    "PASS",
    "calculator PRs may carry clinical registry evidence without redefining their release authority",
  );
}

{
  const pr = prFixture();
  const requiredCi = requiredCiForBase(pr.baseRef);
  const run = workflowRun(pr, { run_attempt: 2 });
  const currentChecks = requiredCi.map((name, index) => checkRun(pr, name, index, {
    id: 2500 + index,
    completed_at: `2026-08-23T21:00:${10 + index}Z`,
  }));
  const currentSupplemental = checkRun(pr, "Hermes Release Control Tests", 3, {
    id: 2503,
    completed_at: "2026-08-23T21:00:13Z",
  });
  const priorSupplemental = checkRun(pr, "Hermes Release Control Tests", 8, {
    id: 2598,
    completed_at: "2026-08-23T20:00:18Z",
  });
  const attemptJobs = requiredCi.map((name, index) => workflowJob(pr, name, index, {
    id: 2500 + index,
    run_attempt: 2,
    check_run_url: `https://api.github.com/repos/momomojo/Radulator/check-runs/${2500 + index}`,
  }));
  attemptJobs.push(workflowJob(pr, "Hermes Release Control Tests", 3, {
    id: 2503,
    run_attempt: 2,
    check_run_url: "https://api.github.com/repos/momomojo/Radulator/check-runs/2503",
  }));
  const result = resolveRequiredCi({
    pr,
    workflowRuns: [run],
    checkRuns: [...currentChecks, priorSupplemental, currentSupplemental],
    attemptJobs,
    requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
    expectedRepositoryFullName: REPOSITORY,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.supplementalEvidence.map((item) => item.check_run_id),
    [2503],
    "supplemental evidence must come only from the selected workflow attempt",
  );
}

{
  const pr = prFixture();
  const requiredCi = requiredCiForBase(pr.baseRef);
  const run = workflowRun(pr, { run_attempt: 2 });
  const currentChecks = requiredCi.map((name, index) => checkRun(pr, name, index, {
    id: 2400 + index,
    completed_at: `2026-08-23T21:00:${10 + index}Z`,
  }));
  const attemptJobs = requiredCi.map((name, index) => workflowJob(pr, name, index, {
    id: 2400 + index,
    run_attempt: 2,
    check_run_url: `https://api.github.com/repos/momomojo/Radulator/check-runs/${2400 + index}`,
  }));
  attemptJobs.push(workflowJob(pr, "Smoke Tests", 9, {
    id: 2499,
    run_attempt: 2,
    check_run_url: "https://api.github.com/repos/momomojo/Radulator/check-runs/2499",
  }));
  const result = resolveRequiredCi({
    pr,
    workflowRuns: [run],
    checkRuns: currentChecks,
    attemptJobs,
    requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
    expectedRepositoryFullName: REPOSITORY,
  });
  assert.equal(result.ok, false, "duplicate required job names within the selected attempt must fail closed");
  assert.match(result.summary, /Smoke Tests.*ambiguous/);
}

{
  const pr = prFixture();
  const requiredCi = requiredCiForBase(pr.baseRef);
  const run = workflowRun(pr, { run_attempt: 2 });
  const currentSmoke = checkRun(pr, "Smoke Tests", 0, {
    id: 2300,
    completed_at: "2026-08-23T21:00:10Z",
  });
  const priorTargeted = checkRun(pr, "Targeted Calculator Tests", 1, {
    id: 2301,
    completed_at: "2026-08-23T20:00:11Z",
  });
  const result = resolveRequiredCi({
    pr,
    workflowRuns: [run],
    checkRuns: [currentSmoke, priorTargeted],
    attemptJobs: [workflowJob(pr, "Smoke Tests", 0, {
      id: 2300,
      run_attempt: 2,
      check_run_url: "https://api.github.com/repos/momomojo/Radulator/check-runs/2300",
    })],
    requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
    expectedRepositoryFullName: REPOSITORY,
  });
  assert.equal(result.ok, false, "a rerun attempt must not borrow a prior attempt's successful required check");
  assert.match(result.summary, /Targeted Calculator Tests.*missing/);
}

{
  const pr = prFixture();
  const requiredCi = requiredCiForBase(pr.baseRef);
  const workflowRuns = [workflowRun(pr)];
  const checkRuns = requiredCi.map((name, index) => checkRun(pr, name, index));
  const attemptJobs = requiredCi.map((name, index) => workflowJob(pr, name, index));
  const ci = resolveRequiredCi({
    pr,
    workflowRuns,
    attemptJobs,
    checkRuns,
    requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
    expectedRepositoryFullName: REPOSITORY,
  });
  const state = exactState(pr, ci, HIGH_FILES);
  const primary = signedRecord(PRIMARY, state);
  const verification = signedRecord(VERIFICATION, state, { reviewed_at: "2026-08-23T20:01:30Z" });
  const result = evaluateGate({
    pr,
    requiredCi,
    ci,
    files: HIGH_FILES,
    reviews: [carrier(primary), carrier(verification, 813)],
    publicKeys: PUBLIC_KEYS,
  });
  assert.equal(
    result.reasonCode,
    "CI_POLICY_MISMATCH",
    "high-risk changed files must not pass with a caller-supplied two-check develop policy",
  );
}

expectBlocked("UNSUPPORTED_BASE", { pr: { baseRef: "feature" } });
expectBlocked("PR_NOT_OPEN_READY", { pr: { state: "closed" } });
expectWaiting("PR_NOT_OPEN_READY", { pr: { draft: true } });
expectBlocked("HOLD_PRESENT", { pr: { draft: true, labels: ["ready-for-gate", "hold"] } }); // a hold stays red on a draft
expectBlocked("HOLD_PRESENT", { pr: { draft: true, labels: ["needs-fix"] } });
expectWaiting("PR_NOT_OPEN_READY", { pr: { draft: true, labels: ["ready-for-gate"] } });
expectBlocked("PR_NOT_OPEN_READY", { pr: { state: "closed", draft: true } });
expectWaiting("READY_LABEL_MISSING", { pr: { labels: [] } });
expectBlocked("HOLD_PRESENT", { pr: { labels: ["ready-for-gate", "hold"] } });
expectBlocked("HOLD_PRESENT", { pr: { labels: ["needs-fix"] } }); // a hold stays red without ready-for-gate too
expectBlocked("CI_NOT_EXACT_SUCCESS", { ci: { ok: false, summary: "latest run failed", evidence: [] } });
expectWaiting("CI_NOT_EXACT_SUCCESS", {
  ci: { ok: false, pending: true, summary: "Latest exact-head E2E run 1001 is in_progress/none.", evidence: [] },
});
expectBlocked("CI_NOT_EXACT_SUCCESS", { ci: { ok: false, pending: "true", summary: "not a boolean", evidence: [] } });
expectBlocked("INCOMPLETE_FILE_LIST", { pr: { changedFiles: 2 } });
expectBlocked("INCOMPLETE_FILE_LIST", { pr: { changedFiles: 3001 } });
expectWaiting("MISSING_JUDGE_ROLE", { reviews: [] });

{
  const base = gateFixture();
  const state = exactState(base.pr, base.ci, base.files);
  const changed = signedRecord(PRIMARY, state);
  changed.clinical_analysis = "mutated after signature";
  assert.equal(evaluateGate({ ...base, reviews: [carrier(changed)] }).reasonCode, "MISSING_JUDGE_ROLE");
}

{
  const base = gateFixture();
  const state = exactState(base.pr, base.ci, base.files);
  const pass = signedRecord(PRIMARY, state);
  const needsFix = signedRecord(PRIMARY, state, {
    verdict: "NEEDS_FIX",
    clinical_analysis: "Evidence does not support the clinical wording.",
    reviewed_at: "2026-08-23T20:02:00Z",
  });
  const sentBack = evaluateGate({ ...base, reviews: [carrier(pass), carrier(needsFix, 813)] });
  assert.equal(sentBack.reasonCode, "NEEDS_FIX");
  assert.equal(sentBack.conclusion, "failure", "a NEEDS_FIX verdict stays red: someone has to act on it");
  assert.equal(independentGate.authorizationStatusPayload(sentBack, TARGET).state, "failure");
}

{
  const base = gateFixture();
  const state = exactState(base.pr, base.ci, base.files);
  const stale = signedRecord(PRIMARY, state, { reviewed_at: "2026-08-23T19:59:00Z" });
  const staleResult = evaluateGate({ ...base, reviews: [carrier(stale)] });
  assert.equal(staleResult.reasonCode, "STALE_ATTESTATION");
  assert.equal(staleResult.conclusion, "neutral", "a review older than the current evidence waits for re-review");
  assert.equal(independentGate.authorizationStatusPayload(staleResult, TARGET).state, "pending");
}

{
  const base = gateFixture();
  const unrelated = { ...carrier(signedRecord(PRIMARY, exactState(base.pr, base.ci, base.files))), body: "ordinary PR discussion" };
  assert.equal(evaluateGate({ ...base, reviews: [unrelated] }).reasonCode, "MISSING_JUDGE_ROLE");
  const malformed = { ...unrelated, body: `${ATTESTATION_MARKER}\nnot json` };
  assert.equal(
    evaluateGate({ ...base, reviews: [...base.reviews, malformed] }).reasonCode,
    "PASS",
    "an unsigned malformed carrier cannot veto a valid signed quorum",
  );
}

{
  const base = gateFixture();
  const state = exactState(base.pr, base.ci, base.files);
  const stale = signedRecord(PRIMARY, state, { reviewed_at: "2026-08-23T19:59:00Z" });
  const forgedFresh = signedRecord(PRIMARY, state, { reviewed_at: "2026-08-23T20:02:00Z" });
  forgedFresh.clinical_analysis = "unsigned mutation after signing";
  assert.equal(
    evaluateGate({ ...base, reviews: [carrier(stale), carrier(forgedFresh, 813)] }).reasonCode,
    "STALE_ATTESTATION",
    "an unsigned newer timestamp cannot refresh an older signed approval",
  );
}

{
  const before = gateFixture();
  const after = structuredClone(before);
  after.files = HIGH_FILES;
  assert.notEqual(gateStateFingerprint(before), gateStateFingerprint(after));
  after.pr.headSha = "c".repeat(40);
  assert.notEqual(gateStateFingerprint(before), gateStateFingerprint(after));
}

{
  const epoch = deriveStateEpoch([
    { id: 100, event: "labeled", created_at: "2026-08-23T19:51:01Z", label: { name: "hold" } },
    { id: 101, event: "unlabeled", created_at: "2026-08-23T19:51:02Z", label: { name: "hold" } },
    { id: 102, event: "convert_to_draft", created_at: "2026-08-23T19:51:03Z" },
  ], "2026-08-23T19:50:00Z");
  assert.deepEqual(epoch, { eventId: 102, eventCreatedAt: "2026-08-23T19:51:03Z" });
  assert.throws(
    () => deriveStateEpoch([{ id: null, event: "labeled", created_at: null, label: { name: "hold" } }], "2026-08-23T19:50:00Z"),
    /malformed/,
  );
}

{
  assert.equal(
    checkRunsPath("momomojo", "Radulator", HEAD),
    `/repos/momomojo/Radulator/commits/${HEAD}/check-runs?filter=all`,
  );
  assert.throws(() => checkRunsPath("momomojo", "Radulator", "not-a-sha"), /malformed/);
  assert.equal(
    independentGate.attemptJobsPath("momomojo", "Radulator", 33534334936, 2),
    "/repos/momomojo/Radulator/actions/runs/33534334936/attempts/2/jobs",
  );
  assert.throws(
    () => independentGate.attemptJobsPath("momomojo", "Radulator", 0, 2),
    /malformed/,
  );
}

{
  const pr = prFixture();
  const requiredCi = requiredCiForBase(pr.baseRef);
  const run = workflowRun(pr, { run_attempt: 2 });
  const priorChecks = requiredCi.map((name, index) => checkRun(pr, name, index, {
    id: 2100 + index,
    completed_at: `2026-08-23T20:00:${10 + index}Z`,
  }));
  const currentChecks = requiredCi.map((name, index) => checkRun(pr, name, index, {
    id: 2200 + index,
    completed_at: `2026-08-23T21:00:${10 + index}Z`,
  }));
  const attemptJobs = requiredCi.map((name, index) => workflowJob(pr, name, index, {
    id: 2200 + index,
    run_attempt: 2,
    check_run_url: `https://api.github.com/repos/momomojo/Radulator/check-runs/${2200 + index}`,
  }));
  const result = resolveRequiredCi({
    pr,
    workflowRuns: [run],
    checkRuns: [...priorChecks, ...currentChecks],
    attemptJobs,
    requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
    expectedRepositoryFullName: REPOSITORY,
  });
  assert.equal(result.ok, true, "a green current rerun attempt must ignore retained prior-attempt checks");
  assert.deepEqual(result.evidence.map((item) => item.check_run_id), [2200, 2201]);
  assert.ok(result.evidence.every((item) => item.run_attempt === 2));
}

{
  const pr = prFixture();
  const setup = ciFixture(pr);
  const invalidBindings = [
    ["job/check-run id", ({ jobs }) => { jobs[0].id = 2999; }],
    ["job run id", ({ jobs }) => { jobs[0].run_id = 9999; }],
    ["job attempt", ({ jobs }) => { jobs[0].run_attempt = 2; }],
    ["job head", ({ jobs }) => { jobs[0].head_sha = "c".repeat(40); }],
    ["job check-run URL", ({ jobs }) => { jobs[0].check_run_url = "https://api.github.com/repos/other/repo/check-runs/2000"; }],
    ["paired repository and URL", ({ jobs, currentPr }) => {
      currentPr.repositoryFullName = "other/repo";
      jobs[0].check_run_url = "https://api.github.com/repos/other/repo/check-runs/2000";
    }],
    ["job status", ({ jobs }) => { jobs[0].status = "in_progress"; }],
    ["job conclusion", ({ jobs }) => { jobs[0].conclusion = "failure"; }],
    ["check name", ({ checks }) => { checks[0].name = "Impostor"; }],
    ["check head", ({ checks }) => { checks[0].head_sha = "c".repeat(40); }],
    ["check suite", ({ checks }) => { checks[0].check_suite.id = 9999; }],
    ["check app", ({ checks }) => { checks[0].app.id = 9999; }],
    ["check status", ({ checks }) => { checks[0].status = "in_progress"; }],
    ["check conclusion", ({ checks }) => { checks[0].conclusion = "failure"; }],
  ];
  for (const [label, mutate] of invalidBindings) {
    const currentPr = structuredClone(pr);
    const jobs = structuredClone(setup.attemptJobs);
    const checks = structuredClone(setup.checkRuns);
    mutate({ jobs, checks, currentPr });
    const result = resolveRequiredCi({
      pr: currentPr,
      workflowRuns: setup.workflowRuns,
      checkRuns: checks,
      attemptJobs: jobs,
      requiredCi: setup.requiredCi,
      expectedWorkflowId: WORKFLOW_ID,
      expectedCiAppId: CI_APP_ID,
      expectedRepositoryFullName: REPOSITORY,
    });
    assert.equal(result.ok, false, `${label} mismatch must fail closed`);
  }
}

{
  assert.equal(
    typeof independentGate.countedPaged,
    "function",
    "attempt-job pagination must validate the endpoint's declared total_count",
  );
  const complete = await independentGate.countedPaged(
    "token",
    "/repos/momomojo/Radulator/actions/runs/1001/attempts/2/jobs",
    "jobs",
    async () => ({ total_count: 2, jobs: [{ id: 1 }, { id: 2 }] }),
  );
  assert.deepEqual(complete.map((job) => job.id), [1, 2]);
  await assert.rejects(
    independentGate.countedPaged(
      "token",
      "/repos/momomojo/Radulator/actions/runs/1001/attempts/2/jobs",
      "jobs",
      async () => ({ total_count: 3, jobs: [{ id: 1 }, { id: 2 }] }),
    ),
    /total_count/,
    "an incomplete attempt-jobs response must fail closed",
  );
}

{
  const pr = prFixture();
  const setup = ciFixture(pr);
  assert.equal(setup.result.ok, true);
  const duplicate = { ...setup.checkRuns[0], id: 2999 };
  const duplicateJob = {
    ...setup.attemptJobs[0],
    id: 2999,
    check_run_url: "https://api.github.com/repos/momomojo/Radulator/check-runs/2999",
  };
  assert.match(resolveRequiredCi({
    pr,
    workflowRuns: setup.workflowRuns,
    checkRuns: [...setup.checkRuns, duplicate],
    attemptJobs: [...setup.attemptJobs, duplicateJob],
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
    expectedRepositoryFullName: REPOSITORY,
  }).summary, /ambiguous/);

  const failedLatest = workflowRun(pr, {
    id: 1002,
    check_suite_id: 701,
    created_at: "2026-08-23T20:03:00Z",
    conclusion: "failure",
  });
  assert.equal(resolveRequiredCi({
    pr,
    workflowRuns: [setup.workflowRuns[0], failedLatest],
    checkRuns: setup.checkRuns,
    attemptJobs: setup.attemptJobs,
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
    expectedRepositoryFullName: REPOSITORY,
  }).ok, false);
  const ciFor = (workflowRuns) => resolveRequiredCi({
    pr,
    workflowRuns,
    checkRuns: setup.checkRuns,
    attemptJobs: setup.attemptJobs,
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
    expectedRepositoryFullName: REPOSITORY,
  });
  // A finished run that failed is not pending; a run still queued or running, or none yet, is.
  assert.equal(ciFor([setup.workflowRuns[0], failedLatest]).pending, false);
  for (const status of ["queued", "in_progress", "waiting"]) {
    const running = workflowRun(pr, { id: 1003, check_suite_id: 702, created_at: "2026-08-23T20:04:00Z", status, conclusion: null });
    const result = ciFor([setup.workflowRuns[0], running]);
    assert.deepEqual([result.ok, result.pending], [false, true], `${status} latest run is pending`);
  }
  assert.deepEqual([ciFor([]).ok, ciFor([]).pending], [false, true], "no exact-head run yet is pending");

  const supplemental = checkRun(pr, "Hermes Release Control Tests", 3);
  const supplementalJob = workflowJob(pr, "Hermes Release Control Tests", 3);
  const withSupplemental = resolveRequiredCi({
    pr,
    workflowRuns: setup.workflowRuns,
    checkRuns: [...setup.checkRuns, supplemental],
    attemptJobs: [...setup.attemptJobs, supplementalJob],
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
    expectedRepositoryFullName: REPOSITORY,
  });
  assert.deepEqual(withSupplemental.evidence.map((item) => item.name), setup.requiredCi);
  assert.deepEqual(
    withSupplemental.supplementalEvidence.map((item) => item.name),
    ["Hermes Release Control Tests"],
  );

  const completedGateCheck = checkRun(pr, REQUIRED_CONTEXT, 4);
  const afterGatePublication = resolveRequiredCi({
    pr,
    workflowRuns: setup.workflowRuns,
    checkRuns: [...setup.checkRuns, supplemental, completedGateCheck],
    attemptJobs: [...setup.attemptJobs, supplementalJob],
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
    expectedRepositoryFullName: REPOSITORY,
  });
  assert.deepEqual(
    afterGatePublication.supplementalEvidence,
    withSupplemental.supplementalEvidence,
    "the gate's own successful check must not contaminate exact-run CI evidence",
  );
  assert.equal(
    gateStateFingerprint({ pr, ci: afterGatePublication, files: STANDARD_FILES, reviews: [] }),
    gateStateFingerprint({ pr, ci: withSupplemental, files: STANDARD_FILES, reviews: [] }),
    "publishing the gate check must not change the gate state fingerprint",
  );

  assert.deepEqual(requiredCiForBase("develop"), ["Smoke Tests", "Targeted Calculator Tests"]);
  const mainPr = prFixture({ baseRef: "main" });
  assert.deepEqual(requiredCiForBase(mainPr.baseRef), ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"]);
  if (typeof independentGate.requiredCiForPullRequest === "function") {
    assert.deepEqual(
      independentGate.requiredCiForPullRequest(pr, STANDARD_FILES),
      ["Smoke Tests", "Targeted Calculator Tests"],
      "standard develop PRs remain on the tight two-check path",
    );
    assert.deepEqual(
      independentGate.requiredCiForPullRequest(pr, HIGH_FILES),
      ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"],
      "actual high-risk changed files require exact-head Full evidence even without a marker",
    );
    assert.deepEqual(
      independentGate.requiredCiForPullRequest(
        prFixture({ body: "<!-- radulator-risk: high -->" }),
        STANDARD_FILES,
      ),
      ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"],
      "the canonical marker schedules and requires Full even when the current file list is standard",
    );
    assert.doesNotThrow(
      () => independentGate.requiredCiForPullRequest(pr, []),
      "a transient empty file page must not abort the entire collector queue",
    );
    assert.deepEqual(
      independentGate.requiredCiForPullRequest(pr, []),
      ["Smoke Tests", "Targeted Calculator Tests"],
      "incomplete file evidence may only fall back to the base minimum before completeFileList fails closed",
    );
  }
}

// ---- Promotions to main carry the promotion chain proof -------------------------------------------
assert.deepEqual(
  relevantLabelsDigest(["ready-for-gate", "release-urgent", "promotion-full-review", "promotion"]).labels,
  ["promotion-full-review", "ready-for-gate", "release-urgent"],
  "the urgent and full-review release labels are bound into attestations and the state epoch",
);
assert.equal(
  deriveStateEpoch([
    { id: 300, event: "labeled", created_at: "2026-08-23T19:52:00Z", label: { name: "promotion-full-review" } },
  ], "2026-08-23T19:50:00Z").eventId,
  300,
  "adding promotion-full-review starts a new exact state, so batch-mode approvals cannot carry over",
);
assert.equal(independentGate.PROMOTION_CHAIN_ENFORCEMENT, "report", "A1 reports the chain before anything enforces it");

const PROMOTION_HEAD_REF = "release/promote-484c9ee59ce2-6d7f8d95a462";

function verifiedChain(overrides = {}) {
  const chain = {
    schema: PROMOTION_CHAIN_SCHEMA,
    ok: true,
    reasonCode: "CHAIN_VERIFIED",
    summary: "2 controller merges verified.",
    failure: null,
    repository: REPOSITORY,
    M: BASE,
    D: "d".repeat(40),
    S0: "e".repeat(40),
    P: HEAD,
    entries: [
      { pr: 274, squash: "1".repeat(40), head: "2".repeat(40), tier: "high", domain: "clinical", remediation: false, urgent: false, roles: [{ role: "primary" }, { role: "verification" }] },
      { pr: 295, squash: "3".repeat(40), head: "4".repeat(40), tier: "high", domain: "clinical", remediation: true, urgent: false, roles: [{ role: "primary" }, { role: "verification" }] },
    ],
    counts: { commits: 2, prs: 2, nonRemediation: 1, remediation: 1, urgent: 0, highRiskClinical: 1, domains: { clinical: 2, "release-control": 0, neutral: 0 } },
    domain: "clinical",
    overlappingFiles: ["src/components/calculators/NIRADS.jsx"],
    integrationMergedPaths: ["docs/verification/calculator-inventory.json"],
    policy: { maxPrs: 2, maxHighRiskClinical: 2, maxAgeHours: 24, maxChainCommits: 30, maxCompareFiles: 300 },
    ...overrides,
  };
  chain.digest = digest(chain);
  return chain;
}

function promotionFixture({ labels = ["ready-for-gate", "promotion"], promotionChain = verifiedChain(), pr = {} } = {}) {
  const base = gateFixture({
    pr: { baseRef: "main", headRef: PROMOTION_HEAD_REF, headRepoFullName: REPOSITORY, labels, ...pr },
    files: HIGH_FILES,
  });
  const state = exactState(base.pr, base.ci, base.files);
  const primary = signedRecord(PRIMARY, state);
  const verification = signedRecord(VERIFICATION, state, { reviewed_at: "2026-08-23T20:01:30Z" });
  return { ...base, reviews: [carrier(primary), carrier(verification, 813)], promotionChain };
}

{
  const state = promotionFixture();
  const result = evaluateGate(state);
  assert.equal(result.reasonCode, "PASS");
  assert.equal(result.promotionChain.ok, true);
  assert.equal(result.promotionChain.enforcement, "report");
  assert.equal(result.promotionChain.digest, state.promotionChain.digest);
  assert.deepEqual(result.promotionChain.prs.map((entry) => entry.pr), [274, 295]);
  const { fingerprint, promotionChain: _chain, ...unsigned } = result;
  assert.equal(fingerprint, digest(unsigned), "report mode keeps the chain outside the fingerprint");
  assert.equal(
    result.summary,
    "high risk: exact CI and primary + verification judge attestation passed.",
    "report mode leaves the verdict summary unchanged",
  );
  const payload = checkCompletionPayload(result);
  assert.match(payload.output.summary, /Promotion chain \(report\): verified, 2 PR\(s\), digest [0-9a-f]{12}\. Report only/);
  const text = JSON.parse(payload.output.text);
  assert.equal(text.promotion_chain.ok, true, "the check output reports the chain");
  assert.equal(text.promotion_chain.reasonCode, "CHAIN_VERIFIED");
  assert.equal(
    independentGate.authorizationStatusPayload(result, { html_url: "https://github.com/momomojo/Radulator/runs/1" }).description,
    `PASS ${result.fingerprint}`,
  );

  const unverified = verifiedChain({ ok: false, reasonCode: "CHAIN_ATTESTATION_MISSING", summary: "PR #274 has no valid signed quorum." });
  const reported = evaluateGate(promotionFixture({ promotionChain: unverified }));
  assert.equal(reported.reasonCode, "PASS", "report mode never changes the verdict");
  assert.equal(reported.promotionChain.reasonCode, "CHAIN_ATTESTATION_MISSING");
  assert.match(checkCompletionPayload(reported).output.summary, /Promotion chain \(report\): CHAIN_ATTESTATION_MISSING\./);
  assert.equal(
    reported.fingerprint,
    result.fingerprint,
    "in report mode a different chain view (for example a transient load error in one process) cannot change the published fingerprint of full-review approvals",
  );

  const withoutChain = (() => {
    const state = promotionFixture();
    delete state.promotionChain;
    return state;
  })();
  const missing = evaluateGate(withoutChain);
  assert.equal(missing.reasonCode, "PASS");
  assert.equal(missing.promotionChain.reasonCode, "CHAIN_EVIDENCE_UNAVAILABLE", "a promotion without a loaded chain reports it as unavailable");

  const blocked = evaluateGate(promotionFixture({ promotionChain: unverified }), { promotionChainEnforcement: "enforce" });
  assert.equal(blocked.reasonCode, "PROMOTION_CHAIN_UNVERIFIED", "enforce mode refuses an unverified chain");
  assert.equal(blocked.conclusion, "failure");
  assert.equal(blocked.promotionChain.enforcement, "enforce");
  assert.match(blocked.summary, /CHAIN_ATTESTATION_MISSING/);
  assert.equal(
    evaluateGate(withoutChain, { promotionChainEnforcement: "enforce" }).reasonCode,
    "PROMOTION_CHAIN_UNVERIFIED",
  );
  assert.equal(
    evaluateGate(promotionFixture({ promotionChain: unverified }), { promotionChainEnforcement: "unexpected" }).reasonCode,
    "PROMOTION_CHAIN_UNVERIFIED",
    "an unknown enforcement mode fails closed",
  );
  const enforcedPass = evaluateGate(promotionFixture(), { promotionChainEnforcement: "enforce" });
  assert.equal(enforcedPass.reasonCode, "PASS", "a verified chain passes under enforcement");
  assert.match(enforcedPass.summary, /Promotion chain \(enforce\): verified, 2 PR\(s\)/);
  assert.equal(checkCompletionPayload(enforcedPass).output.summary, enforcedPass.summary);
  assert.notEqual(
    enforcedPass.fingerprint,
    evaluateGate(promotionFixture({ promotionChain: verifiedChain({ integrationMergedPaths: [] }) }), { promotionChainEnforcement: "enforce" }).fingerprint,
    "under enforcement the authorization binds the exact chain",
  );
  const escaped = evaluateGate(
    promotionFixture({ promotionChain: unverified, labels: ["ready-for-gate", "promotion", "promotion-full-review"] }),
    { promotionChainEnforcement: "enforce" },
  );
  assert.equal(escaped.reasonCode, "PASS", "the full-review label is the escape, bound into the attestations");

  // Enforcement runs after the CI policy and before the judge quorum.
  const unjudged = promotionFixture({ promotionChain: unverified });
  assert.equal(evaluateGate({ ...unjudged, reviews: [] }, { promotionChainEnforcement: "enforce" }).reasonCode, "PROMOTION_CHAIN_UNVERIFIED");
  assert.equal(evaluateGate({ ...unjudged, reviews: [] }).reasonCode, "MISSING_JUDGE_ROLE");
  assert.equal(evaluateGate({ ...unjudged, reviews: [] }).promotionChain.reasonCode, "CHAIN_ATTESTATION_MISSING",
    "a blocked promotion still reports its chain");
  assert.equal(
    evaluateGate({ ...unjudged, ci: { ok: false, summary: "running", evidence: [] } }, { promotionChainEnforcement: "enforce" }).reasonCode,
    "CI_NOT_EXACT_SUCCESS",
  );

  // Hotfixes to main and cross-repository heads are not promotions: no chain, unchanged results.
  for (const pr of [
    { headRef: "hotfix/live-outage" },
    { headRepoFullName: "someone/Radulator" },
  ]) {
    const hotfix = evaluateGate(promotionFixture({ promotionChain: unverified, pr }), { promotionChainEnforcement: "enforce" });
    assert.equal(hotfix.reasonCode, "PASS");
    assert.equal(Object.hasOwn(hotfix, "promotionChain"), false);
    assert.equal(Object.hasOwn(JSON.parse(checkCompletionPayload(hotfix).output.text), "promotion_chain"), false);
  }
  // Develop PRs keep their exact results and fingerprints.
  const developResult = evaluateGate(gateFixture());
  assert.equal(Object.hasOwn(developResult, "promotionChain"), false);
  const { fingerprint: developFingerprint, ...developUnsigned } = developResult;
  assert.equal(developFingerprint, digest(developUnsigned));
  assert.equal(developResult.summary, "standard risk: exact CI and primary judge attestation passed.");

  const promotionState = promotionFixture();
  const changedChain = { ...promotionState, promotionChain: verifiedChain({ integrationMergedPaths: [] }) };
  assert.notEqual(gateStateFingerprint(promotionState), gateStateFingerprint(changedChain), "the chain digest is part of the state fingerprint");
  assert.notEqual(
    gateStateFingerprint(promotionState),
    gateStateFingerprint({ ...promotionState, pr: { ...promotionState.pr, headRef: "release/promote-other" } }),
    "the head ref is part of the state fingerprint",
  );
}

// ---- The chain recomputes the gate's develop PASS fingerprint (primary judge on #317) --------------------
{
  assert.equal(GATE_CHECK_CONTEXT, REQUIRED_CONTEXT);
  const standard = evaluateGate(gateFixture());
  const high = gateFixture({ files: HIGH_FILES });
  const highState = exactState(high.pr, high.ci, high.files);
  high.reviews = [
    carrier(signedRecord(PRIMARY, highState)),
    carrier(signedRecord(VERIFICATION, highState, { reviewed_at: "2026-08-23T20:01:30Z" }), 813),
  ];
  const highResult = evaluateGate(high);
  for (const [label, result, pr] of [["standard", standard, gateFixture().pr], ["high", highResult, high.pr]]) {
    assert.equal(result.reasonCode, "PASS", `${label} fixture passes`);
    assert.equal(
      gatePassFingerprint({ headSha: pr.headSha, baseSha: pr.baseSha, risk: result.risk }),
      result.fingerprint,
      `${label}: promotion-chain.mjs recomputes the gate's exact PASS fingerprint`,
    );
  }
}

// ---- The chain derives the PR-state epoch exactly as the gate does (verification judge on #317) -------------
{
  assert.deepEqual([...STATE_EPOCH_LABELS].sort(), [...independentGate.RELEVANT_LABELS].sort(), "the chain's epoch labels are the gate's");
  assert.deepEqual([...STATE_EPOCH_EVENTS].sort(), [...independentGate.RELEVANT_TIMELINE_EVENTS].sort(), "the chain's epoch events are the gate's");
  const createdAt = "2026-08-23T19:00:00Z";
  const timelines = [
    [],
    [{ id: 10, event: "labeled", created_at: "2026-08-23T19:10:00Z", label: { name: "ready-for-gate" } }],
    [
      { id: 10, event: "labeled", created_at: "2026-08-23T19:10:00Z", label: { name: "ready-for-gate" } },
      { id: 11, event: "labeled", created_at: "2026-08-23T19:11:00Z", label: { name: "triage" } },
      { id: 12, event: "commented", created_at: "2026-08-23T19:12:00Z" },
      { id: 13, event: "ready_for_review", created_at: "2026-08-23T19:13:00Z" },
      { id: 14, event: "unlabeled", created_at: "2026-08-23T19:14:00Z", label: { name: "Release-Remediation" } },
    ],
    [
      { id: 21, event: "head_ref_force_pushed", created_at: "2026-08-23T19:21:00Z" },
      { id: 20, event: "labeled", created_at: "2026-08-23T19:20:00Z", label: { name: "gate-hold" } },
    ],
  ];
  for (const timeline of timelines) {
    assert.deepEqual(stateEpochAt(timeline, createdAt), deriveStateEpoch(timeline, createdAt), JSON.stringify(timeline));
  }
  const malformed = [{ id: 30, event: "closed", created_at: "not a date" }];
  assert.throws(() => deriveStateEpoch(malformed, createdAt));
  assert.equal(stateEpochAt(malformed, createdAt), null, "a malformed relevant event fails closed in both");
}

// ---- Batch approvals count only for the chain they were signed against (Codex on #317) ----------------
{
  const chain = verifiedChain();
  const batchBinding = { mode: "batch", promotion_chain_sha256: chain.digest };
  const bound = ({ review = batchBinding, verdict = "PASS", ...options } = {}) => {
    const fixture = promotionFixture({ promotionChain: chain, ...options });
    const state = exactState(fixture.pr, fixture.ci, fixture.files);
    const finding = verdict === "PASS" ? {} : { verdict, clinical_analysis: "The merged management text contradicts the source." };
    const primary = signedRecord(PRIMARY, state, { review, ...finding });
    const verification = signedRecord(VERIFICATION, state, { review, reviewed_at: "2026-08-23T20:01:30Z" });
    return { ...fixture, reviews: [carrier(primary), carrier(verification, 813)] };
  };
  // Verification judge on #317 (373d003): batch review is off in A1, so a batch approval never counts there; the
  // vectors below run with it on, as A2 will.
  assert.equal(evaluateGate(bound()).reasonCode, "MISSING_JUDGE_ROLE", "batch review is off by default: a batch approval does not count");
  const on = { promotionBatchReview: "on" };
  const pass = evaluateGate(bound(), on);
  assert.equal(pass.reasonCode, "PASS", "a batch approval counts for the chain it was signed against");
  assert.equal(evaluateGate(bound(), { ...on, promotionChainEnforcement: "enforce" }).reasonCode, "PASS");
  for (const [label, promotionChain] of [
    ["the chain stops verifying", verifiedChain({ ok: false, reasonCode: "CHAIN_ATTESTATION_MISSING" })],
    ["the chain changes", verifiedChain({ integrationMergedPaths: [] })],
    ["the chain cannot be loaded", unavailablePromotionChain({ repository: REPOSITORY, mainSha: BASE, promotionHeadSha: HEAD, error: "rate limited" })],
  ]) {
    const result = evaluateGate({ ...bound(), promotionChain }, on);
    assert.equal(result.reasonCode, "MISSING_JUDGE_ROLE", `report mode: a batch approval no longer counts when ${label}`);
    assert.equal(result.conclusion, "neutral", `${label}: the promotion waits for a fresh review`);
    assert.notEqual(result.fingerprint, pass.fingerprint, `${label}: the controller's fingerprint check refuses the merge`);
  }
  const withoutChain = bound();
  delete withoutChain.promotionChain;
  assert.equal(evaluateGate(withoutChain, on).reasonCode, "MISSING_JUDGE_ROLE", "a batch approval needs a loaded chain");
  // A full review never relied on the chain.
  const unverified = verifiedChain({ ok: false, reasonCode: "CHAIN_TREE_MISMATCH" });
  const fullReview = bound({ review: { mode: "full", promotion_chain_sha256: unverified.digest }, promotionChain: unverified });
  assert.equal(evaluateGate(fullReview, on).reasonCode, "PASS", "a full-review approval counts whatever the chain");
  assert.equal(evaluateGate({ ...fullReview, promotionChain: chain }, on).reasonCode, "PASS");
  assert.equal(evaluateGate(fullReview).reasonCode, "PASS", "with batch review off, a full-review approval counts");
  // A batch NEEDS_FIX stands after the chain changes.
  const rejected = bound({ verdict: "NEEDS_FIX" });
  assert.equal(evaluateGate({ ...rejected, promotionChain: verifiedChain({ integrationMergedPaths: [] }) }, on).reasonCode, "NEEDS_FIX");
  assert.equal(evaluateGate(rejected).reasonCode, "NEEDS_FIX", "with batch review off, a batch NEEDS_FIX still stands");
  // Only promotions carry a binding: on a develop PR a bound record is malformed and never counts.
  const developState = gateFixture();
  const developExact = exactState(developState.pr, developState.ci, developState.files);
  const developBound = signedRecord(PRIMARY, developExact, { review: batchBinding });
  assert.equal(evaluateGate({ ...developState, reviews: [carrier(developBound)] }).reasonCode, "MISSING_JUDGE_ROLE");
}

// loadGateState loads the chain for promotions only, memoized, and a chain-loading error never throws.
{
  const promotionHead = "7".repeat(40);
  const developHead = "8".repeat(40);
  const mainHead = "9".repeat(40);
  const calls = [];
  const pullBody = (number, baseRef, headRef, headSha, baseSha) => ({
    number,
    changed_files: 1,
    title: "release: promote develop to main (1 PRs: #274)",
    body: "",
    html_url: `https://github.com/${REPOSITORY}/pull/${number}`,
    state: "open",
    draft: false,
    created_at: "2026-08-23T19:50:00Z",
    head: { sha: headSha, ref: headRef, repo: { full_name: REPOSITORY } },
    base: { sha: baseSha, ref: baseRef, repo: { id: 1027532341, full_name: REPOSITORY } },
    user: { login: "promoter", id: 1, type: "User" },
    labels: [{ name: "ready-for-gate" }],
  });
  const routes = new Map([
    [`/repos/${REPOSITORY}/pulls/310`, pullBody(310, "main", PROMOTION_HEAD_REF, promotionHead, mainHead)],
    [`/repos/${REPOSITORY}/pulls/311`, pullBody(311, "develop", "feature/x", developHead, mainHead)],
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    calls.push(parsed.pathname);
    if (routes.has(parsed.pathname)) return new Response(JSON.stringify(routes.get(parsed.pathname)), { status: 200 });
    if (/\/(comments|timeline|files)$/.test(parsed.pathname)) return new Response("[]", { status: 200 });
    if (parsed.pathname.endsWith("/runs")) return new Response(JSON.stringify({ workflow_runs: [] }), { status: 200 });
    if (parsed.pathname.endsWith("/check-runs")) return new Response(JSON.stringify({ check_runs: [] }), { status: 200 });
    return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
  };
  try {
    const config = { expectedWorkflowId: WORKFLOW_ID, expectedCiAppId: CI_APP_ID, publicKeys: PUBLIC_KEYS };
    const first = await independentGate.loadGateState("token", "momomojo", "Radulator", 310, config);
    const second = await independentGate.loadGateState("token", "momomojo", "Radulator", 310, config);
    assert.equal(first.pr.headRef, PROMOTION_HEAD_REF);
    assert.equal(first.pr.headRepoFullName, REPOSITORY);
    assert.equal(first.promotionChain.ok, false);
    assert.equal(first.promotionChain.reasonCode, "CHAIN_EVIDENCE_UNAVAILABLE", "an unreadable promotion head is reported, not thrown");
    assert.equal(first.promotionChain.P, promotionHead);
    assert.equal(second.promotionChain, first.promotionChain, "the chain is memoized for the process");
    assert.equal(calls.filter((path) => path === `/repos/${REPOSITORY}/git/commits/${promotionHead}`).length, 1);
    assert.equal(gateStateFingerprint(first), gateStateFingerprint(second), "memoization keeps before/after fingerprints equal");
    const develop = await independentGate.loadGateState("token", "momomojo", "Radulator", 311, config);
    assert.equal(Object.hasOwn(develop, "promotionChain"), false, "develop PRs never load a chain");
    assert.ok(!calls.some((path) => path.includes(developHead) && path.includes("/git/commits/")));
    const result = evaluateGate(first);
    assert.equal(result.reasonCode, "INCOMPLETE_FILE_LIST", "the stubbed promotion still fails on its own evidence");
    assert.equal(result.promotionChain.reasonCode, "CHAIN_EVIDENCE_UNAVAILABLE");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// The chain helper used for unavailable evidence has the full result shape.
{
  const unavailable = unavailablePromotionChain({ repository: REPOSITORY, mainSha: BASE, promotionHeadSha: HEAD, error: new Error("rate limited") });
  assert.equal(unavailable.schema, PROMOTION_CHAIN_SCHEMA);
  assert.match(unavailable.summary, /rate limited/);
}

console.log("independent clinical exact-head gate tests passed");
