#!/usr/bin/env node
// Decides which world-state checks a pull request's Smoke run needs (e2e-tests.yml, step "scope").
//
// Dependency advisories and live clinical-source drift are properties of the outside world, not of
// a PR's diff. A PR whose files are all release-control cannot change a clinical source, and one
// whose files are all clinical cannot change the dependency tree, so each skips only the other
// domain's world-state check. Without this, two independent external breakages deadlock develop:
// the fix for each needs the other's CI, and one PR may not mix both trust domains.
//
// Trust: the workflow runs this file and the risk classifier from the PR's BASE commit, never from
// the PR head, so a PR cannot choose which of its own checks are skipped. A PR that changes either
// file runs every check. No base copy of this file, or any error, also runs every check.
//
//   node ci-scope.mjs <path to release-policy.mjs>
//   env: EVENT_NAME, BASE_SHA, HEAD_SHA (pull_request only), GITHUB_OUTPUT
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SCOPE_RULE_FILES = ["scripts/ci-scope.mjs", "scripts/release-policy.mjs"];
const ALL = (why) => ({ clinical: true, deps: true, why });

export function scopeFor(files, analyzeRisk, { eventName } = {}) {
  if (eventName !== "pull_request") return ALL("not a pull request");
  if (!Array.isArray(files) || files.length === 0) return ALL("no changed files found");
  if (files.some((file) => SCOPE_RULE_FILES.includes(file))) {
    return ALL("the PR changes the scope rules or the risk classifier");
  }
  const domain = (filename) => {
    const codes = analyzeRisk([{ filename, status: "modified", patch: "" }], {}).risk.reasonCodes;
    const release = codes.includes("RELEASE_CONTROL_CHANGE");
    const clinical = codes.some((code) => code.startsWith("CLINICAL_"));
    return release && !clinical ? "release" : clinical && !release ? "clinical" : "other";
  };
  const domains = new Set(files.map(domain));
  const only = (name) => domains.size === 1 && domains.has(name);
  return {
    clinical: !only("release"),
    deps: !only("clinical"),
    why: `${files.length} changed file(s): ${[...domains].join(", ")}`,
  };
}

function changedFiles(baseSha, headSha) {
  const base = execFileSync("git", ["merge-base", baseSha, headSha]).toString().trim();
  return execFileSync("git", ["diff", "--name-only", base, headSha]).toString().split("\n").filter(Boolean);
}

async function main() {
  let result;
  try {
    const { analyzeRisk } = await import(pathToFileURL(path.resolve(process.argv[2])).href);
    const eventName = process.env.EVENT_NAME;
    const files = eventName === "pull_request" ? changedFiles(process.env.BASE_SHA, process.env.HEAD_SHA) : [];
    result = scopeFor(files, analyzeRisk, { eventName });
  } catch (error) {
    result = ALL(`scope failed, running everything: ${error.message}`);
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `clinical=${result.clinical}\ndeps=${result.deps}\n`);
  }
  console.log(`clinical source audits: ${result.clinical}; dependency audit: ${result.deps} (${result.why})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
