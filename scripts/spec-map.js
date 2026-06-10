#!/usr/bin/env node
/**
 * Calculator → spec mapping + coverage enforcement.
 *
 * Scans src/components/calculators/*.jsx (id + name metadata) and
 * tests/e2e/calculators/ specs (navigateToCalculator names), then:
 *   --check          : exit 1 if ANY calculator has zero dedicated specs
 *                      (CI uses this so a new calculator cannot land untested)
 *   --specs-for <f>… : print the spec paths covering the given changed
 *                      component files (one per line; used by targeted CI)
 *   (no args)        : print the full map as JSON (debugging/docs)
 */
import { readdirSync, readFileSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CALC_DIR = join(root, "src", "components", "calculators");
const SPEC_DIR = join(root, "tests", "e2e", "calculators");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
  );
}

const calcs = readdirSync(CALC_DIR)
  .filter((f) => f.endsWith(".jsx") && !/index|registry|Feedback/.test(f))
  .map((f) => {
    const src = readFileSync(join(CALC_DIR, f), "utf8");
    // Anchor at the exported calculator definition — files may contain other
    // id/name pairs first (e.g. device databases; the khoury/scepter-c
    // first-match incident, 2026-06-10).
    const anchor = src.search(/export\s+(default|const\s+\w+\s*=)\s*{/);
    const scope = anchor >= 0 ? src.slice(anchor) : src;
    return {
      file: f,
      id: scope.match(/\bid:\s*"([^"]+)"/)?.[1],
      name: scope.match(/\bname:\s*"([^"]+)"/)?.[1],
    };
  })
  .filter((c) => c.id && c.name);

// Extract each spec's ACTUAL navigation target(s): navigateToCalculator(page, X)
// where X is a string literal or a const resolved within the same file. This is
// runtime truth — the helper resolves the target against current component
// name/id, so a stale target here means the spec is broken at runtime.
const specs = walk(SPEC_DIR)
  .filter((p) => p.endsWith(".spec.js"))
  .map((p) => {
    const src = readFileSync(p, "utf8");
    const targets = [];
    for (const m of src.matchAll(/navigateToCalculator\(\s*page\s*,\s*(["']([^"'\n]+)["']|[A-Za-z_$][\w$]*)/g)) {
      if (m[2]) targets.push(m[2]);
      else {
        const c = src.match(new RegExp(`const\\s+${m[1]}\\s*=\\s*["']([^"'\\n]+)["']`));
        if (c) targets.push(c[1]);
      }
    }
    return { path: p.replace(root + "/", ""), targets };
  });

// Normalize unicode dash/space variants so "AVS – Aldosterone" matches.
const norm = (s) => s.normalize("NFKD").replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();

const byKey = new Map();
for (const c of calcs) { byKey.set(norm(c.name), c); byKey.set(norm(c.id), c); }

const map = calcs.map((c) => ({ ...c, specs: [] }));
const broken = [];
for (const s of specs) {
  for (const t of new Set(s.targets)) {
    const hit = byKey.get(norm(t));
    if (hit) map.find((c) => c.file === hit.file).specs.push(s.path);
    else broken.push({ spec: s.path, target: t });
  }
}

const args = process.argv.slice(2);

if (args[0] === "--check") {
  const uncovered = map.filter((c) => c.specs.length === 0);
  if (broken.length) {
    console.error(`BROKEN SPEC TARGETS — ${broken.length} navigation target(s) match no current calculator name/id (renamed component?):`);
    for (const b of broken) console.error(`  ${b.spec} -> "${b.target}"`);
  }
  if (uncovered.length) {
    console.error(`SPEC COVERAGE FAILURE — ${uncovered.length} calculator(s) without a dedicated spec:`);
    for (const c of uncovered) console.error(`  ${c.id} (${c.file}, name "${c.name}")`);
    console.error("Add a spec under tests/e2e/calculators/ that calls navigateToCalculator(page, \"<name>\").");
    process.exit(1);
  }
  if (broken.length) process.exit(1);
  console.log(`spec coverage OK: ${map.length}/${map.length} calculators have dedicated specs`);
} else if (args[0] === "--specs-for") {
  const changed = args.slice(1).map((p) => basename(p));
  const hits = new Set();
  for (const c of map) if (changed.includes(c.file)) c.specs.forEach((s) => hits.add(s));
  for (const s of hits) console.log(s);
} else {
  console.log(JSON.stringify(map, null, 1));
}
