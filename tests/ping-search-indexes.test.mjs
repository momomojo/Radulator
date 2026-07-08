#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const script = path.join(root, "scripts", "ping-search-indexes.mjs");
const tmp = mkdtempSync(path.join(tmpdir(), "radulator-index-ping-"));

try {
  const dist = path.join(tmp, "dist");
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    path.join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://radulator.com/</loc></url>
  <url><loc>https://radulator.com/calculators/tirads/</loc></url>
</urlset>
`,
  );

  const result = spawnSync(
    process.execPath,
    [script, "--dry-run", "--dist", dist, "--site-url", "https://radulator.com", "--sitemap-url", "https://radulator.com/sitemap.xml"],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /sitemapUrls=2; indexNowUrls=2/);
  assert.match(result.stdout, /\[DRY-RUN\] IndexNow generic: POST https:\/\/api\.indexnow\.org\/indexnow/);
  assert.match(result.stdout, /\[DRY-RUN\] Bing IndexNow: POST https:\/\/www\.bing\.com\/indexnow/);
  assert.match(result.stdout, /\[DRY-RUN\] Google sitemap ping: GET https:\/\/www\.google\.com\/ping\?sitemap=/);
  assert.match(result.stdout, /\[DRY-RUN\] Bing sitemap ping: GET https:\/\/www\.bing\.com\/ping\?sitemap=/);
} finally {
  rmSync(tmp, { force: true, recursive: true });
}

console.log("ping-search-indexes dry-run tests passed");
