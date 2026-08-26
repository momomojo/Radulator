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

export async function authorizeDeployment({ eventName, event, api }) {
  if (eventName === "push") {
    if (event?.ref !== "refs/heads/main" || !SHA_PATTERN.test(event?.after || "")) {
      return blocked("UNTRUSTED_PUSH", "Only an immutable main push SHA can deploy.");
    }
    return { ok: true, ref: event.after, mode: "main-push" };
  }

  if (eventName === "repository_dispatch") {
    const payload = event?.client_payload || {};
    if (event?.action === "radulator-auto-merge-deploy") {
      if (
        !SHA_PATTERN.test(payload.ref || "") ||
        !SHA_PATTERN.test(payload.sourceHeadSha || "") ||
        !Number.isSafeInteger(payload.prNumber) || payload.prNumber <= 0
      ) return blocked("MALFORMED_AUTO_MERGE_DISPATCH", "Automatic deployment payload is malformed.");
      const [mainRef, pr] = await Promise.all([api.getMainRef(), api.getPr(payload.prNumber)]);
      if (mainRef?.object?.sha !== payload.ref) {
        return blocked("DISPATCH_REF_NOT_CURRENT_MAIN", "Automatic deployment ref is not the current main SHA.");
      }
      if (
        !pr?.merged || pr.state !== "closed" || pr.base?.ref !== "main" ||
        pr.merge_commit_sha !== payload.ref || pr.head?.sha !== payload.sourceHeadSha
      ) return blocked("MERGED_PR_READBACK_MISMATCH", "Automatic deployment is not bound to the exact merged PR.");
      return { ok: true, ref: payload.ref, mode: "verified-auto-merge" };
    }
    if (event?.action === "radulator-verified-rollback-deploy") {
      const failedRunId = payload.failedRunId;
      if (
        !SHA_PATTERN.test(payload.ref || "") ||
        !Number.isSafeInteger(failedRunId) || failedRunId <= 0 ||
        !Number.isSafeInteger(payload.sourceRunId) || payload.sourceRunId <= 0
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
      return { ok: true, ref: payload.ref, mode: "verified-rollback", failedRunId };
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

async function run(env = process.env) {
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8"));
  const result = await authorizeDeployment({
    eventName: env.GITHUB_EVENT_NAME,
    event,
    api: defaultApi(env),
  });
  if (!result.ok) throw new Error(`${result.reasonCode}: ${result.summary}`);
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `ref=${result.ref}\nmode=${result.mode}\n`, "utf8");
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
