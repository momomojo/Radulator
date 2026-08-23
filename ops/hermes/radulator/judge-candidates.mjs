#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
import { loadPublicKeysFile } from "./public-keys.mjs";

export const CANDIDATE_SCHEMA = "radulator-judge-candidate/v1";

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
    const { risk, details: riskDetails } = analyzeRisk(state.files, state.pr);
    const exact = exactState(state, risk);
    const existing = newestByRole(state, publicKeys, exact);
    if (shouldReview(role, risk, existing)) {
      candidates.push(candidate(repository, role, state, risk, riskDetails, exact, now));
    }
  }
  return candidates.sort((left, right) => left.pr - right.pr || left.candidateId.localeCompare(right.candidateId));
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
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  const repository = argument("--repo", process.env.PIPELINE_REPO || "momomojo/Radulator");
  const role = argument("--role");
  const cacheDir = argument("--cache-dir", path.join(process.env.HERMES_HOME || process.cwd(), "state", "radulator-judge-candidates"));
  if (!token || !repository.includes("/") || !role) throw new Error("GitHub token, --repo, and --role are required.");
  const [owner, repo] = repository.split("/");
  const publicKeys = await loadPublicKeysFile(requiredArgument("--public-keys-file"));
  const config = {
    expectedWorkflowId: Number(process.env.RADULATOR_E2E_WORKFLOW_ID || 0),
    expectedCiAppId: Number(process.env.RADULATOR_CI_APP_ID || 15368),
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
  };
  // Prove the token reaches the intended repository without printing it.
  await githubRequest(token, `/repos/${owner}/${repo}`);
  const candidates = await collectCandidates({ repository, role, publicKeys, api });
  const cachedPaths = await writeCandidateCache(cacheDir, candidates);
  console.log(JSON.stringify({ schema: CANDIDATE_SCHEMA, role, count: candidates.length, cachedPaths, candidates }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
