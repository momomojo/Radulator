#!/usr/bin/env node
// Keeps one GitHub issue per clinical source audit in step with the nightly run
// (.github/workflows/source-audit-nightly.yml), so source drift is visible before it blocks a
// promotion (promotions to main run every audit).
//
//   node report-source-audit-drift.mjs --results <results.json> [--results <file> ...]
//        [--previous <file> ...] [--dry-run]
//   env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_RUN_ID (the run link),
//        GITHUB_API_URL (optional)
//
// Each --results file is one ref's scripts/run-source-audits.mjs output (its label names the ref);
// --previous files are the previous nightly run's, used only for the transport-failure streak.
// Policy per audit, with issue title "Source audit drift: <id>" and label source-audit-drift:
//   - drift, assertion, key-leak or error on any ref: open the issue, or comment on the open one
//     when the failure differs from what it last recorded (a steady failure stays quiet);
//   - transport failures only (network, rate limit, timeout, budget): the same, but an issue is
//     opened only when the previous nightly run also failed that audit;
//   - passes on every ref it ran on, with every ref reported: comment and close the open issue.
// Issues carry statuses, failure classes, digests and the run link, never audit output (which can
// quote copyrighted source text), and everything written is redacted again.
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { oneLine, redact, RESULTS_SCHEMA } from "./run-source-audits.mjs";
import { sha256 } from "./select-source-audits.mjs";

export const DRIFT_LABEL = {
  name: "source-audit-drift",
  color: "d93f0b",
  description: "A nightly clinical source audit is failing (managed by report-source-audit-drift.mjs)",
};
const TITLE_PREFIX = "Source audit drift: ";
const STATE_MARKER = /<!-- source-audit-drift-state: ([0-9a-f]{64}) -->/;
const HARD_CLASSES = new Set(["drift", "assertion", "key-leak"]);

export function issueTitle(id) {
  return `${TITLE_PREFIX}${id}`;
}

// "pass", "hard" (needs attention now) or "soft" (transport-like; needs a second night).
export function severityOf(result) {
  if (result.status === "pass") return "pass";
  if (result.status === "key-leak" || result.status === "error") return "hard";
  if (result.status === "fail" && HARD_CLASSES.has(result.failure_class)) return "hard";
  return "soft";
}

// Reads a results file; returns null (and says why) when it is absent or malformed.
export function loadResults(file, warn = () => {}) {
  try {
    const report = JSON.parse(readFileSync(file, "utf8"));
    if (report?.schema !== RESULTS_SCHEMA || !Array.isArray(report.results) || typeof report.label !== "string") {
      throw new Error("not a source-audit results file with a ref label");
    }
    return report;
  } catch (error) {
    warn(`${file}: ${error.message}`);
    return null;
  }
}

function stateSignature(refs) {
  const canonical = Object.keys(refs).sort().map((ref) =>
    [ref, refs[ref].status, refs[ref].failure_class ?? ""].join(":"));
  return sha256(canonical.join("\n"));
}

function stateTable(refs) {
  const rows = Object.keys(refs).sort().map((ref) => {
    const result = refs[ref];
    return `| ${ref} | ${result.status} | ${result.failure_class ?? ""} | ${result.attempts ?? 0} | ` +
      `\`${String(result.head_sha ?? "").slice(0, 12)}\` | \`${String(result.stdout_sha256 ?? "").slice(0, 12)}\` |`;
  });
  return [
    "| Ref | Status | Failure class | Attempts | Head | Output SHA-256 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function issueBody({ id, test, refs, signature, runUrl }) {
  return [
    `<!-- source-audit-drift-state: ${signature} -->`,
    `The nightly clinical source audit \`${oneLine(id)}\` (\`${oneLine(test)}\`) is failing.`,
    "",
    stateTable(refs),
    "",
    `Run: ${runUrl}`,
    "",
    "Promotions to main run every audit, so this failure blocks them until it is fixed. Fix it with a " +
      "judged clinical PR that re-verifies the source and updates its pins (or use the hotfix path for " +
      "a production breakage). The job log for the run above has the audit output. This issue is updated " +
      "when the failure changes and closes itself once the audit passes on every ref.",
  ].join("\n");
}

// The pure decision. Returns the actions to apply, in audit-id order.
//   current, previous: results reports (one per ref); openIssues: [{ number, title, body }]
//   allRefsReported: false when a ref's results could not be read, which blocks closing issues
export function planReport({ current, previous = [], openIssues, runUrl, allRefsReported = true }) {
  const byId = new Map();
  for (const report of current) {
    for (const result of report.results) {
      if (result.informational) continue;
      if (!byId.has(result.id)) byId.set(result.id, { test: result.test, refs: {} });
      byId.get(result.id).refs[report.label] = result;
    }
  }
  const failedBefore = new Set(previous.flatMap((report) => report.results
    .filter((result) => !result.informational && result.status !== "pass")
    .map((result) => result.id)));
  const issues = new Map();
  for (const issue of [...openIssues].sort((left, right) => left.number - right.number)) {
    if (!issues.has(issue.title)) issues.set(issue.title, issue);
  }

  const actions = [];
  for (const id of [...byId.keys()].sort()) {
    const { test, refs } = byId.get(id);
    const severities = Object.values(refs).map(severityOf);
    const issue = issues.get(issueTitle(id)) ?? null;
    const signature = stateSignature(refs);
    if (severities.every((severity) => severity === "pass")) {
      if (issue && allRefsReported) {
        actions.push({ type: "close", id, number: issue.number,
          body: `The audit passes again on ${Object.keys(refs).sort().join(" and ")}.\n\n${stateTable(refs)}\n\nRun: ${runUrl}` });
      } else {
        actions.push({ type: "none", id, why: issue ? "passing, but not every ref reported" : "passing" });
      }
      continue;
    }
    const hard = severities.includes("hard");
    if (!issue) {
      if (hard || failedBefore.has(id)) {
        actions.push({ type: "create", id, title: issueTitle(id), body: issueBody({ id, test, refs, signature, runUrl }) });
      } else {
        actions.push({ type: "none", id, why: "first transport failure; opens if the next nightly run also fails" });
      }
      continue;
    }
    if (issue.body?.match(STATE_MARKER)?.[1] === signature) {
      actions.push({ type: "none", id, why: `issue #${issue.number} already records this failure` });
      continue;
    }
    actions.push({
      type: "comment",
      id,
      number: issue.number,
      body: `The failure changed.\n\n${stateTable(refs)}\n\nRun: ${runUrl}`,
      issueBody: issueBody({ id, test, refs, signature, runUrl }),
    });
  }
  return actions;
}

export function githubClient({ token, repository, apiUrl = "https://api.github.com", fetchImpl = fetch }) {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  const request = async (method, route, body) => {
    const response = await fetchImpl(`${apiUrl}${route}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (method === "GET" && response.status === 404) return null;
    if (!response.ok) throw new Error(`${method} ${route}: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  const repo = `/repos/${repository}`;
  return {
    getLabel: (name) => request("GET", `${repo}/labels/${encodeURIComponent(name)}`),
    createLabel: (label) => request("POST", `${repo}/labels`, label),
    async listOpenIssues(label) {
      const issues = [];
      for (let page = 1; page <= 10; page += 1) {
        const batch = await request("GET", `${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100&page=${page}`);
        if (!Array.isArray(batch) || batch.length === 0) break;
        // The issues API also lists pull requests.
        issues.push(...batch.filter((issue) => !issue.pull_request));
        if (batch.length < 100) break;
      }
      return issues;
    },
    createIssue: (issue) => request("POST", `${repo}/issues`, issue),
    comment: (number, body) => request("POST", `${repo}/issues/${number}/comments`, { body }),
    updateIssue: (number, patch) => request("PATCH", `${repo}/issues/${number}`, patch),
  };
}

// Applies planned actions; every title and body is redacted once more before it leaves.
export async function applyActions(client, actions, { key = "", log = (line) => console.log(line) } = {}) {
  const safe = (text) => redact(text, key);
  if (actions.some((action) => action.type === "create") && !(await client.getLabel(DRIFT_LABEL.name))) {
    await client.createLabel(DRIFT_LABEL);
  }
  for (const action of actions) {
    if (action.type === "create") {
      const issue = await client.createIssue({ title: safe(action.title), body: safe(action.body), labels: [DRIFT_LABEL.name] });
      log(`SOURCE-AUDIT DRIFT ${action.id}: opened #${issue?.number}`);
    } else if (action.type === "comment") {
      await client.comment(action.number, safe(action.body));
      await client.updateIssue(action.number, { body: safe(action.issueBody) });
      log(`SOURCE-AUDIT DRIFT ${action.id}: updated #${action.number}`);
    } else if (action.type === "close") {
      await client.comment(action.number, safe(action.body));
      await client.updateIssue(action.number, { state: "closed", state_reason: "completed" });
      log(`SOURCE-AUDIT DRIFT ${action.id}: closed #${action.number}`);
    } else {
      log(`SOURCE-AUDIT DRIFT ${action.id}: no change (${action.why})`);
    }
  }
}

function parseArgs(argv) {
  const args = { results: [], previous: [], dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--dry-run") args.dryRun = true;
    else if ((name === "--results" || name === "--previous") && argv[index + 1] !== undefined) {
      args[name.slice(2)].push(argv[index + 1]);
      index += 1;
    } else throw new Error(`unknown or incomplete option ${name}`);
  }
  if (args.results.length === 0) throw new Error("pass at least one --results <file>");
  return args;
}

export async function reportDrift({ argv, env = process.env, fetchImpl = fetch, log = (line) => console.log(line) }) {
  const args = parseArgs(argv);
  const warn = (message) => log(`::warning title=Source-audit results missing::${redact(message, env.NCBI_API_KEY)}`);
  const current = args.results.map((file) => loadResults(file, warn)).filter(Boolean);
  const previous = args.previous.map((file) => loadResults(file, () => {})).filter(Boolean);
  const runUrl = `${env.GITHUB_SERVER_URL ?? "https://github.com"}/${env.GITHUB_REPOSITORY ?? "?"}/actions/runs/${env.GITHUB_RUN_ID ?? "?"}`;
  if (current.length === 0) return { actions: [] };
  const client = args.dryRun ? null : githubClient({
    token: env.GITHUB_TOKEN,
    repository: env.GITHUB_REPOSITORY,
    apiUrl: env.GITHUB_API_URL || "https://api.github.com",
    fetchImpl,
  });
  const openIssues = client ? await client.listOpenIssues(DRIFT_LABEL.name) : [];
  const actions = planReport({
    current,
    previous,
    openIssues,
    runUrl,
    allRefsReported: current.length === args.results.length,
  });
  if (client) await applyActions(client, actions, { key: env.NCBI_API_KEY, log });
  else for (const action of actions) log(`SOURCE-AUDIT DRIFT ${action.id}: would ${action.type}${action.why ? ` (${action.why})` : ""}`);
  return { actions };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    await reportDrift({ argv: process.argv.slice(2) });
  } catch (error) {
    console.log(redact(`SOURCE-AUDIT DRIFT ERROR ${error.message}`, process.env.NCBI_API_KEY));
    process.exitCode = 1;
  }
}
