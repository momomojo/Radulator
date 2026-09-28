#!/usr/bin/env node
// Offline tests for scripts/report-source-audit-drift.mjs with a fake GitHub API.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  DRIFT_LABEL,
  applyActions,
  issueTitle,
  loadResults,
  planReport,
  reportDrift,
  severityOf,
} from "./report-source-audit-drift.mjs";
import { RESULTS_SCHEMA } from "./run-source-audits.mjs";

const FAKE_KEY = "0123456789abcdef0123456789abcdef0123";
const RUN_URL = "https://github.com/momomojo/Radulator/actions/runs/42";

function result(id, status, failureClass = null, extra = {}) {
  return {
    id,
    test: `scripts/audit-${id}-source.test.mjs`,
    status,
    attempts: status === "pass" ? 1 : 3,
    head_sha: "c".repeat(40),
    command: `node scripts/audit-${id}-source.test.mjs`,
    stdout_sha256: "d".repeat(64),
    pass_line: status === "pass" ? `${id} verified` : null,
    failure_class: failureClass,
    // Audit output can quote source text; it must never be copied into an issue.
    failure_line: status === "pass" ? null : "SECRET SOURCE QUOTE that must stay out of issues",
    ncbi: null,
    ...extra,
  };
}

function report(label, results) {
  return { schema: RESULTS_SCHEMA, label, head_sha: "c".repeat(40), results };
}

const plan = (current, { previous = [], openIssues = [], allRefsReported = true } = {}) =>
  planReport({ current, previous, openIssues, runUrl: RUN_URL, allRefsReported });

// Severity.
assert.equal(severityOf(result("a", "pass")), "pass");
for (const [status, failureClass] of [["fail", "drift"], ["fail", "assertion"], ["key-leak", "key-leak"], ["error", "assertion"]]) {
  assert.equal(severityOf(result("a", status, failureClass)), "hard", `${status}/${failureClass}`);
}
for (const [status, failureClass] of [["fail", "transport"], ["timeout", "transport"], ["not-run", "budget"], ["missing", null]]) {
  assert.equal(severityOf(result("a", status, failureClass)), "soft", `${status}/${failureClass}`);
}

// Drift opens an issue with statuses only.
const drifted = [report("main", [result("albi", "fail", "drift"), result("bosniak", "pass")]),
  report("develop", [result("albi", "pass"), result("bosniak", "pass")])];
const [openAlbi, quietBosniak] = plan(drifted);
assert.equal(openAlbi.type, "create");
assert.equal(openAlbi.title, "Source audit drift: albi");
assert.match(openAlbi.body, /^<!-- source-audit-drift-state: [0-9a-f]{64} -->/);
assert.match(openAlbi.body, /\| develop \| pass \|/);
assert.match(openAlbi.body, /\| main \| fail \| drift \| 3 \|/);
assert.match(openAlbi.body, new RegExp(RUN_URL.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")));
assert.equal(openAlbi.body.includes("SECRET SOURCE QUOTE"), false, "audit output never reaches an issue");
assert.deepEqual(quietBosniak, { type: "none", id: "bosniak", why: "passing" });

// The same failure again stays quiet; a changed failure comments and updates the recorded state.
const openIssue = { number: 7, title: issueTitle("albi"), body: openAlbi.body };
assert.deepEqual(plan(drifted, { openIssues: [openIssue] })[0], { type: "none", id: "albi", why: "issue #7 already records this failure" });
const worse = [report("main", [result("albi", "fail", "drift")]), report("develop", [result("albi", "fail", "assertion")])];
const [update] = plan(worse, { openIssues: [openIssue] });
assert.equal(update.type, "comment");
assert.equal(update.number, 7);
assert.match(update.body, /^The failure changed\./);
assert.match(update.issueBody, /\| develop \| fail \| assertion \|/);
assert.notEqual(update.issueBody.match(/state: (\w+)/)[1], openAlbi.body.match(/state: (\w+)/)[1]);

// Passing on every ref closes the issue, but only when every ref reported.
const healed = [report("main", [result("albi", "pass")]), report("develop", [result("albi", "pass")])];
const [close] = plan(healed, { openIssues: [openIssue] });
assert.equal(close.type, "close");
assert.equal(close.number, 7);
assert.match(close.body, /passes again on develop and main/);
assert.equal(plan(healed, { openIssues: [openIssue], allRefsReported: false })[0].type, "none");
// An audit that exists on one ref only closes on that ref's pass.
assert.equal(plan([report("develop", [result("albi", "pass")])], { openIssues: [openIssue] })[0].type, "close");

// Transport failures open an issue only on the second consecutive night.
const transport = [report("main", [result("kbrc", "fail", "transport")]), report("develop", [result("kbrc", "timeout", "transport")])];
assert.equal(plan(transport)[0].type, "none");
assert.match(plan(transport)[0].why, /first transport failure/);
assert.equal(plan(transport, { previous: [report("main", [result("kbrc", "pass")])] })[0].type, "none");
assert.equal(plan(transport, { previous: [report("develop", [result("kbrc", "fail", "transport")])] })[0].type, "create");
// ...but an open issue records a transport failure that differs from its last state.
assert.equal(plan(transport, { openIssues: [{ number: 9, title: issueTitle("kbrc"), body: "old" }] })[0].type, "comment");
// A key leak is urgent.
assert.equal(plan([report("main", [result("nirads", "key-leak", "key-leak")])])[0].type, "create");
// Informational results (a declared audit an older ref lacks) are ignored.
assert.deepEqual(plan([report("main", [result("gone", "missing", null, { informational: true })])]), []);
// Duplicate open issues: the oldest one is used.
assert.equal(plan(worse, { openIssues: [{ ...openIssue, number: 12 }, openIssue] })[0].number, 7);

// Applying actions: the label is created once when missing, and everything is redacted.
function fakeClient({ labelExists }) {
  const calls = [];
  return {
    calls,
    getLabel: async (name) => {
      calls.push(["getLabel", name]);
      return labelExists ? { name } : null;
    },
    createLabel: async (label) => calls.push(["createLabel", label]),
    createIssue: async (issue) => {
      calls.push(["createIssue", issue]);
      return { number: 21 };
    },
    comment: async (number, body) => calls.push(["comment", number, body]),
    updateIssue: async (number, patch) => calls.push(["updateIssue", number, patch]),
  };
}
{
  const client = fakeClient({ labelExists: false });
  const leaky = { ...openAlbi, body: `${openAlbi.body}\nhttps://eutils.ncbi.nlm.nih.gov/x?api_key=${FAKE_KEY} ${FAKE_KEY}` };
  const lines = [];
  await applyActions(client, [leaky, update, close, quietBosniak], { key: FAKE_KEY, log: (line) => lines.push(line) });
  assert.deepEqual(client.calls.map((call) => call[0]),
    ["getLabel", "createLabel", "createIssue", "comment", "updateIssue", "comment", "updateIssue"]);
  assert.deepEqual(client.calls[1][1], DRIFT_LABEL);
  assert.deepEqual(client.calls[2][1].labels, ["source-audit-drift"]);
  assert.equal(JSON.stringify(client.calls).includes(FAKE_KEY), false, "nothing written contains the key");
  assert.match(client.calls[2][1].body, /api_key=\[REDACTED\] \[REDACTED\]/);
  assert.deepEqual(client.calls[6], ["updateIssue", 7, { state: "closed", state_reason: "completed" }]);
  assert.deepEqual(lines, [
    "SOURCE-AUDIT DRIFT albi: opened #21",
    "SOURCE-AUDIT DRIFT albi: updated #7",
    "SOURCE-AUDIT DRIFT albi: closed #7",
    "SOURCE-AUDIT DRIFT bosniak: no change (passing)",
  ]);
  const existing = fakeClient({ labelExists: true });
  await applyActions(existing, [openAlbi], { log: () => {} });
  assert.deepEqual(existing.calls.map((call) => call[0]), ["getLabel", "createIssue"]);
  const quiet = fakeClient({ labelExists: false });
  await applyActions(quiet, [quietBosniak], { log: () => {} });
  assert.deepEqual(quiet.calls, [], "no API calls when nothing changes");
}

// End to end through the CLI entry point with a fake fetch.
{
  const root = mkdtempSync(path.join(tmpdir(), "report-source-audit-drift-"));
  try {
    const mainFile = path.join(root, "results-main.json");
    const developFile = path.join(root, "results-develop.json");
    writeFileSync(mainFile, JSON.stringify(drifted[0]));
    writeFileSync(developFile, JSON.stringify(drifted[1]));
    const requests = [];
    const fetchImpl = async (url, init) => {
      requests.push(`${init.method} ${url.replace("https://api.github.com", "")}`);
      assert.equal(init.headers.authorization, "Bearer test-token");
      const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
      if (init.method === "GET" && url.includes("/issues?")) return json(200, [{ number: 3, title: "Unrelated", pull_request: {} }]);
      if (init.method === "GET" && url.includes("/labels/")) return json(404, null);
      if (init.method === "POST" && url.endsWith("/issues")) return json(201, { number: 30 });
      return json(201, {});
    };
    const lines = [];
    const env = {
      GITHUB_TOKEN: "test-token",
      GITHUB_REPOSITORY: "momomojo/Radulator",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_RUN_ID: "42",
    };
    const { actions } = await reportDrift({ argv: ["--results", mainFile, "--results", developFile], env, fetchImpl, log: (line) => lines.push(line) });
    assert.deepEqual(actions.map((action) => action.type), ["create", "none"]);
    assert.deepEqual(requests, [
      "GET /repos/momomojo/Radulator/issues?state=open&labels=source-audit-drift&per_page=100&page=1",
      "GET /repos/momomojo/Radulator/labels/source-audit-drift",
      "POST /repos/momomojo/Radulator/labels",
      "POST /repos/momomojo/Radulator/issues",
    ]);
    assert.equal(lines.some((line) => line.includes("test-token")), false, "the token is never logged");

    // A missing results file is reported and the other refs are still processed (closing is blocked; see above).
    requests.length = 0;
    const partial = await reportDrift({ argv: ["--results", mainFile, "--results", path.join(root, "absent.json"), "--dry-run"],
      env: {}, fetchImpl, log: (line) => lines.push(line) });
    assert.deepEqual(requests, [], "a dry run makes no API calls");
    assert.equal(partial.actions[0].type, "create");
    assert.ok(lines.some((line) => line.startsWith("::warning title=Source-audit results missing::")));
    assert.deepEqual((await reportDrift({ argv: ["--results", path.join(root, "absent.json")], env: {}, fetchImpl, log: () => {} })).actions, []);
    await assert.rejects(reportDrift({ argv: ["--results", mainFile], env: {}, fetchImpl, log: () => {} }), /GITHUB_TOKEN/);
    await assert.rejects(reportDrift({ argv: [], env, fetchImpl, log: () => {} }), /--results/);
    const failingFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await assert.rejects(reportDrift({ argv: ["--results", mainFile], env, fetchImpl: failingFetch, log: () => {} }), /HTTP 500/);

    // Malformed results are rejected.
    const bad = path.join(root, "bad.json");
    writeFileSync(bad, JSON.stringify({ schema: RESULTS_SCHEMA, results: [] }));
    const warnings = [];
    assert.equal(loadResults(bad, (message) => warnings.push(message)), null);
    assert.match(warnings[0], /ref label/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log("source-audit drift reporter tests passed");
