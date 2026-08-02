#!/usr/bin/env node
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const REQUIRED_CONTEXT = "Radulator Independent Review (exact head)";
const RECORD_SCHEMA = "radulator-independent-review/v1";
const HOLD_LABELS = new Set(["hold", "do-not-merge", "gate-hold", "needs-fix", "changes-requested", "security-hold", "cancelled", "canceled"]);

function sha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

function sameLogin(left, right) {
  return typeof left === "string" && typeof right === "string" && left.toLowerCase() === right.toLowerCase();
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

function timestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

function failure(headSha, baseSha, summary, record = null) {
  return {
    context: REQUIRED_CONTEXT,
    conclusion: "failure",
    headSha,
    baseSha,
    summary,
    record,
    fingerprint: createHash("sha256").update(canonicalJson({ headSha, baseSha, summary }), "utf8").digest("hex"),
  };
}

function parseRecord(comment, pr, reviewBotLogin, reviewSystem) {
  if (!sameLogin(comment.author, reviewBotLogin)) return null;

  let parsed;
  try {
    parsed = JSON.parse(comment.body);
  } catch {
    return { malformed: true, commentId: comment.id, commentUpdatedAt: comment.updatedAt };
  }

  if (
    parsed.schema !== RECORD_SCHEMA ||
    parsed.pr !== pr.number ||
    !sha(parsed.head_sha) ||
    !sha(parsed.base_sha) ||
    typeof parsed.base_ref !== "string" ||
    !parsed.base_ref ||
    !timestamp(parsed.pr_updated_at) ||
    !timestamp(parsed.reviewed_at) ||
    parsed.reviewer_system !== reviewSystem ||
    !["PASS", "CHANGES", "HOLD"].includes(parsed.verdict)
  ) {
    return { malformed: true, commentId: comment.id, commentUpdatedAt: comment.updatedAt };
  }

  const canonical = canonicalJson({
    author: comment.author,
    comment_id: comment.id,
    comment_created_at: comment.createdAt,
    comment_updated_at: comment.updatedAt,
    ...parsed,
  });
  return { ...parsed, canonical, commentId: comment.id, commentCreatedAt: comment.createdAt, commentUpdatedAt: comment.updatedAt };
}

export function evaluateGate({ pr, reviewBotLogin, reviewSystem, cloudMergeBotLogin, cloudMergeSystem, requiredCi, ci, reviews }) {
  if (!pr || !sha(pr.headSha) || !sha(pr.baseSha)) return failure(pr?.headSha || "", pr?.baseSha || "", "Malformed PR head/base SHA; refusing PASS.");
  if (pr.state !== "open") return failure(pr.headSha, pr.baseSha, "PR is not open; refusing PASS.");
  if (!pr.baseRef || !reviewBotLogin || !reviewSystem || !cloudMergeBotLogin || !cloudMergeSystem || sameLogin(reviewBotLogin, pr.author) || sameLogin(reviewBotLogin, "momomojo") || sameLogin(reviewBotLogin, cloudMergeBotLogin) || reviewSystem === cloudMergeSystem) {
    return failure(pr.headSha, pr.baseSha, "Independent reviewer identity is missing or not independent; refusing PASS.");
  }

  const labels = new Set((pr.labels || []).map((label) => label.toLowerCase()));
  const hold = [...labels].find((label) => HOLD_LABELS.has(label));
  if (hold) return failure(pr.headSha, pr.baseSha, `A hold label is present (${hold}); refusing PASS.`);

  const failedCi = requiredCi.filter((context) => ci[context] !== "success");
  if (failedCi.length) return failure(pr.headSha, pr.baseSha, `Required CI is not green: ${failedCi.join(", ")}.`);

  const parsed = reviews
    .map((comment) => parseRecord(comment, pr, reviewBotLogin, reviewSystem))
    .filter(Boolean)
    .sort((a, b) => `${b.commentUpdatedAt}`.localeCompare(`${a.commentUpdatedAt}`));
  const record = parsed[0];
  if (!record) return failure(pr.headSha, pr.baseSha, "There is no valid independent PASS record for this PR.");
  if (record.malformed) return failure(pr.headSha, pr.baseSha, "Latest independent review record is malformed; refusing PASS.");
  if (record.verdict !== "PASS") return failure(pr.headSha, pr.baseSha, `Latest independent review verdict ${record.verdict}; refusing PASS.`, record);
  if (record.head_sha !== pr.headSha) return failure(pr.headSha, pr.baseSha, "Independent review head SHA does not match the current PR head; refusing PASS.", record);
  if (record.base_sha !== pr.baseSha) return failure(pr.headSha, pr.baseSha, "Independent review base SHA does not match the current PR base; refusing PASS.", record);
  if (record.base_ref !== pr.baseRef) return failure(pr.headSha, pr.baseSha, "Independent review base ref does not match the current PR base; refusing PASS.", record);
  if (record.pr_updated_at !== pr.updatedAt) return failure(pr.headSha, pr.baseSha, "PR review snapshot changed after the independent review; refusing PASS.", record);
  if (!timestamp(record.commentCreatedAt) || Date.parse(record.commentCreatedAt) < Date.parse(record.pr_updated_at)) {
    return failure(pr.headSha, pr.baseSha, "Independent review record was created before the reviewed PR snapshot; refusing PASS.", record);
  }

  return {
    context: REQUIRED_CONTEXT,
    conclusion: "success",
    headSha: pr.headSha,
    baseSha: pr.baseSha,
    summary: `Independent PASS for PR #${pr.number}, exact head ${pr.headSha.slice(0, 12)}, base ${pr.baseSha.slice(0, 12)}.`,
    record,
    fingerprint: createHash("sha256").update(record.canonical, "utf8").digest("hex"),
  };
}

export function gateStateFingerprint({ pr, ci, reviews }) {
  return createHash("sha256")
    .update(canonicalJson({
      pr: {
        state: pr.state,
        headSha: pr.headSha,
        baseSha: pr.baseSha,
        baseRef: pr.baseRef,
        updatedAt: pr.updatedAt,
        labels: [...pr.labels].sort(),
      },
      ci,
      reviews: reviews.map((review) => ({ id: review.id, author: review.author, updatedAt: review.updatedAt, body: review.body })),
    }), "utf8")
    .digest("hex");
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

async function paged(token, path) {
  const result = [];
  for (let page = 1; ; page += 1) {
    const chunk = await githubRequest(token, `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    result.push(...chunk);
    if (chunk.length < 100) return result;
  }
}

function normalizePr(data) {
  return {
    number: data.number,
    state: data.state,
    headSha: data.head.sha,
    baseSha: data.base.sha,
    baseRef: data.base.ref,
    author: data.user.login,
    updatedAt: data.updated_at,
    labels: data.labels.map((label) => label.name),
    draft: data.draft,
  };
}

async function loadState(token, owner, repo, prNumber, requiredCi) {
  const prData = await githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}`);
  const pr = normalizePr(prData);
  const [comments, combined, checks] = await Promise.all([
    paged(token, `/repos/${owner}/${repo}/issues/${prNumber}/comments`),
    githubRequest(token, `/repos/${owner}/${repo}/commits/${pr.headSha}/status`),
    paged(token, `/repos/${owner}/${repo}/commits/${pr.headSha}/check-runs`),
  ]);
  const ci = Object.fromEntries(requiredCi.map((context) => [context, "missing"]));
  for (const status of combined.statuses) if (status.context in ci) ci[status.context] = status.state;
  for (const check of checks.check_runs) if (check.name in ci) ci[check.name] = check.status === "completed" ? check.conclusion : check.status;

  return {
    pr,
    ci,
    reviews: comments.map((comment) => ({
      id: comment.id,
      author: comment.user.login,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      body: comment.body,
    })),
  };
}

async function upsertCheck(token, owner, repo, result) {
  const existing = await paged(token, `/repos/${owner}/${repo}/commits/${result.headSha}/check-runs`);
  const own = existing.find((check) => check.name === REQUIRED_CONTEXT && check.app?.slug === "github-actions");
  const payload = {
    name: REQUIRED_CONTEXT,
    head_sha: result.headSha,
    status: "completed",
    conclusion: result.conclusion,
    external_id: `radulator-exact-head-review/v1/${result.fingerprint}`,
    output: {
      title: result.conclusion === "success" ? "Independent review PASS" : "Independent review required",
      summary: result.summary,
      text: JSON.stringify({
        schema: RECORD_SCHEMA,
        head_sha: result.headSha,
        base_sha: result.baseSha,
        base_ref: result.record?.base_ref || null,
        review_comment_id: result.record?.commentId || null,
        review_fingerprint: result.fingerprint,
      }),
    },
  };
  if (own) return githubRequest(token, `/repos/${owner}/${repo}/check-runs/${own.id}`, { method: "PATCH", body: JSON.stringify(payload) });
  return githubRequest(token, `/repos/${owner}/${repo}/check-runs`, { method: "POST", body: JSON.stringify(payload) });
}

async function findPullNumbers(token, owner, repo) {
  const direct = Number(process.env.PR_NUMBER || 0);
  if (direct) return [direct];
  const baseRef = process.env.BASE_REF;
  if (baseRef) {
    const pulls = await paged(token, `/repos/${owner}/${repo}/pulls?state=open&base=${encodeURIComponent(baseRef)}`);
    return pulls.map((pr) => pr.number);
  }
  const checkSuiteHead = process.env.CHECK_SUITE_HEAD_SHA;
  if (!checkSuiteHead) return [];
  const pulls = await githubRequest(token, `/repos/${owner}/${repo}/commits/${checkSuiteHead}/pulls`);
  return pulls.filter((pr) => pr.state === "open").map((pr) => pr.number);
}

async function run() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY || "";
  const reviewBotLogin = process.env.RADULATOR_INDEPENDENT_REVIEW_BOT_LOGIN || "";
  const reviewSystem = process.env.RADULATOR_INDEPENDENT_REVIEW_SYSTEM || "";
  const cloudMergeBotLogin = process.env.RADULATOR_CLOUD_MERGE_BOT_LOGIN || "";
  const cloudMergeSystem = process.env.RADULATOR_CLOUD_MERGE_SYSTEM || "";
  if (!token || !repository.includes("/")) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
  const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
  const [owner, repo] = repository.split("/");
  const requiredCi = ["Smoke Tests", "Targeted Calculator Tests"];
  const prNumbers = await findPullNumbers(token, owner, repo);
  if (!prNumbers.length) return;

  for (const prNumber of prNumbers) {
    const before = await loadState(token, owner, repo, prNumber, requiredCi);
    let result = evaluateGate({ ...before, reviewBotLogin, reviewSystem, cloudMergeBotLogin, cloudMergeSystem, requiredCi });
    const beforeFingerprint = gateStateFingerprint(before);
    const after = await loadState(token, owner, repo, prNumber, requiredCi);
    const afterFingerprint = gateStateFingerprint(after);
    if (beforeFingerprint !== afterFingerprint) {
      result = failure(after.pr.headSha, after.pr.baseSha, "Concurrent PR/review/CI state change detected during gate evaluation; refusing PASS.");
    } else {
      result = evaluateGate({ ...after, reviewBotLogin, reviewSystem, cloudMergeBotLogin, cloudMergeSystem, requiredCi });
    }
    if (!dryRun) await upsertCheck(token, owner, repo, result);
    console.log(JSON.stringify({ pr: prNumber, conclusion: result.conclusion, headSha: result.headSha, fingerprint: result.fingerprint, dryRun }));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
