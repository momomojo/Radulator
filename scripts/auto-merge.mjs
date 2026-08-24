#!/usr/bin/env node
import { fileURLToPath } from "node:url";

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

const ALLOWED_BASE_REFS = new Set(["develop", "main"]);
const ACTIONS_BOT_ID = 41898282;

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
  return {
    findPullNumbers: () => findPullNumbers(token, owner, repo, env),
    loadGateState: (prNumber) => loadGateState(token, owner, repo, prNumber, config),
    listCheckRuns: (headSha) => paged(token, checkRunsPath(owner, repo, headSha), "check_runs"),
    listCommitStatuses: (headSha) => paged(token, `/repos/${owner}/${repo}/commits/${headSha}/statuses`),
    getBranchRules: (baseRef) => paged(token, `/repos/${owner}/${repo}/rules/branches/${encodeURIComponent(baseRef)}`),
    merge: (prNumber, payload) => githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
    getPr: (prNumber) => githubRequest(token, `/repos/${owner}/${repo}/pulls/${prNumber}`),
    dispatchDeployment: async (payload) => {
      await githubRequest(token, `/repos/${owner}/${repo}/dispatches`, {
        method: "POST",
        body: JSON.stringify({ event_type: "radulator-auto-merge-deploy", client_payload: payload }),
      });
      return { accepted: true, eventType: "radulator-auto-merge-deploy" };
    },
  };
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

    const merged = await client.merge(prNumber, decision.payload);
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
