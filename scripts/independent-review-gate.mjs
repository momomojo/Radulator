#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import {
  classifyRisk,
  digest,
  evaluateAttestationQuorum,
  requiredJudgeRoles,
  verifyAttestation,
} from "./release-policy.mjs";

export const REQUIRED_CONTEXT = "Radulator Clinical Release Gate (exact head)";
export const ENFORCEMENT_CONTEXT = "Radulator Clinical Release Authorization";
export const MAX_PR_FILES = 3000;
export const RECORD_SCHEMA = "radulator-clinical-gate-result/v1";
export const ATTESTATION_MARKER = "<!-- radulator-clinical-attestation/v1 -->";

const E2E_WORKFLOW_PATH = ".github/workflows/e2e-tests.yml";
const E2E_WORKFLOW_FILE = "e2e-tests.yml";
const PUBLISHER_APP_ID = 15368;
const PUBLISHER_USER_ID = 41898282;
const ALLOWED_BASE_REFS = new Set(["develop", "main"]);
const HOLD_LABELS = new Set([
  "hold",
  "do-not-merge",
  "gate-hold",
  "needs-fix",
  "changes-requested",
  "security-hold",
  "cancelled",
  "canceled",
]);
const RELEVANT_LABELS = new Set(["ready-for-gate", ...HOLD_LABELS]);
const RELEVANT_TIMELINE_EVENTS = new Set([
  "closed",
  "reopened",
  "convert_to_draft",
  "ready_for_review",
  "base_ref_changed",
  "head_ref_force_pushed",
  "head_ref_deleted",
  "head_ref_restored",
]);

function sha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function timestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function failure(headSha, baseSha, summary, reasonCode, details = {}) {
  const result = {
    context: REQUIRED_CONTEXT,
    conclusion: "failure",
    eligible: false,
    reasonCode,
    headSha,
    baseSha,
    summary,
    ...details,
  };
  result.fingerprint = digest(result);
  return result;
}

function success(pr, risk, quorum) {
  const result = {
    context: REQUIRED_CONTEXT,
    conclusion: "success",
    eligible: true,
    reasonCode: "PASS",
    headSha: pr.headSha,
    baseSha: pr.baseSha,
    summary: `${risk.tier} risk: exact CI and ${quorum.roles.join(" + ")} judge attestation passed.`,
    risk,
    judgeRoles: quorum.roles,
  };
  result.fingerprint = digest(result);
  return result;
}

export function requiredCiForBase(baseRef) {
  if (baseRef === "develop") return ["Smoke Tests", "Targeted Calculator Tests"];
  if (baseRef === "main") return ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"];
  return [];
}

export function relevantLabelsDigest(labels) {
  const relevant = [...new Set((labels || [])
    .map((label) => `${label}`.toLowerCase())
    .filter((label) => RELEVANT_LABELS.has(label)))].sort();
  return { labels: relevant, sha256: digest(relevant) };
}

export function deriveStateEpoch(timeline, prCreatedAt) {
  if (!timestamp(prCreatedAt)) throw new Error("PR created_at is malformed.");
  const relevant = [];
  for (const event of timeline || []) {
    const eventName = event?.event;
    const label = `${event?.label?.name || ""}`.toLowerCase();
    if (!RELEVANT_TIMELINE_EVENTS.has(eventName) && !(eventName === "labeled" || eventName === "unlabeled") ||
      ((eventName === "labeled" || eventName === "unlabeled") && !RELEVANT_LABELS.has(label))) {
      continue;
    }
    if (!positiveInteger(event.id) || !timestamp(event.created_at)) {
      throw new Error(`Relevant timeline event ${eventName || "unknown"} is malformed.`);
    }
    relevant.push({ eventId: event.id, eventCreatedAt: event.created_at });
  }
  relevant.sort((left, right) => right.eventId - left.eventId || `${right.eventCreatedAt}`.localeCompare(`${left.eventCreatedAt}`));
  return relevant[0] || { eventId: 0, eventCreatedAt: prCreatedAt };
}

function runSort(left, right) {
  const time = Date.parse(right.created_at) - Date.parse(left.created_at);
  if (time) return time;
  const attempt = right.run_attempt - left.run_attempt;
  if (attempt) return attempt;
  return right.id - left.id;
}

export function resolveRequiredCi({ pr, workflowRuns, checkRuns, requiredCi, expectedWorkflowId, expectedCiAppId }) {
  if (!positiveInteger(expectedWorkflowId) || !positiveInteger(expectedCiAppId)) {
    return { ok: false, summary: "Expected E2E workflow/App identity is missing or malformed.", evidence: [] };
  }

  const exactRuns = (workflowRuns || []).filter((run) =>
    run.workflow_id === expectedWorkflowId &&
    run.path === E2E_WORKFLOW_PATH &&
    run.event === "pull_request" &&
    run.head_sha === pr.headSha &&
    (run.pull_requests || []).some((pull) =>
      pull.number === pr.number &&
      pull.head?.sha === pr.headSha &&
      pull.base?.sha === pr.baseSha &&
      pull.base?.ref === pr.baseRef));

  const malformedRun = exactRuns.find((run) =>
    !positiveInteger(run.id) ||
    !positiveInteger(run.check_suite_id) ||
    !positiveInteger(run.run_attempt) ||
    !timestamp(run.created_at));
  if (malformedRun) return { ok: false, summary: "An exact E2E workflow run has malformed identity/timing metadata.", evidence: [] };

  exactRuns.sort(runSort);
  const run = exactRuns[0];
  if (!run) return { ok: false, summary: "No exact-head E2E workflow run matches the current PR head/base.", evidence: [] };
  if (run.status !== "completed" || run.conclusion !== "success") {
    return { ok: false, summary: `Latest exact-head E2E run ${run.id} is ${run.status}/${run.conclusion || "none"}.`, evidence: [] };
  }

  const evidence = [];
  const evidenceRecord = (check) => ({
    name: check.name,
    app_id: check.app.id,
    check_run_id: check.id,
    check_suite_id: run.check_suite_id,
    workflow_id: run.workflow_id,
    workflow_run_id: run.id,
    run_attempt: run.run_attempt,
    head_sha: check.head_sha,
    conclusion: check.conclusion,
    completed_at: check.completed_at,
  });
  for (const name of requiredCi) {
    const matches = (checkRuns || []).filter((check) => check.check_suite?.id === run.check_suite_id && check.name === name);
    if (matches.length !== 1) {
      return { ok: false, summary: `Required CI ${name} is ${matches.length ? "ambiguous" : "missing"} in E2E run ${run.id}.`, evidence: [] };
    }
    const check = matches[0];
    if (check.app?.id !== expectedCiAppId || check.app?.slug !== "github-actions") {
      return { ok: false, summary: `Required CI ${name} has the wrong GitHub App identity.`, evidence: [] };
    }
    if (
      !positiveInteger(check.id) ||
      check.head_sha !== pr.headSha ||
      check.status !== "completed" ||
      check.conclusion !== "success" ||
      !timestamp(check.completed_at)
    ) return { ok: false, summary: `Required CI ${name} is not an exact completed success.`, evidence: [] };
    evidence.push(evidenceRecord(check));
  }

  // Additional jobs from the same authenticated exact E2E run are review
  // context, not quorum inputs. Keeping them outside `evidence` preserves the
  // base policy digest while letting judges verify focused test/audit lanes.
  const requiredNames = new Set(requiredCi);
  const supplementalEvidence = (checkRuns || [])
    .filter((check) =>
      check.check_suite?.id === run.check_suite_id &&
      !requiredNames.has(check.name) &&
      check.name !== REQUIRED_CONTEXT &&
      typeof check.name === "string" && check.name &&
      check.app?.id === expectedCiAppId && check.app?.slug === "github-actions" &&
      positiveInteger(check.id) &&
      check.head_sha === pr.headSha &&
      check.status === "completed" &&
      check.conclusion === "success" &&
      timestamp(check.completed_at))
    .sort((left, right) => left.name.localeCompare(right.name) || left.id - right.id)
    .map(evidenceRecord);

  return {
    ok: true,
    summary: `Exact E2E run ${run.id}, attempt ${run.run_attempt}, is green.`,
    workflowRunId: run.id,
    runAttempt: run.run_attempt,
    evidence,
    supplementalEvidence,
  };
}

function parseCarrierBody(body) {
  if (typeof body !== "string" || !body.includes(ATTESTATION_MARKER)) return { carrier: false };
  const suffix = body.slice(body.indexOf(ATTESTATION_MARKER) + ATTESTATION_MARKER.length).trim();
  const fenced = suffix.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
  const payload = fenced ? fenced[1] : suffix;
  try {
    return { carrier: true, record: JSON.parse(payload) };
  } catch {
    return { carrier: true, malformed: true };
  }
}

function attestationRecords(reviews) {
  const records = [];
  for (const review of reviews || []) {
    const parsed = parseCarrierBody(review.body);
    if (!parsed.carrier) continue;
    if (parsed.malformed) continue;
    records.push(parsed.record);
  }
  return records;
}

function exactState(pr, ci, risk) {
  return {
    repositoryId: pr.repositoryId,
    pr: pr.number,
    headSha: pr.headSha,
    baseSha: pr.baseSha,
    baseRef: pr.baseRef,
    stateEpoch: { event_id: pr.stateEpoch.eventId, event_created_at: pr.stateEpoch.eventCreatedAt },
    labelsSha256: pr.labelsDigest,
    risk,
    ci: ci.evidence,
    ciSha256: digest(ci.evidence),
  };
}

function newestRequiredRecords(records, roles, state, publicKeys) {
  const selected = new Map();
  for (const record of records) {
    if (
      record.repository_id !== state.repositoryId ||
      record.pr !== state.pr ||
      record.head_sha !== state.headSha ||
      record.base_sha !== state.baseSha ||
      record.base_ref !== state.baseRef ||
      !roles.includes(record.judge?.role)
    ) continue;
    const verified = verifyAttestation(record, publicKeys, state);
    if (!verified.ok) continue;
    const existing = selected.get(verified.record.judge.role);
    if (!existing || Date.parse(verified.record.reviewed_at) > Date.parse(existing.reviewed_at)) {
      selected.set(verified.record.judge.role, verified.record);
    }
  }
  return selected;
}

export function gateStateFingerprint({ pr, ci, files, reviews }) {
  return digest({
    pr: {
      repositoryId: pr.repositoryId,
      number: pr.number,
      changedFiles: pr.changedFiles,
      title: pr.title || "",
      body: pr.body || "",
      state: pr.state,
      draft: pr.draft,
      headSha: pr.headSha,
      baseSha: pr.baseSha,
      baseRef: pr.baseRef,
      stateEpoch: pr.stateEpoch,
      labels: [...(pr.labels || [])].sort(),
      labelsDigest: pr.labelsDigest,
    },
    ci,
    files: (files || []).map((file) => ({
      filename: file.filename,
      previousFilename: file.previousFilename ?? file.previous_filename ?? null,
      status: file.status,
      additions: file.additions ?? null,
      deletions: file.deletions ?? null,
      changes: file.changes ?? null,
      patch: file.patch ?? null,
    }))
      .sort((left, right) => left.filename.localeCompare(right.filename)),
    reviews: (reviews || []).map((review) => ({ id: review.id, body: review.body, updatedAt: review.updatedAt }))
      .sort((left, right) => left.id - right.id),
  });
}

export function evaluateGate({ pr, requiredCi, ci, files, reviews, publicKeys }) {
  if (!pr || !positiveInteger(pr.repositoryId) || !positiveInteger(pr.number) || !sha(pr.headSha) || !sha(pr.baseSha)) {
    return failure(pr?.headSha || "", pr?.baseSha || "", "Malformed PR/repository identity or head/base SHA; refusing PASS.", "MALFORMED_PR");
  }
  if (!ALLOWED_BASE_REFS.has(pr.baseRef)) return failure(pr.headSha, pr.baseSha, "PR base is outside develop/main; refusing PASS.", "UNSUPPORTED_BASE");
  if (pr.state !== "open" || pr.draft) return failure(pr.headSha, pr.baseSha, "PR is not open and ready; refusing PASS.", "PR_NOT_OPEN_READY");
  if (!completeFileList(pr, files)) {
    return failure(
      pr.headSha,
      pr.baseSha,
      `Changed-file evidence is incomplete or exceeds the ${MAX_PR_FILES}-file review limit; refusing PASS.`,
      "INCOMPLETE_FILE_LIST",
    );
  }
  if (!pr.stateEpoch || !timestamp(pr.stateEpoch.eventCreatedAt) || !Number.isSafeInteger(pr.stateEpoch.eventId) || pr.stateEpoch.eventId < 0) {
    return failure(pr.headSha, pr.baseSha, "Relevant PR-state epoch is malformed; refusing PASS.", "MALFORMED_STATE_EPOCH");
  }

  const labels = new Set((pr.labels || []).map((label) => `${label}`.toLowerCase()));
  if (!labels.has("ready-for-gate")) return failure(pr.headSha, pr.baseSha, "ready-for-gate is absent.", "READY_LABEL_MISSING");
  const hold = [...labels].find((label) => HOLD_LABELS.has(label));
  if (hold) return failure(pr.headSha, pr.baseSha, `A hold label is present (${hold}); refusing PASS.`, "HOLD_PRESENT");
  if (!ci?.ok) return failure(pr.headSha, pr.baseSha, `Required CI is not exact green: ${ci?.summary || "missing evidence"}`, "CI_NOT_EXACT_SUCCESS");
  if (digest(ci.evidence.map((item) => item.name)) !== digest(requiredCi)) {
    return failure(pr.headSha, pr.baseSha, "Required CI evidence set does not match the base policy.", "CI_POLICY_MISMATCH");
  }

  let risk;
  try {
    risk = classifyRisk(files, pr);
  } catch (error) {
    return failure(pr.headSha, pr.baseSha, `Risk classification failed: ${error.message}`, "RISK_CLASSIFICATION_ERROR");
  }
  const state = exactState(pr, ci, risk);
  const carriers = attestationRecords(reviews);
  const quorum = evaluateAttestationQuorum(carriers, publicKeys, state);
  if (!quorum.ok) return failure(pr.headSha, pr.baseSha, quorum.summary, quorum.reasonCode, { risk });

  const roles = requiredJudgeRoles(risk.tier);
  const selected = newestRequiredRecords(carriers, roles, state, publicKeys);
  const newestEvidenceAt = Math.max(
    Date.parse(pr.stateEpoch.eventCreatedAt),
    ...ci.evidence.map((item) => Date.parse(item.completed_at)),
  );
  for (const role of roles) {
    const record = selected.get(role);
    if (!record || Date.parse(record.reviewed_at) < newestEvidenceAt) {
      return failure(pr.headSha, pr.baseSha, `${role} attestation predates current PR/CI evidence.`, "STALE_ATTESTATION", { risk });
    }
  }
  return success(pr, risk, quorum);
}

export function completeFileList(pr, files) {
  return Number.isSafeInteger(pr?.changedFiles) &&
    pr.changedFiles > 0 &&
    pr.changedFiles <= MAX_PR_FILES &&
    Array.isArray(files) &&
    files.length === pr.changedFiles;
}

export async function githubRequest(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${await response.text()}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export async function paged(token, path, key = null) {
  const result = [];
  for (let page = 1; ; page += 1) {
    const data = await githubRequest(token, `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    const chunk = key ? data[key] : data;
    if (!Array.isArray(chunk)) throw new Error(`Expected paginated array at ${path}.`);
    result.push(...chunk);
    if (chunk.length < 100) return result;
  }
}

export function checkRunsPath(owner, repo, headSha) {
  if (!owner || !repo || !sha(headSha)) throw new Error("Check-run query identity is malformed.");
  return `/repos/${owner}/${repo}/commits/${headSha}/check-runs?filter=all`;
}

function normalizePr(data, stateEpoch = null) {
  const labelState = relevantLabelsDigest(data.labels.map((label) => label.name));
  return {
    repositoryId: data.base.repo.id,
    number: data.number,
    changedFiles: data.changed_files,
    title: data.title,
    body: data.body || "",
    url: data.html_url,
    state: data.state,
    draft: data.draft,
    createdAt: data.created_at,
    headSha: data.head.sha,
    baseSha: data.base.sha,
    baseRef: data.base.ref,
    author: data.user.login,
    authorId: data.user.id,
    authorType: data.user.type,
    labels: labelState.labels,
    labelsDigest: labelState.sha256,
    stateEpoch,
  };
}

function normalizeComment(comment) {
  return {
    id: comment.id,
    author: comment.user?.login,
    authorId: comment.user?.id,
    authorType: comment.user?.type,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    body: comment.body,
    performedViaGithubApp: comment.performed_via_github_app || null,
  };
}

function normalizeFile(file) {
  return {
    filename: file.filename,
    previousFilename: typeof file.previous_filename === "string" ? file.previous_filename : null,
    status: file.status,
    additions: Number.isSafeInteger(file.additions) ? file.additions : null,
    deletions: Number.isSafeInteger(file.deletions) ? file.deletions : null,
    changes: Number.isSafeInteger(file.changes) ? file.changes : null,
    patch: typeof file.patch === "string" ? file.patch : null,
  };
}

export async function loadGateState(token, owner, repo, prNumber, config) {
  const prData = await githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}`);
  const basePr = normalizePr(prData);
  const requiredCi = requiredCiForBase(basePr.baseRef);
  const [comments, timeline, workflowRuns, checkRuns, files] = await Promise.all([
    paged(token, `/repos/${owner}/${repo}/issues/${prNumber}/comments`),
    paged(token, `/repos/${owner}/${repo}/issues/${prNumber}/timeline`),
    paged(token, `/repos/${owner}/${repo}/actions/workflows/${E2E_WORKFLOW_FILE}/runs?event=pull_request&head_sha=${basePr.headSha}`, "workflow_runs"),
    paged(token, checkRunsPath(owner, repo, basePr.headSha), "check_runs"),
    paged(token, `/repos/${owner}/${repo}/pulls/${prNumber}/files`),
  ]);
  const stateEpoch = deriveStateEpoch(timeline, basePr.createdAt);
  const pr = { ...basePr, stateEpoch };
  const ci = resolveRequiredCi({
    pr,
    workflowRuns,
    checkRuns,
    requiredCi,
    expectedWorkflowId: config.expectedWorkflowId,
    expectedCiAppId: config.expectedCiAppId,
  });
  return {
    pr,
    requiredCi,
    ci,
    files: files.map(normalizeFile),
    reviews: comments.map(normalizeComment),
    publicKeys: config.publicKeys,
  };
}

export function configuredPublicKeys(env = process.env) {
  const raw = env.RADULATOR_JUDGE_PUBLIC_KEYS_JSON || "";
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("RADULATOR_JUDGE_PUBLIC_KEYS_JSON must be an object.");
  return parsed;
}

async function createPendingCheck(token, owner, repo, headSha, prNumber) {
  return githubRequest(token, `/repos/${owner}/${repo}/check-runs`, {
    method: "POST",
    body: JSON.stringify({
      name: REQUIRED_CONTEXT,
      head_sha: headSha,
      status: "in_progress",
      external_id: `radulator-clinical-gate/v1/pending/${process.env.GITHUB_RUN_ID || "manual"}/${prNumber}`,
      output: {
        title: "Clinical release evaluation in progress",
        summary: "A fresh exact-state risk and judge evaluation is running.",
      },
    }),
  });
}

export function checkCompletionPayload(result) {
  return {
    name: REQUIRED_CONTEXT,
    status: "completed",
    conclusion: result.conclusion,
    external_id: `radulator-clinical-gate/v1/${result.fingerprint}`,
    output: {
      title: result.eligible ? "Clinical release gate passed" : "Clinical release gate blocked",
      summary: result.summary,
      text: JSON.stringify({
        schema: RECORD_SCHEMA,
        policy_mode: "active",
        reason_code: result.reasonCode,
        eligible: result.eligible,
        head_sha: result.headSha,
        base_sha: result.baseSha,
        risk_tier: result.risk?.tier || null,
        judge_roles: result.judgeRoles || [],
        evaluation_fingerprint: result.fingerprint,
      }),
    },
  };
}

export function authorizationStatusPayload(result, check) {
  return {
    state: result.conclusion === "success" ? "success" : "failure",
    context: ENFORCEMENT_CONTEXT,
    description: `${result.reasonCode} ${result.fingerprint}`,
    target_url: check.html_url,
  };
}

export function pendingAuthorizationStatusPayload(targetUrl, prNumber, runId) {
  return {
    state: "pending",
    context: ENFORCEMENT_CONTEXT,
    description: `Evaluating exact state for PR #${prNumber} in run ${runId}`,
    target_url: targetUrl,
  };
}

export async function publishAuthorizationStatus(token, owner, repo, headSha, payload, api = null) {
  if (!owner || !repo || !sha(headSha)) throw new Error("Authorization status repository/head identity is malformed.");
  if (
    !payload ||
    !["pending", "success", "failure"].includes(payload.state) ||
    payload.context !== ENFORCEMENT_CONTEXT ||
    typeof payload.description !== "string" ||
    !payload.description ||
    payload.description.length > 140 ||
    typeof payload.target_url !== "string" ||
    !payload.target_url.startsWith("https://github.com/")
  ) throw new Error("Authorization status payload is malformed.");
  const client = api || {
    request: githubRequest,
    list: (authToken, path) => paged(authToken, path),
  };
  const created = await client.request(token, `/repos/${owner}/${repo}/statuses/${headSha}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!positiveInteger(created?.id)) throw new Error("Authorization status creation returned a malformed identity.");
  const statuses = await client.list(token, `/repos/${owner}/${repo}/commits/${headSha}/statuses`);
  const readback = statuses.find((status) => status.id === created.id);
  if (
    !readback ||
    readback.state !== payload.state ||
    readback.context !== payload.context ||
    readback.description !== payload.description ||
    readback.target_url !== payload.target_url ||
    readback.creator?.id !== PUBLISHER_USER_ID ||
    readback.creator?.login !== "github-actions[bot]"
  ) throw new Error(`Published authorization status ${created.id} failed exact readback verification.`);
  return readback;
}

export async function runGateForPullRequest({
  prNumber,
  initial,
  runId,
  runUrl,
  dryRun,
  api,
  evaluateGateImpl = evaluateGate,
  fingerprintImpl = gateStateFingerprint,
}) {
  if (!positiveInteger(prNumber) || !sha(initial?.headSha || "") || !sha(initial?.baseSha || "")) {
    throw new Error("Gate lifecycle initial PR state is malformed.");
  }
  if (!api?.loadState || !api?.publishStatus || !api?.createCheck || !api?.completeAndVerify) {
    throw new Error("Gate lifecycle API is incomplete.");
  }
  const active = {
    headSha: initial.headSha,
    baseSha: initial.baseSha,
    check: null,
  };

  async function beginPublication(headSha, baseSha) {
    active.headSha = headSha;
    active.baseSha = baseSha;
    active.check = null;
    await api.publishStatus(headSha, pendingAuthorizationStatusPayload(runUrl, prNumber, runId));
    active.check = await api.createCheck(headSha);
    if (!active.check || active.check.head_sha !== headSha || !positiveInteger(active.check.id)) {
      throw new Error("Pending gate check creation returned the wrong head or identity.");
    }
  }

  async function completePublication(result) {
    if (!active.check || result.headSha !== active.headSha || result.baseSha !== active.baseSha) {
      throw new Error("Terminal gate publication does not match the active head/base.");
    }
    const verifiedCheck = await api.completeAndVerify(active.check, result);
    await api.publishStatus(result.headSha, authorizationStatusPayload(result, verifiedCheck));
    return verifiedCheck;
  }

  try {
    if (!dryRun) await beginPublication(initial.headSha, initial.baseSha);
    const before = await api.loadState();
    const beforeFingerprint = fingerprintImpl(before);
    const after = await api.loadState();
    const afterFingerprint = fingerprintImpl(after);
    let result = beforeFingerprint === afterFingerprint
      ? evaluateGateImpl(after)
      : failure(after.pr.headSha, after.pr.baseSha, "Concurrent PR/judge/CI/file state change detected; refusing PASS.", "CONCURRENT_STATE_CHANGE");

    if (!dryRun && active.headSha !== result.headSha) {
      const oldResult = failure(
        active.headSha,
        active.baseSha,
        "PR head changed during evaluation; old-head authorization is revoked.",
        "HEAD_CHANGED",
      );
      await completePublication(oldResult);
      await beginPublication(result.headSha, result.baseSha);
    }

    if (!dryRun) {
      await completePublication(result);
      const post = await api.loadState();
      if (fingerprintImpl(post) !== afterFingerprint) {
        const nextResult = failure(
          post.pr.headSha,
          post.pr.baseSha,
          "State changed during/after check publication; success is revoked.",
          "POST_PUBLISH_STATE_CHANGE",
        );
        if (active.headSha !== post.pr.headSha) {
          const revoked = failure(
            active.headSha,
            active.baseSha,
            "PR head changed after publication; old-head authorization is revoked.",
            "POST_PUBLISH_STATE_CHANGE",
          );
          await completePublication(revoked);
          await beginPublication(post.pr.headSha, post.pr.baseSha);
        }
        await completePublication(nextResult);
        result = nextResult;
      }
    }

    return { result, error: null };
  } catch (error) {
    const result = failure(
      active.headSha,
      active.baseSha,
      `Gate evaluation error: ${error.message}`,
      "EVALUATION_ERROR",
    );
    let publicationError = null;
    if (!dryRun && active.check) {
      try {
        await completePublication(result);
      } catch (publishError) {
        publicationError = publishError;
      }
    }
    return { result, error, publicationError };
  }
}

async function completeCheck(token, owner, repo, checkId, result) {
  return githubRequest(token, `/repos/${owner}/${repo}/check-runs/${checkId}`, {
    method: "PATCH",
    body: JSON.stringify(checkCompletionPayload(result)),
  });
}

async function verifyCheck(token, owner, repo, checkId, result) {
  const check = await githubRequest(token, `/repos/${owner}/${repo}/check-runs/${checkId}`);
  if (
    check.name !== REQUIRED_CONTEXT ||
    check.head_sha !== result.headSha ||
    check.app?.id !== PUBLISHER_APP_ID ||
    check.status !== "completed" ||
    check.conclusion !== result.conclusion ||
    check.external_id !== `radulator-clinical-gate/v1/${result.fingerprint}`
  ) throw new Error(`Published check ${checkId} failed exact readback verification.`);
  return check;
}

export async function findPullNumbers(token, owner, repo, env = process.env) {
  const direct = Number(env.PR_NUMBER || 0);
  if (positiveInteger(direct)) return [direct];
  const baseRef = env.BASE_REF;
  if (ALLOWED_BASE_REFS.has(baseRef)) {
    const pulls = await paged(token, `/repos/${owner}/${repo}/pulls?state=open&base=${encodeURIComponent(baseRef)}`);
    return [...new Set(pulls.map((pr) => pr.number))];
  }
  const checkSuiteHead = env.CHECK_SUITE_HEAD_SHA;
  if (!sha(checkSuiteHead || "")) return [];
  const pulls = await githubRequest(token, `/repos/${owner}/${repo}/commits/${checkSuiteHead}/pulls`);
  return [...new Set(pulls.filter((pr) => pr.state === "open" && ALLOWED_BASE_REFS.has(pr.base.ref)).map((pr) => pr.number))];
}

async function run() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY || "";
  if (!token || !repository.includes("/")) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
  const config = {
    expectedWorkflowId: Number(process.env.RADULATOR_E2E_WORKFLOW_ID || 0),
    expectedCiAppId: Number(process.env.RADULATOR_CI_APP_ID || 0),
    publicKeys: configuredPublicKeys(process.env),
  };
  const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
  const [owner, repo] = repository.split("/");
  const prNumbers = await findPullNumbers(token, owner, repo, process.env);
  const runId = process.env.GITHUB_RUN_ID || "manual";
  const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;

  for (const prNumber of prNumbers) {
    const initial = normalizePr(await githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}`));
    const outcome = await runGateForPullRequest({
      prNumber,
      initial,
      runId,
      runUrl,
      dryRun,
      api: {
        loadState: () => loadGateState(token, owner, repo, prNumber, config),
        publishStatus: (headSha, payload) => publishAuthorizationStatus(token, owner, repo, headSha, payload),
        createCheck: (headSha) => createPendingCheck(token, owner, repo, headSha, prNumber),
        completeAndVerify: async (check, result) => {
          await completeCheck(token, owner, repo, check.id, result);
          return verifyCheck(token, owner, repo, check.id, result);
        },
      },
    });
    const { result } = outcome;
    const output = {
      pr: prNumber,
      conclusion: result.conclusion,
      eligible: result.eligible,
      reasonCode: result.reasonCode,
      headSha: result.headSha,
      riskTier: result.risk?.tier || null,
      fingerprint: result.fingerprint,
      dryRun,
    };
    if (outcome.error || outcome.publicationError) {
      console.error(JSON.stringify({
        ...output,
        message: outcome.error?.message || null,
        publicationError: outcome.publicationError?.message || null,
      }));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(output));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
