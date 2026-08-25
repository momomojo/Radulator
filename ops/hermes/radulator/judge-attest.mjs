#!/usr/bin/env node
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
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
} from "../../../scripts/independent-review-gate.mjs";
import {
  ATTESTATION_SCHEMA,
  canonicalJson,
  classifyRisk,
  digest,
  publicKeyFingerprint,
  verifyAttestation,
} from "../../../scripts/release-policy.mjs";
import { CANDIDATE_SCHEMA } from "./judge-candidates.mjs";
import { resolveCiIdentity } from "./github-ci-identity.mjs";
import { resolveGithubToken } from "./github-token.mjs";
import { loadPublicKeysFile } from "./public-keys.mjs";

const MAX_ANALYSIS_BYTES = 8000;
const MAX_CITATIONS = 16;
const MAX_CITATION_BYTES = 1024;
const MAX_CARRIER_BYTES = 50_000;

export async function atomicWrite(destination, content, mode) {
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = `${destination}.tmp-${process.pid}`;
  await writeFile(temporary, content, { encoding: "utf8", mode });
  await chmod(temporary, mode);
  await rename(temporary, destination);
}

export async function generateKeyPairFiles({ directory, keyId, role, profile }) {
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(keyId || "")) throw new Error("keyId is malformed.");
  if (!["primary", "verification"].includes(role)) throw new Error("role must be primary or verification.");
  if (typeof profile !== "string" || !profile) throw new Error("profile is required.");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const privateKeyPath = path.join(directory, `${keyId}.private.pem`);
  const publicKeyPath = path.join(directory, `${keyId}.public.pem`);
  const [privateResult, publicResult] = await Promise.allSettled([
    readFile(privateKeyPath, "utf8"),
    readFile(publicKeyPath, "utf8"),
  ]);
  const missingPrivate = privateResult.status === "rejected" && privateResult.reason.code === "ENOENT";
  const missingPublic = publicResult.status === "rejected" && publicResult.reason.code === "ENOENT";
  if (privateResult.status === "rejected" && !missingPrivate) throw privateResult.reason;
  if (publicResult.status === "rejected" && !missingPublic) throw publicResult.reason;
  if (missingPrivate !== missingPublic) {
    throw new Error(`Refusing to replace incomplete judge key pair for ${keyId}.`);
  }
  let privateKey;
  let publicKey;
  if (missingPrivate && missingPublic) {
    const pair = generateKeyPairSync("ed25519");
    privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" });
    publicKey = pair.publicKey.export({ type: "spki", format: "pem" });
    await atomicWrite(privateKeyPath, privateKey, 0o600);
    await atomicWrite(publicKeyPath, publicKey, 0o644);
  } else {
    privateKey = privateResult.value;
    publicKey = publicResult.value;
  }
  await chmod(privateKeyPath, 0o600);
  await verifyKeyPairFiles({ privateKeyPath, publicKeyPath });
  return {
    privateKeyPath,
    publicKeyPath,
    publicConfig: { role, profile, publicKey },
  };
}

export async function verifyKeyPairFiles({ privateKeyPath, publicKeyPath }) {
  const [privatePem, publicPem] = await Promise.all([
    readFile(privateKeyPath, "utf8"),
    readFile(publicKeyPath, "utf8"),
  ]);
  const derived = createPublicKey(createPrivateKey(privatePem)).export({ type: "spki", format: "pem" });
  const configured = createPublicKey(publicPem).export({ type: "spki", format: "pem" });
  if (derived !== configured) throw new Error("Judge private and public keys do not match.");
  return true;
}

function validCitation(citation) {
  if (typeof citation !== "string" || !citation.trim() || Buffer.byteLength(citation.trim(), "utf8") > MAX_CITATION_BYTES) {
    return false;
  }
  try {
    const parsed = new URL(citation.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validDecision(decision, candidate) {
  return decision &&
    decision.candidate_id === candidate.candidateId &&
    ["PASS", "NEEDS_FIX"].includes(decision.verdict) &&
    typeof decision.clinical_analysis === "string" &&
    decision.clinical_analysis.trim() &&
    Buffer.byteLength(decision.clinical_analysis.trim(), "utf8") <= MAX_ANALYSIS_BYTES &&
    Array.isArray(decision.citations) &&
    decision.citations.length > 0 &&
    decision.citations.length <= MAX_CITATIONS &&
    decision.citations.every(validCitation);
}

export function signCandidate({ candidate, decision, identity, privateKey, reviewedAt = new Date().toISOString() }) {
  if (candidate?.schema !== CANDIDATE_SCHEMA) throw new Error("Candidate schema is missing or unsupported.");
  if (!validDecision(decision, candidate)) throw new Error("Decision is malformed or targets another candidate.");
  if (identity?.role !== candidate.role || !candidate.requiredRoles.includes(identity.role)) {
    throw new Error("Judge identity does not match candidate role.");
  }
  if (!identity.keyId || !identity.profile || !identity.model || !identity.provider) throw new Error("Judge identity is incomplete.");
  if (Number.isNaN(Date.parse(reviewedAt))) throw new Error("reviewedAt is malformed.");

  const exact = candidate.exactState;
  const record = {
    schema: ATTESTATION_SCHEMA,
    repository_id: exact.repositoryId,
    pr: exact.pr,
    head_sha: exact.headSha,
    base_sha: exact.baseSha,
    base_ref: exact.baseRef,
    state_epoch: exact.stateEpoch,
    labels_sha256: exact.labelsSha256,
    risk: exact.risk,
    ci: exact.ci,
    ci_sha256: exact.ciSha256,
    verdict: decision.verdict,
    clinical_analysis: decision.clinical_analysis.trim(),
    citations: decision.citations.map((citation) => citation.trim()),
    judge: {
      key_id: identity.keyId,
      role: identity.role,
      profile: identity.profile,
      model: identity.model,
      provider: identity.provider,
    },
    reviewed_at: reviewedAt,
  };
  record.signature = sign(null, Buffer.from(canonicalJson(record)), privateKey).toString("base64");
  return record;
}

export function formatAttestationCarrier(record) {
  const body = `${ATTESTATION_MARKER}\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\``;
  if (Buffer.byteLength(body, "utf8") > MAX_CARRIER_BYTES) {
    throw new Error(`Attestation carrier exceeds the ${MAX_CARRIER_BYTES}-byte publication limit.`);
  }
  return body;
}

function exactStateFromLive(state) {
  if (!completeFileList(state.pr, state.files)) {
    throw new Error("Live changed-file evidence is incomplete or exceeds the review limit.");
  }
  const risk = classifyRisk(state.files, state.pr);
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

export async function postAttestation({ record, publicKeys, api }) {
  const live = await api.loadGateState(record.pr);
  const verified = verifyAttestation(record, publicKeys, exactStateFromLive(live));
  if (!verified.ok) throw new Error(`Refusing stale or invalid attestation: ${verified.reasonCode}`);
  const body = formatAttestationCarrier(record);
  const existing = (live.reviews || []).find((review) => Number.isSafeInteger(review?.id) && review.body === body);
  if (existing) {
    const readback = await api.getComment(existing.id);
    if (readback?.id !== existing.id || readback.body !== body) throw new Error("Existing attestation failed authoritative readback.");
    return { commentId: existing.id, pr: record.pr, headSha: record.head_sha, idempotent: true };
  }
  const created = await api.createComment(body, record.pr);
  if (!Number.isSafeInteger(created?.id) || created.body !== body) throw new Error("Created attestation comment failed response verification.");
  const readback = await api.getComment(created.id);
  if (readback?.id !== created.id || readback.body !== body) throw new Error("Attestation comment failed authoritative readback.");
  return { commentId: created.id, pr: record.pr, headSha: record.head_sha };
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

async function runGenerate() {
  const generated = await generateKeyPairFiles({
    directory: requiredArgument("--directory"),
    keyId: requiredArgument("--key-id"),
    role: requiredArgument("--role"),
    profile: requiredArgument("--profile"),
  });
  console.log(JSON.stringify({
    keyId: argument("--key-id"),
    publicKeyPath: generated.publicKeyPath,
    publicConfig: generated.publicConfig,
  }, null, 2));
}

async function runVerifyKeyPair() {
  const publicKeyPath = requiredArgument("--public-key");
  await verifyKeyPairFiles({
    privateKeyPath: requiredArgument("--private-key"),
    publicKeyPath,
  });
  const fingerprint = publicKeyFingerprint(await readFile(publicKeyPath, "utf8"));
  if (!fingerprint) throw new Error("Judge public key fingerprint could not be derived.");
  console.log(JSON.stringify({ ok: true, publicKeyFingerprint: fingerprint }));
}

async function runSign() {
  const [candidate, decision, privateKey] = await Promise.all([
    readFile(requiredArgument("--candidate"), "utf8").then(JSON.parse),
    readFile(requiredArgument("--decision"), "utf8").then(JSON.parse),
    readFile(requiredArgument("--private-key"), "utf8"),
  ]);
  const record = signCandidate({
    candidate,
    decision,
    identity: {
      keyId: requiredArgument("--key-id"),
      role: requiredArgument("--role"),
      profile: requiredArgument("--profile"),
      model: argument("--model", "gpt-5.6-sol"),
      provider: argument("--provider", "openai-codex"),
    },
    privateKey,
  });
  const output = requiredArgument("--output");
  await atomicWrite(output, `${JSON.stringify(record, null, 2)}\n`, 0o600);
  console.log(JSON.stringify({ output, pr: record.pr, headSha: record.head_sha, verdict: record.verdict, role: record.judge.role }));
}

async function runPost() {
  const token = resolveGithubToken();
  const repository = requiredArgument("--repo");
  const record = JSON.parse(await readFile(requiredArgument("--attestation"), "utf8"));
  if (!token || !repository.includes("/")) throw new Error("GitHub token and owner/repo are required.");
  const [owner, repo] = repository.split("/");
  const publicKeys = await loadPublicKeysFile(requiredArgument("--public-keys-file"));
  const ciIdentity = await resolveCiIdentity({ token, owner, repo });
  const config = {
    ...ciIdentity,
    publicKeys,
  };
  const api = {
    loadGateState: (pr) => loadGateState(token, owner, repo, pr, config),
    createComment: (body, pr) => githubRequest(token, `/repos/${owner}/${repo}/issues/${pr}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
    getComment: (commentId) => githubRequest(token, `/repos/${owner}/${repo}/issues/comments/${commentId}`),
  };
  console.log(JSON.stringify(await postAttestation({ record, publicKeys, api })));
}

async function run() {
  const command = process.argv[2];
  if (command === "generate-key") return runGenerate();
  if (command === "verify-key-pair") return runVerifyKeyPair();
  if (command === "sign") return runSign();
  if (command === "post") return runPost();
  throw new Error("Command must be generate-key, verify-key-pair, sign, or post.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
