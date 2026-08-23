#!/usr/bin/env node
import { createHash, createPublicKey, verify } from "node:crypto";

export const ATTESTATION_SCHEMA = "radulator-clinical-attestation/v1";
export const RISK_CLASSIFIER_VERSION = "radulator-clinical-risk/v2";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const FEEDBACK_ONLY_FILES = new Set([
  "src/components/calculators/FeedbackForm.jsx",
  "src/components/calculators/feedbackCalculatorOptions.js",
]);
const CLINICAL_RUNTIME_PREFIXES = [
  "src/components/calculators/",
  "src/components/forms/",
  "src/components/display/",
  "src/components/ui/",
  "src/context/",
];
const CLINICAL_RUNTIME_FILES = new Set([
  "src/App.jsx",
  "src/components/StaticCalculatorShell.jsx",
  "src/hooks/useUrlSync.js",
  "src/lib/reportSnippets.js",
]);
const CLINICAL_DOCUMENT_PREFIXES = [
  "docs/calculators/",
];
const CLINICAL_SEMANTIC_PATTERN = /(?:\b\d+(?:\.\d+)?\b|[%≤≥<>]|\b(?:formula|equation|calculate|score|boundary|cutoff|cut-off|threshold|unit|dose|dosage|contraindicat\w*|interpret\w*|management|recommend\w*|follow[- ]?up|interval|stage|staging|grade|guideline|version|diagnos\w*|treatment)\b)/i;
const EXPLICIT_HIGH_RISK_PATTERN = /(?:<!--\s*radulator-risk\s*:\s*high\s*-->|^\s*(?:radulator[-_ ]*)?(?:clinical[-_ ]*)?risk(?:[-_ ]*tier)?\s*:\s*high\s*$)/im;

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

export function publicKeyFingerprint(publicKey) {
  try {
    const der = createPublicKey(publicKey).export({ type: "spki", format: "der" });
    return createHash("sha256").update(der).digest("hex");
  } catch {
    return null;
  }
}

function normalizeFile(file) {
  if (!file || typeof file.filename !== "string" || !file.filename) {
    throw new Error("Every changed file requires a filename.");
  }
  return {
    filename: file.filename,
    previousFilename: typeof file.previous_filename === "string" && file.previous_filename
      ? file.previous_filename
      : typeof file.previousFilename === "string" && file.previousFilename
        ? file.previousFilename
        : null,
    status: typeof file.status === "string" && file.status ? file.status : "modified",
    additions: Number.isSafeInteger(file.additions) && file.additions >= 0 ? file.additions : null,
    deletions: Number.isSafeInteger(file.deletions) && file.deletions >= 0 ? file.deletions : null,
    changes: Number.isSafeInteger(file.changes) && file.changes >= 0 ? file.changes : null,
    patch: typeof file.patch === "string" ? file.patch.replace(/\r\n/g, "\n") : null,
  };
}

function changedPatchLines(patch) {
  return patch
    .split("\n")
    .filter((line) => (/^[+-]/.test(line) && !/^\+\+\+|^---/.test(line)))
    .join("\n");
}

function normalizedEvidence(evidence) {
  return {
    title: typeof evidence?.title === "string" ? evidence.title : "",
    body: typeof evidence?.body === "string" ? evidence.body : "",
  };
}

export function analyzeRisk(files, evidence = {}) {
  if (!Array.isArray(files) || files.length === 0) throw new Error("At least one changed file is required.");
  const normalized = files.map(normalizeFile).sort((left, right) => left.filename.localeCompare(right.filename));
  const normalizedPrEvidence = normalizedEvidence(evidence);
  const details = [];
  const reasonCodes = new Set();

  if (EXPLICIT_HIGH_RISK_PATTERN.test(`${normalizedPrEvidence.title}\n${normalizedPrEvidence.body}`)) {
    details.push("PR evidence explicitly declares high risk");
    reasonCodes.add("EXPLICIT_HIGH_RISK");
  }

  for (const file of normalized) {
    const paths = [...new Set([file.filename, file.previousFilename].filter(Boolean))];
    const runtimePaths = paths.filter((candidate) =>
      CLINICAL_RUNTIME_FILES.has(candidate) ||
      CLINICAL_RUNTIME_PREFIXES.some((prefix) => candidate.startsWith(prefix)));
    const clinicalDocumentPaths = paths.filter((candidate) => CLINICAL_DOCUMENT_PREFIXES.some((prefix) => candidate.startsWith(prefix)));
    const runtime = runtimePaths.some((candidate) => !FEEDBACK_ONLY_FILES.has(candidate));
    const clinicalDocument = clinicalDocumentPaths.length > 0;
    const changedLines = file.patch === null ? null : changedPatchLines(file.patch).split("\n").filter(Boolean).length;
    const patchTruncated = file.changes !== null && changedLines !== null && changedLines < file.changes;

    if (runtime) {
      details.push(`${runtimePaths.join(" -> ")}: calculator runtime changes are high risk`);
      reasonCodes.add("CLINICAL_RUNTIME_CHANGE");
      if (file.patch === null) {
        details.push(`${file.filename}: clinical runtime patch is missing`);
        reasonCodes.add("CLINICAL_RUNTIME_PATCH_MISSING");
      } else if (patchTruncated) {
        details.push(`${file.filename}: clinical runtime patch is truncated`);
        reasonCodes.add("CLINICAL_RUNTIME_PATCH_TRUNCATED");
      }
      continue;
    }

    if (clinicalDocument) {
      if (file.patch === null) {
        details.push(`${file.filename}: clinical documentation patch is missing`);
        reasonCodes.add("CLINICAL_DOCUMENT_PATCH_MISSING");
      } else if (patchTruncated) {
        details.push(`${file.filename}: clinical documentation patch is truncated`);
        reasonCodes.add("CLINICAL_DOCUMENT_PATCH_TRUNCATED");
      } else if (CLINICAL_SEMANTIC_PATTERN.test(changedPatchLines(file.patch))) {
        details.push(`${file.filename}: clinical semantics, numeric content, or guidance changed`);
        reasonCodes.add("CLINICAL_DOCUMENT_SEMANTICS_CHANGE");
      }
    }
  }

  const uniqueDetails = [...new Set(details)].sort();
  const compactCodes = [...reasonCodes].sort();
  return {
    risk: {
      tier: uniqueDetails.length ? "high" : "standard",
      version: RISK_CLASSIFIER_VERSION,
      filesSha256: digest(normalized),
      evidenceSha256: digest(normalizedPrEvidence),
      reasonCodes: compactCodes.length ? compactCodes : ["NO_HIGH_RISK_CHANGE"],
      reasonCount: uniqueDetails.length,
    },
    details: uniqueDetails.length
      ? uniqueDetails
      : ["No high-risk clinical runtime or semantic documentation change detected"],
  };
}

export function classifyRisk(files, evidence = {}) {
  return analyzeRisk(files, evidence).risk;
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
  const verifiedPasses = new Map();

  for (const record of records || []) {
    if (!recordTargetsPr(record, exactState) || !recordTargetsExactHead(record, exactState)) continue;
    const verified = verifyAttestation(record, publicKeys, exactState);
    if (!verified.ok) continue;
    const role = verified.record.judge.role;
    if (requiredRoles.includes(role) && verified.record.verdict === "NEEDS_FIX") {
      return attestationFailure("NEEDS_FIX", `${role} judge returned NEEDS_FIX for this exact state.`);
    }
    if (!requiredRoles.includes(role) || verified.record.verdict !== "PASS") continue;
    if (!verifiedPasses.has(role)) verifiedPasses.set(role, []);
    verifiedPasses.get(role).push(verified.record);
  }

  const byRole = new Map();
  for (const role of requiredRoles) {
    const passes = verifiedPasses.get(role) || [];
    if (!passes.length) return attestationFailure("MISSING_JUDGE_ROLE", `A current ${role} judge attestation is required.`);
    const newestTime = Math.max(...passes.map((record) => Date.parse(record.reviewed_at)));
    const newestDistinct = new Map(
      passes
        .filter((record) => Date.parse(record.reviewed_at) === newestTime)
        .map((record) => [canonicalJson(record), record]),
    );
    if (newestDistinct.size > 1) {
      return attestationFailure("AMBIGUOUS_ATTESTATION", `Newest ${role} attestations have the same review time.`);
    }
    byRole.set(role, newestDistinct.values().next().value);
  }

  if (requiredRoles.length > 1) {
    const profiles = new Set(requiredRoles.map((role) => byRole.get(role).judge.profile));
    if (profiles.size !== requiredRoles.length) {
      return attestationFailure("JUDGE_PROFILE_NOT_INDEPENDENT", "High-risk approvals must come from distinct judge profiles.");
    }
    const fingerprints = requiredRoles.map((role) => {
      const keyId = byRole.get(role).judge.key_id;
      return publicKeyFingerprint(publicKeys?.[keyId]?.publicKey);
    });
    if (fingerprints.some((fingerprint) => !fingerprint) || new Set(fingerprints).size !== requiredRoles.length) {
      return attestationFailure("JUDGE_KEY_NOT_INDEPENDENT", "High-risk approvals must use distinct signing credentials.");
    }
  }

  return { ok: true, reasonCode: "ATTESTATION_QUORUM_PASS", roles: requiredRoles };
}
