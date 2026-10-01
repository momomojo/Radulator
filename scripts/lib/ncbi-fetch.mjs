// Shared retrieval for the network clinical source audits that read NCBI hosts: E-utilities,
// PubMed, PMC, and the BioC API and Bookshelf on www.ncbi.nlm.nih.gov.
//
// fetchPinned() is the one path an audit uses to fetch a pinned NCBI artifact.
//   Pacing     Requests to NCBI start at least 400 ms apart (plus 0-150 ms jitter), or 125 ms apart
//              on a host that takes the API key when NCBI_API_KEY is set: never more than 3 requests
//              a second without a key, or 10 with one. RADULATOR_NCBI_RATE_FILE (set by
//              scripts/run-source-audits.mjs) carries the spacing across processes.
//   Retries    Up to 5 attempts, waiting 1, 2, 4 and 8 s between them; a Retry-After header can
//              lengthen a wait, up to 30 s. Retried: network errors and timeouts, HTTP 408, 425, 429
//              and 5xx (not 501 or 505), HTTP 400 from E-utilities (sent transiently for valid
//              requests), a 200 response that is not the expected artifact (wrong final URL or
//              media type, as an interstitial page has), and a challenge page (smaller than the
//              artifact's size floor, or recognised by the audit). Any other status fails at once.
//              When the attempts run out the last failure is thrown.
//   Pins       The bytes are checked before anything parses them. A 200 response that misses its
//              byte length or SHA-256 pin, or fails the audit's verify() (canonical pins), is a
//              changed source: it fails at once and is never retried.
//   Cache      With RADULATOR_SOURCE_CACHE_DIR set, verified bytes are kept for the rest of the run
//              under the pin's SHA-256, with a sidecar recording where they came from. A hit is
//              verified again; a bad entry is dropped and fetched again. Only verified bytes are
//              written.
//   Fetch log  With RADULATOR_SOURCE_FETCH_LOG set, one JSON line per request or cache hit:
//              {"host", "status", "outcome", "provenance", ...}. outcome is "ok", "transport" (a
//              retryable failure), "drift" (a pin miss) or "error" (a status that is not retried);
//              provenance is "live" or "cache". The source-audit runner classifies failures from it.
//   API key    NCBI_API_KEY is read from the environment only and appended as the last api_key
//              parameter, only for API_KEY_HOSTS. It is redacted from every error, retry note, log
//              line, cache sidecar and returned URL; audits print only their canonical URLs. An
//              NcbiFetchError carries only its redacted message, never the original error as a
//              cause, so inspecting or logging the whole error object cannot show the key either.
//
// A fetch implementation passed in (by a test) makes the call hermetic unless the caller also
// passes them: no environment (so no key, cache or fetch log), no pacing and no retry notes.
import { createHash } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

export const NCBI_HOSTS = Object.freeze([
  "eutils.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "www.ncbi.nlm.nih.gov",
]);
// Hosts that take NCBI_API_KEY. Add the BioC API or PMC only after a manual call with a key shows
// X-RateLimit-Limit: 10.
export const API_KEY_HOSTS = Object.freeze(["eutils.ncbi.nlm.nih.gov"]);
export const MAX_ATTEMPTS = 5;
export const BACKOFF_MS = Object.freeze([1_000, 2_000, 4_000, 8_000]);
export const RETRY_AFTER_CAP_MS = 30_000;
export const SPACING_MS = 400;
export const KEYED_SPACING_MS = 125;
export const JITTER_MS = 150;
export const REQUEST_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
export const CACHE_SCHEMA = "radulator-ncbi-fetch-cache/v1";

const REDACTED = "[REDACTED]";
const API_KEY_PARAMETER = /(api_key=)([^&\s"'<>#]*)/gi;
const MIN_SECRET_LENGTH = 8;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const LOCK_STALE_MS = 10_000;
const LOCK_RETRY_MS = 20;
const LOCK_MAX_TRIES = 1_000;

export class NcbiFetchError extends Error {
  // code: "transport" (attempts exhausted), "drift" (pin miss) or "http" (status not retried).
  // No cause: the original error's message and stack can carry the key (see "API key" above).
  constructor(message, { code, attempts, status = null } = {}) {
    super(message);
    this.name = "NcbiFetchError";
    this.code = code;
    this.attempts = attempts;
    this.status = status;
  }
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const defaultSleep = (milliseconds) =>
  milliseconds > 0 ? new Promise((resolve) => setTimeout(resolve, milliseconds)) : Promise.resolve();

function keyOf(env) {
  const value = env?.NCBI_API_KEY;
  return typeof value === "string" ? value.trim() : "";
}

// Removes the literal key (and its URL-encoded form) and every api_key=<value> from text.
export function redact(text, key = "") {
  let output = String(text ?? "");
  const secret = typeof key === "string" ? key.trim() : "";
  if (secret.length >= MIN_SECRET_LENGTH) {
    for (const form of new Set([secret, encodeURIComponent(secret)])) output = output.split(form).join(REDACTED);
  }
  return output.replace(API_KEY_PARAMETER, `$1${REDACTED}`);
}

// The URL without any api_key parameter; every other byte is kept.
export function stripApiKey(url) {
  const text = String(url ?? "");
  const hashAt = text.indexOf("#");
  const beforeHash = hashAt >= 0 ? text.slice(0, hashAt) : text;
  const hash = hashAt >= 0 ? text.slice(hashAt) : "";
  const queryAt = beforeHash.indexOf("?");
  if (queryAt < 0) return text;
  const kept = beforeHash.slice(queryAt + 1).split("&").filter((part) => !/^api_key(?:=|$)/i.test(part));
  return `${beforeHash.slice(0, queryAt)}${kept.length > 0 ? `?${kept.join("&")}` : ""}${hash}`;
}

// The request URL: the canonical URL, plus the key as the last parameter on API_KEY_HOSTS.
export function requestUrlFor(url, key) {
  const parsed = new URL(url);
  if (!key || !API_KEY_HOSTS.includes(parsed.hostname)) return url;
  return `${url}${parsed.search ? "&" : "?"}api_key=${encodeURIComponent(key)}`;
}

// True when finalUrl is canonicalUrl apart from api_key: same scheme, host, port and path, and the
// same values for every pinned query parameter. Any other added parameter is a mismatch.
export function pinnedQueryMatches(finalUrl, canonicalUrl) {
  let actual;
  let expected;
  try {
    actual = new URL(finalUrl);
    expected = new URL(canonicalUrl);
  } catch {
    return false;
  }
  for (const component of ["protocol", "username", "password", "host", "pathname", "hash"]) {
    if (actual[component] !== expected[component]) return false;
  }
  const names = new Set([...actual.searchParams.keys(), ...expected.searchParams.keys()]);
  names.delete("api_key");
  for (const name of names) {
    const got = actual.searchParams.getAll(name);
    const want = expected.searchParams.getAll(name);
    if (got.length !== want.length || got.some((value, index) => value !== want[index])) return false;
  }
  return true;
}

export function isRetryableStatus(status, host) {
  if (status === 400) return host === "eutils.ncbi.nlm.nih.gov";
  return status === 408 || status === 425 || status === 429 ||
    (status >= 500 && status <= 599 && status !== 501 && status !== 505);
}

// Milliseconds a Retry-After header asks for (delta-seconds or an HTTP date), or null.
export function parseRetryAfter(value, nowMs) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text) * 1_000;
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(0, date - nowMs) : null;
}

// Wait after failed attempt n (1-4): the schedule, or longer if Retry-After asks, never over 30 s.
export function retryDelayMs(failedAttempt, retryAfterMs = null) {
  const scheduled = BACKOFF_MS[Math.min(Math.max(failedAttempt, 1), BACKOFF_MS.length) - 1];
  return Math.min(Math.max(scheduled, retryAfterMs ?? 0), RETRY_AFTER_CAP_MS);
}

export function spacingFor(host, keyed) {
  return keyed && API_KEY_HOSTS.includes(host) ? KEYED_SPACING_MS : SPACING_MS;
}

// Request spacing. reserve(host, keyed) books the next start slot and resolves to the wait before
// it. With `file`, the last booked slot lives in that file under an exclusive lock file, so
// processes that share it share the spacing.
export function createRateGate({ file = null, now = Date.now, sleep = defaultSleep, random = Math.random } = {}) {
  let lastSlot = -Infinity;
  let queue = Promise.resolve();
  const book = (spacing) => {
    const current = now();
    const slot = Math.max(current, lastSlot + spacing);
    lastSlot = slot;
    return slot - current;
  };
  const bookInFile = async (spacing) => {
    mkdirSync(path.dirname(file), { recursive: true });
    const lock = `${file}.lock`;
    for (let tries = 0; ; tries += 1) {
      let descriptor;
      try {
        descriptor = openSync(lock, "wx");
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
        try {
          // A lock left behind by a killed process.
          if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) rmSync(lock, { force: true });
        } catch {
          // Released meanwhile.
        }
        if (tries >= LOCK_MAX_TRIES) throw new Error("the NCBI request-spacing lock is held too long");
        await sleep(LOCK_RETRY_MS);
        continue;
      }
      try {
        let stored = -Infinity;
        try {
          const value = Number(readFileSync(file, "utf8").trim());
          if (Number.isFinite(value)) stored = value;
        } catch {
          // No request booked yet.
        }
        lastSlot = Math.max(lastSlot, stored);
        const wait = book(spacing);
        writeFileSync(file, `${lastSlot}\n`);
        return wait;
      } finally {
        closeSync(descriptor);
        rmSync(lock, { force: true });
      }
    }
  };
  return {
    reserve(host, keyed = false) {
      const spacing = spacingFor(host, keyed) + Math.floor(random() * (JITTER_MS + 1));
      // An unusable rate file falls back to this process's own spacing rather than failing an audit.
      const booked = queue.then(() => (file ? bookInFile(spacing).catch(() => book(spacing)) : book(spacing)));
      queue = booked.catch(() => {});
      return booked;
    },
  };
}

let processGate = null;
let processGateFile = null;
function processRateGate(env) {
  const file = typeof env.RADULATOR_NCBI_RATE_FILE === "string" && env.RADULATOR_NCBI_RATE_FILE
    ? env.RADULATOR_NCBI_RATE_FILE
    : null;
  if (!processGate || processGateFile !== file) {
    processGate = createRateGate({ file });
    processGateFile = file;
  }
  return processGate;
}

function describe(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause.message : error.cause?.code;
  return cause && !error.message.includes(cause) ? `${error.message} (${cause})` : error.message;
}

async function cancelBody(response) {
  try {
    await response?.body?.cancel?.();
  } catch {
    // Cleanup never replaces the failure being reported.
  }
}

// The body as bytes, read no further than `cap` bytes. Streams are preferred; test doubles may
// offer only arrayBuffer() or text().
async function readBody(response, cap) {
  const body = response.body;
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) {
          throw new Error("the response body yielded a malformed chunk");
        }
        const chunk = value instanceof ArrayBuffer
          ? Buffer.from(value)
          : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
        total += chunk.length;
        if (total > cap) {
          await reader.cancel().catch(() => {});
          return { overflow: true };
        }
        chunks.push(chunk);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Already released.
      }
    }
    return { bytes: Buffer.concat(chunks, total) };
  }
  let bytes;
  if (typeof response.arrayBuffer === "function") bytes = Buffer.from(await response.arrayBuffer());
  else if (typeof response.text === "function") bytes = Buffer.from(await response.text(), "utf8");
  else throw new Error("the response body is not readable");
  return bytes.length > cap ? { overflow: true } : { bytes };
}

function normalizePin(pin, verify) {
  if (pin === null || pin === undefined) return null;
  const kind = pin.kind ?? "raw";
  if (kind !== "raw" && kind !== "canonical") throw new TypeError(`unknown pin kind ${kind}`);
  if (!SHA256_HEX.test(pin.sha256 ?? "")) throw new TypeError("a pin needs a lowercase SHA-256");
  if (kind === "raw" && !(Number.isSafeInteger(pin.bytes) && pin.bytes > 0)) {
    throw new TypeError("a raw pin needs its byte length");
  }
  if (kind === "canonical" && typeof verify !== "function") {
    throw new TypeError("a canonical pin needs verify() to check it");
  }
  return { kind, sha256: pin.sha256, bytes: pin.bytes ?? null };
}

function checkRawPin(pin, bytes, label) {
  if (pin?.kind !== "raw") return;
  if (bytes.length !== pin.bytes) {
    throw new Error(`${label} byte length drifted (${bytes.length}, pinned ${pin.bytes})`);
  }
  const digest = sha256(bytes);
  if (digest !== pin.sha256) throw new Error(`${label} SHA-256 drifted (${digest}, pinned ${pin.sha256})`);
}

function cacheFiles(dir, key) {
  return { data: path.join(dir, `${key}.bin`), meta: path.join(dir, `${key}.json`) };
}

function readCache(dir, key) {
  const files = cacheFiles(dir, key);
  try {
    return { files, bytes: readFileSync(files.data) };
  } catch {
    return null;
  }
}

function writeAtomic(file, data) {
  const temporary = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  writeFileSync(temporary, data);
  renameSync(temporary, file);
}

// Fetches `url` (an https URL on an NCBI host, without api_key) and returns
//   { bytes, finalUrl, contentType, provenance: "live" | "cache", attempts, challenged }
// once the bytes pass every check. Options:
//   label           names the artifact in errors (default: the URL)
//   pin             { sha256, bytes } for the exact response bytes, or { kind: "canonical",
//                   sha256 } for a digest that verify() recomputes; also the cache key. Without a
//                   pin nothing is cached and the caller verifies the bytes before use.
//   verify          (bytes, response) => void; throws when the bytes are not the pinned artifact
//                   (a drift: fails at once). Runs before the raw pin check, so an audit keeps its
//                   own messages. On a cache hit response is null.
//   checkResponse   (response) => void; throws when a 200 response is not the expected artifact
//                   (final URL, media type, redirect). Retried. response.url has api_key removed.
//   isChallenge     (bytes, response) => boolean; a recognised challenge page
//                   (the three callbacks may be async)
//   challenge       "retry" (default) retries a recognised challenge; "return" hands it back at once,
//                   uncached, with challenged: true, for an audit that has its own verified fallback
//   minBytes        smaller responses are challenge pages and are retried (default: half a raw
//                   pin's length, otherwise 0)
//   maxBytes        a longer body is a drift (default 8 MiB)
//   headers, redirect, timeoutMs
//   fetchImpl, sleep, now, env, gate, note   injection points (see the header)
export async function fetchPinned(options) {
  const {
    url,
    label = url,
    verify,
    checkResponse,
    isChallenge,
    challenge = "retry",
    maxBytes = DEFAULT_MAX_BYTES,
    headers = {},
    redirect = "follow",
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options ?? {};
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !NCBI_HOSTS.includes(parsed.hostname) || parsed.username || parsed.password) {
    throw new TypeError(`fetchPinned only fetches https NCBI URLs, not ${parsed.origin}`);
  }
  if (/[?&]api_key=/i.test(url)) throw new TypeError("the canonical URL must not carry api_key");
  if (challenge !== "retry" && challenge !== "return") throw new TypeError(`unknown challenge mode ${challenge}`);
  const pin = normalizePin(options.pin, verify);
  const minBytes = options.minBytes ?? (pin?.kind === "raw" ? Math.floor(pin.bytes / 2) : 0);

  const injected = options.fetchImpl !== undefined && options.fetchImpl !== globalThis.fetch;
  const fetchImpl = injected ? options.fetchImpl : globalThis.fetch;
  const env = options.env ?? (injected ? {} : process.env);
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const gate = options.gate !== undefined ? options.gate : injected ? null : processRateGate(env);
  const note = options.note !== undefined
    ? options.note
    : injected ? null : (line) => process.stderr.write(`${line}\n`);

  const host = parsed.hostname;
  const key = keyOf(env);
  const keyed = Boolean(key) && API_KEY_HOSTS.includes(host);
  const requestUrl = requestUrlFor(url, key);
  const safe = (text) => redact(text, key);
  const logFile = typeof env.RADULATOR_SOURCE_FETCH_LOG === "string" && env.RADULATOR_SOURCE_FETCH_LOG
    ? env.RADULATOR_SOURCE_FETCH_LOG
    : null;
  const log = (record) => {
    if (!logFile) return;
    const line = {
      time: new Date(now()).toISOString(),
      audit: env.RADULATOR_SOURCE_AUDIT_ID ?? null,
      label,
      url,
      host,
      ...record,
    };
    try {
      appendFileSync(logFile, `${safe(JSON.stringify(line))}\n`);
    } catch {
      // The fetch log is evidence for the runner; failing to write it never fails an audit.
    }
  };
  const verifyBytes = async (bytes, response) => {
    if (verify) await verify(bytes, response);
    checkRawPin(pin, bytes, label);
  };

  const cacheDir = pin && typeof env.RADULATOR_SOURCE_CACHE_DIR === "string" && env.RADULATOR_SOURCE_CACHE_DIR
    ? env.RADULATOR_SOURCE_CACHE_DIR
    : null;
  let cacheRejected = false;
  if (cacheDir) {
    const cached = readCache(cacheDir, pin.sha256);
    if (cached) {
      try {
        if (cached.bytes.length < minBytes) throw new Error("cached entry is below the size floor");
        await verifyBytes(cached.bytes, null);
        let contentType = null;
        try {
          contentType = JSON.parse(readFileSync(cached.files.meta, "utf8")).content_type ?? null;
        } catch {
          // The sidecar is provenance only.
        }
        log({ status: null, outcome: "ok", provenance: "cache", bytes: cached.bytes.length });
        return { bytes: cached.bytes, finalUrl: url, contentType, provenance: "cache", attempts: 0, challenged: false };
      } catch {
        // A poisoned or stale entry: drop it and fetch the artifact again.
        cacheRejected = true;
        rmSync(cached.files.data, { force: true });
        rmSync(cached.files.meta, { force: true });
      }
    }
  }

  let lastFailure = "no attempt was made";
  let retryAfterMs = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      const wait = retryDelayMs(attempt - 1, retryAfterMs);
      note?.(safe(`${label}: attempt ${attempt - 1} of ${MAX_ATTEMPTS} failed (${lastFailure}); retrying in ${wait} ms`));
      await sleep(wait);
    }
    retryAfterMs = null;
    if (gate) {
      const pause = await gate.reserve(host, keyed);
      if (pause > 0) await sleep(pause);
    }
    const base = { attempt, provenance: "live", ...(cacheRejected && attempt === 1 ? { cache_rejected: true } : {}) };
    const retryable = (status, reason, response) => {
      lastFailure = reason;
      if (response) retryAfterMs = parseRetryAfter(response.headers?.get?.("retry-after") ?? null, now());
      log({ ...base, status, outcome: "transport", reason });
    };

    let response;
    try {
      response = await fetchImpl(requestUrl, { headers, redirect, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      retryable(null, safe(describe(error)));
      continue;
    }
    const status = response?.status;
    if (status !== 200) {
      await cancelBody(response);
      if (!isRetryableStatus(status, host)) {
        log({ ...base, status, outcome: "error", reason: `HTTP ${status}` });
        throw new NcbiFetchError(
          `${label} retrieval failed after ${attempt} of ${MAX_ATTEMPTS} attempts (HTTP ${status})`,
          { code: "http", attempts: attempt, status },
        );
      }
      retryable(status, `HTTP ${status}`, response);
      continue;
    }
    const view = {
      status,
      url: stripApiKey(response.url ?? ""),
      redirected: response.redirected === true,
      headers: response.headers,
    };
    try {
      await checkResponse?.(view);
    } catch (error) {
      await cancelBody(response);
      retryable(status, safe(describe(error)));
      continue;
    }
    let read;
    try {
      read = await readBody(response, maxBytes);
    } catch (error) {
      retryable(status, safe(`${label} body could not be read: ${describe(error)}`));
      continue;
    }
    if (read.overflow) {
      const message = `${label} body exceeds the ${maxBytes}-byte boundary`;
      log({ ...base, status, outcome: "drift", reason: message });
      throw new NcbiFetchError(message, { code: "drift", attempts: attempt, status });
    }
    const { bytes } = read;
    const contentType = response.headers?.get?.("content-type") ?? null;
    if (await isChallenge?.(bytes, view)) {
      if (challenge === "return") {
        log({ ...base, status, outcome: "ok", challenge: true, bytes: bytes.length });
        return { bytes, finalUrl: safe(view.url), contentType, provenance: "live", attempts: attempt, challenged: true };
      }
      retryable(status, `${label} served a challenge page (${bytes.length} bytes)`);
      continue;
    }
    if (bytes.length < minBytes) {
      retryable(status, `${label} response is unexpectedly small (${bytes.length} bytes; likely a challenge page)`);
      continue;
    }
    try {
      await verifyBytes(bytes, view);
    } catch (error) {
      const message = safe(error instanceof Error ? error.message : String(error));
      log({ ...base, status, outcome: "drift", bytes: bytes.length, reason: message });
      throw new NcbiFetchError(message, { code: "drift", attempts: attempt, status });
    }
    const digest = sha256(bytes);
    log({ ...base, status, outcome: "ok", bytes: bytes.length, sha256: digest });
    if (cacheDir) {
      try {
        mkdirSync(cacheDir, { recursive: true });
        const files = cacheFiles(cacheDir, pin.sha256);
        writeAtomic(files.data, bytes);
        writeAtomic(files.meta, `${safe(JSON.stringify({
          schema: CACHE_SCHEMA,
          key: pin.sha256,
          pin,
          url,
          host,
          content_type: contentType,
          bytes: bytes.length,
          sha256: digest,
          provenance: "live",
          fetched_at: new Date(now()).toISOString(),
          audit: env.RADULATOR_SOURCE_AUDIT_ID ?? null,
          audit_attempt: env.RADULATOR_SOURCE_AUDIT_ATTEMPT ?? null,
          run_id: env.GITHUB_RUN_ID ?? null,
          run_attempt: env.GITHUB_RUN_ATTEMPT ?? null,
        }, null, 2))}\n`);
      } catch {
        // A cache that cannot be written only costs a later request.
      }
    }
    return { bytes, finalUrl: safe(view.url), contentType, provenance: "live", attempts: attempt, challenged: false };
  }
  throw new NcbiFetchError(
    `${label} retrieval failed after ${MAX_ATTEMPTS} of ${MAX_ATTEMPTS} attempts (${lastFailure})`,
    { code: "transport", attempts: MAX_ATTEMPTS },
  );
}
