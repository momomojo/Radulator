#!/usr/bin/env node
// Exact-head test for scripts/audit-nirads-legacy-rates-source.mjs: runs the live audit, then proves each
// check fails when its source bytes, statement, runtime text or runtime output is changed.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);

// Smoke runs this file with plain `node`; NIRADS.jsx needs the repo's JSX loader.
if (!process.env.RADULATOR_NIRADS_AUDIT_CHILD) {
  const run = spawnSync(process.execPath, ["--import", "./scripts/register-jsx-loader.mjs", self], {
    cwd: path.resolve(path.dirname(self), ".."),
    encoding: "utf8",
    env: { ...process.env, RADULATOR_NIRADS_AUDIT_CHILD: "1" },
  });
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr.split("\n").filter((line) => !/DeprecationWarning|trace-deprecation/.test(line)).join("\n"));
  process.exit(run.status ?? 1);
}

const audit = await import("./audit-nirads-legacy-rates-source.mjs");
const nirads = await audit.loadRuntime();
const KRIEGER = "28364010";
const BUNCH = "40754125";

// 1. Live: the byte-pinned PubMed records bind the runtime at this head.
const sources = await audit.fetchSources();
const result = audit.runAudit({ sources, nirads });
assert.deepEqual(result.facts.rates, [3.79, 17.2, 59.4]);
assert.equal(result.facts.total, 618);
console.log(audit.passLine(result));

let detected = 0;
const fails = (fn, pattern, label) => {
  assert.throws(fn, pattern, `mutation not detected: ${label}`);
  detected += 1;
};
const failsAsync = async (promise, pattern, label) => {
  await assert.rejects(promise, pattern, `mutation not detected: ${label}`);
  detected += 1;
};
const withSource = (pmid, bytes) => ({ ...sources, [pmid]: bytes });
const edit = (bytes, from, to) => {
  const text = bytes.toString("utf8");
  assert.ok(text.includes(from), `test fixture lacks ${from}`);
  return Buffer.from(text.replace(from, to), "utf8");
};
const withInfo = (text) => ({ ...nirads, info: { ...nirads.info, text } });
const withCompute = (compute) => ({ ...nirads, compute });

// 2. Source byte pins: digest and length drift, a missing record, and a drifted 200 that is not retried.
fails(() => audit.runAudit({ sources: withSource(KRIEGER, edit(sources[KRIEGER], "3.79%", "4.79%")), nirads }), /source SHA-256 drifted/, "same-length edit of the Krieger bytes");
fails(() => audit.runAudit({ sources: withSource(KRIEGER, Buffer.concat([sources[KRIEGER], Buffer.from("\n")])), nirads }), /source byte length drifted/, "one extra byte");
fails(() => audit.runAudit({ sources: withSource(BUNCH, undefined), nirads }), /source bytes missing/, "missing Bunch record");
const response = (bytes, status = 200, overrides = {}) => ({
  ok: status === 200,
  status,
  url: audit.SOURCES[KRIEGER].url,
  headers: new Headers({ "content-type": "text/plain; charset=UTF-8" }),
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  body: null,
  ...overrides,
});
let driftCalls = 0;
await failsAsync(
  audit.fetchSource(KRIEGER, {
    fetchImpl: async () => {
      driftCalls += 1;
      return response(edit(sources[KRIEGER], "3.79%", "4.79%"));
    },
    sleep: async () => {},
  }),
  /source SHA-256 drifted/,
  "drifted source served with HTTP 200",
);
assert.equal(driftCalls, 1, "a drifted source is a changed source, never retried");

// 3. Record identity and statement pins (checked independently of the byte pins).
const records = {};
for (const pmid of Object.keys(audit.SOURCES)) records[pmid] = audit.parseRecordText(sources[pmid].toString("utf8"));
fails(() => audit.verifyRecord(KRIEGER, { ...records[KRIEGER], doi: "10.3174/ajnr.A0000" }), /DOI drifted/, "changed DOI");
fails(() => audit.verifyRecord(BUNCH, { ...records[BUNCH], year: "2016" }), /publication year drifted/, "changed year");
const editedBunch = { ...records, [BUNCH]: { ...records[BUNCH], abstract: records[BUNCH].abstract.replace("specific to CT and", "specific to MR and") } };
fails(() => audit.verifyStatements(editedBunch), /bunch-2018-paradigm-ct-pet: pinned statement drifted/, "one-word edit inside a pinned span");
fails(
  () => audit.verifyStatements(records, [{ ...audit.STATEMENTS[0], from: "A total of 318 scans and 618" }]),
  /marker longer than six words/,
  "seven-word marker",
);

// 4. Runtime text mutations.
const info = nirads.info.text;
fails(() => audit.bindRuntime(withInfo(info.replace("• NI-RADS 2: ~17%", "• NI-RADS 2: ~18%")), result.facts), /rounded Krieger rates/, "changed info rate");
fails(() => audit.bindRuntime(withInfo(info.replace("618 primary-site", "600 primary-site")), result.facts), /sourced legacy-rate heading/, "changed target count");
fails(() => audit.bindRuntime(withInfo(info.replace(audit.INFO_SCOPE, "")), result.facts), /not MRI v2025 estimates/, "removed scope sentence");
fails(() => audit.bindRuntime(withInfo(info.replace(audit.INFO_MRI_OUTPUT, "")), result.facts), /show no estimated recurrence risk/, "removed MRI output sentence");
fails(() => audit.bindRuntime(withInfo(`About ~5% of cases.\n${info}`), result.facts), /no percentage may appear before/, "percentage before the heading");

// 5. Runtime output mutations.
fails(
  () => audit.bindRuntime(withCompute((vals) => ({ ...nirads.compute(vals), ...(vals.nirads_version === "mri_2025" ? { "Estimated Recurrence Risk": "~4%" } : {}) })), result.facts),
  /must carry no risk estimate/,
  "MRI output with a risk estimate",
);
fails(
  () => audit.bindRuntime(withCompute((vals) => {
    const out = nirads.compute(vals);
    return out["Estimated Recurrence Risk"] === "~17%" ? { ...out, "Estimated Recurrence Risk": "~18%" } : out;
  }), result.facts),
  /equal the rounded Krieger rate/,
  "2018 risk output that no longer matches the source",
);

// 5b. 2018 CT/PET-CT path must stay CT/PET-CT only (Bunch 2025).
const withMriOption = {
  ...nirads,
  fields: nirads.fields.map((field) => (field.id === "modality" ? { ...field, opts: [...field.opts, { value: "mri", label: "MRI" }] } : field)),
};
fails(() => audit.bindRuntime(withMriOption, result.facts), /CT and PET\/CT only/, "MRI re-added to the 2018 modality options");
fails(
  () => audit.bindRuntime(withCompute((vals) => (vals.modality === "mri" ? nirads._compute2018({ ...vals, modality: "cect" }) : nirads.compute(vals))), result.facts),
  /must fail closed|never receive a 2018/,
  "MRI input receiving 2018 categories and rates",
);
fails(
  () => audit.bindRuntime(withCompute((vals) => (!vals.modality && vals.nirads_version !== "mri_2025" ? nirads._compute2018({ ...vals, modality: "cect" }) : nirads.compute(vals))), result.facts),
  /without a modality/,
  "input without a modality receiving 2018 categories and rates",
);

// 6. Response identity and retry policy.
fails(() => audit.verifyResponse(KRIEGER, { finalUrl: audit.SOURCES[KRIEGER].url.replace("eutils.ncbi.nlm.nih.gov", "example.org"), contentType: "text/plain" }), /final URL host/, "wrong host");
fails(() => audit.verifyResponse(KRIEGER, { finalUrl: audit.SOURCES[KRIEGER].url.replace("retmode=text", "retmode=xml"), contentType: "text/plain" }), /final URL query retmode/, "wrong format");
fails(() => audit.verifyResponse(KRIEGER, { finalUrl: audit.SOURCES[KRIEGER].url, contentType: "text/xml" }), /media type/, "wrong media type");
let transientCalls = 0;
const transientStatuses = [400, 429, 503, 200];
const transientSleeps = [];
await audit.fetchSource(KRIEGER, {
  fetchImpl: async () => response(sources[KRIEGER], transientStatuses[transientCalls++]),
  sleep: async (ms) => { transientSleeps.push(ms); },
});
assert.equal(transientCalls, 4, "400, 429 and 5xx are retried");
assert.deepEqual(transientSleeps, [1_500, 3_000, 6_000], "without Retry-After the exponential backoff applies, never an immediate retry");
const retryAfterSleeps = [];
let retryAfterCalls = 0;
const retryAfterHeaders = ["2", "120", ""];
await audit.fetchSource(KRIEGER, {
  fetchImpl: async () => {
    const call = retryAfterCalls++;
    if (call === retryAfterHeaders.length) return response(sources[KRIEGER]);
    return response(sources[KRIEGER], 429, {
      headers: new Headers({ "content-type": "text/plain; charset=UTF-8", "retry-after": retryAfterHeaders[call] }),
    });
  },
  sleep: async (ms) => { retryAfterSleeps.push(ms); },
});
assert.deepEqual(retryAfterSleeps, [2_000, 20_000, 6_000], "Retry-After is honoured, capped at 20 s, and an empty header falls back to backoff");
let permanentCalls = 0;
await failsAsync(
  audit.fetchSource(KRIEGER, {
    fetchImpl: async () => {
      permanentCalls += 1;
      return response(sources[KRIEGER], 404);
    },
    sleep: async () => {},
  }),
  /after 1 of 5 attempts \(HTTP 404\)/,
  "404 fails at once with the real attempt count",
);
assert.equal(permanentCalls, 1, "404 is not retried");

console.log(`NI-RADS legacy-rate audit mutations: ${detected}/${detected} detected`);
