import { spawnSync } from "node:child_process";
import process from "node:process";

const configuredEnv = {
  ...process.env,
  CI: "true",
  VITE_GA4_MEASUREMENT_ID: "G-PRIVACY-BASELINE",
  VITE_GOOGLE_SITE_VERIFICATION: "privacy-google-token",
  VITE_BING_SITE_VERIFICATION: "privacy-bing-token",
  VITE_SEARCH_VERIFICATION_META: "",
};

const run = (command, args) => {
  const result = spawnSync(command, args, {
    env: configuredEnv,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

// This is a local test build of dist, never a deploy or publication command.
run("npm", ["run", "build"]);
run(process.execPath, ["tests/privacy-baseline.test.mjs"]);

console.log("configured privacy artifact checks passed");
