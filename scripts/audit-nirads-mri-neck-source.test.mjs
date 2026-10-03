#!/usr/bin/env node
// Exact-head test for scripts/audit-nirads-mri-neck-source.mjs: runs the live audit, then proves each
// check fails when its source bytes, statements, table facts or runtime classification is changed.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);

// Smoke runs this file with plain `node`; NIRADS.jsx needs the repo's JSX loader.
if (!process.env.RADULATOR_NIRADS_MRI_AUDIT_CHILD) {
  const run = spawnSync(process.execPath, ["--import", "./scripts/register-jsx-loader.mjs", self], {
    cwd: path.resolve(path.dirname(self), ".."),
    encoding: "utf8",
    env: { ...process.env, RADULATOR_NIRADS_MRI_AUDIT_CHILD: "1" },
  });
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr.split("\n").filter((line) => !/DeprecationWarning|trace-deprecation/.test(line)).join("\n"));
  process.exit(run.status ?? 1);
}

const audit = await import("./audit-nirads-mri-neck-source.mjs");
const runtime = await audit.loadRuntime();

// 1. Live: the byte-pinned ACR table binds the runtime at this head.
const bytes = await audit.fetchSource();
const result = await audit.runAudit({ bytes, runtime });
assert.deepEqual(result.facts.newNodeCategories, ["2", "3"]);
assert.equal(result.facts.minimumNewNodeCategory, 2);
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

// 2. Source bytes: same-length digest drift, byte-length drift, missing bytes.
const flipped = Buffer.from(bytes);
flipped[Math.floor(flipped.length / 2)] ^= 0x01;
fails(() => audit.verifySourceBytes(flipped), /source SHA-256 drifted/, "same-length edit of the ACR PDF bytes");
fails(() => audit.verifySourceBytes(Buffer.concat([bytes, Buffer.from("\n")])), /source byte length drifted/, "one extra byte");
fails(() => audit.verifySourceBytes(undefined), /source bytes missing/, "missing ACR PDF");

// 3. Statements: each pinned span must be exact.
const { sections, spans } = result;
const withSection = (name, from, to) => {
  assert.ok(sections[name].includes(from), `test fixture lacks ${from}`);
  return { ...sections, [name]: sections[name].replace(from, to) };
};
fails(
  () => audit.verifyStatements(withSection("row-2", "without definitive abnormal", "without definite abnormal")),
  /acr-neck-2-new-node: pinned statement/,
  "neck 2 new-node descriptor edited",
);
fails(
  () => audit.verifyStatements(withSection("row-3", "with necrosis, cystic change", "with necrosis or cystic change")),
  /acr-neck-3-new-node-suspicious: pinned statement/,
  "neck 3 new-node descriptor edited",
);
fails(
  () => audit.verifyStatements(withSection("row-4", "Pathologically proven or definite", "Pathologically proven or probable")),
  /acr-neck-4-definitive|start marker not found/,
  "category 4 descriptor edited",
);
fails(
  () => audit.verifyStatements(withSection("notes", "Neck (2, 3)", "Neck (1, 2, 3)")),
  /start marker not found|acr-new-node-footnote-neck-2-3/,
  "new-node footnote categories edited",
);

// 4. Table facts: category 1 must not describe a new node; the footnote must match the rows.
fails(
  () => audit.extractFacts({ ...sections, "row-1": `${sections["row-1"]} • New or enlarging lymph node that is small` }, spans),
  /only the category 2 and 3 rows|category 1 row/,
  "category 1 row gains a new-node descriptor",
);
fails(
  () => audit.extractFacts(sections, { ...spans, "acr-new-node-footnote-neck-2-3": spans["acr-new-node-footnote-neck-2-3"].replace("Neck (2, 3)", "Neck (3)") }),
  /footnote categories must match/,
  "footnote narrowed to category 3",
);
fails(() => audit.sectionsFromPages([sections["row-1"], sections.notes]), /table row|title marker/, "table rows missing");

// 5. Runtime: pattern categories and the classifier's new/enlarging-node behaviour.
const withPattern = (id, change) => ({
  ...runtime,
  MRI_2025_PATTERN_DEFINITIONS: {
    ...runtime.MRI_2025_PATTERN_DEFINITIONS,
    [id]: { ...runtime.MRI_2025_PATTERN_DEFINITIONS[id], ...change },
  },
});
const withClassify = (wrap) => ({ ...runtime, classifyNiradsMri2025: wrap(runtime.classifyNiradsMri2025) });
fails(
  () => audit.bindRuntime(withPattern("n2_new_enlarging_no_definitive_morphology", { category: "1" }), result.facts),
  /must be neck 2/,
  "new/enlarging node without definitive morphology downgraded to neck 1",
);
fails(
  () => audit.bindRuntime(withPattern("n3_new_enlarging_irregular_ene", { category: "2" }), result.facts),
  /must be neck 3/,
  "suspicious new/enlarging node downgraded to neck 2",
);
fails(
  () => audit.bindRuntime(withPattern("n1_no_abnormal_nodes", { label: "New node too small to measure" }), result.facts),
  /neck-1 finding must not describe a new or enlarging node/,
  "neck-1 pattern describing a new node",
);
fails(
  () => audit.bindRuntime(withClassify((classify) => (inputs) => {
    const ids = inputs.pattern_ids ?? [inputs.pattern_id];
    if (inputs.node_temporal_status === "new_or_enlarging" && ids.includes("n1_no_abnormal_nodes")) {
      return { status: "classified", category: "1", management_key: "neck.1" };
    }
    return classify(inputs);
  }), result.facts),
  /classified below neck 2|must fail closed/,
  "new/enlarging node allowed to classify as neck 1",
);
fails(
  () => audit.bindRuntime(withClassify((classify) => (inputs) => {
    if (inputs.node_temporal_status === "new_or_enlarging" && (inputs.pattern_ids ?? []).includes("n4_definitive_recurrence")) {
      return { status: "error", error: audit.BELOW_CATEGORY_2_ERROR };
    }
    return classify(inputs);
  }), result.facts),
  /must still classify/,
  "definitive recurrence refused for a new or enlarging node",
);

// 6. Response identity and retry policy.
fails(() => audit.verifyResponse({ finalUrl: audit.SOURCE.url.replace("edge.sitecorecloud.io", "example.org"), contentType: "application/pdf" }), /final URL host/, "wrong host");
fails(() => audit.verifyResponse({ finalUrl: audit.SOURCE.url.replace("NIRADS-MRI-2025", "NIRADS-MRI-2021"), contentType: "application/pdf" }), /final URL path/, "wrong document");
fails(() => audit.verifyResponse({ finalUrl: audit.SOURCE.url, contentType: "text/html" }), /media type/, "HTML interstitial");
const response = (status, overrides = {}) => ({
  ok: status === 200,
  status,
  url: audit.SOURCE.url,
  headers: new Headers({ "content-type": "application/pdf" }),
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  body: null,
  ...overrides,
});
let transientCalls = 0;
const transientStatuses = [429, 503, 408, 200];
const transientSleeps = [];
await audit.fetchSource({
  fetchImpl: async () => response(transientStatuses[transientCalls++]),
  sleep: async (ms) => { transientSleeps.push(ms); },
});
assert.equal(transientCalls, 4, "429, 5xx and 408 are retried");
assert.deepEqual(transientSleeps, [1_500, 3_000, 6_000], "without Retry-After the exponential backoff applies");
let permanentCalls = 0;
await failsAsync(
  audit.fetchSource({
    fetchImpl: async () => {
      permanentCalls += 1;
      return response(404);
    },
    sleep: async () => {},
  }),
  /after 1 of 5 attempts \(HTTP 404\)/,
  "404 fails at once with the real attempt count",
);
assert.equal(permanentCalls, 1, "404 is not retried");
let driftCalls = 0;
await failsAsync(
  audit.fetchSource({
    fetchImpl: async () => {
      driftCalls += 1;
      return response(200, { arrayBuffer: async () => flipped.buffer.slice(flipped.byteOffset, flipped.byteOffset + flipped.length) });
    },
    sleep: async () => {},
  }),
  /source SHA-256 drifted/,
  "a drifted 200 fails at once",
);
assert.equal(driftCalls, 1, "a 200 that misses its pin is not retried");

console.log(`NI-RADS MRI v2025 neck audit mutations: ${detected}/${detected} detected`);
