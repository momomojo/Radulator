#!/usr/bin/env node
// Offline tests for scripts/run-source-audits.mjs, using fake audits in a throwaway checkout.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  RESULTS_SCHEMA,
  assertPristine,
  backoffBefore,
  classifyFailure,
  findLeaks,
  ncbiStats,
  oneLine,
  redact,
  checkoutFingerprint,
  exactHeadDrift,
  fingerprintChanges,
  runSourceAudits,
  snapshotCommit,
} from "./run-source-audits.mjs";
import { MANIFEST_SCHEMA, SELECTION_SCHEMA, selectSourceAudits, validateManifest } from "./select-source-audits.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(here, "run-source-audits.mjs");
// A fake key shaped like an NCBI key; the tests check it never reaches output.
const FAKE_KEY = "0123456789abcdef0123456789abcdef0123";

// ---- pure helpers ------------------------------------------------------------------------------
assert.equal(
  redact(`GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&api_key=${FAKE_KEY}&id=1 ${FAKE_KEY}`, FAKE_KEY),
  "GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&api_key=[REDACTED]&id=1 [REDACTED]",
);
assert.equal(redact("api_key=someOtherKey123456&x=1", ""), "api_key=[REDACTED]&x=1", "any api_key value is scrubbed");
assert.equal(redact("short key abc stays", "abc"), "short key abc stays", "keys shorter than 8 characters are not treated as secrets");
assert.deepEqual(findLeaks(`url?api_key=${FAKE_KEY}`, FAKE_KEY), ["the NCBI_API_KEY value", "an api_key= value"]);
assert.deepEqual(findLeaks("url?api_key=abcdef0123456789", ""), ["an api_key= value"]);
for (const placeholder of ["api_key=[REDACTED]", "api_key=REDACTED", "api_key=%5BREDACTED%5D", "api_key=***", "api_key=&db=pmc"]) {
  assert.deepEqual(findLeaks(placeholder, FAKE_KEY), [], `${placeholder} is not a leak`);
}
assert.equal(classifyFailure({ output: "Error: fetch failed" }), "transport");
assert.equal(classifyFailure({ output: "HTTP 429 Too Many Requests" }), "transport");
assert.equal(classifyFailure({ output: "expected sha256 abc, got def" }), "drift");
assert.equal(classifyFailure({ output: "AssertionError: 2 !== 3" }), "assertion");
assert.equal(classifyFailure({ output: "", timedOut: true }), "transport");
assert.equal(classifyFailure({ output: "fetch failed", fetchLog: [{ outcome: "drift" }] }), "drift", "the fetch log wins");
assert.equal(classifyFailure({ output: "sha256 mismatch", fetchLog: [{ outcome: "ok" }, { outcome: "transport" }] }), "transport");
assert.equal(ncbiStats([], ["eutils.ncbi.nlm.nih.gov"]), null, "no fetch log means unknown, not zero");
assert.deepEqual(
  ncbiStats([
    { host: "eutils.ncbi.nlm.nih.gov", status: 429, provenance: "live" },
    { host: "eutils.ncbi.nlm.nih.gov", status: 200, provenance: "live" },
    { host: "eutils.ncbi.nlm.nih.gov", status: 200, provenance: "cache" },
    { host: "example.org", status: 200, provenance: "live" },
  ], ["eutils.ncbi.nlm.nih.gov"]),
  { requests: 2, http_429: 1, cache_hits: 1 },
);
assert.deepEqual([1, 2, 3, 4].map((attempt) => backoffBefore(attempt, [60, 180])), [0, 60, 180, 180]);
assert.equal(oneLine("a\rb\nc\u2028d\u0085e\u001bf\tg"), "a?b?c?d?e?f\tg");
assert.equal(backoffBefore(2, []), 0);

// ---- a throwaway checkout with fake audits -------------------------------------------------------
const root = mkdtempSync(path.join(tmpdir(), "run-source-audits-"));
const checkout = path.join(root, "checkout");
const write = (file, text) => {
  mkdirSync(path.dirname(path.join(checkout, file)), { recursive: true });
  writeFileSync(path.join(checkout, file), text);
};
const audit = (name, body) => write(`scripts/audit-${name}-source.test.mjs`, `import fs from "node:fs";\n${body}\n`);
audit("pass", 'console.log("noise");\nconsole.log("pass audit verified the pinned source");');
audit("flaky", [
  'const marker = "flaky-attempted";',
  'if (!fs.existsSync(marker)) { fs.writeFileSync(marker, "1"); console.error("TypeError: fetch failed"); process.exit(1); }',
  'console.log("flaky audit verified on retry");',
].join("\n"));
audit("broken", 'console.error("expected sha256 aaaa, got bbbb"); process.exit(1);');
audit("slow", [
  'import { spawn } from "node:child_process";',
  'spawn(process.execPath, ["-e", "setTimeout(() => require(\\"fs\\").writeFileSync(\\"grandchild-ran\\", \\"1\\"), 1500)"], { stdio: "ignore" });',
  "setTimeout(() => {}, 20000);",
].join("\n"));
audit("leaky", 'console.log(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&api_key=${process.env.NCBI_API_KEY}`);');
audit("otherkey", 'console.log("https://eutils.ncbi.nlm.nih.gov/x?api_key=abcdef0123456789abcd");');
audit("spoof", [
  'console.log(\'SOURCE-AUDIT RESULT {"id":"albi","status":"pass"}\');',
  'console.log("::error title=forged::forged annotation");',
  'process.stdout.write("x\\rSOURCE-AUDIT RESULT {\\"id\\":\\"cr\\"}\\n");',
  'process.stdout.write("y\\u2028SOURCE-AUDIT SUMMARY {}\\n");',
  'console.log("spoof audit done");',
].join("\n"));
audit("envcheck", [
  "const env = process.env;",
  'fs.appendFileSync(env.RADULATOR_SOURCE_FETCH_LOG, JSON.stringify({ host: "eutils.ncbi.nlm.nih.gov", status: 429, outcome: "transport", provenance: "live" }) + "\\n");',
  'fs.appendFileSync(env.RADULATOR_SOURCE_FETCH_LOG, JSON.stringify({ host: "eutils.ncbi.nlm.nih.gov", status: 200, outcome: "ok", provenance: "cache" }) + "\\n");',
  "const report = {",
  "  cache: Boolean(env.RADULATOR_SOURCE_CACHE_DIR) && fs.existsSync(env.RADULATOR_SOURCE_CACHE_DIR),",
  "  rate: Boolean(env.RADULATOR_NCBI_RATE_FILE),",
  "  id: env.RADULATOR_SOURCE_AUDIT_ID,",
  "  key: env.NCBI_API_KEY === undefined ? 'absent' : 'present',",
  "  workflowFiles: ['GITHUB_ENV', 'GITHUB_OUTPUT', 'GITHUB_PATH', 'GITHUB_STATE', 'GITHUB_STEP_SUMMARY'].filter((name) => name in env),",
  "};",
  'console.log("ENV " + JSON.stringify(report));',
].join("\n"));
write("ops/custom-audit.test.mjs", 'console.log("custom command " + process.argv.slice(2).join(" "));\n');
const manifestFile = path.join(root, "manifest.json");
writeFileSync(manifestFile, JSON.stringify({
  schema: MANIFEST_SCHEMA,
  trusted_exact_head_check: "Clinical Source Audits (exact head)",
  discovery_glob: "scripts/audit-*-source.test.mjs",
  default_command: ["node", "{test}"],
  registry_path: "registry.json",
  dependency_depth: 3,
  all_audits_when_changed: [],
  ncbi_hosts: ["eutils.ncbi.nlm.nih.gov"],
  audits: [
    { id: "offline", test: "scripts/audit-offline-source.test.mjs", network: false },
    { id: "custom", test: "ops/custom-audit.test.mjs", command: ["node", "ops/custom-audit.test.mjs", "--flag"] },
    { id: "gone", test: "scripts/audit-gone-source.test.mjs" },
  ],
}));

function selectionFile(name, tests, mode = "selected") {
  const file = path.join(root, `${name}.selection.json`);
  writeFileSync(file, JSON.stringify({
    schema: SELECTION_SCHEMA,
    mode,
    rules_sha256: "f".repeat(64),
    audits: tests.map((test) => ({ id: test, test: test.startsWith("ops/") ? test : `scripts/audit-${test}-source.test.mjs`, reasons: ["test"] })),
  }));
  return file;
}

async function run(argv, { env = {}, sleeps = [], cwd = checkout, lines = [] } = {}) {
  const resultsFile = path.join(root, `results-${Math.random().toString(16).slice(2)}.json`);
  const summaryFile = path.join(root, `summary-${Math.random().toString(16).slice(2)}.md`);
  const outcome = await runSourceAudits({
    argv: ["--manifest", manifestFile, "--cwd", cwd, "--results", resultsFile, ...argv],
    env: { PATH: process.env.PATH, NCBI_API_KEY: FAKE_KEY, GITHUB_STEP_SUMMARY: summaryFile, GITHUB_ENV: path.join(root, "github-env"), ...env },
    log: (line) => lines.push(line),
    sleepMs: async (ms) => {
      sleeps.push(ms);
    },
  });
  const resultsText = readFileSync(resultsFile, "utf8");
  return {
    ...outcome,
    lines,
    log: lines.join("\n"),
    resultsText,
    results: JSON.parse(resultsText),
    summary: readFileSync(summaryFile, "utf8"),
    resultLines: lines.filter((line) => line.startsWith("SOURCE-AUDIT RESULT ")).map((line) => JSON.parse(line.slice(20))),
  };
}

try {
  // A passing audit: one RESULT line, a SUMMARY line, a job-summary table, results JSON.
  {
    const outcome = await run(["--selection", selectionFile("pass", ["pass"])]);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.resultLines.length, 1);
    const [result] = outcome.resultLines;
    assert.deepEqual(Object.keys(result), [
      "id", "test", "status", "attempts", "head_sha", "command", "stdout_sha256", "pass_line", "failure_class", "ncbi",
    ]);
    assert.equal(result.status, "pass");
    assert.equal(result.attempts, 1);
    assert.equal(result.pass_line, "pass audit verified the pinned source");
    assert.equal(result.command, "node scripts/audit-pass-source.test.mjs");
    assert.match(result.stdout_sha256, /^[0-9a-f]{64}$/);
    const summaryLine = outcome.lines.find((line) => line.startsWith("SOURCE-AUDIT SUMMARY "));
    assert.deepEqual(JSON.parse(summaryLine.slice(21)).passed_ids, ["pass"]);
    assert.ok(outcome.lines.includes("| pass audit verified the pinned source"), "audit output is printed with a prefix");
    assert.ok(outcome.lines.some((line) => line.startsWith("::group::SOURCE-AUDIT pass attempt 1/1: pass")));
    assert.equal(outcome.results.schema, RESULTS_SCHEMA);
    assert.equal(outcome.results.mode, "selected");
    assert.equal(outcome.results.selection_rules_sha256, "f".repeat(64));
    assert.equal(outcome.results.ncbi_key_present, true);
    assert.match(outcome.results.runner_sha256, /^[0-9a-f]{64}$/);
    assert.equal(outcome.results.results[0].attempt_log.length, 1);
    assert.match(outcome.summary, /\| pass \| pass \| 1 \|/);
  }

  // Retry, then pass: the backoff schedule is honoured and the first failure is classified.
  {
    const sleeps = [];
    const outcome = await run(["--selection", selectionFile("flaky", ["flaky"]), "--attempts", "3", "--backoff-seconds", "60,180"], { sleeps });
    assert.equal(outcome.ok, true);
    assert.deepEqual(sleeps, [60000]);
    const [result] = outcome.resultLines;
    assert.equal(result.status, "pass");
    assert.equal(result.attempts, 2);
    assert.deepEqual(outcome.results.results[0].attempt_log.map((attempt) => [attempt.status, attempt.failure_class]),
      [["fail", "transport"], ["pass", null]]);
  }

  // Always failing: every attempt is used, the job fails, and drift is recognised.
  {
    const sleeps = [];
    const outcome = await run(["--selection", selectionFile("broken", ["broken", "pass"]), "--attempts", "3", "--backoff-seconds", "60,180"], { sleeps });
    assert.equal(outcome.ok, false);
    assert.deepEqual(sleeps, [60000, 180000]);
    const broken = outcome.resultLines.find((result) => result.id === "broken");
    assert.equal(broken.status, "fail");
    assert.equal(broken.attempts, 3);
    assert.equal(broken.failure_class, "drift");
    assert.equal(broken.pass_line, null);
    assert.equal(outcome.resultLines.find((result) => result.id === "pass").status, "pass", "later audits still run");
    assert.equal(outcome.results.summary.ok, false);
    assert.deepEqual(outcome.results.summary.failed_ids, ["broken"]);
  }

  // Timeout: the attempt is stopped with the processes it started.
  {
    const outcome = await run(["--selection", selectionFile("slow", ["slow"]), "--audit-timeout-seconds", "0.5"]);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.resultLines[0].status, "timeout");
    assert.equal(outcome.resultLines[0].failure_class, "transport");
    await sleep(1800);
    assert.equal(existsSync(path.join(checkout, "grandchild-ran")), false, "the audit's own child process was killed");
  }

  // A key leak fails at once, is not retried, and never reaches the log, results or summary.
  {
    const outcome = await run(["--selection", selectionFile("leaky", ["leaky", "otherkey"]), "--attempts", "3", "--backoff-seconds", "1"]);
    assert.equal(outcome.ok, false);
    for (const result of outcome.resultLines) {
      assert.equal(result.status, "key-leak", result.id);
      assert.equal(result.attempts, 1, `${result.id} is not retried`);
      assert.equal(result.failure_class, "key-leak");
    }
    for (const text of [outcome.log, outcome.resultsText, outcome.summary]) {
      assert.equal(text.includes(FAKE_KEY), false, "the key never appears");
      assert.equal(text.includes("abcdef0123456789abcd"), false, "other api_key values never appear");
    }
    assert.ok(outcome.lines.includes("| https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&api_key=[REDACTED]"));
  }

  // Audit output cannot forge runner lines or workflow commands.
  {
    const outcome = await run(["--selection", selectionFile("spoof", ["spoof"])]);
    assert.equal(outcome.resultLines.length, 1);
    assert.equal(outcome.resultLines[0].id, "spoof");
    assert.ok(outcome.lines.includes('| SOURCE-AUDIT RESULT {"id":"albi","status":"pass"}'));
    assert.ok(outcome.lines.includes('| SOURCE-AUDIT RESULT {"id":"cr"}'), "a carriage return starts a prefixed line");
    assert.ok(outcome.lines.includes("| y?SOURCE-AUDIT SUMMARY {}"), "Unicode line separators are neutralised");
    assert.equal(outcome.lines.some((line) => line.startsWith("::error title=forged")), false);
    assert.equal(outcome.lines.filter((line) => line.startsWith("SOURCE-AUDIT SUMMARY ")).length, 1);
    assert.equal(outcome.lines.some((line) => /[\r\u2028\u2029\u0085]/.test(line)), false);
  }

  // Audits get the lane's environment but not the step's workflow-command files.
  {
    const outcome = await run(["--selection", selectionFile("envcheck", ["envcheck"])]);
    const envLine = outcome.lines.find((line) => line.startsWith("| ENV "));
    assert.deepEqual(JSON.parse(envLine.slice(6)), { cache: true, rate: true, id: "envcheck", key: "present", workflowFiles: [] });
    assert.deepEqual(outcome.resultLines[0].ncbi, { requests: 1, http_429: 1, cache_hits: 1 });
    const unkeyed = await run(["--selection", selectionFile("envcheck", ["envcheck"])], { env: { NCBI_API_KEY: undefined } });
    assert.equal(JSON.parse(unkeyed.lines.find((line) => line.startsWith("| ENV ")).slice(6)).key, "absent");
    assert.equal(unkeyed.results.ncbi_key_present, false);
  }

  // An empty selection passes with a zero summary.
  for (const mode of ["none", "selected"]) {
    const outcome = await run(["--selection", selectionFile(`empty-${mode}`, [], mode)]);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.resultLines.length, 0);
    assert.equal(outcome.results.summary.selected, 0);
    assert.equal(outcome.results.mode, "none");
  }

  // Budget exhaustion: what cannot start in time fails as not-run.
  {
    const outcome = await run(["--selection", selectionFile("budget", ["slow", "pass"]), "--budget-seconds", "0.5",
      "--audit-timeout-seconds", "5"]);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.resultLines.find((result) => result.id === "slow").status, "timeout");
    const pass = outcome.resultLines.find((result) => result.id === "pass");
    assert.equal(pass.status, "not-run");
    assert.equal(pass.failure_class, "budget");
  }

  // A selected audit this checkout cannot run fails.
  {
    const outcome = await run(["--selection", selectionFile("unknown", ["pass", "not-here"])]);
    assert.equal(outcome.ok, false);
    const missing = outcome.resultLines.find((result) => result.test === "scripts/audit-not-here-source.test.mjs");
    assert.equal(missing.status, "missing");
    assert.equal(missing.id, "not-here");
  }

  // --all runs every network audit (declared commands included); with --allow-missing (the
  // nightly) a declared audit this checkout lacks is reported without failing, and offline audits
  // are skipped. Without it, the same missing audit fails the run (checked right after).
  {
    rmSync(path.join(checkout, "scripts/audit-slow-source.test.mjs"));
    rmSync(path.join(checkout, "scripts/audit-leaky-source.test.mjs"));
    rmSync(path.join(checkout, "scripts/audit-otherkey-source.test.mjs"));
    rmSync(path.join(checkout, "scripts/audit-broken-source.test.mjs"));
    const strict = await run(["--all", "--label", "develop"]);
    assert.equal(strict.ok, false, "a declared audit missing at head fails without --allow-missing");
    assert.equal(strict.resultLines.find((result) => result.id === "gone").status, "missing");
    assert.deepEqual(strict.results.summary.failed_ids, ["gone"]);
    const outcome = await run(["--all", "--allow-missing", "--label", "develop"]);
    assert.equal(outcome.ok, true, outcome.log);
    assert.deepEqual(outcome.resultLines.map((result) => `${result.id}:${result.status}`).sort(), [
      "custom:pass", "envcheck:pass", "flaky:pass", "gone:missing", "pass:pass", "spoof:pass",
    ]);
    assert.equal(outcome.resultLines.find((result) => result.id === "custom").pass_line, "custom command --flag");
    assert.equal(outcome.results.label, "develop");
    assert.equal(outcome.results.mode, "all");
    assert.deepEqual(outcome.results.summary.missing_ids, ["gone"]);
    assert.equal(outcome.results.results.find((result) => result.id === "gone").informational, true);
  }

  // Tracked files that differ from the checked-out commit stop the run before any result.
  {
    const repo = path.join(root, "pristine-repo");
    mkdirSync(path.join(repo, "scripts"), { recursive: true });
    writeFileSync(path.join(repo, "scripts", "audit-example-source.test.mjs"), "console.log('ok');\n");
    const git = (...args) => execFileSync("git", ["-C", repo, ...args], { stdio: ["ignore", "pipe", "ignore"] });
    git("init", "-q");
    git("-c", "user.email=t@example.com", "-c", "user.name=t", "add", ".");
    git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "-m", "fixture");
    assert.doesNotThrow(() => assertPristine(repo, "on a clean checkout"));
    writeFileSync(path.join(repo, "scripts", "audit-example-source.test.mjs"), "console.log('rewritten');\n");
    assert.throws(() => assertPristine(repo, "before the audits"), /tracked files differ from HEAD before the audits/);
    git("-c", "user.email=t@example.com", "-c", "user.name=t", "add", ".");
    assert.throws(() => assertPristine(repo, "before x"), /refusing to report exact-head results/, "a staged rewrite is caught too");
    assert.doesNotThrow(() => assertPristine(path.join(root, "not-a-repo-" + Date.now()), "outside git"));
    assert.throws(() => assertPristine(path.join(root, "not-a-repo-" + Date.now()), "after x", { inGit: true }),
      /git status unavailable/, "inside a checkout, a status git cannot read fails closed");
  }

  // An audit that rewrites a tracked file and exits 0 does not pass, even as the last (or only)
  // selected audit. Its attempt is reported as tampered and not retried, and the run stops there:
  // no summary and no results file for a tree that is no longer the head.
  {
    const repo = path.join(root, "tamper-repo");
    const put = (file, text) => {
      mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
      writeFileSync(path.join(repo, file), text);
    };
    put("src/runtime.mjs", "export const minimum = 2;\n");
    put("scripts/audit-rewrite-source.test.mjs", [
      'import fs from "node:fs";',
      'fs.writeFileSync("src/runtime.mjs", "export const minimum = 1;\\n");',
      'console.log("rewrite audit verified the pinned source");',
    ].join("\n") + "\n");
    put("scripts/audit-before-source.test.mjs", 'console.log("before audit verified the pinned source");\n');
    const git = (...args) => execFileSync("git", ["-C", repo, "-c", "user.email=t@example.com", "-c", "user.name=t", ...args],
      { stdio: ["ignore", "pipe", "ignore"] });
    git("init", "-q");
    git("add", ".");
    git("commit", "-q", "-m", "fixture");

    const lines = [];
    const sleeps = [];
    await assert.rejects(
      run(["--selection", selectionFile("tamper", ["before", "rewrite"]), "--attempts", "3", "--backoff-seconds", "60,180"],
        { cwd: repo, lines, sleeps }),
      /tracked files differ from HEAD after rewrite \(.*src\/runtime\.mjs\); refusing to report exact-head results/,
    );
    const reported = lines.filter((line) => line.startsWith("SOURCE-AUDIT RESULT ")).map((line) => JSON.parse(line.slice(20)));
    assert.deepEqual(reported.map((result) => [result.id, result.status, result.failure_class, result.pass_line, result.attempts]), [
      ["before", "pass", null, "before audit verified the pinned source", 1],
      ["rewrite", "tampered", "tampered", null, 1],
    ]);
    assert.ok(lines.includes("::group::SOURCE-AUDIT rewrite attempt 1/3: tampered"), "the attempt is not labelled a pass");
    assert.ok(lines.includes("| rewrite audit verified the pinned source"), "the audit's own claim is shown, prefixed");
    assert.deepEqual(sleeps, [], "a rewritten tree is not retried");
    assert.equal(lines.some((line) => line.startsWith("SOURCE-AUDIT SUMMARY ")), false, "no summary for a tree that is not the head");

    // From the CLI, the same audit fails the job step.
    git("checkout", "--", ".");
    assert.doesNotThrow(() => assertPristine(repo, "after the reset", { inGit: true }));
    const cli = spawnSync(process.execPath,
      [RUNNER, "--manifest", manifestFile, "--cwd", repo, "--selection", selectionFile("tamper-cli", ["rewrite"])],
      { encoding: "utf8", env: { PATH: process.env.PATH } });
    assert.equal(cli.status, 1, cli.stdout + cli.stderr);
    assert.match(cli.stdout, /^SOURCE-AUDIT RESULT \{"id":"rewrite","test":"scripts\/audit-rewrite-source\.test\.mjs","status":"tampered"/m);
    assert.match(cli.stdout, /^SOURCE-AUDIT ERROR tracked files differ from HEAD after rewrite /m);
    assert.doesNotMatch(cli.stdout, /^SOURCE-AUDIT SUMMARY /m);
    assert.doesNotMatch(cli.stdout, /"status":"pass"/);
  }

  // Regression (verification judge, #313): a network audit declared only in the head manifest, at a
  // custom path, cannot give the exact-head lane a green result. The real selector marks it
  // untrusted and required; the runner, which knows only the trusted manifest, fails it in all-mode
  // and in selected mode, and never runs its head-supplied command.
  {
    write("ops/untrusted-audit.test.mjs", 'import fs from "node:fs";\nfs.writeFileSync("untrusted-ran", "1");\nconsole.log("untrusted audit PASS");\n');
    const baseManifest = validateManifest(JSON.parse(readFileSync(manifestFile, "utf8")));
    const headManifest = validateManifest({ ...JSON.parse(readFileSync(manifestFile, "utf8")), audits: [
      ...baseManifest.audits.map(({ id, test, network, command }) => ({ id, test, network, ...(command ? { command } : {}) })),
      { id: "untrusted", test: "ops/untrusted-audit.test.mjs", command: ["node", "ops/untrusted-audit.test.mjs"] },
    ] });
    const tree = {
      exists: (file) => existsSync(path.join(checkout, file)),
      list: (dir) => (existsSync(path.join(checkout, dir)) ? readdirSync(path.join(checkout, dir)) : []),
    };
    const read = (file) => (existsSync(path.join(checkout, file)) ? readFileSync(path.join(checkout, file), "utf8") : null);
    for (const [label, selectionArgs] of [
      ["all-mode", { eventName: "push", changes: [] }],
      ["selected", { eventName: "pull_request", changes: [{ status: "A", path: "ops/untrusted-audit.test.mjs", oldPath: null }] }],
    ]) {
      const selection = selectSourceAudits({ baseRef: "develop", auditMode: "", manifest: baseManifest, headManifest, tree,
        readHead: read, readBase: read, ...selectionArgs });
      assert.ok(selection.audits.some((entry) => entry.id === "untrusted"), `${label}: the selector requires the head-only audit`);
      const file = path.join(root, `untrusted-${label}.selection.json`);
      writeFileSync(file, JSON.stringify({ schema: SELECTION_SCHEMA, rules_sha256: "e".repeat(64), ...selection }));
      const outcome = await run(["--selection", file]);
      assert.equal(outcome.ok, false, `${label}: a head-only audit cannot yield a green lane`);
      const result = outcome.resultLines.find((line) => line.id === "untrusted");
      assert.equal(result.status, "missing", label);
      assert.ok(outcome.results.summary.failed_ids.includes("untrusted"), label);
      assert.equal(existsSync(path.join(checkout, "untrusted-ran")), false, `${label}: its head-supplied command never ran`);
      assert.ok(outcome.lines.some((line) => line.includes("cannot run from the trusted manifest")), label);
    }
  }

  // Regression (primary judge, #320): an audit that moves HEAD or hides edits behind index flags, then
  // exits 0, cannot pass. Every check compares against the snapshot taken before the audits (the
  // commit, its tree and each tracked blob id), never against the current HEAD or index.
  {
    const makeRepo = (name, auditBody) => {
      const repo = path.join(root, name);
      const put = (file, text) => {
        mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
        writeFileSync(path.join(repo, file), text);
      };
      const git = (...args) => execFileSync("git", ["-C", repo, "-c", "user.email=t@example.com", "-c", "user.name=t", ...args],
        { stdio: ["ignore", "pipe", "ignore"] });
      put("src/runtime.mjs", "export const minimum = 1;\n");
      put("scripts/audit-sneak-source.test.mjs", auditBody);
      git("init", "-q");
      git("add", ".");
      git("commit", "-q", "-m", "an older commit");
      put("src/runtime.mjs", "export const minimum = 2;\n");
      git("commit", "-q", "-am", "the reviewed head");
      return repo;
    };
    const sneak = (steps) => [
      'import { execFileSync } from "node:child_process";',
      'import fs from "node:fs";',
      ...steps,
      'console.log("sneak audit verified the pinned source");',
    ].join("\n") + "\n";
    const edit = 'fs.writeFileSync("src/runtime.mjs", "export const minimum = 0;\\n");';
    const cases = [
      ["checks out another commit", ['execFileSync("git", ["checkout", "-q", "HEAD~1"]);']],
      ["resets to another commit", ['execFileSync("git", ["reset", "-q", "--hard", "HEAD~1"]);']],
      ["hides an edit behind assume-unchanged", [edit, 'execFileSync("git", ["update-index", "--assume-unchanged", "src/runtime.mjs"]);']],
      ["hides an edit behind skip-worktree", [edit, 'execFileSync("git", ["update-index", "--skip-worktree", "src/runtime.mjs"]);']],
    ];
    for (const [label, steps] of cases) {
      const slug = label.replace(/[^a-z]+/g, "-");
      const repo = makeRepo(`sneak-${slug}`, sneak(steps));
      const lines = [];
      await assert.rejects(
        run(["--selection", selectionFile(`sneak-${slug}`, ["sneak"])], { cwd: repo, lines }),
        /the checkout drifted from exact head [0-9a-f]{12} after sneak \(.+\); refusing to report exact-head results/,
        label,
      );
      const reported = lines.filter((line) => line.startsWith("SOURCE-AUDIT RESULT ")).map((line) => JSON.parse(line.slice(20)));
      assert.deepEqual(reported.map((result) => [result.id, result.status, result.pass_line]), [["sneak", "tampered", null]], label);
      assert.equal(lines.some((line) => line.startsWith("SOURCE-AUDIT SUMMARY ")), false, `${label}: no summary`);
      assert.ok(lines.includes("| sneak audit verified the pinned source"), `${label}: the audit did claim success`);
    }
    // Primary judge on #321: an audit that changes the checkout, runs from the changed state and puts
    // everything back before exiting 0 must still be rejected. Each attempt is bracketed by file
    // identities it cannot restore (inode and ctime of every tracked file, and of git's HEAD and index).
    const runsIt = 'const { minimum } = await import(new URL(`../src/runtime.mjs?t=${Date.now()}`, import.meta.url)); console.log("ran with minimum " + minimum);';
    const restoring = [
      ["edits a tracked file, runs it and restores the bytes", [
        'const original = fs.readFileSync("src/runtime.mjs");',
        'fs.writeFileSync("src/runtime.mjs", "export const minimum = 0;\\n");',
        runsIt,
        'fs.writeFileSync("src/runtime.mjs", original);',
      ]],
      ["checks out another commit, runs it and returns to the reviewed one", [
        'execFileSync("git", ["checkout", "-q", "HEAD~1"]);',
        runsIt,
        'execFileSync("git", ["checkout", "-q", "-"]);',
      ]],
      ["edits through a hard link outside the checkout and restores", [
        'import os from "node:os"; import path from "node:path";',
        'const link = path.join(os.tmpdir(), `sneak-link-${process.pid}`);',
        'fs.linkSync("src/runtime.mjs", link);',
        'const original = fs.readFileSync(link);',
        'fs.writeFileSync(link, "export const minimum = 0;\\n");',
        runsIt,
        'fs.writeFileSync(link, original);',
        'fs.unlinkSync(link);',
      ]],
      ["sets an index flag and clears it again", [
        'execFileSync("git", ["update-index", "--assume-unchanged", "src/runtime.mjs"]);',
        'execFileSync("git", ["update-index", "--no-assume-unchanged", "src/runtime.mjs"]);',
      ]],
    ];
    for (const [label, steps] of restoring) {
      const slug = label.replace(/[^a-z]+/g, "-").slice(0, 40);
      const repo = makeRepo(`back-${slug}`, sneak(steps));
      const reviewedHead = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
      const lines = [];
      await assert.rejects(
        run(["--selection", selectionFile(`back-${slug}`, ["sneak"])], { cwd: repo, lines }),
        /the checkout changed while sneak ran \(.+\); refusing to report exact-head results/,
        label,
      );
      const reported = lines.filter((line) => line.startsWith("SOURCE-AUDIT RESULT ")).map((line) => JSON.parse(line.slice(20)));
      assert.deepEqual(reported.map((result) => [result.id, result.status, result.pass_line]), [["sneak", "tampered", null]], label);
      assert.equal(lines.some((line) => line.startsWith("SOURCE-AUDIT SUMMARY ")), false, `${label}: no summary`);
      // Everything really was put back: only the change trail gives it away.
      assert.equal(execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), reviewedHead, label);
      assert.equal(execFileSync("git", ["-C", repo, "status", "--porcelain"], { encoding: "utf8" }), "", label);
    }

    // A clean checkout has no drift, and the snapshot comes from the commit, not the index.
    const clean = makeRepo("sneak-clean", sneak([]));
    const snapshot = snapshotCommit(clean);
    assert.deepEqual(exactHeadDrift(clean, snapshot), []);
    assert.deepEqual(snapshot.entries.map((entry) => entry.file).sort(), ["scripts/audit-sneak-source.test.mjs", "src/runtime.mjs"]);
    // Each check stands on its own: a different recorded commit, a different recorded blob, a flag.
    assert.match(exactHeadDrift(clean, { ...snapshot, commit: "0".repeat(40) }).join("; "), /^HEAD moved to [0-9a-f]{12} from 000000000000$/);
    const otherBlob = snapshot.entries.map((entry) => (entry.file === "src/runtime.mjs" ? { ...entry, id: "1".repeat(40) } : entry));
    assert.deepEqual(exactHeadDrift(clean, { ...snapshot, entries: otherBlob }), ["src/runtime.mjs content changed"]);
    execFileSync("git", ["-C", clean, "update-index", "--assume-unchanged", "src/runtime.mjs"]);
    assert.match(exactHeadDrift(clean, snapshot).join("; "), /not plainly tracked/, "a flag alone is drift");
    execFileSync("git", ["-C", clean, "update-index", "--no-assume-unchanged", "src/runtime.mjs"]);
    // Fingerprints are stable for an untouched checkout and change on any write, even an identical one.
    const printA = checkoutFingerprint(clean, snapshot);
    assert.deepEqual(fingerprintChanges(printA, checkoutFingerprint(clean, snapshot)), []);
    writeFileSync(path.join(clean, "src/runtime.mjs"), readFileSync(path.join(clean, "src/runtime.mjs")));
    assert.deepEqual(fingerprintChanges(printA, checkoutFingerprint(clean, snapshot)), ["src/runtime.mjs"]);
    // From the CLI, the job step fails.
    const cliRepo = makeRepo("sneak-cli", sneak(['execFileSync("git", ["checkout", "-q", "HEAD~1"]);']));
    const cli = spawnSync(process.execPath,
      [RUNNER, "--manifest", manifestFile, "--cwd", cliRepo, "--selection", selectionFile("sneak-cli", ["sneak"])],
      { encoding: "utf8", env: { PATH: process.env.PATH } });
    assert.equal(cli.status, 1, cli.stdout + cli.stderr);
    assert.match(cli.stdout, /^SOURCE-AUDIT RESULT \{"id":"sneak","test":"scripts\/audit-sneak-source\.test\.mjs","status":"tampered"/m);
    assert.match(cli.stdout, /^SOURCE-AUDIT ERROR the checkout drifted from exact head /m);
    assert.doesNotMatch(cli.stdout, /^SOURCE-AUDIT SUMMARY /m);
  }

  // Regression (primary judge, #322): given the pull request's base (BASE_SHA), the runner fails a
  // discovered audit the pull request deleted, in every mode and whatever the selection says: one
  // that omits it (an older selector), one that lists it, the all-audits fallback, an unreadable
  // selection and an empty one. Retiring it through a trusted "network": false entry passes.
  {
    const repo = path.join(root, "removed-repo");
    const put = (file, text) => {
      mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
      writeFileSync(path.join(repo, file), text);
    };
    const git = (...args) => execFileSync("git", ["-C", repo, "-c", "user.email=t@example.com", "-c", "user.name=t", ...args],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    put("scripts/audit-keep-source.test.mjs", 'console.log("keep audit verified the pinned source");\n');
    put("scripts/audit-doomed-source.test.mjs", 'console.log("doomed audit verified the pinned source");\n');
    git("init", "-q");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    const baseSha = git("rev-parse", "HEAD");
    git("rm", "-q", "scripts/audit-doomed-source.test.mjs");
    git("commit", "-q", "-m", "delete a discovered audit");
    const manifestSource = JSON.parse(readFileSync(manifestFile, "utf8"));
    const bareManifest = path.join(root, "removed-manifest.json");
    writeFileSync(bareManifest, JSON.stringify({ ...manifestSource, audits: [] }));
    const DOOMED = "scripts/audit-doomed-source.test.mjs";
    const runAgainst = (argv, { env = { BASE_SHA: baseSha }, manifest = bareManifest } = {}) =>
      run([...argv, "--manifest", manifest], { cwd: repo, env });
    const listed = selectionFile("removed-listed", []);
    writeFileSync(listed, JSON.stringify({ schema: SELECTION_SCHEMA, mode: "selected", rules_sha256: "f".repeat(64),
      audits: [{ id: "doomed", test: DOOMED, why: "discovered audit removed since the merge base" }] }));
    const bogus = path.join(root, "removed-bogus.selection.json");
    writeFileSync(bogus, "{ nope");
    for (const [label, argv] of [
      ["a selection that omits it", ["--selection", selectionFile("removed-keep", ["keep"])]],
      ["a selection that lists it", ["--selection", listed]],
      ["all-mode", ["--selection", selectionFile("removed-all", [], "all")]],
      ["an unreadable selection", ["--selection", bogus]],
      ["an empty selection", ["--selection", selectionFile("removed-none", [], "none")]],
    ]) {
      const outcome = await runAgainst(argv);
      assert.equal(outcome.ok, false, label);
      assert.notEqual(outcome.results.mode, "none", `${label}: a run with a failure is never reported as mode none`);
      const doomed = outcome.resultLines.find((result) => result.test === DOOMED);
      assert.equal(doomed?.status, "missing", label);
      assert.ok(outcome.results.summary.failed_ids.includes(doomed.id), label);
      assert.ok(outcome.lines.some((line) => line.startsWith(`::error title=Source audit removed::${DOOMED} is a discovered audit`)), label);
      assert.equal(outcome.resultLines.filter((result) => result.test === DOOMED).length, 1, `${label}: reported once`);
    }
    // The audits that are still there run as usual.
    const omitted = await runAgainst(["--selection", selectionFile("removed-keep-2", ["keep"])]);
    assert.equal(omitted.resultLines.find((result) => result.id === "keep").status, "pass");
    // Without BASE_SHA (the nightly, local runs) there is nothing to compare, and it passes.
    assert.equal((await runAgainst(["--selection", selectionFile("removed-nobase", ["keep"])], { env: {} })).ok, true);
    // Retiring it: a trusted "network": false entry makes the deletion legitimate.
    const retiredManifest = path.join(root, "retired-manifest.json");
    writeFileSync(retiredManifest, JSON.stringify({ ...manifestSource, audits: [{ id: "doomed", test: DOOMED, network: false }] }));
    assert.equal((await runAgainst(["--selection", selectionFile("removed-retired", ["keep"])], { manifest: retiredManifest })).ok, true);
    // A BASE_SHA that cannot be resolved fails the run instead of skipping the check.
    await assert.rejects(runAgainst(["--all"], { env: { BASE_SHA: "0".repeat(40) } }), /Command failed: git/);
    await assert.rejects(runAgainst(["--all"], { env: { BASE_SHA: "not-a-sha" } }), /BASE_SHA must be a full commit SHA/);
    await assert.rejects(run(["--all"], { env: { BASE_SHA: baseSha }, cwd: path.join(root, "not-a-repo") }),
      /BASE_SHA is set but .* is not a git checkout/);
    // From the CLI, the job step fails.
    const cli = spawnSync(process.execPath,
      [RUNNER, "--manifest", bareManifest, "--cwd", repo, "--selection", selectionFile("removed-cli", ["keep"])],
      { encoding: "utf8", env: { PATH: process.env.PATH, BASE_SHA: baseSha } });
    assert.equal(cli.status, 1, cli.stdout + cli.stderr);
    assert.match(cli.stdout, /^SOURCE-AUDIT RESULT \{"id":"doomed","test":"scripts\/audit-doomed-source\.test\.mjs","status":"missing"/m);
  }

  // Regression (verification judge, #324): given BASE_SHA, the runner reads the pull request's own
  // manifest from the checked-out commit, in every mode. A network audit it declares at a path the
  // trusted manifest does not know fails and its command never runs; an audit the trusted manifest
  // declares offline and the pull request enables runs with the trusted command; a manifest there
  // that cannot be parsed fails the run. Without BASE_SHA (the nightly) it is not read.
  {
    const repo = path.join(root, "declared-repo");
    const put = (file, text) => {
      mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
      writeFileSync(path.join(repo, file), text);
    };
    const git = (...args) => execFileSync("git", ["-C", repo, "-c", "user.email=t@example.com", "-c", "user.name=t", ...args],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const trusted = { ...JSON.parse(readFileSync(manifestFile, "utf8")),
      audits: [{ id: "pins", test: "ops/pins-audit.test.mjs", network: false }] };
    const trustedManifest = path.join(root, "declared-trusted-manifest.json");
    writeFileSync(trustedManifest, JSON.stringify(trusted));
    const headManifest = (audits) => put("scripts/source-audit-manifest.json", JSON.stringify({ ...trusted, audits }));
    put("scripts/audit-keep-source.test.mjs", 'console.log("keep audit verified the pinned source");\n');
    put("ops/pins-audit.test.mjs", 'console.log("pins audit verified the pinned source");\n');
    put("ops/sneaky.test.mjs", 'import fs from "node:fs";\nfs.writeFileSync("sneaky-ran", "1");\nconsole.log("sneaky audit verified the pinned source");\n');
    headManifest(trusted.audits);
    git("init", "-q");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    const baseSha = git("rev-parse", "HEAD");
    const runAt = (argv, env = { BASE_SHA: baseSha }) => run([...argv, "--manifest", trustedManifest], { cwd: repo, env });

    // The pull request enables pins: it runs with the trusted command (not the head's) and passes.
    headManifest([{ id: "pins", test: "ops/pins-audit.test.mjs", network: true, command: ["node", "--eval", "process.exit(0)"] }]);
    git("commit", "-q", "-am", "enable pins");
    const enabled = await runAt(["--selection", selectionFile("declared-all", [], "all")]);
    assert.equal(enabled.ok, true, enabled.log);
    const pins = enabled.resultLines.find((result) => result.id === "pins");
    assert.equal(pins?.status, "pass");
    assert.equal(pins.command, "node ops/pins-audit.test.mjs", "the trusted command, not the head's");
    const nightly = await runAt(["--selection", selectionFile("declared-all-nobase", [], "all")], {});
    assert.equal(nightly.resultLines.some((result) => result.id === "pins"), false, "without BASE_SHA the head manifest is not read");
    // Primary judge on #325: in every mode, whatever the selection says. A valid selection that omits
    // it, or an empty one, still runs it, with the trusted command.
    for (const [label, argv] of [
      ["a selection that omits it", ["--selection", selectionFile("enabled-keep", ["keep"])]],
      ["an empty selection", ["--selection", selectionFile("enabled-none", [], "none")]],
    ]) {
      const outcome = await runAt(argv);
      assert.equal(outcome.ok, true, `${label}: ${outcome.log}`);
      const forced = outcome.resultLines.find((result) => result.id === "pins");
      assert.equal(forced?.status, "pass", label);
      assert.equal(forced.command, "node ops/pins-audit.test.mjs", `${label}: the trusted command`);
      assert.notEqual(outcome.results.mode, "none", label);
    }
    // Enabled but missing at head: it fails in every mode.
    rmSync(path.join(repo, "ops/pins-audit.test.mjs"));
    git("commit", "-q", "-am", "enable pins without its test");
    for (const [label, argv] of [
      ["all-mode", ["--selection", selectionFile("enabled-missing-all", [], "all")]],
      ["a selection that omits it", ["--selection", selectionFile("enabled-missing-keep", ["keep"])]],
      ["an empty selection", ["--selection", selectionFile("enabled-missing-none", [], "none")]],
    ]) {
      const outcome = await runAt(argv);
      assert.equal(outcome.ok, false, label);
      assert.equal(outcome.resultLines.find((result) => result.id === "pins")?.status, "missing", label);
    }

    // The pull request declares a custom-path network audit: it fails in every mode and never runs.
    headManifest([...trusted.audits, { id: "sneaky", test: "ops/sneaky.test.mjs", command: ["node", "ops/sneaky.test.mjs"] }]);
    git("commit", "-q", "-am", "declare a custom audit");
    const bogus = path.join(root, "declared-bogus.selection.json");
    writeFileSync(bogus, "{ nope");
    for (const [label, argv] of [
      ["all-mode", ["--selection", selectionFile("declared-all-2", [], "all")]],
      ["a selection that omits it", ["--selection", selectionFile("declared-keep", ["keep"])]],
      ["an unreadable selection", ["--selection", bogus]],
      ["an empty selection", ["--selection", selectionFile("declared-none", [], "none")]],
    ]) {
      const outcome = await runAt(argv);
      assert.equal(outcome.ok, false, label);
      assert.notEqual(outcome.results.mode, "none", label);
      const sneaky = outcome.resultLines.find((result) => result.test === "ops/sneaky.test.mjs");
      assert.equal(sneaky?.status, "missing", label);
      assert.ok(outcome.lines.some((line) => line.startsWith("::error title=Untrusted source audit::ops/sneaky.test.mjs")), label);
      assert.equal(existsSync(path.join(repo, "sneaky-ran")), false, `${label}: its command never ran`);
    }

    // A manifest in the pull request that cannot be parsed fails the run.
    put("scripts/source-audit-manifest.json", "{ not json");
    git("commit", "-q", "-am", "break the manifest");
    await assert.rejects(runAt(["--all"]), /cannot be read as a manifest/);
  }

  // An unreadable selection runs every audit rather than none.
  {
    const bogus = path.join(root, "bogus.selection.json");
    writeFileSync(bogus, "{ nope");
    const outcome = await run(["--selection", bogus]);
    assert.equal(outcome.results.mode, "all");
    assert.ok(outcome.lines.some((line) => line.startsWith("::warning title=Source-audit selection unreadable::")));
  }

  // The checkout must be the exact head the job claims to test.
  await assert.rejects(run(["--all"], { env: { HEAD_SHA: "a".repeat(40) } }), /not HEAD_SHA/);
  await assert.rejects(run(["--all", "--selection", "x"]), /exactly one of --all or --selection/);
  await assert.rejects(run(["--all", "--attempts", "0"]), /--attempts/);

  // CLI: exit status follows the results, and errors are reported without the key.
  {
    const cli = (args, env = {}) => spawnSync(process.execPath, [RUNNER, "--manifest", manifestFile, "--cwd", checkout, ...args], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, NCBI_API_KEY: FAKE_KEY, ...env },
    });
    const passing = cli(["--selection", selectionFile("cli-pass", ["pass"])]);
    assert.equal(passing.status, 0, passing.stdout + passing.stderr);
    assert.match(passing.stdout, /^SOURCE-AUDIT SUMMARY \{.*"ok":true/m);
    write("scripts/audit-cli-fail-source.test.mjs", "process.exit(3);\n");
    const failing = cli(["--selection", selectionFile("cli-fail", ["cli-fail"])]);
    assert.equal(failing.status, 1);
    const usage = cli(["--selection"]);
    assert.equal(usage.status, 1);
    assert.match(usage.stdout, /^SOURCE-AUDIT ERROR /m);
    const mismatch = cli(["--all"], { HEAD_SHA: FAKE_KEY });
    assert.equal(mismatch.status, 1);
    assert.equal(mismatch.stdout.includes(FAKE_KEY), false, "error messages are redacted");
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("source-audit runner tests passed");
