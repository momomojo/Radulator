#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  RELEASE_MARKER_SCHEMA,
  verifyReleaseMarker,
  writeReleaseMarker,
  run,
} from "./write-release-marker.mjs";

const SHA = "a".repeat(40);
const SOURCE_TREE_SHA = "b".repeat(40);
const REVIEWED_HEAD_SHA = "c".repeat(40);
const ROLLBACK_SHA = "d".repeat(40);
const execFileAsync = promisify(execFile);

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function makePayload() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "radulator-release-marker-"));
  await mkdir(path.join(temporary, "assets"), { recursive: true });
  await writeFile(path.join(temporary, "z.txt"), "last\n", "utf8");
  await writeFile(path.join(temporary, "assets", "binary.bin"), Buffer.from([0, 255, 1, 128]));
  await writeFile(path.join(temporary, "assets", "a.txt"), "first\n", "utf8");
  return temporary;
}

const markerArgs = (distDir, sha = SHA, reviewedHeadSha = REVIEWED_HEAD_SHA) => ({
  distDir,
  sha,
  sourceTreeSha: SOURCE_TREE_SHA,
  reviewedHeadSha,
});

const expectedManifest = [
  { path: "assets/a.txt", size: 6, sha256: digest(Buffer.from("first\n")) },
  { path: "assets/binary.bin", size: 4, sha256: digest(Buffer.from([0, 255, 1, 128])) },
  { path: "z.txt", size: 5, sha256: digest(Buffer.from("last\n")) },
];

const temporary = await makePayload();
try {
  const result = await writeReleaseMarker(markerArgs(temporary));
  assert.equal(result.sha, SHA);
  assert.equal(result.sourceTreeSha, SOURCE_TREE_SHA);
  assert.equal(result.reviewedHeadSha, REVIEWED_HEAD_SHA);
  assert.deepEqual(result.payloadManifest, expectedManifest, "manifest is sorted by relative POSIX path");
  assert.equal(result.payloadDigest, digest(Buffer.from(JSON.stringify(expectedManifest))), "digest covers canonical manifest JSON");
  const marker = JSON.parse(await readFile(result.path, "utf8"));
  assert.deepEqual(marker, {
    schema: RELEASE_MARKER_SCHEMA,
    sha: SHA,
    sourceTreeSha: SOURCE_TREE_SHA,
    reviewedHeadSha: REVIEWED_HEAD_SHA,
    payloadManifest: expectedManifest,
    payloadDigest: digest(Buffer.from(JSON.stringify(expectedManifest))),
  });
  assert.deepEqual(await verifyReleaseMarker(markerArgs(temporary)), result, "verify recomputes without rewriting");

  const markerBytesBeforeVerify = await readFile(result.path);
  await verifyReleaseMarker(markerArgs(temporary));
  assert.deepEqual(await readFile(result.path), markerBytesBeforeVerify, "verify does not rewrite the marker");

  await writeFile(path.join(temporary, "z.txt"), "changed\n", "utf8");
  await assert.rejects(() => verifyReleaseMarker(markerArgs(temporary)), /manifest|payload|changed/i, "same SHA cannot authorize changed payload");
  await writeFile(path.join(temporary, "z.txt"), "last\n", "utf8");

  await rm(path.join(temporary, "assets", "a.txt"));
  await assert.rejects(() => verifyReleaseMarker(markerArgs(temporary)), /manifest|payload|missing/i, "missing payload files are rejected");
  await writeFile(path.join(temporary, "assets", "a.txt"), "first\n", "utf8");

  await writeFile(path.join(temporary, "extra.txt"), "extra", "utf8");
  await assert.rejects(() => verifyReleaseMarker(markerArgs(temporary)), /manifest|payload|extra/i, "extra payload files are rejected");
  await rm(path.join(temporary, "extra.txt"));

  const tampered = JSON.parse(await readFile(result.path, "utf8"));
  tampered.sourceTreeSha = "e".repeat(40);
  await writeFile(result.path, `${JSON.stringify(tampered)}\n`, "utf8");
  await assert.rejects(() => verifyReleaseMarker(markerArgs(temporary)), /identity|source|marker/i, "tampered source identity is rejected");
  tampered.sourceTreeSha = SOURCE_TREE_SHA;
  tampered.payloadDigest = "f".repeat(64);
  await writeFile(result.path, `${JSON.stringify(tampered)}\n`, "utf8");
  await assert.rejects(() => verifyReleaseMarker(markerArgs(temporary)), /digest|payload|marker/i, "tampered digest is rejected");
  tampered.payloadDigest = digest(Buffer.from(JSON.stringify(expectedManifest)));
  tampered.payloadManifest = [...expectedManifest].reverse();
  await writeFile(result.path, `${JSON.stringify(tampered)}\n`, "utf8");
  await assert.rejects(() => verifyReleaseMarker(markerArgs(temporary)), /manifest|payload|marker/i, "tampered manifest ordering is rejected");
} finally {
  await rm(temporary, { recursive: true, force: true });
}

for (const invalid of [
  { sha: "main", sourceTreeSha: SOURCE_TREE_SHA, reviewedHeadSha: REVIEWED_HEAD_SHA },
  { sha: SHA, sourceTreeSha: "tree", reviewedHeadSha: REVIEWED_HEAD_SHA },
  { sha: SHA, sourceTreeSha: SOURCE_TREE_SHA, reviewedHeadSha: undefined },
  { sha: SHA, sourceTreeSha: SOURCE_TREE_SHA, reviewedHeadSha: "head" },
]) {
  const root = await mkdtemp(path.join(os.tmpdir(), "radulator-release-marker-invalid-"));
  await writeFile(path.join(root, "payload.txt"), "payload", "utf8");
  try {
    await assert.rejects(() => writeReleaseMarker({ distDir: root, ...invalid }), /SHA|reviewed|immutable/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

{
  const root = await mkdtemp(path.join(os.tmpdir(), "radulator-release-marker-rollback-"));
  await writeFile(path.join(root, "payload.txt"), "payload", "utf8");
  try {
    const result = await writeReleaseMarker(markerArgs(root, ROLLBACK_SHA, null));
    assert.equal(result.reviewedHeadSha, null, "rollback marker records an explicit null reviewed head");
    assert.deepEqual(await verifyReleaseMarker(markerArgs(root, ROLLBACK_SHA, null)), result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

{
  const root = await mkdtemp(path.join(os.tmpdir(), "radulator-release-marker-empty-"));
  try {
    await assert.rejects(() => writeReleaseMarker(markerArgs(root)), /empty|payload/i, "empty payloads are rejected");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

{
  const root = await mkdtemp(path.join(os.tmpdir(), "radulator-release-marker-symlink-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "radulator-release-marker-outside-"));
  try {
    await writeFile(path.join(outside, "secret.txt"), "secret", "utf8");
    await symlink(path.join(outside, "secret.txt"), path.join(root, "payload-link"));
    await assert.rejects(() => writeReleaseMarker(markerArgs(root)), /symlink|symbolic/i, "payload symlinks are rejected");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
}

{
  const root = await makePayload();
  const outside = await mkdtemp(path.join(os.tmpdir(), "radulator-release-marker-outside-"));
  try {
    await mkdir(path.join(root, "releases"), { recursive: true });
    await writeFile(path.join(outside, "marker.json"), "outside", "utf8");
    await symlink(path.join(outside, "marker.json"), path.join(root, "releases", `${SHA}.json`));
    await assert.rejects(() => writeReleaseMarker(markerArgs(root)), /symlink|symbolic/i, "marker destination symlinks are rejected");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
}

for (const reserved of [".git", ".github", "node_modules"]) {
  const root = await makePayload();
  const outside = await mkdtemp(path.join(os.tmpdir(), "radulator-release-marker-outside-"));
  try {
    const reservedPath = path.join(root, "nested", reserved);
    await mkdir(reservedPath, { recursive: true });
    if (reserved === ".git") {
      await writeFile(path.join(outside, "secret.txt"), "secret", "utf8");
      await symlink(path.join(outside, "secret.txt"), path.join(reservedPath, "contained-link"));
    } else {
      await writeFile(path.join(reservedPath, "contained.txt"), "reserved", "utf8");
    }
    await assert.rejects(
      () => writeReleaseMarker(markerArgs(root)),
      /reserved uploader entry/i,
      `nested ${reserved} directories and their contents are rejected`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
}

for (const reserved of [".git", ".github", "node_modules"]) {
  for (const location of ["root", "nested"]) {
    const root = await makePayload();
    const reservedPath = location === "root"
      ? path.join(root, reserved)
      : path.join(root, "nested", reserved);
    try {
      if (location === "nested") await mkdir(path.dirname(reservedPath), { recursive: true });
      await writeFile(reservedPath, "reserved", "utf8");
      await assert.rejects(
        () => writeReleaseMarker(markerArgs(root)),
        /reserved uploader entry/i,
        `${location} regular ${reserved} files are rejected`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}

{
  const root = await makePayload();
  try {
    await execFileAsync("mkfifo", [path.join(root, "payload.fifo")]);
    await assert.rejects(() => writeReleaseMarker(markerArgs(root)), /special|payload/i, "special files are rejected");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

{
  const root = await makePayload();
  try {
    const prior = await writeReleaseMarker(markerArgs(root, ROLLBACK_SHA, null));
    const current = await writeReleaseMarker(markerArgs(root));
    assert.ok(current.payloadManifest.some((entry) => entry.path === `releases/${ROLLBACK_SHA}.json`), "only the exact current marker is excluded");
    assert.ok(prior.path !== current.path);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

{
  const root = await makePayload();
  try {
    const written = await run([
      "--dist", root,
      "--sha", SHA,
      "--source-tree-sha", SOURCE_TREE_SHA,
      "--reviewed-head-sha", REVIEWED_HEAD_SHA,
    ]);
    assert.equal(written.reviewedHeadSha, REVIEWED_HEAD_SHA);
    const verified = await run([
      "--verify",
      "--dist", root,
      "--sha", SHA,
      "--source-tree-sha", SOURCE_TREE_SHA,
      "--reviewed-head-sha", REVIEWED_HEAD_SHA,
    ]);
    assert.deepEqual(verified, written, "CLI verify uses the expected identity without rewriting");
    await assert.rejects(() => run([
      "--dist", root,
      "--sha", SHA,
      "--source-tree-sha", SOURCE_TREE_SHA,
    ]), /reviewed|rollback/i, "ordinary CLI writes require an explicit reviewed head");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

{
  const root = await makePayload();
  const output = path.join(root, "marker-outputs.txt");
  await writeFile(output, "", "utf8");
  try {
    const result = await run([
      "--dist", root,
      "--sha", SHA,
      "--source-tree-sha", SOURCE_TREE_SHA,
      "--reviewed-head-sha", REVIEWED_HEAD_SHA,
    ], { GITHUB_OUTPUT: output });
    assert.equal(
      await readFile(output, "utf8"),
      `source_sha=${result.sha}\nsource_tree_sha=${result.sourceTreeSha}\nreviewed_head_sha=${result.reviewedHeadSha}\npayload_digest=${result.payloadDigest}\n`,
      "validated marker identity and digest are emitted as step outputs",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

console.log("immutable release marker tests passed");
