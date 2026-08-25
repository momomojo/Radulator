#!/usr/bin/env node
import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
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

function gitObjectMetadata(entry, pathName) {
  if (
    !entry ||
    typeof pathName !== "string" ||
    !pathName ||
    !/^[0-7]{6}$/.test(entry.mode || "") ||
    !["blob", "commit"].includes(entry.type) ||
    !GIT_OBJECT_PATTERN.test(entry.sha || "")
  ) {
    throw new Error(`Git object evidence is malformed for ${pathName}.`);
  }
  return {
    path: pathName,
    mode: entry.mode,
    type: entry.type,
    sha: entry.sha,
    size: Number.isSafeInteger(entry.size) && entry.size >= 0 ? entry.size : null,
  };
}

async function loadTree(request, token, owner, repo, commitSha) {
  const commit = await request(token, `/repos/${owner}/${repo}/git/commits/${commitSha}`);
  if (!GIT_OBJECT_PATTERN.test(commit?.tree?.sha || "")) {
    throw new Error(`Git commit ${commitSha} did not return an exact tree identity.`);
  }
  const tree = await request(token, `/repos/${owner}/${repo}/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree?.truncated || !Array.isArray(tree?.tree)) {
    throw new Error(`Git tree evidence for ${commitSha} is truncated or malformed.`);
  }
  return new Map(tree.tree.map((entry) => [entry.path, entry]));
}

async function objectEvidence({ request, token, owner, repo, entry, pathName, blobCache }) {
  if (!entry) return null;
  const evidence = gitObjectMetadata(entry, pathName);
  if (evidence.type !== "blob") return evidence;
  if (!Number.isSafeInteger(evidence.size) || evidence.size > MAX_REVIEW_BLOB_BYTES) {
    throw new Error(`Patchless blob ${pathName} is too large for bounded exact review evidence.`);
  }
  let blob = blobCache.get(evidence.sha);
  if (!blob) {
    blob = await request(token, `/repos/${owner}/${repo}/git/blobs/${evidence.sha}`);
    blobCache.set(evidence.sha, blob);
  }
  const content = typeof blob?.content === "string" ? blob.content.replace(/\s/g, "") : "";
  if (
    blob?.encoding !== "base64" ||
    !content ||
    !Number.isSafeInteger(blob.size) ||
    blob.size !== evidence.size ||
    Buffer.from(content, "base64").length !== evidence.size
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
  const missingPatch = files.filter((file) => typeof file?.patch !== "string");
  if (!missingPatch.length) return files;

  const [headTree, baseTree] = await Promise.all([
    loadTree(request, token, owner, repo, headSha),
    loadTree(request, token, owner, repo, baseSha),
  ]);
  const blobCache = new Map();
  const hydrated = [];
  for (const file of files) {
    if (typeof file?.patch === "string") {
      hydrated.push(file);
      continue;
    }
    const headPath = file.status === "removed" ? null : file.filename;
    const basePath = file.status === "added" ? null : (file.previousFilename || file.previous_filename || file.filename);
    const headEntry = headPath ? headTree.get(headPath) : null;
    const baseEntry = basePath ? baseTree.get(basePath) : null;
    if ((headPath && !headEntry) || (basePath && !baseEntry)) {
      throw new Error(`Exact Git object evidence is missing for ${file.filename}.`);
    }
    hydrated.push({
      ...file,
      reviewEvidence: {
        schema: FILE_REVIEW_EVIDENCE_SCHEMA,
        headSha,
        baseSha,
        head: await objectEvidence({ request, token, owner, repo, entry: headEntry, pathName: headPath, blobCache }),
        base: await objectEvidence({ request, token, owner, repo, entry: baseEntry, pathName: basePath, blobCache }),
      },
    });
  }
  return hydrated;
}

function completeReviewEvidence(files, headSha, baseSha) {
  return files.every((file) => {
    if (typeof file.patch === "string") return true;
    const evidence = file.reviewEvidence;
    return evidence?.schema === FILE_REVIEW_EVIDENCE_SCHEMA &&
      evidence.headSha === headSha &&
      evidence.baseSha === baseSha &&
      (file.status === "removed" ? evidence.head === null : GIT_OBJECT_PATTERN.test(evidence.head?.sha || "")) &&
      (file.status === "added" ? evidence.base === null : GIT_OBJECT_PATTERN.test(evidence.base?.sha || ""));
  });
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
    if (state.files.some((file) => typeof file.patch !== "string")) {
      if (typeof api.hydrateReviewEvidence !== "function") {
        throw new Error(`Patchless files for PR #${state.pr.number} require exact Git object evidence.`);
      }
      state.files = await api.hydrateReviewEvidence(state.pr, state.files);
    }
    if (!completeReviewEvidence(state.files, state.pr.headSha, state.pr.baseSha)) {
      throw new Error(`Exact file review evidence is incomplete for PR #${state.pr.number}.`);
    }
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
