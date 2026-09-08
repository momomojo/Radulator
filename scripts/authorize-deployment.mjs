#!/usr/bin/env node
import { appendFile, readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { githubRequest, paged } from "./independent-review-gate.mjs";
import { pagesDeploymentSucceeded, selectLastGoodDeployment } from "./select-rollback-deployment.mjs";
import { DEPLOY_WORKFLOW_PATH, isTrustedDeploymentRun } from "./deployment-run-identity.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

function blocked(reasonCode, summary) {
  return { ok: false, reasonCode, summary };
}

function isSha(value) {
  return SHA_PATTERN.test(value || "");
}

function isPrNumber(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isMergedMainPr(pr, mainSha) {
  return isPrNumber(pr?.number) && pr.merged === true && pr.state === "closed" &&
    pr.base?.ref === "main" && pr.merge_commit_sha === mainSha && isSha(pr.head?.sha);
}

async function readImmutableCommit(api, sha, reasonCode = "COMMIT_IDENTITY_MISMATCH") {
  const commit = await api.getCommit(sha);
  if (commit?.sha !== sha || !isSha(commit?.tree?.sha)) {
    return blocked(reasonCode, "Immutable deployment commit or tree identity is malformed or mismatched.");
  }
  return { ok: true, treeSha: commit.tree.sha };
}

async function resolveOrdinaryBinding({ api, mainSha, prNumber = null, expectedHeadSha = null }) {
  let pr;
  if (prNumber !== null) {
    pr = await api.getPr(prNumber);
    if (!isMergedMainPr(pr, mainSha) || pr.number !== prNumber ||
      (expectedHeadSha !== null && pr.head.sha !== expectedHeadSha)) {
      return blocked("MERGED_PR_READBACK_MISMATCH", "Automatic deployment is not bound to the exact merged PR.");
    }
  } else {
    const pullRefs = await api.listPullsForCommit(mainSha);
    const pullReadbacks = await Promise.all((pullRefs || [])
      .filter((pull) => isPrNumber(pull?.number))
      .map((pull) => api.getPr(pull.number)));
    const candidates = pullReadbacks.filter((candidate) => isMergedMainPr(candidate, mainSha));
    if (candidates.length !== 1) {
      return blocked("MERGED_MAIN_PR_NOT_UNIQUE", "Current main must resolve to exactly one matching merged PR.");
    }
    pr = candidates[0];
  }

  const [headCommit, mainCommit] = await Promise.all([
    readImmutableCommit(api, pr.head.sha),
    readImmutableCommit(api, mainSha),
  ]);
  if (!headCommit.ok) return headCommit;
  if (!mainCommit.ok) return mainCommit;
  if (headCommit.treeSha !== mainCommit.treeSha) {
    return blocked("SOURCE_TREE_MISMATCH", "Merged PR head and current main do not have the same source tree.");
  }
  return {
    ok: true,
    reviewedHeadSha: pr.head.sha,
    sourceTreeSha: mainCommit.treeSha,
    prNumber: pr.number,
  };
}

export async function authorizeDeployment({ eventName, event, api }) {
  if (eventName === "push") {
    if (event?.ref !== "refs/heads/main" || !isSha(event?.after)) {
      return blocked("UNTRUSTED_PUSH", "Only an immutable main push SHA can deploy.");
    }
    const mainRef = await api.getMainRef();
    if (mainRef?.object?.sha !== event.after) {
      return blocked("MAIN_REF_NOT_CURRENT", "The pushed SHA is not the current main ref.");
    }
    const binding = await resolveOrdinaryBinding({ api, mainSha: event.after });
    if (!binding.ok) return binding;
    return { ...binding, ref: event.after, mode: "main-push" };
  }

  if (eventName === "repository_dispatch") {
    const payload = event?.client_payload || {};
    if (event?.action === "radulator-auto-merge-deploy") {
      if (
        !isSha(payload.ref) ||
        !isSha(payload.sourceHeadSha) ||
        !isPrNumber(payload.prNumber)
      ) return blocked("MALFORMED_AUTO_MERGE_DISPATCH", "Automatic deployment payload is malformed.");
      const mainRef = await api.getMainRef();
      if (mainRef?.object?.sha !== payload.ref) {
        return blocked("DISPATCH_REF_NOT_CURRENT_MAIN", "Automatic deployment ref is not the current main SHA.");
      }
      const binding = await resolveOrdinaryBinding({
        api,
        mainSha: payload.ref,
        prNumber: payload.prNumber,
        expectedHeadSha: payload.sourceHeadSha,
      });
      if (!binding.ok) return binding;
      return { ...binding, ref: payload.ref, mode: "verified-auto-merge" };
    }
    if (event?.action === "radulator-verified-rollback-deploy") {
      const failedRunId = payload.failedRunId;
      if (
        !isSha(payload.ref) ||
        !isPrNumber(failedRunId) ||
        !isPrNumber(payload.sourceRunId)
      ) return blocked("ROLLBACK_EVIDENCE_REQUIRED", "Rollback dispatch evidence is missing or malformed.");
      const [deployWorkflow, failedRun, failedJobs, completedRuns] = await Promise.all([
        api.getDeployWorkflow(),
        api.getRun(failedRunId),
        api.getRunJobs(failedRunId),
        api.listCompletedDeployRuns(),
      ]);
      if (
        !Number.isSafeInteger(deployWorkflow?.id) || deployWorkflow.id <= 0 ||
        deployWorkflow.path !== DEPLOY_WORKFLOW_PATH
      ) return blocked("DEPLOY_WORKFLOW_IDENTITY_MISMATCH", "Trusted deployment workflow identity is unavailable.");
      const selected = selectLastGoodDeployment(failedRun, completedRuns, failedJobs, deployWorkflow.id);
      if (
        !selected || selected.failedRunId !== failedRunId || selected.ref !== payload.ref ||
        selected.sourceRunId !== payload.sourceRunId
      ) return blocked("ROLLBACK_SELECTION_MISMATCH", "Requested rollback ref is not the independently selected last-known-good deployment.");
      const laterRuns = completedRuns.filter((run) =>
        isTrustedDeploymentRun(run, deployWorkflow.id) && run.head_branch === "main" &&
        Number.isSafeInteger(run.id) && run.id > failedRunId);
      const laterJobs = await Promise.all(laterRuns.map((run) => api.getRunJobs(run.id)));
      if (laterJobs.some((jobs) => pagesDeploymentSucceeded(jobs))) {
        return blocked(
          "ROLLBACK_SUPERSEDED",
          "A newer workflow already deployed Pages; rollback of the older failure is no longer monotonic.",
        );
      }
      const rollbackCommit = await readImmutableCommit(api, selected.ref, "ROLLBACK_COMMIT_IDENTITY_MISMATCH");
      if (!rollbackCommit.ok) return rollbackCommit;
      return {
        ok: true,
        ref: payload.ref,
        mode: "verified-rollback",
        failedRunId,
        reviewedHeadSha: null,
        sourceTreeSha: rollbackCommit.treeSha,
        prNumber: null,
      };
    }
    return blocked("UNSUPPORTED_REPOSITORY_DISPATCH", "Repository dispatch type is not authorized to deploy.");
  }

  return blocked("UNSUPPORTED_DEPLOY_EVENT", `Deployment event ${eventName || "unknown"} is not authorized.`);
}

function defaultApi(env) {
  const token = env.GITHUB_TOKEN || "";
  const repository = env.GITHUB_REPOSITORY || "";
  if (!token || !repository.includes("/")) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
  return {
    getMainRef: () => githubRequest(token, `/repos/${repository}/git/ref/heads/main`),
    getCommit: (sha) => githubRequest(token, `/repos/${repository}/git/commits/${sha}`),
    listPullsForCommit: (sha) => paged(token, `/repos/${repository}/commits/${sha}/pulls`),
    getPr: (number) => githubRequest(token, `/repos/${repository}/pulls/${number}`),
    getDeployWorkflow: () => githubRequest(token, `/repos/${repository}/actions/workflows/deploy.yml`),
    getRun: (id) => githubRequest(token, `/repos/${repository}/actions/runs/${id}`),
    getRunJobs: (id) => paged(token, `/repos/${repository}/actions/runs/${id}/jobs`, "jobs"),
    listCompletedDeployRuns: () => paged(
      token,
      `/repos/${repository}/actions/workflows/deploy.yml/runs?status=completed`,
      "workflow_runs",
    ),
  };
}

export async function run(env = process.env, api = defaultApi(env)) {
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8"));
  const result = await authorizeDeployment({
    eventName: env.GITHUB_EVENT_NAME,
    event,
    api,
  });
  if (!result.ok) throw new Error(`${result.reasonCode}: ${result.summary}`);
  if (env.GITHUB_OUTPUT) {
    await appendFile(
      env.GITHUB_OUTPUT,
      `ref=${result.ref}\nmode=${result.mode}\nreviewed_head_sha=${result.reviewedHeadSha ?? ""}\nsource_tree_sha=${result.sourceTreeSha}\npr_number=${result.prNumber ?? ""}\n`,
      "utf8",
    );
  }
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
