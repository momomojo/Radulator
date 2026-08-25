const SHA_PATTERN = /^[0-9a-f]{40}$/;

export const AUTO_DEPLOY_EVENT = "radulator-auto-merge-deploy";
export const ROLLBACK_DEPLOY_EVENT = "radulator-verified-rollback-deploy";

export function deploymentSourceRef(run) {
  if (!SHA_PATTERN.test(run?.head_sha || "")) return null;
  if (run.event === "push") return run.head_branch === "main" ? run.head_sha : null;
  if (run.event === "repository_dispatch" && run.display_title === `Deploy ${AUTO_DEPLOY_EVENT}:${run.head_sha}`) {
    if (run.head_branch != null && run.head_branch !== "main") return null;
    return run.head_sha;
  }
  return null;
}

export function isRollbackDeploymentRun(run) {
  return run?.event === "repository_dispatch" &&
    typeof run.display_title === "string" &&
    run.display_title.startsWith(`Deploy ${ROLLBACK_DEPLOY_EVENT}:`);
}
