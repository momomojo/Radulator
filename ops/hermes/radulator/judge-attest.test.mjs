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
import { classifyRisk, digest, verifyAttestation } from "../../../scripts/release-policy.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);

function candidateFixture(overrides = {}) {
  const files = [{ filename: "README.md", status: "modified", patch: "@@ -1 +1 @@\n-old\n+new" }];
  const risk = classifyRisk(files);
  const ci = [{ name: "Smoke Tests", completed_at: "2026-08-23T20:00:00Z" }];
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

  await assert.rejects(() => postAttestation({
    record,
    publicKeys: keys,
    api: {
      async loadGateState() {
        return {
          pr: { repositoryId: candidate.exactState.repositoryId, number: 123, changedFiles: candidate.files.length, headSha: "0".repeat(40), baseSha: BASE, baseRef: "develop", stateEpoch: { eventId: 88, eventCreatedAt: "2026-08-23T19:55:00Z" }, labelsDigest: candidate.exactState.labelsSha256 },
          ci: candidate.ci,
          files: candidate.files,
        };
      },
      async createComment() { throw new Error("must not post stale evidence"); },
    },
  }), /stale/i);
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log("Hermes clinical judge signing tests passed");
