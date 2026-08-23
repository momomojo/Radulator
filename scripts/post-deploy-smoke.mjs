#!/usr/bin/env node
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CHECKS = [
  { name: "home", path: "/", expected: /Radulator/i },
  { name: "known-calculator", path: "/calculators/meld-na/", expected: /MELD-Na Score Calculator/i },
  { name: "sitemap", path: "/sitemap.xml", expected: /\/calculators\/meld-na\//i },
];

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function smokeAttempt(baseUrl, fetchImpl) {
  const checks = [];
  for (const check of CHECKS) {
    const url = new URL(check.path, `${baseUrl}/`).toString();
    let response;
    let body;
    try {
      response = await fetchImpl(url, { redirect: "follow", headers: { "user-agent": "radulator-post-deploy-smoke/v1" } });
      body = await response.text();
    } catch (error) {
      return {
        ok: false,
        reasonCode: "NETWORK_FAILURE",
        failedCheck: check.name,
        summary: `${check.name} request failed: ${error.message}`,
        checks,
      };
    }
    const evidence = { name: check.name, url, status: response.status, sha256: sha256(body) };
    checks.push(evidence);
    if (!response.ok) {
      return {
        ok: false,
        reasonCode: "HTTP_FAILURE",
        failedCheck: check.name,
        summary: `${check.name} returned HTTP ${response.status}.`,
        checks,
      };
    }
    if (!check.expected.test(body)) {
      return {
        ok: false,
        reasonCode: "CONTENT_MISMATCH",
        failedCheck: check.name,
        summary: `${check.name} did not contain its immutable release marker.`,
        checks,
      };
    }
  }
  return { ok: true, reasonCode: "SMOKE_PASS", summary: "Production home, known calculator, and sitemap passed.", checks };
}

export async function smokeSite(baseUrl, { fetchImpl = fetch, attempts = 6, delayMs = 10_000 } = {}) {
  if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error("attempts must be a positive integer.");
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error("delayMs must be non-negative.");
  const normalized = `${baseUrl || ""}`.replace(/\/+$/, "");
  const parsed = new URL(normalized);
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) throw new Error("baseUrl must use HTTP or HTTPS.");

  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await smokeAttempt(normalized, fetchImpl);
    result.attempt = attempt;
    if (result.ok) break;
    if (attempt < attempts && delayMs) await wait(delayMs);
  }
  return {
    ...result,
    baseUrl: normalized,
    attemptsConfigured: attempts,
    verifiedAt: new Date().toISOString(),
  };
}

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

async function run() {
  const baseUrl = argument("--base-url", "https://radulator.com");
  const attempts = Number(argument("--attempts", "6"));
  const delayMs = Number(argument("--delay-ms", "10000"));
  const output = argument("--output");
  const result = await smokeSite(baseUrl, { attempts, delayMs });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (output) await writeFile(output, serialized, "utf8");
  console.log(serialized.trimEnd());
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
