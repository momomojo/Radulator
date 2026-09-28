#!/usr/bin/env node
// Offline tests for scripts/run-source-audits.mjs, using fake audits in a throwaway checkout.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  runSourceAudits,
} from "./run-source-audits.mjs";
import { MANIFEST_SCHEMA, SELECTION_SCHEMA } from "./select-source-audits.mjs";

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

async function run(argv, { env = {}, sleeps = [] } = {}) {
  const lines = [];
  const resultsFile = path.join(root, `results-${Math.random().toString(16).slice(2)}.json`);
  const summaryFile = path.join(root, `summary-${Math.random().toString(16).slice(2)}.md`);
  const outcome = await runSourceAudits({
    argv: ["--manifest", manifestFile, "--cwd", checkout, "--results", resultsFile, ...argv],
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
