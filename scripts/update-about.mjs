/**
 * Build-time script: reads calculator .jsx files, extracts metadata,
 * and updates public/about.html with accurate counts and listings.
 *
 * Run: node scripts/update-about.mjs
 * Wired as prebuild step in package.json
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CALCS_DIR = join(ROOT, "src", "components", "calculators");
const ABOUT_PATH = join(ROOT, "public", "about.html");

// Mirror registry.js categoryOrder (excluding Feedback)
const CATEGORY_ORDER = [
  "Radiology",
  "Neuroradiology",
  "Trauma",
  "Cardiac Imaging",
  "Breast Imaging",
  "Women's Imaging",
  "Clinical Decision",
  "Hepatology/Liver",
  "Urology",
  "Interventional",
  "Nephrology",
];

/**
 * Extract a double-quoted value from a line like:  key: "some value",
 * Handles apostrophes inside double quotes (e.g. "Women's Imaging").
 */
function extractDoubleQuoted(line) {
  const m = line.match(/"([^"]+)"/);
  return m ? m[1] : null;
}

function extractCalcMetadata() {
  const files = readdirSync(CALCS_DIR).filter(
    (f) =>
      f.endsWith(".jsx") &&
      f !== "index.js" &&
      f !== "registry.js"
  );

  const calcs = [];

  for (const file of files) {
    const content = readFileSync(join(CALCS_DIR, file), "utf-8");
    const lines = content.split("\n");

    // Find the calculator's top-level id/name/category by looking for
    // lines with minimal indentation (2 spaces). This avoids matching
    // internal data structures (e.g. catheter arrays in KhouryCatheterSelector).
    let id = null, name = null, category = null;

    for (const line of lines) {
      // Match top-level properties: "  key:" (2-space indent, not deeper)
      if (/^  id:\s*"/.test(line) && !id) {
        id = extractDoubleQuoted(line);
      } else if (/^  name:\s*"/.test(line) && !name) {
        name = extractDoubleQuoted(line);
      } else if (/^  category:\s*"/.test(line) && !category) {
        category = extractDoubleQuoted(line);
      }
    }

    if (!id || !name || !category) continue;
    if (category === "Feedback") continue;

    calcs.push({ id, name, category });
  }

  return calcs;
}

function groupByCategory(calcs) {
  const groups = {};
  for (const calc of calcs) {
    if (!groups[calc.category]) groups[calc.category] = [];
    groups[calc.category].push(calc);
  }
  // Sort within each category alphabetically
  for (const cat of Object.keys(groups)) {
    groups[cat].sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}

function generateCalcListHTML(groups) {
  const lines = [];
  const orderedCats = CATEGORY_ORDER.filter((c) => groups[c]);
  // Add any categories not in the order list
  const remaining = Object.keys(groups)
    .filter((c) => !CATEGORY_ORDER.includes(c))
    .sort();
  const allCats = [...orderedCats, ...remaining];

  for (const cat of allCats) {
    const calcs = groups[cat];
    const useColumns = calcs.length > 4;
    lines.push(`  <h3>${cat} (${calcs.length})</h3>`);
    lines.push(useColumns ? '  <ul class="calculator-list">' : "  <ul>");
    for (const calc of calcs) {
      lines.push(`    <li>${calc.name}</li>`);
    }
    lines.push("  </ul>");
    lines.push("");
  }

  return lines.join("\n");
}

function generateSpecialtyPhrase(groups) {
  const cats = CATEGORY_ORDER.filter((c) => groups[c]).map((c) => c.toLowerCase());
  if (cats.length <= 2) return cats.join(" and ");
  return cats.slice(0, -1).join(", ") + ", and " + cats[cats.length - 1];
}

function updateAboutHTML(totalCount, specialtyPhrase, calcListHTML) {
  let html = readFileSync(ABOUT_PATH, "utf-8");

  // Update the total count line
  html = html.replace(
    /Radulator currently offers <strong>\d+ calculators<\/strong>/,
    `Radulator currently offers <strong>${totalCount} calculators</strong>`
  );

  // Update the "What is Radulator?" specialty paragraph
  html = html.replace(
    /Radulator is a collection of medical calculators focused on [^.]+\./,
    `Radulator is a collection of medical calculators focused on ${specialtyPhrase}.`
  );

  // Replace the calculator listing section (between "Available Calculators" heading and "Methodology" heading)
  const startMarker = '<h2>Available Calculators</h2>';
  const endMarker = '<h2>Methodology</h2>';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find calculator list markers in about.html");
    process.exit(1);
  }

  const before = html.substring(0, startIdx);
  const after = html.substring(endIdx);

  html =
    before +
    `${startMarker}\n  <p>Radulator currently offers <strong>${totalCount} calculators</strong> across multiple specialties:</p>\n\n` +
    calcListHTML +
    after;

  writeFileSync(ABOUT_PATH, html, "utf-8");
}

// Main
const calcs = extractCalcMetadata();
const groups = groupByCategory(calcs);
const totalCount = calcs.length;
const specialtyPhrase = generateSpecialtyPhrase(groups);
const calcListHTML = generateCalcListHTML(groups);

updateAboutHTML(totalCount, specialtyPhrase, calcListHTML);

const catSummary = Object.entries(groups)
  .map(([cat, list]) => `  ${cat}: ${list.length}`)
  .join("\n");

console.log(
  `[update-about] Updated about.html: ${totalCount} calculators across ${Object.keys(groups).length} specialties\n${catSummary}`
);
