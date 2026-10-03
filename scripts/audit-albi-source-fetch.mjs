// Retrieval policy for the ALBI primary-source audit, kept free of side effects so tests can drive it
// with a fake fetch, clock and sleep. It follows the KBRC audit's policy (PR #275,
// scripts/audit-kbrc-source-fetch.mjs): five attempts, exponential backoff of 1, 2, 4 and 8 s, Retry-After
// honoured and clamped to 30 s, and a loud failure at the end.
//
// PMC sometimes answers the article URL with a short bot-challenge page instead of the article (Smoke
// run 36370775842 on PR #290). Three attempts 0.5-1 s apart all hit the challenge, so a response below
// the size floor is retried like any other transient failure. Retrying never relaxes verification: only
// a response that passes every check here is returned, and the audit then applies its byte-length,
// canonical-digest and locator pins to it.
import assert from "node:assert/strict";

export const SOURCE_FETCH_ATTEMPTS = 5;
export const SOURCE_FETCH_MAX_DELAY_MS = 30_000;
export const SOURCE_MIN_BYTES = 100_000;
export const SOURCE_MAX_BYTES = 2_000_000;

export function retryDelayMs(response, attempt, now = Date.now()) {
  const retryAfter = response?.headers?.get?.("retry-after");
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

// Checks one successful PMC response. Throws on any problem; the caller decides whether to retry.
export function acceptPmcArticleHtml(response, bytes, { url, host }) {
  const expected = new URL(url);
  const finalUrl = new URL(response.url);
  assert.equal(finalUrl.protocol, "https:", "ALBI source redirect left HTTPS");
  assert.equal(finalUrl.hostname, host, "ALBI source redirect left PMC");
  assert.equal(finalUrl.pathname, expected.pathname, "unexpected ALBI source redirect path");
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i, "ALBI primary source must be HTML");
  assert.ok(
    bytes.length > SOURCE_MIN_BYTES,
    `ALBI source response is unexpectedly small (${bytes.length} bytes; likely a PMC challenge page)`,
  );
  assert.ok(bytes.length <= SOURCE_MAX_BYTES, "ALBI source response is unexpectedly large");
  return { bytes, html: bytes.toString("utf8") };
}

export async function fetchWithRetry(url, {
  accept,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  attempts = SOURCE_FETCH_ATTEMPTS,
  maxDelayMs = SOURCE_FETCH_MAX_DELAY_MS,
  userAgent = "Radulator-ALBI-primary-source-audit/1",
} = {}) {
  assert.equal(typeof accept, "function", "fetchWithRetry needs an accept(response, bytes) check");
  let lastFailure = "unknown retrieval failure";
  let made = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    made = attempt;
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { "user-agent": userAgent },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        // A response that fails any check (a challenge page, a stray redirect) is treated as transient:
        // the next attempt must pass every check again, and exhaustion fails loudly below.
        return accept(response, Buffer.from(await response.arrayBuffer()));
      }
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel?.();
      if (!isRetryableStatus(response.status)) break;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < attempts) {
      await sleep(Math.min(Math.max(retryDelayMs(response, attempt, now()), 0), maxDelayMs));
    }
  }
  assert.fail(`${url}: primary-source retrieval failed after ${made} of ${attempts} attempts (${lastFailure})`);
}
