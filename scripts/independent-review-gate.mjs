#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import {
  classifyRisk,
  digest,
  evaluateAttestationQuorum,
  requiredJudgeRoles,
} from "./release-policy.mjs";

export const REQUIRED_CONTEXT = "Radulator Clinical Release Gate (exact head)";
export const RECORD_SCHEMA = "radulator-clinical-gate-result/v1";
export const ATTESTATION_MARKER = "<!-- radulator-clinical-attestation/v1 -->";

const E2E_WORKFLOW_PATH = ".github/workflows/e2e-tests.yml";
const E2E_WORKFLOW_FILE = "e2e-tests.yml";
const PUBLISHER_APP_ID = 15368;
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
    evidence.push({
      name,
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
  }

  return {
    ok: true,
    summary: `Exact E2E run ${run.id}, attempt ${run.run_attempt}, is green.`,
    workflowRunId: run.id,
    runAttempt: run.run_attempt,
    evidence,
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
    if (parsed.malformed) return { records: [], malformed: true };
    records.push(parsed.record);
  }
  return { records, malformed: false };
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

function newestRequiredRecords(records, roles, state) {
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
    const existing = selected.get(record.judge.role);
    if (!existing || Date.parse(record.reviewed_at) > Date.parse(existing.reviewed_at)) selected.set(record.judge.role, record);
  }
  return selected;
}

export function gateStateFingerprint({ pr, ci, files, reviews }) {
  return digest({
    pr: {
      repositoryId: pr.repositoryId,
      number: pr.number,
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
    files: (files || []).map((file) => ({ filename: file.filename, status: file.status, patch: file.patch ?? null }))
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
    risk = classifyRisk(files);
  } catch (error) {
    return failure(pr.headSha, pr.baseSha, `Risk classification failed: ${error.message}`, "RISK_CLASSIFICATION_ERROR");
  }
  const state = exactState(pr, ci, risk);
  const carriers = attestationRecords(reviews);
  if (carriers.malformed) {
    return failure(pr.headSha, pr.baseSha, "A marked clinical attestation carrier is malformed.", "MALFORMED_ATTESTATION_CARRIER", { risk });
  }

  const quorum = evaluateAttestationQuorum(carriers.records, publicKeys, state);
  if (!quorum.ok) return failure(pr.headSha, pr.baseSha, quorum.summary, quorum.reasonCode, { risk });

  const roles = requiredJudgeRoles(risk.tier);
  const selected = newestRequiredRecords(carriers.records, roles, state);
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
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${await response.text()}`);
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
  return { filename: file.filename, status: file.status, patch: typeof file.patch === "string" ? file.patch : null };
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

  for (const prNumber of prNumbers) {
    const initial = normalizePr(await githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}`));
    let check = dryRun ? null : await createPendingCheck(token, owner, repo, initial.headSha, prNumber);
    try {
      const before = await loadGateState(token, owner, repo, prNumber, config);
      const beforeFingerprint = gateStateFingerprint(before);
      const after = await loadGateState(token, owner, repo, prNumber, config);
      const afterFingerprint = gateStateFingerprint(after);
      let result = beforeFingerprint === afterFingerprint
        ? evaluateGate(after)
        : failure(after.pr.headSha, after.pr.baseSha, "Concurrent PR/judge/CI/file state change detected; refusing PASS.", "CONCURRENT_STATE_CHANGE");

      if (!dryRun && check.head_sha !== result.headSha) {
        const oldResult = failure(check.head_sha, initial.baseSha, "PR head changed during evaluation; old-head check is invalid.", "HEAD_CHANGED");
        await completeCheck(token, owner, repo, check.id, oldResult);
        await verifyCheck(token, owner, repo, check.id, oldResult);
        check = await createPendingCheck(token, owner, repo, result.headSha, prNumber);
      }
      if (!dryRun) {
        await completeCheck(token, owner, repo, check.id, result);
        await verifyCheck(token, owner, repo, check.id, result);
        const post = await loadGateState(token, owner, repo, prNumber, config);
        if (gateStateFingerprint(post) !== afterFingerprint) {
          result = failure(post.pr.headSha, post.pr.baseSha, "State changed during/after check publication; success is revoked.", "POST_PUBLISH_STATE_CHANGE");
          if (check.head_sha !== post.pr.headSha) check = await createPendingCheck(token, owner, repo, post.pr.headSha, prNumber);
          await completeCheck(token, owner, repo, check.id, result);
          await verifyCheck(token, owner, repo, check.id, result);
        }
      }
      console.log(JSON.stringify({
        pr: prNumber,
        conclusion: result.conclusion,
        eligible: result.eligible,
        reasonCode: result.reasonCode,
        headSha: result.headSha,
        riskTier: result.risk?.tier || null,
        fingerprint: result.fingerprint,
        dryRun,
      }));
    } catch (error) {
      const result = failure(initial.headSha, initial.baseSha, `Gate evaluation error: ${error.message}`, "EVALUATION_ERROR");
      if (!dryRun) {
        await completeCheck(token, owner, repo, check.id, result);
        await verifyCheck(token, owner, repo, check.id, result);
      }
      console.error(JSON.stringify({ pr: prNumber, conclusion: "failure", reasonCode: result.reasonCode, message: error.message }));
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
