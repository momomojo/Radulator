#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

import {
  SOURCE_FETCH_ATTEMPTS,
  fetchWithRetry,
  retryDelayMs,
} from "./audit-kbrc-source-fetch.mjs";

// Deterministic retrieval-policy tests (no network): a fake fetch, clock and sleep drive the same
// fetchWithRetry the live audit below uses.
function fakeResponse(status, retryAfter) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(retryAfter === undefined ? {} : { "retry-after": String(retryAfter) }),
    arrayBuffer: async () => new TextEncoder().encode("source-bytes").buffer,
    body: { cancel: async () => {} },
  };
}
async function drive(script) {
  const queue = [...script];
  const sleeps = [];
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return typeof next === "number" ? fakeResponse(next) : next;
  };
  try {
    const bytes = await fetchWithRetry("https://source.example/kbrc.pdf", {
      fetchImpl,
      sleep: async (ms) => { sleeps.push(ms); },
      now: () => 1_000_000,
    });
    return { ok: true, text: bytes.toString(), calls, sleeps };
  } catch (error) {
    return { ok: false, message: error.message, calls, sleeps };
  }
}

let outcome = await drive([503, 503, 503, 503, 200]);
assert.deepEqual([outcome.ok, outcome.text, outcome.calls], [true, "source-bytes", 5], "four 5xx then success");
assert.deepEqual(outcome.sleeps, [1_000, 2_000, 4_000, 8_000], "exponential backoff 1/2/4/8 s");

outcome = await drive([503, 503, 503, 503, 503, 200]);
assert.equal(outcome.ok, false, "five failures exhaust the attempts");
assert.equal(outcome.calls, SOURCE_FETCH_ATTEMPTS);
assert.match(outcome.message, /retrieval failed after 5 attempts \(HTTP 503\)/, "fails loudly at the end");

outcome = await drive([404, 200]);
assert.deepEqual([outcome.ok, outcome.calls, outcome.sleeps], [false, 1, []], "non-retryable 4xx stops at once");
assert.match(outcome.message, /HTTP 404/);

outcome = await drive([fakeResponse(429, 3), 200]);
assert.deepEqual([outcome.ok, outcome.sleeps], [true, [3_000]], "429 honours Retry-After seconds");

outcome = await drive([fakeResponse(503, new Date(1_012_000).toUTCString()), 200]);
assert.deepEqual(outcome.sleeps, [12_000], "Retry-After HTTP-date is measured from now");

outcome = await drive([fakeResponse(503, 120), 200]);
assert.deepEqual(outcome.sleeps, [30_000], "delays are clamped to 30 s");

outcome = await drive([fakeResponse(503, new Date(0).toUTCString()), 200]);
assert.deepEqual(outcome.sleeps, [0], "a past Retry-After date waits 0 s");

outcome = await drive([new Error("socket hang up"), 200]);
assert.deepEqual([outcome.ok, outcome.calls, outcome.sleeps], [true, 2, [1_000]], "network errors are retried");

assert.equal(retryDelayMs(undefined, 3), 4_000);

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-kbrc-primary-source.mjs",
    "--json",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);

assert.equal(
  run.status,
  0,
  `primary-source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);
const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-kbrc-primary-source-audit/v1");
assert.equal(audit.article_pmcid, "PMC13156734");
assert.equal(audit.archive_member, "mmc1.pdf");
assert.equal(
  audit.direct_pdf_url,
  "https://ars.els-cdn.com/content/image/1-s2.0-S2590059526001135-mmc1.pdf",
);
assert.ok(
  ["direct-publisher-pdf", "europe-pmc-archive-fallback"].includes(
    audit.supplement_retrieval,
  ),
);
assert.equal(audit.archive_member_bytes, 3696579);
assert.equal(
  audit.archive_member_sha256,
  "d05d344c32a94e797587c5cb79896117026199d0dacd36ea1c0f28856848f6f5",
);
assert.equal(audit.license, "CC BY-NC-ND 4.0");
assert.equal(audit.equation_term_count, 22);
assert.deepEqual(audit.source_example_displays, ["2.5%", "1.0%", "7.4%", "0.4%"]);
assert.deepEqual(audit.calibration_warning, {
  source_locator: "full-text XML paragraph p0130",
  threshold_probability: 0.25,
  calibration_direction: "overpredict",
});
assert.equal(audit.runtime_calibration_warning_match, true);
assert.deepEqual(audit.input_limits, {
  provenance: "radulator-data-entry-guardrail",
  publication_derived: false,
  values: {
    age: { min: 18, max: 90, unit: "years" },
    weight: { min: 30, max: 130, unit: "kg" },
    height: { min: 140, max: 210, unit: "cm" },
    platelets: { min: 50, max: 700, unit: "×10⁹/L" },
    hemoglobin: { min: 70, max: 180, unit: "g/L" },
    kidney_size: { min: 8, max: 16, unit: "cm" },
  },
});
assert.equal(audit.runtime_input_limit_claims_match, true);
assert.equal(audit.runtime_equation_match, true);
assert.equal(audit.runtime_vector_match, true);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "KBRC primary-source integration audit verified the live supplement member, 22 equation terms, 4 source examples, the p0130 calibration warning, and app-only input-limit provenance.",
);
