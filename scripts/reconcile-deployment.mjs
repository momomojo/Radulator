#!/usr/bin/env node
import process from "node:process";
import { fileURLToPath } from "node:url";

import { githubRequest, paged } from "./independent-review-gate.mjs";
import { deploymentSourceRef } from "./deployment-run-identity.mjs";
import {
  deploymentAuthorizationSucceeded,
  liveSmokeFailed,
  liveSmokePassed,
} from "./select-rollback-deployment.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

const RETRY_COOLDOWN_MS = 30 * 60 * 1000;

export async function reconcileCurrentMainDeployment({ api, now = Date.now() }) {
  const mainRef = await api.getMainRef();
  const mainSha = mainRef?.object?.sha;
  if (!SHA_PATTERN.test(mainSha || "")) throw new Error("Current main ref is malformed.");

  const pullRefs = await api.listPullsForCommit(mainSha);
  const pullReadbacks = await Promise.all((pullRefs || [])
    .filter((pull) => Number.isSafeInteger(pull?.number) && pull.number > 0)
    .map((pull) => api.getPr(pull.number)));
  const candidates = pullReadbacks.filter((pr) =>
    pr?.merged && pr.state === "closed" && pr.base?.ref === "main" &&
    pr.merge_commit_sha === mainSha && SHA_PATTERN.test(pr.head?.sha || ""));
  if (candidates.length !== 1) {
    return { status: "not-auto-merge-main", mainSha, candidateCount: candidates.length };
  }

  const pr = candidates[0];
  const runs = await api.listDeployRunsForHead(mainSha);
  const relevant = (runs || []).filter((run) =>
    run?.name === "Deploy to GitHub Pages" && deploymentSourceRef(run) === mainSha);
  const satisfied = relevant.find((run) =>
    run.status !== "completed" || run.conclusion === "success");
  if (satisfied) return { status: "already-satisfied", mainSha, pr: pr.number, runId: satisfied.id };

  const failures = relevant.filter((run) => run.status === "completed" && run.conclusion !== "success");
  if (failures.length) {
    const jobsByFailure = await Promise.all(failures.map((run) => api.getRunJobs(run.id)));
    const liveSuccessIndex = jobsByFailure.findIndex((jobs) => liveSmokePassed(jobs));
    if (liveSuccessIndex >= 0) {
      return {
        status: "already-satisfied", mainSha, pr: pr.number,
        runId: failures[liveSuccessIndex].id, ancillaryFailure: true,
      };
    }
    const liveFailureIndex = jobsByFailure.findIndex((jobs) => liveSmokeFailed(jobs));
    if (liveFailureIndex >= 0) {
      return {
        status: "rollback-required", mainSha, pr: pr.number,
        failedRunId: failures[liveFailureIndex].id,
      };
    }
    const authorizedFailures = failures.filter((_run, index) => deploymentAuthorizationSucceeded(jobsByFailure[index]));
    if (authorizedFailures.length >= 3) {
      const latest = Math.max(...authorizedFailures.map((run) => Date.parse(run.created_at || "")));
      if (!Number.isFinite(latest) || now - latest < RETRY_COOLDOWN_MS) {
        return { status: "retry-cooldown", mainSha, pr: pr.number, attempts: authorizedFailures.length };
      }
    }
  }

  const payload = { ref: mainSha, prNumber: pr.number, sourceHeadSha: pr.head.sha };
  const dispatched = await api.dispatchDeployment(payload);
  if (!dispatched?.accepted) throw new Error(`Deployment reconciliation dispatch was not accepted for ${mainSha}.`);
  return { status: "dispatched", mainSha, pr: pr.number };
}

function defaultApi(env) {
  const token = env.GITHUB_TOKEN || "";
  const repository = env.GITHUB_REPOSITORY || "";
  if (!token || !repository.includes("/")) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
  return {
    getMainRef: () => githubRequest(token, `/repos/${repository}/git/ref/heads/main`),
    listPullsForCommit: (sha) => paged(token, `/repos/${repository}/commits/${sha}/pulls`),
    getPr: (number) => githubRequest(token, `/repos/${repository}/pulls/${number}`),
    listDeployRunsForHead: (sha) => paged(
      token,
      `/repos/${repository}/actions/workflows/deploy.yml/runs?head_sha=${sha}`,
      "workflow_runs",
    ),
    getRunJobs: (runId) => paged(token, `/repos/${repository}/actions/runs/${runId}/jobs`, "jobs"),
    dispatchDeployment: async (payload) => {
      await githubRequest(token, `/repos/${repository}/dispatches`, {
        method: "POST",
        body: JSON.stringify({ event_type: "radulator-auto-merge-deploy", client_payload: payload }),
      });
      return { accepted: true };
    },
  };
}

async function run(env = process.env) {
  const result = await reconcileCurrentMainDeployment({ api: defaultApi(env) });
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
