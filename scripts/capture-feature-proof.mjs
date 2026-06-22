#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = { expectText: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--expect-text") {
      if (!next) throw new Error("--expect-text requires a value");
      args.expectText.push(next);
      index += 1;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        index += 1;
      }
    }
  }
  return args;
}

function slugify(value) {
  return String(value || "feature-proof")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "feature-proof";
}

function joinUrl(baseUrl, route) {
  const base = baseUrl.replace(/\/$/, "");
  if (!route || route === "/") return `${base}/`;
  if (route.startsWith("/#")) return `${base}${route}`;
  if (route.startsWith("#")) return `${base}/${route}`;
  if (route.startsWith("/")) return `${base}${route}`;
  return `${base}/${route}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.url || process.env.RADULATOR_BASE_URL || "http://127.0.0.1:5173";
  const route = args.route || "/";
  const name = slugify(args.name || route);
  const outputDir = path.resolve(args.outputDir || "test-results/feature-proof");
  const targetUrl = joinUrl(baseUrl, route);
  const viewport = args.viewport === "mobile" ? { width: 390, height: 844 } : { width: 1280, height: 900 };

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  let title = "";
  let bodyText = "";
  const missingTexts = [];
  const screenshotPath = path.join(outputDir, `${name}.png`);
  try {
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30_000 });
    title = await page.title();
    bodyText = await page.locator("body").innerText({ timeout: 10_000 });
    for (const expected of args.expectText) {
      if (!bodyText.includes(expected)) missingTexts.push(expected);
    }
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } finally {
    await browser.close();
  }

  const consoleErrors = consoleMessages.filter(
    (message) =>
      message.type === "error" &&
      !message.text.includes("Content Security Policy directive 'frame-ancestors' is ignored"),
  );
  const ok = pageErrors.length === 0 && consoleErrors.length === 0 && missingTexts.length === 0 && bodyText.trim().length > 0;
  const proof = {
    ok,
    targetUrl,
    route,
    viewport,
    title,
    expectedTexts: args.expectText,
    missingTexts,
    pageErrors,
    consoleErrors,
    consoleMessageCount: consoleMessages.length,
    screenshotPath,
    generatedAt: new Date().toISOString(),
  };

  const jsonPath = path.join(outputDir, `${name}.json`);
  const markdownPath = path.join(outputDir, `${name}.md`);
  await writeFile(jsonPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  await writeFile(
    markdownPath,
    [
      `# Feature proof: ${name}`,
      "",
      `- Verdict: ${ok ? "PASS" : "FAIL"}`,
      `- URL: ${targetUrl}`,
      `- Viewport: ${viewport.width}x${viewport.height}`,
      `- Title: ${title || "(empty)"}`,
      `- Screenshot: ${screenshotPath}`,
      `- JSON: ${jsonPath}`,
      `- Page errors: ${pageErrors.length}`,
      `- Console errors: ${consoleErrors.length}`,
      missingTexts.length ? `- Missing expected text: ${missingTexts.join(", ")}` : "- Missing expected text: none",
      "",
      "This deterministic proof complements, but does not replace, fresh read-only verifier/vibe review for UI/product PRs.",
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(JSON.stringify(proof, null, 2));
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
