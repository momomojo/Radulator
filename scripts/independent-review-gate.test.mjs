#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";

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
  const risk = classifyRisk(files);
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

  const mainPr = prFixture({ baseRef: "main" });
  assert.deepEqual(requiredCiForBase(mainPr.baseRef), ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"]);
}

console.log("independent clinical exact-head gate tests passed");
