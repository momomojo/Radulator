#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { run, verifyReleaseArtifact } from "./verify-release-artifact.mjs";

const SOURCE_SHA = "a".repeat(40);
const SOURCE_TREE_SHA = "b".repeat(40);
const REVIEWED_HEAD_SHA = "c".repeat(40);
const MAIN_CONTROLLER_SHA = "d".repeat(40);
const PAYLOAD_DIGEST = "e".repeat(64);
const ARCHIVE_DIGEST = `sha256:${"f".repeat(64)}`;
const ARTIFACT_ID = 123456;
const BUILD_RUN_ID = 8001;
const BUILD_ATTEMPT = 2;
const ARTIFACT_NAME = `radulator-pages-${BUILD_RUN_ID}-${BUILD_ATTEMPT}`;
const NOW = Date.parse("2026-09-07T15:00:00Z");

const validArtifact = {
  id: ARTIFACT_ID,
  name: ARTIFACT_NAME,
  size_in_bytes: 2048,
  expired: false,
  expires_at: "2026-10-07T15:00:00Z",
  digest: ARCHIVE_DIGEST,
  workflow_run: { id: BUILD_RUN_ID, head_sha: MAIN_CONTROLLER_SHA },
};

function api(overrides = {}) {
  const calls = [];
  return {
    calls,
    async listArtifacts(runId) {
      calls.push(runId);
      return [structuredClone(validArtifact)];
    },
    ...overrides,
  };
}

const expected = {
  artifactId: ARTIFACT_ID,
  artifactName: ARTIFACT_NAME,
  buildRunId: BUILD_RUN_ID,
  buildAttempt: BUILD_ATTEMPT,
  sourceSha: SOURCE_SHA,
  sourceTreeSha: SOURCE_TREE_SHA,
  reviewedHeadSha: REVIEWED_HEAD_SHA,
  payloadDigest: PAYLOAD_DIGEST,
  now: NOW,
};

assert.deepEqual(await verifyReleaseArtifact({ api: api(), ...expected }), {
  schema: "radulator-artifact-receipt/v1",
  sourceSha: SOURCE_SHA,
  sourceTreeSha: SOURCE_TREE_SHA,
  reviewedHeadSha: REVIEWED_HEAD_SHA,
  payloadDigest: PAYLOAD_DIGEST,
  artifactId: ARTIFACT_ID,
  artifactName: ARTIFACT_NAME,
  buildRunId: BUILD_RUN_ID,
  buildAttempt: BUILD_ATTEMPT,
  artifactArchiveDigest: ARCHIVE_DIGEST,
});

for (const [label, override, pattern] of [
  ["missing artifact", async () => [], /exactly one|missing/i],
  ["ambiguous artifact name", async () => [validArtifact, { ...validArtifact, id: ARTIFACT_ID + 1 }], /exactly one|ambiguous/i],
  ["wrong artifact id", async () => [{ ...validArtifact, id: ARTIFACT_ID + 1 }], /id|identity/i],
  ["expired artifact", async () => [{ ...validArtifact, expired: true }], /expired/i],
  ["expired timestamp", async () => [{ ...validArtifact, expires_at: "2026-09-06T15:00:00Z" }], /expired/i],
  ["non-positive size", async () => [{ ...validArtifact, size_in_bytes: 0 }], /size/i],
  ["wrong workflow run", async () => [{ ...validArtifact, workflow_run: { id: BUILD_RUN_ID + 1, head_sha: MAIN_CONTROLLER_SHA } }], /workflow|run/i],
  ["malformed workflow metadata", async () => [{ ...validArtifact, workflow_run: null }], /workflow|run/i],
  ["malformed archive digest", async () => [{ ...validArtifact, digest: "sha256:ABC" }], /digest/i],
]) {
  await assert.rejects(
    () => verifyReleaseArtifact({ api: api({ async listArtifacts() { return override(); } }), ...expected }),
    pattern,
    label,
  );
}

await assert.rejects(
  () => verifyReleaseArtifact({ api: api(), ...expected, artifactName: `radulator-pages-${BUILD_RUN_ID}-${BUILD_ATTEMPT + 1}` }),
  /name|attempt/i,
  "artifact name must bind to the captured build attempt",
);

assert.deepEqual(
  await verifyReleaseArtifact({ api: api(), ...expected, reviewedHeadSha: null }),
  {
    schema: "radulator-artifact-receipt/v1",
    sourceSha: SOURCE_SHA,
    sourceTreeSha: SOURCE_TREE_SHA,
    reviewedHeadSha: null,
    payloadDigest: PAYLOAD_DIGEST,
    artifactId: ARTIFACT_ID,
    artifactName: ARTIFACT_NAME,
    buildRunId: BUILD_RUN_ID,
    buildAttempt: BUILD_ATTEMPT,
    artifactArchiveDigest: ARCHIVE_DIGEST,
  },
  "rollback permits a controller/main workflow head unrelated to rollback source SHA",
);

{
  const temporary = await mkdtemp(path.join(os.tmpdir(), "radulator-artifact-receipt-"));
  const output = path.join(temporary, "receipt.json");
  const githubOutput = path.join(temporary, "github-output");
  try {
    const receipt = await run([
      "--artifact-id", String(ARTIFACT_ID),
      "--artifact-name", ARTIFACT_NAME,
      "--build-run-id", String(BUILD_RUN_ID),
      "--build-attempt", String(BUILD_ATTEMPT),
      "--source-sha", SOURCE_SHA,
      "--source-tree-sha", SOURCE_TREE_SHA,
      "--reviewed-head-sha", REVIEWED_HEAD_SHA,
      "--payload-digest", PAYLOAD_DIGEST,
      "--output", output,
    ], {
      GITHUB_OUTPUT: githubOutput,
      GITHUB_TOKEN: "opaque-token-never-printed",
      GITHUB_REPOSITORY: "owner/repo",
    }, api());
    assert.equal(receipt.artifactArchiveDigest, ARCHIVE_DIGEST);
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), receipt);
    const outputText = await readFile(githubOutput, "utf8");
    assert.match(outputText, new RegExp(`artifact_archive_digest=${ARCHIVE_DIGEST.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(outputText, /receipt_file=.*receipt\.json/);
    assert.doesNotMatch(outputText, /opaque-token/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

console.log("release artifact verification tests passed");
