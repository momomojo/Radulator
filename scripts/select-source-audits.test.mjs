#!/usr/bin/env node
// Offline tests for scripts/select-source-audits.mjs. The rule tests use an in-memory repository;
// the CLI test builds a throwaway git repository in the temp directory.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ENABLED_MISSING_WHY,
  MANIFEST_SCHEMA,
  REMOVED_WHY,
  SELECTION_SCHEMA,
  UNTRUSTED_WHY,
  auditCoverage,
  calculatorIdFromSource,
  extractReferences,
  headDeclarations,
  parseNameStatus,
  registryChanges,
  removedAudits,
  resolveAudits,
  selectSourceAudits,
  validateManifest,
} from "./select-source-audits.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json";

const MANIFEST_SOURCE = {
  schema: MANIFEST_SCHEMA,
  trusted_exact_head_check: "Clinical Source Audits (exact head)",
  discovery_glob: "scripts/audit-*-source.test.mjs",
  default_command: ["node", "{test}"],
  registry_path: REGISTRY,
  dependency_depth: 3,
  all_audits_when_changed: [
    ".github/workflows/e2e-tests.yml",
    "package-lock.json",
    "package.json",
    "scripts/jsx-loader.mjs",
    "scripts/run-source-audits.mjs",
    "scripts/select-source-audits.mjs",
    "scripts/source-audit-manifest.json",
  ],
  leaf_files: ["scripts/release-policy.mjs"],
  ncbi_hosts: ["eutils.ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov", "www.ncbi.nlm.nih.gov"],
  audits: [
    { id: "offline-pins", test: "scripts/audit-offline-pins-source.test.mjs", network: false },
    {
      id: "cac",
      test: "ops/hermes/radulator/cac-boundary.test.mjs",
      command: ["node", "--import", "./scripts/register-jsx-loader.mjs", "ops/hermes/radulator/cac-boundary.test.mjs"],
      registry_ids: ["cac-mesa"],
      hosts: ["www.ncbi.nlm.nih.gov"],
    },
    { id: "albi", test: "scripts/audit-albi-primary-source.test.mjs", registry_ids: ["albi-score"], hosts: ["pmc.ncbi.nlm.nih.gov"] },
    { id: "birads", test: "scripts/audit-birads-source.test.mjs", hosts: ["edge.example.org"] },
  ],
};
const MANIFEST = validateManifest(structuredClone(MANIFEST_SOURCE));

function registry(records, extra = {}) {
  return `${JSON.stringify({ schema: "registry/v1", policy: "p", ...extra, records }, null, 2)}\n`;
}

const BASE_RECORDS = [
  { calculator_id: "albi-score", implemented_version: "2015" },
  { calculator_id: "birads", implemented_version: "5" },
  { calculator_id: "cac-mesa", implemented_version: "2023" },
  { calculator_id: "ipss", implemented_version: "2026" },
  { calculator_id: "wells-dvt", implemented_version: "2003" },
];

// The head checkout, as file path -> text.
const HEAD_FILES = {
  "scripts/audit-offline-pins-source.test.mjs": 'import { pins } from "./audit-fleischner-primary-source.mjs";\n',
  "ops/hermes/radulator/cac-boundary.test.mjs": [
    'import { CACMesa } from "../../../src/components/calculators/CACMesa.jsx";',
    `const registry = readFileSync("${REGISTRY}", "utf8");`,
  ].join("\n"),
  "src/components/calculators/CACMesa.jsx": 'import { REF } from "../../data/mesa.js";\nexport const CACMesa = { id: "cac-mesa" };\n',
  "src/data/mesa.js": "export const REF = 1;\n",
  "scripts/audit-albi-primary-source.test.mjs": [
    'spawnSync(process.execPath, ["--import", "./scripts/register-jsx-loader.mjs", "scripts/audit-albi-primary-source.mjs"]);',
    'spawnSync(process.execPath, ["--test", "tests/albi-compute.test.mjs"]);',
  ].join("\n"),
  "scripts/audit-albi-primary-source.mjs": [
    'import { ALBIScore } from "../src/components/calculators/ALBIScore.jsx";',
    'import { digest } from "./release-policy.mjs";',
    'import { fetchPinned } from "./lib/ncbi-fetch.mjs";',
    'const FIXTURE_PATH = "tests/fixtures/compute/albi-score.json";',
  ].join("\n"),
  "scripts/lib/ncbi-fetch.mjs": "export async function fetchPinned() {}\n",
  "scripts/release-policy.mjs": 'const FILES = new Set(["src/App.jsx", "tests/kbrc-math.test.mjs"]);\nexport function digest() {}\n',
  "src/components/calculators/ALBIScore.jsx": 'import { calculateAlbi } from "../../clinical/albi.js";\nexport const ALBIScore = { id: "albi-score" };\n',
  "src/clinical/albi.js": 'import { round } from "./shared-math.js";\nexport function calculateAlbi() {}\n',
  "src/clinical/shared-math.js": 'import { deep } from "./deep.js";\nexport function round() {}\n',
  "src/clinical/deep.js": "export function deep() {}\n",
  "tests/albi-compute.test.mjs": 'import { ALBIScore } from "../src/components/calculators/ALBIScore.jsx";\n',
  "tests/fixtures/compute/albi-score.json": "{}\n",
  "scripts/audit-birads-source.test.mjs": 'spawnSync(process.execPath, ["scripts/audit-birads-source.mjs"]);\n',
  "scripts/audit-birads-source.mjs": 'import { BIRADS } from "../src/components/calculators/BIRADS.jsx";\n',
  "src/components/calculators/BIRADS.jsx": 'export const BIRADS = { id: "birads" };\n',
  "scripts/audit-lirads-lrm-source.test.mjs": 'spawnSync(process.execPath, ["scripts/audit-lirads-lrm-source.mjs"]);\n',
  "scripts/audit-lirads-lrm-source.mjs": 'import { LIRADS } from "../src/components/calculators/LIRADS.jsx";\n',
  "src/components/calculators/LIRADS.jsx": 'export const LIRADS = { id: "lirads" };\n',
  "scripts/audit-ipss-primary-source.test.mjs": 'const audit = await import("./audit-ipss-primary-source.mjs");\n',
  "scripts/audit-ipss-primary-source.mjs": 'const CALCULATOR = "src/components/calculators/IPSS.jsx";\n',
  "src/components/calculators/IPSS.jsx": 'const OTHER = { id: "not-this-one" };\nexport const IPSS = { id: "ipss" };\n',
  "src/components/calculators/WellsDVT.jsx": 'export const WellsDVT = { id: "wells-dvt" };\n',
  "src/App.jsx": "export default function App() {}\n",
  [REGISTRY]: registry(BASE_RECORDS),
};

function repo(files) {
  return {
    tree: {
      exists: (file) => Object.hasOwn(files, file),
      list: (dir) => Object.keys(files).filter((file) => path.posix.dirname(file) === dir).map((file) => path.posix.basename(file)),
    },
    readHead: (file) => (Object.hasOwn(files, file) ? files[file] : null),
  };
}

// The merge base has the same audit files as HEAD_FILES unless a test says otherwise.
function select({ changes, eventName = "pull_request", baseRef = "develop", auditMode = "", headFiles = HEAD_FILES,
  baseFiles = HEAD_FILES, baseRegistry = registry(BASE_RECORDS), headManifest = null, manifest = MANIFEST }) {
  const head = repo(headFiles);
  return selectSourceAudits({
    eventName,
    baseRef,
    auditMode,
    manifest,
    headManifest,
    changes: changes.map((change) => (typeof change === "string" ? { status: "M", path: change, oldPath: null } : change)),
    tree: head.tree,
    baseTree: baseFiles === null ? null : repo(baseFiles).tree,
    readHead: head.readHead,
    readBase: (file) => (file === REGISTRY ? baseRegistry : null),
  });
}

const ids = (selection) => selection.audits.map((audit) => audit.id);
const NETWORK_AUDITS = ["albi", "birads", "cac", "ipss", "lirads-lrm"];

// Discovery: manifest entries plus conventional tests; ids for new audits come from the file name.
{
  const audits = resolveAudits(MANIFEST, repo(HEAD_FILES).tree);
  assert.deepEqual(audits.map((audit) => audit.id), ["albi", "birads", "cac", "ipss", "lirads-lrm", "offline-pins"]);
  const lirads = audits.find((audit) => audit.id === "lirads-lrm");
  assert.deepEqual(lirads.command, ["node", "scripts/audit-lirads-lrm-source.test.mjs"], "new audits use the default command");
  assert.equal(lirads.declared, false);
  assert.deepEqual(audits.find((audit) => audit.id === "cac").command.slice(0, 3), ["node", "--import", "./scripts/register-jsx-loader.mjs"]);
  assert.equal(audits.find((audit) => audit.id === "offline-pins").network, false);
}

// Discovered ids are reduced to log-safe characters, whatever the file is called.
{
  const odd = { ...HEAD_FILES, "scripts/audit-Odd Name\nSOURCE-AUDIT RESULT-source.test.mjs": "console.log(1);\n" };
  const discovered = resolveAudits(MANIFEST, repo(odd).tree).find((audit) => audit.test.includes("Odd Name"));
  assert.equal(discovered.id, "odd-name-source-audit-result");
}

// R0 and R1: non-PR events and PRs to main run every network audit (never the offline ones).
for (const eventName of ["push", "workflow_dispatch", "schedule", "", null]) {
  const selection = select({ eventName, changes: ["README.md"] });
  assert.equal(selection.mode, "all", `${eventName} runs every audit`);
  assert.deepEqual(ids(selection), NETWORK_AUDITS);
  assert.match(selection.reason, /^R0 /);
  assert.deepEqual(selection.offline, ["offline-pins"]);
}
{
  const selection = select({ baseRef: "main", changes: ["README.md"] });
  assert.equal(selection.mode, "all");
  assert.match(selection.reason, /^R1 /);
  assert.deepEqual(ids(selection), NETWORK_AUDITS);
}
assert.equal(select({ auditMode: "all", changes: ["README.md"] }).mode, "all", "the owner override widens to every audit");
assert.equal(select({ changes: [] }).mode, "all", "an empty or unreadable diff runs every audit");

// Release-control-only and docs-only PRs select nothing.
for (const changes of [
  ["scripts/auto-merge.mjs", ".github/workflows/auto-merge.yml", "AGENTS.md"],
  ["README.md", "docs/ROADMAP.md"],
  ["src/App.jsx"],
  ["tests/kbrc-math.test.mjs"],
]) {
  const selection = select({ changes });
  assert.equal(selection.mode, "none", `${changes.join(", ")} selects nothing`);
  assert.deepEqual(selection.audits, []);
  assert.equal(selection.skipped.length, NETWORK_AUDITS.length);
}

// R2: the audit toolchain (workflow, dependencies, loader, lane files) runs every audit.
for (const file of MANIFEST.all_audits_when_changed) {
  const selection = select({ changes: [file] });
  assert.equal(selection.mode, "all", `${file} runs every audit`);
  assert.match(selection.reason, /^R2 audit toolchain changed: /);
}

// R3: an audit is selected through its calculator, clinical core, fixture, companion or helper.
for (const [file, expected] of [
  ["src/components/calculators/ALBIScore.jsx", ["albi"]],
  ["src/clinical/albi.js", ["albi"]],
  ["tests/fixtures/compute/albi-score.json", ["albi"]],
  ["tests/albi-compute.test.mjs", ["albi"]],
  ["scripts/audit-albi-primary-source.mjs", ["albi"]],
  ["scripts/lib/ncbi-fetch.mjs", ["albi"]],
  ["src/data/mesa.js", ["cac"]],
  ["src/components/calculators/BIRADS.jsx", ["birads"]],
  ["src/components/calculators/IPSS.jsx", ["ipss"]],
  ["scripts/release-policy.mjs", ["albi"]],
]) {
  const selection = select({ changes: [file] });
  assert.equal(selection.mode, "selected", file);
  assert.deepEqual(ids(selection), expected, `${file} selects ${expected.join(", ")}`);
  assert.ok(selection.audits[0].reasons.some((reason) => reason.includes(file)), `${file} is named as the reason`);
}
{
  const selection = select({ changes: ["scripts/audit-albi-primary-source.mjs"] });
  assert.ok(selection.audits[0].reasons.includes("R5 companion module changed"));
}

// Leaf files count when they change, but their path literals (classifier tables) are not followed.
{
  const coverage = auditCoverage(
    resolveAudits(MANIFEST, repo(HEAD_FILES).tree).find((audit) => audit.id === "albi"),
    repo(HEAD_FILES).readHead,
    { depth: MANIFEST.dependency_depth, leafFiles: MANIFEST.leaf_files },
  );
  assert.ok(coverage.files.has("scripts/release-policy.mjs"));
  assert.equal(coverage.files.has("src/App.jsx"), false, "release-policy's path tables are not references");
  const unbounded = auditCoverage(
    resolveAudits(MANIFEST, repo(HEAD_FILES).tree).find((audit) => audit.id === "albi"),
    repo(HEAD_FILES).readHead,
    { depth: MANIFEST.dependency_depth },
  );
  assert.equal(unbounded.files.has("src/App.jsx"), true, "without the leaf entry the literals would be followed");
}

// dependency_depth bounds the walk from the test and its companion module (both depth 0); a
// manifest path (or directory prefix) extends coverage.
assert.deepEqual(ids(select({ changes: ["src/clinical/shared-math.js"] })), ["albi"], "three hops from the companion");
assert.equal(select({ changes: ["src/clinical/deep.js"] }).mode, "none", "four hops away is outside depth 3");
{
  const manifest = validateManifest({
    ...structuredClone(MANIFEST_SOURCE),
    audits: MANIFEST_SOURCE.audits.map((audit) => (audit.id === "albi" ? { ...audit, paths: ["src/clinical/"] } : audit)),
  });
  assert.deepEqual(ids(select({ manifest, changes: ["src/clinical/deep.js"] })), ["albi"]);
}

// R5: a new audit, a changed audit test, and renames on either side.
{
  const selection = select({ changes: [{ status: "A", path: "scripts/audit-lirads-lrm-source.test.mjs", oldPath: null }] });
  assert.deepEqual(ids(selection), ["lirads-lrm"]);
  assert.ok(selection.audits[0].reasons.includes("R5 new audit"));
}
assert.ok(select({ changes: ["scripts/audit-birads-source.test.mjs"] }).audits[0].reasons.includes("R5 audit test changed"));
assert.deepEqual(
  ids(select({ changes: [{ status: "R", path: "src/components/calculators/BIRADS.jsx", oldPath: "src/components/calculators/OldBirads.jsx" }] })),
  ["birads"],
  "a rename into coverage selects the audit",
);
assert.deepEqual(
  ids(select({ changes: [{ status: "R", path: "archive/ALBIScore.jsx", oldPath: "src/components/calculators/ALBIScore.jsx" }] })),
  ["albi"],
  "a rename out of coverage selects the audit",
);

// R6: registry changes select per record, through registry_ids or the calculator file.
{
  const changedRecord = (id) => registry(BASE_RECORDS.map((record) =>
    (record.calculator_id === id ? { ...record, implemented_version: "changed" } : record)));
  for (const [id, expected] of [["albi-score", ["albi"]], ["cac-mesa", ["cac"]], ["ipss", ["ipss"]], ["wells-dvt", []]]) {
    const selection = select({ changes: [REGISTRY], headFiles: { ...HEAD_FILES, [REGISTRY]: changedRecord(id) } });
    assert.deepEqual(ids(selection), expected, `registry record ${id} selects ${expected.join(", ") || "nothing"}`);
    if (expected.length) assert.ok(selection.audits[0].reasons.includes(`R6 registry records changed: ${id}`));
  }
  const added = registry([...BASE_RECORDS, { calculator_id: "lirads", implemented_version: "2018" }]);
  assert.deepEqual(ids(select({ changes: [REGISTRY], headFiles: { ...HEAD_FILES, [REGISTRY]: added } })), ["lirads-lrm"]);
  // A global or unreadable registry change selects every registry-dependent audit.
  const registryDependent = ["albi", "cac"];
  for (const headRegistry of [
    registry(BASE_RECORDS, { policy: "changed" }),
    "{ not json",
    registry([...BASE_RECORDS, { calculator_id: "albi-score" }]),
  ]) {
    const selection = select({ changes: [REGISTRY], headFiles: { ...HEAD_FILES, [REGISTRY]: headRegistry } });
    assert.deepEqual(ids(selection), registryDependent);
    assert.match(selection.audits[0].reasons[0], /^R6 registry-wide change: /);
  }
  const { [REGISTRY]: _removed, ...withoutRegistry } = HEAD_FILES;
  assert.deepEqual(ids(select({ changes: [{ status: "D", path: REGISTRY, oldPath: null }], headFiles: withoutRegistry })),
    registryDependent, "a deleted registry selects every audit linked to it");
}

// R4: the head manifest can widen the selection, never narrow it.
{
  const headManifest = validateManifest({
    ...structuredClone(MANIFEST_SOURCE),
    all_audits_when_changed: [...MANIFEST_SOURCE.all_audits_when_changed, "scripts/new-audit-tool.mjs"],
    audits: MANIFEST_SOURCE.audits.map((audit) => (audit.id === "birads" ? { ...audit, paths: ["docs/evidence/birads-notes.md"] } : audit)),
  });
  assert.equal(select({ changes: ["docs/evidence/birads-notes.md"] }).mode, "none");
  const widened = select({ headManifest, changes: ["docs/evidence/birads-notes.md"] });
  assert.deepEqual(ids(widened), ["birads"]);
  assert.match(widened.audits[0].reasons[0], /^R4 head manifest coverage: /);
  assert.equal(select({ headManifest, changes: ["scripts/new-audit-tool.mjs"] }).mode, "all");
  const narrowing = validateManifest({ ...structuredClone(MANIFEST_SOURCE), all_audits_when_changed: [], audits: [] });
  assert.deepEqual(ids(select({ headManifest: narrowing, changes: ["src/components/calculators/ALBIScore.jsx"] })), ["albi"]);
  assert.equal(select({ headManifest: narrowing, changes: ["package.json"] }).mode, "all");
}

// A network audit declared only in the head manifest, at a path the base manifest and the
// discovery glob do not cover, is required and marked untrusted, in all-mode (a manifest change)
// and in selected mode alike, so the base-loaded runner fails it. A head declaration of a file the
// glob already discovers stays a normal discovered audit, and an offline one is ignored here.
{
  const custom = { id: "newcustom", test: "ops/hermes/radulator/new-custom.test.mjs", command: ["node", "ops/hermes/radulator/new-custom.test.mjs"] };
  const headFiles = { ...HEAD_FILES, [custom.test]: "console.log('head-only custom audit');\n" };
  const headManifest = validateManifest({ ...structuredClone(MANIFEST_SOURCE), audits: [...MANIFEST_SOURCE.audits, custom] });
  const untrustedOf = (selection) => selection.audits.filter((entry) => /declared only in the head manifest/.test(entry.why ?? ""));

  const allMode = select({ headManifest, headFiles, changes: ["scripts/source-audit-manifest.json", custom.test] });
  assert.equal(allMode.mode, "all");
  assert.deepEqual(untrustedOf(allMode).map((entry) => [entry.id, entry.test]), [["newcustom", custom.test]]);
  assert.match(allMode.reason, /audit\(s\) declared only in the head manifest: newcustom/);
  assert.deepEqual(ids(allMode).sort(), [...NETWORK_AUDITS, "newcustom"].sort(), "every trusted audit still runs, plus the untrusted one");

  const selected = select({ headManifest, headFiles, changes: ["src/components/calculators/ALBIScore.jsx"] });
  assert.equal(selected.mode, "selected");
  assert.deepEqual(ids(selected), ["albi", "newcustom"]);
  assert.equal(untrustedOf(selected).length, 1);

  const discovered = validateManifest({ ...structuredClone(MANIFEST_SOURCE), audits: [...MANIFEST_SOURCE.audits,
    { id: "lirads-custom", test: "scripts/audit-lirads-lrm-source.test.mjs", command: ["node", "--inspect", "x.mjs"] }] });
  assert.deepEqual(untrustedOf(select({ headManifest: discovered, changes: ["scripts/source-audit-manifest.json"] })), [],
    "a file the discovery glob finds is a normal audit with the trusted default command");
  const offline = validateManifest({ ...structuredClone(MANIFEST_SOURCE), audits: [...MANIFEST_SOURCE.audits, { ...custom, network: false }] });
  assert.deepEqual(untrustedOf(select({ headManifest: offline, headFiles, changes: ["scripts/source-audit-manifest.json"] })), []);
  assert.deepEqual(untrustedOf(select({ changes: ["scripts/source-audit-manifest.json"] })), [], "no head manifest, nothing untrusted");
}

// Offline audits are never selected here; they run in Smoke Tests.
{
  const selection = select({ changes: ["scripts/audit-offline-pins-source.test.mjs"] });
  assert.equal(selection.mode, "none");
  assert.deepEqual(selection.offline, ["offline-pins"]);
  assert.equal(selection.audits.some((audit) => audit.id === "offline-pins"), false);
}

// A declared network audit missing at head is required, never skipped: the runner fails it, so a
// pull request cannot pass the lane by deleting the audit that guards its change.
{
  const { "ops/hermes/radulator/cac-boundary.test.mjs": _cac, ...headFiles } = HEAD_FILES;
  const selection = select({ baseRef: "main", headFiles, changes: ["README.md"] });
  assert.deepEqual(ids(selection), ["albi", "birads", "ipss", "lirads-lrm", "cac"]);
  assert.deepEqual(selection.audits.find((audit) => audit.id === "cac"),
    { id: "cac", test: "ops/hermes/radulator/cac-boundary.test.mjs", why: "declared test is missing at head" });
  assert.equal(selection.skipped.some((entry) => entry.id === "cac"), false);
  assert.match(selection.reason, /declared audit\(s\) missing at head: cac/);
  // A pull request whose only change deletes the audit selects it (mode "selected"), never "none".
  const deletion = select({ headFiles, changes: [{ status: "D", path: "ops/hermes/radulator/cac-boundary.test.mjs" }] });
  assert.equal(deletion.mode, "selected");
  assert.deepEqual(ids(deletion), ["cac"]);
}

// Regression (primary judge, #322): a discovered audit (no manifest entry) that a pull request
// deletes or renames away is named by neither the manifest nor the head tree, only by the merge
// base. It is required like a declared audit missing at head, in every mode, so the runner fails it.
{
  const LIRADS = "scripts/audit-lirads-lrm-source.test.mjs";
  const { [LIRADS]: _deleted, ...headFiles } = HEAD_FILES;
  const removed = { id: "lirads-lrm", test: LIRADS, why: REMOVED_WHY };
  const removedOf = (selection) => selection.audits.filter((entry) => entry.why === REMOVED_WHY);

  // Its only change is the deletion: selected, never "none" and never skipped.
  const deletion = select({ headFiles, changes: [{ status: "D", path: LIRADS, oldPath: null }] });
  assert.equal(deletion.mode, "selected");
  assert.deepEqual(deletion.audits, [removed]);
  assert.equal(deletion.skipped.some((entry) => entry.test === LIRADS), false);
  assert.match(deletion.reason, /discovered audit\(s\) removed since the merge base: lirads-lrm/);
  // Alongside a change that selects another audit, and with nothing else selected at all.
  assert.deepEqual(ids(select({ headFiles, changes: ["src/components/calculators/BIRADS.jsx", { status: "D", path: LIRADS }] })),
    ["birads", "lirads-lrm"]);
  assert.deepEqual(removedOf(select({ headFiles, changes: ["README.md"] })), [removed], "whatever the diff says");
  // Renamed away: the new name runs as a new audit and the old one is still required.
  const renamedFiles = { ...headFiles, "scripts/audit-lirads-renamed-source.test.mjs": HEAD_FILES[LIRADS] };
  const rename = select({ headFiles: renamedFiles,
    changes: [{ status: "R", path: "scripts/audit-lirads-renamed-source.test.mjs", oldPath: LIRADS }] });
  assert.deepEqual(ids(rename), ["lirads-renamed", "lirads-lrm"]);
  assert.deepEqual(removedOf(rename), [removed]);
  // Every mode: R1 (a PR to main), R2 (the toolchain changed), the owner override, and R0.
  for (const options of [{ baseRef: "main" }, { changes: ["package.json"] }, { auditMode: "all" }, { eventName: "push" }]) {
    const selection = select({ headFiles, changes: ["README.md"], ...options });
    assert.equal(selection.mode, "all", JSON.stringify(options));
    assert.deepEqual(removedOf(selection), [removed], JSON.stringify(options));
    assert.deepEqual(ids(selection), [...NETWORK_AUDITS.filter((id) => id !== "lirads-lrm"), "lirads-lrm"]);
  }
  // Nothing to compare without a merge base (the runner has no BASE_SHA then either).
  assert.deepEqual(removedOf(select({ headFiles, baseFiles: null, changes: ["README.md"] })), []);
  // An audit the pull request adds is new, not removed; one the base never had is not required.
  assert.deepEqual(removedOf(select({ baseFiles: headFiles, changes: [{ status: "A", path: LIRADS }] })), []);
  // Retiring one: once the trusted manifest declares it offline, deleting it is not a removal, and a
  // declared audit missing at head is reported once, as declared-missing.
  const retired = validateManifest({ ...structuredClone(MANIFEST_SOURCE),
    audits: [...MANIFEST_SOURCE.audits, { id: "lirads-lrm", test: LIRADS, network: false }] });
  const retirement = select({ manifest: retired, headFiles, changes: [{ status: "D", path: LIRADS }] });
  assert.equal(retirement.mode, "none");
  assert.deepEqual(retirement.audits, []);
  const declared = validateManifest({ ...structuredClone(MANIFEST_SOURCE),
    audits: [...MANIFEST_SOURCE.audits, { id: "lirads-lrm", test: LIRADS }] });
  assert.deepEqual(select({ manifest: declared, headFiles, changes: [{ status: "D", path: LIRADS }] }).audits,
    [{ id: "lirads-lrm", test: LIRADS, why: "declared test is missing at head" }]);
  // The helper on its own.
  assert.deepEqual(removedAudits(MANIFEST, repo(HEAD_FILES).tree, repo(headFiles).tree), [removed]);
  assert.deepEqual(removedAudits(MANIFEST, repo(HEAD_FILES).tree, repo(HEAD_FILES).tree), []);
}

// Regression (verification judge, #324): the pull request's own manifest is read for every pull
// request, including one to main and one under the owner override. A network audit it declares at a
// path the trusted manifest does not know is required and untrusted in every mode (its command never
// runs); an audit the trusted manifest declares offline and the head enables runs as a network audit
// with the trusted declaration's command.
{
  const custom = { id: "newcustom", test: "ops/hermes/radulator/new-custom.test.mjs", command: ["node", "ops/hermes/radulator/new-custom.test.mjs"] };
  const headFiles = { ...HEAD_FILES, [custom.test]: "console.log('head-only custom audit');\n" };
  const adding = validateManifest({ ...structuredClone(MANIFEST_SOURCE), audits: [...MANIFEST_SOURCE.audits, custom] });
  const untrustedOf = (selection) => selection.audits.filter((entry) => entry.why === UNTRUSTED_WHY);
  for (const [label, options] of [
    ["a pull request to main (R1)", { baseRef: "main", changes: ["README.md"] }],
    ["the owner override", { auditMode: "all", changes: ["README.md"] }],
    ["a manifest change (R2)", { changes: ["scripts/source-audit-manifest.json", custom.test] }],
    ["a diff-selected pull request", { changes: ["src/components/calculators/ALBIScore.jsx"] }],
  ]) {
    const selection = select({ headManifest: adding, headFiles, ...options });
    assert.deepEqual(untrustedOf(selection), [{ id: "newcustom", test: custom.test, why: UNTRUSTED_WHY }], label);
    assert.match(selection.reason, /audit\(s\) declared only in the head manifest: newcustom/, label);
  }

  // offline-pins is declared offline in the trusted manifest; the head manifest enables it.
  const enabling = validateManifest({ ...structuredClone(MANIFEST_SOURCE),
    audits: MANIFEST_SOURCE.audits.map((audit) => (audit.id === "offline-pins" ? { ...audit, network: true } : audit)) });
  for (const [label, options] of [
    ["a pull request to main (R1)", { baseRef: "main", changes: ["README.md"] }],
    ["the owner override", { auditMode: "all", changes: ["README.md"] }],
    ["a manifest change (R2)", { changes: ["scripts/source-audit-manifest.json"] }],
  ]) {
    const selection = select({ headManifest: enabling, ...options });
    assert.equal(selection.mode, "all", label);
    const pins = selection.audits.find((entry) => entry.id === "offline-pins");
    assert.ok(pins?.reasons?.length, `${label}: the enabled audit is selected to run`);
    assert.equal(selection.offline.includes("offline-pins"), false, label);
    assert.match(selection.reason, /audit\(s\) enabled by the head manifest: offline-pins/, label);
  }
  // It runs with the trusted command: a command in the head manifest is ignored.
  const rewired = validateManifest({ ...structuredClone(MANIFEST_SOURCE), audits: MANIFEST_SOURCE.audits.map((audit) =>
    (audit.id === "offline-pins" ? { ...audit, network: true, command: ["node", "--inspect", "elsewhere.mjs"] } : audit)) });
  const declarations = headDeclarations(MANIFEST, rewired, repo(HEAD_FILES).tree);
  assert.deepEqual(declarations.enabled.map((audit) => [audit.id, audit.command, audit.network]),
    [["offline-pins", ["node", "scripts/audit-offline-pins-source.test.mjs"], true]]);
  assert.deepEqual(declarations.untrusted, []);
  // Enabled but missing at head: required, and the runner fails it.
  const { "scripts/audit-offline-pins-source.test.mjs": _pins, ...withoutPins } = HEAD_FILES;
  const missingPins = select({ headManifest: enabling, headFiles: withoutPins, baseRef: "main", changes: ["README.md"] });
  assert.deepEqual(missingPins.audits.find((entry) => entry.id === "offline-pins"),
    { id: "offline-pins", test: "scripts/audit-offline-pins-source.test.mjs", why: ENABLED_MISSING_WHY });
  // A head manifest that disables or drops an audit changes nothing: the trusted declaration stands.
  const narrowing = validateManifest({ ...structuredClone(MANIFEST_SOURCE),
    audits: MANIFEST_SOURCE.audits.map((audit) => ({ ...audit, network: false })) });
  assert.deepEqual(ids(select({ headManifest: narrowing, baseRef: "main", changes: ["README.md"] })), NETWORK_AUDITS);
}

// NCBI flag: set when a selected audit declares an NCBI host or declares no hosts.
assert.equal(select({ changes: ["src/components/calculators/BIRADS.jsx"] }).ncbi, false);
assert.equal(select({ changes: ["src/components/calculators/ALBIScore.jsx"] }).ncbi, true);
assert.equal(select({ changes: ["src/components/calculators/LIRADS.jsx"] }).ncbi, true);

// Deterministic output.
assert.equal(
  JSON.stringify(select({ changes: ["src/components/calculators/ALBIScore.jsx", "src/data/mesa.js", REGISTRY] })),
  JSON.stringify(select({ changes: [REGISTRY, "src/data/mesa.js", "src/components/calculators/ALBIScore.jsx"] })),
  "the selection does not depend on the order of the diff",
);

// Helpers.
assert.deepEqual(
  parseNameStatus("M\0src/a.jsx\0A\0scripts/audit-x-source.test.mjs\0D\0old.md\0R100\0from.jsx\0to.jsx\0"),
  [
    { status: "M", path: "src/a.jsx", oldPath: null },
    { status: "A", path: "scripts/audit-x-source.test.mjs", oldPath: null },
    { status: "D", path: "old.md", oldPath: null },
    { status: "R", path: "to.jsx", oldPath: "from.jsx" },
  ],
);
assert.deepEqual(parseNameStatus(""), []);
assert.throws(() => parseNameStatus("Q\0x\0"), /unexpected git diff status/);
assert.throws(() => parseNameStatus("R100\0from.jsx\0"), /truncated/);

assert.deepEqual(
  extractReferences("scripts/audit-x-source.mjs", [
    'import { A } from "../src/components/calculators/A.jsx";',
    'import "./lib/helper.mjs";',
    'const loader = "./scripts/register-jsx-loader.mjs";',
    'const fixture = "tests/fixtures/compute/a.json";',
    "const bare = 'helper.mjs';",
    'const outside = "../../../etc/passwd.json";',
    'const template = `src/${name}.jsx`;',
    'const url = "https://example.org/a.json";',
  ].join("\n")),
  [
    "scripts/lib/helper.mjs",
    "scripts/register-jsx-loader.mjs",
    "scripts/scripts/register-jsx-loader.mjs",
    "src/components/calculators/A.jsx",
    "tests/fixtures/compute/a.json",
  ],
);

assert.equal(calculatorIdFromSource('const DB = { id: "device" };\nexport const Calc = {\n  id: "real-id",\n};'), "real-id");
assert.equal(calculatorIdFromSource("export default {}"), null);

assert.deepEqual(registryChanges(registry(BASE_RECORDS), registry(BASE_RECORDS)), { ids: [] });
assert.deepEqual(
  registryChanges(registry(BASE_RECORDS), registry([...BASE_RECORDS].reverse())),
  { ids: [] },
  "record order does not matter",
);
assert.match(registryChanges(null, registry(BASE_RECORDS)).global, /added or removed/);
assert.match(registryChanges(registry(BASE_RECORDS), registry(BASE_RECORDS, { schema: "v2" })).global, /top-level/);
assert.match(registryChanges(registry(BASE_RECORDS), "[]").global, /could not be parsed/);

// Manifest validation fails closed.
for (const [change, pattern] of [
  [{ schema: "other" }, /unsupported schema/],
  [{ discovery_glob: "scripts/*/audit-*.mjs" }, /discovery_glob/],
  [{ discovery_glob: "scripts/audit-*-*.mjs" }, /discovery_glob/],
  [{ default_command: ["node", "x.mjs"] }, /must contain \{test\}/],
  [{ dependency_depth: 0 }, /dependency_depth/],
  [{ all_audits_when_changed: ["../outside.json"] }, /all_audits_when_changed/],
  [{ audits: [{ id: "a", test: "scripts/a.mjs" }, { id: "a", test: "scripts/b.mjs" }] }, /repeats/],
  [{ audits: [{ id: "Bad Id", test: "scripts/a.mjs" }] }, /id is malformed/],
  [{ audits: [{ id: "a", test: "scripts/a.mjs", network: "no" }] }, /network must be boolean/],
]) {
  assert.throws(() => validateManifest({ ...structuredClone(MANIFEST_SOURCE), ...change }), pattern);
}

// The repository's own manifest is valid and names this lane's check and files. (Its audit entries
// are not required to exist here: a clinical PR must never fail because of this release-control file.)
{
  const manifest = validateManifest(JSON.parse(readFileSync(path.join(here, "source-audit-manifest.json"), "utf8")));
  assert.equal(manifest.trusted_exact_head_check, "Clinical Source Audits (exact head)");
  for (const file of [
    ".github/workflows/e2e-tests.yml",
    "package.json",
    "package-lock.json",
    "scripts/select-source-audits.mjs",
    "scripts/run-source-audits.mjs",
    "scripts/source-audit-manifest.json",
    "scripts/jsx-loader.mjs",
    "scripts/register-jsx-loader.mjs",
  ]) {
    assert.ok(manifest.all_audits_when_changed.includes(file), `${file} must run every audit when it changes`);
  }
  assert.equal(manifest.discovery_glob, "scripts/audit-*-source.test.mjs");
  assert.equal(manifest.audits.find((audit) => audit.id === "fleischner-nlm-pinned")?.network, false);
}

// CLI: a real git history, byte-identical output, GITHUB_OUTPUT, and the all-audits fallback.
{
  const root = mkdtempSync(path.join(tmpdir(), "select-source-audits-"));
  const git = (...args) => execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.invalid",
    "-c", "commit.gpgsign=false", ...args], { encoding: "utf8" }).trim();
  try {
    const write = (files) => {
      for (const [file, text] of Object.entries(files)) {
        mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
        writeFileSync(path.join(root, file), text);
      }
    };
    git("init", "-q", "-b", "develop");
    write({ ...HEAD_FILES, "scripts/source-audit-manifest.json": `${JSON.stringify(MANIFEST_SOURCE, null, 2)}\n` });
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    const baseSha = git("rev-parse", "HEAD");
    write({ "src/components/calculators/ALBIScore.jsx": `${HEAD_FILES["src/components/calculators/ALBIScore.jsx"]}// changed\n` });
    // Uncommitted working-tree edits must not influence the selection: only git objects are read.
    git("commit", "-q", "-am", "head");
    const headSha = git("rev-parse", "HEAD");
    write({ "src/components/calculators/BIRADS.jsx": "// uncommitted edit\n" });

    const manifestFile = path.join(root, "scripts/source-audit-manifest.json");
    const run = (env, output) => spawnSync(process.execPath, [path.join(here, "select-source-audits.mjs"),
      "--manifest", manifestFile, "--output", output], {
      cwd: root,
      encoding: "utf8",
      env: { PATH: process.env.PATH, EVENT_NAME: "pull_request", BASE_REF: "develop", BASE_SHA: baseSha, HEAD_SHA: headSha, ...env },
    });
    const githubOutput = path.join(root, "github-output");
    const first = run({ GITHUB_OUTPUT: githubOutput }, path.join(root, "selection-1.json"));
    assert.equal(first.status, 0, first.stderr);
    const second = run({}, path.join(root, "selection-2.json"));
    assert.equal(second.status, 0, second.stderr);
    const selection = JSON.parse(readFileSync(path.join(root, "selection-1.json"), "utf8"));
    assert.equal(selection.schema, SELECTION_SCHEMA);
    assert.equal(selection.mode, "selected");
    assert.deepEqual(selection.audits.map((audit) => audit.id), ["albi"]);
    assert.equal(selection.base_sha, baseSha);
    assert.equal(selection.head_sha, headSha);
    assert.equal(selection.merge_base, baseSha);
    assert.match(selection.rules_sha256, /^[0-9a-f]{64}$/);
    assert.equal(
      readFileSync(path.join(root, "selection-1.json"), "utf8"),
      readFileSync(path.join(root, "selection-2.json"), "utf8"),
      "the same inputs produce byte-identical selections",
    );
    assert.equal(readFileSync(githubOutput, "utf8"), "mode=selected\ncount=1\nncbi=true\n");
    assert.match(first.stdout, /^SOURCE-AUDIT SELECTION \{"schema":"radulator-source-audit-selection\/v1","mode":"selected"/);

    // Any error selects every audit instead of failing open.
    const broken = run({ BASE_SHA: "not-a-sha" }, path.join(root, "selection-3.json"));
    assert.equal(broken.status, 0, broken.stderr);
    const fallback = JSON.parse(readFileSync(path.join(root, "selection-3.json"), "utf8"));
    assert.equal(fallback.mode, "all");
    assert.match(fallback.reason, /^selector error, running every audit: /);
    assert.equal(fallback.audits, null);
    const badManifest = path.join(root, "bad-manifest.json");
    writeFileSync(badManifest, "{}");
    const unreadable = spawnSync(process.execPath, [path.join(here, "select-source-audits.mjs"),
      "--manifest", badManifest, "--output", path.join(root, "selection-4.json")], {
      cwd: root, encoding: "utf8", env: { PATH: process.env.PATH, EVENT_NAME: "pull_request", BASE_SHA: baseSha, HEAD_SHA: headSha },
    });
    assert.equal(unreadable.status, 0);
    assert.equal(JSON.parse(readFileSync(path.join(root, "selection-4.json"), "utf8")).mode, "all");
    const usage = spawnSync(process.execPath, [path.join(here, "select-source-audits.mjs"), "--manifest"], { encoding: "utf8" });
    assert.notEqual(usage.status, 0, "bad arguments fail, so the workflow falls back to every audit");

    // Regression (primary judge, #322), end to end: a commit that deletes a discovered audit, in a
    // pull request to develop and in one to main.
    git("rm", "-q", "scripts/audit-lirads-lrm-source.test.mjs");
    git("commit", "-q", "-m", "delete a discovered audit");
    const deletedSha = git("rev-parse", "HEAD");
    for (const [baseRef, mode] of [["develop", "selected"], ["main", "all"]]) {
      const output = path.join(root, `selection-removed-${baseRef}.json`);
      const removedRun = run({ BASE_REF: baseRef, HEAD_SHA: deletedSha }, output);
      assert.equal(removedRun.status, 0, removedRun.stderr);
      const removedSelection = JSON.parse(readFileSync(output, "utf8"));
      assert.equal(removedSelection.mode, mode, baseRef);
      assert.deepEqual(removedSelection.audits.filter((entry) => entry.why === REMOVED_WHY),
        [{ id: "lirads-lrm", test: "scripts/audit-lirads-lrm-source.test.mjs", why: REMOVED_WHY }], baseRef);
      assert.equal(removedSelection.merge_base, baseSha, baseRef);
    }

    // Regression (verification judge, #324), end to end: a pull request whose manifest adds a
    // custom-path network audit and enables the offline one, to main, to develop, and under the owner
    // override. (Only named files are staged: the uncommitted edit above must stay out.)
    write({
      "ops/hermes/radulator/new-custom.test.mjs": "console.log('custom');\n",
      "scripts/source-audit-manifest.json": `${JSON.stringify({ ...MANIFEST_SOURCE, audits: [
        ...MANIFEST_SOURCE.audits.map((audit) => (audit.id === "offline-pins" ? { ...audit, network: true } : audit)),
        { id: "newcustom", test: "ops/hermes/radulator/new-custom.test.mjs", command: ["node", "ops/hermes/radulator/new-custom.test.mjs"] },
      ] }, null, 2)}\n`,
    });
    git("add", "ops/hermes/radulator/new-custom.test.mjs", "scripts/source-audit-manifest.json");
    git("commit", "-q", "-m", "declare a custom audit and enable an offline one");
    const declaringSha = git("rev-parse", "HEAD");
    // The trusted manifest is the base's copy, as the workflow loads it; the checkout's file is the head's.
    const trustedManifest = path.join(root, "trusted-manifest.json");
    writeFileSync(trustedManifest, `${JSON.stringify(MANIFEST_SOURCE, null, 2)}\n`);
    for (const [label, env] of [
      ["main", { BASE_REF: "main" }],
      ["develop", { BASE_REF: "develop" }],
      ["owner override", { BASE_REF: "develop", AUDIT_MODE: "all" }],
    ]) {
      const output = path.join(root, `selection-declared-${label.replace(/ /g, "-")}.json`);
      const declaredRun = spawnSync(process.execPath, [path.join(here, "select-source-audits.mjs"),
        "--manifest", trustedManifest, "--output", output], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH, EVENT_NAME: "pull_request", BASE_SHA: baseSha, HEAD_SHA: declaringSha, ...env },
      });
      assert.equal(declaredRun.status, 0, declaredRun.stderr);
      const declared = JSON.parse(readFileSync(output, "utf8"));
      assert.equal(declared.mode, "all", label);
      assert.deepEqual(declared.audits.filter((entry) => entry.why === UNTRUSTED_WHY),
        [{ id: "newcustom", test: "ops/hermes/radulator/new-custom.test.mjs", why: UNTRUSTED_WHY }], label);
      assert.ok(declared.audits.some((entry) => entry.id === "offline-pins" && entry.reasons), `${label}: the enabled audit runs`);
      assert.equal(declared.offline.includes("offline-pins"), false, label);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log("source-audit selection tests passed");
