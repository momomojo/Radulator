#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_MARKDOWN_PATH = "docs/verification/calculator-inventory.md";
const DEFAULT_JSON_PATH = "docs/verification/calculator-inventory.json";
const DEFAULT_SOURCE_DIR = "src/components/calculators";
const DEFAULT_REGISTRY_PATH =
  "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json";
const DEFAULT_COMPUTE_DIR = "tests/fixtures/compute";
const DEFAULT_BROWSER_DIR = "tests/e2e/calculators";
const FEEDBACK_CATEGORY = "Feedback";

function walkFiles(directory, predicate) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(filePath, predicate);
    return predicate(filePath) ? [filePath] : [];
  });
}

function relativePath(root, filePath) {
  return relative(root, filePath).split(sep).join("/");
}

function decodeStaticString(body) {
  try {
    return JSON.parse(`"${body}"`);
  } catch {
    return null;
  }
}

function staticStringProperty(scope, key, { required = false } = {}) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = scope.match(
    new RegExp(
      `^\\s{2}${escapedKey}:\\s*(?:"((?:\\\\.|[^"\\\\])*)"|\\r?\\n\\s*"((?:\\\\.|[^"\\\\])*)")`,
      "m",
    ),
  );
  const value = match ? decodeStaticString(match[1] ?? match[2]) : null;
  if (required && !value) {
    throw new Error(`calculator-registry: source is missing static ${key} metadata`);
  }
  return value;
}

/**
 * Extract the same static metadata contract used by the Vite calculator registry.
 * This intentionally does not import JSX or evaluate calculator code.
 */
export function extractCalculatorMetadata(source, filename) {
  const anchor = source.search(/export\s+(?:default|const\s+\w+\s*=)\s*{/);
  const scope = anchor >= 0 ? source.slice(anchor) : source;

  return {
    id: staticStringProperty(scope, "id", { required: true }),
    name: staticStringProperty(scope, "name", { required: true }),
    category: staticStringProperty(scope, "category", { required: true }),
    guidelineVersion: staticStringProperty(scope, "guidelineVersion"),
    sourcePath: filename,
  };
}

export function loadCalculatorSources({ root, sourceDir = DEFAULT_SOURCE_DIR } = {}) {
  const projectRoot = resolve(root || process.cwd());
  const directory = resolve(projectRoot, sourceDir);
  return walkFiles(directory, (filePath) => filePath.endsWith(".jsx"))
    .sort()
    .map((filePath) =>
      extractCalculatorMetadata(
        readFileSync(filePath, "utf8"),
        relativePath(projectRoot, filePath),
      ),
    );
}

export function loadGuidelineRegistry({ root, registryPath = DEFAULT_REGISTRY_PATH } = {}) {
  const projectRoot = resolve(root || process.cwd());
  return JSON.parse(readFileSync(resolve(projectRoot, registryPath), "utf8"));
}

export function loadComputeFixtures({ root, computeDir = DEFAULT_COMPUTE_DIR } = {}) {
  const projectRoot = resolve(root || process.cwd());
  const directory = resolve(projectRoot, computeDir);
  return walkFiles(directory, (filePath) => filePath.endsWith(".json"))
    .sort()
    .map((filePath) => {
      const data = JSON.parse(readFileSync(filePath, "utf8"));
      if (!data.calculatorId || !Array.isArray(data.cases)) {
        throw new Error(
          `compute fixture ${relativePath(projectRoot, filePath)} must contain calculatorId and cases[]`,
        );
      }
      return {
        calculatorId: data.calculatorId,
        path: relativePath(projectRoot, filePath),
        cases: data.cases,
      };
    });
}

function specContainsCalculator(source, calculator) {
  if (source.includes(calculator.name) || source.includes(calculator.id)) return true;

  const variables = new Map();
  for (const match of source.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'])(.*?)\2/g,
  )) {
    variables.set(match[1], match[3]);
  }

  for (const match of source.matchAll(
    /navigateToCalculator\(\s*page\s*,\s*([^),\n]+)\s*\)/g,
  )) {
    const argument = match[1].trim();
    const value =
      (argument.startsWith('"') || argument.startsWith("'"))
        ? argument.slice(1, -1)
        : variables.get(argument);
    if (value === calculator.id || value === calculator.name) return true;
  }

  return false;
}

export function loadBrowserSpecs({
  root,
  browserDir = DEFAULT_BROWSER_DIR,
  sources = [],
} = {}) {
  const projectRoot = resolve(root || process.cwd());
  const directory = resolve(projectRoot, browserDir);
  return walkFiles(directory, (filePath) => filePath.endsWith(".spec.js"))
    .sort()
    .map((filePath) => {
      const path = relativePath(projectRoot, filePath);
      const source = readFileSync(filePath, "utf8");
      const calculatorIds = sources
        .filter((calculator) => specContainsCalculator(source, calculator))
        .map((calculator) => calculator.id)
        .sort();
      const isShared = dirname(path) === DEFAULT_BROWSER_DIR;
      return { path, shared: isShared, calculatorIds };
    });
}

export function summarizeComputeFixtures(fixtures = []) {
  const byCalculator = new Map();
  let cases = 0;

  for (const fixture of fixtures) {
    const fixtureCases = Array.isArray(fixture.cases) ? fixture.cases.length : 0;
    cases += fixtureCases;
    const existing = byCalculator.get(fixture.calculatorId) || {
      caseCount: 0,
      fixturePaths: [],
    };
    existing.caseCount += fixtureCases;
    if (fixture.path && !existing.fixturePaths.includes(fixture.path)) {
      existing.fixturePaths.push(fixture.path);
    }
    byCalculator.set(fixture.calculatorId, existing);
  }

  return {
    fixtureFiles: fixtures.length,
    cases,
    byCalculator: Object.fromEntries(
      [...byCalculator.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([calculatorId, coverage]) => [calculatorId, coverage]),
    ),
  };
}

function registryReviewScope(record) {
  if (!record) return "no registry row";
  const evidence = record.implementation_evidence;
  if (!evidence) return "registry row only; no implementation_evidence block";
  if (evidence.review_scope) return evidence.review_scope;

  const claimCount = Array.isArray(evidence.claims) ? evidence.claims.length : 0;
  const vectorCount = Array.isArray(evidence.source_audit?.vector_ids)
    ? evidence.source_audit.vector_ids.length
    : 0;
  const parts = [`source-derived evidence (${claimCount} claim(s)`];
  if (vectorCount > 0) parts.push(`${vectorCount} vector(s)`);
  parts.push(")");
  return parts.join(", ");
}

function normalizeSourceReferences(record) {
  return (record?.sources || []).map((source) => ({
    authority: source.authority || null,
    title: source.title || null,
    role: source.role || null,
    url: source.url || null,
    ...(source.artifact_sha256 ? { artifactSha256: source.artifact_sha256 } : {}),
  }));
}

function registryRowsById(registry) {
  return new Map((registry?.records || []).map((record) => [record.calculator_id, record]));
}

function browserRowsById(browserSpecs) {
  const byId = new Map();
  for (const spec of browserSpecs) {
    for (const calculatorId of spec.calculatorIds || []) {
      const paths = byId.get(calculatorId) || [];
      if (!paths.includes(spec.path)) paths.push(spec.path);
      byId.set(calculatorId, paths);
    }
  }
  return byId;
}

export function buildInventory({
  sources = [],
  registry = { records: [] },
  computeFixtures = [],
  browserSpecs = [],
  registryPath = DEFAULT_REGISTRY_PATH,
} = {}) {
  const registryById = registryRowsById(registry);
  const compute = summarizeComputeFixtures(computeFixtures);
  const browsers = browserRowsById(browserSpecs);
  const excluded = sources
    .filter((calculator) => calculator.category === FEEDBACK_CATEGORY)
    .map((calculator) => ({
      id: calculator.id,
      name: calculator.name,
      category: calculator.category,
      sourcePath: calculator.sourcePath,
      reason: "excluded from the medical inventory because category is Feedback",
    }));

  const rows = sources
    .filter((calculator) => calculator.category !== FEEDBACK_CATEGORY)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((calculator) => {
      const registryRecord = registryById.get(calculator.id);
      const coverage = compute.byCalculator[calculator.id] || {
        caseCount: 0,
        fixturePaths: [],
      };
      const browserSpecPaths = [...(browsers.get(calculator.id) || [])].sort();
      return {
        id: calculator.id,
        name: calculator.name,
        category: calculator.category,
        guidelineVersion: calculator.guidelineVersion,
        sourcePath: calculator.sourcePath,
        registry: {
          status: registryRecord?.verification_status || "missing",
          lastVerified: registryRecord?.last_verified || null,
          reviewScope: registryReviewScope(registryRecord),
          justification: registryRecord?.justification || null,
          sourceReferences: normalizeSourceReferences(registryRecord),
          implementationEvidence: registryRecord?.implementation_evidence
            ? {
                calculatorPath: registryRecord.implementation_evidence.calculator_path || null,
                fixturePath: registryRecord.implementation_evidence.fixture_path || null,
                testCommand: registryRecord.implementation_evidence.test_command || null,
                claimCount: Array.isArray(registryRecord.implementation_evidence.claims)
                  ? registryRecord.implementation_evidence.claims.length
                  : 0,
                vectorCount: Array.isArray(
                  registryRecord.implementation_evidence.source_audit?.vector_ids,
                )
                  ? registryRecord.implementation_evidence.source_audit.vector_ids.length
                  : 0,
              }
            : null,
        },
        compute: {
          fixturePaths: [...coverage.fixturePaths],
          caseCount: coverage.caseCount,
        },
        browser: {
          specPaths: browserSpecPaths,
          specCount: browserSpecPaths.length,
        },
        clinicalSignoff: "not established",
        releaseProof: "not established",
        sourcePointers: {
          calculator: calculator.sourcePath,
          registry: registryPath,
          computeFixtures: [...coverage.fixturePaths],
          browserSpecs: browserSpecPaths,
        },
      };
    });

  const registrySummary = {
    verified: rows.filter((row) => row.registry.status === "verified").length,
    seedUnverified: rows.filter((row) => row.registry.status === "seed-unverified").length,
    missing: rows.filter((row) => row.registry.status === "missing").length,
    other: rows.filter(
      (row) => !["verified", "seed-unverified", "missing"].includes(row.registry.status),
    ).length,
  };
  const browserSummary = {
    allSpecFiles: browserSpecs.length,
    calculatorSpecificSpecFiles: browserSpecs.filter((spec) => !spec.shared).length,
    sharedSpecFiles: browserSpecs.filter((spec) => spec.shared).length,
  };

  return {
    schema: "radulator-calculator-verification-inventory/v1",
    scope: {
      medicalCategoryExcludes: [FEEDBACK_CATEGORY],
      clinicalSignoff: "not established",
      releaseProof: "not established",
      limitations:
        "Registry statuses are existing evidence claims. Fixture counts and browser-spec presence are inventory signals, not proof that tests passed, clinical review occurred, or a release is live.",
    },
    summary: {
      calculators: rows.length,
      medicalCalculators: rows.length,
      excludedCalculators: excluded.length,
      registry: registrySummary,
      compute: {
        fixtureFiles: compute.fixtureFiles,
        cases: compute.cases,
      },
      browser: browserSummary,
    },
    rows,
    excluded,
  };
}

export function collectInventory({ root, ...options } = {}) {
  const projectRoot = resolve(root || process.cwd());
  const sources = loadCalculatorSources({ root: projectRoot, sourceDir: options.sourceDir });
  const registryPath = options.registryPath || DEFAULT_REGISTRY_PATH;
  const registry = loadGuidelineRegistry({ root: projectRoot, registryPath });
  const computeFixtures = loadComputeFixtures({
    root: projectRoot,
    computeDir: options.computeDir,
  });
  const browserSpecs = loadBrowserSpecs({
    root: projectRoot,
    browserDir: options.browserDir,
    sources,
  });
  return buildInventory({
    sources,
    registry,
    computeFixtures,
    browserSpecs,
    registryPath,
  });
}

function markdownPathLink(path, label = path) {
  return `[${label}](../../${path})`;
}

function sourceUrlLink(source) {
  if (!source.url) return source.title || "unlinked source";
  return `[${source.title || source.url}](${source.url})`;
}

function registryStatusLabel(row) {
  if (row.registry.status === "verified") return "verified (existing registry claim)";
  if (row.registry.status === "seed-unverified") return "seed-unverified (registry claim)";
  return row.registry.status;
}

export function renderMarkdown(inventory) {
  const { summary } = inventory;
  const lines = [
    "# Calculator verification inventory",
    "",
    "Generated from the checked-out calculator exports, the guideline registry, canonical compute fixture files, and Playwright spec presence. This is an inventory artifact, not a clinical certification.",
    "",
    "## Scope and limitations",
    "",
    `- Medical rows: ${summary.medicalCalculators}; the Feedback category is excluded (${inventory.excluded.map((row) => row.id).join(", ") || "none"}).`,
    `- Registry claims: ${summary.registry.verified} verified, ${summary.registry.seedUnverified} seed-unverified, ${summary.registry.missing} missing; these labels are existing registry assertions, not a new independent clinical certification.`,
    `- Canonical compute fixture inventory: ${summary.compute.fixtureFiles} fixture files and ${summary.compute.cases} cases; counts do not establish that the tests passed or that all behavior is covered.`,
    `- Browser spec presence: ${summary.browser.calculatorSpecificSpecFiles} calculator-specific files and ${summary.browser.sharedSpecFiles} shared files; presence does not establish branch coverage, correct medicine, or a successful browser run.`,
    "- Clinical signoff: not established.",
    "- Release/proof: not established.",
    "",
    "## Summary",
    "",
    "| ID | Name | Category | Registry claim | Compute fixture cases | Browser spec presence | Clinical signoff | Release/proof |",
    "|---|---|---|---|---:|---|---|---|",
  ];

  for (const row of inventory.rows) {
    lines.push(
      `| \`${row.id}\` | ${row.name} | ${row.category} | ${registryStatusLabel(row)} | ${row.compute.caseCount} | ${row.browser.specCount > 0 ? `${row.browser.specCount} file(s)` : "none observed"} | ${row.clinicalSignoff} | ${row.releaseProof} |`,
    );
  }

  lines.push("", "## Source pointers by calculator", "");
  for (const row of inventory.rows) {
    lines.push(`### ${row.name} (\`${row.id}\`)`, "");
    lines.push(`- Calculator export: ${markdownPathLink(row.sourcePointers.calculator)}`);
    lines.push(
      `- Guideline registry: ${markdownPathLink(row.sourcePointers.registry)}; status **${registryStatusLabel(row)}**; last verified **${row.registry.lastVerified || "not recorded"}**; review scope: ${row.registry.reviewScope}.`,
    );
    if (row.guidelineVersion) lines.push(`- Public metadata guideline/version label: ${row.guidelineVersion}.`);
    if (row.registry.justification) lines.push(`- Registry justification: ${row.registry.justification}`);
    if (row.registry.sourceReferences.length > 0) {
      lines.push("- Registry source references:");
      for (const source of row.registry.sourceReferences) {
        const details = [source.authority, source.role].filter(Boolean).join("; ");
        lines.push(`  - ${sourceUrlLink(source)}${details ? ` (${details})` : ""}`);
      }
    } else {
      lines.push("- Registry source references: none recorded.");
    }
    if (row.compute.fixturePaths.length > 0) {
      lines.push(
        `- Canonical compute fixture inventory (${row.compute.caseCount} case(s)): ${row.compute.fixturePaths.map((path) => markdownPathLink(path)).join(", ")}.`,
      );
    } else {
      lines.push("- Canonical compute fixture inventory: none observed.");
    }
    if (row.browser.specPaths.length > 0) {
      lines.push(
        `- Browser spec presence (${row.browser.specCount} file(s)): ${row.browser.specPaths.map((path) => markdownPathLink(path)).join(", ")}.`,
      );
    } else {
      lines.push("- Browser spec presence: none observed.");
    }
    lines.push("- Clinical signoff: **not established**.", "- Release/proof: **not established**.", "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderJson(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

function parseArgs(argv) {
  const options = { check: false, stdout: false, format: "markdown" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--stdout") options.stdout = true;
    else if (arg === "--json") options.format = "json";
    else if (arg === "--output") options.markdownPath = argv[++index];
    else if (arg === "--json-output") options.jsonPath = argv[++index];
    else if (arg === "--root") options.root = argv[++index];
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

export function runCli(argv = process.argv.slice(2), io = console) {
  const options = parseArgs(argv);
  if (options.help) {
    io.log(
      "Usage: node scripts/calculator-verification-inventory.mjs [--check] [--stdout [--json]] [--output PATH] [--json-output PATH]",
    );
    return 0;
  }

  const root = resolve(options.root || process.cwd());
  const markdownPath = resolve(root, options.markdownPath || DEFAULT_MARKDOWN_PATH);
  const jsonPath = resolve(root, options.jsonPath || DEFAULT_JSON_PATH);
  const inventory = collectInventory({ root });
  const markdown = renderMarkdown(inventory);
  const json = renderJson(inventory);

  if (options.check) {
    const currentMarkdown = existsSync(markdownPath) ? readFileSync(markdownPath, "utf8") : null;
    const currentJson = existsSync(jsonPath) ? readFileSync(jsonPath, "utf8") : null;
    const stale = currentMarkdown !== markdown || currentJson !== json;
    if (stale) {
      io.error(`calculator verification inventory is stale: expected ${markdownPath} and ${jsonPath}`);
      return 1;
    }
    io.log("calculator verification inventory is current");
    return 0;
  }

  if (options.stdout) {
    process.stdout.write(options.format === "json" ? json : markdown);
    return 0;
  }

  mkdirSync(dirname(markdownPath), { recursive: true });
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(markdownPath, markdown);
  writeFileSync(jsonPath, json);
  io.log(`wrote ${relative(root, markdownPath)} and ${relative(root, jsonPath)}`);
  return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}
