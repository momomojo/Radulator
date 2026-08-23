#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  formatAttestationCarrier,
  generateKeyPairFiles,
  postAttestation,
  signCandidate,
} from "./judge-attest.mjs";
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
  assert.equal(verifyAttestation(record, keys, candidate.exactState).ok, true);
  assert.match(formatAttestationCarrier(record), /radulator-clinical-attestation\/v1/);

  assert.throws(() => signCandidate({
    candidate,
    decision,
    identity: { keyId: "verification-2026-08", role: "verification", profile: "default", model: "gpt-5.6-sol", provider: "openai-codex" },
    privateKey,
    reviewedAt: "2026-08-23T20:02:00Z",
  }), /does not match candidate role/);

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

  await assert.rejects(() => postAttestation({
    record,
    publicKeys: keys,
    api: {
      async loadGateState() {
        return {
          pr: { repositoryId: candidate.exactState.repositoryId, number: 123, headSha: "0".repeat(40), baseSha: BASE, baseRef: "develop", stateEpoch: { eventId: 88, eventCreatedAt: "2026-08-23T19:55:00Z" }, labelsDigest: candidate.exactState.labelsSha256 },
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
