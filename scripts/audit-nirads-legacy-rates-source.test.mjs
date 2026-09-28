#!/usr/bin/env node
// Exact-head test for scripts/audit-nirads-legacy-rates-source.mjs: runs the live audit, then proves each
// check fails when its source, statement, runtime text or runtime output is changed.
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

// 1. Live: the pinned PubMed records bind the runtime at this head.
const fetched = await audit.fetchSource();
const result = audit.runAudit({ xml: fetched.xml, nirads });
assert.deepEqual(result.facts.rates, [3.79, 17.2, 59.4]);
assert.equal(result.facts.total, 618);
console.log(audit.passLine(result));

const fails = (fn, pattern, label) => assert.throws(fn, pattern, `mutation not detected: ${label}`);
const withInfo = (text) => ({ ...nirads, info: { ...nirads.info, text } });
const withCompute = (compute) => ({ ...nirads, compute });

// 2. Source mutations.
fails(() => audit.runAudit({ xml: fetched.xml.replace("3.79%", "4.79%"), nirads }), /normalized record drifted/, "rate edit in the Krieger abstract");
fails(() => audit.runAudit({ xml: fetched.xml.replace(/<PMID[^>]*>40754125<\/PMID>/, "<PMID>1</PMID>"), nirads }), /PMID 40754125 missing/, "missing Bunch record");
const records = audit.parseRecords(fetched.xml);
const edited = structuredClone(records);
edited["40754125"].abstract[0][1] = edited["40754125"].abstract[0][1].replace("specific to CT and", "specific to MR and");
fails(() => audit.verifyStatements(edited), /bunch-2018-paradigm-ct-pet: pinned statement drifted/, "one-word edit inside a pinned span");
fails(
  () => audit.verifyStatements(records, [{ ...audit.STATEMENTS[0], from: "A total of 318 scans and 618" }]),
  /marker longer than six words/,
  "seven-word marker",
);

// 3. Runtime text mutations.
const info = nirads.info.text;
fails(() => audit.bindRuntime(withInfo(info.replace("• NI-RADS 2: ~17%", "• NI-RADS 2: ~18%")), result.facts), /rounded Krieger rates/, "changed info rate");
fails(() => audit.bindRuntime(withInfo(info.replace("618 primary-site", "600 primary-site")), result.facts), /sourced legacy-rate heading/, "changed target count");
fails(() => audit.bindRuntime(withInfo(info.replace(audit.INFO_SCOPE, "")), result.facts), /not MRI v2025 estimates/, "removed scope sentence");
fails(() => audit.bindRuntime(withInfo(info.replace(audit.INFO_MRI_OUTPUT, "")), result.facts), /show no estimated recurrence risk/, "removed MRI output sentence");
fails(() => audit.bindRuntime(withInfo(`About ~5% of cases.\n${info}`), result.facts), /no percentage may appear before/, "percentage before the heading");

// 4. Runtime output mutations.
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

// 5. Response identity and retry policy.
fails(() => audit.verifyResponse({ finalUrl: "https://example.org/entrez/eutils/efetch.fcgi?db=pubmed&id=28364010,40754125&retmode=xml", contentType: "text/xml" }), /final URL host/, "wrong host");
fails(() => audit.verifyResponse({ finalUrl: audit.SOURCE.url, contentType: "text/html" }), /media type/, "wrong media type");
const stub = (statuses) => {
  let calls = 0;
  const fetchImpl = async () => {
    const status = statuses[Math.min(calls, statuses.length - 1)];
    calls += 1;
    return {
      ok: status === 200,
      status,
      url: audit.SOURCE.url,
      headers: new Headers({ "content-type": "text/xml; charset=UTF-8" }),
      text: async () => fetched.xml,
      body: null,
    };
  };
  return { fetchImpl, calls: () => calls };
};
const transient = stub([400, 429, 503, 200]);
await audit.fetchSource({ fetchImpl: transient.fetchImpl, sleep: async () => {} });
assert.equal(transient.calls(), 4, "400, 429 and 5xx are retried");
const permanent = stub([404]);
await assert.rejects(audit.fetchSource({ fetchImpl: permanent.fetchImpl, sleep: async () => {} }), /HTTP 404/);
assert.equal(permanent.calls(), 1, "404 is not retried");

console.log("NI-RADS legacy-rate audit mutations: 15/15 detected");
