#!/usr/bin/env node
import { createHash, verify } from "node:crypto";

export const ATTESTATION_SCHEMA = "radulator-clinical-attestation/v1";
export const RISK_CLASSIFIER_VERSION = "radulator-clinical-risk/v1";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const FEEDBACK_ONLY_FILES = new Set([
  "src/components/calculators/FeedbackForm.jsx",
  "src/components/calculators/feedbackCalculatorOptions.js",
]);
const CLINICAL_RUNTIME_PREFIXES = [
  "src/components/calculators/",
];
const CLINICAL_DOCUMENT_PREFIXES = [
  "docs/calculators/",
];
const CLINICAL_SEMANTIC_PATTERN = /(?:\b\d+(?:\.\d+)?\b|[%≤≥<>]|\b(?:formula|equation|calculate|score|boundary|cutoff|cut-off|threshold|unit|dose|dosage|contraindicat\w*|interpret\w*|management|recommend\w*|follow[- ]?up|interval|stage|staging|grade|guideline|version|diagnos\w*|treatment)\b)/i;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function digest(value) {
  const text = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function normalizeFile(file) {
  if (!file || typeof file.filename !== "string" || !file.filename) {
    throw new Error("Every changed file requires a filename.");
  }
  return {
    filename: file.filename,
    status: typeof file.status === "string" && file.status ? file.status : "modified",
    patch: typeof file.patch === "string" ? file.patch.replace(/\r\n/g, "\n") : null,
  };
}

function changedPatchLines(patch) {
  return patch
    .split("\n")
    .filter((line) => (/^[+-]/.test(line) && !/^\+\+\+|^---/.test(line)))
    .join("\n");
}

export function classifyRisk(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error("At least one changed file is required.");
  const normalized = files.map(normalizeFile).sort((left, right) => left.filename.localeCompare(right.filename));
  const reasons = [];

  for (const file of normalized) {
    const runtime = CLINICAL_RUNTIME_PREFIXES.some((prefix) => file.filename.startsWith(prefix));
    const clinicalDocument = CLINICAL_DOCUMENT_PREFIXES.some((prefix) => file.filename.startsWith(prefix));

    if (runtime && !FEEDBACK_ONLY_FILES.has(file.filename)) {
      reasons.push(`${file.filename}: calculator runtime changes are high risk`);
      if (file.patch === null) reasons.push(`${file.filename}: clinical runtime patch is missing`);
      continue;
    }

    if (clinicalDocument) {
      if (file.patch === null) {
        reasons.push(`${file.filename}: clinical documentation patch is missing`);
      } else if (CLINICAL_SEMANTIC_PATTERN.test(changedPatchLines(file.patch))) {
        reasons.push(`${file.filename}: clinical semantics, numeric content, or guidance changed`);
      }
    }
  }

  const uniqueReasons = [...new Set(reasons)].sort();
  return {
    tier: uniqueReasons.length ? "high" : "standard",
    version: RISK_CLASSIFIER_VERSION,
    filesSha256: digest(normalized),
    reasons: uniqueReasons.length ? uniqueReasons : ["No high-risk clinical runtime or semantic documentation change detected"],
    files: normalized,
  };
}

export function requiredJudgeRoles(tier) {
  if (tier === "standard") return ["primary"];
  if (tier === "high") return ["primary", "verification"];
  throw new Error(`Unsupported risk tier: ${tier}`);
}

function timestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function unsignedRecord(record) {
  const copy = structuredClone(record);
  delete copy.signature;
  return copy;
}

function attestationFailure(reasonCode, summary) {
  return { ok: false, reasonCode, summary };
}

function matchesExactState(record, exactState) {
  return record.repository_id === exactState.repositoryId &&
    record.pr === exactState.pr &&
    record.head_sha === exactState.headSha &&
    record.base_sha === exactState.baseSha &&
    record.base_ref === exactState.baseRef &&
    same(record.state_epoch, exactState.stateEpoch) &&
    record.labels_sha256 === exactState.labelsSha256 &&
    same(record.risk, exactState.risk) &&
    same(record.ci, exactState.ci) &&
    record.ci_sha256 === exactState.ciSha256;
}

export function verifyAttestation(record, publicKeys, exactState) {
  if (!record || typeof record !== "object" || record.schema !== ATTESTATION_SCHEMA) {
    return attestationFailure("MALFORMED_ATTESTATION", "Attestation schema is missing or unsupported.");
  }
  if (
    !Number.isSafeInteger(record.repository_id) || record.repository_id <= 0 ||
    !Number.isSafeInteger(record.pr) || record.pr <= 0 ||
    !SHA_PATTERN.test(record.head_sha || "") ||
    !SHA_PATTERN.test(record.base_sha || "") ||
    !["develop", "main"].includes(record.base_ref) ||
    !["PASS", "NEEDS_FIX"].includes(record.verdict) ||
    typeof record.clinical_analysis !== "string" || !record.clinical_analysis.trim() ||
    !Array.isArray(record.citations) || record.citations.length === 0 ||
    record.citations.some((citation) => typeof citation !== "string" || !citation.trim()) ||
    !timestamp(record.reviewed_at) ||
    !DIGEST_PATTERN.test(record.labels_sha256 || "") ||
    !DIGEST_PATTERN.test(record.ci_sha256 || "") ||
    digest(record.ci) !== record.ci_sha256 ||
    !record.judge || typeof record.judge.key_id !== "string" || !record.judge.key_id ||
    !["primary", "verification"].includes(record.judge.role) ||
    typeof record.judge.profile !== "string" || !record.judge.profile ||
    typeof record.judge.model !== "string" || !record.judge.model ||
    typeof record.judge.provider !== "string" || !record.judge.provider ||
    typeof record.signature !== "string" || !record.signature
  ) return attestationFailure("MALFORMED_ATTESTATION", "Attestation fields are incomplete or malformed.");

  const configured = publicKeys?.[record.judge.key_id];
  if (!configured || configured.role !== record.judge.role || configured.profile !== record.judge.profile) {
    return attestationFailure("JUDGE_IDENTITY_MISMATCH", "Judge key, role, or profile is not configured for this authority.");
  }

  let signatureValid = false;
  try {
    signatureValid = verify(
      null,
      Buffer.from(canonicalJson(unsignedRecord(record))),
      configured.publicKey,
      Buffer.from(record.signature, "base64"),
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return attestationFailure("INVALID_SIGNATURE", "Attestation signature is invalid.");
  if (!matchesExactState(record, exactState)) {
    return attestationFailure("ATTESTATION_STATE_MISMATCH", "Attestation does not bind the current exact PR state.");
  }
  return { ok: true, reasonCode: "VALID_ATTESTATION", record };
}

function recordTargetsPr(record, exactState) {
  return record?.repository_id === exactState.repositoryId && record?.pr === exactState.pr;
}

function recordTargetsExactHead(record, exactState) {
  return recordTargetsPr(record, exactState) &&
    record?.head_sha === exactState.headSha &&
    record?.base_sha === exactState.baseSha &&
    record?.base_ref === exactState.baseRef;
}

export function evaluateAttestationQuorum(records, publicKeys, exactState) {
  const requiredRoles = requiredJudgeRoles(exactState?.risk?.tier);
  const byRole = new Map();

  for (const record of records || []) {
    if (!recordTargetsPr(record, exactState) || !recordTargetsExactHead(record, exactState)) continue;
    const verified = verifyAttestation(record, publicKeys, exactState);
    if (!verified.ok) return verified;
    const role = verified.record.judge.role;
    const existing = byRole.get(role);
    if (!existing || Date.parse(verified.record.reviewed_at) > Date.parse(existing.reviewed_at)) {
      byRole.set(role, verified.record);
    } else if (Date.parse(verified.record.reviewed_at) === Date.parse(existing.reviewed_at)) {
      return attestationFailure("AMBIGUOUS_ATTESTATION", `Newest ${role} attestations have the same review time.`);
    }
  }

  for (const role of requiredRoles) {
    const record = byRole.get(role);
    if (!record) return attestationFailure("MISSING_JUDGE_ROLE", `A current ${role} judge attestation is required.`);
    if (record.verdict === "NEEDS_FIX") return attestationFailure("NEEDS_FIX", `${role} judge returned NEEDS_FIX.`);
  }

  if (requiredRoles.length > 1) {
    const profiles = new Set(requiredRoles.map((role) => byRole.get(role).judge.profile));
    if (profiles.size !== requiredRoles.length) {
      return attestationFailure("JUDGE_PROFILE_NOT_INDEPENDENT", "High-risk approvals must come from distinct judge profiles.");
    }
  }

  return { ok: true, reasonCode: "ATTESTATION_QUORUM_PASS", roles: requiredRoles };
}
