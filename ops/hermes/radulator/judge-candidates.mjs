#!/usr/bin/env node
import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  ATTESTATION_MARKER,
  completeFileList,
  githubRequest,
  loadGateState,
  paged,
  validateCiPolicy,
} from "../../../scripts/independent-review-gate.mjs";
import {
  analyzeRisk,
  canonicalJson,
  digest,
  requiredJudgeRoles,
  verifyAttestation,
} from "../../../scripts/release-policy.mjs";
import { resolveCiIdentity } from "./github-ci-identity.mjs";
import { resolveGithubToken } from "./github-token.mjs";
import { loadPublicKeysFile } from "./public-keys.mjs";

export const CANDIDATE_SCHEMA = "radulator-judge-candidate/v1";
export const CLAIM_SCHEMA = "radulator-judge-claims/v1";
export const FILE_REVIEW_EVIDENCE_SCHEMA = "radulator-file-review-evidence/v1";

const GIT_OBJECT_PATTERN = /^[0-9a-f]{40}$/;
const MAX_REVIEW_BLOB_BYTES = 1_000_000;
const FILE_STATUSES = new Set(["added", "modified", "deleted", "removed", "renamed", "copied", "changed", "unchanged"]);
const REVIEW_BLOB_MODES = new Set(["100644", "100755", "120000"]);
const DELETED_STATUSES = new Set(["deleted", "removed"]);

function exactPath(value) {
  return typeof value === "string" && value.length > 0 && !value.includes("\0") && !value.startsWith("/") &&
    !value.includes("\\") && !value.split("/").some((part) => !part || part === "." || part === "..");
}

function previousFilename(file) {
  const camel = file?.previousFilename;
  const snake = file?.previous_filename;
  if (camel !== undefined && snake !== undefined && camel !== snake) {
    throw new Error(`GitHub file ${file?.filename || "unknown"} has conflicting previous-file paths.`);
  }
  return camel ?? snake ?? null;
}

function fileIdentity(file) {
  if (!file || typeof file !== "object" || Array.isArray(file) || !FILE_STATUSES.has(file.status) || !exactPath(file.filename)) {
    throw new Error("GitHub file review evidence has malformed status or path.");
  }
  const prior = previousFilename(file);
  if (file.status === "renamed") {
    if (!exactPath(prior) || prior === file.filename) throw new Error(`Renamed file ${file.filename} has malformed previous-file evidence.`);
  } else if (prior !== null) {
    throw new Error(`Non-renamed file ${file.filename} has unexpected previous-file evidence.`);
  }
  for (const key of ["additions", "deletions", "changes"]) {
    if (!Number.isSafeInteger(file[key]) || file[key] < 0) throw new Error(`GitHub file ${file.filename} has malformed ${key} evidence.`);
  }
  if (file.changes !== file.additions + file.deletions) {
    throw new Error(`GitHub file ${file.filename} changes count does not equal additions plus deletions.`);
  }
  if (file.status === "added" && file.deletions !== 0) {
    throw new Error(`Added file ${file.filename} has deletions; refusing ambiguous side binding.`);
  }
  if (DELETED_STATUSES.has(file.status) && file.additions !== 0) {
    throw new Error(`Deleted file ${file.filename} has additions; refusing ambiguous side binding.`);
  }
  if (file.patch !== null && file.patch !== undefined && typeof file.patch !== "string") {
    throw new Error(`GitHub file ${file.filename} patch evidence is malformed.`);
  }
  return { status: file.status, filename: file.filename, previousFilename: prior };
}

function hunkCount(start, count) {
  if (!/^(?:0|[1-9]\d*)$/.test(start) || (count !== undefined && !/^(?:0|[1-9]\d*)$/.test(count))) return null;
  const startNumber = Number(start);
  const countNumber = count === undefined ? 1 : Number(count);
  return Number.isSafeInteger(startNumber) && Number.isSafeInteger(countNumber) && countNumber >= 0 &&
    (countNumber === 0 ? startNumber === 0 : startNumber >= 1) ? countNumber : null;
}

function patchIsExact(file) {
  if (typeof file.patch !== "string" || !file.patch) return false;
  const lines = file.patch.split("\n");
  if (lines.at(-1) === "") lines.pop();
  let hunk = null;
  let additions = 0;
  let deletions = 0;
  let sawHunk = false;
  const completeHunk = () => hunk && hunk.oldSeen === hunk.oldCount && hunk.newSeen === hunk.newCount;
  for (const line of lines) {
    const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: .*)?$/);
    if (match) {
      if (hunk && !completeHunk()) return false;
      const oldCount = hunkCount(match[1], match[2]);
      const newCount = hunkCount(match[3], match[4]);
      if (oldCount === null || newCount === null || (oldCount === 0 && newCount === 0)) return false;
      hunk = { oldCount, newCount, oldSeen: 0, newSeen: 0 };
      sawHunk = true;
      continue;
    }
    if (!hunk) return false;
    if (line === "\\ No newline at end of file") continue;
    if (line.startsWith("+")) {
      additions += 1;
      hunk.newSeen += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
      hunk.oldSeen += 1;
    } else if (line.startsWith(" ")) {
      hunk.oldSeen += 1;
      hunk.newSeen += 1;
    } else {
      return false;
    }
  }
  return sawHunk && completeHunk() && additions === file.additions && deletions === file.deletions &&
    file.changes === additions + deletions;
}

function needsHydration(file) {
  fileIdentity(file);
  return !patchIsExact(file);
}

function exactBase64(value) {
  if (typeof value !== "string" || /\s/.test(value)) return null;
  const bytes = Buffer.from(value, "base64");
  return bytes.toString("base64") === value ? bytes : null;
}

function gitBlobSha(bytes) {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

function deletedFile(file) {
  return DELETED_STATUSES.has(file.status);
}

function addedFile(file) {
  return file.status === "added";
}

function expectedReviewPath(file, side) {
  if (side === "head") return deletedFile(file) ? null : file.filename;
  return addedFile(file) ? null : previousFilename(file) || file.filename;
}

function reviewObjectEvidence(side, pathName, fileName) {
  if (pathName === null) {
    if (side !== null) throw new Error(`Review evidence for ${fileName} has an unexpected non-null side.`);
    return;
  }
  if (
    !side || typeof side !== "object" || Array.isArray(side) ||
    side.path !== pathName ||
    !REVIEW_BLOB_MODES.has(side.mode) ||
    side.type !== "blob" ||
    !GIT_OBJECT_PATTERN.test(side.sha || "") ||
    !Number.isSafeInteger(side.size) || side.size < 0 || side.size > MAX_REVIEW_BLOB_BYTES ||
    side.encoding !== "base64"
  ) {
    throw new Error(`Review evidence metadata is malformed for ${fileName}.`);
  }
  const bytes = exactBase64(side.content);
  if (!bytes || bytes.length !== side.size || gitBlobSha(bytes) !== side.sha) {
    throw new Error(`Review evidence blob binding is malformed for ${fileName}.`);
  }
}

function validateReviewEvidence(file, headSha, baseSha) {
  fileIdentity(file);
  const evidence = file.reviewEvidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence) ||
    evidence.schema !== FILE_REVIEW_EVIDENCE_SCHEMA ||
    evidence.headSha !== headSha || evidence.baseSha !== baseSha ||
    evidence.status !== file.status) {
    throw new Error(`Exact review evidence is malformed or cross-bound for ${file.filename}.`);
  }
  reviewObjectEvidence(evidence.head, expectedReviewPath(file, "head"), file.filename);
  reviewObjectEvidence(evidence.base, expectedReviewPath(file, "base"), file.filename);
}

function fileIdentityKey(file) {
  const identity = fileIdentity(file);
  return [
    identity.status,
    identity.filename,
    identity.previousFilename,
    file.additions,
    file.deletions,
    file.changes,
  ];
}

function assertUniqueChangedFiles(files, context = "Changed-file") {
  if (!Array.isArray(files)) throw new Error(`${context} list is malformed.`);
  const identities = new Set();
  const currentPaths = new Set();
  for (const file of files) {
    const identity = fileIdentityKey(file);
    const identityKey = JSON.stringify(identity);
    if (identities.has(identityKey)) {
      throw new Error(`${context} list contains a duplicate changed-file identity for ${identity[1]}.`);
    }
    identities.add(identityKey);
    if (currentPaths.has(identity[1])) {
      throw new Error(`${context} list contains a duplicate current changed-file path for ${identity[1]}.`);
    }
    currentPaths.add(identity[1]);
  }
}

function sameFileIdentities(beforeKeys, after) {
  return Array.isArray(after) && after.length === beforeKeys.length &&
    beforeKeys.every((key, index) => JSON.stringify(key) === JSON.stringify(fileIdentityKey(after[index])));
}

function gitObjectMetadata(entry, pathName) {
  if (
    !entry ||
    entry.path !== pathName ||
    typeof pathName !== "string" ||
    !pathName ||
    !REVIEW_BLOB_MODES.has(entry.mode) ||
    entry.type !== "blob" ||
    !GIT_OBJECT_PATTERN.test(entry.sha || "") ||
    !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_REVIEW_BLOB_BYTES
  ) {
    throw new Error(`Git object evidence is malformed for ${pathName}.`);
  }
  return {
    path: pathName,
    mode: entry.mode,
    type: entry.type,
    sha: entry.sha,
    size: entry.size,
  };
}

async function loadTree(request, token, owner, repo, commitSha) {
  const commit = await request(token, `/repos/${owner}/${repo}/git/commits/${commitSha}`);
  if (commit?.sha !== commitSha || !GIT_OBJECT_PATTERN.test(commit?.tree?.sha || "")) {
    throw new Error(`Git commit ${commitSha} did not return an exact tree identity.`);
  }
  const treeSha = commit.tree.sha;
  const tree = await request(token, `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
  if (tree?.sha !== treeSha || tree?.truncated !== false || !Array.isArray(tree?.tree)) {
    throw new Error(`Git tree evidence for ${commitSha} is truncated or malformed.`);
  }
  const entries = new Map();
  for (const entry of tree.tree) {
    if (!entry || !exactPath(entry.path) || entries.has(entry.path)) {
      throw new Error(`Git tree evidence for ${commitSha} has a duplicate or malformed path.`);
    }
    entries.set(entry.path, entry);
  }
  return entries;
}

async function objectEvidence({ request, token, owner, repo, entry, pathName, blobCache }) {
  if (!entry) return null;
  const evidence = gitObjectMetadata(entry, pathName);
  let blob = blobCache.get(evidence.sha);
  if (!blob) {
    blob = await request(token, `/repos/${owner}/${repo}/git/blobs/${evidence.sha}`);
    blobCache.set(evidence.sha, blob);
  }
  const content = blob?.content;
  const bytes = exactBase64(content);
  if (
    blob?.sha !== evidence.sha ||
    blob?.encoding !== "base64" ||
    !bytes ||
    !Number.isSafeInteger(blob.size) ||
    blob.size !== evidence.size ||
    bytes.length !== evidence.size ||
    gitBlobSha(bytes) !== evidence.sha
  ) {
    throw new Error(`Patchless blob content is malformed for ${pathName}.`);
  }
  return { ...evidence, encoding: "base64", content };
}

export async function hydratePatchlessReviewEvidence({
  token,
  owner,
  repo,
  headSha,
  baseSha,
  files,
  request = githubRequest,
}) {
  if (
    !token ||
    !owner ||
    !repo ||
    !GIT_OBJECT_PATTERN.test(headSha || "") ||
    !GIT_OBJECT_PATTERN.test(baseSha || "") ||
    !Array.isArray(files)
  ) {
    throw new Error("Patchless review-evidence identity is malformed.");
  }
  assertUniqueChangedFiles(files, "Patchless review-evidence");
  const hydration = files.map((file) => ({ file, required: needsHydration(file) }));
  if (!hydration.some(({ required }) => required)) {
    for (const { file } of hydration) {
      if (file.reviewEvidence !== undefined) validateReviewEvidence(file, headSha, baseSha);
    }
    assertUniqueChangedFiles(files, "Patchless review-evidence");
    return files;
  }

  const [headTree, baseTree] = await Promise.all([
    loadTree(request, token, owner, repo, headSha),
    loadTree(request, token, owner, repo, baseSha),
  ]);
  const blobCache = new Map();
  const hydrated = [];
  for (const { file, required } of hydration) {
    if (!required) {
      hydrated.push(file);
      continue;
    }
    const headPath = expectedReviewPath(file, "head");
    const basePath = expectedReviewPath(file, "base");
    const headEntry = headPath ? headTree.get(headPath) : null;
    const baseEntry = basePath ? baseTree.get(basePath) : null;
    if ((headPath && !headEntry) || (basePath && !baseEntry)) {
      throw new Error(`Exact Git object evidence is missing for ${file.filename}.`);
    }
    hydrated.push({
      ...file,
      patch: null,
      reviewEvidence: {
        schema: FILE_REVIEW_EVIDENCE_SCHEMA,
        status: file.status,
        headSha,
        baseSha,
        head: await objectEvidence({ request, token, owner, repo, entry: headEntry, pathName: headPath, blobCache }),
        base: await objectEvidence({ request, token, owner, repo, entry: baseEntry, pathName: basePath, blobCache }),
      },
    });
  }
  assertUniqueChangedFiles(hydrated, "Hydrated review-evidence");
  return hydrated;
}

function completeReviewEvidence(files, headSha, baseSha) {
  for (const file of files) {
    fileIdentity(file);
    if (typeof file.patch === "string") {
      if (!patchIsExact(file)) throw new Error(`Changed-file patch evidence is incomplete for ${file.filename}.`);
      if (file.reviewEvidence !== undefined) validateReviewEvidence(file, headSha, baseSha);
      continue;
    }
    if (file.patch !== null) throw new Error(`Changed-file patch evidence is malformed for ${file.filename}.`);
    validateReviewEvidence(file, headSha, baseSha);
  }
  return true;
}

function exactState(state, risk) {
  return {
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
}

function parseCarrier(body) {
  if (typeof body !== "string" || !body.includes(ATTESTATION_MARKER)) return null;
  const suffix = body.slice(body.indexOf(ATTESTATION_MARKER) + ATTESTATION_MARKER.length).trim();
  const fenced = suffix.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
  try {
    return JSON.parse(fenced ? fenced[1] : suffix);
  } catch {
    return { malformed: true };
  }
}

function newestByRole(state, publicKeys, exact) {
  const verifiedByRole = new Map();
  for (const review of state.reviews || []) {
    const record = parseCarrier(review.body);
    if (!record || record.malformed) continue;
    if (
      record.repository_id !== exact.repositoryId ||
      record.pr !== exact.pr ||
      record.head_sha !== exact.headSha ||
      record.base_sha !== exact.baseSha ||
      record.base_ref !== exact.baseRef
    ) continue;
    const verified = verifyAttestation(record, publicKeys, exact);
    if (!verified.ok) continue;
    const role = verified.record.judge.role;
    if (!verifiedByRole.has(role)) verifiedByRole.set(role, []);
    verifiedByRole.get(role).push(verified.record);
  }
  const newest = new Map();
  for (const [role, records] of verifiedByRole) {
    const terminal = records.find((record) => record.verdict === "NEEDS_FIX");
    if (terminal) {
      newest.set(role, terminal);
      continue;
    }
    const passes = records.filter((record) => record.verdict === "PASS");
    if (!passes.length) continue;
    const newestTime = Math.max(...passes.map((record) => Date.parse(record.reviewed_at)));
    const newestDistinct = new Map(
      passes
        .filter((record) => Date.parse(record.reviewed_at) === newestTime)
        .map((record) => [canonicalJson(record), record]),
    );
    if (newestDistinct.size === 1) newest.set(role, newestDistinct.values().next().value);
  }
  return newest;
}

function shouldReview(role, risk, existing) {
  const primary = existing.get("primary");
  if (primary?.verdict === "NEEDS_FIX") return false;
  if (role === "primary") return !primary;
  if (role === "verification") {
    return risk.tier === "high" && primary?.verdict === "PASS" && !existing.get("verification");
  }
  throw new Error(`Unsupported judge role: ${role}`);
}

function candidate(repository, role, state, risk, riskDetails, exact, now) {
  const requiredRoles = requiredJudgeRoles(risk.tier);
  const candidateId = digest({ repository, role, exact });
  return {
    schema: CANDIDATE_SCHEMA,
    candidateId,
    repository,
    role,
    requiredRoles,
    collectedAt: now,
    pr: state.pr.number,
    title: state.pr.title || "",
    body: state.pr.body || "",
    url: state.pr.url || `https://github.com/${repository}/pull/${state.pr.number}`,
    headSha: state.pr.headSha,
    baseSha: state.pr.baseSha,
    baseRef: state.pr.baseRef,
    risk,
    riskDetails,
    exactState: exact,
    files: state.files,
    ci: state.ci,
  };
}

export async function collectCandidates({ repository, role, publicKeys, api, now = new Date().toISOString() }) {
  if (!["primary", "verification"].includes(role)) throw new Error("role must be primary or verification.");
  const open = await api.listOpenPrs();
  const candidates = [];
  for (const pr of open) {
    const labels = new Set((pr.labels || []).map((label) => `${label.name || label}`.toLowerCase()));
    if (!labels.has("ready-for-gate")) continue;
    const state = await api.loadGateState(pr.number);
    if (!state.ci?.ok || !completeFileList(state.pr, state.files)) continue;
    const sourceFiles = state.files;
    assertUniqueChangedFiles(sourceFiles, `PR #${state.pr.number} changed-file`);
    const hydration = sourceFiles.map((file) => needsHydration(file));
    const sourceIdentityKeys = sourceFiles.map(fileIdentityKey);
    if (hydration.some(Boolean)) {
      if (typeof api.hydrateReviewEvidence !== "function") {
        throw new Error(`Incomplete or malformed patches for PR #${state.pr.number} require exact Git object evidence.`);
      }
      state.files = await api.hydrateReviewEvidence(state.pr, sourceFiles);
      assertUniqueChangedFiles(state.files, `PR #${state.pr.number} hydrated changed-file`);
      if (!sameFileIdentities(sourceIdentityKeys, state.files)) {
        throw new Error(`Exact hydration changed the changed-file identity for PR #${state.pr.number}.`);
      }
      if (!completeFileList(state.pr, state.files)) {
        throw new Error(`Exact hydration returned an incomplete file list for PR #${state.pr.number}.`);
      }
      state.files.forEach((file, index) => {
        if (hydration[index] && (file.patch !== null || file.reviewEvidence === undefined)) {
          throw new Error(`Exact hydration returned incomplete evidence for ${file.filename}.`);
        }
      });
    }
    completeReviewEvidence(state.files, state.pr.headSha, state.pr.baseSha);
    if (!validateCiPolicy(state).ok) continue;
    const { risk, details: riskDetails } = analyzeRisk(state.files, state.pr);
    const exact = exactState(state, risk);
    const existing = newestByRole(state, publicKeys, exact);
    if (shouldReview(role, risk, existing)) {
      candidates.push(candidate(repository, role, state, risk, riskDetails, exact, now));
    }
  }
  return candidates.sort((left, right) => left.pr - right.pr || left.candidateId.localeCompare(right.candidateId));
}

export function selectCandidateBatch(candidates, limit = 1) {
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("Candidate batch limit must be a positive integer.");
  if (limit !== 1) throw new Error("Candidate batch limit must be exactly one.");
  return candidates.slice(0, 1);
}

async function readClaimState(stateFile, role) {
  let source;
  try {
    source = await readFile(stateFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { schema: CLAIM_SCHEMA, role, active: null, candidates: {} };
    throw error;
  }
  const state = JSON.parse(source);
  if (
    state?.schema !== CLAIM_SCHEMA ||
    state.role !== role ||
    (state.active !== null && typeof state.active !== "object") ||
    !state.candidates ||
    typeof state.candidates !== "object" ||
    Array.isArray(state.candidates)
  ) {
    throw new Error(`Judge claim state is invalid for ${role}: ${stateFile}`);
  }
  return state;
}

async function writeClaimState(stateFile, state) {
  const temporary = `${stateFile}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, stateFile);
}

function advisoryLockCommand(lockFile) {
  const holder = [
    'process.stdout.write("LOCKED\\n")',
    "process.stdin.resume()",
    'process.stdin.on("end", () => process.exit(0))',
  ].join(";");
  if (process.platform === "darwin") {
    return { command: "/usr/bin/lockf", args: ["-t", "0", lockFile, process.execPath, "-e", holder] };
  }
  if (process.platform === "linux") {
    return { command: "/usr/bin/flock", args: ["-n", lockFile, process.execPath, "-e", holder] };
  }
  throw new Error(`Unsupported platform for advisory judge locking: ${process.platform}`);
}

async function acquireClaimLock(lockFile) {
  await writeFile(lockFile, "", { flag: "a", mode: 0o600 });
  await chmod(lockFile, 0o600);
  const { command, args } = advisoryLockCommand(lockFile);
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Timed out acquiring advisory judge lock: ${lockFile}`));
    }, 5_000);
    child.stdout.on("data", (chunk) => {
      if (settled) return;
      stdout += chunk.toString("utf8");
      if (!stdout.includes("LOCKED\n")) return;
      settled = true;
      clearTimeout(timeout);
      resolve(async () => {
        if (child.exitCode !== null) return;
        child.stdin.end();
        await new Promise((done) => child.once("exit", done));
      });
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-1_000);
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Unable to start advisory judge lock: ${error.message}`));
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) reject(new Error(`Advisory judge lock exited before ownership readback: ${lockFile}`));
      else if (!stderr.trim() || /already locked|temporarily unavailable|would block/i.test(stderr)) resolve(null);
      else reject(new Error(`Advisory judge lock failed: ${stderr.trim()}`));
    });
  });
}

export async function claimNextCandidate(candidates, {
  role,
  stateFile,
  nowMs = Date.now(),
  leaseMs = 30 * 60 * 1000,
  retryLimit = 2,
  cooldownMs = 60 * 60 * 1000,
} = {}) {
  if (!["primary", "verification"].includes(role)) throw new Error("Claim role must be primary or verification.");
  if (typeof stateFile !== "string" || !path.isAbsolute(stateFile)) throw new Error("Claim stateFile must be absolute.");
  for (const [label, value] of Object.entries({ nowMs, leaseMs, retryLimit, cooldownMs })) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
  }
  if (!Array.isArray(candidates) || candidates.some((item) => typeof item?.candidateId !== "string" || !item.candidateId)) {
    throw new Error("Claim candidates must have candidateId values.");
  }

  await mkdir(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  const lockFile = `${stateFile}.lock`;
  const releaseLock = await acquireClaimLock(lockFile);
  if (!releaseLock) return { candidate: null, reason: "claim-lock-busy" };

  try {
    const state = await readClaimState(stateFile, role);
    const currentIds = new Set(candidates.map((item) => item.candidateId));
    for (const candidateId of Object.keys(state.candidates)) {
      if (!currentIds.has(candidateId)) delete state.candidates[candidateId];
    }
    if (state.active && !currentIds.has(state.active.candidateId)) state.active = null;

    if (state.active && Number(state.active.leaseUntil) > nowMs) {
      await writeClaimState(stateFile, state);
      return {
        candidate: null,
        reason: "active-lease",
        activeCandidateId: state.active.candidateId,
        leaseUntil: state.active.leaseUntil,
      };
    }
    state.active = null;

    let selected = null;
    for (const item of candidates) {
      const record = state.candidates[item.candidateId] || { attempts: 0, cooldownUntil: null };
      state.candidates[item.candidateId] = record;
      if (Number(record.cooldownUntil) > nowMs) continue;
      if (record.cooldownUntil) {
        record.attempts = 0;
        record.cooldownUntil = null;
      }
      if (record.attempts >= retryLimit) {
        record.cooldownUntil = nowMs + cooldownMs;
        continue;
      }
      selected = item;
      break;
    }

    if (!selected) {
      await writeClaimState(stateFile, state);
      return { candidate: null, reason: candidates.length ? "retry-cooldown" : "empty-backlog" };
    }

    const leaseUntil = nowMs + leaseMs;
    const record = state.candidates[selected.candidateId];
    record.attempts += 1;
    record.lastClaimedAt = nowMs;
    record.leaseUntil = leaseUntil;
    state.active = { candidateId: selected.candidateId, leaseUntil };
    await writeClaimState(stateFile, state);
    return { candidate: selected, reason: "claimed", leaseUntil, attempt: record.attempts };
  } finally {
    await releaseLock();
  }
}

export async function writeCandidateCache(cacheDir, candidates) {
  await mkdir(cacheDir, { recursive: true });
  const paths = [];
  for (const item of candidates) {
    const destination = path.join(cacheDir, `${item.candidateId}.json`);
    const serialized = `${JSON.stringify(item, null, 2)}\n`;
    let current = null;
    try {
      current = await readFile(destination, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (current !== serialized) {
      const temporary = `${destination}.tmp-${process.pid}`;
      await writeFile(temporary, serialized, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, destination);
    }
    paths.push(destination);
  }
  return paths;
}

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

function requiredArgument(name) {
  const value = argument(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function run() {
  const token = resolveGithubToken();
  const repository = argument("--repo", process.env.PIPELINE_REPO || "momomojo/Radulator");
  const role = argument("--role");
  const limit = Number(argument("--limit", "1"));
  const cacheDir = argument("--cache-dir", path.join(process.env.HERMES_HOME || process.cwd(), "state", "radulator-judge-candidates"));
  const claimStateFile = argument(
    "--claim-state-file",
    path.join(process.env.HERMES_HOME || process.cwd(), "state", "radulator-judge-claims", `${role}.json`),
  );
  if (!token || !repository.includes("/") || !role) throw new Error("GitHub token, --repo, and --role are required.");
  selectCandidateBatch([], limit);
  const [owner, repo] = repository.split("/");
  const publicKeys = await loadPublicKeysFile(requiredArgument("--public-keys-file"));
  const ciIdentity = await resolveCiIdentity({ token, owner, repo });
  const config = {
    ...ciIdentity,
    publicKeys,
  };
  const api = {
    async listOpenPrs() {
      const [develop, main] = await Promise.all([
        paged(token, `/repos/${owner}/${repo}/pulls?state=open&base=develop`),
        paged(token, `/repos/${owner}/${repo}/pulls?state=open&base=main`),
      ]);
      return [...develop, ...main];
    },
    loadGateState: (prNumber) => loadGateState(token, owner, repo, prNumber, config),
    hydrateReviewEvidence: (pr, files) => hydratePatchlessReviewEvidence({
      token,
      owner,
      repo,
      headSha: pr.headSha,
      baseSha: pr.baseSha,
      files,
    }),
  };
  // Prove the token reaches the intended repository without printing it.
  await githubRequest(token, `/repos/${owner}/${repo}`);
  const backlog = await collectCandidates({ repository, role, publicKeys, api });
  const claim = await claimNextCandidate(backlog, { role, stateFile: claimStateFile });
  const candidates = claim.candidate ? [claim.candidate] : [];
  const cachedPaths = await writeCandidateCache(cacheDir, candidates);
  console.log(JSON.stringify({
    schema: CANDIDATE_SCHEMA,
    role,
    count: candidates.length,
    backlogCount: backlog.length,
    remainingCount: backlog.length - candidates.length,
    claim: { ...claim, candidate: undefined },
    cachedPaths,
    candidates,
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
