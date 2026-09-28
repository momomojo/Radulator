#!/usr/bin/env node
/**
 * Generates public/guidelines.html, the public Guideline Finder: every guideline and version behind
 * Radulator's calculators, the official sources, Radulator's source-audit status and reviewed
 * notices (corrections, retractions, updates) from the weekly guideline currency check.
 *
 * Inputs (all in the repository, all reviewed through the release gate):
 *   - src/components/calculators/*.jsx            calculator id, name and category
 *   - ops/.../references/guideline-versions.json  implemented guideline, version, sources, audit status
 *   - ops/.../references/guideline-notices.json   reviewed notices and the last currency check date
 *
 * The page is static HTML that works without JavaScript. One inline script adds search and a
 * specialty filter; the Content-Security-Policy allows only that script, by SHA-256 hash, and the
 * page makes no third-party requests. Output is deterministic, so a stale page is detectable:
 *
 *   node scripts/generate-guideline-finder.mjs           write public/guidelines.html
 *   node scripts/generate-guideline-finder.mjs --check   exit 1 if the committed page is stale
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REFERENCES = join("ops", "hermes", "radulator", "skills", "radulator-operations", "references");
export const PATHS = {
  calculators: join("src", "components", "calculators"),
  registry: join(REFERENCES, "guideline-versions.json"),
  notices: join(REFERENCES, "guideline-notices.json"),
  output: join("public", "guidelines.html"),
};

// Mirrors the sidebar order in src/components/calculators/registry.js (Feedback excluded).
const CATEGORY_ORDER = [
  "Radiology", "Neuroradiology", "Trauma", "Cardiac Imaging", "Breast Imaging", "Women's Imaging",
  "Clinical Decision", "Hepatology/Liver", "Urology", "Interventional", "Nephrology",
];
const ROLE_LABELS = {
  "primary-publication": "Primary publication",
  "official-authority": "Official source",
  "supporting-publication": "Supporting publication",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
  "October", "November", "December"];

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeUrl(url) {
  try {
    const parsed = new URL(String(url));
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
}

function searchText(...parts) {
  return parts
    .flat()
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function readCalculators(root = ROOT) {
  const dir = join(root, PATHS.calculators);
  const calculators = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsx")).sort()) {
    let id = null;
    let name = null;
    let category = null;
    let desc = "";
    const terms = [];
    let collecting = false;
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      // Top-level definition keys sit at a two-space indent; deeper keys belong to data tables.
      if (collecting) {
        terms.push(...[...line.matchAll(/"([^"]+)"/g)].map((q) => q[1]));
        if (/^ {2}\]/.test(line)) collecting = false;
        continue;
      }
      const list = /^ {2}(keywords|tags):\s*\[(.*)$/.exec(line);
      if (list) {
        terms.push(...[...list[2].matchAll(/"([^"]+)"/g)].map((q) => q[1]));
        collecting = !list[2].includes("]");
        continue;
      }
      const m = /^ {2}(id|name|category|desc):\s*"([^"]+)"/.exec(line);
      if (!m) continue;
      if (m[1] === "id" && !id) id = m[2];
      if (m[1] === "name" && !name) name = m[2];
      if (m[1] === "category" && !category) category = m[2];
      if (m[1] === "desc" && !desc) desc = m[2];
    }
    if (id && name && category && category !== "Feedback") {
      calculators.push({ id, name, category, desc, terms: [...new Set(terms)], file });
    }
  }
  return calculators;
}

export function buildModel({ calculators, registry, notices }) {
  const records = new Map(registry.records.map((record) => [record.calculator_id, record]));
  const byCalculator = new Map();
  for (const notice of notices.notices ?? []) {
    if (!records.has(notice.calculator_id)) {
      throw new Error(`notice for unknown calculator ${notice.calculator_id}`);
    }
    byCalculator.set(notice.calculator_id, [...(byCalculator.get(notice.calculator_id) ?? []), notice]);
  }
  const entries = calculators.map((calculator) => {
    const record = records.get(calculator.id);
    if (!record) throw new Error(`calculator ${calculator.id} has no guideline registry record`);
    const sources = (record.sources ?? []).map((source) => ({
      title: source.title ?? "",
      authority: source.authority ?? "",
      role: ROLE_LABELS[source.role] ?? "Source",
      url: safeUrl(source.url),
    }));
    return {
      ...calculator,
      version: record.implemented_version ?? "",
      verified: record.verification_status === "verified" && Boolean(record.last_verified),
      lastVerified: record.last_verified ?? null,
      authorities: [...new Set(sources.map((source) => source.authority).filter(Boolean))],
      sources,
      notices: byCalculator.get(calculator.id) ?? [],
    };
  });
  const rank = (category) => {
    const i = CATEGORY_ORDER.indexOf(category);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  const groups = [...new Set(entries.map((entry) => entry.category))]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((category) => ({
      category,
      entries: entries.filter((entry) => entry.category === category).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  return {
    groups,
    total: entries.length,
    withOfficialLinks: entries.filter((entry) => entry.sources.some((source) => source.url)).length,
    underReview: entries.filter((entry) => entry.notices.some((notice) => notice.impact === "under-review")).length,
    lastCheck: notices.currency_check?.last_run ?? null,
    method: notices.currency_check?.method ?? "",
  };
}

export const SCRIPT = `(() => {
  const input = document.getElementById("gf-search");
  const select = document.getElementById("gf-category");
  const count = document.getElementById("gf-count");
  const cards = Array.from(document.querySelectorAll("[data-gf-card]"));
  const groups = Array.from(document.querySelectorAll("[data-gf-group]"));
  const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").trim();
  const apply = () => {
    const terms = norm(input.value).split(/\\s+/).filter(Boolean);
    const category = select.value;
    let shown = 0;
    for (const card of cards) {
      const match = terms.every((t) => card.dataset.gfText.includes(t)) &&
        (!category || card.dataset.gfCategory === category);
      card.hidden = !match;
      if (match) shown += 1;
    }
    for (const group of groups) {
      group.hidden = !group.querySelector("[data-gf-card]:not([hidden])");
    }
    count.textContent = shown === cards.length ? "Showing all " + cards.length : "Showing " + shown + " of " + cards.length;
  };
  input.addEventListener("input", apply);
  select.addEventListener("change", apply);
  document.documentElement.classList.add("gf-js");
  apply();
})();`;

export function scriptHash(script = SCRIPT) {
  return `sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`;
}

function renderEntry(entry) {
  const text = searchText(entry.name, entry.category, entry.desc ?? "", entry.terms ?? [], entry.version,
    entry.authorities, entry.sources.map((source) => source.title),
    entry.notices.map((notice) => `${notice.source} ${notice.notice}`));
  const status = entry.verified
    ? `<p class="status verified">Radulator source audit: verified against the primary source on ${escapeHtml(formatDate(entry.lastVerified) || entry.lastVerified)}.</p>`
    : `<p class="status pending">Radulator source audit: pending. The guideline and version are recorded; the independent check against the primary source is in progress.</p>`;
  const sources = entry.sources.length
    ? `<ul class="sources">${entry.sources.map((source) => {
      const title = escapeHtml(source.title || "Source");
      const linked = source.url
        ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${title}</a>`
        : title;
      const authority = source.authority ? ` <span class="authority">${escapeHtml(source.authority)}</span>` : "";
      return `<li><span class="role">${escapeHtml(source.role)}</span> ${linked}${authority}</li>`;
    }).join("")}</ul>`
    : `<p class="no-sources">No external guideline source: this tool is not guideline-based.</p>`;
  const notices = entry.notices.map((notice) => {
    const label = notice.type === "erratum" ? "Correction published" : notice.type === "retraction" ? "Retraction"
      : notice.type === "update" ? "Newer version published" : "Notice";
    const url = safeUrl(notice.url);
    const what = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(notice.notice)}</a>`
      : escapeHtml(notice.notice);
    const review = notice.impact === "under-review"
      ? `Radulator is checking whether it affects this calculator (since ${escapeHtml(formatDate(notice.first_seen))}).`
      : notice.impact === "no-change"
        ? "Reviewed: it does not change this calculator."
        : notice.impact === "changes-calculator"
          ? "Reviewed: the calculator was updated for it."
          : "";
    return `<p class="notice ${escapeHtml(notice.impact || "")}"><strong>${label}</strong> to ${escapeHtml(notice.source)}: ${what}. ${review}</p>`;
  }).join("");
  return `<article class="card" id="${escapeHtml(entry.id)}" data-gf-card data-gf-category="${escapeHtml(entry.category)}" data-gf-text="${escapeHtml(text)}">
      <h3><a href="/#/${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</a></h3>
      ${entry.desc ? `<p class="desc">${escapeHtml(entry.desc)}</p>` : ""}
      <p class="version">Guideline: <strong>${escapeHtml(entry.version)}</strong></p>
      ${notices}${sources}
      ${status}
    </article>`;
}

export function renderGuidelineFinder(model) {
  const csp = `default-src 'self'; script-src '${scriptHash()}'; style-src 'unsafe-inline'; img-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none';`; // frame-ancestors needs an HTTP header; browsers ignore it in <meta>
  const options = model.groups.map((group) =>
    `<option value="${escapeHtml(group.category)}">${escapeHtml(group.category)}</option>`).join("");
  const groups = model.groups.map((group) => `<section class="group" data-gf-group>
    <h2>${escapeHtml(group.category)}</h2>
    ${group.entries.map(renderEntry).join("\n    ")}
  </section>`).join("\n  ");
  const lastCheck = model.lastCheck ? formatDate(model.lastCheck) : "not yet run";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <title>Guideline Finder - Radulator</title>
  <meta name="description" content="Every guideline and version behind Radulator's calculators, with links to the official sources and notices about corrections, retractions and updates.">
  <link rel="canonical" href="https://radulator.com/guidelines.html">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.55; max-width: 880px; margin: 0 auto; padding: 2rem 1rem; color: #333; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.5rem; }
    h2 { color: #333; margin-top: 2rem; font-size: 1.25rem; }
    h3 { margin: 0 0 0.25rem; font-size: 1.05rem; }
    a { color: #2563eb; }
    .back-link { margin-bottom: 1.5rem; display: inline-block; }
    .highlight { background: #eff6ff; border: 1px solid #3b82f6; padding: 0.9rem 1rem; border-radius: 0.5rem; margin: 1rem 0; }
    .summary { color: #475569; font-size: 0.95rem; }
    .gf-controls { display: none; gap: 0.75rem; flex-wrap: wrap; margin: 1.25rem 0 0.5rem; }
    .gf-js .gf-controls { display: flex; }
    .gf-controls input, .gf-controls select { font: inherit; padding: 0.5rem 0.65rem; border: 1px solid #cbd5e1; border-radius: 0.4rem; }
    .gf-controls input { flex: 1 1 18rem; }
    #gf-count { color: #64748b; font-size: 0.9rem; min-height: 1.3em; }
    .card { border: 1px solid #e2e8f0; border-radius: 0.6rem; padding: 0.9rem 1rem; margin: 0.75rem 0; background: #fff; }
    .card[hidden], .group[hidden] { display: none; }
    .desc { margin: 0 0 0.3rem; color: #475569; font-size: 0.93rem; }
    .version { margin: 0 0 0.4rem; }
    .sources { margin: 0.4rem 0; padding-left: 1.1rem; font-size: 0.93rem; }
    .sources li { margin: 0.2rem 0; }
    .role { display: inline-block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; color: #475569; background: #f1f5f9; border-radius: 0.25rem; padding: 0 0.35rem; margin-right: 0.3rem; }
    .authority { color: #64748b; }
    .status { font-size: 0.88rem; margin: 0.4rem 0 0; }
    .status.verified { color: #166534; }
    .status.pending { color: #64748b; }
    .notice { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 0.45rem 0.7rem; font-size: 0.92rem; margin: 0.4rem 0; }
    .notice.no-change { background: #f0fdf4; border-left-color: #22c55e; }
    .no-sources { color: #64748b; font-size: 0.92rem; }
    footer { margin-top: 2.5rem; color: #64748b; font-size: 0.88rem; border-top: 1px solid #e5e5e5; padding-top: 1rem; }
  </style>
</head>
<body>
  <a href="/" class="back-link">&larr; Back to Radulator</a>
  <h1>Guideline Finder</h1>
  <p>Every guideline and version behind Radulator's ${model.total} calculators, with links to the official source. Radulator links to guideline content and does not reproduce it: always confirm against the official source and your local protocol.</p>
  <div class="highlight"><strong>Kept current:</strong> ${escapeHtml(model.method)} <strong>Last check: ${escapeHtml(lastCheck)}.</strong></div>
  <p class="summary">${model.total} calculators · ${model.withOfficialLinks} with official source links · ${model.underReview} with a published correction or update under review.</p>
  <div class="gf-controls" role="search">
    <label for="gf-search" class="sr-only" hidden>Search guidelines</label>
    <input id="gf-search" type="search" placeholder="Search a calculator, guideline, society or topic" aria-label="Search guidelines" autocomplete="off">
    <select id="gf-category" aria-label="Filter by specialty"><option value="">All specialties</option>${options}</select>
  </div>
  <p id="gf-count" aria-live="polite"></p>
  ${groups}
  <footer>This page is generated from Radulator's guideline registry and reviewed notices. Radulator is an educational tool and not a substitute for clinical judgment. <a href="/about.html">About</a> · <a href="/privacy.html">Privacy</a></footer>
  <script>${SCRIPT}</script>
</body>
</html>
`;
}

export function generate(root = ROOT) {
  const registry = JSON.parse(readFileSync(join(root, PATHS.registry), "utf8"));
  const notices = JSON.parse(readFileSync(join(root, PATHS.notices), "utf8"));
  return renderGuidelineFinder(buildModel({ calculators: readCalculators(root), registry, notices }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = generate();
  const target = join(ROOT, PATHS.output);
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(target, "utf8");
    } catch {
      current = "";
    }
    if (current !== html) {
      console.error(`${PATHS.output} is stale: run node scripts/generate-guideline-finder.mjs`);
      process.exit(1);
    }
    console.log(`${PATHS.output} is current`);
  } else {
    writeFileSync(target, html);
    console.log(`wrote ${PATHS.output}`);
  }
}
