#!/usr/bin/env node
import { appendFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  DEPLOY_WORKFLOW_PATH,
  deploymentSourceRef,
  isTrustedDeploymentRun,
  ROLLBACK_DEPLOY_EVENT,
  ROLLBACK_REQUEST_EVENT,
} from "./deployment-run-identity.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DEFAULT_COMPLETION_ATTEMPTS = 20;
const DEFAULT_COMPLETION_DELAY_MS = 3_000;

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function pagesDeploymentSucceeded(jobs) {
  const steps = (jobs || []).flatMap((job) => job.steps || []);
  return steps.some((step) => step.name === "Deploy to GitHub Pages" && step.conclusion === "success");
}

export function liveSmokeFailed(jobs) {
  const steps = (jobs || []).flatMap((job) => job.steps || []);
  return pagesDeploymentSucceeded(jobs) &&
    steps.some((step) => step.name === "Verify deployed site" && step.conclusion === "failure");
}

export function liveSmokePassed(jobs) {
  const steps = (jobs || []).flatMap((job) => job.steps || []);
  return pagesDeploymentSucceeded(jobs) &&
    steps.some((step) => step.name === "Verify deployed site" && step.conclusion === "success");
}

export function deploymentAuthorizationSucceeded(jobs) {
  const steps = (jobs || []).flatMap((job) => job.steps || []);
  return steps.some((step) =>
    step.name === "Authorize immutable deployment source" && step.conclusion === "success");
}

export function selectLastGoodDeployment(failedRun, runs, failedJobs = null, deployWorkflowId = null) {
  if (
    !failedRun ||
    !isTrustedDeploymentRun(failedRun, deployWorkflowId) ||
    deploymentSourceRef(failedRun) !== failedRun.head_sha ||
    failedRun.status !== "completed" ||
    failedRun.conclusion !== "failure" ||
    !SHA_PATTERN.test(failedRun.head_sha || "") ||
    Number.isNaN(Date.parse(failedRun.created_at))
  ) return null;
  if (failedJobs !== null && !liveSmokeFailed(failedJobs)) return null;

  const failedAt = Date.parse(failedRun.created_at);
  const candidates = (runs || []).filter((run) =>
    run.id !== failedRun.id &&
    isTrustedDeploymentRun(run, deployWorkflowId) &&
    deploymentSourceRef(run) === run.head_sha &&
    run.status === "completed" &&
    run.conclusion === "success" &&
    SHA_PATTERN.test(run.head_sha || "") &&
    run.head_sha !== failedRun.head_sha &&
    !Number.isNaN(Date.parse(run.created_at)) &&
    Date.parse(run.created_at) < failedAt);
  candidates.sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at) || right.id - left.id);
  const selected = candidates[0];
  return selected ? {
    ref: selected.head_sha,
    sourceRunId: selected.id,
    failedRunId: failedRun.id,
    failedSha: failedRun.head_sha,
  } : null;
}

async function githubRequest(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "user-agent": "radulator-rollback-selector/v1",
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

export async function loadCompletedDeploymentRuns(token, repository, request = githubRequest) {
  const runs = [];
  for (let page = 1; ; page += 1) {
    const data = await request(
      token,
      `/repos/${repository}/actions/workflows/deploy.yml/runs?status=completed&per_page=100&page=${page}`,
    );
    if (!Array.isArray(data?.workflow_runs)) throw new Error("Deployment workflow-run response is malformed.");
    runs.push(...data.workflow_runs);
    if (data.workflow_runs.length < 100) return runs;
  }
}

export async function loadRunJobs(token, repository, runId, request = githubRequest) {
  if (!Number.isSafeInteger(runId) || runId <= 0) throw new Error("A positive deployment run ID is required.");
  const jobs = [];
  for (let page = 1; ; page += 1) {
    const data = await request(
      token,
      `/repos/${repository}/actions/runs/${runId}/jobs?per_page=100&page=${page}`,
    );
    if (!Array.isArray(data?.jobs)) throw new Error("Deployment job readback is malformed.");
    jobs.push(...data.jobs);
    if (data.jobs.length < 100) return jobs;
  }
}

export async function dispatchRollbackDeployment(token, repository, selected, request = githubRequest) {
  if (
    !SHA_PATTERN.test(selected?.ref || "") ||
    !Number.isSafeInteger(selected?.sourceRunId) || selected.sourceRunId <= 0 ||
    !Number.isSafeInteger(selected?.failedRunId) || selected.failedRunId <= 0
  ) throw new Error("Rollback selection is malformed and cannot be dispatched.");
  await request(token, `/repos/${repository}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      event_type: ROLLBACK_DEPLOY_EVENT,
      client_payload: {
        ref: selected.ref,
        sourceRunId: selected.sourceRunId,
        failedRunId: selected.failedRunId,
      },
    }),
  });
  return { accepted: true, eventType: ROLLBACK_DEPLOY_EVENT };
}

export async function dispatchRollbackRequest(token, repository, failedRunId, request = githubRequest) {
  if (!token || !repository.includes("/") || !Number.isSafeInteger(failedRunId) || failedRunId <= 0) {
    throw new Error("Token, repository, and a positive failed run ID are required for a rollback request.");
  }
  await request(token, `/repos/${repository}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      event_type: ROLLBACK_REQUEST_EVENT,
      client_payload: { failedRunId },
    }),
  });
  return { accepted: true, eventType: ROLLBACK_REQUEST_EVENT, failedRunId };
}

export async function waitForCompletedDeploymentRun(getRun, runId, {
  attempts = DEFAULT_COMPLETION_ATTEMPTS,
  delayMs = DEFAULT_COMPLETION_DELAY_MS,
  wait: waitImpl = wait,
} = {}) {
  if (typeof getRun !== "function" || !Number.isSafeInteger(runId) || runId <= 0) {
    throw new Error("A deployment-run reader and positive run ID are required.");
  }
  if (!Number.isSafeInteger(attempts) || attempts < 1 || !Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error("Deployment completion polling bounds are malformed.");
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const run = await getRun(runId);
    if (run?.id !== runId || typeof run.status !== "string") {
      throw new Error(`Deployment run ${runId} readback is malformed.`);
    }
    if (run.status === "completed") return run;
    if (attempt < attempts && delayMs) await waitImpl(delayMs);
  }
  throw new Error(`Deployment run ${runId} did not complete within the rollback polling window.`);
}

export async function handleRollbackRequest({ api, failedRunId, dispatch = false, completionOptions = {} }) {
  if (!api || !Number.isSafeInteger(failedRunId) || failedRunId <= 0) {
    throw new Error("A rollback API and positive failed run ID are required.");
  }
  const deployWorkflow = await api.getDeployWorkflow();
  if (
    !Number.isSafeInteger(deployWorkflow?.id) || deployWorkflow.id <= 0 ||
    deployWorkflow.path !== DEPLOY_WORKFLOW_PATH
  ) throw new Error("Trusted deployment workflow identity is unavailable.");

  const failedRun = await waitForCompletedDeploymentRun(
    (runId) => api.getRun(runId),
    failedRunId,
    completionOptions,
  );
  const [failedJobs, completedRuns] = await Promise.all([
    api.getRunJobs(failedRunId),
    api.listCompletedDeployRuns(),
  ]);
  const selected = selectLastGoodDeployment(
    failedRun,
    completedRuns,
    failedJobs,
    deployWorkflow.id,
  );
  if (!selected) throw new Error(`No prior successful main deployment can roll back failed run ${failedRunId}.`);
  if (dispatch) {
    const dispatched = await api.dispatchRollback(selected);
    if (!dispatched?.accepted) throw new Error(`Rollback dispatch was not accepted for failed run ${failedRunId}.`);
  }
  return selected;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

function defaultRollbackApi(token, repository) {
  return {
    getDeployWorkflow: () => githubRequest(token, `/repos/${repository}/actions/workflows/deploy.yml`),
    getRun: (runId) => githubRequest(token, `/repos/${repository}/actions/runs/${runId}`),
    getRunJobs: (runId) => loadRunJobs(token, repository, runId),
    listCompletedDeployRuns: () => loadCompletedDeploymentRuns(token, repository),
    dispatchRollback: (selected) => dispatchRollbackDeployment(token, repository, selected),
  };
}

async function run() {
  const token = process.env.GITHUB_TOKEN || "";
  const repository = process.env.GITHUB_REPOSITORY || "";
  const failedRunId = Number(argument("--failed-run-id"));
  if (!token || !repository.includes("/") || !Number.isSafeInteger(failedRunId) || failedRunId <= 0) {
    throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY, and a positive --failed-run-id are required.");
  }
  if (process.argv.includes("--request")) {
    const requested = await dispatchRollbackRequest(token, repository, failedRunId);
    console.log(JSON.stringify(requested));
    return requested;
  }

  const selected = await handleRollbackRequest({
    api: defaultRollbackApi(token, repository),
    failedRunId,
    dispatch: process.argv.includes("--dispatch"),
  });

  const output = argument("--output");
  if (output) await writeFile(output, `${JSON.stringify(selected, null, 2)}\n`, "utf8");
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `ref=${selected.ref}\nsource_run_id=${selected.sourceRunId}\nfailed_run_id=${selected.failedRunId}\n`, "utf8");
  }
  console.log(JSON.stringify(selected));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
