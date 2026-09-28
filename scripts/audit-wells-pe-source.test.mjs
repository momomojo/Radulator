#!/usr/bin/env node
// Exact-head test for scripts/audit-wells-pe-source.mjs: runs the live audit, then proves each check
// fails when its source bytes, record, statement, runtime text or runtime output is changed.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);

// Smoke runs this file with plain `node`; WellsPE.jsx needs the repo's JSX loader.
if (!process.env.RADULATOR_WELLS_PE_AUDIT_CHILD) {
  const run = spawnSync(process.execPath, ["--import", "./scripts/register-jsx-loader.mjs", self], {
    cwd: path.resolve(path.dirname(self), ".."),
    encoding: "utf8",
    env: { ...process.env, RADULATOR_WELLS_PE_AUDIT_CHILD: "1" },
  });
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr.split("\n").filter((line) => !/DeprecationWarning|trace-deprecation/.test(line)).join("\n"));
  process.exit(run.status ?? 1);
}

const audit = await import("./audit-wells-pe-source.mjs");
const wellsPE = await audit.loadRuntime();
const { WELLS_2000, WELLS_2001, CHRISTOPHER } = audit;

// 1. Live: the byte-pinned PubMed records bind the runtime at this head.
const sources = await audit.fetchSources();
const result = audit.runAudit({ sources, wellsPE });
const { facts } = result;
assert.deepEqual(facts.items.map((item) => item.weight), [3, 3, 1.5, 1.5, 1.5, 1, 1]);
assert.deepEqual([facts.lowBelow, facts.highAbove, facts.unlikelyAtMost], [2, 6, 4]);
assert.deepEqual(facts.tierRates, ["1.3", "16.2", "37.5"]);
assert.deepEqual(facts.christopher, { combined: 1057, untreated: 1028, events: 5, rate: "0.5", ciLow: "0.2", ciHigh: "1.1", months: 3 });
assert.deepEqual(facts.lowTierNegativeDimer, { npv: "99.5", npvLow: "99.1", npvHigh: "100" });
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
const withInfo = (text) => ({ ...wellsPE, info: { ...wellsPE.info, text } });
const withCompute = (change) => ({
  ...wellsPE,
  compute: (vals) => {
    const out = { ...wellsPE.compute(vals) };
    change(out, parseFloat(out["Wells Score"]), vals);
    return out;
  },
});
const replaceInfo = (from, to) => {
  assert.ok(wellsPE.info.text.includes(from), `info text lacks ${from}`);
  return withInfo(wellsPE.info.text.replace(from, to));
};

// 2. Source byte pins: same-length digest drift, length drift, a missing record, and a drifted 200.
fails(() => audit.runAudit({ sources: withSource(WELLS_2000, edit(sources[WELLS_2000], "7.8%", "7.9%")), wellsPE }), /source SHA-256 drifted/, "same-length edit of the Wells 2000 bytes");
fails(() => audit.runAudit({ sources: withSource(WELLS_2001, Buffer.concat([sources[WELLS_2001], Buffer.from("\n")])), wellsPE }), /source byte length drifted/, "one extra byte in the Wells 2001 record");
fails(() => audit.runAudit({ sources: withSource(CHRISTOPHER, undefined), wellsPE }), /source bytes missing/, "missing Christopher Study record");
const response = (pmid, bytes, status = 200, overrides = {}) => ({
  ok: status === 200,
  status,
  url: audit.SOURCES[pmid].url,
  headers: new Headers({ "content-type": "text/plain; charset=UTF-8" }),
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  body: null,
  ...overrides,
});
let driftCalls = 0;
await failsAsync(
  audit.fetchSource(CHRISTOPHER, {
    fetchImpl: async () => {
      driftCalls += 1;
      return response(CHRISTOPHER, edit(sources[CHRISTOPHER], "0.5% [95%", "0.4% [95%"));
    },
    sleep: async () => {},
  }),
  /source SHA-256 drifted/,
  "drifted source served with HTTP 200",
);
assert.equal(driftCalls, 1, "a drifted source is a changed source, never retried");

// 3. Record identity, abstract layout and statement pins (checked independently of the byte pins).
const records = {};
for (const pmid of Object.keys(audit.SOURCES)) records[pmid] = audit.parseRecordText(sources[pmid].toString("utf8"));
fails(() => audit.verifyRecord(WELLS_2001, { ...records[WELLS_2001], doi: "10.7326/0000-0000" }), /DOI drifted/, "changed DOI");
fails(() => audit.verifyRecord(CHRISTOPHER, { ...records[CHRISTOPHER], year: "2005" }), /publication year drifted/, "changed year");
fails(
  () => audit.verifyRecord(WELLS_2001, { ...records[WELLS_2001], sections: records[WELLS_2001].sections.filter((section) => section.label !== "SETTING") }),
  /abstract sections drifted/,
  "changed abstract layout",
);
const editedChristopher = {
  ...records,
  [CHRISTOPHER]: {
    ...records[CHRISTOPHER],
    sections: records[CHRISTOPHER].sections.map((section) =>
      section.label === "RESULTS" ? { ...section, text: section.text.replace("subsequent nonfatal VTE", "subsequent nonfatal DVT") } : section,
    ),
  },
};
fails(() => audit.verifyStatements(editedChristopher), /christopher-unlikely-normal: pinned statement drifted/, "one-word edit inside a pinned span");
fails(
  () => audit.verifyStatements(records, [{ ...audit.STATEMENTS[0], from: `${audit.STATEMENTS[0].from} plus two` }]),
  /marker longer than six words/,
  "seven-word marker",
);

// 4. Runtime items, version and references.
const swapped = [...wellsPE.fields];
[swapped[2], swapped[3]] = [swapped[3], swapped[2]];
fails(() => audit.bindRuntime({ ...wellsPE, fields: swapped }, facts), /seven Wells 2000 items in rule order/, "items out of rule order");
fails(
  () => audit.bindRuntime({ ...wellsPE, fields: wellsPE.fields.map((field) => (field.id === "alternative_less_likely" ? { ...field, label: "PE is #1 diagnosis OR equally likely" } : field)) }, facts),
  /alternative_less_likely must name Wells 2000 item 2/,
  "alternative-diagnosis label reverted",
);
fails(() => audit.bindRuntime({ ...wellsPE, guidelineVersion: "Wells Criteria (2001)" }, facts), /guidelineVersion must name Wells 2000/, "changed guideline version");
fails(
  () => audit.bindRuntime({ ...wellsPE, refs: wellsPE.refs.filter((ref) => !ref.u.includes("jama.295.2.172")) }, facts),
  /references must link PMID 16403929/,
  "Christopher Study reference removed",
);

// 5. Runtime text mutations.
fails(() => audit.bindRuntime(replaceInfo("• Low probability: <2 points", "• Low probability: 0-1 points"), facts), /band line "• Low probability: <2 points"/, "low band reverted to 0-1");
fails(() => audit.bindRuntime(replaceInfo("16.2% of moderate", "20.5% of moderate"), facts), /Wells 2001 tier PE rates/, "changed tier PE rate");
fails(() => audit.bindRuntime(replaceInfo("0.5% (95% CI 0.2–1.1%) had", "0.4% (95% CI 0.2–1.1%) had"), facts), /Christopher Study outcome/, "changed Christopher Study rate");
fails(() => audit.bindRuntime(replaceInfo("With the SimpliRED D-dimer", "With the D-dimer"), facts), /SimpliRED rates/, "assay attribution removed");
fails(() => audit.bindRuntime(withInfo(`${wellsPE.info.text}\n• PE Unlikely + negative D-dimer = PE excluded (NPV >99%)`), facts), /must not claim NPV >99% or exclusion/, "NPV >99% claim restored");
fails(() => audit.bindRuntime(withInfo(`${wellsPE.info.text}\nAbout 34% of PE-likely patients have PE.`), facts), /info text: unsourced percentage 34%/, "unsourced prevalence added");
fails(
  () => audit.bindRuntime(replaceInfo(audit.expectedText(facts).scope, "This calculator follows the 2001 Wells criteria with PERC rule integration"), facts),
  /which Wells score the calculator implements/,
  "scope line reverted",
);

// 6. Runtime output mutations.
fails(() => audit.bindRuntime(withCompute((out, score, vals) => { if (vals.heart_rate) out["Wells Score"] = `${score - 0.5} points`; }), facts), /heart_rate must weigh 1.5 points/, "changed weight");
fails(() => audit.bindRuntime(withCompute((out, score) => { if (score === 1.5) out["3-Tier Assessment"] = audit.expectedText(facts).threeTier.Moderate; }), facts), /three-tier result must follow the Wells 2000 cut points/, "1.5 points scored Moderate");
fails(() => audit.bindRuntime(withCompute((out, score) => { if (score === 4) out["2-Tier Assessment (Recommended)"] = "PE Likely"; }), facts), /two-tier result must follow the Wells 2000 split/, "4 points scored PE likely");
fails(
  () => audit.bindRuntime(withCompute((out, score) => { if (score <= 4) out.Recommendation = "D-dimer testing recommended. If negative, PE is effectively excluded (NPV >99%). If positive, proceed to CTPA."; }), facts),
  /recommendation must carry the Christopher Study outcome/,
  "recommendation reverted to the NPV claim",
);
fails(
  () => audit.bindRuntime(withCompute((out, score) => { if (score === 3) out["Clinical Notes"] = "Consider PERC rule in very low-risk patients (score 0-1) to avoid unnecessary D-dimer testing"; }), facts),
  /PERC note must follow the Wells 2000 low band/,
  "PERC note shown outside the low band",
);
fails(() => audit.bindRuntime(withCompute((out) => { out.Prevalence = "~34%"; }), facts), /unsourced percentage 34%/, "unsourced output percentage");
fails(() => audit.bindRuntime(withCompute((out) => { out["Clinical Notes"] = `${out["Clinical Notes"] ?? ""}; NPV >99% with a negative D-dimer`; }), facts), /must not claim NPV >99% or exclusion/, "NPV claim in an output note");

// 7. Response identity and retry policy.
fails(() => audit.verifyResponse(WELLS_2000, { finalUrl: audit.SOURCES[WELLS_2000].url.replace("eutils.ncbi.nlm.nih.gov", "example.org"), contentType: "text/plain" }), /final URL host/, "wrong host");
fails(() => audit.verifyResponse(WELLS_2000, { finalUrl: audit.SOURCES[WELLS_2000].url.replace("retmode=text", "retmode=xml"), contentType: "text/plain" }), /final URL query retmode/, "wrong format");
fails(() => audit.verifyResponse(WELLS_2000, { finalUrl: audit.SOURCES[WELLS_2000].url, contentType: "text/xml" }), /media type/, "wrong media type");
let transientCalls = 0;
const transientStatuses = [400, 429, 503, 200];
await audit.fetchSource(WELLS_2000, {
  fetchImpl: async () => response(WELLS_2000, sources[WELLS_2000], transientStatuses[transientCalls++]),
  sleep: async () => {},
});
assert.equal(transientCalls, 4, "400, 429 and 5xx are retried");
let permanentCalls = 0;
await failsAsync(
  audit.fetchSource(WELLS_2000, {
    fetchImpl: async () => {
      permanentCalls += 1;
      return response(WELLS_2000, sources[WELLS_2000], 404);
    },
    sleep: async () => {},
  }),
  /after 1 of 5 attempts \(HTTP 404\)/,
  "404 fails at once with the real attempt count",
);
assert.equal(permanentCalls, 1, "404 is not retried");

console.log(`Wells PE source audit mutations: ${detected}/${detected} detected`);
