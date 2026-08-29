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

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const WORKFLOW_ID = 227376261;
const CI_APP_ID = 15368;
const CHECK_SUITE_ID = 700;

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
  const ciSetup = ciFixture(pr, options.ciSetup || {});
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

function expectBlocked(reasonCode, options = {}) {
  const result = evaluateGate(gateFixture(options));
  assert.equal(result.context, REQUIRED_CONTEXT);
  assert.equal(result.conclusion, "failure");
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, reasonCode);
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

expectBlocked("UNSUPPORTED_BASE", { pr: { baseRef: "feature" } });
expectBlocked("PR_NOT_OPEN_READY", { pr: { state: "closed" } });
expectBlocked("PR_NOT_OPEN_READY", { pr: { draft: true } });
expectBlocked("READY_LABEL_MISSING", { pr: { labels: [] } });
expectBlocked("HOLD_PRESENT", { pr: { labels: ["ready-for-gate", "hold"] } });
expectBlocked("CI_NOT_EXACT_SUCCESS", { ci: { ok: false, summary: "latest run failed", evidence: [] } });
expectBlocked("INCOMPLETE_FILE_LIST", { pr: { changedFiles: 2 } });
expectBlocked("INCOMPLETE_FILE_LIST", { pr: { changedFiles: 3001 } });
expectBlocked("MISSING_JUDGE_ROLE", { reviews: [] });

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
  assert.equal(evaluateGate({ ...base, reviews: [carrier(pass), carrier(needsFix, 813)] }).reasonCode, "NEEDS_FIX");
}

{
  const base = gateFixture();
  const state = exactState(base.pr, base.ci, base.files);
  const stale = signedRecord(PRIMARY, state, { reviewed_at: "2026-08-23T19:59:00Z" });
  assert.equal(evaluateGate({ ...base, reviews: [carrier(stale)] }).reasonCode, "STALE_ATTESTATION");
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
}

{
  const pr = prFixture();
  const setup = ciFixture(pr);
  assert.equal(setup.result.ok, true);
  const duplicate = { ...setup.checkRuns[0], id: 2999 };
  assert.match(resolveRequiredCi({
    pr,
    workflowRuns: setup.workflowRuns,
    checkRuns: [...setup.checkRuns, duplicate],
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
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
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
  }).ok, false);

  const supplemental = checkRun(pr, "Hermes Release Control Tests", 3);
  const withSupplemental = resolveRequiredCi({
    pr,
    workflowRuns: setup.workflowRuns,
    checkRuns: [...setup.checkRuns, supplemental],
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
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
    requiredCi: setup.requiredCi,
    expectedWorkflowId: WORKFLOW_ID,
    expectedCiAppId: CI_APP_ID,
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
}

console.log("independent clinical exact-head gate tests passed");
