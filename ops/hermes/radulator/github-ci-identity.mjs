import process from "node:process";

import { githubRequest } from "../../../scripts/independent-review-gate.mjs";

const E2E_WORKFLOW_FILE = "e2e-tests.yml";
const E2E_WORKFLOW_PATH = ".github/workflows/e2e-tests.yml";
const GITHUB_ACTIONS_APP_ID = 15368;

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export async function resolveCiIdentity({
  token,
  owner,
  repo,
  env = process.env,
  request = githubRequest,
} = {}) {
  if (!token || !owner || !repo) throw new Error("GitHub token, owner, and repo are required to resolve CI identity.");
  const endpoint = `/repos/${owner}/${repo}/actions/workflows/${E2E_WORKFLOW_FILE}`;
  const workflow = await request(token, endpoint);
  const expectedWorkflowId = Number(workflow?.id);
  if (!positiveInteger(expectedWorkflowId)) throw new Error("GitHub returned a malformed E2E workflow identity.");
  if (workflow.path !== E2E_WORKFLOW_PATH) {
    throw new Error(`Resolved E2E workflow path is not trusted: ${workflow.path || "missing"}.`);
  }
  if (workflow.state !== "active") throw new Error(`Trusted E2E workflow is not active: ${workflow.state || "missing"}.`);

  if (env.RADULATOR_E2E_WORKFLOW_ID) {
    const configuredWorkflowId = Number(env.RADULATOR_E2E_WORKFLOW_ID);
    if (!positiveInteger(configuredWorkflowId) || configuredWorkflowId !== expectedWorkflowId) {
      throw new Error("Configured E2E workflow identity does not match authoritative GitHub metadata.");
    }
  }
  const expectedCiAppId = Number(env.RADULATOR_CI_APP_ID || GITHUB_ACTIONS_APP_ID);
  if (!positiveInteger(expectedCiAppId) || expectedCiAppId !== GITHUB_ACTIONS_APP_ID) {
    throw new Error("Configured CI App identity does not match the trusted GitHub Actions App.");
  }
  return { expectedWorkflowId, expectedCiAppId };
}
