#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { editions } from "../src/editions/definitions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(__dirname, "..");

export const forbiddenEnvExact = new Set([
  "VITE_GA4_MEASUREMENT_ID",
  "VITE_GOOGLE_SITE_VERIFICATION",
  "VITE_BING_SITE_VERIFICATION",
  "VITE_SEARCH_VERIFICATION_META",
  "INDEXNOW_KEY",
]);

export const forbiddenEnvNamePatterns = [
  /^VITE_(GA4|GTM|GOOGLE_ANALYTICS|GOOGLE_TAG_MANAGER)(_|$)/i,
  /^VITE_(SENTRY|POSTHOG|TELEMETRY|DATADOG|FULLSTORY|HOTJAR|MIXPANEL|SEGMENT|AMPLITUDE|LOGROCKET|NEW_RELIC|OTEL)(_|$)/i,
  /^VITE_(FORMSPREE|FORMSTACK|TYPEFORM|JOTFORM)(_|$)/i,
  /^VITE_(GOOGLE_ADS|GOOGLE_ADSENSE|ADSENSE|DOUBLECLICK|META_PIXEL|FACEBOOK_PIXEL|TIKTOK_PIXEL)(_|$)/i,
];

export function isForbiddenInstitutionalEnv(name) {
  return (
    forbiddenEnvExact.has(name) ||
    forbiddenEnvNamePatterns.some((pattern) => pattern.test(name))
  );
}

export function sha256String(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(root, relPath) {
  return JSON.parse(readFileSync(path.join(root, relPath), "utf8"));
}

function readText(root, relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

function getGitCommit(root, env) {
  if (env.RADULATOR_GIT_COMMIT) return env.RADULATOR_GIT_COMMIT;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function hasValue(env, name) {
  return Object.prototype.hasOwnProperty.call(env, name) && env[name] !== "";
}

function extractCalculatorScope(source) {
  const anchor = source.search(/export\s+(?:default|const\s+\w+\s*=)\s*{/);
  return anchor >= 0 ? source.slice(anchor) : source;
}

function extractString(scope, key) {
  const match = scope.match(new RegExp(`\\b${key}\\s*:\\s*"([^"]+)"`));
  return match?.[1] || "";
}

function extractExportName(source, relPath) {
  const named = source.match(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=/)?.[1];
  if (named) return named;
  if (/export\s+default\s+/.test(source)) return "default";
  throw new Error(`${relPath}: exported calculator object not found`);
}

export function loadCalculatorInventory(root = defaultRoot) {
  const calculatorDir = path.join(root, "src", "components", "calculators");
  const entries = [];
  for (const file of readdirSync(calculatorDir).filter((name) =>
    name.endsWith(".jsx"),
  )) {
    const relPath = path.join("src", "components", "calculators", file);
    const source = readFileSync(path.join(root, relPath), "utf8");
    const scope = extractCalculatorScope(source);
    const id = extractString(scope, "id");
    const name = extractString(scope, "name");
    const category = extractString(scope, "category");
    if (!id) continue;
    entries.push({
      id,
      name,
      category,
      file,
      relPath,
      importPath: `../components/calculators/${file}`,
      exportName: extractExportName(source, relPath),
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

function validateInstitutionalAllowlist(root, edition, env) {
  if (!hasValue(env, "RADULATOR_RELEASE_VERSION")) {
    throw new Error(
      "RADULATOR_RELEASE_VERSION is required for RADULATOR_EDITION=institutional",
    );
  }
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/.test(env.RADULATOR_RELEASE_VERSION)) {
    throw new Error(
      "RADULATOR_RELEASE_VERSION must be a compact release token using letters, numbers, dot, underscore, or hyphen",
    );
  }

  const forbidden = Object.keys(env).filter(
    (name) => hasValue(env, name) && isForbiddenInstitutionalEnv(name),
  );
  if (forbidden.length > 0) {
    throw new Error(
      `Forbidden institutional environment variable(s): ${forbidden.sort().join(", ")}`,
    );
  }

  const allowlistRel = "src/editions/institutional-allowlist.json";
  const manifestRel = "src/editions/institutional-validation-manifest.json";
  const schemaRel =
    "src/editions/institutional-validation-manifest.schema.json";
  for (const relPath of [allowlistRel, manifestRel, schemaRel]) {
    if (!existsSync(path.join(root, relPath))) {
      throw new Error(`Missing institutional edition artifact: ${relPath}`);
    }
  }

  const allowlistSource = readText(root, allowlistRel);
  const manifestSource = readText(root, manifestRel);
  const schemaSource = readText(root, schemaRel);
  if (sha256String(allowlistSource) !== edition.allowlistHash) {
    throw new Error("Institutional allowlist hash does not match definitions");
  }
  if (sha256String(manifestSource) !== edition.validationManifestHash) {
    throw new Error(
      "Institutional validation manifest hash does not match definitions",
    );
  }
  if (sha256String(schemaSource) !== edition.validationSchemaHash) {
    throw new Error(
      "Institutional validation manifest schema hash does not match definitions",
    );
  }

  const allowlist = readJson(root, allowlistRel);
  const manifest = readJson(root, manifestRel);
  if (!Array.isArray(allowlist) || !Array.isArray(manifest)) {
    throw new Error("Institutional allowlist and validation manifest must be arrays");
  }
  if (allowlist.includes("feedback-form")) {
    throw new Error("feedback-form is forbidden in institutional builds");
  }
  if (allowlist.length !== edition.calculators.length) {
    throw new Error(
      "Institutional allowlist JSON must exactly match edition definitions",
    );
  }
  if (allowlist.some((id, index) => id !== edition.calculators[index])) {
    throw new Error(
      "Institutional allowlist JSON ordering/content differs from edition definitions",
    );
  }
  if (allowlist.length > 0) {
    throw new Error(
      "Current approved institutional allowlist is empty; non-empty registries require a new parent approval packet",
    );
  }
  if (manifest.length > 0) {
    throw new Error(
      "Current approved institutional validation manifest is empty; non-empty metadata requires a new parent approval packet",
    );
  }
  return { allowlist, manifest };
}

export function resolveEdition({
  env = process.env,
  root = defaultRoot,
  validate = true,
} = {}) {
  const editionId = env.RADULATOR_EDITION || "public";
  const edition = editions[editionId];
  if (!edition) {
    throw new Error(
      `Unknown RADULATOR_EDITION "${editionId}". Expected one of: ${Object.keys(editions).join(", ")}`,
    );
  }

  const resolved = {
    ...edition,
    releaseVersion:
      edition.id === "institutional" ? env.RADULATOR_RELEASE_VERSION : "",
    releaseNotes: env.RADULATOR_RELEASE_NOTES || "",
    gitCommit: getGitCommit(root, env),
    allowlist: edition.calculators,
  };

  if (validate && edition.id === "institutional") {
    const { allowlist, manifest } = validateInstitutionalAllowlist(
      root,
      edition,
      env,
    );
    resolved.allowlist = allowlist;
    resolved.validationManifest = manifest;
  }

  return resolved;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const edition = resolveEdition();
  console.log(JSON.stringify(edition, null, 2));
}
