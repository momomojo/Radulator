#!/usr/bin/env node
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  atomicWrite,
  formatAttestationCarrier,
  generateKeyPairFiles,
  postAttestation,
  signCandidate,
  verifyKeyPairFiles,
} from "./judge-attest.mjs";
import { loadPublicKeysFile } from "./public-keys.mjs";
import { PROMOTION_CHAIN_SCHEMA } from "../../../scripts/promotion-chain.mjs";
import { classifyRisk, digest, verifyAttestation } from "../../../scripts/release-policy.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const STANDARD_REQUIRED_CI = ["Smoke Tests", "Targeted Calculator Tests"];

function candidateFixture(overrides = {}) {
  const files = [{ filename: "README.md", status: "modified", patch: "@@ -1 +1 @@\n-old\n+new" }];
  const risk = classifyRisk(files);
  const ci = STANDARD_REQUIRED_CI.map((name, index) => ({
    name,
    completed_at: `2026-08-23T20:00:0${index}Z`,
  }));
  return {
    schema: "radulator-judge-candidate/v1",
    candidateId: "d".repeat(64),
    repository: "momomojo/Radulator",
    role: "primary",
    requiredRoles: ["primary"],
    collectedAt: "2026-08-23T20:01:00Z",
    pr: 123,
    title: "Safe wording update",
    body: "Evidence",
    url: "https://github.com/momomojo/Radulator/pull/123",
    headSha: HEAD,
    baseSha: BASE,
    baseRef: "develop",
    risk,
    exactState: {
      repositoryId: 1027532341,
      pr: 123,
      headSha: HEAD,
      baseSha: BASE,
      baseRef: "develop",
      stateEpoch: { event_id: 88, event_created_at: "2026-08-23T19:55:00Z" },
      labelsSha256: "e".repeat(64),
      risk,
      ci,
      ciSha256: digest(ci),
    },
    files,
    ci: { ok: true, evidence: ci },
    ...overrides,
  };
}

const temp = await mkdtemp(path.join(os.tmpdir(), "radulator-key-test-"));
try {
  const nestedOutput = path.join(temp, "fresh-profile", "state", "attestation.json");
  await atomicWrite(nestedOutput, '{"ok":true}\n', 0o600);
  assert.equal(await readFile(nestedOutput, "utf8"), '{"ok":true}\n');
  assert.equal((await stat(nestedOutput)).mode & 0o777, 0o600);
  assert.equal((await stat(path.dirname(nestedOutput))).mode & 0o777, 0o700);

  const generated = await generateKeyPairFiles({
    directory: temp,
    keyId: "primary-2026-08",
    role: "primary",
    profile: "radulator",
  });
  assert.equal((await stat(generated.privateKeyPath)).mode & 0o777, 0o600);
  assert.match(generated.publicConfig.publicKey, /BEGIN PUBLIC KEY/);
  assert.equal(generated.publicConfig.role, "primary");

  await rm(generated.publicKeyPath);
  await assert.rejects(() => generateKeyPairFiles({
    directory: temp,
    keyId: "primary-2026-08",
    role: "primary",
    profile: "radulator",
  }), /incomplete judge key pair/);
  await rm(generated.privateKeyPath);
  const restored = await generateKeyPairFiles({
    directory: temp,
    keyId: "primary-2026-08",
    role: "primary",
    profile: "radulator",
  });
  assert.equal(await verifyKeyPairFiles({
    privateKeyPath: restored.privateKeyPath,
    publicKeyPath: restored.publicKeyPath,
  }), true);
  const otherDirectory = path.join(temp, "other");
  const other = await generateKeyPairFiles({
    directory: otherDirectory,
    keyId: "other-primary",
    role: "primary",
    profile: "radulator",
  });
  await assert.rejects(() => verifyKeyPairFiles({
    privateKeyPath: other.privateKeyPath,
    publicKeyPath: restored.publicKeyPath,
  }), /do not match/);
  const mismatchedDirectory = path.join(temp, "mismatched-existing");
  const mismatched = await generateKeyPairFiles({
    directory: mismatchedDirectory,
    keyId: "mismatched-primary",
    role: "primary",
    profile: "radulator",
  });
  await writeFile(mismatched.publicKeyPath, await readFile(other.publicKeyPath, "utf8"));
  await assert.rejects(() => generateKeyPairFiles({
    directory: mismatchedDirectory,
    keyId: "mismatched-primary",
    role: "primary",
    profile: "radulator",
  }), /do not match/, "existing key files are verified before generation reports success");

  const candidate = candidateFixture();
  const decision = {
    candidate_id: candidate.candidateId,
    verdict: "PASS",
    clinical_analysis: "The exact standard-risk diff and CI evidence support release.",
    citations: ["https://example.org/source"],
  };
  const privateKey = await readFile(restored.privateKeyPath, "utf8");
  const record = signCandidate({
    candidate,
    decision,
    identity: {
      keyId: "primary-2026-08",
      role: "primary",
      profile: "radulator",
      model: "gpt-5.6-sol",
      provider: "openai-codex",
    },
    privateKey,
    reviewedAt: "2026-08-23T20:02:00Z",
  });
  const keys = { "primary-2026-08": restored.publicConfig };
  const publicKeysFile = path.join(temp, "public-keys.json");
  await writeFile(publicKeysFile, `${JSON.stringify(keys)}\n`, { mode: 0o600 });
  assert.deepEqual(await loadPublicKeysFile(publicKeysFile), keys);
  await writeFile(publicKeysFile, "[]\n", { mode: 0o600 });
  await assert.rejects(() => loadPublicKeysFile(publicKeysFile), /object/);
  await writeFile(publicKeysFile, `${JSON.stringify(keys)}\n`, { mode: 0o600 });
  assert.equal(verifyAttestation(record, keys, candidate.exactState).ok, true);
  assert.match(formatAttestationCarrier(record), /radulator-clinical-attestation\/v1/);

  const hugeFiles = [{
    filename: "docs/calculators/hepatology/meld-na.md",
    status: "modified",
    changes: 2,
    additions: 1,
    deletions: 1,
    patch: `@@ -1 +1 @@\n-${"x".repeat(300_000)}\n+${"y".repeat(300_000)}`,
  }];
  const hugeRisk = classifyRisk(hugeFiles);
  const hugeCandidate = candidateFixture({
    files: hugeFiles,
    risk: hugeRisk,
    exactState: { ...candidate.exactState, risk: hugeRisk },
  });
  const hugeRecord = signCandidate({
    candidate: hugeCandidate,
    decision: { ...decision, candidate_id: hugeCandidate.candidateId },
    identity: {
      keyId: "primary-2026-08", role: "primary", profile: "radulator",
      model: "gpt-5.6-sol", provider: "openai-codex",
    },
    privateKey,
    reviewedAt: "2026-08-23T20:02:00Z",
  });
  assert.ok(Buffer.byteLength(formatAttestationCarrier(hugeRecord), "utf8") < 20_000,
    "attestation carrier remains bounded even when the review candidate contains a huge patch");

  assert.throws(() => signCandidate({
    candidate,
    decision,
    identity: { keyId: "verification-2026-08", role: "verification", profile: "default", model: "gpt-5.6-sol", provider: "openai-codex" },
    privateKey,
    reviewedAt: "2026-08-23T20:02:00Z",
  }), /does not match candidate role/);
  assert.throws(() => signCandidate({
    candidate,
    decision: { ...decision, citations: [] },
    identity: { keyId: "primary-2026-08", role: "primary", profile: "radulator", model: "gpt-5.6-sol", provider: "openai-codex" },
    privateKey,
    reviewedAt: "2026-08-23T20:02:00Z",
  }), /Decision is malformed/);
  assert.throws(() => signCandidate({
    candidate,
    decision: { ...decision, clinical_analysis: "x".repeat(8001) },
    identity: { keyId: "primary-2026-08", role: "primary", profile: "radulator", model: "gpt-5.6-sol", provider: "openai-codex" },
    privateKey,
    reviewedAt: "2026-08-23T20:02:00Z",
  }), /Decision is malformed/, "runaway analysis is rejected before publication");
  assert.throws(() => signCandidate({
    candidate,
    decision: { ...decision, citations: ["not-a-url"] },
    identity: { keyId: "primary-2026-08", role: "primary", profile: "radulator", model: "gpt-5.6-sol", provider: "openai-codex" },
    privateKey,
    reviewedAt: "2026-08-23T20:02:00Z",
  }), /Decision is malformed/, "citations must be bounded HTTP(S) URLs");
  assert.throws(() => formatAttestationCarrier({ ...record, clinical_analysis: "x".repeat(50_000) }),
    /publication limit/, "the final carrier has an independent byte bound");

  let created = 0;
  const posted = await postAttestation({
    record,
    publicKeys: keys,
    api: {
      async loadGateState() {
        return {
          pr: {
            repositoryId: candidate.exactState.repositoryId,
            number: candidate.pr,
            changedFiles: candidate.files.length,
            headSha: candidate.headSha,
            baseSha: candidate.baseSha,
            baseRef: candidate.baseRef,
            stateEpoch: { eventId: 88, eventCreatedAt: "2026-08-23T19:55:00Z" },
            labelsDigest: candidate.exactState.labelsSha256,
          },
          requiredCi: STANDARD_REQUIRED_CI,
          ci: candidate.ci,
          files: candidate.files,
        };
      },
      async createComment(body) { created += 1; return { id: 77, body }; },
      async getComment() { return { id: 77, body: formatAttestationCarrier(record) }; },
    },
  });
  assert.equal(posted.commentId, 77);
  assert.equal(created, 1);

  const idempotent = await postAttestation({
    record,
    publicKeys: keys,
    api: {
      async loadGateState() {
        return {
          pr: {
            repositoryId: candidate.exactState.repositoryId, number: candidate.pr, headSha: candidate.headSha,
            changedFiles: candidate.files.length,
            baseSha: candidate.baseSha, baseRef: candidate.baseRef,
            stateEpoch: { eventId: 88, eventCreatedAt: "2026-08-23T19:55:00Z" },
            labelsDigest: candidate.exactState.labelsSha256,
          },
          requiredCi: STANDARD_REQUIRED_CI,
          ci: candidate.ci,
          files: candidate.files,
          reviews: [{ id: 77, body: formatAttestationCarrier(record) }],
        };
      },
      async createComment() { throw new Error("must not duplicate an existing exact carrier"); },
      async getComment() { return { id: 77, body: formatAttestationCarrier(record) }; },
    },
  });
  assert.equal(idempotent.commentId, 77);
  assert.equal(idempotent.idempotent, true);

  const highFiles = [{
    filename: "src/components/calculators/MELDNa.jsx",
    status: "modified",
    patch: "@@ -1 +1 @@\n-const score = 1\n+const score = 2",
  }];
  const highRisk = classifyRisk(highFiles);
  const downgradedCi = candidate.ci.evidence;
  const highCandidate = candidateFixture({
    files: highFiles,
    risk: highRisk,
    requiredRoles: ["primary", "verification"],
    ci: { ok: true, evidence: downgradedCi },
    exactState: {
      ...candidate.exactState,
      risk: highRisk,
      ci: downgradedCi,
      ciSha256: digest(downgradedCi),
    },
  });
  const highRecord = signCandidate({
    candidate: highCandidate,
    decision: { ...decision, candidate_id: highCandidate.candidateId },
    identity: {
      keyId: "primary-2026-08", role: "primary", profile: "radulator",
      model: "gpt-5.6-sol", provider: "openai-codex",
    },
    privateKey,
    reviewedAt: "2026-08-23T20:02:00Z",
  });
  await assert.rejects(() => postAttestation({
    record: highRecord,
    publicKeys: keys,
    api: {
      async loadGateState() {
        return {
          pr: {
            repositoryId: highCandidate.exactState.repositoryId, number: highCandidate.pr,
            changedFiles: highFiles.length, headSha: highCandidate.headSha,
            baseSha: highCandidate.baseSha, baseRef: highCandidate.baseRef,
            stateEpoch: { eventId: 88, eventCreatedAt: "2026-08-23T19:55:00Z" },
            labelsDigest: highCandidate.exactState.labelsSha256,
          },
          requiredCi: STANDARD_REQUIRED_CI,
          ci: highCandidate.ci,
          files: highFiles,
        };
      },
      async createComment() { throw new Error("must not post downgraded high-risk evidence"); },
    },
  }), /CI_POLICY_MISMATCH|trusted risk policy/i);

  await assert.rejects(() => postAttestation({
    record,
    publicKeys: keys,
    api: {
      async loadGateState() {
        return {
          pr: {
            repositoryId: candidate.exactState.repositoryId, number: candidate.pr,
            changedFiles: candidate.files.length, headSha: candidate.headSha,
            baseSha: candidate.baseSha, baseRef: candidate.baseRef,
            stateEpoch: { eventId: 88, eventCreatedAt: "2026-08-23T19:55:00Z" },
            labelsDigest: candidate.exactState.labelsSha256,
          },
          requiredCi: STANDARD_REQUIRED_CI,
          ci: { ...candidate.ci, ok: false, summary: "Full workflow is not green" },
          files: candidate.files,
        };
      },
      async createComment() { throw new Error("must not post against non-green live CI"); },
    },
  }), /CI_NOT_EXACT_SUCCESS|not exact green/i);

  await assert.rejects(() => postAttestation({
    record,
    publicKeys: keys,
    api: {
      async loadGateState() {
        return {
          pr: { repositoryId: candidate.exactState.repositoryId, number: 123, changedFiles: candidate.files.length, headSha: "0".repeat(40), baseSha: BASE, baseRef: "develop", stateEpoch: { eventId: 88, eventCreatedAt: "2026-08-23T19:55:00Z" }, labelsDigest: candidate.exactState.labelsSha256 },
          requiredCi: STANDARD_REQUIRED_CI,
          ci: candidate.ci,
          files: candidate.files,
        };
      },
      async createComment() { throw new Error("must not post stale evidence"); },
    },
  }), /stale/i);

  // Promotions (Codex on #317): the record signs the candidate's review binding, and a batch approval is posted only
  // while the live chain is the one it was signed against.
  const chainDigest = "c".repeat(64);
  const binding = { mode: "batch", promotion_chain_sha256: chainDigest };
  const MAIN_REQUIRED_CI = ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"];
  const mainCi = MAIN_REQUIRED_CI.map((name, index) => ({ name, completed_at: `2026-08-23T20:00:0${index}Z` }));
  const promotionExact = { ...candidate.exactState, baseRef: "main", ci: mainCi, ciSha256: digest(mainCi) };
  const promotionCandidate = candidateFixture({
    baseRef: "main",
    reviewMode: "batch",
    ci: { ok: true, evidence: mainCi },
    exactState: { ...promotionExact, review: binding },
  });
  const identity = { keyId: "primary-2026-08", role: "primary", profile: "radulator", model: "gpt-5.6-sol", provider: "openai-codex" };
  const signPromotion = (item) => signCandidate({
    candidate: item,
    decision: { ...decision, candidate_id: item.candidateId },
    identity,
    privateKey,
    reviewedAt: "2026-08-23T20:02:00Z",
  });
  const promotionRecord = signPromotion(promotionCandidate);
  assert.deepEqual(promotionRecord.review, binding, "the record signs the review binding");
  assert.equal(verifyAttestation(promotionRecord, keys, promotionCandidate.exactState).ok, true);
  assert.equal(record.review, undefined, "a develop record carries no binding");
  for (const [label, broken] of [
    ["a promotion candidate without a binding",
      candidateFixture({ baseRef: "main", reviewMode: "batch", exactState: promotionExact })],
    ["a binding for another mode",
      candidateFixture({ baseRef: "main", reviewMode: "full", exactState: { ...promotionExact, review: binding } })],
    ["a binding on a candidate without a review mode",
      candidateFixture({ reviewMode: null, exactState: { ...candidate.exactState, review: binding } })],
  ]) {
    assert.throws(() => signPromotion(broken), /review binding/, label);
  }
  const chainFixture = { schema: PROMOTION_CHAIN_SCHEMA, ok: true, reasonCode: "CHAIN_VERIFIED", digest: chainDigest };
  const livePromotion = (chain) => ({
    pr: {
      repositoryId: candidate.exactState.repositoryId,
      number: candidate.pr,
      changedFiles: candidate.files.length,
      headSha: candidate.headSha,
      baseSha: candidate.baseSha,
      baseRef: "main",
      headRef: "release/promote-484c9ee59ce2-6d7f8d95a462",
      headRepoFullName: "momomojo/Radulator",
      repositoryFullName: "momomojo/Radulator",
      stateEpoch: { eventId: 88, eventCreatedAt: "2026-08-23T19:55:00Z" },
      labels: ["ready-for-gate"],
      labelsDigest: candidate.exactState.labelsSha256,
    },
    requiredCi: MAIN_REQUIRED_CI,
    ci: promotionCandidate.ci,
    files: candidate.files,
    promotionChain: chain,
  });
  const postedPromotion = await postAttestation({
    record: promotionRecord,
    publicKeys: keys,
    api: {
      async loadGateState() { return livePromotion(chainFixture); },
      async createComment(body) { return { id: 78, body }; },
      async getComment() { return { id: 78, body: formatAttestationCarrier(promotionRecord) }; },
    },
  });
  assert.equal(postedPromotion.commentId, 78, "a batch approval posts while the chain is unchanged");
  for (const [label, chain] of [
    ["another chain", { ...chainFixture, digest: "f".repeat(64) }],
    ["a chain that stopped verifying", { ...chainFixture, ok: false, reasonCode: "CHAIN_TREE_MISMATCH" }],
  ]) {
    await assert.rejects(() => postAttestation({
      record: promotionRecord,
      publicKeys: keys,
      api: {
        async loadGateState() { return livePromotion(chain); },
        async createComment() { throw new Error(`must not post a batch approval for ${label}`); },
      },
    }), /stale or invalid attestation: ATTESTATION_STATE_MISMATCH/, label);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log("Hermes clinical judge signing tests passed");
