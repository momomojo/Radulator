#!/usr/bin/env node
// Offline tests for scripts/lib/ncbi-fetch.mjs. Nothing touches the network: every request goes to
// an injected fetch, and sleep, the clock and the jitter source are injected, so the run is
// deterministic. Smoke runs this file (scripts/lib/*.test.mjs).
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  API_KEY_HOSTS,
  BACKOFF_MS,
  JITTER_MS,
  KEYED_SPACING_MS,
  MAX_ATTEMPTS,
  NCBI_HOSTS,
  NcbiFetchError,
  RETRY_AFTER_CAP_MS,
  SPACING_MS,
  createRateGate,
  fetchPinned,
  isRetryableStatus,
  parseRetryAfter,
  pinnedQueryMatches,
  redact,
  requestUrlFor,
  retryDelayMs,
  sha256,
  stripApiKey,
} from "./ncbi-fetch.mjs";

// A made-up key: 36 characters, like a real NCBI key, and never a real one.
const KEY = "f0e1d2c3b4a5968778695a4b3c2d1e0f9a8b";
const EUTILS_URL =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=12345&rettype=abstract&retmode=text";
const PMC_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC12345/";
const BIOC_URL = "https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json/PMC12345/unicode";
const BODY = Buffer.from(`${"Pinned artifact line.\n".repeat(120)}`, "utf8");
const PIN = Object.freeze({ bytes: BODY.length, sha256: sha256(BODY) });
const START = Date.UTC(2026, 8, 28, 12, 0, 0);

const scratch = mkdtempSync(path.join(os.tmpdir(), "ncbi-fetch-test-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

// A fetch Response double with a readable stream that counts cancellations.
function makeResponse({
  status = 200,
  body = BODY,
  url = EUTILS_URL,
  contentType = "text/plain; charset=UTF-8",
  headers = {},
  redirected = false,
  chunkSize = 512,
} = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  const stats = { cancelled: 0, delivered: 0 };
  let offset = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(new Uint8Array(bytes.subarray(offset, end)));
      offset = end;
      stats.delivered = end;
    },
    cancel() {
      stats.cancelled += 1;
    },
  });
  return { status, url, redirected, headers: new Headers({ "content-type": contentType, ...headers }), body: stream, stats };
}

// Plays the steps in order (the last one repeats). A step is an Error to throw or a function that
// returns a fresh response.
function scripted(steps) {
  const calls = [];
  const responses = [];
  const fetchImpl = async (url, options) => {
    const step = steps[Math.min(calls.length, steps.length - 1)];
    calls.push({ url, options });
    if (step instanceof Error) throw step;
    const response = step(url, options);
    responses.push(response);
    return response;
  };
  return { fetchImpl, calls, responses };
}

function fakeClock(start = START) {
  const state = { time: start, sleeps: [] };
  return {
    state,
    now: () => state.time,
    sleep: async (milliseconds) => {
      state.sleeps.push(milliseconds);
      state.time += milliseconds;
    },
  };
}

function options(overrides = {}) {
  const clock = overrides.clock ?? fakeClock();
  const { clock: _clock, ...rest } = overrides;
  return { url: EUTILS_URL, label: "Test artifact", pin: PIN, sleep: clock.sleep, now: clock.now, ...rest };
}

let passed = 0;
async function check(name, body) {
  try {
    await body();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
  passed += 1;
}

async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("expected a rejection");
}

// ---- Retry policy --------------------------------------------------------------------------------

await check("a pinned artifact is returned from the first response", async () => {
  const clock = fakeClock();
  const { fetchImpl, calls } = scripted([() => makeResponse()]);
  const result = await fetchPinned(options({ clock, fetchImpl }));
  assert.ok(result.bytes.equals(BODY));
  assert.equal(result.provenance, "live");
  assert.equal(result.attempts, 1);
  assert.equal(result.finalUrl, EUTILS_URL);
  assert.equal(calls.length, 1);
  assert.deepEqual(clock.state.sleeps, []);
  assert.equal(calls[0].options.redirect, "follow");
  assert.ok(calls[0].options.signal instanceof AbortSignal, "every request has a timeout signal");
});

await check("429 honours Retry-After in seconds, as a date, and clamps it to 30 s", async () => {
  for (const [retryAfter, expected] of [
    ["5", 5_000],
    [new Date(START + 7_000).toUTCString(), 7_000],
    ["120", RETRY_AFTER_CAP_MS],
    ["0", BACKOFF_MS[0]],
    ["soon", BACKOFF_MS[0]],
  ]) {
    const clock = fakeClock();
    const { fetchImpl, calls } = scripted([
      () => makeResponse({ status: 429, body: "slow down", headers: { "retry-after": retryAfter } }),
      () => makeResponse(),
    ]);
    const result = await fetchPinned(options({ clock, fetchImpl }));
    assert.equal(result.attempts, 2);
    assert.equal(calls.length, 2);
    assert.deepEqual(clock.state.sleeps, [expected], `Retry-After ${retryAfter}`);
  }
  assert.equal(parseRetryAfter("2.5", START), 2_500);
  assert.equal(parseRetryAfter(new Date(START - 5_000).toUTCString(), START), 0);
  assert.equal(parseRetryAfter("", START), null);
  assert.equal(retryDelayMs(4, 12_000), 12_000);
  assert.equal(retryDelayMs(4, null), 8_000);
});

await check("5xx is retried on 1, 2, 4 and 8 s and fails loudly after 5 attempts", async () => {
  const clock = fakeClock();
  const { fetchImpl, calls, responses } = scripted([() => makeResponse({ status: 503, body: "busy" })]);
  const error = await rejection(fetchPinned(options({ clock, fetchImpl })));
  assert.ok(error instanceof NcbiFetchError);
  assert.equal(error.code, "transport");
  assert.equal(error.attempts, MAX_ATTEMPTS);
  assert.match(error.message, /^Test artifact retrieval failed after 5 of 5 attempts \(HTTP 503\)$/);
  assert.equal(calls.length, 5);
  assert.deepEqual(clock.state.sleeps, [1_000, 2_000, 4_000, 8_000]);
  assert.ok(responses.every((response) => response.stats.cancelled === 1), "every refused body is cancelled");
});

await check("network errors, timeouts and 408/425/5xx are transient; 501 and 505 are not", async () => {
  const reset = new TypeError("fetch failed", { cause: new Error("read ECONNRESET") });
  const clock = fakeClock();
  const { fetchImpl, calls } = scripted([reset, () => makeResponse()]);
  const result = await fetchPinned(options({ clock, fetchImpl }));
  assert.equal(result.attempts, 2);
  assert.equal(calls.length, 2);
  assert.deepEqual(clock.state.sleeps, [1_000]);
  for (const status of [408, 425, 429, 500, 502, 503, 504, 599]) assert.equal(isRetryableStatus(status, "pmc.ncbi.nlm.nih.gov"), true, `${status}`);
  for (const status of [301, 302, 401, 403, 404, 410, 501, 505]) assert.equal(isRetryableStatus(status, "eutils.ncbi.nlm.nih.gov"), false, `${status}`);
  const exhausted = await rejection(fetchPinned(options({ fetchImpl: scripted([reset]).fetchImpl })));
  assert.match(exhausted.message, /after 5 of 5 attempts \(fetch failed \(read ECONNRESET\)\)/);
});

await check("an E-utilities 400 is transient; a 400 from any other NCBI host is terminal", async () => {
  const eutils = scripted([() => makeResponse({ status: 400, body: "busy" }), () => makeResponse()]);
  assert.equal((await fetchPinned(options({ fetchImpl: eutils.fetchImpl }))).attempts, 2);
  assert.equal(eutils.calls.length, 2);
  const clock = fakeClock();
  const pmc = scripted([() => makeResponse({ status: 400, url: PMC_URL, body: "bad" })]);
  const error = await rejection(fetchPinned(options({ clock, url: PMC_URL, fetchImpl: pmc.fetchImpl })));
  assert.equal(error.code, "http");
  assert.equal(error.status, 400);
  assert.match(error.message, /^Test artifact retrieval failed after 1 of 5 attempts \(HTTP 400\)$/);
  assert.equal(pmc.calls.length, 1);
  assert.deepEqual(clock.state.sleeps, []);
  assert.equal(pmc.responses[0].stats.cancelled, 1);
});

await check("a terminal status such as 404 fails at once", async () => {
  const clock = fakeClock();
  const { fetchImpl, calls } = scripted([() => makeResponse({ status: 404, body: "gone" })]);
  const error = await rejection(fetchPinned(options({ clock, fetchImpl })));
  assert.equal(error.code, "http");
  assert.match(error.message, /after 1 of 5 attempts \(HTTP 404\)/);
  assert.equal(calls.length, 1);
  assert.deepEqual(clock.state.sleeps, []);
});

await check("a 200 that is not the expected artifact (URL, media type) is retried", async () => {
  const clock = fakeClock();
  const { fetchImpl, calls, responses } = scripted([
    () => makeResponse({ contentType: "text/html" }),
    () => makeResponse({ url: `${EUTILS_URL}&unexpected=1` }),
    () => makeResponse(),
  ]);
  const checkResponse = (response) => {
    assert.ok(pinnedQueryMatches(response.url, EUTILS_URL), `unexpected final URL ${response.url}`);
    assert.match(response.headers.get("content-type"), /^text\/plain\b/, "unexpected media type");
  };
  const result = await fetchPinned(options({ clock, fetchImpl, checkResponse }));
  assert.equal(result.attempts, 3);
  assert.equal(calls.length, 3);
  assert.deepEqual(clock.state.sleeps, [1_000, 2_000]);
  assert.deepEqual(responses.map((response) => response.stats.cancelled), [1, 1, 0]);
  const error = await rejection(fetchPinned(options({
    fetchImpl: scripted([() => makeResponse({ contentType: "text/html" })]).fetchImpl,
    checkResponse,
  })));
  assert.match(error.message, /after 5 of 5 attempts \(unexpected media type/);
});

// ---- Challenge pages -----------------------------------------------------------------------------

await check("an unexpectedly small 200 is a challenge page and is retried", async () => {
  const clock = fakeClock();
  const challenge = "<html><title>Preparing to download...</title></html>";
  const { fetchImpl, calls } = scripted([() => makeResponse({ body: challenge }), () => makeResponse()]);
  const result = await fetchPinned(options({ clock, fetchImpl }));
  assert.equal(result.attempts, 2);
  assert.equal(calls.length, 2);
  assert.deepEqual(clock.state.sleeps, [1_000]);
  const error = await rejection(fetchPinned(options({ fetchImpl: scripted([() => makeResponse({ body: challenge })]).fetchImpl })));
  assert.equal(error.code, "transport");
  assert.match(error.message, /after 5 of 5 attempts \(Test artifact response is unexpectedly small \(\d+ bytes; likely a challenge page\)\)/);
  // The default floor is half the pinned length, so a byte-length drift is never taken for a challenge.
  const floor = Math.floor(PIN.bytes / 2);
  const atFloor = scripted([() => makeResponse({ body: BODY.subarray(0, floor) })]);
  const drift = await rejection(fetchPinned(options({ fetchImpl: atFloor.fetchImpl })));
  assert.equal(drift.code, "drift");
  assert.equal(atFloor.calls.length, 1);
});

await check("a recognised challenge is retried, or handed back at once with challenge: \"return\"", async () => {
  const page = Buffer.from(`<title>Checking your browser - reCAPTCHA</title>${" ".repeat(BODY.length)}`);
  const isChallenge = (bytes) => bytes.includes("Checking your browser");
  const retried = scripted([() => makeResponse({ body: page }), () => makeResponse()]);
  assert.equal((await fetchPinned(options({ fetchImpl: retried.fetchImpl, isChallenge }))).attempts, 2);
  const exhausted = await rejection(fetchPinned(options({ fetchImpl: scripted([() => makeResponse({ body: page })]).fetchImpl, isChallenge })));
  assert.match(exhausted.message, /Test artifact served a challenge page/);

  const cacheDir = path.join(scratch, "challenge-cache");
  const clock = fakeClock();
  const returned = scripted([() => makeResponse({ body: page })]);
  const result = await fetchPinned(options({
    clock,
    fetchImpl: returned.fetchImpl,
    isChallenge,
    challenge: "return",
    env: { RADULATOR_SOURCE_CACHE_DIR: cacheDir },
  }));
  assert.equal(result.challenged, true);
  assert.ok(result.bytes.equals(page));
  assert.equal(returned.calls.length, 1);
  assert.deepEqual(clock.state.sleeps, []);
  assert.equal(existsSync(cacheDir) ? readdirSync(cacheDir).length : 0, 0, "a challenge page is never cached");
});

// ---- Pins ----------------------------------------------------------------------------------------

await check("a 200 that misses its pin fails at once: same-length digest drift and byte-length drift", async () => {
  const sameLength = Buffer.from(BODY);
  sameLength[10] = sameLength[10] === 0x41 ? 0x42 : 0x41;
  const longer = Buffer.concat([BODY, Buffer.from("\n")]);
  const shorter = BODY.subarray(0, BODY.length - 1);
  for (const [name, body, pattern] of [
    ["same-length digest drift", sameLength, /^Test artifact SHA-256 drifted \([0-9a-f]{64}, pinned [0-9a-f]{64}\)$/],
    ["one extra byte", longer, new RegExp(`^Test artifact byte length drifted \\(${BODY.length + 1}, pinned ${BODY.length}\\)$`)],
    ["one byte short", shorter, new RegExp(`^Test artifact byte length drifted \\(${BODY.length - 1}, pinned ${BODY.length}\\)$`)],
  ]) {
    const clock = fakeClock();
    const { fetchImpl, calls } = scripted([() => makeResponse({ body }), () => makeResponse()]);
    const error = await rejection(fetchPinned(options({ clock, fetchImpl })));
    assert.equal(error.code, "drift", name);
    assert.match(error.message, pattern, name);
    assert.equal(calls.length, 1, `${name} is never retried`);
    assert.deepEqual(clock.state.sleeps, [], `${name} waits for nothing`);
  }
});

await check("verify() runs first, keeps the audit's message, and its failure is a drift", async () => {
  const seen = [];
  const verify = (bytes, response) => {
    seen.push(response.url);
    assert.ok(bytes.includes("Pinned artifact"), "PMID 12345: record identifier drifted");
  };
  const { fetchImpl, calls } = scripted([() => makeResponse({ body: Buffer.alloc(BODY.length, 0x2e) })]);
  const error = await rejection(fetchPinned(options({ fetchImpl, verify })));
  assert.equal(error.code, "drift");
  assert.equal(error.message, "PMID 12345: record identifier drifted");
  assert.equal(calls.length, 1);
  assert.deepEqual(seen, [EUTILS_URL]);
  // Callbacks may be async: a rejected verify() is the same drift, and a resolved one passes.
  const asyncDrift = scripted([() => makeResponse()]);
  const asyncError = await rejection(fetchPinned(options({
    fetchImpl: asyncDrift.fetchImpl,
    verify: async () => {
      await Promise.resolve();
      throw new Error("canonical text SHA-256 drifted");
    },
  })));
  assert.equal(asyncError.code, "drift");
  assert.equal(asyncDrift.calls.length, 1);
  const asyncChallenge = scripted([() => makeResponse({ body: Buffer.alloc(BODY.length, 0x2e) }), () => makeResponse()]);
  const passed = await fetchPinned(options({
    fetchImpl: asyncChallenge.fetchImpl,
    isChallenge: async (bytes) => bytes[0] === 0x2e,
    verify: async () => {},
  }));
  assert.equal(passed.attempts, 2, "an async challenge check is awaited");
});

await check("a body longer than maxBytes is a drift, and the stream is cancelled early", async () => {
  const { fetchImpl, calls, responses } = scripted([
    () => makeResponse({ body: Buffer.alloc(200_000, 0x78), chunkSize: 4_096 }),
  ]);
  const error = await rejection(fetchPinned(options({ fetchImpl, maxBytes: 50_000 })));
  assert.equal(error.code, "drift");
  assert.equal(error.message, "Test artifact body exceeds the 50000-byte boundary");
  assert.equal(calls.length, 1);
  assert.equal(responses[0].stats.cancelled, 1);
  assert.ok(responses[0].stats.delivered < 200_000, "the body is not read to the end");
});

await check("canonical pins are checked by verify() and hit the cache", async () => {
  const canonical = (bytes) => bytes.toString("utf8").replace(/<script>[^<]*<\/script>/g, "");
  const page = (nonce) => Buffer.from(`<script>${nonce}</script>${BODY.toString("utf8")}`);
  const pin = { kind: "canonical", sha256: sha256(canonical(page("one"))) };
  const verify = (bytes) => assert.equal(sha256(canonical(bytes)), pin.sha256, "canonical text SHA-256 drifted");
  const env = { RADULATOR_SOURCE_CACHE_DIR: path.join(scratch, "canonical-cache") };
  const first = scripted([() => makeResponse({ url: PMC_URL, body: page("one"), contentType: "text/html" })]);
  assert.equal((await fetchPinned(options({ url: PMC_URL, pin, verify, env, fetchImpl: first.fetchImpl }))).provenance, "live");
  const hit = scripted([() => makeResponse({ url: PMC_URL, body: page("two"), contentType: "text/html" })]);
  const cached = await fetchPinned(options({ url: PMC_URL, pin, verify, env, fetchImpl: hit.fetchImpl }));
  assert.equal(cached.provenance, "cache");
  assert.equal(hit.calls.length, 0);
  assert.ok(cached.bytes.equals(page("one")));
  // A different wrapper with the same canonical text still verifies; a changed text is a drift.
  const nonce = scripted([() => makeResponse({ url: PMC_URL, body: page("three"), contentType: "text/html" })]);
  assert.equal((await fetchPinned(options({ url: PMC_URL, pin, verify, fetchImpl: nonce.fetchImpl }))).provenance, "live");
  const changed = scripted([
    () => makeResponse({ url: PMC_URL, body: page("one").toString("utf8").replace("Pinned", "Changed"), contentType: "text/html" }),
  ]);
  const error = await rejection(fetchPinned(options({ url: PMC_URL, pin, verify, fetchImpl: changed.fetchImpl })));
  assert.equal(error.code, "drift");
  assert.match(error.message, /canonical text SHA-256 drifted/);
  assert.equal(changed.calls.length, 1);
});

// ---- Cache ---------------------------------------------------------------------------------------

await check("verified bytes are cached under the pin's SHA-256; a poisoned entry is dropped and refetched", async () => {
  const dir = path.join(scratch, "cache");
  const logFile = path.join(scratch, "cache-log.jsonl");
  const env = { RADULATOR_SOURCE_CACHE_DIR: dir, RADULATOR_SOURCE_FETCH_LOG: logFile, RADULATOR_SOURCE_AUDIT_ID: "demo" };
  const live = scripted([() => makeResponse()]);
  assert.equal((await fetchPinned(options({ env, fetchImpl: live.fetchImpl }))).provenance, "live");
  assert.deepEqual(readdirSync(dir).sort(), [`${PIN.sha256}.bin`, `${PIN.sha256}.json`]);
  const sidecar = JSON.parse(readFileSync(path.join(dir, `${PIN.sha256}.json`), "utf8"));
  assert.equal(sidecar.provenance, "live");
  assert.equal(sidecar.sha256, PIN.sha256);
  assert.equal(sidecar.url, EUTILS_URL);
  assert.equal(sidecar.audit, "demo");

  const hit = scripted([() => makeResponse()]);
  const cached = await fetchPinned(options({ env, fetchImpl: hit.fetchImpl }));
  assert.equal(cached.provenance, "cache");
  assert.equal(cached.attempts, 0);
  assert.equal(hit.calls.length, 0, "a cache hit makes no request");

  const poisoned = Buffer.from(BODY);
  poisoned[0] ^= 0x01;
  writeFileSync(path.join(dir, `${PIN.sha256}.bin`), poisoned);
  const refetch = scripted([() => makeResponse()]);
  const fresh = await fetchPinned(options({ env, fetchImpl: refetch.fetchImpl }));
  assert.equal(fresh.provenance, "live");
  assert.equal(refetch.calls.length, 1, "a poisoned entry is fetched again");
  assert.ok(readFileSync(path.join(dir, `${PIN.sha256}.bin`)).equals(BODY), "only verified bytes are written back");

  const records = readFileSync(logFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(
    records.map(({ provenance, outcome, cache_rejected: rejected = false }) => [provenance, outcome, rejected]),
    [["live", "ok", false], ["cache", "ok", false], ["live", "ok", true]],
  );

  const unpinned = scripted([() => makeResponse()]);
  const unpinnedDir = path.join(scratch, "unpinned-cache");
  await fetchPinned(options({ pin: null, env: { RADULATOR_SOURCE_CACHE_DIR: unpinnedDir }, fetchImpl: unpinned.fetchImpl }));
  assert.equal(existsSync(unpinnedDir), false, "nothing without a pin is cached");
});

// ---- Fetch log -----------------------------------------------------------------------------------

await check("the fetch log records one line per request in the runner's vocabulary", async () => {
  const logFile = path.join(scratch, "fetch-log.jsonl");
  const env = { RADULATOR_SOURCE_FETCH_LOG: logFile };
  await fetchPinned(options({ env, fetchImpl: scripted([() => makeResponse({ status: 429, body: "slow" }), () => makeResponse()]).fetchImpl }));
  await rejection(fetchPinned(options({ env, fetchImpl: scripted([() => makeResponse({ body: Buffer.alloc(BODY.length, 0x2e) })]).fetchImpl })));
  await rejection(fetchPinned(options({ env, url: PMC_URL, fetchImpl: scripted([() => makeResponse({ status: 404 })]).fetchImpl })));
  const records = readFileSync(logFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(
    records.map(({ host, status, outcome, provenance }) => ({ host, status, outcome, provenance })),
    [
      { host: "eutils.ncbi.nlm.nih.gov", status: 429, outcome: "transport", provenance: "live" },
      { host: "eutils.ncbi.nlm.nih.gov", status: 200, outcome: "ok", provenance: "live" },
      { host: "eutils.ncbi.nlm.nih.gov", status: 200, outcome: "drift", provenance: "live" },
      { host: "pmc.ncbi.nlm.nih.gov", status: 404, outcome: "error", provenance: "live" },
    ],
  );
  // An exhausted retry leaves "transport" as the last record, which the runner reads as a
  // transport failure.
  const exhaustedLog = path.join(scratch, "exhausted-log.jsonl");
  await rejection(fetchPinned(options({ env: { RADULATOR_SOURCE_FETCH_LOG: exhaustedLog }, fetchImpl: scripted([() => makeResponse({ status: 503 })]).fetchImpl })));
  const exhausted = readFileSync(exhaustedLog, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(exhausted.length, MAX_ATTEMPTS);
  assert.ok(exhausted.every((record) => record.outcome === "transport"));
});

// ---- Pacing --------------------------------------------------------------------------------------

await check("jitter stays within 0-150 ms and requests start at least 400 ms apart without a key", async () => {
  for (const [random, jitter] of [[() => 0, 0], [() => 0.5, 75], [() => 0.999_999, 150]]) {
    const clock = fakeClock();
    const gate = createRateGate({ now: clock.now, sleep: clock.sleep, random });
    const waits = await Promise.all([1, 2, 3].map(() => gate.reserve("pmc.ncbi.nlm.nih.gov", false)));
    assert.deepEqual(waits, [0, 400 + jitter, 2 * (400 + jitter)]);
  }
  // The limits themselves, not this module's constants: 3 requests a second means starts at least
  // 334 ms apart; the jitter only ever adds to that.
  assert.ok(SPACING_MS >= 334 && JITTER_MS >= 0, "no more than 3 requests a second without a key");
  const clock = fakeClock();
  const starts = [];
  const gate = createRateGate({ now: clock.now, sleep: clock.sleep, random: () => 0 });
  for (let index = 0; index < 7; index += 1) {
    await fetchPinned(options({
      clock,
      gate,
      fetchImpl: async () => {
        starts.push(clock.state.time);
        return makeResponse();
      },
    }));
  }
  const gaps = starts.slice(1).map((start, index) => start - starts[index]);
  assert.ok(gaps.every((gap) => gap === 400), `gaps ${gaps}`);
  for (const start of starts) {
    assert.ok(starts.filter((other) => other >= start && other < start + 1_000).length <= 3, "at most 3 requests a second");
  }
});

await check("with a key, E-utilities requests start at least 125 ms apart and other hosts stay at 400 ms", async () => {
  const clock = fakeClock();
  const gate = createRateGate({ now: clock.now, sleep: clock.sleep, random: () => 0 });
  assert.deepEqual(await Promise.all([1, 2, 3].map(() => gate.reserve("eutils.ncbi.nlm.nih.gov", true))), [0, 125, 250]);
  assert.equal(await gate.reserve("pmc.ncbi.nlm.nih.gov", true), 250 + SPACING_MS);
  assert.ok(KEYED_SPACING_MS >= 100, "no more than 10 requests a second with a key");
  const starts = [];
  const keyedGate = createRateGate({ now: clock.now, sleep: clock.sleep, random: () => 0 });
  for (let index = 0; index < 12; index += 1) {
    await fetchPinned(options({
      clock,
      gate: keyedGate,
      env: { NCBI_API_KEY: KEY },
      fetchImpl: async () => {
        starts.push(clock.state.time);
        return makeResponse();
      },
    }));
  }
  const gaps = starts.slice(1).map((start, index) => start - starts[index]);
  assert.ok(gaps.every((gap) => gap === 125), `gaps ${gaps}`);
  for (const start of starts) {
    assert.ok(starts.filter((other) => other >= start && other < start + 1_000).length <= 10, "at most 10 requests a second");
  }
});

await check("a shared rate file spaces requests across processes, and an unusable one falls back", async () => {
  const clock = fakeClock();
  const file = path.join(scratch, "rate", "ncbi-rate");
  const first = createRateGate({ file, now: clock.now, sleep: clock.sleep, random: () => 0 });
  const second = createRateGate({ file, now: clock.now, sleep: clock.sleep, random: () => 0 });
  assert.equal(await first.reserve("eutils.ncbi.nlm.nih.gov", false), 0);
  assert.equal(await second.reserve("www.ncbi.nlm.nih.gov", false), SPACING_MS, "a second process waits for the first");
  assert.equal(await first.reserve("pmc.ncbi.nlm.nih.gov", false), 2 * SPACING_MS);
  assert.equal(existsSync(`${file}.lock`), false, "the lock is released");
  const unusable = createRateGate({ file: "/dev/null/ncbi-rate", now: clock.now, sleep: clock.sleep, random: () => 0 });
  assert.equal(await unusable.reserve("pmc.ncbi.nlm.nih.gov", false), 0);
  assert.equal(await unusable.reserve("pmc.ncbi.nlm.nih.gov", false), SPACING_MS);
});

// ---- API key -------------------------------------------------------------------------------------

await check("the key is appended as the last api_key parameter on E-utilities only", async () => {
  assert.deepEqual(API_KEY_HOSTS, ["eutils.ncbi.nlm.nih.gov"]);
  const withKey = { NCBI_API_KEY: ` ${KEY}\n` };
  const eutils = scripted([(url) => makeResponse({ url })]);
  await fetchPinned(options({ env: withKey, fetchImpl: eutils.fetchImpl }));
  assert.equal(eutils.calls[0].url === `${EUTILS_URL}&api_key=${KEY}`, true, "E-utilities gets the key last");
  for (const url of [PMC_URL, BIOC_URL]) {
    const other = scripted([() => makeResponse({ url })]);
    await fetchPinned(options({ url, env: withKey, fetchImpl: other.fetchImpl }));
    assert.equal(other.calls[0].url, url, `${new URL(url).hostname} never gets the key`);
  }
  const noKey = scripted([() => makeResponse()]);
  await fetchPinned(options({ env: {}, fetchImpl: noKey.fetchImpl }));
  assert.equal(noKey.calls[0].url, EUTILS_URL);
  assert.equal(requestUrlFor("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi", KEY) ===
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi?api_key=${KEY}`, true);
});

await check("the key never appears in the final URL, errors, retry notes, the fetch log or cache sidecars", async () => {
  const logFile = path.join(scratch, "key-log.jsonl");
  const cacheDir = path.join(scratch, "key-cache");
  const env = { NCBI_API_KEY: KEY, RADULATOR_SOURCE_FETCH_LOG: logFile, RADULATOR_SOURCE_CACHE_DIR: cacheDir };
  const notes = [];
  const seenUrls = [];
  const echo = scripted([
    (url) => {
      throw new TypeError(`request to ${url} failed, reason: socket hang up (key ${KEY})`);
    },
    (url) => makeResponse({ status: 429, url, body: `{"error":"API rate limit exceeded","api-key":"${KEY}"}` }),
    (url) => makeResponse({ url }),
  ]);
  const result = await fetchPinned(options({
    env,
    note: (line) => notes.push(line),
    fetchImpl: echo.fetchImpl,
    checkResponse: (response) => seenUrls.push(response.url),
  }));
  assert.equal(result.finalUrl, EUTILS_URL);
  assert.deepEqual(seenUrls, [EUTILS_URL], "checks see the final URL without the key");
  const exhausted = await rejection(fetchPinned(options({
    env: { NCBI_API_KEY: KEY, RADULATOR_SOURCE_FETCH_LOG: logFile },
    pin: { bytes: 10, sha256: "0".repeat(64) },
    note: (line) => notes.push(line),
    fetchImpl: async (url) => {
      throw new TypeError(`request to ${url} failed (${encodeURIComponent(KEY)})`);
    },
  })));
  const drift = await rejection(fetchPinned(options({
    env: { NCBI_API_KEY: KEY },
    fetchImpl: async (url) => makeResponse({ url, body: Buffer.alloc(BODY.length, 0x2e) }),
    verify: (bytes, response) => assert.fail(`drifted at ${response.url} with ${KEY}`),
  })));
  const everything = [
    result.finalUrl,
    exhausted.message,
    drift.message,
    ...notes,
    readFileSync(logFile, "utf8"),
    ...readdirSync(cacheDir).map((name) => readFileSync(path.join(cacheDir, name)).toString("utf8")),
  ].join("\n");
  assert.equal(everything.includes(KEY), false, "the key leaked");
  assert.equal(everything.includes(encodeURIComponent(KEY).slice(0, 20)), false, "the encoded key leaked");
  assert.equal(/api_key=(?!\[REDACTED\])/.test(everything), false, "an api_key value leaked");
  assert.match(exhausted.message, /api_key=\[REDACTED\]/);
  assert.ok(notes.length >= 2, "retries leave a note");
});

await check("an injected fetch is hermetic: no key, cache or fetch log from the process environment", async () => {
  const logFile = path.join(scratch, "hermetic-log.jsonl");
  const cacheDir = path.join(scratch, "hermetic-cache");
  const saved = { ...process.env };
  process.env.NCBI_API_KEY = KEY;
  process.env.RADULATOR_SOURCE_FETCH_LOG = logFile;
  process.env.RADULATOR_SOURCE_CACHE_DIR = cacheDir;
  try {
    const { fetchImpl, calls } = scripted([() => makeResponse()]);
    await fetchPinned({ url: EUTILS_URL, pin: PIN, fetchImpl, sleep: async () => {} });
    assert.equal(calls[0].url, EUTILS_URL);
  } finally {
    for (const name of ["NCBI_API_KEY", "RADULATOR_SOURCE_FETCH_LOG", "RADULATOR_SOURCE_CACHE_DIR"]) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
  assert.equal(existsSync(logFile), false);
  assert.equal(existsSync(cacheDir), false);
});

// ---- Helpers and input checks --------------------------------------------------------------------

await check("redact, stripApiKey and pinnedQueryMatches", async () => {
  assert.equal(redact(`key ${KEY} and ${encodeURIComponent(`${KEY}/`)}`, KEY), "key [REDACTED] and [REDACTED]%2F");
  assert.equal(redact("x?api_key=abc&b=1 api_key=[REDACTED]", ""), "x?api_key=[REDACTED]&b=1 api_key=[REDACTED]");
  assert.equal(redact("short key abc", "abc"), "short key abc", "keys under 8 characters are not treated as secrets");
  assert.equal(stripApiKey(`${EUTILS_URL}&api_key=${KEY}`), EUTILS_URL);
  assert.equal(stripApiKey(`https://eutils.ncbi.nlm.nih.gov/x?api_key=${KEY}`), "https://eutils.ncbi.nlm.nih.gov/x");
  assert.equal(stripApiKey("https://pmc.ncbi.nlm.nih.gov/a?b=%20c&d"), "https://pmc.ncbi.nlm.nih.gov/a?b=%20c&d");
  assert.equal(pinnedQueryMatches(`${EUTILS_URL}&api_key=${KEY}`, EUTILS_URL), true);
  assert.equal(pinnedQueryMatches(EUTILS_URL.replace("id=12345", "id=12346"), EUTILS_URL), false);
  assert.equal(pinnedQueryMatches(`${EUTILS_URL}&retstart=1`, EUTILS_URL), false);
  assert.equal(pinnedQueryMatches(EUTILS_URL.replace("&retmode=text", ""), EUTILS_URL), false);
  assert.equal(pinnedQueryMatches(EUTILS_URL.replace("eutils.", "eutils2."), EUTILS_URL), false);
  assert.equal(pinnedQueryMatches(EUTILS_URL.replace("efetch", "esummary"), EUTILS_URL), false);
  assert.equal(pinnedQueryMatches("not a url", EUTILS_URL), false);
  assert.deepEqual(NCBI_HOSTS, ["eutils.ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov", "pubmed.ncbi.nlm.nih.gov", "www.ncbi.nlm.nih.gov"]);
});

await check("fetchPinned refuses URLs and pins it cannot enforce", async () => {
  const fetchImpl = async () => makeResponse();
  for (const [name, overrides, pattern] of [
    ["another host", { url: "https://example.org/a" }, /only fetches https NCBI URLs/],
    ["plain http", { url: "http://eutils.ncbi.nlm.nih.gov/x" }, /only fetches https NCBI URLs/],
    ["a key in the canonical URL", { url: `${EUTILS_URL}&api_key=x` }, /must not carry api_key/],
    ["a raw pin without a length", { pin: { sha256: PIN.sha256 } }, /needs its byte length/],
    ["a malformed digest", { pin: { bytes: 1, sha256: "ABC" } }, /lowercase SHA-256/],
    ["a canonical pin without verify()", { pin: { kind: "canonical", sha256: PIN.sha256 } }, /needs verify/],
    ["an unknown challenge mode", { challenge: "ignore" }, /unknown challenge mode/],
  ]) {
    await assert.rejects(fetchPinned(options({ fetchImpl, ...overrides })), pattern, name);
  }
});

console.log(`ncbi-fetch helper: ${passed} offline checks passed`);
