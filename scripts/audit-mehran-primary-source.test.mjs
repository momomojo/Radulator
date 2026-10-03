#!/usr/bin/env node
// Exact-head test for scripts/audit-mehran-primary-source.mjs. Runs the live audit and pins its result,
// runs the Mehran safety regression tests, then proves that each check fails when its source bytes,
// HTTP response, statement text, identity, parsed table or runtime changes.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(self), "..");

// Smoke runs this file with plain `node`; MehranCIN.jsx needs the repo's JSX loader.
if (!process.env.RADULATOR_MEHRAN_AUDIT_CHILD) {
  const run = spawnSync(process.execPath, ["--import", "./scripts/register-jsx-loader.mjs", self], {
    cwd: root,
    encoding: "utf8",
    timeout: 300_000,
    env: { ...process.env, RADULATOR_MEHRAN_AUDIT_CHILD: "1" },
  });
  process.stdout.write(run.stdout ?? "");
  process.stderr.write(
    (run.stderr ?? "")
      .split("\n")
      .filter((line) => !/DeprecationWarning|trace-deprecation/.test(line))
      .join("\n"),
  );
  process.exit(run.status ?? 1);
}

const audit = await import("./audit-mehran-primary-source.mjs");
const { calculator, calculatorSource } = await audit.loadRuntime(root);

// 1. Live: every source is fetched and verified as exact bytes, then parsed and bound at this head.
const sources = await audit.fetchSources();
const result = await audit.runAudit({ sources, calculator, calculatorSource });

assert.equal(result.schema, "radulator-mehran-primary-source-audit/v2");
assert.equal(result.calculator_id, "mehran-cin");
assert.equal(result.runtime_source, "src/components/calculators/MehranCIN.jsx");
// The audited runtime is pinned: any change to the calculator must re-review this audit.
assert.equal(result.runtime_source_bytes, 10_908);
assert.equal(result.runtime_source_sha256, "5db4c832f7c1adbf102ce39117091207c7c5cba9cc8f0cc686df7b8b9b33fda5");

assert.deepEqual(
  result.sources.map(({ key, url, media_type, digest_of, verified_before_parsing, bytes, sha256 }) => ({
    key,
    url,
    media_type,
    digest_of,
    verified_before_parsing,
    bytes,
    sha256,
  })),
  [
    {
      key: "pubmed-15464318",
      url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=15464318&rettype=abstract&retmode=text&tool=radulator-mehran-audit",
      media_type: "text/plain",
      digest_of: "raw-response-bytes",
      verified_before_parsing: true,
      bytes: 2_301,
      sha256: "1909b4329e81cab7dc1a9bb8085e4c0452f71f60bc9f689e470acc4a3a8b022d",
    },
    {
      key: "pubmed-34793743",
      url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=34793743&rettype=abstract&retmode=text&tool=radulator-mehran-audit",
      media_type: "text/plain",
      digest_of: "raw-response-bytes",
      verified_before_parsing: true,
      bytes: 5_570,
      sha256: "9117f0f184abef66e82e5ac1228dcc0c0dbf36a52460f4b07366556eea3a0861",
    },
    {
      key: "kdigo",
      url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=4089629&retmode=xml",
      media_type: "text/xml",
      digest_of: "raw-response-bytes",
      verified_before_parsing: true,
      bytes: 272_094,
      sha256: "b8775bd178b990bc0e6dd38e60fd03ffd0cee9ebf63f021bacc4eeb18ed77e22",
    },
    {
      key: "esur",
      url: "https://esur-cm.org/index.php/en/b-renal-adverse-reactions",
      media_type: "text/html",
      digest_of: "raw-response-bytes",
      verified_before_parsing: true,
      bytes: 44_070,
      sha256: "982259b9506a813557468a17855c4cb97afe791e3af52a943980bd01290a9f4d",
    },
    {
      key: "acr",
      url: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/ACR-Manual-on-Contrast-Media.pdf",
      media_type: "application/pdf",
      digest_of: "raw-response-bytes",
      verified_before_parsing: true,
      bytes: 1_765_419,
      sha256: "24bfacd3344310d1546636f50aabba11d6458f432b3c8b1205d9c63efe751be2",
    },
  ],
);
assert.deepEqual(result.parsers, {
  pdf: "pdfjs-dist@4.10.38",
  markup: "scripts/audit-mehran-primary-source.mjs markupText (deterministic tag/entity normalizer)",
  pubmed_text: "scripts/audit-mehran-primary-source.mjs parseRecordText (PubMed plain-text abstract blocks)",
});

// Reviewed statements: markers, span digests, identities and paraphrases (no source text).
assert.equal(result.source_statement_count, 41);
assert.equal(result.source_statements.length, 41);
assert.equal(result.source_statements_sha256, "e1f3181a478462eb00abf0f5144a2dd533e4fce32ba876eda912edfc90be3fca");
assert.deepEqual(
  result.source_statements.reduce((counts, { source }) => ({ ...counts, [source]: (counts[source] ?? 0) + 1 }), {}),
  { pubmed: 11, kdigo: 9, esur: 9, acr: 12 },
);
let pinnedSpans = 0;
for (const statement of result.source_statements) {
  assert.ok(statement.paraphrase.length > 0, `${statement.id}: paraphrase missing`);
  assert.equal("statement" in statement, false, `${statement.id}: source text must not be emitted`);
  assert.equal(["identity", "table", "spans"].filter((kind) => kind in statement).length, 1, `${statement.id}: kind`);
  for (const span of statement.spans ?? []) {
    pinnedSpans += 1;
    for (const marker of [span.from, span.to]) {
      assert.ok(marker.trim().split(/\s+/).length <= 6, `${statement.id}: marker over six words`);
    }
    assert.match(span.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(span.length) && span.length > 0);
  }
}
assert.equal(pinnedSpans, 47);
assert.deepEqual(
  result.source_statements.filter((statement) => "identity" in statement).map(({ id }) => id),
  ["pm2004-title", "pm2004-doi", "pm2021-title"],
);

assert.deepEqual(
  result.claims.map(({ claim }) => claim),
  [
    "original-2004-pci-derivation-scope",
    "contrast-associated-terminology",
    "not-a-general-iv-ct-contrast-tool",
    "not-the-2021-mehran-model",
    "rates-are-historical-cohort-estimates",
    "anticipated-procedural-inputs-are-conditional",
    "prevention-needs-separate-renal-aki-route-volume-assessment",
    "individualize-hydration-in-severe-heart-failure",
    "no-score-triggered-hydration-dose",
    "no-score-triggered-medication-hold",
    "no-prophylactic-dialysis-access",
    "no-universal-safe-contrast-maximum",
    "no-invented-egfr-from-creatinine",
    "renal-items-are-alternatives-without-double-counting",
    "contrast-volume-is-a-required-score-input",
    "cin-definition-thresholds",
    "corrected-original-study-doi",
    "added-guideline-references-resolve-to-audited-sections",
  ],
);
for (const claim of result.claims) {
  assert.ok(claim.statements.length > 0, `${claim.claim}: no source statement`);
  assert.ok(claim.runtime_checks > 0, `${claim.claim}: no runtime binding`);
}
assert.equal(result.claims.reduce((total, { runtime_checks }) => total + runtime_checks, 0), 51);

assert.deepEqual(result.table_15_bindings, {
  binary: [
    { source_row: "Hypotension", source_points: 5, runtime_field: "hypotension", runtime_points: 5 },
    { source_row: "IABP", source_points: 5, runtime_field: "iabp", runtime_points: 5 },
    { source_row: "CHF", source_points: 5, runtime_field: "chf", runtime_points: 5 },
    { source_row: "Age >75 years", source_points: 4, runtime_field: "age_over_75", runtime_points: 4 },
    { source_row: "Anemia", source_points: 3, runtime_field: "anemia", runtime_points: 3 },
    { source_row: "Diabetes", source_points: 3, runtime_field: "diabetes", runtime_points: 3 },
  ],
  contrast: [
    { contrast_volume_ml: 0, runtime_points: 0 },
    { contrast_volume_ml: 100, runtime_points: 1 },
    { contrast_volume_ml: 200, runtime_points: 2 },
    { contrast_volume_ml: 300, runtime_points: 3 },
    { contrast_volume_ml: 500, runtime_points: 5 },
  ],
  creatinine: [
    { creatinine_mg_dl: "1.5", runtime_points: 0 },
    { creatinine_mg_dl: "1.51", runtime_points: 4 },
  ],
  egfr: [
    { egfr: 19, runtime_points: 6 },
    { egfr: 20, runtime_points: 4 },
    { egfr: 39, runtime_points: 4 },
    { egfr: 40, runtime_points: 2 },
    { egfr: 59, runtime_points: 2 },
    { egfr: 90, runtime_points: 0 },
  ],
});
assert.deepEqual(result.table_15_footnote_shorthand_recorded_not_bound, {
  low_below: 5,
  high_above: 16,
  length: 69,
  sha256: "186481efc6ba62754514c36e3618cab1d15dc4ca73db68d7a88932eac2e9c883",
});
assert.deepEqual(result.risk_band_extremes, {
  low_max_score: 5,
  low_cin_rate: "7.5%",
  high_min_score: 16,
  high_cin_rate: "57.3%",
});
assert.deepEqual(result.risk_band_bindings, [
  { vector: "score-0", score: 0, runtime_cin_risk: "7.5%" },
  { vector: "score-5", score: 5, runtime_cin_risk: "7.5%" },
  { vector: "score-16", score: 16, runtime_cin_risk: "57.3%" },
  { vector: "score-17", score: 17, runtime_cin_risk: "57.3%" },
]);
assert.deepEqual(result.forbidden_output_checks, [
  "weight-based hydration dose",
  "score-triggered medication hold",
  "prophylactic renal replacement access",
  "eGFR-multiple contrast limit",
  "iso-osmolar agent mandate",
  "delay or nephrology instruction",
]);
assert.equal(result.not_source_bound.length, 8);
assert.match(result.not_source_bound[0], /^Middle-band cut points and CIN rates/);
assert.match(result.not_source_bound[1], /^All four dialysis rates/);
assert.match(result.not_source_bound[6], /'at 48 h after PCI'/);
assert.equal(result.source_bytes_committed, false);
console.log(audit.passLine(result));

// 2. The Mehran safety regression tests run at the same head.
const regression = spawnSync(
  process.execPath,
  ["--import", "./scripts/register-jsx-loader.mjs", "--test", "tests/mehran-safety-compute.test.mjs"],
  { cwd: root, encoding: "utf8", timeout: 120_000 },
);
assert.equal(
  regression.status,
  0,
  `Mehran safety regression tests failed\nstdout:\n${regression.stdout}\nstderr:\n${regression.stderr}`,
);

// 3. Mutations: each must be detected, with the reason named.
let detected = 0;
async function mustReject(action, pattern, label) {
  await assert.rejects(action, pattern, `mutation not detected: ${label}`);
  detected += 1;
}
function mustThrow(action, pattern, label) {
  assert.throws(action, pattern, `mutation not detected: ${label}`);
  detected += 1;
}
const noSleep = async () => {};
const withSource = (key, bytes) => ({ ...sources, [key]: bytes });
const flipOneByte = (bytes) => {
  const copy = Buffer.from(bytes);
  copy[copy.length >> 1] ^= 0x01;
  return copy;
};
const response = (key, bytes, status = 200, headers = { "content-type": audit.SOURCES[key].media_type }) => ({
  ok: status >= 200 && status < 300,
  status,
  url: audit.SOURCES[key].url,
  headers: new Headers(headers),
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  body: null,
});
const runWith = (mutatedSources) => audit.runAudit({ sources: mutatedSources, calculator, calculatorSource });

// 3a. Byte pins for every source kind (PubMed text, PMC XML, HTML, PDF), all checked before parsing.
for (const key of audit.SOURCE_KEYS) {
  const drifted = flipOneByte(sources[key]);
  assert.equal(drifted.length, sources[key].length);
  await mustReject(runWith(withSource(key, drifted)), new RegExp(`${key}: source SHA-256 drifted`), `${key}: same-length byte change`);
  await mustReject(
    runWith(withSource(key, Buffer.concat([sources[key], Buffer.from(" ")]))),
    new RegExp(`${key}: source byte length drifted`),
    `${key}: one extra byte`,
  );
  for (const [label, served, pattern] of [
    ["same-length drift", drifted, "source SHA-256 drifted"],
    ["length drift", sources[key].subarray(0, sources[key].length - 1), "source byte length drifted"],
  ]) {
    let calls = 0;
    await mustReject(
      audit.fetchSource(key, {
        fetchImpl: async () => {
          calls += 1;
          return response(key, served);
        },
        sleep: noSleep,
      }),
      new RegExp(`${key}: ${pattern}`),
      `${key}: ${label} served with HTTP 200`,
    );
    assert.equal(calls, 1, `${key}: a drifted HTTP 200 is a changed source and is never retried`);
  }
}
await mustReject(runWith(withSource("esur", undefined)), /esur: source bytes missing/, "missing ESUR bytes");

// 3b. Response identity and retry policy.
const pubmedKey = "pubmed-15464318";
const pubmedUrl = audit.SOURCES[pubmedKey].url;
mustThrow(
  () => audit.verifyResponse(pubmedKey, { finalUrl: pubmedUrl.replace("eutils.ncbi.nlm.nih.gov", "example.org"), contentType: "text/plain" }),
  /final URL host drifted/,
  "wrong host",
);
mustThrow(
  () => audit.verifyResponse(pubmedKey, { finalUrl: pubmedUrl.replace("retmode=text", "retmode=xml"), contentType: "text/plain" }),
  /final URL query drifted/,
  "wrong query",
);
mustThrow(
  () => audit.verifyResponse(pubmedKey, { finalUrl: pubmedUrl.replace("https:", "http:"), contentType: "text/plain" }),
  /left HTTPS/,
  "plain HTTP",
);
mustThrow(() => audit.verifyResponse(pubmedKey, { finalUrl: pubmedUrl, contentType: "text/xml" }), /media type drifted/, "wrong media type");
let transientCalls = 0;
const transientStatuses = [400, 429, 503, 200];
const recovered = await audit.fetchSource(pubmedKey, {
  fetchImpl: async () => response(pubmedKey, sources[pubmedKey], transientStatuses[transientCalls++]),
  sleep: noSleep,
});
assert.equal(transientCalls, 4, "NCBI 400, 429 and 5xx are retried");
assert.ok(recovered.equals(sources[pubmedKey]), "a recovered response is still byte-verified");
let acrCalls = 0;
await mustReject(
  audit.fetchSource("acr", {
    fetchImpl: async () => {
      acrCalls += 1;
      return response("acr", sources.acr, 400);
    },
    sleep: noSleep,
  }),
  /acr: primary-source retrieval failed after 1 of 4 attempts \(HTTP 400\)/,
  "HTTP 400 outside NCBI fails at once",
);
assert.equal(acrCalls, 1);
let missingCalls = 0;
await mustReject(
  audit.fetchSource("kdigo", {
    fetchImpl: async () => {
      missingCalls += 1;
      return response("kdigo", sources.kdigo, 404);
    },
    sleep: noSleep,
  }),
  /kdigo: primary-source retrieval failed after 1 of 4 attempts \(HTTP 404\)/,
  "HTTP 404 fails at once",
);
assert.equal(missingCalls, 1);
let challengeCalls = 0;
await mustReject(
  audit.fetchSource("esur", {
    fetchImpl: async () => {
      challengeCalls += 1;
      return response("esur", Buffer.from("<html></html>"), 403, { "content-type": "text/html", "cf-mitigated": "challenge" });
    },
    sleep: noSleep,
  }),
  /bot challenge; this audit never bypasses it/,
  "bot challenge fails at once",
);
assert.equal(challengeCalls, 1);
let networkCalls = 0;
await mustReject(
  audit.fetchSource("esur", {
    fetchImpl: async () => {
      networkCalls += 1;
      throw new TypeError("fetch failed");
    },
    sleep: noSleep,
  }),
  /after 4 of 4 attempts \(TypeError: fetch failed\)/,
  "network failure is retried, then fails",
);
assert.equal(networkCalls, 4);

// 3c. Statement, identity and table pins, checked independently of the byte pins.
const parsed = await audit.parseSources(sources);
const table15 = audit.kdigoTable15(parsed.kdigoXml);
assert.equal(audit.verifyStatements(parsed, table15).length, 41);
const statementById = (id) => audit.SOURCE_STATEMENTS.find((statement) => statement.id === id);
const cloneParsed = () => ({ ...parsed, pubmed: { ...parsed.pubmed }, acr: new Map(parsed.acr) });
// Changes one letter of the first word after a statement's start marker (a one-word change).
function changeWordAfter(text, marker, fromIndex = 0) {
  const at = text.indexOf(marker, fromIndex);
  assert.ok(at >= fromIndex && fromIndex >= 0, `fixture lacks marker ${JSON.stringify(marker)}`);
  let index = at + marker.length;
  while (index < text.length && !/[A-Za-z]/.test(text[index])) index += 1;
  assert.ok(index < text.length, `no word follows ${JSON.stringify(marker)}`);
  return `${text.slice(0, index)}${text[index] === "q" ? "z" : "q"}${text.slice(index + 1)}`;
}

for (const kind of ["pubmed", "kdigo", "esur", "acr"]) {
  const statement = audit.SOURCE_STATEMENTS.find((candidate) => candidate.source === kind && candidate.spans);
  const { text, normalize } = audit.statementLocator(parsed, statement);
  assert.ok(audit.checkStatementSpans(statement, text, normalize).every(({ ok }) => ok), `${statement.id}: unchanged fixture`);
  const drifted = changeWordAfter(text, normalize(statement.spans[0].from));
  assert.equal(drifted.length, text.length);
  assert.ok(
    audit.checkStatementSpans(statement, drifted, normalize).some(({ ok }) => !ok),
    `mutation not detected: ${statement.id} one-word change inside the pinned span`,
  );
  detected += 1;
}

{
  const statement = statementById("pm2004-objective-pci");
  const drifted = cloneParsed();
  const record = drifted.pubmed["15464318"];
  drifted.pubmed["15464318"] = { ...record, abstract: changeWordAfter(record.abstract, statement.spans[0].from) };
  mustThrow(() => audit.verifyStatements(drifted, table15), /pinned source statements drifted[\s\S]*pm2004-objective-pci/, "PubMed word change");
}
{
  const statement = statementById("kdigo-arterial-vs-venous-route");
  const drifted = cloneParsed();
  const section = drifted.kdigoXml.indexOf(`<sec><title>${statement.locator.section}</title>`);
  drifted.kdigoXml = changeWordAfter(drifted.kdigoXml, statement.spans[0].from, section);
  mustThrow(() => audit.verifyStatements(drifted, table15), /pinned source statements drifted[\s\S]*kdigo-arterial-vs-venous-route/, "KDIGO word change");
}
{
  const statement = statementById("esur-b2.2-individualize-hydration-severe-chf");
  const drifted = cloneParsed();
  const anchor = drifted.esurHtml.indexOf(`<a name="${statement.locator.anchor}"`);
  drifted.esurHtml = changeWordAfter(drifted.esurHtml, statement.spans[0].from, anchor);
  mustThrow(
    () => audit.verifyStatements(drifted, table15),
    /pinned source statements drifted[\s\S]*esur-b2\.2-individualize-hydration-severe-chf/,
    "ESUR word change",
  );
}
{
  const statement = statementById("acr-ideal-infusion-rate-unknown");
  const drifted = cloneParsed();
  drifted.acr.set(statement.locator.pdf_page, changeWordAfter(drifted.acr.get(statement.locator.pdf_page), statement.spans[0].from));
  mustThrow(() => audit.verifyStatements(drifted, table15), /pinned source statements drifted[\s\S]*acr-ideal-infusion-rate-unknown/, "ACR word change");
}
{
  const drifted = cloneParsed();
  drifted.pubmed["15464318"] = { ...drifted.pubmed["15464318"], doi: "10.1016/j.jacc.2004.06.034" };
  mustThrow(() => audit.verifyIdentities(drifted), /pubmed-15464318: DOI drifted/, "PubMed DOI change");
}
{
  const drifted = cloneParsed();
  drifted.pubmed["34793743"] = { ...drifted.pubmed["34793743"], title: drifted.pubmed["34793743"].title.replace(/\.$/, "") };
  mustThrow(() => audit.verifyStatements(drifted, table15), /pm2021-title: PubMed 34793743 title drifted/, "PubMed title change");
}
{
  const drifted = cloneParsed();
  drifted.kdigoXml = drifted.kdigoXml.replace("PMC4089629", "PMC4089630");
  mustThrow(() => audit.verifyIdentities(drifted), /kdigo: PMCID drifted/, "KDIGO PMCID change");
}
{
  const drifted = cloneParsed();
  drifted.acr.set(42, drifted.acr.get(42).replace(/ 39 /, " 40 "));
  mustThrow(() => audit.verifyIdentities(drifted), /acr: PDF page 42 running header or printed page 39 drifted/, "ACR printed page change");
}
{
  const tableStart = parsed.kdigoXml.indexOf('<table-wrap id="tbl15"');
  const cell = parsed.kdigoXml.indexOf(">5</td>", tableStart);
  assert.ok(tableStart >= 0 && cell > tableStart, "Table 15 fixture");
  const drifted = `${parsed.kdigoXml.slice(0, cell)}>4</td>${parsed.kdigoXml.slice(cell + ">5</td>".length)}`;
  mustThrow(() => audit.kdigoTable15(drifted), /Table 15 rows drifted/, "Table 15 weight change");
}
{
  const footnote = parsed.kdigoXml.indexOf('<fn id="t15-fn1">');
  const bound = parsed.kdigoXml.indexOf("&gt;16", footnote);
  assert.ok(footnote >= 0 && bound > footnote, "Table 15 footnote fixture");
  const drifted = { ...cloneParsed(), kdigoXml: `${parsed.kdigoXml.slice(0, bound)}&gt;17${parsed.kdigoXml.slice(bound + "&gt;16".length)}` };
  mustThrow(
    () => audit.verifyStatements(drifted, audit.kdigoTable15(drifted.kdigoXml)),
    /pinned source statements drifted[\s\S]*kdigo-table-15/,
    "Table 15 footnote change",
  );
}
{
  const statement = statementById("esur-b2.2-individualize-hydration-severe-chf");
  const { text, normalize } = audit.statementLocator(parsed, statement);
  const longMarker = { ...statement, spans: [{ ...statement.spans[0], from: "one two three four five six seven" }] };
  mustThrow(() => audit.checkStatementSpans(longMarker, text, normalize), /exceeds 6 words/, "seven-word marker");
}
mustThrow(() => audit.parseRiskBandExtremes("no band extremes here"), /lacks the low\/high band extremes/, "missing band extremes");

// 3d. Runtime mutations: each changed claim or boundary fails when the runtime no longer matches.
const facts = {
  table15,
  riskBandExtremes: result.risk_band_extremes,
  statementIds: new Set(result.source_statement_ids),
};
const verifyWith = (runtime, source = calculatorSource) =>
  audit.verifyRuntime({ calculator: runtime, calculatorSource: source, ...facts });
assert.doesNotThrow(() => verifyWith(calculator));
const withCompute = (transform) => ({ ...calculator, compute: (vals) => transform(vals, calculator.compute(vals)) });
const withInfo = (info) => ({ ...calculator, info: { ...calculator.info, ...info } });
const runtimeCases = [
  ["restored contrast limits", withCompute((vals, out) => (out.Error ? out : { ...out, "Contrast Limits": "Target: <120 mL" })), /Contrast Limits/],
  [
    "restored hydration dose",
    withCompute((vals, out) => (out.Error ? out : { ...out, "Prevention Recommendations": "Aggressive hydration (1.5 mL/kg/hr)" })),
    /Prevention Recommendations/,
  ],
  [
    "heart-failure sentence removed",
    withCompute((vals, out) =>
      out.Error
        ? out
        : { ...out, "Prevention Context": out["Prevention Context"].replace(" Individualize hydration, especially in severe heart failure.", "") },
    ),
    /individualize-hydration-in-severe-heart-failure/,
  ],
  [
    "hypotension weight 4",
    withCompute((vals, out) => (out["Score Breakdown"] === "Hypotension: +5" ? { ...out, "Mehran Score": "4 points" } : out)),
    /Hypotension: runtime weight drifted from Table 15/,
  ],
  ["eGFR 40 scored as 4 points", withCompute((vals, out) => (vals.egfr === "40" ? { ...out, "Mehran Score": "4 points" } : out)), /eGFR 40: runtime drifted from Table 15/],
  [
    "creatinine double-counted",
    withCompute((vals, out) => (vals.creatinine === "3" && vals.egfr === "30" ? { ...out, "Mehran Score": "8 points" } : out)),
    /renal-items-are-alternatives-without-double-counting/,
  ],
  ["low band 7.4%", withCompute((vals, out) => (out["CIN Risk"] === "7.5%" ? { ...out, "CIN Risk": "7.4%" } : out)), /score-0: runtime CIN rate drifted/],
  [
    "very-high band starts at 17",
    withCompute((vals, out) => (out["Mehran Score"] === "16 points" ? { ...out, "CIN Risk": "26.1%" } : out)),
    /score-16: runtime CIN rate drifted/,
  ],
  [
    "blank contrast volume accepted",
    withCompute((vals, out) => (vals.contrast_volume === "" ? calculator.compute({ ...vals, contrast_volume: "0" }) : out)),
    /contrast-volume-is-a-required-score-input/,
  ],
  ["scope wording removed", withInfo({ text: calculator.info.text.replace("Scope: original PCI model", "Scope: PCI model") }), /original-2004-pci-derivation-scope/],
  [
    "old DOI restored",
    withInfo({ link: { ...calculator.info.link, url: "https://doi.org/10.1016/j.jacc.2004.06.034" } }),
    /corrected-original-study-doi/,
  ],
];
for (const [label, runtime, pattern] of runtimeCases) mustThrow(() => verifyWith(runtime), pattern, `runtime: ${label}`);
mustThrow(
  () => verifyWith(calculator, Buffer.from(calculatorSource.toString("utf8").replace("Developed in a PCI population", "Developed in a population"))),
  /original-2004-pci-derivation-scope: calculator-source/,
  "runtime: header comment scope removed",
);

assert.equal(detected, 57, "every planned mutation ran");
console.log(`Mehran audit mutations: ${detected}/57 detected (byte pins for all 5 sources, responses, retries, statements, identities, Table 15, runtime)`);
