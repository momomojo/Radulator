#!/usr/bin/env node
import { appendFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

function liveSmokeFailed(jobs) {
  const steps = (jobs || []).flatMap((job) => job.steps || []);
  return steps.some((step) => step.name === "Deploy to GitHub Pages" && step.conclusion === "success") &&
    steps.some((step) => step.name === "Verify deployed site" && step.conclusion === "failure");
}

export function selectLastGoodDeployment(failedRun, runs, failedJobs = null) {
  if (
    !failedRun ||
    failedRun.name !== "Deploy to GitHub Pages" ||
    failedRun.event !== "push" ||
    failedRun.head_branch !== "main" ||
    failedRun.status !== "completed" ||
    failedRun.conclusion !== "failure" ||
    !SHA_PATTERN.test(failedRun.head_sha || "") ||
    Number.isNaN(Date.parse(failedRun.created_at))
  ) return null;
  if (failedJobs !== null && !liveSmokeFailed(failedJobs)) return null;

  const failedAt = Date.parse(failedRun.created_at);
  const candidates = (runs || []).filter((run) =>
    run.id !== failedRun.id &&
    run.name === "Deploy to GitHub Pages" &&
    run.head_branch === "main" &&
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

async function githubRequest(token, path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "user-agent": "radulator-rollback-selector/v1",
    },
  });
  if (!response.ok) throw new Error(`GET ${path} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

async function run() {
  const token = process.env.GITHUB_TOKEN || "";
  const repository = process.env.GITHUB_REPOSITORY || "";
  const failedRunId = Number(argument("--failed-run-id"));
  if (!token || !repository.includes("/") || !Number.isSafeInteger(failedRunId) || failedRunId <= 0) {
    throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY, and a positive --failed-run-id are required.");
  }
  const failedRun = await githubRequest(token, `/repos/${repository}/actions/runs/${failedRunId}`);
  const jobs = await githubRequest(token, `/repos/${repository}/actions/runs/${failedRunId}/jobs?per_page=100`);
  const data = await githubRequest(token, `/repos/${repository}/actions/workflows/deploy.yml/runs?status=completed&per_page=100`);
  const selected = selectLastGoodDeployment(failedRun, data.workflow_runs, jobs.jobs);
  if (!selected) throw new Error(`No prior successful main deployment can roll back failed run ${failedRunId}.`);

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
