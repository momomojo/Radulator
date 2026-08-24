#!/usr/bin/env node
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { collectCandidates, writeCandidateCache } from "./judge-candidates.mjs";
import { resolveGithubToken } from "./github-token.mjs";
import {
  ATTESTATION_MARKER,
  relevantLabelsDigest,
} from "../../../scripts/independent-review-gate.mjs";
import {
  ATTESTATION_SCHEMA,
  canonicalJson,
  classifyRisk,
  digest,
} from "../../../scripts/release-policy.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const PRIMARY_ID = "primary-2026-08";
const VERIFY_ID = "verification-2026-08";
const primaryKeys = generateKeyPairSync("ed25519");
const verificationKeys = generateKeyPairSync("ed25519");
const PUBLIC_KEYS = {
  [PRIMARY_ID]: {
    role: "primary",
    profile: "radulator",
    publicKey: primaryKeys.publicKey.export({ type: "spki", format: "pem" }),
  },
  [VERIFY_ID]: {
    role: "verification",
    profile: "default",
    publicKey: verificationKeys.publicKey.export({ type: "spki", format: "pem" }),
  },
};

{
  let fallbackCalls = 0;
  const fromEnvironment = resolveGithubToken({
    env: { GH_TOKEN: " environment-token ", GITHUB_TOKEN: "lower-priority-token" },
    execFile() {
      fallbackCalls += 1;
      return "unexpected";
    },
  });
  assert.equal(fromEnvironment, "environment-token");
  assert.equal(fallbackCalls, 0, "an explicit environment token never invokes the gh fallback");

  let invocation;
  const fromGh = resolveGithubToken({
    env: {},
    execFile(command, arguments_, options) {
      invocation = { command, arguments_, options };
      return " cli-token\n";
    },
  });
  assert.equal(fromGh, "cli-token");
  assert.equal(invocation.command, "gh");
  assert.deepEqual(invocation.arguments_, ["auth", "token", "--hostname", "github.com"]);
  assert.deepEqual(invocation.options.stdio, ["ignore", "pipe", "ignore"], "token fallback never prints credentials");

  assert.equal(resolveGithubToken({ env: {}, execFile() { throw new Error("not authenticated"); } }), "");
}

const STANDARD_FILES = [{ filename: "README.md", status: "modified", patch: "@@ -1 +1 @@\n-old\n+new" }];
const HIGH_FILES = [{ filename: "src/components/calculators/MELDNa.jsx", status: "modified", patch: "@@ -1 +1 @@\n-1\n+2" }];

function stateFixture(files = STANDARD_FILES, reviews = []) {
  const labels = relevantLabelsDigest(["ready-for-gate"]);
  return {
    pr: {
      repositoryId: 1027532341,
      number: 123,
      changedFiles: files.length,
      title: "Improve exact behavior",
      body: "Evidence: https://example.org/source",
      state: "open",
      draft: false,
      headSha: HEAD,
      baseSha: BASE,
      baseRef: "develop",
      author: "implementation-worker",
      authorId: 5001,
      createdAt: "2026-08-23T19:50:00Z",
      stateEpoch: { eventId: 88, eventCreatedAt: "2026-08-23T19:55:00Z" },
      labels: labels.labels,
      labelsDigest: labels.sha256,
    },
    requiredCi: ["Smoke Tests", "Targeted Calculator Tests"],
    ci: {
      ok: true,
      evidence: [{
        name: "Smoke Tests",
        app_id: 15368,
        check_run_id: 1,
        check_suite_id: 2,
        workflow_id: 3,
        workflow_run_id: 4,
        run_attempt: 1,
        head_sha: HEAD,
        conclusion: "success",
        completed_at: "2026-08-23T20:00:00Z",
      }],
    },
    files,
    reviews,
    publicKeys: PUBLIC_KEYS,
  };
}

function signedCarrier(keyId, role, profile, privateKey, state, verdict = "PASS", overrides = {}) {
  const risk = classifyRisk(state.files, state.pr);
  const exact = {
    repositoryId: state.pr.repositoryId,
    pr: state.pr.number,
    headSha: state.pr.headSha,
    baseSha: state.pr.baseSha,
    baseRef: state.pr.baseRef,
    stateEpoch: { event_id: state.pr.stateEpoch.eventId, event_created_at: state.pr.stateEpoch.eventCreatedAt },
    labelsSha256: state.pr.labelsDigest,
    risk,
    ci: state.ci.evidence,
    ciSha256: digest(state.ci.evidence),
  };
  const record = {
    schema: ATTESTATION_SCHEMA,
    repository_id: exact.repositoryId,
    pr: exact.pr,
    head_sha: exact.headSha,
    base_sha: exact.baseSha,
    base_ref: exact.baseRef,
    state_epoch: exact.stateEpoch,
    labels_sha256: exact.labelsSha256,
    risk: exact.risk,
    ci: exact.ci,
    ci_sha256: exact.ciSha256,
    verdict,
    clinical_analysis: overrides.clinicalAnalysis || (verdict === "PASS" ? "Evidence supports release." : "Evidence is insufficient."),
    citations: ["https://example.org/source"],
    judge: { key_id: keyId, role, profile, model: "gpt-5.6-sol", provider: "openai-codex" },
    reviewed_at: overrides.reviewedAt || "2026-08-23T20:01:00Z",
  };
  record.signature = sign(null, Buffer.from(canonicalJson(record)), privateKey).toString("base64");
  return {
    id: 9001,
    body: `${ATTESTATION_MARKER}\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\``,
    updatedAt: record.reviewed_at,
  };
}

async function collect(role, state) {
  return collectCandidates({
    repository: "momomojo/Radulator",
    role,
    publicKeys: PUBLIC_KEYS,
    api: {
      async listOpenPrs() { return [{ number: 123, labels: [{ name: "ready-for-gate" }] }]; },
      async loadGateState() { return structuredClone(state); },
    },
    now: "2026-08-23T20:02:00Z",
  });
}

const standard = await collect("primary", stateFixture());
assert.equal(standard.length, 1);
assert.equal(standard[0].role, "primary");
assert.equal(standard[0].risk.tier, "standard");
assert.equal(standard[0].headSha, HEAD);
assert.equal(standard[0].candidateId.length, 64);
assert.ok(standard[0].riskDetails.length > 0);

{
  const incomplete = stateFixture();
  incomplete.pr.changedFiles = 2;
  assert.deepEqual(await collect("primary", incomplete), [], "incomplete GitHub file evidence is never judged");
}

{
  const ambiguousState = stateFixture();
  ambiguousState.reviews = [
    signedCarrier(PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, ambiguousState),
    signedCarrier(PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, ambiguousState, "PASS", {
      clinicalAnalysis: "A distinct valid analysis at the same newest timestamp.",
    }),
  ];
  assert.equal((await collect("primary", ambiguousState)).length, 1,
    "an ambiguous newest role is automatically requeued for a later resolving attestation");

  const duplicateState = stateFixture();
  const exactCarrier = signedCarrier(PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, duplicateState);
  duplicateState.reviews = [exactCarrier, structuredClone(exactCarrier)];
  assert.deepEqual(await collect("primary", duplicateState), [], "copied exact carriers remain idempotent");

  ambiguousState.reviews.push(signedCarrier(
    PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, ambiguousState, "PASS",
    { reviewedAt: "2026-08-23T20:02:00Z" },
  ));
  assert.deepEqual(await collect("primary", ambiguousState), [], "a newer unique PASS supersedes an older collision");
}

const highNoPrimary = await collect("verification", stateFixture(HIGH_FILES));
assert.deepEqual(highNoPrimary, [], "verification waits for the primary PASS on high risk");

const highState = stateFixture(HIGH_FILES);
highState.reviews = [signedCarrier(PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, highState)];
const highVerification = await collect("verification", highState);
assert.equal(highVerification.length, 1);
assert.equal(highVerification[0].risk.tier, "high");
assert.deepEqual(highVerification[0].requiredRoles, ["primary", "verification"]);

const needsFixState = stateFixture(HIGH_FILES);
needsFixState.reviews = [signedCarrier(PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, needsFixState, "NEEDS_FIX")];
assert.deepEqual(await collect("verification", needsFixState), [], "verification never overrides a primary NEEDS_FIX");

const temp = await mkdtemp(path.join(os.tmpdir(), "radulator-candidate-test-"));
try {
  const first = await writeCandidateCache(temp, standard);
  const second = await writeCandidateCache(temp, standard);
  assert.deepEqual(first, second, "cache writes are idempotent");
  const cached = JSON.parse(await readFile(first[0], "utf8"));
  assert.equal(cached.candidateId, standard[0].candidateId);
  assert.equal(cached.headSha, HEAD);
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log("Hermes clinical judge candidate tests passed");
