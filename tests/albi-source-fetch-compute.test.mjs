// Deterministic offline tests for the ALBI primary-source retrieval policy
// (scripts/audit-albi-source-fetch.mjs). Fetch, sleep and the clock are injected; nothing touches the network.
import assert from "node:assert/strict";
import test from "node:test";
import {
  SOURCE_FETCH_ATTEMPTS,
  SOURCE_FETCH_MAX_DELAY_MS,
  SOURCE_MAX_BYTES,
  SOURCE_MIN_BYTES,
  acceptPmcArticleHtml,
  fetchWithRetry,
  retryDelayMs,
} from "../scripts/audit-albi-source-fetch.mjs";

const SOURCE_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC4322258/";
const SOURCE_HOST = "pmc.ncbi.nlm.nih.gov";
const ARTICLE_BYTES = 276_164;
const CHALLENGE_BYTES = 5_000;

function fakeResponse({
  status = 200,
  url = SOURCE_URL,
  contentType = "text/html; charset=utf-8",
  size = ARTICLE_BYTES,
  headers = {},
} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: new Headers({ "content-type": contentType, ...headers }),
    arrayBuffer: async () => new Uint8Array(size).fill(0x61).buffer,
    body: { cancel: async () => {} },
  };
}

// Runs fetchWithRetry against a scripted sequence of responses (or thrown errors).
async function run(script, { now = () => 0 } = {}) {
  const sleeps = [];
  let calls = 0;
  const fetchImpl = async (url, init) => {
    assert.equal(url, SOURCE_URL);
    assert.equal(init.redirect, "follow");
    const step = script[Math.min(calls, script.length - 1)];
    calls += 1;
    if (step instanceof Error) throw step;
    return fakeResponse(step);
  };
  const promise = fetchWithRetry(SOURCE_URL, {
    accept: (response, bytes) => acceptPmcArticleHtml(response, bytes, { url: SOURCE_URL, host: SOURCE_HOST }),
    fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    now,
  });
  return { promise, sleeps, calls: () => calls };
}

test("uses the KBRC retry policy constants", () => {
  assert.equal(SOURCE_FETCH_ATTEMPTS, 5);
  assert.equal(SOURCE_FETCH_MAX_DELAY_MS, 30_000);
  assert.equal(SOURCE_MIN_BYTES, 100_000);
  assert.equal(SOURCE_MAX_BYTES, 2_000_000);
});

test("backs off 1, 2, 4 and 8 s across five attempts, then fails loudly", async () => {
  const { promise, sleeps, calls } = await run([{ status: 503 }]);
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof assert.AssertionError);
    assert.match(error.message, /primary-source retrieval failed after 5 of 5 attempts \(HTTP 503\)/);
    return true;
  });
  assert.equal(calls(), 5);
  assert.deepEqual(sleeps, [1_000, 2_000, 4_000, 8_000]);
});

test("retries a PMC challenge page and returns the article", async () => {
  const { promise, sleeps, calls } = await run([{ size: CHALLENGE_BYTES }, { size: ARTICLE_BYTES }]);
  const result = await promise;
  assert.equal(result.bytes.length, ARTICLE_BYTES);
  assert.equal(typeof result.html, "string");
  assert.equal(calls(), 2);
  assert.deepEqual(sleeps, [1_000]);
});

test("a challenge page on every attempt fails loudly with the size reason", async () => {
  const { promise, sleeps, calls } = await run([{ size: CHALLENGE_BYTES }]);
  await assert.rejects(
    promise,
    /failed after 5 of 5 attempts \(ALBI source response is unexpectedly small \(5000 bytes; likely a PMC challenge page\)\)/,
  );
  assert.equal(calls(), 5);
  assert.deepEqual(sleeps, [1_000, 2_000, 4_000, 8_000]);
});

test("a response exactly at the size floor is still treated as a challenge", async () => {
  const { promise } = await run([{ size: SOURCE_MIN_BYTES }]);
  await assert.rejects(promise, /unexpectedly small \(100000 bytes/);
});

test("honours Retry-After seconds and clamps it to 30 s", async () => {
  const { promise, sleeps } = await run([
    { status: 429, headers: { "retry-after": "3" } },
    { status: 429, headers: { "retry-after": "120" } },
    { size: ARTICLE_BYTES },
  ]);
  await promise;
  assert.deepEqual(sleeps, [3_000, 30_000]);
});

test("honours an HTTP-date Retry-After against the injected clock and never sleeps a negative time", async () => {
  const now = Date.parse("2026-09-28T03:00:00Z");
  const { promise, sleeps } = await run(
    [
      { status: 503, headers: { "retry-after": "Mon, 28 Sep 2026 03:00:05 GMT" } },
      { status: 503, headers: { "retry-after": "Mon, 28 Sep 2026 02:59:00 GMT" } },
      { size: ARTICLE_BYTES },
    ],
    { now: () => now },
  );
  await promise;
  assert.deepEqual(sleeps, [5_000, 0]);
  assert.equal(retryDelayMs(null, 3), 4_000);
});

test("retries network errors", async () => {
  const { promise, sleeps, calls } = await run([new TypeError("fetch failed"), new TypeError("fetch failed"), { size: ARTICLE_BYTES }]);
  await promise;
  assert.equal(calls(), 3);
  assert.deepEqual(sleeps, [1_000, 2_000]);
});

test("does not retry a non-retryable status and reports the real attempt count", async () => {
  const { promise, sleeps, calls } = await run([{ status: 404 }]);
  await assert.rejects(promise, /failed after 1 of 5 attempts \(HTTP 404\)/);
  assert.equal(calls(), 1);
  assert.deepEqual(sleeps, []);
});

test("never accepts a response that leaves PMC, changes path or protocol, is not HTML, or is oversized", async () => {
  for (const [step, reason] of [
    [{ url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4322258/" }, /redirect left PMC/],
    [{ url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4322259/" }, /unexpected ALBI source redirect path/],
    [{ url: "http://pmc.ncbi.nlm.nih.gov/articles/PMC4322258/" }, /redirect left HTTPS/],
    [{ contentType: "text/plain" }, /must be HTML/],
    [{ size: SOURCE_MAX_BYTES + 1 }, /unexpectedly large/],
  ]) {
    const { promise, calls } = await run([step]);
    await assert.rejects(promise, reason);
    assert.equal(calls(), 5, `retried to exhaustion before failing: ${reason}`);
  }
});

test("a valid response after a stray redirect is accepted only because it passes every check", async () => {
  const { promise, calls } = await run([
    { url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4322258/" },
    { size: ARTICLE_BYTES },
  ]);
  const result = await promise;
  assert.equal(result.bytes.length, ARTICLE_BYTES);
  assert.equal(calls(), 2);
});
