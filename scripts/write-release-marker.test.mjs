#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { writeReleaseMarker } from "./write-release-marker.mjs";

const SHA = "a".repeat(40);
const temporary = await mkdtemp(path.join(os.tmpdir(), "radulator-release-marker-"));
try {
  const result = await writeReleaseMarker({ distDir: temporary, sha: SHA });
  assert.equal(result.sha, SHA);
  const marker = JSON.parse(await readFile(result.path, "utf8"));
  assert.deepEqual(marker, { schema: "radulator-release/v1", sha: SHA });
  await assert.rejects(() => writeReleaseMarker({ distDir: temporary, sha: "main" }), /SHA/);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

console.log("immutable release marker tests passed");
