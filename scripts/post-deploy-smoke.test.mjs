#!/usr/bin/env node
import assert from "node:assert/strict";
import http from "node:http";

import { smokeSite } from "./post-deploy-smoke.mjs";

async function withServer(routes, test) {
  const server = http.createServer((request, response) => {
    const route = routes[request.url] || { status: 404, body: "not found" };
    response.writeHead(route.status, { "content-type": route.type || "text/html; charset=utf-8" });
    response.end(route.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await test(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

await withServer({
  "/": { status: 200, body: "<title>Radulator | Medical Calculators</title>" },
  "/calculators/meld-na/": { status: 200, body: "<title>MELD-Na Score Calculator | Radulator</title>" },
  "/sitemap.xml": { status: 200, type: "application/xml", body: "<loc>https://radulator.com/calculators/meld-na/</loc>" },
}, async (site) => {
  const result = await smokeSite(site, { attempts: 1, delayMs: 0 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.checks.map((check) => check.name), ["home", "known-calculator", "sitemap"]);
  assert.equal(result.checks.every((check) => check.status === 200 && check.sha256.length === 64), true);
});

await withServer({
  "/": { status: 200, body: "not the expected site" },
  "/calculators/meld-na/": { status: 200, body: "MELD-Na Score Calculator | Radulator" },
  "/sitemap.xml": { status: 200, body: "meld-na" },
}, async (site) => {
  const result = await smokeSite(site, { attempts: 1, delayMs: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "CONTENT_MISMATCH");
  assert.equal(result.failedCheck, "home");
});

await withServer({
  "/": { status: 200, body: "Radulator" },
  "/calculators/meld-na/": { status: 503, body: "unavailable" },
  "/sitemap.xml": { status: 200, body: "meld-na" },
}, async (site) => {
  const result = await smokeSite(site, { attempts: 1, delayMs: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "HTTP_FAILURE");
  assert.equal(result.failedCheck, "known-calculator");
});

console.log("post-deployment smoke tests passed");
