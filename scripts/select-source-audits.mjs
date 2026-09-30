#!/usr/bin/env node
// Chooses which network clinical source audits the "Clinical Source Audits (exact head)" job
// (e2e-tests.yml) runs for a pull request, so a PR re-fetches only the primary sources its diff can
// affect instead of every source on every run.
//
// Trust: the workflow runs this file, scripts/run-source-audits.mjs and
// scripts/source-audit-manifest.json from the PR's BASE commit, never from the PR head, so a PR
// cannot choose which of its own audits run. The head's files are read only as data (git objects,
// never executed). A PR that changes these files, the workflow, or the dependency and loader files
// runs every audit, and so does any error.
//
//   node select-source-audits.mjs --manifest <trusted manifest> --output <selection.json>
//   env: EVENT_NAME, BASE_REF, BASE_SHA, HEAD_SHA (pull_request only), AUDIT_MODE (optional),
//        GITHUB_OUTPUT (optional)
//
// The selection is the union of these rules:
//   R0  the event is not pull_request                         -> every audit
//   R1  the PR targets main (promotions and hotfixes)         -> every audit
//   R2  a path in the manifest's all_audits_when_changed changed -> every audit
//   R3  a changed path is in an audit's coverage              -> that audit
//       coverage: the audit test, its companion module, the manifest's extra paths, and every repo
//       file they reference (relative paths and repo-rooted path literals), followed
//       dependency_depth hops from the test and its companion. Files in leaf_files count when they
//       change, but their own path literals are not followed: they are data (release-policy.mjs
//       lists paths in order to classify them, not to read them).
//   R4  R2 and R3 again with the head manifest's lists        -> can only add audits
//   R5  the audit's test or companion changed, or it is new   -> that audit
//   R6  guideline registry records changed                    -> the audits linked to them
//       (manifest registry_ids, or the record's calculator file is in the audit's coverage); a
//       top-level registry change or a parse failure selects every registry-dependent audit
//   any error                                                 -> every audit
// In every mode, a pull request (to develop or main) also requires each declared network audit
// missing at head, each network audit declared only in its own manifest, and each discovered audit
// its merge base has and its head lacks (removedAudits); the base-loaded runner fails all three. An
// audit the trusted manifest declares offline and the pull request's manifest enables runs as a
// network audit with the trusted command (headDeclarations).
// AUDIT_MODE=all (repository variable RADULATOR_SOURCE_AUDIT_MODE) is an owner override that can
// only widen the selection.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SELECTION_SCHEMA = "radulator-source-audit-selection/v1";
export const MANIFEST_SCHEMA = "radulator-source-audit-manifest/v1";
// The head's copy of the manifest, read as data for R4.
export const MANIFEST_PATH = "scripts/source-audit-manifest.json";

const CODE_FILE = /\.(?:mjs|cjs|js|jsx)$/;
// Quoted file paths with these extensions are references: import specifiers, spawn arguments,
// readFile paths and path.join fragments all look like this.
const PATH_LITERAL = /(["'`])((?:\.{1,2}\/)*[\w@.-]+(?:\/[\w@.-]+)*\.(?:mjs|cjs|js|jsx|json|md))\1/g;
const REPO_ROOTED = /^(?:src|tests|docs|scripts|ops)\//;
const AUDIT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_LIST = 500;
const MAX_REASON_PATHS = 10;

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

// Code-point order, so output never depends on the runner's locale.
function byId(left, right) {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function isRepoPath(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 300 &&
    !value.startsWith("/") && !value.includes("\\") && !value.split("/").includes("..");
}

// Validates the manifest and fills in defaults. Throws on anything unexpected, so a broken
// manifest makes the selector fall back to every audit and makes the runner fail closed.
export function validateManifest(manifest) {
  const fail = (why) => {
    throw new Error(`source-audit manifest: ${why}`);
  };
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("must be a JSON object");
  if (manifest.schema !== MANIFEST_SCHEMA) fail(`unsupported schema ${JSON.stringify(manifest.schema)}`);
  const list = (value, name, check) => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_LIST || !value.every(check)) fail(`${name} is malformed`);
    return [...value];
  };
  const text = (value) => typeof value === "string" && value.length > 0 && value.length <= 300;
  globParts(manifest.discovery_glob);
  const command = (value, name) => {
    if (!Array.isArray(value) || value.length === 0 || value.length > 20 || !value.every(text)) {
      fail(`${name} must be a non-empty argument list`);
    }
    return [...value];
  };
  const defaultCommand = command(manifest.default_command, "default_command");
  if (!defaultCommand.includes("{test}")) fail("default_command must contain {test}");
  if (!isRepoPath(manifest.registry_path)) fail("registry_path is malformed");
  if (!Number.isInteger(manifest.dependency_depth) || manifest.dependency_depth < 1 || manifest.dependency_depth > 10) {
    fail("dependency_depth must be an integer from 1 to 10");
  }
  if (!Array.isArray(manifest.audits) || manifest.audits.length > MAX_LIST) fail("audits must be a list");
  const ids = new Set();
  const tests = new Set();
  const audits = manifest.audits.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail(`audits[${index}] must be an object`);
    if (!AUDIT_ID.test(entry.id ?? "")) fail(`audits[${index}].id is malformed`);
    if (!isRepoPath(entry.test)) fail(`audits[${index}].test is malformed`);
    if (ids.has(entry.id) || tests.has(entry.test)) fail(`audits[${index}] repeats an id or test`);
    if (entry.network !== undefined && typeof entry.network !== "boolean") fail(`audits[${index}].network must be boolean`);
    ids.add(entry.id);
    tests.add(entry.test);
    return {
      id: entry.id,
      test: entry.test,
      network: entry.network !== false,
      command: entry.command === undefined ? null : command(entry.command, `audits[${index}].command`),
      registry_ids: list(entry.registry_ids, `audits[${index}].registry_ids`, text),
      paths: list(entry.paths, `audits[${index}].paths`, isRepoPath),
      hosts: list(entry.hosts, `audits[${index}].hosts`, text),
    };
  });
  return {
    schema: manifest.schema,
    trusted_exact_head_check: manifest.trusted_exact_head_check,
    discovery_glob: manifest.discovery_glob,
    default_command: defaultCommand,
    registry_path: manifest.registry_path,
    dependency_depth: manifest.dependency_depth,
    all_audits_when_changed: list(manifest.all_audits_when_changed, "all_audits_when_changed", isRepoPath),
    leaf_files: list(manifest.leaf_files, "leaf_files", isRepoPath),
    ncbi_hosts: list(manifest.ncbi_hosts, "ncbi_hosts", text),
    audits,
  };
}

// "scripts/audit-*-source.test.mjs" -> { dir: "scripts", pattern: /^audit-(.+)-source\.test\.mjs$/ }.
// One "*" in the file name only, so discovery never recurses.
export function globParts(glob) {
  if (!isRepoPath(glob)) throw new Error("source-audit manifest: discovery_glob is malformed");
  const dir = path.posix.dirname(glob);
  const name = path.posix.basename(glob);
  if (dir.includes("*") || name.split("*").length !== 2) {
    throw new Error("source-audit manifest: discovery_glob needs exactly one * in the file name");
  }
  const [prefix, suffix] = name.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // [\s\S], not ".": a file name with unusual characters is still discovered (and run).
  return { dir, pattern: new RegExp(`^${prefix}([\\s\\S]+)${suffix}$`) };
}

// The module an audit test drives: scripts/audit-x-source.test.mjs -> scripts/audit-x-source.mjs.
export function companionOf(test) {
  return test.endsWith(".test.mjs") ? `${test.slice(0, -".test.mjs".length)}.mjs` : null;
}

// Every audit the checkout at `tree` can run: the manifest's entries plus every test matching the
// discovery glob (new audits that follow the naming convention need no manifest entry).
//   tree: { exists(path) -> boolean, list(dir) -> file names }
// Shared with the runner, so both resolve the same audits and commands.
export function resolveAudits(manifest, tree) {
  const { dir, pattern } = globParts(manifest.discovery_glob);
  const declaredTests = new Set(manifest.audits.map((audit) => audit.test));
  const takenIds = new Set(manifest.audits.map((audit) => audit.id));
  const commandFor = (audit) => audit.command ??
    manifest.default_command.map((part) => part.split("{test}").join(audit.test));
  const audits = manifest.audits.map((audit) => ({
    ...audit,
    command: commandFor(audit),
    declared: true,
    present: tree.exists(audit.test),
  }));
  for (const name of [...tree.list(dir)].sort()) {
    const match = pattern.exec(name);
    const test = `${dir}/${name}`;
    if (!match || declaredTests.has(test)) continue;
    // audit-ipss-primary-source.test.mjs -> "ipss"; keep the full stem if that id is taken. Ids
    // are printed in logs, so they are reduced to the manifest's id characters.
    const stem = match[1].toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "audit";
    let id = stem.replace(/-primary$/, "") || stem;
    if (takenIds.has(id)) id = stem;
    for (let n = 2; takenIds.has(id); n += 1) id = `${stem}-${n}`;
    takenIds.add(id);
    const audit = { id, test, network: true, command: null, registry_ids: [], paths: [], hosts: [] };
    audits.push({ ...audit, command: commandFor(audit), declared: false, present: true });
  }
  return audits.sort(byId);
}

export const REMOVED_WHY = "discovered audit removed since the merge base";

// Discovered audits the merge base has and the head does not (deleted, or renamed away). An audit
// with no manifest entry exists only as a file matching the discovery glob, so once a pull request
// deletes it, neither the manifest nor the head tree names it; the merge base still does. Each one
// is required, like a declared audit missing at head, so the runner fails it. Retiring a discovered
// audit therefore takes two pull requests: the first declares it in the manifest with
// "network": false, and once that is on the base, the second deletes it. (A declared audit is
// always named at head, by the manifest, so only discovered ones can be removed here.)
//   baseTree, headTree: { exists, list } (see resolveAudits)
export function removedAudits(manifest, baseTree, headTree) {
  const atHead = new Set(resolveAudits(manifest, headTree).map((audit) => audit.test));
  return resolveAudits(manifest, baseTree)
    .filter((audit) => !atHead.has(audit.test))
    .map((audit) => ({ id: audit.id, test: audit.test, why: REMOVED_WHY }));
}

export const UNTRUSTED_WHY = "declared only in the head manifest; not trusted until it is on the base";
export const ENABLED_MISSING_WHY = "enabled by the head manifest but missing at head";

// What a pull request's own manifest asks for beyond the trusted one. It is read as data for every
// pull request (to develop or to main, with or without the owner override) and can only widen:
//   untrusted  a network audit at a path neither the trusted manifest nor the discovery glob covers.
//              Its path and command come from the pull request, so it never runs; it is required,
//              and the runner fails it until the declaration is on the base branch.
//   enabled    a network audit the trusted manifest declares with "network": false. It runs as a
//              network audit with the trusted declaration's command (or fails as missing if its
//              test is not at head).
//   headTree: { exists, list } for the head (see resolveAudits)
export function headDeclarations(manifest, headManifest, headTree) {
  const trusted = new Map(resolveAudits(manifest, headTree).map((audit) => [audit.test, audit]));
  const untrusted = [];
  const enabled = [];
  for (const entry of headManifest?.audits ?? []) {
    if (!entry.network) continue;
    const audit = trusted.get(entry.test);
    if (!audit) untrusted.push({ id: entry.id, test: entry.test, why: UNTRUSTED_WHY });
    else if (!audit.network) enabled.push({ ...audit, network: true, enabled: true });
  }
  return { untrusted: untrusted.sort(byId), enabled: enabled.sort(byId) };
}

// A resolveAudits() tree over a set of repo paths (a commit's `git ls-tree -r --name-only`).
export function pathTree(paths) {
  return {
    exists: (file) => paths.has(file),
    list: (dir) => [...paths].filter((file) => path.posix.dirname(file) === dir).map((file) => path.posix.basename(file)),
  };
}

// Repo paths a file refers to. Relative literals resolve against the file's directory; a
// "./scripts/x" style literal is also taken as repo-rooted, because spawn arguments run with the
// repository as cwd.
export function extractReferences(file, text) {
  const dir = path.posix.dirname(file);
  const found = new Set();
  const add = (candidate) => {
    const normalized = path.posix.normalize(candidate);
    if (isRepoPath(normalized) && normalized !== ".") found.add(normalized);
  };
  for (const match of text.matchAll(PATH_LITERAL)) {
    const literal = match[2];
    if (literal.startsWith("./") || literal.startsWith("../")) {
      add(path.posix.join(dir, literal));
      if (literal.startsWith("./") && REPO_ROOTED.test(path.posix.normalize(literal))) add(literal);
    } else if (REPO_ROOTED.test(literal)) {
      add(literal);
    }
  }
  return [...found].sort();
}

// Files and directory prefixes whose change can alter this audit's result (rule R3).
//   readHead(path) -> the head's text, or null when the path does not exist at head
export function auditCoverage(audit, readHead, { depth, extraPaths = [], leafFiles = [] }) {
  const files = new Set();
  const prefixes = new Set();
  const queue = [];
  const visit = (file, level) => {
    if (files.has(file)) return;
    files.add(file);
    queue.push([file, level]);
  };
  for (const root of [audit.test, companionOf(audit.test), ...audit.paths, ...extraPaths]) {
    if (!root) continue;
    if (root.endsWith("/")) prefixes.add(root);
    else visit(root, 0);
  }
  // Breadth-first, so every file is first reached by its shortest reference chain.
  while (queue.length > 0) {
    const [file, level] = queue.shift();
    if (level >= depth || !CODE_FILE.test(file) || leafFiles.includes(file)) continue;
    const text = readHead(file);
    if (text === null) continue;
    for (const reference of extractReferences(file, text)) visit(reference, level + 1);
  }
  return { files, prefixes: [...prefixes].sort() };
}

function covers(coverage, file) {
  return coverage.files.has(file) || coverage.prefixes.some((prefix) => file.startsWith(prefix));
}

// The calculator id a calculator module declares, parsed the way scripts/spec-map.js does: anchored
// at the exported definition, because files may declare other ids first.
export function calculatorIdFromSource(text) {
  const anchor = text.search(/export\s+(default|const\s+\w+\s*=)\s*{/);
  return (anchor >= 0 ? text.slice(anchor) : text).match(/\bid:\s*"([^"]+)"/)?.[1] ?? null;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

// Which guideline registry records differ between the merge base and the head (rule R6).
// Returns { ids } for a record-level change, or { global: reason } when the change cannot be pinned
// to records: a parse failure, an added or removed registry, a top-level field change, or records
// without unique calculator ids.
export function registryChanges(baseText, headText) {
  if (baseText === null || headText === null) return { global: "the registry was added or removed" };
  const parse = (text) => {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || !Array.isArray(value.records)) throw new Error("records missing");
    const records = new Map();
    for (const record of value.records) {
      const id = record?.calculator_id;
      if (typeof id !== "string" || !id || records.has(id)) throw new Error("records need unique calculator ids");
      records.set(id, JSON.stringify(canonical(record)));
    }
    const { records: _records, ...top } = value;
    return { top: JSON.stringify(canonical(top)), records };
  };
  let base;
  let head;
  try {
    base = parse(baseText);
    head = parse(headText);
  } catch (error) {
    return { global: `the registry could not be parsed (${error.message})` };
  }
  if (base.top !== head.top) return { global: "top-level registry fields changed" };
  const ids = new Set();
  for (const id of new Set([...base.records.keys(), ...head.records.keys()])) {
    if (base.records.get(id) !== head.records.get(id)) ids.add(id);
  }
  return { ids: [...ids].sort() };
}

// Parses `git diff -z --name-status -M` output into { status, path, oldPath } records.
export function parseNameStatus(output) {
  const fields = output.split("\0");
  if (fields.at(-1) === "") fields.pop();
  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index];
    if (!/^[ACDMRTUX]\d*$/.test(status)) throw new Error(`unexpected git diff status ${JSON.stringify(status)}`);
    if (status[0] === "R" || status[0] === "C") {
      if (index + 2 >= fields.length) throw new Error("truncated git diff rename record");
      changes.push({ status: status[0], path: fields[index + 2], oldPath: fields[index + 1] });
      index += 3;
    } else {
      if (index + 1 >= fields.length) throw new Error("truncated git diff record");
      changes.push({ status: status[0], path: fields[index + 1], oldPath: null });
      index += 2;
    }
  }
  return changes;
}

function limitPaths(paths) {
  const shown = paths.slice(0, MAX_REASON_PATHS).join(", ");
  return paths.length > MAX_REASON_PATHS ? `${shown} (+${paths.length - MAX_REASON_PATHS} more)` : shown;
}

function usesNcbi(audit, manifest) {
  // An audit that does not declare its hosts may use NCBI.
  return audit.hosts.length === 0 || audit.hosts.some((host) => manifest.ncbi_hosts.includes(host));
}

// The pure selection. Inputs:
//   eventName, baseRef, auditMode       workflow context
//   manifest                            validated trusted (base) manifest
//   headManifest                        validated head manifest, or null (only ever widens)
//   changes                             parseNameStatus() records for merge-base..head
//   tree                                { exists, list } for the head (see resolveAudits)
//   baseTree                            the same for the merge base, or null (no pull request)
//   readHead(path), readBase(path)      head and merge-base text, or null when absent
export function selectSourceAudits({
  eventName,
  baseRef,
  auditMode,
  manifest,
  headManifest = null,
  changes,
  tree,
  baseTree = null,
  readHead,
  readBase,
}) {
  // The head manifest can declare untrusted audits (required, never run) and enable trusted offline
  // ones (run with the trusted command); see headDeclarations.
  const { untrusted, enabled } = headDeclarations(manifest, headManifest, tree);
  const enabledTests = new Set(enabled.map((audit) => audit.test));
  const audits = resolveAudits(manifest, tree)
    .map((audit) => (enabledTests.has(audit.test) ? enabled.find((entry) => entry.test === audit.test) : audit));
  const runnable = audits.filter((audit) => audit.network && audit.present);
  const missing = audits.filter((audit) => audit.network && !audit.present)
    .map((audit) => ({ id: audit.id, test: audit.test,
      why: audit.enabled ? ENABLED_MISSING_WHY : "declared test is missing at head" }));
  const offline = audits.filter((audit) => !audit.network).map((audit) => audit.id);
  const removed = baseTree ? removedAudits(manifest, baseTree, tree) : [];
  const changed = new Set((changes ?? []).flatMap((change) => [change.path, change.oldPath]).filter(Boolean));
  // A declared network audit missing at head is always selected, so the runner fails it: a pull
  // request cannot pass this lane by deleting (or renaming away) the audit that guards its change.
  // An untrusted head-only declaration and a discovered audit removed since the merge base are
  // selected the same way, in every mode.
  const result = (mode, reason, selected, skipped) => {
    const unpicked = (entries) => entries.filter((entry) => !selected.some((pick) => pick.test === entry.test));
    const required = [...selected, ...unpicked(missing), ...unpicked(untrusted), ...unpicked(removed)];
    const notes = [
      missing.length ? `declared audit(s) missing at head: ${missing.map((entry) => entry.id).join(", ")}` : null,
      untrusted.length ? `audit(s) declared only in the head manifest: ${untrusted.map((entry) => entry.id).join(", ")}` : null,
      removed.length ? `discovered audit(s) removed since the merge base: ${removed.map((entry) => entry.id).join(", ")}` : null,
      enabled.length ? `audit(s) enabled by the head manifest: ${enabled.map((entry) => entry.id).join(", ")}` : null,
    ].filter(Boolean);
    return {
    mode: required.length === 0 ? "none" : selected.length === 0 ? "selected" : mode,
    reason: notes.length ? `${reason}; ${notes.join("; ")}` : reason,
    changed_files: changed.size,
    audits: required,
    skipped: [...skipped].sort(byId),
    offline,
    ncbi: runnable.some((audit) => selected.some((entry) => entry.test === audit.test) && usesNcbi(audit, manifest)),
    };
  };
  const everything = (reason) => result(
    "all",
    reason,
    runnable.map((audit) => ({ id: audit.id, test: audit.test, reasons: [reason] })),
    [],
  );

  if (eventName !== "pull_request") return everything("R0 not a pull_request event");
  if (baseRef === "main") return everything("R1 the pull request targets main");
  if (auditMode === "all") return everything("owner override RADULATOR_SOURCE_AUDIT_MODE=all");
  if (!Array.isArray(changes) || changes.length === 0) return everything("no changed files found");

  const toolchain = new Set([
    ...manifest.all_audits_when_changed,
    ...(headManifest?.all_audits_when_changed ?? []),
  ]);
  const toolchainHits = [...changed].filter((file) => toolchain.has(file)).sort();
  if (toolchainHits.length > 0) return everything(`R2 audit toolchain changed: ${limitPaths(toolchainHits)}`);

  const headEntries = new Map((headManifest?.audits ?? []).map((audit) => [audit.test, audit]));
  const reasons = new Map(runnable.map((audit) => [audit.test, []]));
  const coverageOf = new Map();
  const added = new Set((changes ?? []).filter((change) => change.status === "A" || change.status === "C")
    .map((change) => change.path));
  for (const audit of runnable) {
    const why = reasons.get(audit.test);
    const headEntry = headEntries.get(audit.test);
    const coverage = auditCoverage(audit, readHead, { depth: manifest.dependency_depth, leafFiles: manifest.leaf_files });
    coverageOf.set(audit.test, coverage);
    // R5: the audit itself changed or is new.
    if (changed.has(audit.test)) why.push(added.has(audit.test) ? "R5 new audit" : "R5 audit test changed");
    // Enabled by the head manifest: selected whatever the diff says (the runner forces it too).
    if (audit.enabled) why.push("enabled by the head manifest");
    const companion = companionOf(audit.test);
    if (companion && changed.has(companion)) why.push("R5 companion module changed");
    // R3: a changed file is in the audit's coverage. The registry is matched per record (R6).
    const hits = [...changed].filter((file) => file !== manifest.registry_path && covers(coverage, file)).sort();
    if (hits.length > 0) why.push(`R3 coverage: ${limitPaths(hits)}`);
    // R4: the head manifest's extra paths for this audit can only add coverage.
    const extraPaths = (headEntry?.paths ?? []).filter((extra) => !audit.paths.includes(extra));
    if (extraPaths.length > 0) {
      const headCoverage = auditCoverage(audit, readHead, {
        depth: manifest.dependency_depth,
        extraPaths,
        leafFiles: manifest.leaf_files,
      });
      coverageOf.set(audit.test, headCoverage);
      const headHits = [...changed].filter((file) =>
        file !== manifest.registry_path && covers(headCoverage, file) && !hits.includes(file)).sort();
      if (headHits.length > 0) why.push(`R4 head manifest coverage: ${limitPaths(headHits)}`);
    }
  }

  // R6: registry records, matched through the manifest's registry_ids or the calculator file.
  if (changed.has(manifest.registry_path)) {
    const registryIdsOf = (audit) => new Set([
      ...audit.registry_ids,
      ...(headEntries.get(audit.test)?.registry_ids ?? []),
    ]);
    const registryChange = registryChanges(readBase(manifest.registry_path), readHead(manifest.registry_path));
    if (registryChange.global) {
      for (const audit of runnable) {
        if (registryIdsOf(audit).size > 0 || coverageOf.get(audit.test).files.has(manifest.registry_path)) {
          reasons.get(audit.test).push(`R6 registry-wide change: ${registryChange.global}`);
        }
      }
    } else if (registryChange.ids.length > 0) {
      const calculatorFiles = new Map();
      for (const name of tree.list("src/components/calculators")) {
        if (!name.endsWith(".jsx")) continue;
        const file = `src/components/calculators/${name}`;
        const id = calculatorIdFromSource(readHead(file) ?? "");
        if (id) calculatorFiles.set(id, file);
      }
      for (const audit of runnable) {
        const linked = registryChange.ids.filter((id) =>
          registryIdsOf(audit).has(id) ||
          (calculatorFiles.has(id) && covers(coverageOf.get(audit.test), calculatorFiles.get(id))));
        if (linked.length > 0) reasons.get(audit.test).push(`R6 registry records changed: ${linked.join(", ")}`);
      }
    }
  }

  const selected = [];
  const skipped = [];
  for (const audit of runnable) {
    const why = reasons.get(audit.test);
    if (why.length > 0) selected.push({ id: audit.id, test: audit.test, reasons: why });
    else skipped.push({ id: audit.id, test: audit.test, why: "no changed path reaches this audit" });
  }
  return result(
    "selected",
    `${selected.length} of ${runnable.length} network audits reached by ${changed.size} changed path(s)`,
    selected,
    skipped,
  );
}

// ---- CLI ------------------------------------------------------------------------------------------

const FULL_SHA = /^[0-9a-f]{40}$/;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

// Reads the head and merge base from git objects, so the head's working-tree files (and anything
// `npm ci` did to them) never influence the selection.
function gitContext(baseSha, headSha) {
  if (!FULL_SHA.test(baseSha ?? "") || !FULL_SHA.test(headSha ?? "")) {
    throw new Error("BASE_SHA and HEAD_SHA must be full commit SHAs");
  }
  const mergeBase = git(["merge-base", baseSha, headSha]).trim();
  const changes = parseNameStatus(git(["diff", "-z", "--name-status", "-M", mergeBase, headSha]));
  const pathsAt = (commit) => new Set(git(["ls-tree", "-r", "-z", "--name-only", commit]).split("\0").filter(Boolean));
  const headPaths = pathsAt(headSha);
  const cache = new Map();
  const readHead = (file) => {
    if (!headPaths.has(file)) return null;
    // A path that exists at head but cannot be read is an error, which selects every audit.
    if (!cache.has(file)) cache.set(file, git(["show", `${headSha}:${file}`]));
    return cache.get(file);
  };
  const readBase = (file) => {
    try {
      git(["cat-file", "-e", `${mergeBase}:${file}`]);
    } catch {
      return null;
    }
    return git(["show", `${mergeBase}:${file}`]);
  };
  return { mergeBase, changes, readHead, readBase, tree: pathTree(headPaths), baseTree: pathTree(pathsAt(mergeBase)) };
}

// A checkout on disk as a resolveAudits() tree. The runner uses it; the selector uses it only for
// non-PR events, which have no base to diff against.
export function workingTree(root) {
  return {
    exists: (file) => existsSync(path.join(root, file)),
    list: (dir) => {
      try {
        return readdirSync(path.join(root, dir));
      } catch {
        return [];
      }
    },
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    if (!["--manifest", "--output"].includes(name) || argv[index + 1] === undefined) {
      throw new Error(`usage: select-source-audits.mjs --manifest <file> --output <file> (got ${name})`);
    }
    args[name.slice(2)] = argv[index + 1];
  }
  if (!args.manifest || !args.output) throw new Error("usage: select-source-audits.mjs --manifest <file> --output <file>");
  return args;
}

export function runCli({ argv, env, cwd = process.cwd(), selfPath = fileURLToPath(import.meta.url) }) {
  const args = parseArgs(argv);
  const eventName = env.EVENT_NAME ?? "";
  const baseRef = env.BASE_REF ?? "";
  let manifestBytes = null;
  let mergeBase = null;
  let selection;
  try {
    manifestBytes = readFileSync(args.manifest);
    const manifest = validateManifest(JSON.parse(manifestBytes.toString("utf8")));
    // Every pull request, including one to main or under the owner override, is read against its
    // merge base, whose tree names the discovered audits the pull request removed, and its own
    // manifest is read as data, which can only add required audits (headDeclarations). Only a PR to
    // develop without the override selects from the diff (R3 to R6).
    const context = eventName === "pull_request" ? gitContext(env.BASE_SHA, env.HEAD_SHA) : null;
    mergeBase = context?.mergeBase ?? null;
    let headManifest = null;
    if (context) {
      try {
        const text = context.readHead(MANIFEST_PATH);
        headManifest = text === null ? null : validateManifest(JSON.parse(text));
      } catch {
        // An unreadable head manifest cannot widen anything; if it changed, R2 already selects all.
        headManifest = null;
      }
    }
    selection = selectSourceAudits({
      eventName,
      baseRef,
      auditMode: env.AUDIT_MODE,
      manifest,
      headManifest,
      changes: context?.changes ?? [],
      tree: context?.tree ?? workingTree(cwd),
      baseTree: context?.baseTree ?? null,
      readHead: context?.readHead ?? (() => null),
      readBase: context?.readBase ?? (() => null),
    });
  } catch (error) {
    selection = {
      mode: "all",
      reason: `selector error, running every audit: ${error.message}`,
      changed_files: null,
      audits: null,
      skipped: [],
      offline: [],
      ncbi: true,
    };
  }

  const selectorSha = sha256(readFileSync(selfPath));
  const manifestSha = manifestBytes ? sha256(manifestBytes) : null;
  // Fixed key order and no timestamps: the same inputs always produce the same bytes.
  const output = {
    schema: SELECTION_SCHEMA,
    mode: selection.mode,
    reason: selection.reason,
    event: eventName,
    base_ref: baseRef,
    base_sha: env.BASE_SHA ?? null,
    head_sha: env.HEAD_SHA ?? null,
    merge_base: mergeBase,
    rules_sha256: sha256(`${selectorSha}\n${manifestSha}`),
    selector_sha256: selectorSha,
    manifest_sha256: manifestSha,
    changed_files: selection.changed_files,
    ncbi: selection.ncbi,
    audits: selection.audits,
    skipped: selection.skipped,
    offline: selection.offline,
  };
  writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`);
  if (env.GITHUB_OUTPUT) {
    const count = Array.isArray(output.audits) ? output.audits.length : "unknown";
    appendFileSync(env.GITHUB_OUTPUT, `mode=${output.mode}\ncount=${count}\nncbi=${output.ncbi}\n`);
  }
  return output;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const output = runCli({ argv: process.argv.slice(2), env: process.env });
  console.log(`SOURCE-AUDIT SELECTION ${JSON.stringify(output)}`);
}
