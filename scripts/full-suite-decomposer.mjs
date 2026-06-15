#!/usr/bin/env node
/**
 * Deterministic Playwright JSON reporter summarizer.
 *
 * Usage:
 *   node scripts/full-suite-decomposer.mjs test-results/results.json
 *
 * Emits markdown suitable for a Kanban remediation card. The formatter only
 * prints repository-relative paths and compact error signatures.
 */
import { readFileSync } from "fs";
import { basename, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));

const CLASS_ORDER = [
  "strict-mode locator collisions",
  "timeout/missing result",
  "count/value/reference mismatch",
  "text assertion mismatch",
  "other",
];

function usage(exitCode = 1) {
  const out = exitCode === 0 ? console.log : console.error;
  out("Usage: node scripts/full-suite-decomposer.mjs <playwright-results.json> [--json]");
  process.exit(exitCode);
}

function normalizePath(input) {
  if (!input || typeof input !== "string") return "(unknown file)";

  const withoutUrl = input.replace(/^file:\/\//, "");
  const marker = withoutUrl.match(/(?:^|[\\/])((?:tests|src|scripts)[\\/].*)$/);
  if (marker) return marker[1].replaceAll("\\", "/");

  const resolved = resolve(withoutUrl);
  const rel = relative(root, resolved);
  if (rel && !rel.startsWith("..") && !rel.startsWith("/")) {
    return rel.replaceAll("\\", "/");
  }

  return basename(withoutUrl) || "(unknown file)";
}

function cleanSignature(input) {
  if (!input || typeof input !== "string") return "(no error message)";

  return input
    .split("\n")
    .find((line) => line.trim())
    ?.replaceAll("\\", "/")
    .replace(/(?:file:\/\/)?(?:[A-Za-z]:)?\/[^\s'"`)]+\/((?:tests|src|scripts)\/[^\s'"`)]+)/g, "$1")
    .replace(/(?:file:\/\/)?(?:[A-Za-z]:)?\/[^\s'"`)]+/g, "(absolute-path)")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220) || "(no error message)";
}

function suiteFile(suite, fallback = "") {
  return normalizePath(suite?.file || fallback);
}

function collectTestsFromSuite(suite, inheritedTitles = [], inheritedFile = "") {
  const suiteTitle = suite?.title ? [suite.title] : [];
  const titlePath = [...inheritedTitles, ...suiteTitle];
  const file = suiteFile(suite, inheritedFile);
  const tests = [];

  for (const spec of suite?.specs || []) {
    const specTitle = spec?.title ? [spec.title] : [];
    for (const test of spec?.tests || []) {
      const project = test?.projectName || test?.projectId || "default";
      const fullTitle = [...titlePath, ...specTitle].filter(Boolean);
      tests.push({
        file,
        project,
        title: fullTitle.join(" > "),
        expectedStatus: test?.expectedStatus || "passed",
        status: test?.status || finalStatusFromResults(test?.results || []),
        results: test?.results || [],
      });
    }
  }

  for (const child of suite?.suites || []) {
    tests.push(...collectTestsFromSuite(child, titlePath, file));
  }

  return tests;
}

function finalStatusFromResults(results) {
  const last = results.at(-1);
  if (!last) return "missing";
  return last.status || "unknown";
}

function isUnexpected(test) {
  if (test.status === "unexpected" || test.status === "flaky") return true;
  if (test.status && test.expectedStatus && test.status !== test.expectedStatus) return true;
  return test.results.some((result) =>
    ["failed", "timedOut", "interrupted"].includes(result?.status)
  );
}

function resultErrors(test) {
  return test.results.flatMap((result) => {
    const errors = [];
    if (result?.error) errors.push(result.error);
    if (Array.isArray(result?.errors)) errors.push(...result.errors);
    return errors;
  });
}

function errorText(test) {
  const parts = [];
  for (const error of resultErrors(test)) {
    if (error?.message) parts.push(error.message);
    if (error?.value) parts.push(error.value);
  }
  return parts.join("\n");
}

function classify(test) {
  const text = errorText(test);
  const lower = text.toLowerCase();
  const statuses = test.results.map((result) => result?.status).filter(Boolean);

  if (/strict mode violation|resolved to \d+ elements/.test(lower)) {
    return "strict-mode locator collisions";
  }

  if (
    test.status === "timedOut" ||
    statuses.includes("timedOut") ||
    /timeout|timed out|test timeout|page\.goto: timeout/.test(lower) ||
    (isUnexpected(test) && !text.trim())
  ) {
    return "timeout/missing result";
  }

  if (
    /to(?:have|contain)?text|expected string|received string|text content|innertext|aria snapshot/.test(
      lower
    )
  ) {
    return "text assertion mismatch";
  }

  if (
    /tohavecount|expected number|received number|expected:|received:|toequal|tobecloseto|reference|doi|href|url|count/i.test(
      text.replace(/\s+/g, "")
    ) ||
    /to be|to equal|count|value|reference|expected.*received|received.*expected/.test(lower)
  ) {
    return "count/value/reference mismatch";
  }

  return "other";
}

function testKey(test) {
  return `${test.file}\u0000${test.project}\u0000${test.title}`;
}

function increment(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

function sortedEntries(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function buildSummary(results) {
  const tests = (results.suites || []).flatMap((suite) => collectTestsFromSuite(suite));
  const statusCounts = new Map();
  const fileCounts = new Map();
  const byClass = new Map(CLASS_ORDER.map((name) => [name, {
    tests: [],
    files: new Map(),
    signature: "",
  }]));

  for (const test of tests) increment(statusCounts, test.status || "unknown");

  const uniqueFailures = new Map();
  for (const test of tests.filter(isUnexpected)) {
    if (!uniqueFailures.has(testKey(test))) uniqueFailures.set(testKey(test), test);
  }

  for (const test of uniqueFailures.values()) {
    const failureClass = classify(test);
    const bucket = byClass.get(failureClass);
    bucket.tests.push(test);
    increment(bucket.files, test.file);
    increment(fileCounts, test.file);
    if (!bucket.signature) bucket.signature = cleanSignature(errorText(test));
  }

  return {
    totalParsedTests: tests.length,
    uniqueFailingTests: uniqueFailures.size,
    statusCounts,
    fileCounts,
    byClass,
  };
}

function renderMarkdown(summary, sourcePath) {
  const lines = [];
  lines.push(`# Playwright Full-Suite Failure Decomposition`);
  lines.push("");
  lines.push(`Source: \`${normalizePath(sourcePath)}\``);
  lines.push(`Total parsed tests: **${summary.totalParsedTests}**`);
  lines.push(`Unique failing/unexpected tests: **${summary.uniqueFailingTests}**`);
  lines.push("");
  lines.push("## Status Counts");
  for (const [status, count] of sortedEntries(summary.statusCounts)) {
    lines.push(`- ${status}: ${count}`);
  }
  lines.push("");
  lines.push("## Failure Classes");
  for (const name of CLASS_ORDER) {
    const bucket = summary.byClass.get(name);
    lines.push(`### ${name} — ${plural(bucket.tests.length, "test")}, ${plural(bucket.files.size, "file")}`);
    if (bucket.signature) lines.push(`Example signature: \`${bucket.signature}\``);
    for (const [file, count] of sortedEntries(bucket.files)) {
      lines.push(`- ${count}: \`${file}\``);
    }
    if (!bucket.tests.length) lines.push("- 0");
    lines.push("");
  }
  lines.push("## Per-File Failure Counts");
  for (const [file, count] of sortedEntries(summary.fileCounts)) {
    lines.push(`- ${count}: \`${file}\``);
  }
  if (!summary.fileCounts.size) lines.push("- 0");
  lines.push("");
  lines.push("## Suggested Next Bounded Card");
  const topClass = CLASS_ORDER
    .map((name) => [name, summary.byClass.get(name)])
    .filter(([, bucket]) => bucket.tests.length > 0)
    .sort((a, b) => {
      const countDelta = b[1].tests.length - a[1].tests.length;
      if (countDelta) return countDelta;
      return CLASS_ORDER.indexOf(a[0]) - CLASS_ORDER.indexOf(b[0]);
    })[0];
  if (topClass) {
    const [name, bucket] = topClass;
    const [file, count] = sortedEntries(bucket.files)[0];
    lines.push(`Fix the highest-count \`${name}\` group in \`${file}\` (${plural(count, "failing test")}).`);
  } else {
    lines.push("No failing/unexpected tests found.");
  }

  return `${lines.join("\n")}\n`;
}

function toJson(summary) {
  return {
    totalParsedTests: summary.totalParsedTests,
    uniqueFailingTests: summary.uniqueFailingTests,
    statusCounts: Object.fromEntries(sortedEntries(summary.statusCounts)),
    failureClasses: Object.fromEntries(
      CLASS_ORDER.map((name) => {
        const bucket = summary.byClass.get(name);
        return [name, {
          tests: bucket.tests.length,
          files: Object.fromEntries(sortedEntries(bucket.files)),
          exampleSignature: bucket.signature,
        }];
      })
    ),
    fileCounts: Object.fromEntries(sortedEntries(summary.fileCounts)),
  };
}

const args = process.argv.slice(2);
if (!args.length || args.includes("--help") || args.includes("-h")) usage(args.length ? 0 : 1);

const sourcePath = args[0];
const asJson = args.includes("--json");
const raw = readFileSync(sourcePath, "utf8");
const parsed = JSON.parse(raw);
const summary = buildSummary(parsed);

if (asJson) {
  console.log(JSON.stringify(toJson(summary), null, 2));
} else {
  process.stdout.write(renderMarkdown(summary, sourcePath));
}
