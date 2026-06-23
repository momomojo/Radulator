#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const calculatorDir = path.join(root, "src", "components", "calculators");
const registryPath = path.join(calculatorDir, "registry.js");
const errors = [];
const warnings = [];

function read(filePath) {
  return readFileSync(filePath, "utf8");
}

function extractString(source, key) {
  return source.match(new RegExp(`\\b${key}\\s*:\\s*(["'])(.*?)\\1`))?.[2] || "";
}

function hasKey(source, key) {
  return new RegExp(`\\b${key}\\s*:`).test(source);
}

function extractCategoryOrder() {
  const source = read(registryPath);
  const block = source.match(/categoryOrder\s*=\s*\[([\s\S]*?)\]/)?.[1] || "";
  return new Set([...block.matchAll(/(["'])(.*?)\1/g)].map((match) => match[2]));
}

function checkCalculatorMetadata() {
  const categories = extractCategoryOrder();
  const ids = new Map();
  const files = readdirSync(calculatorDir)
    .filter((file) => file.endsWith(".jsx"))
    .sort();

  for (const file of files) {
    const filePath = path.join(calculatorDir, file);
    const source = read(filePath);
    const rel = path.relative(root, filePath);
    const id = extractString(source, "id");
    const name = extractString(source, "name");
    const category = extractString(source, "category");

    for (const key of ["id", "name", "category", "desc", "metaDesc", "info", "refs"]) {
      if (!hasKey(source, key)) errors.push(`${rel}: missing required calculator metadata key '${key}'`);
    }

    if (id && !/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
      errors.push(`${rel}: id '${id}' must be stable lowercase slug characters`);
    }
    if (id) {
      if (ids.has(id)) errors.push(`${rel}: duplicate calculator id '${id}' also in ${ids.get(id)}`);
      ids.set(id, rel);
    }
    if (category && !categories.has(category)) {
      warnings.push(`${rel}: category '${category}' is not listed in registry categoryOrder; it will sort after ordered categories`);
    }
    if (!name.trim()) errors.push(`${rel}: name is empty or not a static string`);

    const custom = /\bisCustomComponent\s*:\s*true/.test(source);
    if (!custom && !hasKey(source, "compute")) {
      errors.push(`${rel}: non-custom calculator missing compute`);
    }
  }

  if (ids.size < 38) {
    errors.push(`expected at least 38 calculator/feedback ids, found ${ids.size}`);
  }

  return { fileCount: files.length, idCount: ids.size };
}

function checkReportSnippetAllowlist() {
  const allowlist = new Set(["label", "value", "unit", "text", "source", "template", "fields", "enabled"]);
  const files = readdirSync(calculatorDir).filter((file) => file.endsWith(".jsx"));
  for (const file of files) {
    const source = read(path.join(calculatorDir, file));
    if (!/reportSnippet|reportSnippetFields|structuredReport/.test(source)) continue;
    for (const match of source.matchAll(/reportSnippet(?:Fields)?|structuredReport/g)) {
      warnings.push(`${file}: report snippet marker '${match[0]}' present; ensure clinical text is allowlist-only and covered by feature verification`);
    }
    for (const key of [...source.matchAll(/\b(report\w+)\s*:/g)].map((match) => match[1])) {
      if (!allowlist.has(key)) warnings.push(`${file}: review report-related key '${key}' against report snippet allowlist`);
    }
  }
}

function changedFilesAgainstDevelop() {
  try {
    const output = execFileSync("git", ["diff", "--name-only", "origin/develop...HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.split("\n").filter(Boolean);
  } catch {
    warnings.push("could not compare changed files against origin/develop; skipping optional medical diff guard");
    return [];
  }
}

function checkOptionalMedicalDiffGuard() {
  const strict = process.argv.includes("--strict-medical-diff");
  const changed = changedFilesAgainstDevelop();
  const sensitive = changed.filter((file) =>
    (file.startsWith("src/components/calculators/") && file.endsWith(".jsx") && !file.endsWith("FeedbackForm.jsx")) ||
    file.startsWith("docs/calculators/")
  );
  if (!sensitive.length) return;
  const artifact = process.env.RADULATOR_MEDICAL_REVIEW_ARTIFACT || "";
  const approved = process.env.RADULATOR_MEDICAL_REVIEW_APPROVED === "1";
  const message = `medical-sensitive files changed (${sensitive.join(", ")}); require source/signoff artifact before PR`;
  if (strict && !approved && !artifact) errors.push(message);
  else warnings.push(message);
}

const metadata = checkCalculatorMetadata();
checkReportSnippetAllowlist();
checkOptionalMedicalDiffGuard();

const result = {
  ok: errors.length === 0,
  metadata,
  errors,
  warnings,
  generatedAt: new Date().toISOString(),
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
