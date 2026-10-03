#!/usr/bin/env node
// Release control: the promotion chain proof.
//
// A promotion to main merges an exact develop commit D. This module proves that every develop
// commit between main (M) and D is a trusted-controller squash merge of a PR whose exact head was
// judged (signed attestation quorum), CI-green, and gate-authorized before it merged, that each
// squash landed exactly the attested diff, and, for a promotion head P, that P's content is
// develop's attested content (plus three-way merges with main drift, which judges review fully).
//
// verifyPromotionChain() is a pure function of loaded facts. loadPromotionChainFacts() reads only
// immutable history, signed comments on merged PRs, and commit statuses, and is memoized per
// process. Every missing, malformed, or unexpected fact fails closed with a reason code.

import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  analyzeRisk,
  canonicalJson,
  digest,
  publicKeyFingerprint,
  requiredJudgeRoles,
  verifyAttestationRecord,
} from "./release-policy.mjs";

export const PROMOTION_CHAIN_SCHEMA = "radulator-promotion-chain/v1";
export const PROMOTION_CHAIN_FACTS_SCHEMA = "radulator-promotion-chain-facts/v1";
// These equal the gate's constants (asserted by promotion-chain.test.mjs). They are declared here so
// the gate can import this module without an import cycle.
export const ATTESTATION_MARKER = "<!-- radulator-clinical-attestation/v1 -->";
export const ENFORCEMENT_CONTEXT = "Radulator Clinical Release Authorization";
export const GATE_CHECK_CONTEXT = "Radulator Clinical Release Gate (exact head)";
export const PROMOTION_BRANCH_PREFIX = "release/promote-";
export const LABEL_READY = "ready-for-gate";
export const LABEL_REMEDIATION = "release-remediation";
export const LABEL_URGENT = "release-urgent";
export const LABEL_FULL_REVIEW = "promotion-full-review";

// Batch limits are code constants: they change only through a judged release-control PR.
// maxPrs (N) counts non-remediation PRs; maxHighRiskClinical (M) counts non-remediation high-tier
// PRs with a CLINICAL_* reason code. N starts at 2 for the live test plan and is raised later.
// maxChainCommits bounds the loader's API use (about five requests per commit).
// maxAgeHours bounds the batch's age: its oldest constituent merged at most maxAgeHours before its newest. Both
// times are GitHub's merged_at, already verified for every entry, so the bound is deterministic and needs no clock
// (wall-clock time differs between judges and gate runs, and the promotion head's commit date is an unsigned value
// set by whoever pushed it). The promoter opens a ripe batch within 2 hours, so this only stops a batch that kept
// growing (each superseding promotion adds the newest merge) from keeping batch review past a day.
export const BATCH_POLICY = Object.freeze({
  maxPrs: 2,
  maxHighRiskClinical: 2,
  maxAgeHours: 24,
  maxChainCommits: 30,
  maxCompareFiles: 300,
});

export const CHAIN_REASON_CODES = Object.freeze([
  "CHAIN_VERIFIED",
  "BATCH_TOO_OLD",
  "NOTHING_TO_RELEASE",
  "CHAIN_EVIDENCE_UNAVAILABLE",
  "CHAIN_TOO_LARGE",
  "CHAIN_NOT_LINEAR",
  "CHAIN_COMMIT_NOT_CONTROLLER_MERGE",
  "CHAIN_PR_MISMATCH",
  "CHAIN_TREE_MISMATCH",
  "CHAIN_HEAD_NOT_UP_TO_DATE",
  "CHAIN_ATTESTATION_MISSING",
  "CHAIN_CI_NOT_EXACT",
  "CHAIN_RISK_UNDERSTATED",
  "CHAIN_LABELS_UNDECODABLE",
  "CHAIN_GATE_AUTHORIZATION_MISSING",
  "CHAIN_GATE_STATE_AMBIGUOUS",
  "PROMOTION_HEAD_NOT_EXACT_MERGE",
  "PROMOTION_UNATTESTED_PATH",
  "PROMOTION_CONTENT_MISMATCH",
  "BATCH_BOUND_EXCEEDED",
  "BATCH_DOMAIN_MIXED",
  "BATCH_URGENT_NOT_SOLO",
]);

const SHA = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const CONTROLLER_MERGE_TITLE = /^PR #([1-9]\d*): exact-head clinical gate passed$/;
const CONTROLLER_COMMITTER_LOGIN = "web-flow";
// The controller merges with the workflow token, so GitHub records github-actions[bot] as the PR's merger. The title
// and the web-flow signature are the same for anyone who squash-merges with that title; merged_by is not.
const CONTROLLER_MERGER_ID = 41898282;
const CONTROLLER_MERGER_LOGIN = "github-actions[bot]";
const GATE_STATUS_CREATOR_ID = 41898282;
const GATE_STATUS_CREATOR_LOGIN = "github-actions[bot]";
const GATE_PASS_DESCRIPTION = /^PASS [0-9a-f]{64}$/;
const REQUIRED_DEVELOP_CI = ["Smoke Tests", "Targeted Calculator Tests"];
const FULL_SUITE_CI = "Full Test Suite";
const DECODABLE_OPTIONAL_LABELS = [LABEL_REMEDIATION, LABEL_URGENT, LABEL_FULL_REVIEW];
const SUMMARY_LIST_LIMIT = 20;

function sha(value) {
  return typeof value === "string" && SHA.test(value);
}

function time(value) {
  return typeof value === "string" ? Date.parse(value) : Number.NaN;
}

function exactPath(value) {
  return typeof value === "string" && value.length > 0 && !value.includes("\0") && !value.startsWith("/") &&
    !value.split("/").some((part) => !part || part === "." || part === "..");
}

function firstLine(message) {
  return typeof message === "string" ? message.split("\n")[0] : "";
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

// -- Pure helpers -------------------------------------------------------------------------------

export function isPromotionPr(pr) {
  return pr?.baseRef === "main" &&
    typeof pr.headRef === "string" && pr.headRef.startsWith(PROMOTION_BRANCH_PREFIX) &&
    typeof pr.headRepoFullName === "string" && pr.headRepoFullName.length > 0 &&
    pr.headRepoFullName === pr.repositoryFullName;
}

export function parseAttestationCarrier(body) {
  if (typeof body !== "string" || !body.includes(ATTESTATION_MARKER)) return null;
  const suffix = body.slice(body.indexOf(ATTESTATION_MARKER) + ATTESTATION_MARKER.length).trim();
  const fenced = suffix.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
  try {
    const record = JSON.parse(fenced ? fenced[1] : suffix);
    return record && typeof record === "object" && !Array.isArray(record) ? record : null;
  } catch {
    return null;
  }
}

const LABEL_DECODINGS = (() => {
  const decodings = new Map();
  for (let mask = 0; mask < 2 ** DECODABLE_OPTIONAL_LABELS.length; mask += 1) {
    const labels = [LABEL_READY, ...DECODABLE_OPTIONAL_LABELS.filter((_, index) => mask & (2 ** index))].sort();
    decodings.set(digest(labels), labels);
  }
  return decodings;
})();

// A PASS requires ready-for-gate and no hold label, so an attested labels digest is one of eight
// label sets: ready-for-gate plus any subset of the decodable release labels.
export function decodeAttestedLabels(labelsSha256) {
  const labels = LABEL_DECODINGS.get(labelsSha256);
  if (!labels) return null;
  return {
    labels: [...labels],
    remediation: labels.includes(LABEL_REMEDIATION),
    urgent: labels.includes(LABEL_URGENT),
    fullReview: labels.includes(LABEL_FULL_REVIEW),
  };
}

// Every non-neutral risk domain the reason codes name. riskDomain names just one of them; batch accounting uses the
// whole set (entryDomains).
export function riskDomains(reasonCodes) {
  const codes = Array.isArray(reasonCodes) ? reasonCodes : [];
  const domains = [];
  if (codes.some((code) => typeof code === "string" && code.startsWith("CLINICAL_"))) domains.push("clinical");
  if (codes.includes("RELEASE_CONTROL_CHANGE")) domains.push("release-control");
  return domains;
}

export function riskDomain(reasonCodes) {
  return riskDomains(reasonCodes)[0] || "neutral";
}

// Every domain a chain entry touches. Batch accounting uses this whole set: riskDomain's single domain would let a PR
// that changes both clinical and release-control paths count as clinical only.
function entryDomains(entry) {
  return Array.isArray(entry?.domains) ? entry.domains : riskDomains(entry?.reasonCodes);
}

export function isHighRiskClinical(entry) {
  return entry?.tier === "high" && entryDomains(entry).includes("clinical");
}

// Maps each path a comparison touched to its blob on the comparison's head side, or null when the
// path is absent there (removed, or the previous name of a rename).
function headSideBlobs(files, label) {
  if (!Array.isArray(files)) throw new Error(`${label} file list is missing.`);
  const blobs = new Map();
  for (const file of files) {
    if (!exactPath(file?.filename) || typeof file.status !== "string" || !file.status) {
      throw new Error(`${label} has a malformed changed-file entry.`);
    }
    if (blobs.has(file.filename)) throw new Error(`${label} lists ${file.filename} twice.`);
    if (file.status === "removed") {
      blobs.set(file.filename, null);
      continue;
    }
    if (!sha(file.sha)) throw new Error(`${label} has no blob identity for ${file.filename}.`);
    blobs.set(file.filename, file.sha);
  }
  for (const file of files) {
    if (file.status !== "renamed") continue;
    if (!exactPath(file.previous_filename) || file.previous_filename === file.filename) {
      throw new Error(`${label} has a malformed rename for ${file.filename}.`);
    }
    if (!blobs.has(file.previous_filename)) blobs.set(file.previous_filename, null);
  }
  return blobs;
}

function touchedPaths(files) {
  const paths = new Set();
  for (const file of files) {
    paths.add(file.filename);
    if (typeof file.previous_filename === "string" && file.previous_filename) paths.add(file.previous_filename);
  }
  return [...paths].sort();
}

function validPolicy(policy) {
  return policy && ["maxPrs", "maxHighRiskClinical", "maxAgeHours", "maxChainCommits", "maxCompareFiles"]
    .every((key) => positiveInteger(policy[key]));
}

// -- Attestation groups (steps g and h) -----------------------------------------------------------

function attestationGroups({ comments, repositoryId, prNumber, headSha, baseSha, publicKeys }) {
  const groups = new Map();
  for (const comment of comments) {
    const record = parseAttestationCarrier(comment?.body);
    if (!record) continue;
    if (
      record.repository_id !== repositoryId || record.pr !== prNumber ||
      record.head_sha !== headSha || record.base_sha !== baseSha || record.base_ref !== "develop"
    ) continue;
    if (!verifyAttestationRecord(record, publicKeys).ok) continue;
    const key = canonicalJson({
      state_epoch: record.state_epoch,
      labels_sha256: record.labels_sha256,
      risk: record.risk,
      ci: record.ci,
      ci_sha256: record.ci_sha256,
    });
    if (!groups.has(key)) groups.set(key, { key, records: [] });
    groups.get(key).records.push({ record, commentId: comment.id, createdAt: comment.created_at, updatedAt: comment.updated_at });
  }
  return [...groups.values()];
}

// `deadline` is the gate PASS (bounded by the merge): a required-role PASS counts only when it was reviewed, and its
// carrier comment was posted and last edited, at or before it. A missing or malformed time never counts.
function evaluateGroup(group, { publicKeys, deadline }) {
  const sample = group.records[0].record;
  let roles;
  try {
    roles = requiredJudgeRoles(sample.risk?.tier);
  } catch {
    return { valid: false, why: "unsupported risk tier" };
  }
  if (group.records.some(({ record }) => roles.includes(record.judge.role) && record.verdict === "NEEDS_FIX")) {
    return { valid: false, why: "a required judge returned NEEDS_FIX" };
  }
  const epochAt = time(sample.state_epoch?.event_created_at);
  const ciTimes = Array.isArray(sample.ci) ? sample.ci.map((item) => time(item?.completed_at)) : [];
  if (Number.isNaN(epochAt) || !ciTimes.length || ciTimes.some(Number.isNaN)) {
    return { valid: false, why: "the attested epoch or CI times are malformed" };
  }
  const newestEvidenceAt = Math.max(epochAt, ...ciTimes);
  const selected = [];
  for (const role of roles) {
    const passes = group.records.filter(({ record, createdAt, updatedAt }) =>
      record.judge.role === role && record.verdict === "PASS" &&
      time(record.reviewed_at) >= newestEvidenceAt && time(record.reviewed_at) <= deadline &&
      time(createdAt) <= deadline && time(updatedAt) <= deadline);
    if (!passes.length) return { valid: false, why: `no ${role} PASS between the evidence and the gate PASS` };
    const newestAt = Math.max(...passes.map(({ record }) => time(record.reviewed_at)));
    const newest = new Map(passes
      .filter(({ record }) => time(record.reviewed_at) === newestAt)
      .map((item) => [canonicalJson(item.record), item]));
    if (newest.size !== 1) return { valid: false, why: `the newest ${role} PASS is ambiguous` };
    selected.push(newest.values().next().value);
  }
  if (roles.length > 1) {
    const profiles = new Set(selected.map(({ record }) => record.judge.profile));
    const fingerprints = selected.map(({ record }) => publicKeyFingerprint(publicKeys?.[record.judge.key_id]?.publicKey));
    if (profiles.size !== roles.length || fingerprints.some((value) => !value) || new Set(fingerprints).size !== roles.length) {
      return { valid: false, why: "high-risk approvals are not independent" };
    }
  }
  return {
    valid: true,
    record: sample,
    selected,
    newestPassAt: Math.max(...selected.map(({ record }) => time(record.reviewed_at))),
  };
}

function ciIsExact(record, headSha) {
  const ci = record.ci;
  if (!Array.isArray(ci) || !ci.length) return false;
  if (ci.some((item) => item?.head_sha !== headSha || item?.conclusion !== "success")) return false;
  const names = new Set(ci.map((item) => item.name));
  const required = record.risk?.tier === "high" ? [...REQUIRED_DEVELOP_CI, FULL_SUITE_CI] : REQUIRED_DEVELOP_CI;
  return required.every((name) => names.has(name));
}

// The fingerprint the gate publishes for a develop PR's PASS (independent-review-gate.mjs success(); the gate's own
// tests assert they agree): head, base, risk and judge roles. It covers neither the label set nor the state epoch.
export function gatePassFingerprint({ headSha, baseSha, risk }) {
  const roles = requiredJudgeRoles(risk?.tier);
  return digest({
    context: GATE_CHECK_CONTEXT,
    conclusion: "success",
    eligible: true,
    reasonCode: "PASS",
    headSha,
    baseSha,
    summary: `${risk.tier} risk: exact CI and ${roles.join(" + ")} judge attestation passed.`,
    risk,
    judgeRoles: roles,
  });
}

// The release flags batch accounting reads from an attested label set.
function releaseFlags(labelsSha256) {
  const labels = decodeAttestedLabels(labelsSha256);
  return labels ? `remediation=${labels.remediation} urgent=${labels.urgent}` : "undecodable";
}

function latestGateAuthorization(statuses, mergedAt) {
  return (statuses || [])
    .filter((status) => status?.context === ENFORCEMENT_CONTEXT && time(status.created_at) <= mergedAt)
    .sort((left, right) => time(right.created_at) - time(left.created_at) || (right.id || 0) - (left.id || 0))[0] || null;
}

// -- The verifier ---------------------------------------------------------------------------------

class ChainFailure extends Error {
  constructor(reasonCode, summary, failure = {}) {
    super(summary);
    this.reasonCode = reasonCode;
    this.failure = failure;
  }
}

function fail(reasonCode, summary, failure = {}) {
  throw new ChainFailure(reasonCode, summary, failure);
}

function verifyCommit({ commit, index, parentSha, facts, publicKeys, policy, repository }) {
  const at = { index, commit: commit?.sha || null, pr: null };
  // a. Linear.
  const parents = Array.isArray(commit?.parents) ? commit.parents.map((parent) => parent?.sha) : [];
  if (!sha(commit?.sha) || parents.length !== 1 || parents[0] !== parentSha) {
    fail("CHAIN_NOT_LINEAR", `Commit ${index + 1} is not a single-parent child of ${parentSha}.`, at);
  }
  // b. Trusted-controller squash merge.
  const title = firstLine(commit.commit?.message);
  const match = CONTROLLER_MERGE_TITLE.exec(title);
  if (commit.commit?.verification?.verified !== true || commit.committer?.login !== CONTROLLER_COMMITTER_LOGIN || !match) {
    fail("CHAIN_COMMIT_NOT_CONTROLLER_MERGE", `Commit ${commit.sha} is not a GitHub-signed controller squash merge.`, at);
  }
  const prNumber = Number(match[1]);
  at.pr = prNumber;
  const committedAt = time(commit.commit?.committer?.date);
  const treeSha = commit.commit?.tree?.sha;
  if (Number.isNaN(committedAt) || !sha(treeSha)) {
    fail("CHAIN_EVIDENCE_UNAVAILABLE", `Commit ${commit.sha} has no committer date or tree.`, at);
  }
  const loaded = facts.commits?.[commit.sha];
  if (!loaded || typeof loaded !== "object" || loaded.error) {
    fail("CHAIN_EVIDENCE_UNAVAILABLE", `PR #${prNumber} evidence for ${commit.sha} was not loaded${loaded?.error ? `: ${loaded.error}` : "."}`, at);
  }
  // c. The PR record binds this squash to its develop base.
  const pr = loaded.pr;
  const mergedAt = time(pr?.merged_at);
  if (
    pr?.number !== prNumber || pr.merged !== true || pr.state !== "closed" || Number.isNaN(mergedAt) ||
    pr.base?.ref !== "develop" || pr.merge_commit_sha !== commit.sha || pr.base?.sha !== parentSha ||
    pr.base?.repo?.full_name !== repository || !positiveInteger(pr.base?.repo?.id) || !sha(pr.head?.sha)
  ) {
    fail("CHAIN_PR_MISMATCH", `PR #${prNumber} is not the merged develop PR behind ${commit.sha} on base ${parentSha}.`, at);
  }
  // c2. GitHub recorded the trusted controller as the merger (a person's merge records that person).
  if (pr.merged_by?.id !== CONTROLLER_MERGER_ID || pr.merged_by?.login !== CONTROLLER_MERGER_LOGIN) {
    fail(
      "CHAIN_COMMIT_NOT_CONTROLLER_MERGE",
      `PR #${prNumber} was merged by ${pr.merged_by?.login || "an unrecorded account"}, not the trusted controller.`,
      at,
    );
  }
  const headSha = pr.head.sha;
  // d. The squash tree is the attested head tree.
  if (loaded.headCommit?.sha !== headSha || loaded.headCommit?.tree?.sha !== treeSha) {
    fail("CHAIN_TREE_MISMATCH", `The tree of ${commit.sha} is not the tree of PR #${prNumber} head ${headSha}.`, at);
  }
  // e. The head contained its base, so the attested diff is the landed diff.
  const headCompare = loaded.headCompare;
  if (
    !["ahead", "identical"].includes(headCompare?.status) || headCompare.behind_by !== 0 ||
    headCompare.merge_base_commit?.sha !== parentSha
  ) {
    fail("CHAIN_HEAD_NOT_UP_TO_DATE", `PR #${prNumber} head ${headSha} did not contain its base ${parentSha}.`, at);
  }
  // f. The gate authorized this head before the merge: the latest authorization status at or before the merge is the
  //    gate's PASS. Every record and carrier used below must predate it.
  const authorization = latestGateAuthorization(loaded.statuses, mergedAt);
  if (
    authorization?.state !== "success" || authorization.creator?.id !== GATE_STATUS_CREATOR_ID ||
    authorization.creator?.login !== GATE_STATUS_CREATOR_LOGIN || !GATE_PASS_DESCRIPTION.test(authorization.description || "")
  ) {
    fail("CHAIN_GATE_AUTHORIZATION_MISSING", `PR #${prNumber} head ${headSha} had no gate PASS authorization at merge time.`, at);
  }
  const passAt = time(authorization.created_at);
  // g. A valid signed quorum for one exact state, which the gate could have evaluated: every required-role PASS was
  //    reviewed after the evidence, and it and its carrier comment existed, unedited, by the gate PASS.
  const groups = attestationGroups({
    comments: Array.isArray(loaded.comments) ? loaded.comments : [],
    repositoryId: pr.base.repo.id,
    prNumber,
    headSha,
    baseSha: parentSha,
    publicKeys,
  }).map((group) => evaluateGroup(group, { publicKeys, deadline: Math.min(passAt, committedAt) })).filter((group) => group.valid);
  if (!groups.length) {
    fail("CHAIN_ATTESTATION_MISSING", `PR #${prNumber} has no valid signed quorum at head ${headSha} that existed before its gate PASS.`, at);
  }
  // h. The attested CI is exact-head green with the tier's required checks.
  const exact = groups.filter((group) => ciIsExact(group.record, headSha))
    .sort((left, right) => right.newestPassAt - left.newestPassAt || digest(left.record).localeCompare(digest(right.record)));
  if (!exact.length) {
    fail("CHAIN_CI_NOT_EXACT", `PR #${prNumber}'s attested CI is not exact-head green with its tier's checks.`, at);
  }
  // i. The gate's PASS is for one of these states: its fingerprint is the PASS fingerprint of an exact state (head,
  //    base, risk and judge roles). The fingerprint covers neither labels nor the state epoch, but the gate passes only
  //    the PR's current state, and every state left existed before the PASS, so the authorized state is the newest
  //    attested epoch. States sharing that epoch must agree on the release flags.
  const passFingerprint = authorization.description.slice("PASS ".length);
  const fingerprinted = exact.filter((candidate) =>
    gatePassFingerprint({ headSha, baseSha: parentSha, risk: candidate.record.risk }) === passFingerprint);
  if (!fingerprinted.length) {
    fail("CHAIN_GATE_AUTHORIZATION_MISSING", `PR #${prNumber}'s gate PASS fingerprint matches no attested state at head ${headSha}.`, at);
  }
  const epochAt = (candidate) => time(candidate.record.state_epoch?.event_created_at);
  const epochId = (candidate) => (Number.isSafeInteger(candidate.record.state_epoch?.event_id) ? candidate.record.state_epoch.event_id : -1);
  const newestAt = Math.max(...fingerprinted.map(epochAt));
  const newestId = Math.max(...fingerprinted.filter((candidate) => epochAt(candidate) === newestAt).map(epochId));
  const authorized = fingerprinted.filter((candidate) => epochAt(candidate) === newestAt && epochId(candidate) === newestId);
  if (new Set(authorized.map((candidate) => releaseFlags(candidate.record.labels_sha256))).size > 1) {
    fail(
      "CHAIN_GATE_STATE_AMBIGUOUS",
      `PR #${prNumber} has attested states with one epoch but different release labels, so its gate PASS cannot tell which one it authorized.`,
      at,
    );
  }
  const group = authorized[0];
  const recorded = group.record;
  // j. The recorded tier is not lower than a conservative re-classification of the landed diff.
  const files = Array.isArray(headCompare.files) ? headCompare.files : null;
  if (!files) fail("CHAIN_EVIDENCE_UNAVAILABLE", `PR #${prNumber}'s changed files were not loaded.`, at);
  if (files.length >= policy.maxCompareFiles) {
    fail("CHAIN_TOO_LARGE", `PR #${prNumber} changes ${files.length} or more files.`, at);
  }
  let analyzed;
  try {
    analyzed = analyzeRisk(files.map((file) => ({ ...file, patch: null }))).risk;
  } catch (error) {
    fail("CHAIN_EVIDENCE_UNAVAILABLE", `PR #${prNumber}'s landed diff could not be classified: ${error.message}`, at);
  }
  if (analyzed.tier === "high" && recorded.risk?.tier !== "high") {
    fail("CHAIN_RISK_UNDERSTATED", `PR #${prNumber} was judged ${recorded.risk?.tier}, but its landed diff is high risk.`, at);
  }
  // Nor do the recorded reason codes miss a risk domain the landed diff has: the batch's domain and high-risk clinical
  // count come from the recorded codes, so older or incomplete codes must not understate them.
  const recordedDomains = riskDomains(recorded.risk?.reasonCodes);
  const unrecorded = riskDomains(analyzed.reasonCodes).filter((domain) => !recordedDomains.includes(domain));
  if (unrecorded.length) {
    fail(
      "CHAIN_RISK_UNDERSTATED",
      `PR #${prNumber}'s attestation records no ${unrecorded.join(" or ")} risk, but its landed diff has it.`,
      at,
    );
  }
  // k. The attested labels decode to the release flags.
  const labels = decodeAttestedLabels(recorded.labels_sha256);
  if (!labels) fail("CHAIN_LABELS_UNDECODABLE", `PR #${prNumber}'s attested label set is not a PASS-eligible release label set.`, at);
  // l. The verified entry. Its domains are every domain its recorded or re-classified codes name; a PR whose own diff
  // spans clinical and release control is "mixed" by itself.
  const reasonCodes = Array.isArray(recorded.risk?.reasonCodes) ? [...recorded.risk.reasonCodes].sort() : [];
  const domains = [...new Set([...riskDomains(reasonCodes), ...riskDomains(analyzed.reasonCodes)])].sort();
  return {
    pr: prNumber,
    title: typeof pr.title === "string" ? pr.title.slice(0, 200) : "",
    squash: commit.sha,
    head: headSha,
    base: parentSha,
    tree: treeSha,
    mergedAt: pr.merged_at,
    tier: recorded.risk.tier,
    reasonCodes,
    analyzedReasonCodes: [...analyzed.reasonCodes].sort(),
    domains,
    domain: domains.length > 1 ? "mixed" : domains[0] || "neutral",
    remediation: labels.remediation,
    urgent: labels.urgent,
    labels: labels.labels,
    roles: group.selected.map(({ record, commentId }) => ({
      role: record.judge.role,
      verdict: record.verdict,
      keyId: record.judge.key_id,
      profile: record.judge.profile,
      model: record.judge.model,
      provider: record.judge.provider,
      reviewedAt: record.reviewed_at,
      commentId,
    })),
    attestationCommentIds: group.selected.map(({ commentId }) => commentId).sort((left, right) => left - right),
    gateAuthorizationStatusId: authorization.id ?? null,
    files: touchedPaths(files),
  };
}

function verifyPromotionContent({ facts, policy, mainSha, promotionHeadSha, mergeBaseSha }) {
  const content = facts.promotion;
  const at = { index: null, commit: promotionHeadSha, pr: null };
  if (!content || content.error) {
    fail("CHAIN_EVIDENCE_UNAVAILABLE", `Promotion content comparisons were not loaded${content?.error ? `: ${content.error}` : "."}`, at);
  }
  if (content.promotionMergeBaseSha !== mainSha) {
    fail("PROMOTION_HEAD_NOT_EXACT_MERGE", "The promotion head does not descend directly from main.", at);
  }
  if (content.mainDriftMergeBaseSha !== mergeBaseSha) {
    fail("CHAIN_EVIDENCE_UNAVAILABLE", "The main-drift comparison does not start at the merge base.", at);
  }
  for (const [label, files] of [
    ["develop", facts.range.files],
    ["promotion", content.promotionFiles],
    ["main-drift", content.mainDriftFiles],
  ]) {
    if (!Array.isArray(files)) fail("CHAIN_EVIDENCE_UNAVAILABLE", `The ${label} comparison has no file list.`, at);
    if (files.length >= policy.maxCompareFiles) {
      fail("CHAIN_TOO_LARGE", `The ${label} comparison lists ${files.length} or more files.`, at);
    }
  }
  let develop;
  let promoted;
  let mainDrift;
  try {
    develop = headSideBlobs(facts.range.files, "The develop comparison");
    promoted = headSideBlobs(content.promotionFiles, "The promotion comparison");
    mainDrift = headSideBlobs(content.mainDriftFiles, "The main-drift comparison");
  } catch (error) {
    fail("CHAIN_EVIDENCE_UNAVAILABLE", error.message, at);
  }
  for (const path of [...promoted.keys()].sort()) {
    if (!develop.has(path)) {
      fail("PROMOTION_UNATTESTED_PATH", `The promotion changes ${path}, which no attested develop commit changed.`, at);
    }
  }
  const integrationMergedPaths = [];
  for (const path of [...develop.keys()].sort()) {
    const developBlob = develop.get(path);
    if (mainDrift.has(path) && mainDrift.get(path) !== developBlob) {
      integrationMergedPaths.push(path);
      continue;
    }
    // Not integration-merged: main either never changed the path since the merge base (so the
    // promotion must carry develop's blob) or already converged on develop's exact blob.
    const promotedBlob = promoted.has(path)
      ? promoted.get(path)
      : mainDrift.has(path) ? mainDrift.get(path) : Symbol("unchanged since the merge base");
    if (promotedBlob !== developBlob) {
      fail("PROMOTION_CONTENT_MISMATCH", `The promotion's ${path} is not develop's attested content.`, at);
    }
  }
  return integrationMergedPaths;
}

function countEntries(entries) {
  const nonRemediation = entries.filter((entry) => !entry.remediation);
  // Each entry counts once per domain it touches (a two-domain PR counts in both).
  const domains = { clinical: 0, "release-control": 0, neutral: 0 };
  for (const entry of entries) {
    const touched = entryDomains(entry);
    if (!touched.length) domains.neutral += 1;
    for (const domain of touched) domains[domain] += 1;
  }
  return {
    prs: entries.length,
    nonRemediation: nonRemediation.length,
    remediation: entries.length - nonRemediation.length,
    urgent: nonRemediation.filter((entry) => entry.urgent).length,
    highRiskClinical: nonRemediation.filter(isHighRiskClinical).length,
    domains,
  };
}

function batchDomain(entries) {
  const domains = new Set(entries.flatMap(entryDomains));
  if (domains.size > 1) return "mixed";
  return domains.size ? [...domains][0] : "neutral";
}

function overlapping(entries) {
  const seen = new Map();
  for (const entry of entries) {
    for (const file of entry.files) seen.set(file, (seen.get(file) || 0) + 1);
  }
  return [...seen].filter(([, count]) => count > 1).map(([file]) => file).sort();
}

function verifyLimits(entries, policy) {
  const counts = countEntries(entries);
  const at = { index: null, commit: null, pr: null };
  if (counts.nonRemediation > policy.maxPrs || counts.highRiskClinical > policy.maxHighRiskClinical) {
    fail(
      "BATCH_BOUND_EXCEEDED",
      `The batch holds ${counts.nonRemediation} PRs (limit ${policy.maxPrs}) and ${counts.highRiskClinical} high-risk clinical PRs (limit ${policy.maxHighRiskClinical}).`,
      at,
    );
  }
  if (batchDomain(entries) === "mixed") {
    const both = entries.filter((entry) => entryDomains(entry).length > 1).map((entry) => `#${entry.pr}`);
    fail(
      "BATCH_DOMAIN_MIXED",
      both.length
        ? `The batch mixes clinical and release-control changes (${both.join(", ")} ${both.length > 1 ? "change" : "changes"} both).`
        : "The batch mixes clinical and release-control PRs.",
      at,
    );
  }
  if (counts.urgent > 0 && counts.nonRemediation > 1) {
    fail("BATCH_URGENT_NOT_SOLO", "A release-urgent PR must release without other non-remediation PRs.", at);
  }
  // Batch age (see BATCH_POLICY): every entry counts, remediation included, so the check fails toward full review.
  const merged = entries.map((entry) => time(entry.mergedAt));
  if (merged.some((value) => Number.isNaN(value))) {
    fail("CHAIN_EVIDENCE_UNAVAILABLE", "A batch entry has no merge time, so the batch age cannot be checked.", at);
  }
  const spanMs = merged.length ? Math.max(...merged) - Math.min(...merged) : 0;
  if (spanMs > policy.maxAgeHours * 3_600_000) {
    fail(
      "BATCH_TOO_OLD",
      `The batch's oldest PR merged ${(spanMs / 3_600_000).toFixed(2)} h before its newest (limit ${policy.maxAgeHours} h).`,
      at,
    );
  }
}

export function verifyPromotionChain({ facts, publicKeys, policy = BATCH_POLICY } = {}) {
  const entries = [];
  let integrationMergedPaths = [];
  const identity = {
    repository: typeof facts?.repository === "string" ? facts.repository : null,
    M: sha(facts?.mainSha) ? facts.mainSha : null,
    D: sha(facts?.developSha) ? facts.developSha : null,
    S0: null,
    P: sha(facts?.promotionHeadSha) ? facts.promotionHeadSha : null,
  };
  let outcome;
  try {
    if (facts?.schema !== PROMOTION_CHAIN_FACTS_SCHEMA || !REPOSITORY.test(identity.repository || "") || !identity.M) {
      fail("CHAIN_EVIDENCE_UNAVAILABLE", "Promotion chain facts are missing or malformed.");
    }
    if (!validPolicy(policy)) fail("CHAIN_EVIDENCE_UNAVAILABLE", "The batch policy is malformed.");
    if (facts.promotionHeadSha !== undefined && facts.promotionHeadSha !== null) {
      // D is the promotion head's second parent, so the head's shape is checked first.
      const parents = facts.promotionCommit?.parents;
      if (
        !identity.P || facts.promotionCommit?.sha !== identity.P || !Array.isArray(parents) || parents.length !== 2 ||
        parents[0] !== identity.M || !identity.D || parents[1] !== identity.D
      ) {
        fail("PROMOTION_HEAD_NOT_EXACT_MERGE", "The promotion head is not an exact merge of [main, develop].", { commit: identity.P });
      }
    }
    if (!identity.D) fail("CHAIN_EVIDENCE_UNAVAILABLE", "The develop head is missing or malformed.");
    // 1. Range.
    const range = facts.range;
    const aheadBy = range?.ahead_by;
    if (!range || !Number.isSafeInteger(aheadBy) || aheadBy < 0) {
      fail("CHAIN_EVIDENCE_UNAVAILABLE", "The main...develop comparison was not loaded.");
    }
    if (aheadBy === 0) fail("NOTHING_TO_RELEASE", "Develop has no commits that main lacks.");
    identity.S0 = sha(range.merge_base_commit?.sha) ? range.merge_base_commit.sha : null;
    if (!identity.S0) fail("CHAIN_EVIDENCE_UNAVAILABLE", "The main...develop merge base is malformed.");
    const commits = Array.isArray(range.commits) ? range.commits : [];
    if (aheadBy > policy.maxChainCommits || commits.length !== aheadBy) {
      fail("CHAIN_TOO_LARGE", `Develop is ${aheadBy} commits ahead; the chain proof covers at most ${policy.maxChainCommits} listed commits.`);
    }
    // 2. Each commit.
    let parentSha = identity.S0;
    for (const [index, commit] of commits.entries()) {
      entries.push(verifyCommit({ commit, index, parentSha, facts, publicKeys, policy, repository: identity.repository }));
      parentSha = commit.sha;
    }
    // 3. The range ends at the develop head.
    if (parentSha !== identity.D) fail("CHAIN_NOT_LINEAR", `The verified chain ends at ${parentSha}, not at develop ${identity.D}.`);
    // 4. Promotion content.
    if (identity.P) {
      integrationMergedPaths = verifyPromotionContent({
        facts,
        policy,
        mainSha: identity.M,
        promotionHeadSha: identity.P,
        mergeBaseSha: identity.S0,
      });
    }
    // 5. Batch limits.
    verifyLimits(entries, policy);
    outcome = { ok: true, reasonCode: "CHAIN_VERIFIED", summary: `${entries.length} controller merges verified.`, failure: null };
  } catch (error) {
    const known = error instanceof ChainFailure;
    outcome = {
      ok: false,
      reasonCode: known ? error.reasonCode : "CHAIN_EVIDENCE_UNAVAILABLE",
      summary: `${known ? error.message : `Chain verification error: ${error?.message || error}`}`.slice(0, 500),
      failure: known ? { index: error.failure.index ?? null, commit: error.failure.commit ?? null, pr: error.failure.pr ?? null } : null,
    };
  }
  const result = {
    schema: PROMOTION_CHAIN_SCHEMA,
    ok: outcome.ok,
    reasonCode: outcome.reasonCode,
    summary: outcome.summary,
    failure: outcome.failure,
    repository: identity.repository,
    M: identity.M,
    D: identity.D,
    S0: identity.S0,
    P: identity.P,
    entries,
    counts: { commits: Number.isSafeInteger(facts?.range?.ahead_by) ? facts.range.ahead_by : null, ...countEntries(entries) },
    domain: entries.length ? batchDomain(entries) : null,
    firstMergedAt: entries[0]?.mergedAt ?? null,
    lastMergedAt: entries.at(-1)?.mergedAt ?? null,
    overlappingFiles: overlapping(entries),
    integrationMergedPaths,
    policy: validPolicy(policy) ? { ...policy } : null,
  };
  result.digest = digest(result);
  return result;
}

// A not-ok chain for evidence that could not be loaded at all.
export function unavailablePromotionChain({
  repository = null,
  mainSha = null,
  developSha = null,
  promotionHeadSha = null,
  policy = BATCH_POLICY,
  error = null,
} = {}) {
  const result = {
    schema: PROMOTION_CHAIN_SCHEMA,
    ok: false,
    reasonCode: "CHAIN_EVIDENCE_UNAVAILABLE",
    summary: `Promotion chain evidence could not be loaded: ${`${error?.message || error || "unknown error"}`.slice(0, 300)}`,
    failure: null,
    repository: REPOSITORY.test(repository || "") ? repository : null,
    M: sha(mainSha) ? mainSha : null,
    D: sha(developSha) ? developSha : null,
    S0: null,
    P: sha(promotionHeadSha) ? promotionHeadSha : null,
    entries: [],
    counts: { commits: null, ...countEntries([]) },
    domain: null,
    firstMergedAt: null,
    lastMergedAt: null,
    overlappingFiles: [],
    integrationMergedPaths: [],
    policy: validPolicy(policy) ? { ...policy } : null,
  };
  result.digest = digest(result);
  return result;
}

// Batch review of promotions is off in A1: every promotion candidate is a full review, and no batch approval counts
// (the gate, the collector and the poster all build the review binding through promotionReviewMode). A2 turns it on,
// once batch candidates carry exact evidence for every path the batch rubric requires the judge to inspect (including
// an integration-merged path that resolves to main's blob and so is absent from the promotion diff). It is a code
// constant, so it changes only through a judged release-control PR.
export const PROMOTION_BATCH_REVIEW = "off";

// Review mode for a promotion candidate: with batch review on, a verified chain without the escape label is a batch
// review; anything else is a full review.
export function promotionReviewMode(chain, labels = [], { batchReview = PROMOTION_BATCH_REVIEW } = {}) {
  if (batchReview !== "on") return "full";
  const labelSet = new Set((labels || []).map((label) => `${label}`.toLowerCase()));
  return chain?.schema === PROMOTION_CHAIN_SCHEMA && chain.ok === true && !labelSet.has(LABEL_FULL_REVIEW)
    ? "batch"
    : "full";
}

// The review binding a promotion's exact state carries and its attestations sign: the review mode and the digest of
// the chain it came from. release-policy.mjs counts a batch approval only while the live binding is the same verified
// chain in batch mode, so a chain that changes or stops verifying after a batch review sends the promotion back to the
// judges. Other PRs carry no binding.
export function promotionReviewBinding(chain, labels = [], options = {}) {
  const digested = chain?.schema === PROMOTION_CHAIN_SCHEMA && /^[0-9a-f]{64}$/.test(chain.digest || "");
  return {
    mode: digested ? promotionReviewMode(chain, labels, options) : "full",
    promotion_chain_sha256: digested ? chain.digest : null,
  };
}

export function promotionExactStateReview(pr, chain, options = {}) {
  return isPromotionPr(pr) ? { review: promotionReviewBinding(chain, pr.labels, options) } : {};
}

function limitedList(values) {
  const list = Array.isArray(values) ? values : [];
  return { count: list.length, items: list.slice(0, SUMMARY_LIST_LIMIT) };
}

// Compact form for the gate's check-run output and result (the full chain goes to judge candidates).
export function summarizePromotionChain(chain) {
  if (!chain || chain.schema !== PROMOTION_CHAIN_SCHEMA) {
    return {
      schema: PROMOTION_CHAIN_SCHEMA,
      ok: false,
      reasonCode: "CHAIN_EVIDENCE_UNAVAILABLE",
      summary: "No promotion chain was loaded for this promotion.",
      digest: null,
    };
  }
  return {
    schema: chain.schema,
    ok: chain.ok,
    reasonCode: chain.reasonCode,
    summary: chain.summary,
    failure: chain.failure,
    digest: chain.digest,
    main: chain.M,
    develop: chain.D,
    mergeBase: chain.S0,
    promotion: chain.P,
    domain: chain.domain,
    counts: chain.counts,
    prs: (chain.entries || []).map((entry) => ({
      pr: entry.pr,
      squash: entry.squash,
      head: entry.head,
      tier: entry.tier,
      domain: entry.domain,
      remediation: entry.remediation,
      urgent: entry.urgent,
      roles: entry.roles.map((role) => role.role),
    })),
    overlappingFiles: limitedList(chain.overlappingFiles),
    integrationMergedPaths: limitedList(chain.integrationMergedPaths),
    policy: chain.policy,
  };
}

// -- The loader -----------------------------------------------------------------------------------

const factsCache = new Map();
const chainCache = new Map();

export function clearPromotionChainCache() {
  factsCache.clear();
  chainCache.clear();
}

function pickCommit(commit) {
  return {
    sha: commit?.sha ?? null,
    parents: Array.isArray(commit?.parents) ? commit.parents.map((parent) => ({ sha: parent?.sha ?? null })) : [],
    committer: { login: commit?.committer?.login ?? null },
    commit: {
      message: typeof commit?.commit?.message === "string" ? commit.commit.message : "",
      tree: { sha: commit?.commit?.tree?.sha ?? null },
      committer: { date: commit?.commit?.committer?.date ?? null },
      verification: {
        verified: commit?.commit?.verification?.verified === true,
        reason: commit?.commit?.verification?.reason ?? null,
      },
    },
  };
}

function pickFiles(files) {
  if (!Array.isArray(files)) return null;
  return files.map((file) => ({
    filename: file?.filename ?? null,
    previous_filename: typeof file?.previous_filename === "string" ? file.previous_filename : null,
    status: file?.status ?? null,
    sha: file?.sha ?? null,
    additions: Number.isSafeInteger(file?.additions) ? file.additions : null,
    deletions: Number.isSafeInteger(file?.deletions) ? file.deletions : null,
    changes: Number.isSafeInteger(file?.changes) ? file.changes : null,
  }));
}

function pickCompare(comparison, { commits = false } = {}) {
  return {
    status: comparison?.status ?? null,
    ahead_by: Number.isSafeInteger(comparison?.ahead_by) ? comparison.ahead_by : null,
    behind_by: Number.isSafeInteger(comparison?.behind_by) ? comparison.behind_by : null,
    merge_base_commit: { sha: comparison?.merge_base_commit?.sha ?? null },
    ...(commits ? { commits: Array.isArray(comparison?.commits) ? comparison.commits.map(pickCommit) : [] } : {}),
    files: pickFiles(comparison?.files),
  };
}

function pickPr(pr) {
  return {
    number: pr?.number ?? null,
    state: pr?.state ?? null,
    merged: pr?.merged === true,
    merged_at: pr?.merged_at ?? null,
    merged_by: { id: pr?.merged_by?.id ?? null, login: pr?.merged_by?.login ?? null },
    merge_commit_sha: pr?.merge_commit_sha ?? null,
    title: typeof pr?.title === "string" ? pr.title : "",
    base: {
      ref: pr?.base?.ref ?? null,
      sha: pr?.base?.sha ?? null,
      repo: { id: pr?.base?.repo?.id ?? null, full_name: pr?.base?.repo?.full_name ?? null },
    },
    head: {
      ref: pr?.head?.ref ?? null,
      sha: pr?.head?.sha ?? null,
      repo: { full_name: pr?.head?.repo?.full_name ?? null },
    },
  };
}

async function loadCommitFacts(api, root, prNumber, expectedParent) {
  const pr = pickPr(await api.request(`${root}/pulls/${prNumber}`));
  const loaded = { pr, headCommit: null, headCompare: null, comments: [], statuses: [] };
  if (!sha(pr.head.sha)) return loaded;
  const [headCommit, headCompare, comments, statuses] = await Promise.all([
    api.request(`${root}/git/commits/${pr.head.sha}`),
    api.request(`${root}/compare/${expectedParent}...${pr.head.sha}`),
    api.paged(`${root}/issues/${prNumber}/comments`),
    api.paged(`${root}/commits/${pr.head.sha}/statuses`),
  ]);
  loaded.headCommit = { sha: headCommit?.sha ?? null, tree: { sha: headCommit?.tree?.sha ?? null } };
  loaded.headCompare = pickCompare(headCompare);
  loaded.comments = (Array.isArray(comments) ? comments : [])
    .filter((comment) => typeof comment?.body === "string" && comment.body.includes(ATTESTATION_MARKER))
    .map((comment) => ({ id: comment.id, created_at: comment.created_at, updated_at: comment.updated_at, body: comment.body }));
  loaded.statuses = (Array.isArray(statuses) ? statuses : [])
    .filter((status) => status?.context === ENFORCEMENT_CONTEXT)
    .map((status) => ({
      id: status.id,
      state: status.state,
      context: status.context,
      description: status.description,
      created_at: status.created_at,
      creator: { id: status.creator?.id ?? null, login: status.creator?.login ?? null },
    }));
  return loaded;
}

async function loadFacts(api, { repository, mainSha, developSha, promotionHeadSha, maxChainCommits }) {
  const root = `/repos/${repository}`;
  const facts = {
    schema: PROMOTION_CHAIN_FACTS_SCHEMA,
    repository,
    mainSha,
    developSha,
    promotionHeadSha,
    promotionCommit: null,
    range: null,
    commits: {},
    promotion: null,
  };
  if (promotionHeadSha) {
    const commit = await api.request(`${root}/git/commits/${promotionHeadSha}`);
    const parents = Array.isArray(commit?.parents) ? commit.parents.map((parent) => parent?.sha ?? null) : [];
    facts.promotionCommit = { sha: commit?.sha ?? null, parents };
    // Only an exact [main, develop] merge names a develop commit; any other shape stops here and
    // the verifier reports PROMOTION_HEAD_NOT_EXACT_MERGE.
    const exactMerge = commit?.sha === promotionHeadSha && parents.length === 2 && parents[0] === mainSha && sha(parents[1]);
    if (!exactMerge || (facts.developSha && parents[1] !== facts.developSha)) return facts;
    facts.developSha = parents[1];
  }
  if (!sha(facts.developSha)) return facts;
  facts.range = pickCompare(await api.request(`${root}/compare/${mainSha}...${facts.developSha}`), { commits: true });
  const aheadBy = facts.range.ahead_by;
  const mergeBase = facts.range.merge_base_commit.sha;
  if (!Number.isSafeInteger(aheadBy) || aheadBy <= 0 || aheadBy > maxChainCommits ||
    facts.range.commits.length !== aheadBy || !sha(mergeBase)) {
    return facts;
  }
  // Sequential per commit: bounded bursts keep the workflow token clear of secondary rate limits.
  // Each PR's diff is compared from the commit's own parent; the verifier checks that this parent is
  // the chain's. A failed read is recorded as a fact so the verifier reports the first failing step.
  for (const commit of facts.range.commits) {
    const match = CONTROLLER_MERGE_TITLE.exec(firstLine(commit.commit.message));
    const parents = commit.parents.map((parent) => parent.sha);
    if (!match || !sha(commit.sha) || parents.length !== 1 || !sha(parents[0])) continue;
    try {
      facts.commits[commit.sha] = await loadCommitFacts(api, root, Number(match[1]), parents[0]);
    } catch (error) {
      facts.commits[commit.sha] = { error: `${error?.message || error}`.slice(0, 300) };
    }
  }
  if (promotionHeadSha) {
    try {
      const [promotionCompare, mainDriftCompare] = await Promise.all([
        api.request(`${root}/compare/${mainSha}...${promotionHeadSha}`),
        api.request(`${root}/compare/${mergeBase}...${mainSha}`),
      ]);
      facts.promotion = {
        promotionMergeBaseSha: promotionCompare?.merge_base_commit?.sha ?? null,
        promotionFiles: pickFiles(promotionCompare?.files),
        mainDriftMergeBaseSha: mainDriftCompare?.merge_base_commit?.sha ?? null,
        mainDriftFiles: pickFiles(mainDriftCompare?.files),
      };
    } catch (error) {
      facts.promotion = { error: `${error?.message || error}`.slice(0, 300) };
    }
  }
  return facts;
}

// api: { request(path) -> JSON, paged(path, key?) -> array }, paths rooted at /repos/<owner>/<repo>.
// Without developSha, a promotionHeadSha's second parent is the develop commit it promotes.
export function loadPromotionChainFacts(api, {
  repository,
  mainSha,
  developSha = null,
  promotionHeadSha = null,
  maxChainCommits = BATCH_POLICY.maxChainCommits,
} = {}) {
  if (!api || typeof api.request !== "function" || typeof api.paged !== "function") {
    return Promise.reject(new Error("Promotion chain API is incomplete."));
  }
  if (!REPOSITORY.test(repository || "") || !sha(mainSha) ||
    (developSha !== null && !sha(developSha)) || (promotionHeadSha !== null && !sha(promotionHeadSha)) ||
    (developSha === null && promotionHeadSha === null) || !positiveInteger(maxChainCommits)) {
    return Promise.reject(new Error("Promotion chain identity is malformed."));
  }
  const key = canonicalJson([repository, mainSha, developSha, promotionHeadSha, maxChainCommits]);
  if (!factsCache.has(key)) {
    factsCache.set(key, loadFacts(api, { repository, mainSha, developSha, promotionHeadSha, maxChainCommits }));
  }
  return factsCache.get(key);
}

// Loads and verifies; a loading error becomes a not-ok chain (CHAIN_EVIDENCE_UNAVAILABLE) instead of
// an exception, so callers that only report the chain never fail because of it. Results are
// memoized with the facts, so repeated gate loads within one process see one consistent chain.
export async function loadPromotionChain({ api, repository, mainSha, developSha = null, promotionHeadSha = null, publicKeys, policy = BATCH_POLICY }) {
  const key = canonicalJson([repository, mainSha, developSha, promotionHeadSha, digest(publicKeys || {}), policy]);
  if (!chainCache.has(key)) {
    chainCache.set(key, (async () => {
      try {
        const facts = await loadPromotionChainFacts(api, {
          repository,
          mainSha,
          developSha,
          promotionHeadSha,
          maxChainCommits: policy?.maxChainCommits ?? BATCH_POLICY.maxChainCommits,
        });
        return verifyPromotionChain({ facts, publicKeys, policy });
      } catch (error) {
        return unavailablePromotionChain({ repository, mainSha, developSha, promotionHeadSha, policy, error });
      }
    })());
  }
  return chainCache.get(key);
}

// -- CLI ------------------------------------------------------------------------------------------

function argument(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
}

function resolveToken(env = process.env) {
  const configured = `${env.GH_TOKEN || env.GITHUB_TOKEN || ""}`.trim();
  if (configured) return configured;
  try {
    return `${execFileSync("gh", ["auth", "token", "--hostname", "github.com"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
    })}`.trim();
  } catch {
    return "";
  }
}

async function runCli(argv = process.argv.slice(2), env = process.env) {
  const repository = argument(argv, "--repo", env.GITHUB_REPOSITORY || "momomojo/Radulator");
  const mainSha = argument(argv, "--main");
  const developSha = argument(argv, "--develop");
  const promotionHeadSha = argument(argv, "--promotion");
  const keysFile = argument(argv, "--public-keys-file");
  const output = argument(argv, "--output");
  if (!REPOSITORY.test(repository || "") || !sha(mainSha) || (!sha(developSha) && !sha(promotionHeadSha)) ||
    (developSha && !sha(developSha)) || (promotionHeadSha && !sha(promotionHeadSha))) {
    throw new Error("Usage: promotion-chain.mjs --main <sha> (--develop <sha> | --promotion <sha>) --public-keys-file <path> [--repo owner/repo] [--output <path>]");
  }
  const publicKeys = keysFile
    ? JSON.parse(await readFile(keysFile, "utf8"))
    : JSON.parse(env.RADULATOR_JUDGE_PUBLIC_KEYS_JSON || "null");
  if (!publicKeys || typeof publicKeys !== "object" || Array.isArray(publicKeys)) {
    throw new Error("Judge public keys are required (--public-keys-file or RADULATOR_JUDGE_PUBLIC_KEYS_JSON).");
  }
  const token = resolveToken(env);
  if (!token) throw new Error("A GitHub token is required (GH_TOKEN, GITHUB_TOKEN, or gh auth).");
  // Imported at run time: the gate imports this module, so a static import would be a cycle.
  const gate = await import("./independent-review-gate.mjs");
  const api = {
    request: (path) => gate.githubRequest(token, path),
    paged: (path, key = null) => gate.paged(token, path, key),
  };
  const chain = await loadPromotionChain({
    api,
    repository,
    mainSha,
    developSha: developSha || null,
    promotionHeadSha: promotionHeadSha || null,
    publicKeys,
  });
  const serialized = `${JSON.stringify(chain, null, 2)}\n`;
  if (output) await writeFile(output, serialized, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(serialized);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
