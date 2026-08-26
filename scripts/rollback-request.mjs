#!/usr/bin/env node
import { appendFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ELIGIBLE_MODES = new Set(["main-push", "verified-auto-merge"]);

export function rollbackRequestRequired({ pagesOutcome, smokeOutcome, mode }) {
  return pagesOutcome === "success" && smokeOutcome === "failure" && ELIGIBLE_MODES.has(mode);
}

async function run(env = process.env) {
  if (!env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required for rollback classification.");
  const required = rollbackRequestRequired({
    pagesOutcome: env.PAGES_OUTCOME,
    smokeOutcome: env.SMOKE_OUTCOME,
    mode: env.DEPLOYMENT_MODE,
  });
  await appendFile(env.GITHUB_OUTPUT, `required=${required}\n`, "utf8");
  console.log(JSON.stringify({ required }));
  return { required };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
