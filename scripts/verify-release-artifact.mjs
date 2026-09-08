#!/usr/bin/env node
import { appendFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { paged } from "./independent-review-gate.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const ARCHIVE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
export const RELEASE_ARTIFACT_RECEIPT_SCHEMA = "radulator-artifact-receipt/v1";
export const CLI_USAGE = "Usage: verify-release-artifact --artifact-id <id> --artifact-name radulator-pages-<build-run-id>-<build-attempt> --build-run-id <id> --build-attempt <attempt> --source-sha <sha> --source-tree-sha <tree-sha> (--reviewed-head-sha <sha> | --rollback) --payload-digest <sha256> [--output <receipt.json>] [--verify]\nEnvironment: GITHUB_TOKEN and GITHUB_REPOSITORY provide the opaque GitHub API credentials/context; GITHUB_OUTPUT optionally receives artifact_archive_digest and receipt_file.";

function requirePositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
}

function requireSha(value, name) {
  if (!SHA_PATTERN.test(value || "")) throw new Error(`${name} must be an immutable 40-character SHA.`);
}

function requireDigest(value, name) {
  if (!DIGEST_PATTERN.test(value || "")) throw new Error(`${name} must be a lowercase 64-character SHA-256 digest.`);
}

function normalizeInputs({
  artifactId: suppliedArtifactId,
  expectedArtifactId,
  artifactName: suppliedArtifactName,
  expectedArtifactName,
  buildRunId,
  buildAttempt,
  sourceSha: suppliedSourceSha,
  sha,
  sourceTreeSha,
  reviewedHeadSha,
  payloadDigest,
}) {
  const artifactId = expectedArtifactId ?? suppliedArtifactId;
  const artifactName = expectedArtifactName ?? suppliedArtifactName;
  const sourceSha = suppliedSourceSha ?? sha;
  requirePositiveInteger(artifactId, "artifactId");
  requirePositiveInteger(buildRunId, "buildRunId");
  requirePositiveInteger(buildAttempt, "buildAttempt");
  requireSha(sourceSha, "sourceSha");
  requireSha(sourceTreeSha, "sourceTreeSha");
  if (reviewedHeadSha === undefined) throw new Error("reviewedHeadSha is required or must be null for rollback.");
  if (reviewedHeadSha !== null) requireSha(reviewedHeadSha, "reviewedHeadSha");
  requireDigest(payloadDigest, "payloadDigest");
  const expectedName = `radulator-pages-${buildRunId}-${buildAttempt}`;
  if (artifactName !== expectedName) {
    throw new Error(`artifactName must be exactly ${expectedName} for the captured build attempt.`);
  }
  return {
    artifactId,
    artifactName,
    buildRunId,
    buildAttempt,
    sourceSha,
    sourceTreeSha,
    reviewedHeadSha,
    payloadDigest,
  };
}

export async function verifyReleaseArtifact({ api, now = Date.now(), ...rawInputs }) {
  if (!api || typeof api.listArtifacts !== "function") throw new Error("An artifact API reader is required.");
  if (!Number.isFinite(now)) throw new Error("now must be a finite timestamp.");
  const inputs = normalizeInputs(rawInputs);
  const artifacts = await api.listArtifacts(inputs.buildRunId);
  if (!Array.isArray(artifacts)) throw new Error("Artifact list response is malformed.");
  const matches = artifacts.filter((artifact) => artifact?.name === inputs.artifactName);
  if (matches.length !== 1) throw new Error("Artifact name must identify exactly one artifact.");
  const artifact = matches[0];
  if (artifact.id !== inputs.artifactId) throw new Error("Artifact ID does not match the captured immutable artifact.");
  if (!Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0) {
    throw new Error("Artifact size metadata is malformed or non-positive.");
  }
  if (artifact.expired !== false) throw new Error("Artifact is expired or has malformed expiration metadata.");
  const expiresAt = Date.parse(artifact.expires_at || "");
  if (!Number.isFinite(expiresAt) || expiresAt <= now) throw new Error("Artifact is expired or has malformed expiration metadata.");
  if (artifact.workflow_run?.id !== inputs.buildRunId) {
    throw new Error("Artifact workflow-run identity does not match the captured build run.");
  }
  if (!ARCHIVE_DIGEST_PATTERN.test(artifact.digest || "")) {
    throw new Error("Artifact archive digest metadata is malformed.");
  }
  return {
    schema: RELEASE_ARTIFACT_RECEIPT_SCHEMA,
    sourceSha: inputs.sourceSha,
    sourceTreeSha: inputs.sourceTreeSha,
    reviewedHeadSha: inputs.reviewedHeadSha,
    payloadDigest: inputs.payloadDigest,
    artifactId: inputs.artifactId,
    artifactName: inputs.artifactName,
    buildRunId: inputs.buildRunId,
    buildAttempt: inputs.buildAttempt,
    artifactArchiveDigest: artifact.digest,
  };
}

function defaultApi(env) {
  const token = env.GITHUB_TOKEN || "";
  const repository = env.GITHUB_REPOSITORY || "";
  if (!token || !repository.includes("/")) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
  return {
    listArtifacts: (buildRunId) => paged(
      token,
      `/repos/${repository}/actions/runs/${buildRunId}/artifacts`,
      "artifacts",
    ),
  };
}

function argument(name, args) {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null;
}

function requiredArgument(name, args) {
  const value = argument(name, args);
  if (!value) throw new Error(`Artifact verification requires ${name}.`);
  return value;
}

export async function run(args = process.argv.slice(2), env = process.env, api = null) {
  if (args.includes("--help")) {
    console.log(CLI_USAGE);
    return null;
  }
  const rollback = args.includes("--rollback");
  if (rollback && argument("--reviewed-head-sha", args) !== null) {
    throw new Error("Rollback artifact verification cannot also provide a reviewed head SHA.");
  }
  const receipt = await verifyReleaseArtifact({
    api: api || defaultApi(env),
    artifactId: Number(requiredArgument("--artifact-id", args)),
    artifactName: requiredArgument("--artifact-name", args),
    buildRunId: Number(requiredArgument("--build-run-id", args)),
    buildAttempt: Number(requiredArgument("--build-attempt", args)),
    sourceSha: requiredArgument("--source-sha", args),
    sourceTreeSha: requiredArgument("--source-tree-sha", args),
    reviewedHeadSha: rollback ? null : (argument("--reviewed-head-sha", args) ?? undefined),
    payloadDigest: requiredArgument("--payload-digest", args),
  });
  const output = argument("--output", args);
  if (output) await writeFile(output, `${JSON.stringify(receipt)}\n`, "utf8");
  if (env.GITHUB_OUTPUT) {
    await appendFile(
      env.GITHUB_OUTPUT,
      `artifact_archive_digest=${receipt.artifactArchiveDigest}\n${output ? `receipt_file=${output}\n` : ""}`,
      "utf8",
    );
  }
  console.log(JSON.stringify(receipt));
  return receipt;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
