#!/usr/bin/env node
// Runs the network clinical source audits chosen by scripts/select-source-audits.mjs, one at a
// time, with bounded retries, and records exactly what ran so the judges can cite it.
//
// Trust: in the "Clinical Source Audits (exact head)" job (e2e-tests.yml) this file, the selector it
// imports, and the manifest are loaded from the PR's BASE commit, so a PR cannot change how its own
// audits are run, retried, or reported. The audits are the head's code and run as child processes.
//
//   node run-source-audits.mjs --selection <selection.json> [options]   exact PR head (CI)
//   node run-source-audits.mjs --all [options]                          nightly and local runs
//   options:
//     --manifest <file>              default: source-audit-manifest.json next to this file
//     --cwd <checkout>               default: the current directory
//     --label <text>                 names the run in results (e.g. main, develop)
//     --results <file>               write the results JSON here
//     --attempts <n>                 default 1
//     --backoff-seconds <a,b,...>    wait before attempt 2, 3, ... (the last value repeats)
//     --audit-timeout-seconds <s>    per attempt, default 600
//     --budget-seconds <s>           for the whole run, default 3000
//   env: NCBI_API_KEY (optional; passed to the audits), HEAD_SHA (optional; must match the checkout),
//        GITHUB_STEP_SUMMARY (optional), RUNNER_TEMP (optional)
//
// Each audit gets RADULATOR_SOURCE_CACHE_DIR (a cache shared by this run only),
// RADULATOR_SOURCE_FETCH_LOG (JSONL, one record per request) and RADULATOR_NCBI_RATE_FILE (request
// spacing across processes). The shared NCBI helper writes fetch-log records shaped like
//   {"host": "...", "status": 200, "outcome": "ok" | "transport" | "drift", "provenance": "live" | "cache"}
// which classify failures; audits that do not use it yet are classified from their output.
//
// Key hygiene: everything this runner prints or writes is scrubbed of the literal NCBI_API_KEY value
// and of every api_key=<value>. An audit whose output contains either fails as "key-leak" and is not
// retried. Audit output is printed with a "| " prefix, so only this runner's own lines start with
// "SOURCE-AUDIT" and audit output cannot issue workflow commands:
//   SOURCE-AUDIT RESULT {...}    one per audit, after its last attempt
//   SOURCE-AUDIT SUMMARY {...}   once, at the end
// Exit status: 1 if any selected audit did not pass, otherwise 0 (also when nothing was selected).
import { execFileSync, spawn } from "node:child_process";
import {
  appendFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { SELECTION_SCHEMA, resolveAudits, sha256, validateManifest, workingTree } from "./select-source-audits.mjs";

export const RESULTS_SCHEMA = "radulator-source-audit-results/v1";
const REDACTED = "[REDACTED]";
// Query parameter carrying an NCBI key. Values that are already placeholders are not leaks.
const API_KEY_PARAMETER = /(api_key=)([^&\s"'<>#]*)/gi;
const PLACEHOLDER = /^(?:\[REDACTED\]|%5BREDACTED%5D|REDACTED|\*+|)$/i;
const MIN_SECRET_LENGTH = 8;
const MAX_STREAM_BYTES = 8 * 1024 * 1024;
const KILL_GRACE_MS = 5000;
// Child processes must not write the step's outputs, environment, path or job summary.
const WORKFLOW_FILE_VARIABLES = ["GITHUB_ENV", "GITHUB_OUTPUT", "GITHUB_PATH", "GITHUB_STATE", "GITHUB_STEP_SUMMARY"];
// Output of audits that do not use the shared fetch helper yet.
const TRANSPORT_OUTPUT = /(?:HTTP\s*(?:429|5\d\d)\b|status(?:\s*code)?[:=]?\s*(?:429|5\d\d)\b|Too Many Requests|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_\w+|fetch failed|socket hang up|retrieval failed after|challenge page|bot protection)/i;
const DRIFT_OUTPUT = /(?:sha-?256|digest|byte length|pinned|drift)/i;

// One printable log line: control characters, carriage returns and Unicode line separators become
// "?", so nothing interpolated into a runner line can start a new log line. Tabs are kept.
export function oneLine(text) {
  let line = "";
  for (const character of String(text ?? "")) {
    const code = character.codePointAt(0);
    const breaksLine = (code < 0x20 && code !== 0x09) || code === 0x7f || code === 0x85 || code === 0x2028 || code === 0x2029;
    line += breaksLine ? "?" : character;
  }
  return line;
}

function secretOf(key) {
  const value = typeof key === "string" ? key.trim() : "";
  return value.length >= MIN_SECRET_LENGTH ? value : "";
}

// Removes the literal key and every api_key=<value> from text.
export function redact(text, key) {
  const secret = secretOf(key);
  let output = String(text ?? "");
  if (secret) output = output.split(secret).join(REDACTED);
  return output.replace(API_KEY_PARAMETER, `$1${REDACTED}`);
}

// Why this text would leak a credential, or an empty list.
export function findLeaks(text, key) {
  const secret = secretOf(key);
  const leaks = [];
  if (secret && text.includes(secret)) leaks.push("the NCBI_API_KEY value");
  for (const match of text.matchAll(API_KEY_PARAMETER)) {
    if (!PLACEHOLDER.test(match[2])) {
      leaks.push("an api_key= value");
      break;
    }
  }
  return leaks;
}

// Records the shared fetch helper appended; malformed lines are ignored.
export function readFetchLog(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return text.split("\n").filter(Boolean).flatMap((line) => {
    try {
      const record = JSON.parse(line);
      return record && typeof record === "object" ? [record] : [];
    } catch {
      return [];
    }
  });
}

// transport: the network or the server failed (retrying can help); drift: the server answered but
// the bytes no longer match their pins; assertion: anything else (a real failure of the audit).
export function classifyFailure({ output, fetchLog = [], timedOut = false }) {
  if (fetchLog.some((record) => record.outcome === "drift")) return "drift";
  if (timedOut || fetchLog.at(-1)?.outcome === "transport") return "transport";
  if (TRANSPORT_OUTPUT.test(output)) return "transport";
  if (DRIFT_OUTPUT.test(output)) return "drift";
  return "assertion";
}

export function ncbiStats(fetchLog, ncbiHosts) {
  if (fetchLog.length === 0) return null;
  const ncbi = fetchLog.filter((record) => ncbiHosts.includes(record.host));
  return {
    requests: ncbi.filter((record) => record.provenance !== "cache").length,
    http_429: ncbi.filter((record) => record.status === 429).length,
    cache_hits: ncbi.filter((record) => record.provenance === "cache").length,
  };
}

// Seconds to wait before `attempt` (2, 3, ...); the last listed value repeats.
export function backoffBefore(attempt, backoffSeconds) {
  if (attempt < 2 || backoffSeconds.length === 0) return 0;
  return backoffSeconds[Math.min(attempt - 2, backoffSeconds.length - 1)];
}

function lastLine(text) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const line = lines.at(-1) ?? "";
  return line.length > 300 ? `${line.slice(0, 297)}...` : line;
}

let activeGroup = null;

function killGroup(pid, signal) {
  try {
    // A negative pid signals the whole process group, including audits' own child processes.
    process.kill(-pid, signal);
  } catch {
    // Already gone.
  }
}

// One attempt in its own process group, so a timeout also stops the processes the audit spawned.
function runAttempt({ command, cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const streams = { stdout: [], stderr: [] };
    const sizes = { stdout: 0, stderr: 0 };
    let truncated = false;
    let timedOut = false;
    let spawnError = null;
    let settled = false;
    let child;
    try {
      child = spawn(command[0], command.slice(1), { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      resolve({ exitCode: null, signal: null, stdout: "", stderr: `could not start the audit: ${error.message}`,
        timedOut, spawnError: error.message, truncated, durationMs: 0 });
      return;
    }
    activeGroup = child.pid;
    const collect = (name) => (chunk) => {
      if (sizes[name] >= MAX_STREAM_BYTES) {
        truncated = true;
        return;
      }
      sizes[name] += chunk.length;
      streams[name].push(chunk);
    };
    child.stdout.on("data", collect("stdout"));
    child.stderr.on("data", collect("stderr"));
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid, "SIGTERM");
      setTimeout(() => killGroup(child.pid, "SIGKILL"), KILL_GRACE_MS).unref();
    }, timeoutMs);
    const finish = (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Stop anything the audit left running in the background.
      if (child.pid) killGroup(child.pid, "SIGKILL");
      activeGroup = null;
      resolve({
        exitCode,
        signal,
        stdout: Buffer.concat(streams.stdout).toString("utf8"),
        stderr: Buffer.concat(streams.stderr).toString("utf8") +
          (spawnError ? `\ncould not start the audit: ${spawnError}` : ""),
        timedOut,
        spawnError,
        truncated,
        durationMs: Date.now() - started,
      });
    };
    child.on("error", (error) => {
      spawnError = error.message;
      if (!child.pid) finish(null, null);
    });
    child.on("close", finish);
  });
}

function parsePositive(value, name, { integer = false, allowZero = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (!allowZero && number === 0) || (integer && !Number.isInteger(number))) {
    throw new Error(`${name} must be a ${integer ? "positive integer" : "positive number"}`);
  }
  return number;
}

export function parseArgs(argv, selfDir) {
  const options = {
    all: false,
    allowMissing: false,
    selection: null,
    manifest: path.join(selfDir, "source-audit-manifest.json"),
    cwd: process.cwd(),
    label: null,
    results: null,
    attempts: 1,
    backoffSeconds: [],
    auditTimeoutSeconds: 600,
    budgetSeconds: 3000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--all") {
      options.all = true;
      continue;
    }
    if (name === "--allow-missing") {
      options.allowMissing = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`${name} needs a value`);
    index += 1;
    if (name === "--selection") options.selection = value;
    else if (name === "--manifest") options.manifest = value;
    else if (name === "--cwd") options.cwd = value;
    else if (name === "--label") options.label = value;
    else if (name === "--results") options.results = value;
    else if (name === "--attempts") options.attempts = parsePositive(value, "--attempts", { integer: true });
    else if (name === "--backoff-seconds") {
      options.backoffSeconds = value.split(",").map((part) => parsePositive(part, "--backoff-seconds", { allowZero: true }));
    } else if (name === "--audit-timeout-seconds") options.auditTimeoutSeconds = parsePositive(value, name);
    else if (name === "--budget-seconds") options.budgetSeconds = parsePositive(value, name);
    else throw new Error(`unknown option ${name}`);
  }
  if (options.all === Boolean(options.selection)) throw new Error("pass exactly one of --all or --selection <file>");
  if (options.attempts > 5) throw new Error("--attempts is capped at 5");
  return options;
}

// Which audits to run. A selection that cannot be read runs every audit (fail safe).
function planRun(options, audits, log) {
  const runnable = audits.filter((audit) => audit.network && audit.present);
  const missing = audits.filter((audit) => audit.network && !audit.present);
  // A declared network audit missing from the checkout fails the run: a pull request must not
  // pass the exact-head lane by deleting the audit that guards its change. Only the nightly,
  // which runs the current rules against older refs, reports them instead (--allow-missing).
  // A required entry the trusted manifest cannot resolve (an audit declared only in the head
  // manifest) fails in all-mode too; nothing from the head manifest is ever run.
  const known = new Set(audits.map((audit) => audit.test));
  const unknown = (wanted) => wanted.filter((entry) => !known.has(entry?.test))
    .map((entry) => ({ id: String(entry?.id ?? entry?.test ?? "unknown"), test: String(entry?.test ?? "") }));
  const allMode = (rulesSha, wanted = []) => (options.allowMissing
    ? { mode: "all", rulesSha, run: runnable, missing, unrunnable: unknown(wanted) }
    : { mode: "all", rulesSha, run: runnable, missing: [],
        unrunnable: [...missing.map((audit) => ({ id: audit.id, test: audit.test })), ...unknown(wanted)] });
  if (options.all) return allMode(null);
  let selection;
  try {
    selection = JSON.parse(readFileSync(options.selection, "utf8"));
    if (selection?.schema !== SELECTION_SCHEMA || !["all", "selected", "none"].includes(selection.mode)) {
      throw new Error("unsupported selection");
    }
  } catch (error) {
    log(`::warning title=Source-audit selection unreadable::${error.message}; running every audit`);
    return allMode(null);
  }
  const rulesSha = typeof selection.rules_sha256 === "string" ? selection.rules_sha256 : null;
  const wanted = Array.isArray(selection.audits) ? selection.audits : [];
  if (selection.mode === "all") return allMode(rulesSha, wanted);
  const byTest = new Map(audits.map((audit) => [audit.test, audit]));
  const run = [];
  // A selected audit the checkout cannot run fails (so does a declared one in all-mode, unless
  // --allow-missing).
  const unrunnable = [];
  const idOf = new Map(wanted.map((entry) => [entry?.test, entry?.id]));
  for (const test of idOf.keys()) {
    const audit = byTest.get(test);
    if (audit && audit.network && audit.present) run.push(audit);
    else unrunnable.push({ id: String(idOf.get(test) ?? test ?? "unknown"), test: String(test ?? "") });
  }
  return { mode: run.length || unrunnable.length ? "selected" : "none", rulesSha, run, missing: [], unrunnable };
}

// Tracked files that differ from HEAD in the index or the worktree; null outside a git checkout.
function trackedChanges(cwd) {
  try {
    const out = execFileSync("git", ["-C", cwd, "status", "--porcelain", "--untracked-files=no"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\n").map((line) => line.trimEnd()).filter(Boolean);
  } catch {
    return null;
  }
}

// Inside a git checkout, a status git cannot read counts as a change, so the check fails closed.
function changesInCheckout(cwd) {
  return trackedChanges(cwd) ?? ["git status unavailable"];
}

// npm lifecycle scripts or an audit could rewrite tracked code after checkout; an exact-head
// result is only valid for the committed tree, so any such change stops the run. With inGit, a
// checkout whose status git cannot read stops it too.
export function assertPristine(cwd, when, { inGit = false } = {}) {
  const changed = inGit ? changesInCheckout(cwd) : trackedChanges(cwd);
  if (changed && changed.length) {
    const shown = changed.slice(0, 5).join("; ") + (changed.length > 5 ? "; …" : "");
    throw new Error(`tracked files differ from HEAD ${when} (${shown}); refusing to report exact-head results`);
  }
}

function git(cwd, args, input) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

// The exact commit a run reports on, captured before any audit runs: the commit, its tree, and every
// tracked blob's path, mode and id, read from the object database rather than from the mutable index.
export function snapshotCommit(cwd) {
  const commit = git(cwd, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
  const tree = git(cwd, ["rev-parse", "--verify", `${commit}^{tree}`]).trim();
  const entries = git(cwd, ["ls-tree", "-r", "-z", "--full-tree", commit]).split("\0").filter(Boolean).map((line) => {
    const tab = line.indexOf("\t");
    const [mode, type, id] = line.slice(0, tab).split(" ");
    return { mode, type, id, file: line.slice(tab + 1) };
  });
  return { commit, tree, entries };
}

// How the checkout differs from the snapshot in ways git status cannot show: a moved HEAD (checkout or
// reset to another commit), index entries that are not plainly tracked (assume-unchanged, skip-worktree
// or unmerged, which hide worktree edits from git status), and tracked files whose bytes on disk no
// longer hash to the snapshot's blobs. Empty means the checkout is still the snapshot. Any git failure
// counts as drift, so the check fails closed.
export function exactHeadDrift(cwd, snapshot) {
  const drift = [];
  try {
    const head = git(cwd, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
    if (head !== snapshot.commit) drift.push(`HEAD moved to ${head.slice(0, 12)} from ${snapshot.commit.slice(0, 12)}`);
  } catch {
    drift.push("HEAD unreadable");
  }
  try {
    const flagged = git(cwd, ["ls-files", "-v", "-z"]).split("\0").filter((line) => line && !line.startsWith("H "));
    if (flagged.length > 0) {
      const shown = flagged.slice(0, 3).map((line) => line.slice(2)).join(", ") + (flagged.length > 3 ? ", …" : "");
      drift.push(`index entries not plainly tracked (assume-unchanged, skip-worktree or unmerged): ${shown}`);
    }
  } catch {
    drift.push("index unreadable");
  }
  const regular = [];
  for (const entry of snapshot.entries.filter((item) => item.type === "blob")) {
    const full = path.join(cwd, entry.file);
    let stat;
    try {
      stat = lstatSync(full);
    } catch {
      drift.push(`${entry.file} is missing`);
      continue;
    }
    if (entry.mode === "120000") {
      let same = false;
      try {
        same = stat.isSymbolicLink() && readlinkSync(full) === git(cwd, ["cat-file", "blob", entry.id]);
      } catch {
        same = false;
      }
      if (!same) drift.push(`${entry.file} (symlink) changed`);
    } else if (!stat.isFile()) {
      drift.push(`${entry.file} is no longer a regular file`);
    } else {
      regular.push(entry);
    }
  }
  if (regular.length > 0) {
    try {
      const ids = git(cwd, ["hash-object", "--no-filters", "--stdin-paths"], `${regular.map((entry) => entry.file).join("\n")}\n`)
        .trim().split("\n");
      regular.forEach((entry, index) => {
        if (ids[index] !== entry.id) drift.push(`${entry.file} content changed`);
      });
    } catch {
      drift.push("tracked files could not be hashed");
    }
  }
  return drift;
}

// The run's exact-head invariant, checked before, between and after the audits: git status is clean
// (assertPristine) and nothing has drifted from the snapshot.
export function assertExactHead(cwd, snapshot, when) {
  assertPristine(cwd, when, { inGit: true });
  const drift = exactHeadDrift(cwd, snapshot);
  if (drift.length > 0) {
    const shown = drift.slice(0, 5).join("; ") + (drift.length > 5 ? "; …" : "");
    throw new Error(`the checkout drifted from exact head ${snapshot.commit.slice(0, 12)} ${when} (${shown}); refusing to report exact-head results`);
  }
}

// A file identity an audit cannot put back: device, inode and change time. The kernel sets ctime on
// every write, truncate, rename, link, chmod or utimes, through any path, and user code cannot set it.
function fileIdentity(file) {
  try {
    const stat = lstatSync(file, { bigint: true });
    return `${stat.dev}:${stat.ino}:${stat.ctimeNs}`;
  } catch {
    return "missing";
  }
}

// git's own HEAD and index files for this checkout (a linked worktree keeps them outside it).
function gitStateFiles(cwd) {
  return ["HEAD", "index"].map((name) => path.resolve(cwd, git(cwd, ["rev-parse", "--git-path", name]).trim()));
}

// Identities of every tracked file in the snapshot, plus any extra files (git's HEAD and index).
export function checkoutFingerprint(cwd, snapshot, extraFiles = []) {
  const ids = new Map();
  for (const entry of snapshot.entries) {
    if (entry.type === "blob") ids.set(entry.file, fileIdentity(path.join(cwd, entry.file)));
  }
  for (const file of extraFiles) ids.set(`git:${path.basename(file)}`, fileIdentity(file));
  return ids;
}

// Keys whose identity differs between two fingerprints.
export function fingerprintChanges(before, after) {
  return [...before.keys()].filter((key) => before.get(key) !== after.get(key));
}

function headOf(cwd) {
  try {
    return execFileSync("git", ["-C", cwd, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function markdownCell(text) {
  return String(text ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 200);
}

export async function runSourceAudits({
  argv,
  env = process.env,
  selfPath = fileURLToPath(import.meta.url),
  log = (line) => console.log(line),
  sleepMs = (ms) => sleep(ms),
}) {
  const options = parseArgs(argv, path.dirname(selfPath));
  const key = env.NCBI_API_KEY ?? "";
  const safe = (text) => redact(text, key);
  const print = (line) => log(oneLine(safe(line)));
  const cwd = path.resolve(options.cwd);

  const manifestBytes = readFileSync(options.manifest);
  const manifest = validateManifest(JSON.parse(manifestBytes.toString("utf8")));
  const actualHead = headOf(cwd);
  if (env.HEAD_SHA && env.HEAD_SHA !== actualHead) {
    throw new Error(`the checkout at ${cwd} is ${actualHead ?? "not a git checkout"}, not HEAD_SHA ${env.HEAD_SHA}`);
  }
  const headSha = actualHead ?? env.HEAD_SHA ?? null;
  // Every later check compares against this snapshot, never against whatever HEAD is at the time.
  const snapshot = actualHead ? snapshotCommit(cwd) : null;
  if (snapshot && snapshot.commit !== actualHead) {
    throw new Error("HEAD moved while the run started; refusing to report exact-head results");
  }
  if (actualHead) assertExactHead(cwd, snapshot, "before the audits");
  // An audit could change the checkout, run from the changed state and put everything back before it
  // exits. Post-run checks cannot see that, so every attempt is bracketed by identities it cannot
  // restore, and the whole run by the tracked files' identities at this point.
  const gitFiles = actualHead ? gitStateFiles(cwd) : [];
  const runPrint = actualHead ? checkoutFingerprint(cwd, snapshot) : null;
  const audits = resolveAudits(manifest, workingTree(cwd));
  const plan = planRun(options, audits, print);

  // Per-run scratch space. RUNNER_TEMP is per job on GitHub, so the nightly's main and develop
  // runs share one cache; locally everything is removed at the end.
  const tempRoot = env.RUNNER_TEMP || null;
  const scratch = mkdtempSync(path.join(tempRoot || os.tmpdir(), "source-audit-run-"));
  const cacheDir = path.join(tempRoot || scratch, "source-cache");
  mkdirSync(cacheDir, { recursive: true });
  const rateFile = path.join(tempRoot || scratch, "source-audit-ncbi-rate");

  const started = Date.now();
  const budgetMs = options.budgetSeconds * 1000;
  const remainingMs = () => budgetMs - (Date.now() - started);
  const results = [];

  for (const entry of plan.unrunnable ?? []) {
    const result = { id: entry.id, test: entry.test, status: "missing", attempts: 0, head_sha: headSha,
      command: null, stdout_sha256: null, pass_line: null, failure_class: null, ncbi: null };
    results.push({ ...result, attempt_log: [], duration_ms: 0 });
    print(`::error title=Selected source audit missing::${entry.test} cannot run from the trusted manifest (missing at head, or declared only in the head manifest)`);
    print(`SOURCE-AUDIT RESULT ${JSON.stringify(result)}`);
  }
  for (const audit of plan.missing) {
    const result = { id: audit.id, test: audit.test, status: "missing", attempts: 0, head_sha: headSha,
      command: audit.command.join(" "), stdout_sha256: null, pass_line: null, failure_class: null, ncbi: null };
    results.push({ ...result, attempt_log: [], duration_ms: 0, informational: true });
    print(`::warning title=Declared source audit missing::${audit.test} is not in this checkout (reported only)`);
    print(`SOURCE-AUDIT RESULT ${JSON.stringify(result)}`);
  }

  try {
    for (const audit of plan.run) {
      if (actualHead) assertExactHead(cwd, snapshot, `before ${audit.id}`);
      const command = audit.command[0] === "node" ? [process.execPath, ...audit.command.slice(1)] : audit.command;
      const attemptLog = [];
      let final = null;
      let transient = [];
      const auditStarted = Date.now();
      for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
        const waitSeconds = backoffBefore(attempt, options.backoffSeconds);
        if (attempt > 1 && waitSeconds * 1000 >= remainingMs()) {
          print(`Source-audit budget leaves no time to retry ${audit.id}.`);
          break;
        }
        if (waitSeconds > 0) {
          print(`Retrying ${audit.id} in ${waitSeconds}s (attempt ${attempt} of ${options.attempts}).`);
          await sleepMs(waitSeconds * 1000);
        }
        const timeoutMs = Math.min(options.auditTimeoutSeconds * 1000, remainingMs());
        if (timeoutMs <= 0) break;
        const fetchLogFile = path.join(scratch, `fetch-${audit.id}-${attempt}.jsonl`);
        const childEnv = {
          ...env,
          RADULATOR_SOURCE_CACHE_DIR: cacheDir,
          RADULATOR_SOURCE_FETCH_LOG: fetchLogFile,
          RADULATOR_NCBI_RATE_FILE: rateFile,
          RADULATOR_SOURCE_AUDIT_ID: audit.id,
          RADULATOR_SOURCE_AUDIT_ATTEMPT: String(attempt),
        };
        for (const name of WORKFLOW_FILE_VARIABLES) delete childEnv[name];
        const before = actualHead ? checkoutFingerprint(cwd, snapshot, gitFiles) : null;
        const run = await runAttempt({ command, cwd, env: childEnv, timeoutMs });
        // Taken before the runner runs any git command itself (git status can rewrite the index).
        const touched = actualHead ? fingerprintChanges(before, checkoutFingerprint(cwd, snapshot, gitFiles)) : [];
        if (touched.length > 0) transient = touched;
        // The attempt is judged on the checkout it leaves behind: one that rewrote tracked files, moved
        // HEAD or hid edits behind index flags never passes, whatever its exit code.
        const changed = actualHead
          ? [...touched.map((key) => `${key} changed while the audit ran`), ...changesInCheckout(cwd), ...exactHeadDrift(cwd, snapshot)]
          : [];
        const combined = `${run.stdout}\n${run.stderr}`;
        const leaks = findLeaks(combined, key);
        const fetchLog = readFetchLog(fetchLogFile);
        let status;
        let failureClass = null;
        if (leaks.length > 0) {
          status = "key-leak";
          failureClass = "key-leak";
        } else if (changed.length > 0) {
          status = "tampered";
          failureClass = "tampered";
        } else if (run.timedOut) {
          status = "timeout";
          failureClass = "transport";
        } else if (run.spawnError) {
          status = "error";
          failureClass = "assertion";
        } else if (run.exitCode === 0) {
          status = "pass";
        } else {
          status = "fail";
          failureClass = classifyFailure({ output: combined, fetchLog });
        }
        const stdout = safe(run.stdout);
        const stderr = safe(run.stderr);
        print(`::group::SOURCE-AUDIT ${audit.id} attempt ${attempt}/${options.attempts}: ${status}`);
        for (const line of `${stdout}${stderr ? `\n${stderr}` : ""}`.split(/\r\n|\r|\n/)) log(`| ${oneLine(line)}`);
        if (run.truncated) log(`| [output beyond ${MAX_STREAM_BYTES} bytes per stream was dropped]`);
        if (leaks.length > 0) log(`| [the runner redacted ${leaks.join(" and ")} from this output]`);
        log("::endgroup::");
        final = {
          attempt,
          status,
          failure_class: failureClass,
          exit_code: run.exitCode,
          signal: run.signal,
          duration_ms: run.durationMs,
          stdout_sha256: sha256(stdout),
          pass_line: status === "pass" ? lastLine(stdout) : null,
          failure_line: status === "pass" ? null : lastLine(stderr || stdout),
          ncbi: ncbiStats(fetchLog, manifest.ncbi_hosts),
        };
        attemptLog.push(final);
        // A leak is deterministic, and printing it again would not help; a rewritten tree is no
        // longer the head, so nothing more may run on it.
        if (status === "pass" || status === "key-leak" || status === "tampered") break;
      }
      const status = final?.status ?? "not-run";
      const result = {
        id: audit.id,
        test: audit.test,
        status,
        attempts: attemptLog.length,
        head_sha: headSha,
        command: audit.command.join(" "),
        stdout_sha256: final?.stdout_sha256 ?? null,
        pass_line: final?.pass_line ?? null,
        failure_class: status === "not-run" ? "budget" : final?.failure_class ?? null,
        ncbi: final?.ncbi ?? null,
      };
      results.push({ ...result, attempt_log: attemptLog, duration_ms: Date.now() - auditStarted });
      print(`SOURCE-AUDIT RESULT ${JSON.stringify(result)}`);
      // Stop the run here: no further audit, summary or results file for a tree that is not the head.
      // A change still present is named by assertExactHead; one put back before exit, by its ctime trail.
      if (actualHead) assertExactHead(cwd, snapshot, `after ${audit.id}`);
      if (transient.length > 0) {
        const shown = transient.slice(0, 5).join(", ") + (transient.length > 5 ? ", …" : "");
        throw new Error(`the checkout changed while ${audit.id} ran (${shown}); refusing to report exact-head results`);
      }
    }
  } finally {
    if (!tempRoot) rmSync(scratch, { recursive: true, force: true });
  }
  // Once more before anything is reported, in case a process the audits started outlived them.
  if (actualHead) {
    assertExactHead(cwd, snapshot, "before reporting results");
    const late = fingerprintChanges(runPrint, checkoutFingerprint(cwd, snapshot));
    if (late.length > 0) {
      throw new Error(`tracked files changed during the run (${late.slice(0, 5).join(", ")}); refusing to report exact-head results`);
    }
  }

  const counted = results.filter((result) => !result.informational);
  const passed = counted.filter((result) => result.status === "pass").map((result) => result.id);
  const failed = counted.filter((result) => result.status !== "pass").map((result) => result.id);
  const summary = {
    schema: RESULTS_SCHEMA,
    label: options.label,
    mode: plan.mode,
    head_sha: headSha,
    selected: counted.length,
    passed: passed.length,
    failed: failed.length,
    ok: failed.length === 0,
    passed_ids: passed,
    failed_ids: failed,
    missing_ids: results.filter((result) => result.informational).map((result) => result.id),
  };
  print(`SOURCE-AUDIT SUMMARY ${JSON.stringify(summary)}`);

  const report = {
    schema: RESULTS_SCHEMA,
    label: options.label,
    mode: plan.mode,
    head_sha: headSha,
    selection_rules_sha256: plan.rulesSha,
    runner_sha256: sha256(readFileSync(selfPath)),
    manifest_sha256: sha256(manifestBytes),
    ncbi_key_present: Boolean(secretOf(key)),
    options: {
      attempts: options.attempts,
      backoff_seconds: options.backoffSeconds,
      audit_timeout_seconds: options.auditTimeoutSeconds,
      budget_seconds: options.budgetSeconds,
    },
    started_at: new Date(started).toISOString(),
    finished_at: new Date().toISOString(),
    summary,
    results,
  };
  if (options.results) writeFileSync(options.results, safe(`${JSON.stringify(report, null, 2)}\n`));
  if (env.GITHUB_STEP_SUMMARY) {
    const rows = results.map((result) =>
      `| ${markdownCell(result.id)} | ${markdownCell(result.status)} | ${result.attempts} | ` +
      `${markdownCell(result.failure_class ?? "")} | ${markdownCell(result.pass_line ?? "")} |`);
    appendFileSync(env.GITHUB_STEP_SUMMARY, safe([
      `### Clinical source audits${options.label ? ` (${options.label})` : ""} at \`${String(headSha).slice(0, 12)}\``,
      "",
      `Mode: ${plan.mode}. Passed ${passed.length} of ${counted.length}.`,
      "",
      "| Audit | Status | Attempts | Failure class | Pass line |",
      "| --- | --- | --- | --- | --- |",
      ...rows,
      "",
    ].join("\n")));
  }
  return { ok: summary.ok, report };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  // Cancellation stops the audit that is running, including the processes it started.
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (activeGroup) killGroup(activeGroup, "SIGKILL");
      process.exit(1);
    });
  }
  try {
    const { ok } = await runSourceAudits({ argv: process.argv.slice(2) });
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    console.log(redact(`SOURCE-AUDIT ERROR ${error.message}`, process.env.NCBI_API_KEY));
    process.exitCode = 1;
  }
}
