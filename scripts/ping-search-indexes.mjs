#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_SITE_URL = "https://radulator.com";
const DEFAULT_INDEXNOW_KEY = "676f4f3d55b393fc8961a1bc934725597854671c6688488a0d73c834e5c8b8a0";
const REQUEST_TIMEOUT_MS = 15_000;

const INDEXNOW_ENDPOINTS = [
  ["IndexNow generic", "https://api.indexnow.org/indexnow"],
  ["Bing IndexNow", "https://www.bing.com/indexnow"],
];

const SITEMAP_PING_ENDPOINTS = [
  ["Google sitemap ping", "https://www.google.com/ping"],
  ["Bing sitemap ping", "https://www.bing.com/ping"],
];

function parseArgs(argv) {
  const args = {
    dryRun: false,
    strict: false,
    dist: "dist",
    maxUrls: 10_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--strict") args.strict = true;
    else if (arg === "--dist") args.dist = argv[++index];
    else if (arg === "--site-url") args.siteUrl = argv[++index];
    else if (arg === "--sitemap-url") args.sitemapUrl = argv[++index];
    else if (arg === "--key") args.key = argv[++index];
    else if (arg === "--key-location") args.keyLocation = argv[++index];
    else if (arg === "--max-urls") args.maxUrls = Number.parseInt(argv[++index], 10);
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/ping-search-indexes.mjs [options]

Pings search-indexing endpoints after a Radulator deploy. By default the script
is best-effort and exits 0 even if an external endpoint rejects a ping; pass
--strict to make endpoint failures fail the command.

Options:
  --dry-run              Print the exact requests without sending them.
  --strict               Exit non-zero when any external ping fails.
  --dist <path>          Build output directory to read sitemap.xml from (default: dist).
  --site-url <url>       Site origin (default/env RADULATOR_SITE_URL or https://radulator.com).
  --sitemap-url <url>    Sitemap URL (default/env RADULATOR_SITEMAP_URL or <site>/sitemap.xml).
  --key <key>            IndexNow key (default/env INDEXNOW_KEY or committed public key).
  --key-location <url>   IndexNow key-location URL (default/env INDEXNOW_KEY_LOCATION or <site>/<key>.txt).
  --max-urls <n>         Maximum sitemap URLs to submit to IndexNow (default: 10000).
`);
}

function normalizeSiteUrl(value) {
  const url = new URL(value || DEFAULT_SITE_URL);
  return url.origin;
}

function cleanXmlText(value) {
  return value
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => cleanXmlText(match[1]))
    .filter(Boolean);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}: ${text.slice(0, 200)}`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadSitemapXml(dist, sitemapUrl, dryRun) {
  const localSitemap = path.join(dist, "sitemap.xml");
  if (existsSync(localSitemap)) {
    console.log(`✓ Loaded local sitemap: ${localSitemap}`);
    return readFileSync(localSitemap, "utf8");
  }

  if (dryRun) {
    console.log(`ℹ Local sitemap not found at ${localSitemap}; dry-run will use ${sitemapUrl} without fetching.`);
    return "";
  }

  console.log(`ℹ Local sitemap not found at ${localSitemap}; fetching live sitemap ${sitemapUrl}`);
  return fetchText(sitemapUrl);
}

async function requestWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function pingIndexNow({ endpointName, endpointUrl, host, key, keyLocation, urlList, dryRun }) {
  const payload = { host, key, keyLocation, urlList };
  if (dryRun) {
    console.log(
      `[DRY-RUN] ${endpointName}: POST ${endpointUrl} (${urlList.length} URLs, keyLocation=${keyLocation})`,
    );
    return true;
  }

  let result;
  try {
    result = await requestWithTimeout(endpointUrl, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.log(`⚠ ${endpointName}: ${error.message}`);
    return false;
  }
  const prefix = result.ok ? "✓" : "⚠";
  console.log(`${prefix} ${endpointName}: HTTP ${result.status}`);
  if (!result.ok && result.body) console.log(`  ${result.body.slice(0, 300)}`);
  return result.ok;
}

async function pingSitemap({ endpointName, endpointUrl, sitemapUrl, dryRun }) {
  const url = `${endpointUrl}?sitemap=${encodeURIComponent(sitemapUrl)}`;
  if (dryRun) {
    console.log(`[DRY-RUN] ${endpointName}: GET ${url}`);
    return true;
  }

  let result;
  try {
    result = await requestWithTimeout(url);
  } catch (error) {
    console.log(`⚠ ${endpointName}: ${error.message}`);
    return false;
  }
  const prefix = result.ok ? "✓" : "⚠";
  console.log(`${prefix} ${endpointName}: HTTP ${result.status}`);
  if (!result.ok && result.body) console.log(`  ${result.body.slice(0, 300)}`);
  return result.ok;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const siteUrl = normalizeSiteUrl(args.siteUrl || process.env.RADULATOR_SITE_URL || DEFAULT_SITE_URL);
  const host = new URL(siteUrl).host;
  const sitemapUrl = args.sitemapUrl || process.env.RADULATOR_SITEMAP_URL || `${siteUrl}/sitemap.xml`;
  const key = args.key || process.env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
  const keyLocation = args.keyLocation || process.env.INDEXNOW_KEY_LOCATION || `${siteUrl}/${key}.txt`;

  let sitemapXml = "";
  try {
    sitemapXml = await loadSitemapXml(args.dist, sitemapUrl, args.dryRun);
  } catch (error) {
    console.log(`⚠ Could not load sitemap URLs for IndexNow: ${error.message}`);
    if (args.strict) throw error;
  }
  const sitemapUrls = extractSitemapUrls(sitemapXml);
  const indexNowUrls = (sitemapUrls.length ? sitemapUrls : [siteUrl]).slice(0, args.maxUrls);

  console.log(
    `Search index ping plan: site=${siteUrl}; sitemap=${sitemapUrl}; sitemapUrls=${sitemapUrls.length}; indexNowUrls=${indexNowUrls.length}`,
  );

  const outcomes = [];
  for (const [endpointName, endpointUrl] of INDEXNOW_ENDPOINTS) {
    outcomes.push(
      await pingIndexNow({ endpointName, endpointUrl, host, key, keyLocation, urlList: indexNowUrls, dryRun: args.dryRun }),
    );
  }

  for (const [endpointName, endpointUrl] of SITEMAP_PING_ENDPOINTS) {
    outcomes.push(await pingSitemap({ endpointName, endpointUrl, sitemapUrl, dryRun: args.dryRun }));
  }

  const failed = outcomes.filter((ok) => !ok).length;
  if (failed > 0) {
    console.log(
      `Search index ping completed with ${failed} failed endpoint(s). This command is best-effort unless --strict is set.`,
    );
  } else {
    console.log("✓ Search index ping completed successfully.");
  }

  if (args.strict && failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Search index ping failed: ${error.message}`);
  process.exitCode = 1;
});
