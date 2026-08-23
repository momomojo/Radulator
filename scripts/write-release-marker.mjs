#!/usr/bin/env node
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
export const RELEASE_MARKER_SCHEMA = "radulator-release/v1";

export async function writeReleaseMarker({ distDir, sha }) {
  if (!SHA_PATTERN.test(sha || "")) throw new Error("Release marker requires an immutable 40-character SHA.");
  const root = path.resolve(distDir || "");
  const details = await stat(root);
  if (!details.isDirectory()) throw new Error("Release marker destination must be the completed build directory.");
  const releases = path.join(root, "releases");
  await mkdir(releases, { recursive: true });
  const destination = path.join(releases, `${sha}.json`);
  const marker = { schema: RELEASE_MARKER_SCHEMA, sha };
  await writeFile(destination, `${JSON.stringify(marker)}\n`, "utf8");
  return { ...marker, path: destination };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

async function run() {
  const result = await writeReleaseMarker({ distDir: argument("--dist"), sha: argument("--sha") });
  console.log(JSON.stringify(result));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
