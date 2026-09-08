#!/usr/bin/env node
import { createHash } from "node:crypto";
import { appendFile, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const EXCLUDED_DIRECTORIES = new Set([".git", ".github", "node_modules"]);
export const RELEASE_MARKER_SCHEMA = "radulator-release/v1";

function isSha(value) {
  return SHA_PATTERN.test(value || "");
}

function isDigest(value) {
  return DIGEST_PATTERN.test(value || "");
}

function relativePosix(root, target, { allowRoot = false } = {}) {
  const relative = path.relative(root, target);
  if ((!allowRoot && !relative) || path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    throw new Error("Release marker payload traversal is not allowed.");
  }
  return relative.split(path.sep).join("/");
}

async function requireRoot(distDir) {
  if (typeof distDir !== "string" || !distDir) throw new Error("Release marker requires a dist directory.");
  const root = path.resolve(distDir);
  const details = await lstat(root);
  if (details.isSymbolicLink() || !details.isDirectory()) {
    throw new Error("Release marker destination must be a real completed build directory.");
  }
  return root;
}

async function assertSafeDirectoryChain(root, target) {
  const relative = relativePosix(root, target, { allowRoot: true });
  let current = root;
  if (!relative) return;
  for (const component of relative.split("/")) {
    current = path.join(current, component);
    let details;
    try {
      details = await lstat(current);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    if (details.isSymbolicLink()) throw new Error("Release marker destination cannot traverse a symlink.");
    if (!details.isDirectory()) throw new Error("Release marker destination parent must be a directory.");
  }
}

function validateIdentity({ sha, sourceTreeSha, reviewedHeadSha }) {
  if (!isSha(sha)) throw new Error("Release marker requires an immutable 40-character SHA.");
  if (!isSha(sourceTreeSha)) throw new Error("Release marker requires an immutable source tree SHA.");
  if (reviewedHeadSha === undefined) {
    throw new Error("Release marker requires a reviewed head SHA or explicit rollback null.");
  }
  if (reviewedHeadSha !== null && !isSha(reviewedHeadSha)) {
    throw new Error("Release marker reviewed head SHA must be immutable or null for rollback.");
  }
}

function validateManifestEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
    Object.keys(entry).sort().join(",") !== "path,sha256,size" ||
    typeof entry.path !== "string" || !entry.path || entry.path.startsWith("/") ||
    entry.path.includes("\\") || entry.path === "." || entry.path.startsWith("../") || entry.path.includes("/../") ||
    !Number.isSafeInteger(entry.size) || entry.size < 0 || !isDigest(entry.sha256)) {
    throw new Error("Release marker payload manifest is malformed.");
  }
}

function validateManifest(manifest) {
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error("Release marker payload manifest must contain regular files.");
  }
  for (const entry of manifest) validateManifestEntry(entry);
  for (let index = 1; index < manifest.length; index += 1) {
    if (manifest[index - 1].path >= manifest[index].path) {
      throw new Error("Release marker payload manifest must be canonically sorted and unique.");
    }
  }
}

export function canonicalManifestJson(manifest) {
  validateManifest(manifest);
  return JSON.stringify(manifest);
}

export function payloadDigest(manifest) {
  return createHash("sha256").update(canonicalManifestJson(manifest), "utf8").digest("hex");
}

export async function buildPayloadManifest({ distDir, sha }) {
  if (!isSha(sha)) throw new Error("Release marker requires an immutable 40-character SHA.");
  const root = await requireRoot(distDir);
  const markerRelative = `releases/${sha}.json`;
  const entries = [];

  async function visit(current) {
    const details = await lstat(current);
    if (details.isSymbolicLink()) throw new Error("Release marker payload cannot contain symlinks.");
    const relative = relativePosix(root, current, { allowRoot: true });
    if (relative && EXCLUDED_DIRECTORIES.has(path.posix.basename(relative))) {
      throw new Error(`Release marker payload contains reserved uploader entry: ${relative}`);
    }
    if (details.isDirectory()) {
      const children = await readdir(current);
      for (const child of children) {
        if (!child || child === "." || child === "..") throw new Error("Release marker payload traversal is not allowed.");
        const childPath = path.resolve(current, child);
        relativePosix(root, childPath);
        await visit(childPath);
      }
      return;
    }
    if (!details.isFile()) throw new Error("Release marker payload cannot contain special files.");
    if (relative === markerRelative) return;
    const bytes = await readFile(current);
    entries.push({ path: relative, size: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
  }

  await visit(root);
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  validateManifest(entries);
  return entries;
}

async function markerDestination(root, sha, { requireExisting = false } = {}) {
  const releases = path.join(root, "releases");
  await assertSafeDirectoryChain(root, releases);
  if (!requireExisting) await mkdir(releases, { recursive: true });
  await assertSafeDirectoryChain(root, releases);
  const destination = path.join(releases, `${sha}.json`);
  relativePosix(root, destination);
  let details;
  try {
    details = await lstat(destination);
  } catch (error) {
    if (error?.code === "ENOENT" && !requireExisting) return destination;
    if (error?.code === "ENOENT") throw new Error("Release marker is missing.");
    throw error;
  }
  if (details.isSymbolicLink()) throw new Error("Release marker destination cannot be a symlink.");
  if (!details.isFile()) throw new Error("Release marker destination must be a regular file.");
  return destination;
}

function markerIdentityMatches(marker, { sha, sourceTreeSha, reviewedHeadSha }) {
  return marker?.schema === RELEASE_MARKER_SCHEMA && marker.sha === sha &&
    marker.sourceTreeSha === sourceTreeSha && marker.reviewedHeadSha === reviewedHeadSha;
}

function validateMarker(marker, expected) {
  validateIdentity(expected);
  if (!markerIdentityMatches(marker, expected) || !isDigest(marker?.payloadDigest)) {
    throw new Error("Release marker identity or digest mismatch.");
  }
  validateManifest(marker.payloadManifest);
  if (payloadDigest(marker.payloadManifest) !== marker.payloadDigest) {
    throw new Error("Release marker payload digest mismatch.");
  }
}

export async function writeReleaseMarker({ distDir, sha, sourceTreeSha, reviewedHeadSha }) {
  validateIdentity({ sha, sourceTreeSha, reviewedHeadSha });
  const root = await requireRoot(distDir);
  const payloadManifest = await buildPayloadManifest({ distDir: root, sha });
  const marker = {
    schema: RELEASE_MARKER_SCHEMA,
    sha,
    sourceTreeSha,
    reviewedHeadSha,
    payloadManifest,
    payloadDigest: payloadDigest(payloadManifest),
  };
  const destination = await markerDestination(root, sha);
  await writeFile(destination, `${JSON.stringify(marker)}\n`, "utf8");
  return { ...marker, path: destination };
}

export async function verifyReleaseMarker({ distDir, sha, sourceTreeSha, reviewedHeadSha }) {
  validateIdentity({ sha, sourceTreeSha, reviewedHeadSha });
  const root = await requireRoot(distDir);
  const destination = await markerDestination(root, sha, { requireExisting: true });
  let marker;
  try {
    marker = JSON.parse(await readFile(destination, "utf8"));
  } catch (error) {
    throw new Error(`Release marker is not valid JSON: ${error.message}`);
  }
  validateMarker(marker, { sha, sourceTreeSha, reviewedHeadSha });
  const payloadManifest = await buildPayloadManifest({ distDir: root, sha });
  if (JSON.stringify(payloadManifest) !== JSON.stringify(marker.payloadManifest)) {
    throw new Error("Release marker payload manifest does not match the current dist payload.");
  }
  return { ...marker, path: destination };
}

function argument(name, args) {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null;
}

function requiredArgument(name, args) {
  const value = argument(name, args);
  if (!value) throw new Error(`Release marker requires ${name}.`);
  return value;
}

export async function run(args = process.argv.slice(2), env = process.env) {
  const rollback = args.includes("--rollback");
  if (rollback && argument("--reviewed-head-sha", args) !== null) {
    throw new Error("Release marker rollback cannot also provide a reviewed head SHA.");
  }
  const options = {
    distDir: requiredArgument("--dist", args),
    sha: requiredArgument("--sha", args),
    sourceTreeSha: requiredArgument("--source-tree-sha", args),
    reviewedHeadSha: rollback ? null : (argument("--reviewed-head-sha", args) ?? undefined),
  };
  const result = args.includes("--verify")
    ? await verifyReleaseMarker(options)
    : await writeReleaseMarker(options);
  if (env.GITHUB_OUTPUT) {
    await appendFile(
      env.GITHUB_OUTPUT,
      `source_sha=${result.sha}\nsource_tree_sha=${result.sourceTreeSha}\nreviewed_head_sha=${result.reviewedHeadSha ?? ""}\npayload_digest=${result.payloadDigest}\n`,
      "utf8",
    );
  }
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
