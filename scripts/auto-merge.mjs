#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import {
  DEPLOY_WORKFLOW_PATH,
  deploymentSourceRef,
  isTrustedDeploymentRun,
} from "./deployment-run-identity.mjs";
import {
  checkRunsPath,
  configuredPublicKeys,
  ENFORCEMENT_CONTEXT,
  evaluateGate,
  findPullNumbers,
  gateStateFingerprint,
  githubRequest,
  loadGateState,
  paged,
  REQUIRED_CONTEXT,
} from "./independent-review-gate.mjs";
import {
  deploymentAuthorizationSucceeded,
  liveSmokePassed,
} from "./select-rollback-deployment.mjs";

const ALLOWED_BASE_REFS = new Set(["develop", "main"]);
const ACTIONS_BOT_ID = 41898282;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const RELEASE_MARKER_SCHEMA = "radulator-release/v1";
const PRODUCTION_BASE_URL = "https://radulator.com";

function blocked(reasonCode, summary) {
  return { ok: false, reasonCode, summary };
}

function checkSort(left, right) {
  const time = Date.parse(right.completed_at || 0) - Date.parse(left.completed_at || 0);
  return time || (right.id || 0) - (left.id || 0);
}

function statusSort(left, right) {
  const time = Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0);
  return time || (right.id || 0) - (left.id || 0);
}

function deploymentRunSort(left, right) {
  const time = Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0);
  return time || (right.id || 0) - (left.id || 0);
}

export function evaluateProductionSingleFlight({
  pr,
  mainRef,
  developRef,
  comparison,
  deployWorkflow,
  deployRun,
  deployJobs,
  marker,
}) {
  const mainSha = mainRef?.object?.sha;
  const developSha = developRef?.object?.sha;
  if (!SHA_PATTERN.test(mainSha || "") || !SHA_PATTERN.test(developSha || "")) {
    return blocked("PRODUCTION_REF_MALFORMED", "Current main/develop refs are unavailable or malformed.");
  }
  if (pr?.baseRef !== "develop" || pr.baseSha !== developSha) {
    return blocked("DEVELOP_BASE_DRIFT", "Feature PR is not based on the exact current develop head.");
  }
  const developReleased = !(
    comparison?.status !== "ahead" && comparison?.status !== "identical" ||
    comparison?.behind_by !== 0 ||
    comparison?.merge_base_commit?.sha !== developSha
  );
  const releaseRemediation = (pr.labels || []).includes("release-remediation");
  if (!developReleased && !releaseRemediation) {
    return blocked(
      "UNRELEASED_DEVELOP_HEAD",
      "Current develop is not contained in current main; finish the active production release first.",
    );
  }
  if (
    !Number.isSafeInteger(deployWorkflow?.id) || deployWorkflow.id <= 0 ||
    deployWorkflow.path !== DEPLOY_WORKFLOW_PATH ||
    deployWorkflow.state !== "active"
  ) {
    return blocked("DEPLOY_WORKFLOW_IDENTITY_MISMATCH", "Trusted deployment workflow identity is unavailable.");
  }
  if (
    !deployRun ||
    !isTrustedDeploymentRun(deployRun, deployWorkflow.id) ||
    deploymentSourceRef(deployRun) !== mainSha
  ) {
    return blocked("CURRENT_MAIN_DEPLOYMENT_MISSING", "No trusted deployment attempt binds the exact current main SHA.");
  }
  if (deployRun.status !== "completed") {
    return blocked("CURRENT_MAIN_DEPLOYMENT_NOT_COMPLETE", "The newest exact-main deployment attempt is not complete.");
  }
  if (!deploymentAuthorizationSucceeded(deployJobs)) {
    return blocked("CURRENT_MAIN_DEPLOYMENT_NOT_AUTHORIZED", "The newest exact-main deployment lacks successful authorization.");
  }
  if (!liveSmokePassed(deployJobs)) {
    return blocked("CURRENT_MAIN_LIVE_SMOKE_NOT_PASSING", "The newest exact-main deployment lacks successful Pages and live smoke proof.");
  }
  if (
    marker?.ok !== true || marker.status !== 200 ||
    marker.data?.schema !== RELEASE_MARKER_SCHEMA || marker.data?.sha !== mainSha
  ) {
    return blocked("CURRENT_MAIN_MARKER_MISMATCH", "Production does not serve the exact current-main release marker.");
  }
  return {
    ok: true,
    reasonCode: developReleased
      ? "PRODUCTION_LANE_OPEN"
      : "PRODUCTION_REMEDIATION_LANE_OPEN",
    mainSha,
    developSha,
    deployRunId: deployRun.id,
  };
}

export async function loadProductionSingleFlightEvidence(api, pr) {
  const [mainRef, developRef, deployWorkflow] = await Promise.all([
    api.getRef("main"),
    api.getRef("develop"),
    api.getDeployWorkflow(),
  ]);
  const mainSha = mainRef?.object?.sha;
  const developSha = developRef?.object?.sha;
  if (!SHA_PATTERN.test(mainSha || "") || !SHA_PATTERN.test(developSha || "")) {
    return {
      pr, mainRef, developRef, deployWorkflow,
      comparison: null, deployRun: null, deployJobs: [], marker: null,
    };
  }
  const [comparison, deployRuns, marker] = await Promise.all([
    api.compare(developSha, mainSha),
    api.listDeployRuns(mainSha),
    api.getReleaseMarker(mainSha),
  ]);
  const trustedRuns = (deployRuns || []).filter((run) =>
    isTrustedDeploymentRun(run, deployWorkflow?.id) &&
    deploymentSourceRef(run) === mainSha).sort(deploymentRunSort);
  const deployRun = trustedRuns[0] || null;
  const deployJobs = deployRun ? await api.getRunJobs(deployRun.id) : [];
  return {
    pr,
    mainRef,
    developRef,
    comparison,
    deployWorkflow,
    deployRun,
    deployJobs,
    marker,
  };
}

async function requestBaseRefresh(client, prNumber, headSha, extras = {}) {
  const refresh = await client.updateBranch(prNumber, { expected_head_sha: headSha });
  if (!refresh?.accepted) {
    throw new Error(`GitHub refused base refresh for PR #${prNumber}.`);
  }
  return {
    ok: true,
    reasonCode: "BASE_REFRESH_REQUESTED",
    pr: prNumber,
    headSha,
    baseRefreshRequested: true,
    ...extras,
  };
}

export function evaluateAutoMerge({ pr, gateResult, checkRuns, commitStatuses, branchRules, expectedGateAppId }) {
  if (pr?.merged) return blocked("ALREADY_MERGED", "Pull request is already merged.");
  if (!pr || pr.state !== "open" || pr.draft) return blocked("PR_NOT_OPEN_READY", "Pull request is not open and ready.");
  if (!ALLOWED_BASE_REFS.has(pr.baseRef)) return blocked("UNSUPPORTED_BASE", "Pull request base is outside develop/main.");
  if (!gateResult?.eligible || gateResult.conclusion !== "success" || gateResult.reasonCode !== "PASS") {
    return blocked("LIVE_GATE_NOT_PASSING", "Fresh in-process clinical gate evaluation did not pass.");
  }
  if (gateResult.headSha !== pr.headSha || gateResult.baseSha !== pr.baseSha) {
    return blocked("GATE_STATE_MISMATCH", "Gate result does not bind the current pull request head/base.");
  }
  const strictGateRule = (branchRules || []).find((rule) =>
    rule?.type === "required_status_checks" &&
    rule.parameters?.strict_required_status_checks_policy === true &&
    (rule.parameters?.required_status_checks || []).some((check) =>
      check?.context === ENFORCEMENT_CONTEXT &&
      check.integration_id === expectedGateAppId));
  if (!strictGateRule) {
    return blocked(
      "BASE_UPDATE_NOT_SERVER_ENFORCED",
      "Base branch protection must strictly require the exact-head clinical gate before automatic merge.",
    );
  }

  const exactChecks = (checkRuns || [])
    .filter((check) => check.name === REQUIRED_CONTEXT && check.head_sha === pr.headSha)
    .sort(checkSort);
  const current = exactChecks[0];
  if (!current) return blocked("MISSING_GATE_CHECK", "No published clinical gate check exists on the exact head.");
  if (current.app?.id !== expectedGateAppId || current.app?.slug !== "github-actions") {
    return blocked("GATE_CHECK_IDENTITY_MISMATCH", "Current gate check has the wrong publisher identity.");
  }
  if (current.status !== "completed" || current.conclusion !== "success") {
    return blocked("GATE_CHECK_NOT_SUCCESS", "Current exact-head gate check is not a completed success.");
  }
  if (current.external_id !== `radulator-clinical-gate/v1/${gateResult.fingerprint}`) {
    return blocked("GATE_CHECK_FINGERPRINT_MISMATCH", "Published check does not match the fresh gate evaluation fingerprint.");
  }
  const authorization = (commitStatuses || [])
    .filter((status) => status.context === ENFORCEMENT_CONTEXT)
    .sort(statusSort)[0];
  if (!authorization) {
    return blocked("MISSING_GATE_AUTHORIZATION_STATUS", "No server-enforced clinical authorization status exists on the exact head.");
  }
  if (authorization.creator?.id !== ACTIONS_BOT_ID || authorization.creator?.login !== "github-actions[bot]") {
    return blocked("GATE_AUTHORIZATION_STATUS_IDENTITY_MISMATCH", "Clinical authorization status has the wrong publisher identity.");
  }
  if (authorization.state !== "success") {
    return blocked("GATE_AUTHORIZATION_STATUS_NOT_SUCCESS", "Current clinical authorization status is not successful.");
  }
  if (authorization.description !== `PASS ${gateResult.fingerprint}`) {
    return blocked("GATE_AUTHORIZATION_STATUS_FINGERPRINT_MISMATCH", "Clinical authorization status does not bind the fresh gate fingerprint.");
  }
  if (authorization.target_url !== current.html_url) {
    return blocked("GATE_AUTHORIZATION_STATUS_CHECK_LINK_MISMATCH", "Clinical authorization status does not link to the verified exact-head gate check.");
  }

  return {
    ok: true,
    reasonCode: "MERGE_AUTHORIZED",
    payload: {
      sha: pr.headSha,
      // A production promotion must retain the exact develop head as a parent
      // of main. Squashing disconnects the branch histories and makes every
      // later promotion appear to require an unsafe back-merge.
      merge_method: pr.baseRef === "main" ? "merge" : "squash",
      commit_title: `PR #${pr.number}: exact-head clinical gate passed`,
    },
  };
}

function defaultApi(env) {
  const token = env.GITHUB_TOKEN || "";
  const repository = env.GITHUB_REPOSITORY || "";
  if (!token || !repository.includes("/")) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
  const [owner, repo] = repository.split("/");
  const config = {
    expectedWorkflowId: Number(env.RADULATOR_E2E_WORKFLOW_ID || 0),
    expectedCiAppId: Number(env.RADULATOR_CI_APP_ID || 0),
    publicKeys: configuredPublicKeys(env),
  };
  const api = {
    findPullNumbers: () => findPullNumbers(token, owner, repo, env),
    loadGateState: (prNumber) => loadGateState(token, owner, repo, prNumber, config),
    listCheckRuns: (headSha) => paged(token, checkRunsPath(owner, repo, headSha), "check_runs"),
    listCommitStatuses: (headSha) => paged(token, `/repos/${owner}/${repo}/commits/${headSha}/statuses`),
    getBranchRules: (baseRef) => paged(token, `/repos/${owner}/${repo}/rules/branches/${encodeURIComponent(baseRef)}`),
    merge: (prNumber, payload) => githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
    getMergeability: (prNumber) => githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}`),
    updateBranch: async (prNumber, payload) => {
      const response = await githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}/update-branch`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return { accepted: true, response };
    },
    getPr: (prNumber) => githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}`),
    getRef: (branch) => githubRequest(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`),
    compare: (baseSha, headSha) => githubRequest(token, `/repos/${owner}/${repo}/compare/${baseSha}...${headSha}`),
    getDeployWorkflow: () => githubRequest(token, `/repos/${owner}/${repo}/actions/workflows/deploy.yml`),
    listDeployRuns: (headSha) => paged(
      token,
      `/repos/${owner}/${repo}/actions/workflows/deploy.yml/runs?head_sha=${headSha}`,
      "workflow_runs",
    ),
    getRunJobs: (runId) => paged(token, `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`, "jobs"),
    getReleaseMarker: async (sha) => {
      try {
        const response = await fetch(new URL(`/releases/${sha}.json`, `${PRODUCTION_BASE_URL}/`), {
          redirect: "follow",
          headers: {
            "cache-control": "no-cache",
            "user-agent": "radulator-production-single-flight/v1",
          },
        });
        const body = await response.text();
        let data = null;
        try {
          data = JSON.parse(body);
        } catch {
          data = null;
        }
        return { ok: response.ok, status: response.status, data };
      } catch (error) {
        return { ok: false, status: null, data: null, error: error.message };
      }
    },
    dispatchDeployment: async (payload) => {
      await githubRequest(token, `/repos/${owner}/${repo}/dispatches`, {
        method: "POST",
        body: JSON.stringify({ event_type: "radulator-auto-merge-deploy", client_payload: payload }),
      });
      return { accepted: true, eventType: "radulator-auto-merge-deploy" };
    },
  };
  api.loadProductionSingleFlightEvidence = (pr) => loadProductionSingleFlightEvidence(api, pr);
  return api;
}

export async function runAutoMerge({
  env = process.env,
  api = null,
  evaluateGateImpl = evaluateGate,
  fingerprintImpl = gateStateFingerprint,
} = {}) {
  const client = api || defaultApi(env);
  const prNumbers = await client.findPullNumbers();
  const results = [];

  for (const prNumber of prNumbers) {
    const before = await client.loadGateState(prNumber);
    const beforeFingerprint = fingerprintImpl(before);
    const current = await client.loadGateState(prNumber);
    const currentFingerprint = fingerprintImpl(current);
    if (beforeFingerprint !== currentFingerprint) {
      results.push(blocked("CONCURRENT_GATE_STATE_CHANGE", "PR, CI, files, or judge state changed during merge preflight."));
      continue;
    }

    const gateResult = evaluateGateImpl(current);
    const [checks, statuses, branchRules] = await Promise.all([
      client.listCheckRuns(current.pr.headSha),
      client.listCommitStatuses(current.pr.headSha),
      client.getBranchRules(current.pr.baseRef),
    ]);
    let decision = evaluateAutoMerge({
      pr: current.pr,
      gateResult,
      checkRuns: checks,
      commitStatuses: statuses,
      branchRules,
      expectedGateAppId: Number(env.RADULATOR_CI_APP_ID || 15368),
    });
    if (!decision.ok) {
      results.push(decision);
      continue;
    }
    if (current.pr.baseRef === "develop") {
      const lane = evaluateProductionSingleFlight(
        await client.loadProductionSingleFlightEvidence(current.pr),
      );
      if (!lane.ok) {
        results.push(lane);
        continue;
      }
    }
    if (env.RADULATOR_AUTO_MERGE_ENABLED !== "true") {
      results.push({ ...decision, dryRun: true });
      continue;
    }

    const finalState = await client.loadGateState(prNumber);
    if (fingerprintImpl(finalState) !== currentFingerprint) {
      results.push(blocked("CONCURRENT_GATE_STATE_CHANGE", "Gate state changed immediately before merge."));
      continue;
    }
    const finalGate = evaluateGateImpl(finalState);
    const [finalChecks, finalStatuses, finalBranchRules] = await Promise.all([
      client.listCheckRuns(finalState.pr.headSha),
      client.listCommitStatuses(finalState.pr.headSha),
      client.getBranchRules(finalState.pr.baseRef),
    ]);
    decision = evaluateAutoMerge({
      pr: finalState.pr,
      gateResult: finalGate,
      checkRuns: finalChecks,
      commitStatuses: finalStatuses,
      branchRules: finalBranchRules,
      expectedGateAppId: Number(env.RADULATOR_CI_APP_ID || 15368),
    });
    if (!decision.ok) {
      results.push(decision);
      continue;
    }
    const mergeability = await client.getMergeability(prNumber);
    if (mergeability?.head?.sha !== finalState.pr.headSha) {
      results.push(blocked("CONCURRENT_GATE_STATE_CHANGE", "Pull request head changed during mergeability preflight."));
      continue;
    }
    if (mergeability.mergeable_state === "behind") {
      results.push(await requestBaseRefresh(client, prNumber, finalState.pr.headSha));
      continue;
    }
    if (finalState.pr.baseRef === "develop") {
      const lane = evaluateProductionSingleFlight(
        await client.loadProductionSingleFlightEvidence(finalState.pr),
      );
      if (!lane.ok) {
        results.push(lane);
        continue;
      }
    }

    let merged;
    try {
      merged = await client.merge(prNumber, decision.payload);
    } catch (error) {
      if (error?.status !== 405) throw error;
      const afterRefusal = await client.getMergeability(prNumber);
      if (afterRefusal?.head?.sha !== finalState.pr.headSha) {
        results.push(blocked("CONCURRENT_GATE_STATE_CHANGE", "Pull request head changed after protected merge refusal."));
        continue;
      }
      if (afterRefusal.mergeable_state !== "behind") throw error;
      results.push(await requestBaseRefresh(client, prNumber, finalState.pr.headSha, {
        mergeRefusalRecovered: true,
      }));
      continue;
    }
    if (!merged?.merged || typeof merged.sha !== "string" || !merged.sha) {
      throw new Error(`GitHub refused exact-head merge for PR #${prNumber}: ${merged?.message || "unknown response"}`);
    }
    const readback = await client.getPr(prNumber);
    if (!readback?.merged || readback.state !== "closed" || readback.merge_commit_sha !== merged.sha) {
      throw new Error(`Merged PR #${prNumber} failed authoritative readback verification.`);
    }
    let deploymentDispatched = false;
    if (finalState.pr.baseRef === "main") {
      const dispatch = await client.dispatchDeployment({
        ref: merged.sha,
        prNumber,
        sourceHeadSha: finalState.pr.headSha,
      });
      if (!dispatch?.accepted || dispatch.eventType !== "radulator-auto-merge-deploy") {
        throw new Error(`Production deployment dispatch for merged PR #${prNumber} was not accepted.`);
      }
      deploymentDispatched = true;
    }
    results.push({
      ok: true,
      reasonCode: "MERGED",
      merged: true,
      pr: prNumber,
      mergeSha: merged.sha,
      headSha: finalState.pr.headSha,
      deploymentDispatched,
    });
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAutoMerge().then((results) => {
    for (const result of results) console.log(JSON.stringify(result));
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
