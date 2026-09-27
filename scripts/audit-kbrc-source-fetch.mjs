// Retrieval policy for the KBRC primary-source audit, kept free of side effects so tests can drive
// it with a fake fetch, clock and sleep. Upstream archives (Europe PMC, publisher CDNs) return short
// 429/5xx bursts; three attempts 0.5-1 s apart failed together in E2E run 32960482810. Retry with
// exponential backoff, honour Retry-After, and still fail loudly at the end.
import assert from "node:assert/strict";

export const SOURCE_FETCH_ATTEMPTS = 5;
export const SOURCE_FETCH_MAX_DELAY_MS = 30_000;

export function retryDelayMs(response, attempt, now = Date.now()) {
  const retryAfter = response?.headers?.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return date - now;
  }
  return 2 ** (attempt - 1) * 1_000;
}

export function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

export async function fetchWithRetry(url, {
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  attempts = SOURCE_FETCH_ATTEMPTS,
  maxDelayMs = SOURCE_FETCH_MAX_DELAY_MS,
} = {}) {
  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { "user-agent": "Radulator-KBRC-primary-source-audit/1" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel();
      if (!isRetryableStatus(response.status)) break;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < attempts) {
      await sleep(Math.min(Math.max(retryDelayMs(response, attempt, now()), 0), maxDelayMs));
    }
  }
  assert.fail(`${url}: primary-source retrieval failed after ${attempts} attempts (${lastFailure})`);
}
