#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolveEdition } from "./resolve-edition.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const errors = [];
const warnings = [];

function read(relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function publicMarketingAssetHashes() {
  const hashes = new Set();
  for (const relPath of ["public/og-image.jpg"]) {
    const fullPath = path.join(root, relPath);
    if (existsSync(fullPath)) {
      hashes.add(sha256(readFileSync(fullPath)));
    }
  }
  return hashes;
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function rel(fullPath) {
  return path.relative(root, fullPath);
}

function checkNoInstitutionalOgAssets(baseRelPath, publicHashes) {
  const basePath = path.join(root, baseRelPath);
  if (!existsSync(basePath)) return;

  for (const file of walk(basePath)) {
    const relPath = rel(file);
    const basename = path.basename(file).toLowerCase();
    const fileHash = sha256(readFileSync(file));
    if (/^og-image\./.test(basename)) {
      errors.push(
        `${relPath}: institutional OG asset must be absent unless an approved hash-addressed asset is configured`,
      );
      continue;
    }
    if (publicHashes.has(fileHash)) {
      errors.push(`${relPath}: copies the public marketing OG asset`);
    }
  }
}

function checkPublicEdition(edition) {
  const registry = read("src/generated/calculator-registry.generated.js");
  const importCount = [...registry.matchAll(/from "\.\.\/components\/calculators\//g)].length;
  if (importCount < 39) {
    errors.push(`public generated registry imported ${importCount} calculators/feedback entries; expected at least 39`);
  }
  if (!registry.includes("FeedbackForm.jsx")) {
    errors.push("public generated registry must include FeedbackForm.jsx");
  }
  const generatedEdition = read("src/generated/edition.generated.js");
  if (!generatedEdition.includes('"id": "public"')) {
    errors.push("generated edition metadata is not public");
  }
  if (!edition.telemetry?.ga4 || !edition.includeFeedback) {
    errors.push("public edition definition must keep telemetry and feedback enabled");
  }
}

function checkInstitutionalSource(edition) {
  checkNoInstitutionalOgAssets(edition.publicDir, publicMarketingAssetHashes());

  const allowlistSource = read("src/editions/institutional-allowlist.json");
  const manifestSource = read("src/editions/institutional-validation-manifest.json");
  const schemaSource = read("src/editions/institutional-validation-manifest.schema.json");
  const allowlist = JSON.parse(allowlistSource);
  const manifest = JSON.parse(manifestSource);
  if (sha256(allowlistSource) !== edition.allowlistHash) {
    errors.push("institutional allowlist hash drift");
  }
  if (sha256(manifestSource) !== edition.validationManifestHash) {
    errors.push("institutional validation manifest hash drift");
  }
  if (sha256(schemaSource) !== edition.validationSchemaHash) {
    errors.push("institutional validation schema hash drift");
  }
  if (!Array.isArray(allowlist) || allowlist.length !== 0) {
    errors.push("institutional allowlist must be exactly [] for this release");
  }
  if (!Array.isArray(manifest) || manifest.length !== 0) {
    errors.push("institutional validation manifest must be exactly [] for this release");
  }

  const registry = read("src/generated/calculator-registry.generated.js");
  if (!registry.includes("export const calcDefs = [")) {
    errors.push("generated registry is missing calcDefs export");
  }
  const importCount = [...registry.matchAll(/from "\.\.\/components\/calculators\//g)].length;
  if (importCount !== 0) {
    errors.push(`institutional generated registry imported ${importCount} calculator modules; expected 0`);
  }
  if (!registry.includes("export const calcDefs = [\n  \n].filter(Boolean)")) {
    warnings.push("institutional generated registry is empty but formatting differed from the canonical empty output");
  }

  const generatedEdition = read("src/generated/edition.generated.js");
  for (const snippet of [
    '"id": "institutional"',
    '"telemetryEnabled": false',
    '"feedbackEnabled": false',
    '"externalLinks": "text-only"',
    '"releaseControls": true',
    '"releaseControlFile": "release-control.json"',
    '"calculatorAllowlist": []',
  ]) {
    if (!generatedEdition.includes(snippet)) {
      errors.push(`generated institutional edition metadata missing ${snippet}`);
    }
  }

  const generatedAnalytics = read("src/generated/analytics.generated.js");
  if (!generatedAnalytics.includes("../lib/analytics-institutional.js")) {
    errors.push("institutional analytics generated module must use no-op analytics");
  }
}

function checkInstitutionalDist(edition) {
  const dist = path.join(root, edition.outDir);
  if (!existsSync(dist)) {
    warnings.push(`${edition.outDir} does not exist; skipping built-output checks`);
    return;
  }
  checkNoInstitutionalOgAssets(edition.outDir, publicMarketingAssetHashes());

  const releasePath = path.join(dist, "release.json");
  const controlPath = path.join(dist, "release-control.json");
  if (!existsSync(releasePath)) errors.push("dist-institutional/release.json missing");
  if (!existsSync(controlPath)) errors.push("dist-institutional/release-control.json missing");

  if (existsSync(releasePath)) {
    const release = JSON.parse(readFileSync(releasePath, "utf8"));
    if (release.edition !== "institutional") errors.push("release.json edition is not institutional");
    if (release.releaseVersion !== edition.releaseVersion) {
      errors.push("release.json releaseVersion does not match generated edition");
    }
    if (!Array.isArray(release.calculatorAllowlist) || release.calculatorAllowlist.length !== 0) {
      errors.push("release.json calculatorAllowlist must be []");
    }
    if (release.calculatorAllowlistHash !== edition.allowlistHash) {
      errors.push("release.json allowlist hash mismatch");
    }
    if (release.validationManifestHash !== edition.validationManifestHash) {
      errors.push("release.json validation manifest hash mismatch");
    }
  }

  if (existsSync(controlPath)) {
    const control = JSON.parse(readFileSync(controlPath, "utf8"));
    if (control.releaseVersion !== edition.releaseVersion) {
      errors.push("release-control.json releaseVersion mismatch");
    }
    if (typeof control.disabled !== "boolean") {
      errors.push("release-control.json disabled must be boolean");
    }
    if (!Array.isArray(control.disabledCalculators) || control.disabledCalculators.length !== 0) {
      errors.push("release-control.json disabledCalculators must be []");
    }
  }

  const indexHtml = path.join(dist, "index.html");
  if (!existsSync(indexHtml)) errors.push("dist-institutional/index.html missing");
  else {
    const html = readFileSync(indexHtml, "utf8");
    const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || "";
    if (!csp) errors.push("institutional index.html missing meta CSP");
    if (csp.includes("frame-ancestors")) {
      errors.push("institutional meta CSP must not include frame-ancestors");
    }
    for (const required of [
      "default-src 'self'",
      "script-src 'self'",
      "connect-src 'self'",
      "form-action 'none'",
    ]) {
      if (!csp.includes(required)) errors.push(`institutional meta CSP missing ${required}`);
    }
    if (html.includes("SEARCH_VERIFICATION_PLACEHOLDER") || html.includes("GA4_PLACEHOLDER")) {
      errors.push("institutional index still contains public telemetry placeholders");
    }
  }

  const forbiddenPatterns = [
    /googletagmanager/i,
    /google-analytics/i,
    /analytics\.google/i,
    /formspree/i,
    /cdnjs/i,
    /<script[^>]+https?:\/\//i,
    /<link[^>]+https?:\/\//i,
    /\bsendBeacon\b/,
    /\bXMLHttpRequest\b/,
    /document\.cookie/,
  ];
  for (const file of walk(dist)) {
    const relPath = rel(file);
    if (relPath.endsWith(".png") || relPath.endsWith(".jpg") || relPath.endsWith(".ico")) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        errors.push(`${relPath}: forbidden institutional built-output pattern ${pattern}`);
      }
    }
  }

  if (existsSync(path.join(dist, "pirads_map_clone.html"))) {
    errors.push("institutional build must not include pirads_map_clone.html");
  }
  if (existsSync(path.join(dist, "calculators"))) {
    errors.push("institutional build must not emit static calculator pages");
  }
}

const edition = resolveEdition();
if (edition.id === "institutional") {
  checkInstitutionalSource(edition);
  checkInstitutionalDist(edition);
} else {
  checkPublicEdition(edition);
}

const result = {
  ok: errors.length === 0,
  edition: edition.id,
  errors,
  warnings,
  generatedAt: new Date().toISOString(),
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
