#!/usr/bin/env node
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const REQUIRED_CONTEXT = "Radulator Independent Review (exact head)";
export const RECORD_SCHEMA = "radulator-independent-review/v2";

const E2E_WORKFLOW_PATH = ".github/workflows/e2e-tests.yml";
const E2E_WORKFLOW_FILE = "e2e-tests.yml";
const PUBLISHER_APP_ID = 15368;
const MOMOMOJO_ID = 35302851;
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
  "converted_to_draft",
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

function sameLogin(left, right) {
  return typeof left === "string" && typeof right === "string" && left.toLowerCase() === right.toLowerCase();
}

function timestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digest(value) {
  const text = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function failure(headSha, baseSha, summary, reasonCode, record = null) {
  return {
    context: REQUIRED_CONTEXT,
    conclusion: "failure",
    eligible: false,
    reasonCode,
    headSha,
    baseSha,
    summary,
    record,
    fingerprint: digest({ headSha, baseSha, reasonCode, summary }),
  };
}

function activationBlocked(pr, record, stateFingerprint) {
  return {
    context: REQUIRED_CONTEXT,
    conclusion: "failure",
    eligible: true,
    reasonCode: "ACTIVATION_BLOCKED",
    headSha: pr.headSha,
    baseSha: pr.baseSha,
    summary: "Exact-state independent PASS candidate verified, but success publication is code-disabled until an approved atomic enforcement boundary exists.",
    record,
    fingerprint: digest({ record: record.canonical, stateFingerprint, reasonCode: "ACTIVATION_BLOCKED" }),
  };
}

export function requiredCiForBase(baseRef) {
  if (baseRef === "develop") return ["Smoke Tests", "Targeted Calculator Tests"];
  if (baseRef === "main") return ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"];
  return [];
}

export function relevantLabelsDigest(labels) {
  const relevant = [...new Set((labels || []).map((label) => `${label}`.toLowerCase()).filter((label) => RELEVANT_LABELS.has(label)))].sort();
  return { labels: relevant, sha256: digest(relevant) };
}

export function deriveStateEpoch(timeline, prCreatedAt) {
  if (!timestamp(prCreatedAt)) throw new Error("PR created_at is malformed.");
  const relevant = [];
  for (const event of timeline || []) {
    const eventName = event?.event;
    const label = `${event?.label?.name || ""}`.toLowerCase();
    if (!RELEVANT_TIMELINE_EVENTS.has(eventName) && !(["labeled", "unlabeled"].includes(eventName) && RELEVANT_LABELS.has(label))) continue;
    if (!positiveInteger(event.id) || !timestamp(event.created_at)) throw new Error(`Relevant timeline event ${eventName || "unknown"} is malformed.`);
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
      pull.base?.ref === pr.baseRef
    )
  );

  const malformedRun = exactRuns.find((run) =>
    !positiveInteger(run.id) ||
    !positiveInteger(run.check_suite_id) ||
    !positiveInteger(run.run_attempt) ||
    !timestamp(run.created_at)
  );
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
    ) {
      return { ok: false, summary: `Required CI ${name} is not an exact completed success.`, evidence: [] };
    }
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

function validIdentity(identity) {
  return identity &&
    typeof identity.botLogin === "string" && identity.botLogin &&
    positiveInteger(identity.botUserId) &&
    positiveInteger(identity.appId) &&
    typeof identity.appSlug === "string" && identity.appSlug &&
    positiveInteger(identity.installationId) &&
    positiveInteger(identity.appOwnerId) &&
    typeof identity.appOwnerLogin === "string" && identity.appOwnerLogin &&
    typeof identity.system === "string" && identity.system;
}

function identitiesIndependent(pr, reviewer, cloudMerger) {
  if (!validIdentity(reviewer) || !validIdentity(cloudMerger)) return false;
  if (
    sameLogin(reviewer.botLogin, "momomojo") ||
    reviewer.botUserId === MOMOMOJO_ID ||
    sameLogin(reviewer.appOwnerLogin, "momomojo") ||
    reviewer.appOwnerId === MOMOMOJO_ID ||
    sameLogin(reviewer.botLogin, pr.author) ||
    reviewer.botUserId === pr.authorId ||
    sameLogin(reviewer.appOwnerLogin, pr.author) ||
    reviewer.appOwnerId === pr.authorId ||
    reviewer.appId === PUBLISHER_APP_ID
  ) return false;
  return !(
    sameLogin(reviewer.botLogin, cloudMerger.botLogin) ||
    reviewer.botUserId === cloudMerger.botUserId ||
    reviewer.appId === cloudMerger.appId ||
    reviewer.installationId === cloudMerger.installationId ||
    reviewer.appOwnerId === cloudMerger.appOwnerId ||
    reviewer.system === cloudMerger.system
  );
}

function reviewerCandidate(comment, reviewer) {
  return comment.performedViaGithubApp?.id === reviewer.appId ||
    comment.authorId === reviewer.botUserId ||
    sameLogin(comment.author, reviewer.botLogin);
}

function selectLatestReviewerRecord(reviews, reviewer) {
  const candidates = (reviews || []).filter((comment) => reviewerCandidate(comment, reviewer));
  if (!candidates.length) return { missing: true };
  if (candidates.some((comment) => !positiveInteger(comment.id) || !timestamp(comment.createdAt))) return { malformed: true };
  candidates.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id - left.id);
  const newestTime = candidates[0].createdAt;
  if (candidates.filter((comment) => comment.createdAt === newestTime).length !== 1) {
    return { ambiguous: true, commentCreatedAt: newestTime };
  }
  return { comment: candidates[0] };
}

function recordEvidencePayload(parsed) {
  const copy = structuredClone(parsed);
  delete copy.evidence_sha256;
  return copy;
}

function parseRecord(comment, state, reviewer, trigger) {
  if (
    comment.authorType !== "Bot" ||
    comment.authorId !== reviewer.botUserId ||
    !sameLogin(comment.author, reviewer.botLogin) ||
    comment.performedViaGithubApp?.id !== reviewer.appId ||
    comment.performedViaGithubApp?.slug !== reviewer.appSlug ||
    comment.performedViaGithubApp?.owner?.id !== reviewer.appOwnerId ||
    !sameLogin(comment.performedViaGithubApp?.owner?.login, reviewer.appOwnerLogin) ||
    comment.createdAt !== comment.updatedAt
  ) return { malformed: true, commentId: comment.id, commentCreatedAt: comment.createdAt };

  let parsed;
  try {
    parsed = JSON.parse(comment.body);
  } catch {
    return { malformed: true, commentId: comment.id, commentCreatedAt: comment.createdAt };
  }

  const exactTrigger = trigger?.eventName === "issue_comment" &&
    trigger.action === "created" &&
    trigger.commentId === comment.id &&
    trigger.installationId === reviewer.installationId &&
    trigger.appId === reviewer.appId &&
    trigger.senderId === reviewer.botUserId &&
    sameLogin(trigger.senderLogin, reviewer.botLogin);

  const expectedReviewer = {
    github_app_id: reviewer.appId,
    installation_id: reviewer.installationId,
    bot_user_id: reviewer.botUserId,
    app_owner_id: reviewer.appOwnerId,
    run_id: parsed?.reviewer?.run_id,
    system: reviewer.system,
  };

  if (
    !exactTrigger ||
    parsed?.schema !== RECORD_SCHEMA ||
    parsed.repository_id !== state.pr.repositoryId ||
    parsed.pr !== state.pr.number ||
    !["PASS", "NEEDS_FIX"].includes(parsed.verdict) ||
    parsed.head_sha !== state.pr.headSha ||
    parsed.base_sha !== state.pr.baseSha ||
    parsed.base_ref !== state.pr.baseRef ||
    canonicalJson(parsed.state_epoch) !== canonicalJson({
      event_id: state.pr.stateEpoch.eventId,
      event_created_at: state.pr.stateEpoch.eventCreatedAt,
    }) ||
    parsed.labels_sha256 !== state.pr.labelsDigest ||
    canonicalJson(parsed.ci) !== canonicalJson(state.ci.evidence) ||
    canonicalJson(parsed.reviewer) !== canonicalJson(expectedReviewer) ||
    typeof parsed.reviewer.run_id !== "string" ||
    !parsed.reviewer.run_id ||
    !timestamp(parsed.reviewed_at) ||
    Date.parse(parsed.reviewed_at) > Date.parse(comment.createdAt) ||
    !/^[0-9a-f]{64}$/.test(parsed.evidence_sha256 || "") ||
    digest(recordEvidencePayload(parsed)) !== parsed.evidence_sha256
  ) return { malformed: true, commentId: comment.id, commentCreatedAt: comment.createdAt };

  const newestEvidenceAt = Math.max(
    Date.parse(state.pr.stateEpoch.eventCreatedAt),
    ...state.ci.evidence.map((item) => Date.parse(item.completed_at))
  );
  if (Date.parse(parsed.reviewed_at) < newestEvidenceAt || Date.parse(comment.createdAt) < newestEvidenceAt) {
    return { malformed: true, commentId: comment.id, commentCreatedAt: comment.createdAt };
  }

  const canonical = canonicalJson({
    author: comment.author,
    author_id: comment.authorId,
    author_type: comment.authorType,
    comment_id: comment.id,
    comment_created_at: comment.createdAt,
    comment_updated_at: comment.updatedAt,
    performed_via_github_app: comment.performedViaGithubApp,
    ...parsed,
  });
  return { ...parsed, canonical, commentId: comment.id, commentCreatedAt: comment.createdAt };
}

export function gateStateFingerprint({ pr, ci, reviews }) {
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
      labels: [...pr.labels].sort(),
      labelsDigest: pr.labelsDigest,
    },
    ci,
    reviews: (reviews || []).map((review) => ({
      id: review.id,
      author: review.author,
      authorId: review.authorId,
      authorType: review.authorType,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      body: review.body,
      performedViaGithubApp: review.performedViaGithubApp,
    })),
  });
}

export function evaluateGate({ pr, reviewerIdentity, cloudMergerIdentity, requiredCi, ci, reviews, trigger }) {
  if (!pr || !positiveInteger(pr.repositoryId) || !positiveInteger(pr.number) || !sha(pr.headSha) || !sha(pr.baseSha)) {
    return failure(pr?.headSha || "", pr?.baseSha || "", "Malformed PR/repository identity or head/base SHA; refusing PASS.", "MALFORMED_PR");
  }
  if (!ALLOWED_BASE_REFS.has(pr.baseRef)) return failure(pr.headSha, pr.baseSha, "PR base is outside develop/main; refusing PASS.", "UNSUPPORTED_BASE");
  if (pr.state !== "open" || pr.draft) return failure(pr.headSha, pr.baseSha, "PR is not open and ready; refusing PASS.", "PR_NOT_OPEN_READY");
  if (!identitiesIndependent(pr, reviewerIdentity, cloudMergerIdentity)) {
    return failure(pr.headSha, pr.baseSha, "Independent reviewer GitHub App/installation identity is missing or not distinct; refusing PASS.", "REVIEWER_NOT_INDEPENDENT");
  }
  if (!pr.stateEpoch || !timestamp(pr.stateEpoch.eventCreatedAt) || !Number.isSafeInteger(pr.stateEpoch.eventId) || pr.stateEpoch.eventId < 0) {
    return failure(pr.headSha, pr.baseSha, "Relevant PR-state epoch is malformed; refusing PASS.", "MALFORMED_STATE_EPOCH");
  }

  const labels = new Set((pr.labels || []).map((label) => `${label}`.toLowerCase()));
  const hold = [...labels].find((label) => HOLD_LABELS.has(label));
  if (hold) return failure(pr.headSha, pr.baseSha, `A hold label is present (${hold}); refusing PASS.`, "HOLD_PRESENT");
  if (!ci?.ok) return failure(pr.headSha, pr.baseSha, `Required CI is not exact green: ${ci?.summary || "missing evidence"}`, "CI_NOT_EXACT_SUCCESS");
  if (canonicalJson(ci.evidence.map((item) => item.name)) !== canonicalJson(requiredCi)) {
    return failure(pr.headSha, pr.baseSha, "Required CI evidence set does not match the base policy.", "CI_POLICY_MISMATCH");
  }

  const latest = selectLatestReviewerRecord(reviews, reviewerIdentity);
  if (latest.missing) return failure(pr.headSha, pr.baseSha, "There is no independent review record for this PR.", "MISSING_REVIEW");
  if (latest.ambiguous) return failure(pr.headSha, pr.baseSha, "Newest independent review records have an ambiguous timestamp tie; refusing PASS.", "AMBIGUOUS_REVIEW");
  if (latest.malformed) return failure(pr.headSha, pr.baseSha, "Newest independent review carrier metadata is malformed; refusing PASS.", "MALFORMED_REVIEW");
  const record = parseRecord(latest.comment, { pr, ci }, reviewerIdentity, trigger);
  if (record.malformed) return failure(pr.headSha, pr.baseSha, "Newest independent review record is edited, malformed, stale, or not event-attested; refusing PASS.", "MALFORMED_REVIEW");
  if (record.verdict !== "PASS") return failure(pr.headSha, pr.baseSha, "Newest independent review verdict NEEDS_FIX; refusing PASS.", "NEEDS_FIX", record);

  return activationBlocked(pr, record, gateStateFingerprint({ pr, ci, reviews }));
}

async function githubRequest(token, path, options = {}) {
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

async function paged(token, path, key = null) {
  const result = [];
  for (let page = 1; ; page += 1) {
    const data = await githubRequest(token, `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    const chunk = key ? data[key] : data;
    if (!Array.isArray(chunk)) throw new Error(`Expected paginated array at ${path}.`);
    result.push(...chunk);
    if (chunk.length < 100) return result;
  }
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
    performedViaGithubApp: comment.performed_via_github_app ? {
      id: comment.performed_via_github_app.id,
      slug: comment.performed_via_github_app.slug,
      owner: {
        id: comment.performed_via_github_app.owner?.id,
        login: comment.performed_via_github_app.owner?.login,
        type: comment.performed_via_github_app.owner?.type,
      },
    } : null,
  };
}

async function loadState(token, owner, repo, prNumber, config) {
  const prData = await githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}`);
  const basePr = normalizePr(prData);
  const requiredCi = requiredCiForBase(basePr.baseRef);
  const [comments, timeline, workflowRuns, checkRuns] = await Promise.all([
    paged(token, `/repos/${owner}/${repo}/issues/${prNumber}/comments`),
    paged(token, `/repos/${owner}/${repo}/issues/${prNumber}/timeline`),
    paged(token, `/repos/${owner}/${repo}/actions/workflows/${E2E_WORKFLOW_FILE}/runs?event=pull_request&head_sha=${basePr.headSha}`, "workflow_runs"),
    paged(token, `/repos/${owner}/${repo}/commits/${basePr.headSha}/check-runs`, "check_runs"),
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
  return { pr, requiredCi, ci, reviews: comments.map(normalizeComment) };
}

function environmentIdentity(prefix) {
  return {
    botLogin: process.env[`${prefix}_BOT_LOGIN`] || "",
    botUserId: Number(process.env[`${prefix}_BOT_USER_ID`] || 0),
    appId: Number(process.env[`${prefix}_APP_ID`] || 0),
    appSlug: process.env[`${prefix}_APP_SLUG`] || "",
    installationId: Number(process.env[`${prefix}_INSTALLATION_ID`] || 0),
    appOwnerId: Number(process.env[`${prefix}_APP_OWNER_ID`] || 0),
    appOwnerLogin: process.env[`${prefix}_APP_OWNER_LOGIN`] || "",
    system: process.env[`${prefix}_SYSTEM`] || "",
  };
}

function environmentTrigger() {
  return {
    eventName: process.env.GATE_EVENT_NAME || "",
    action: process.env.GATE_EVENT_ACTION || "",
    commentId: Number(process.env.GATE_EVENT_COMMENT_ID || 0),
    installationId: Number(process.env.GATE_EVENT_INSTALLATION_ID || 0),
    appId: Number(process.env.GATE_EVENT_APP_ID || 0),
    senderId: Number(process.env.GATE_EVENT_SENDER_ID || 0),
    senderLogin: process.env.GATE_EVENT_SENDER_LOGIN || "",
  };
}

async function createPendingCheck(token, owner, repo, headSha, prNumber) {
  return githubRequest(token, `/repos/${owner}/${repo}/check-runs`, {
    method: "POST",
    body: JSON.stringify({
      name: REQUIRED_CONTEXT,
      head_sha: headSha,
      status: "in_progress",
      external_id: `radulator-exact-head-review/v2/pending/${process.env.GITHUB_RUN_ID || "manual"}/${prNumber}`,
      output: {
        title: "Independent review evaluation in progress",
        summary: "A fresh fail-closed evaluation started. Prior same-name results must not be used as current evidence.",
      },
    }),
  });
}

async function completeCheck(token, owner, repo, checkId, result) {
  return githubRequest(token, `/repos/${owner}/${repo}/check-runs/${checkId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: REQUIRED_CONTEXT,
      status: "completed",
      conclusion: "failure",
      external_id: `radulator-exact-head-review/v2/${result.fingerprint}`,
      output: {
        title: result.eligible ? "PASS candidate (activation blocked)" : "Independent review blocked",
        summary: result.summary,
        text: JSON.stringify({
          schema: RECORD_SCHEMA,
          policy_mode: "evaluation-only",
          reason_code: result.reasonCode,
          eligible: result.eligible,
          head_sha: result.headSha,
          base_sha: result.baseSha,
          review_comment_id: result.record?.commentId || null,
          evaluation_fingerprint: result.fingerprint,
        }),
      },
    }),
  });
}

async function verifyCheck(token, owner, repo, checkId, expectedHeadSha, expectedFingerprint) {
  const check = await githubRequest(token, `/repos/${owner}/${repo}/check-runs/${checkId}`);
  if (
    check.name !== REQUIRED_CONTEXT ||
    check.head_sha !== expectedHeadSha ||
    check.app?.id !== PUBLISHER_APP_ID ||
    check.status !== "completed" ||
    check.conclusion !== "failure" ||
    check.external_id !== `radulator-exact-head-review/v2/${expectedFingerprint}`
  ) throw new Error(`Published check ${checkId} failed fail-closed readback verification.`);
  return check;
}

async function findPullNumbers(token, owner, repo) {
  const direct = Number(process.env.PR_NUMBER || 0);
  if (positiveInteger(direct)) return [direct];
  const baseRef = process.env.BASE_REF;
  if (ALLOWED_BASE_REFS.has(baseRef)) {
    const pulls = await paged(token, `/repos/${owner}/${repo}/pulls?state=open&base=${encodeURIComponent(baseRef)}`);
    return [...new Set(pulls.map((pr) => pr.number))];
  }
  const checkSuiteHead = process.env.CHECK_SUITE_HEAD_SHA;
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
    reviewerIdentity: environmentIdentity("RADULATOR_INDEPENDENT_REVIEW"),
    cloudMergerIdentity: environmentIdentity("RADULATOR_CLOUD_MERGE"),
    trigger: environmentTrigger(),
  };
  const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
  const [owner, repo] = repository.split("/");
  const prNumbers = await findPullNumbers(token, owner, repo);

  for (const prNumber of prNumbers) {
    const initial = normalizePr(await githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}`));
    let check = dryRun ? null : await createPendingCheck(token, owner, repo, initial.headSha, prNumber);
    try {
      const before = await loadState(token, owner, repo, prNumber, config);
      const beforeFingerprint = gateStateFingerprint(before);
      const after = await loadState(token, owner, repo, prNumber, config);
      const afterFingerprint = gateStateFingerprint(after);
      let result = beforeFingerprint === afterFingerprint
        ? evaluateGate({
          ...after,
          reviewerIdentity: config.reviewerIdentity,
          cloudMergerIdentity: config.cloudMergerIdentity,
          trigger: config.trigger,
        })
        : failure(after.pr.headSha, after.pr.baseSha, "Concurrent PR/review/CI state change detected; refusing PASS.", "CONCURRENT_STATE_CHANGE");

      if (!dryRun && check.head_sha !== result.headSha) {
        const oldResult = failure(check.head_sha, initial.baseSha, "PR head changed during evaluation; this old-head check is invalid.", "HEAD_CHANGED");
        await completeCheck(token, owner, repo, check.id, oldResult);
        check = await createPendingCheck(token, owner, repo, result.headSha, prNumber);
      }
      if (!dryRun) {
        await completeCheck(token, owner, repo, check.id, result);
        await verifyCheck(token, owner, repo, check.id, result.headSha, result.fingerprint);

        const post = await loadState(token, owner, repo, prNumber, config);
        if (gateStateFingerprint(post) !== afterFingerprint) {
          result = failure(post.pr.headSha, post.pr.baseSha, "State changed during/after check publication; failure remains authoritative.", "POST_PUBLISH_STATE_CHANGE");
          if (check.head_sha !== post.pr.headSha) check = await createPendingCheck(token, owner, repo, post.pr.headSha, prNumber);
          await completeCheck(token, owner, repo, check.id, result);
          await verifyCheck(token, owner, repo, check.id, result.headSha, result.fingerprint);
        }
      }
      console.log(JSON.stringify({
        pr: prNumber,
        conclusion: result.conclusion,
        eligible: result.eligible,
        reasonCode: result.reasonCode,
        headSha: result.headSha,
        fingerprint: result.fingerprint,
        dryRun,
      }));
    } catch (error) {
      const result = failure(initial.headSha, initial.baseSha, `Gate evaluation error: ${error.message}`, "EVALUATION_ERROR");
      if (!dryRun) {
        await completeCheck(token, owner, repo, check.id, result);
        await verifyCheck(token, owner, repo, check.id, result.headSha, result.fingerprint);
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
