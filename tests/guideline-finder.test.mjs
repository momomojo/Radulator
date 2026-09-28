import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PATHS,
  ROOT,
  SCRIPT,
  buildModel,
  escapeHtml,
  formatDate,
  generate,
  readCalculators,
  renderGuidelineFinder,
  safeUrl,
  scriptHash,
} from "../scripts/generate-guideline-finder.mjs";

// The committed page is current.
const committed = readFileSync(join(ROOT, PATHS.output), "utf8");
assert.equal(committed, generate(ROOT), "public/guidelines.html is stale: run node scripts/generate-guideline-finder.mjs");

// Every medical calculator appears exactly once, Feedback excluded.
const calculators = readCalculators(ROOT);
assert.ok(calculators.length >= 40, "calculator metadata was read");
assert.ok(!calculators.some((c) => c.category === "Feedback"));
for (const c of calculators) {
  assert.equal((committed.match(new RegExp(`<article class="card" id="${c.id}"`, "g")) || []).length, 1, c.id);
}

// Descriptions and keywords feed search, so topic words find calculators.
const aast = calculators.find((c) => c.id === "aast-trauma-grading");
assert.match(aast.desc, /spleen/i);
assert.match(/data-gf-text="([^"]*)"/.exec(committed.slice(committed.indexOf('id="aast-trauma-grading"')))[1], /spleen/);

// The CSP allows exactly the inline script it carries.
const csp = /script-src '([^']+)'/.exec(committed)[1];
assert.equal(csp, `sha256-${createHash("sha256").update(SCRIPT, "utf8").digest("base64")}`);
assert.equal(csp, scriptHash());
assert.ok(committed.includes(`<script>${SCRIPT}</script>`));
// No external scripts, styles or images; links out are the only external references.
assert.doesNotMatch(committed, /<script[^>]+src=|<link[^>]+stylesheet|<img[^>]+src="https?:/i);

// Untrusted registry text is escaped and unsafe links are dropped.
assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
assert.equal(safeUrl("javascript:alert(1)"), null);
assert.equal(safeUrl("https://doi.org/10.1/x"), "https://doi.org/10.1/x");
assert.equal(formatDate("2026-09-27"), "27 September 2026");
const hostile = renderGuidelineFinder(buildModel({
  calculators: [{ id: "x", name: "X <b>", category: "Radiology" }],
  registry: { records: [{ calculator_id: "x", implemented_version: "v<script>", sources: [
    { title: "T", authority: "A", role: "primary-publication", url: "javascript:alert(1)" }] }] },
  notices: { currency_check: { last_run: "2026-09-27", method: "m" }, notices: [] },
}));
assert.doesNotMatch(hostile, /v<script>|X <b>|href="javascript:/);

// A calculator without a registry record, or a notice for an unknown calculator, fails loudly.
assert.throws(() => buildModel({ calculators: [{ id: "y", name: "Y", category: "Radiology" }], registry: { records: [] },
  notices: { notices: [] } }), /no guideline registry record/);
assert.throws(() => buildModel({ calculators: [], registry: { records: [] },
  notices: { notices: [{ calculator_id: "ghost" }] } }), /unknown calculator ghost/);

// Reviewed notices render with their review state.
const noticed = renderGuidelineFinder(buildModel({
  calculators: [{ id: "x", name: "X", category: "Radiology" }],
  registry: { records: [{ calculator_id: "x", implemented_version: "v1", sources: [] }] },
  notices: { currency_check: { last_run: "2026-09-27", method: "m" }, notices: [
    { calculator_id: "x", type: "erratum", source: "S", notice: "Erratum, J 2019", url: "https://doi.org/10.1/e",
      first_seen: "2026-09-27", impact: "under-review" }] },
}));
assert.match(noticed, /Correction published<\/strong> to S: <a href="https:\/\/doi.org\/10.1\/e"/);
assert.match(noticed, /checking whether it affects this calculator \(since 27 September 2026\)/);
assert.match(noticed, /1 with a published correction or update under review/);

console.log(`Guideline Finder tests PASS: ${calculators.length} calculators, CSP-pinned script, escaping and freshness`);
