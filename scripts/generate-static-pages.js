#!/usr/bin/env node
/**
 * Static Calculator Pages Generator
 *
 * Reads calculator metadata from source files, generates individual
 * `/calculators/<id>/index.html` pages for each calculator so Google
 * can index them as separate pages.
 *
 * Runs as a Vite plugin (closeBundle hook) after the production build.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CALC_DIR = join(__dirname, "..", "src", "components", "calculators");
const DIST = join(__dirname, "..", "dist");

// Calculator metadata map — extracted lazily
const CALC_META_CACHE = {};

function extractCalcMeta() {
  if (Object.keys(CALC_META_CACHE).length > 0) return CALC_META_CACHE;

  const files = readdirSync(CALC_DIR).filter(
    (f) => f.endsWith(".jsx") && !f.includes("index") && !f.includes("registry") && !f.includes("Feedback")
  );

  for (const file of files) {
    const raw = readFileSync(join(CALC_DIR, file), "utf8");
    // Anchor at the exported calc def — first-match grabbed a device-database
    // entry in KhouryCatheterSelector.jsx and shipped a wrong-identity static
    // page (scepter-c, 2026-06-10).
    const anchor = raw.search(/export\s+(default|const\s+\w+\s*=)\s*{/);
    const content = anchor >= 0 ? raw.slice(anchor) : raw;
    const id = content.match(/id:\s*"([^"]+)"/)?.[1];
    if (!id) continue;

    CALC_META_CACHE[id] = {
      id,
      name: content.match(/name:\s*"([^"]+)"/)?.[1] || id,
      desc: content.match(/desc:\s*"([^"]+)"/)?.[1] || "",
      metaDesc: content.match(/metaDesc:\s*"([^"]+)"/)?.[1] || null,
      category: content.match(/category:\s*"([^"]+)"/)?.[1] || "Other",
      tags: (content.match(/tags:\s*\[([^\]]+)\]/)?.[1] || "")
        .split(",").map((t) => t.trim().replace(/"/g, "")).filter(Boolean),
      guidelineVersion: content.match(/guidelineVersion:\s*"([^"]+)"/)?.[1] || null,
      refs: extractRefs(content),
    };
  }

  return CALC_META_CACHE;
}

function extractRefs(content) {
  const refsBlock = content.match(/refs:\s*\[([\s\S]*?)\n\s*\]/)?.[1] || "";
  const refs = [];
  const refRe = /\{\s*t:\s*"([^"]+)"\s*,\s*u:\s*"([^"]+)"/g;
  let match;

  while ((match = refRe.exec(refsBlock)) !== null) {
    refs.push({ t: match[1], u: match[2] });
  }

  return refs;
}

function buildMetaTags(calc) {
  const title = `${calc.name} Calculator | Radulator`;
  const description = calc.metaDesc || calc.desc || `Calculate ${calc.name} — free online medical calculator with peer-reviewed references.`;
  const url = `https://radulator.com/calculators/${calc.id}/`;
  const keywords = (calc.tags || []).concat([calc.category, "radiology calculator", "medical calculator"]).join(", ");
  const specialty = calc.category === "Other" ? "Radiology" : calc.category;
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://radulator.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: calc.category || "Calculators",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${calc.name} Calculator`,
        item: url,
      },
    ],
  };

  return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="${escapeHtml(keywords)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${url}" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="https://radulator.com/og-image.jpg" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:site_name" content="Radulator" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="https://radulator.com/og-image.jpg" />

    <!-- JSON-LD -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "${escapeHtml(calc.name)}",
      "url": "${url}",
      "description": "${escapeHtml(description)}",
      "applicationCategory": "HealthApplication",
      "operatingSystem": "Any",
      "browserRequirements": "Requires JavaScript",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
    }
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "MedicalWebPage",
      "name": "${escapeHtml(title)}",
      "url": "${url}",
      "description": "${escapeHtml(description)}",
      "specialty": ["${escapeHtml(specialty)}"],
      "audience": { "@type": "MedicalAudience", "audienceType": "Clinician" }
    }
    </script>
    ${jsonLdScript(breadcrumbLd)}`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeScriptJson(str) {
  return String(str)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function jsonLdScript(data) {
  return `<script type="application/ld+json">
    ${escapeScriptJson(JSON.stringify(data, null, 2))}
    </script>`;
}

function getCalculatorDescription(calc) {
  return calc.metaDesc || calc.desc || `Calculate ${calc.name} with Radulator.`;
}

function buildRelatedCalculators(calc, meta) {
  const tags = new Set(calc.tags || []);
  const candidates = Object.values(meta)
    .filter((other) => other.id !== calc.id)
    .map((other) => {
      const sharedTags = (other.tags || []).filter((tag) => tags.has(tag));
      const sameCategory = other.category === calc.category;
      return {
        calc: other,
        score: (sameCategory ? 100 : 0) + sharedTags.length * 10,
      };
    })
    .sort((a, b) => b.score - a.score || a.calc.name.localeCompare(b.calc.name));

  const selected = candidates.filter((candidate) => candidate.score > 0).slice(0, 5);

  for (const candidate of candidates) {
    if (selected.length >= 3) break;
    if (!selected.some((item) => item.calc.id === candidate.calc.id)) {
      selected.push(candidate);
    }
  }

  return selected.slice(0, 5).map(({ calc: related }) => ({
    id: related.id,
    name: related.name,
    category: related.category,
  }));
}

function buildStaticPageData(calc, related) {
  return {
    id: calc.id,
    name: calc.name,
    title: `${calc.name} Calculator`,
    description: getCalculatorDescription(calc),
    category: calc.category || "Calculators",
    refs: calc.refs || [],
    related,
  };
}

function buildStaticCalculatorShell(data) {
  const refs = data.refs || [];
  const related = data.related || [];
  const refsHtml = refs.length > 0
    ? `<section aria-labelledby="static-references-heading" class="rounded-lg border border-border bg-muted/30 p-5"><h2 id="static-references-heading" class="text-lg font-semibold text-foreground">References</h2><ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">${refs.map((ref) => `<li><a href="${escapeHtml(ref.u)}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${escapeHtml(ref.t)}</a></li>`).join("")}</ol></section>`
    : "";
  const relatedHtml = related.length > 0
    ? `<section aria-labelledby="static-related-heading" class="rounded-lg border border-border bg-card p-5"><h2 id="static-related-heading" class="text-lg font-semibold text-foreground">Related calculators</h2><ul class="mt-3 grid gap-2 sm:grid-cols-2">${related.map((calc) => `<li><a href="/calculators/${escapeHtml(calc.id)}/" class="block rounded-md border border-border px-3 py-2 text-sm font-medium text-primary hover:bg-muted hover:underline">${escapeHtml(calc.name)}</a></li>`).join("")}</ul></section>`
    : "";

  return `<main id="main-content" data-testid="static-calculator-shell" aria-labelledby="static-calculator-heading" class="min-h-screen bg-background px-4 py-8 text-foreground md:px-8"><article class="mx-auto max-w-4xl space-y-8"><nav aria-label="Breadcrumb" class="text-sm text-muted-foreground"><ol class="flex flex-wrap items-center gap-2"><li><a href="/" class="hover:text-foreground hover:underline">Radulator</a></li><li aria-hidden="true">/</li><li>${escapeHtml(data.category)}</li><li aria-hidden="true">/</li><li aria-current="page" class="text-foreground">${escapeHtml(data.title)}</li></ol></nav><header class="space-y-3"><p class="text-sm font-medium uppercase tracking-wide text-primary">${escapeHtml(data.category)}</p><h1 id="static-calculator-heading" class="text-3xl font-bold tracking-normal text-foreground md:text-4xl">${escapeHtml(data.title)}</h1><p class="max-w-3xl text-base leading-7 text-muted-foreground">${escapeHtml(data.description)}</p></header>${refsHtml}${relatedHtml}</article></main>`;
}

function buildStaticRoot(data) {
  return `<div id="root" data-static-calculator="${escapeHtml(data.id)}">${buildStaticCalculatorShell(data)}</div><script>window.__RADULATOR_STATIC_PAGE__=${escapeScriptJson(JSON.stringify(data))};</script>`;
}

// The replaceable SEO block in index.html: spans the generic meta tags, OG/Twitter
// tags, and both generic JSON-LD scripts. Bounded by explicit markers so build-time
// transforms (e.g. the GA4 snippet injection, which consumes <!-- GA4_PLACEHOLDER -->
// when VITE_GA4_MEASUREMENT_ID is set) can never break the anchor. That exact
// breakage shipped 38 title-less pages canonicalized to the homepage on 2026-06-10.
const SEO_BLOCK_RE = /<!-- SEO Meta Tags -->[\s\S]*?<!-- \/SEO -->/;

function generateCalculatorPages() {
  const meta = extractCalcMeta();
  const ids = Object.keys(meta).sort();
  const BASE = DIST;

  // Read the built index.html as a template
  const mainHtml = readFileSync(join(BASE, "index.html"), "utf8");

  if (!SEO_BLOCK_RE.test(mainHtml)) {
    throw new Error(
      "generate-static-pages: SEO block markers (<!-- SEO Meta Tags --> ... <!-- /SEO -->) not found in dist/index.html — a build transform may have altered the template. Refusing to emit broken static pages."
    );
  }

  // For each calculator, generate /calculators/<id>/index.html
  for (const id of ids) {
    const calc = meta[id];
    const outDir = join(BASE, "calculators", id);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    // Bootstrap script: read path and set hash so SPA loads the right calculator
    const bootstrapScript = `
    <script>
      (function(){
        var path = window.location.pathname;
        var m = path.match(new RegExp("/calculators/([^/]+)/?"));
        if (m && m[1] !== window.location.hash.replace("#/", "")) {
          window.location.hash = "#/" + m[1];
        }
      })();
    </script>`;

    // Inject per-calculator meta tags and bootstrap. The template <title> sits
    // above the SEO block and is replaced by the block's per-calculator title.
    const staticData = buildStaticPageData(
      calc,
      buildRelatedCalculators(calc, meta)
    );

    let html = mainHtml
      .replace(/<title>[^<]*<\/title>/, "")
      .replace(SEO_BLOCK_RE, buildMetaTags(calc))
      .replace('<div id="root"></div>', buildStaticRoot(staticData))
      .replace("</head>", bootstrapScript + "\n  </head>");

    const canonical = `<link rel="canonical" href="https://radulator.com/calculators/${id}/" />`;
    if (
      !html.includes(canonical) ||
      !html.includes(`<title>`) ||
      !html.includes(`data-static-calculator="${id}"`)
    ) {
      throw new Error(
        `generate-static-pages: injection verification failed for "${id}" — per-calculator canonical/title/static body missing from output.`
      );
    }

    writeFileSync(join(outDir, "index.html"), html);
  }

  // Generate expanded sitemap with all calculator URLs
  generateSitemap(BASE, meta, ids);

  console.log(`✓ Generated ${ids.length} static calculator pages + sitemap`);
  return ids;
}

function generateSitemap(base, meta, ids) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `  <url>\n    <loc>https://radulator.com/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    `  <url>\n    <loc>https://radulator.com/about.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`,
    `  <url>\n    <loc>https://radulator.com/privacy.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.3</priority>\n  </url>`,
    `  <url>\n    <loc>https://radulator.com/terms.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.3</priority>\n  </url>`,
  ];

  for (const id of ids) {
    urls.push(`  <url>\n    <loc>https://radulator.com/calculators/${id}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  writeFileSync(join(base, "sitemap.xml"), sitemap);
}

// When run as a standalone script (not imported as a Vite plugin)
if (process.argv[1] && process.argv[1].includes("generate-static-pages")) {
  generateCalculatorPages();
}

// Vite plugin export
export default function staticCalculatorPages() {
  return {
    name: "static-calculator-pages",
    closeBundle() {
      // Let failures fail the build: silently shipping pages without their
      // per-calculator meta is strictly worse than a red deploy.
      generateCalculatorPages();
    },
  };
}
