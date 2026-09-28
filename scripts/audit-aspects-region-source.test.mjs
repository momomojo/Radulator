#!/usr/bin/env node

// Runs the ASPECTS region source audit once against the live sources and checks its JSON
// report. It then replays the bytes that run fetched, offline and with targeted mutations, to
// show that every raw-byte pin holds and that a drifted 200 response fails at once without a
// retry. The fetched bytes live only in a temporary directory that is deleted at the end.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const saveDir = mkdtempSync(join(tmpdir(), "aspects-region-audit-"));
after(() => rmSync(saveDir, { recursive: true, force: true }));

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-aspects-region-source.mjs",
    "--json",
    "--save-sources",
    saveDir,
  ],
  { cwd: repoRoot, encoding: "utf8" },
);
if (run.status !== 0) {
  rmSync(saveDir, { recursive: true, force: true });
  assert.fail(`ASPECTS region source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
}
const report = JSON.parse(run.stdout);

// The audit module imports the calculator JSX, so register the repository's JSX loader first.
await import("./register-jsx-loader.mjs");
const audit = await import("./audit-aspects-region-source.mjs");
const { ASPECTSScore } = await import("../src/components/calculators/ASPECTSScore.jsx");

function savedArtifacts() {
  return Object.fromEntries(
    Object.keys(audit.SOURCES).map((key) => {
      const meta = JSON.parse(readFileSync(join(saveDir, `${key}.json`), "utf8"));
      return [key, { ...meta, bytes: readFileSync(join(saveDir, `${key}.bin`)) }];
    }),
  );
}

function withText(artifacts, key, edit) {
  const text = artifacts[key].bytes.toString("utf8");
  const edited = edit(text);
  assert.notEqual(edited, text, `${key}: mutation did not change the artifact`);
  return { ...artifacts, [key]: { ...artifacts[key], bytes: Buffer.from(edited, "utf8") } };
}

function calculatorWith(overrides) {
  return { ...ASPECTSScore, ...overrides };
}

function fakeResponse({ status = 200, url, contentType, bytes = Buffer.alloc(0), memento, link, retryAfter }) {
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  if (memento) headers.set("memento-datetime", memento);
  if (link) headers.set("link", link);
  if (retryAfter) headers.set("retry-after", retryAfter);
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    body: { cancel: async () => {} },
  };
}

// A fetch that serves one saved artifact, optionally drifted, and counts its calls.
function serving(saved, drift = {}) {
  let calls = 0;
  return {
    fetchImpl: async () => {
      calls += 1;
      return fakeResponse({
        url: drift.finalUrl ?? saved.finalUrl,
        contentType: drift.contentType ?? saved.contentType,
        bytes: drift.bytes ?? saved.bytes,
        memento: drift.memento ?? saved.mementoDatetime,
        link: drift.link ?? saved.link,
      });
    },
    calls: () => calls,
  };
}

const noRetry = async () => {
  assert.fail("a 200 response that misses a pin must not be retried");
};

test("report pins every artifact by raw bytes, final URL and media type", () => {
  assert.equal(report.schema, "radulator-aspects-region-source-audit/v1");
  assert.equal(report.calculator_id, "aspects-score");
  assert.equal(report.calculator_path, "src/components/calculators/ASPECTSScore.jsx");
  assert.deepEqual(
    report.sources.map(({ key, final_url, media_type, pin, bytes, sha256 }) => [
      key,
      final_url,
      media_type,
      pin,
      bytes,
      sha256,
    ]),
    [
      [
        "barber2000",
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=10905241&rettype=abstract&retmode=text&tool=radulator-aspects-audit",
        "text/plain",
        "raw-bytes",
        2463,
        "fee68808adc8d45b02413464c7dc282361e72458bb2a9d340a69becad7a3960d",
      ],
      [
        "pexman2001",
        "https://web.archive.org/web/20250202055743id_/https://pmc.ncbi.nlm.nih.gov/articles/PMC7974585/",
        "text/html",
        "raw-bytes",
        143520,
        "1167a826eb0079f360f2cafdbe0040fb39a9bdaa0e6ca92dc54a5132d5b569d7",
      ],
      [
        "dubey2013",
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&retmode=xml&tool=radulator-aspects-audit&id=3732599",
        "text/xml",
        "raw-bytes",
        65170,
        "7a0479726ba0956a36ce9e63050bf0e052fe69ac292428a67a9254b26d54a2ba",
      ],
      [
        "developers_what_is",
        "https://web.archive.org/web/20161206115358id_/http://www.aspectsinstroke.com:80/aspects/what-is-aspects/",
        "text/html",
        "raw-bytes",
        12396,
        "0fa6d381b95c3eb6d61f082c2c1e5821d3b5b00fcc461fa3666359adebb5a03e",
      ],
      [
        "developers_insula_basal_ganglia",
        "https://web.archive.org/web/20161229222203id_/http://www.aspectsinstroke.com:80/training-for-aspects/optimal-window-settings222/",
        "text/html",
        "raw-bytes",
        11387,
        "2ab9a266bbfd2dfbfcb1b8f60bded61ca9befa29393c1d6a768a0c264f5befe5",
      ],
      [
        "developers_m1_m6",
        "https://web.archive.org/web/20161230025253id_/http://www.aspectsinstroke.com:80/training-for-aspects/optimal-window-settings227/",
        "text/html",
        "raw-bytes",
        10930,
        "c2f480242b0061b6a0c122496dbdf45cf6c0a416ffddec1a7f7977a87fd657fb",
      ],
    ],
  );
  const sources = Object.fromEntries(report.sources.map((source) => [source.key, source]));
  for (const source of report.sources) {
    assert.equal(source.final_url, source.url, `${source.key}: final URL must be the pinned URL`);
    assert.doesNotMatch(source.url, /[?&]email=/i, `${source.key}: no e-mail parameter`);
    for (const field of ["content_sha256", "observed_raw", "pin_rationale"]) {
      assert.equal(source[field], undefined, `${source.key}: no content-digest pin (${field})`);
    }
    if (new URL(source.url).hostname === "eutils.ncbi.nlm.nih.gov") {
      assert.equal(new URL(source.url).searchParams.get("tool"), "radulator-aspects-audit", `${source.key}: NCBI tool`);
    }
  }
  assert.deepEqual(
    ["pexman2001", "developers_what_is", "developers_insula_basal_ganglia", "developers_m1_m6"].map((key) => [
      key,
      sources[key].original_url,
      sources[key].memento_datetime,
      sources[key].archive_sha1_base32,
    ]),
    [
      [
        "pexman2001",
        "https://pmc.ncbi.nlm.nih.gov/articles/PMC7974585/",
        "Sun, 02 Feb 2025 05:57:43 GMT",
        "6CAKOH2THRQX4SAUN7IR3CMVB4IQDWUJ",
      ],
      [
        "developers_what_is",
        "http://www.aspectsinstroke.com:80/aspects/what-is-aspects/",
        "Tue, 06 Dec 2016 11:53:58 GMT",
        "IEC2BKTXILM7IDIMIOYD3C7XG3CJKYBZ",
      ],
      [
        "developers_insula_basal_ganglia",
        "http://www.aspectsinstroke.com:80/training-for-aspects/optimal-window-settings222/",
        "Thu, 29 Dec 2016 22:22:03 GMT",
        "YUXRQZ452UCGIVYWN5VJRD43FQHOU6A2",
      ],
      [
        "developers_m1_m6",
        "http://www.aspectsinstroke.com:80/training-for-aspects/optimal-window-settings227/",
        "Fri, 30 Dec 2016 02:52:53 GMT",
        "YSZ7GX7XZFGGGMWDXBIO7FZHYDQFDDB5",
      ],
    ],
  );
  assert.deepEqual([sources.barber2000.pmid, sources.barber2000.doi], ["10905241", "10.1016/S0140-6736(00)02237-6"]);
  assert.deepEqual([sources.pexman2001.pmid, sources.pexman2001.pmcid], ["11559501", "PMC7974585"]);
  assert.deepEqual(
    [sources.dubey2013.pmcid, sources.dubey2013.pmid, sources.dubey2013.doi, sources.dubey2013.license],
    ["PMC3732599", "23970999", "10.1155/2013/767212", "https://creativecommons.org/licenses/by/3.0/"],
  );
  assert.deepEqual(report.informational.barber2000_errata_listed_by_pubmed, ["Lancet 2000 Jun 17;355(9221):2170."]);
  assert.equal(report.source_bytes_committed, false);
});

test("report pins every statement span by digest and binds every statement", () => {
  assert.deepEqual(
    report.source_statements.map(({ id, source, spans }) => [id, source, spans.map(({ sha256 }) => sha256)]),
    [
      ["barber2000-abstract-ten-regions", "barber2000", ["b0108d25834178967bc1c3e82c1ec497ce6163ce41198d188bc142245d7905c1"]],
      [
        "pexman2001-methods-two-cuts-one-point-per-region",
        "pexman2001",
        ["6ce958a5911d5a9479eaa9c45c77c012c61bfb2dd21ecafdc8939fdf42fa822f"],
      ],
      ["pexman2001-fig1-region-definitions", "pexman2001", ["2e95916967d22cee28ea0d2130fbfc9684c20bd75d073fbd264ae65dfb5b4bba"]],
      ["pexman2001-results-insular-ribbon", "pexman2001", ["dcdf78866e77297b2231c64533dc39bdd9a4eed90b6dcc739e9a29ed07fbc499"]],
      ["pexman2001-results-m-areas-geometric", "pexman2001", ["be694873d12f98d72ed6c585971f4ba004e8aae4963feeab4045d9d3292be3a6"]],
      ["pexman2001-results-m1-frontal-operculum", "pexman2001", ["c3fc285ddd730bd33f095f1b4cbce00ac609424fb717c5d26fb5e2e1101781f4"]],
      ["pexman2001-results-m2-boundaries", "pexman2001", ["1fea8ceb03ab7347e74d4b8646d9d79d3dcf293295dee978889047ebb0911707"]],
      [
        "pexman2001-results-internal-capsule-split",
        "pexman2001",
        ["9300a10d7a5ca35955e2334a3244569522638ccf15b7170f754a1cf603786718"],
      ],
      [
        "pexman2001-discussion-ganglionic-divisions",
        "pexman2001",
        ["2c7354c6d6715be5e26c6318ff3c3e086009b7c000c2e2ba1cd429299fd40666"],
      ],
      [
        "dubey2013-fig1-provenance",
        "dubey2013",
        [
          "655e31450499f5368e14932b101ad828556e8e32cb4ae7ae435f1393419d6e5b",
          "d65b587338b7d73a2d0ec3853e19fe48c67b37dc9eda15464201c80d86f3f35c",
        ],
      ],
      ["dubey2013-fig1-region-definitions", "dubey2013", ["4ec9c3c6f82b61d04280908ac4703108df66ee85d369331b849fefb0f4bca908"]],
      [
        "dubey2013-fig1-subcortical-three-points",
        "dubey2013",
        ["403235c61ec228d999245dde0fe79472671b4ccf4cb64fd2da7db5cd78106e76"],
      ],
      ["dubey2013-fig1-cortex-seven-points", "dubey2013", ["cde321c5e5ced68389d9ce3a4c69128cfe328897eeeeda0272fb7f6d5425b469"]],
      ["developers-what-is-two-levels", "developers_what_is", ["a88a0232b65debe56ee0f91e9485687852b43069bb11e0e245394077ea3fd57f"]],
      [
        "developers-what-is-one-point-per-region",
        "developers_what_is",
        ["551b459d7e6ca0a957e9c19a4f33d90eb6f2dcee4beddff4d29cdb1e1ffa9f45"],
      ],
      [
        "developers-what-is-region-definitions",
        "developers_what_is",
        ["1341ea4b26b25d47574920facb07bd29671cd6c69512ab7b79224485592089bf"],
      ],
      [
        "developers-what-is-subcortical-three-points",
        "developers_what_is",
        ["403235c61ec228d999245dde0fe79472671b4ccf4cb64fd2da7db5cd78106e76"],
      ],
      [
        "developers-what-is-cortex-seven-points",
        "developers_what_is",
        ["fd8ba93ed8c400aa3e1ce61eda857cae9981cf176216213e3681b3365a3a54fc"],
      ],
      [
        "developers-insula-bg-insular-ribbon",
        "developers_insula_basal_ganglia",
        ["564331d2e51274aa4db5d22d1eac2410754d2d23c6f95d12d8a8d3a758654a43"],
      ],
      [
        "developers-insula-bg-caudate-both-levels",
        "developers_insula_basal_ganglia",
        ["61fb2e7a599f2bbd7e7f98dacebf6a3366ee951d7673ff2a3a60aa5f5a5d9cfb"],
      ],
      [
        "developers-insula-bg-internal-capsule-posterior-limb",
        "developers_insula_basal_ganglia",
        ["548826ea3a4d0ed4a817cdabc6d16851da8ec321fe10d84576a496eea34f3dde"],
      ],
      [
        "developers-m1-m6-ganglionic-adjudication",
        "developers_m1_m6",
        ["079d3b6025afc5419561e9352d2640af49e5a9f1a0ae23549e5d1c83552fb6fd"],
      ],
      [
        "developers-m1-m6-supraganglionic-adjudication",
        "developers_m1_m6",
        ["87a688d9bf54efc2a59054489572bfbc95ffbefea74ab2c7e9b6b448b038d135"],
      ],
    ],
  );
  for (const statement of report.source_statements) {
    assert.ok(statement.paraphrase.length > 20, `${statement.id}: paraphrase`);
    assert.ok(statement.locator, `${statement.id}: locator`);
  }
  assert.deepEqual(
    report.claim_bindings.map(({ claim_id }) => claim_id),
    [
      "breakdown-subcortical-is-c-l-ic",
      "breakdown-insula-is-ganglionic-cortex",
      "subcortical-note-uses-corrected-grouping",
      "m1-m6-note-names-its-trigger",
      "score-is-ten-minus-regions",
      "two-levels-in-info-text",
      "internal-capsule-posterior-limb",
      "m3-posterior-mca-cortex-behind-m2",
      "m1-frontal-operculum",
      "m2-anterior-temporal-lateral-to-insula",
      "m4-m6-immediately-superior",
      "insular-ribbon-definition",
      "caudate-region",
    ],
  );
  const bound = new Set(report.claim_bindings.flatMap(({ source_statement_ids }) => source_statement_ids));
  for (const { id } of report.source_statements) {
    if (!id.endsWith("-provenance")) assert.ok(bound.has(id), `${id}: not bound to a runtime claim`);
  }
  const byClaim = Object.fromEntries(report.claim_bindings.map((binding) => [binding.claim_id, binding.runtime]));
  assert.deepEqual(byClaim["breakdown-subcortical-is-c-l-ic"].subcortical, ["caudate", "lentiform", "internal_capsule"]);
  assert.deepEqual(byClaim["breakdown-insula-is-ganglionic-cortex"].ganglionic_cortical, ["insular", "m1", "m2", "m3"]);
  assert.equal(byClaim["breakdown-insula-is-ganglionic-cortex"].cortical_points, 7);
  assert.equal(byClaim["score-is-ten-minus-regions"].region_combinations_checked, 1024);
  assert.deepEqual(byClaim["internal-capsule-posterior-limb"].sublabels, {
    internal_capsule: "Posterior limb of internal capsule",
  });
  assert.deepEqual(byClaim["m3-posterior-mca-cortex-behind-m2"].sublabels, {
    m3: "MCA cortex behind M2 at ganglionic level",
  });
  assert.equal(report.runtime.region_combinations_checked, 1024);
  assert.equal(report.scope.score_arithmetic_changed, false);
});

test("markers stay within the six-word limit and paraphrases do not copy their spans", () => {
  const words = (value) => value.trim().split(/\s+/).length;
  for (const statement of audit.STATEMENTS) {
    if (statement.source !== "barber2000" && statement.source !== "dubey2013") {
      assert.ok(words(statement.block) <= 6, `${statement.id}: block marker has more than six words`);
    }
    for (const span of statement.spans) {
      assert.ok(words(span.from) <= 6, `${statement.id}: from marker has more than six words`);
      assert.ok(words(span.to) <= 6, `${statement.id}: to marker has more than six words`);
      // The two markers must not reconstruct the span, even joined by a space.
      assert.ok(span.length > span.from.length + span.to.length + 1, `${statement.id}: markers cover the whole span`);
      assert.ok(!statement.paraphrase.includes(`${span.from} `), `${statement.id}: paraphrase repeats a marker`);
    }
  }
});

test("the archive digest of each saved capture matches its CDX index entry", () => {
  const artifacts = savedArtifacts();
  for (const source of Object.values(audit.SOURCES).filter(({ archive_sha1_base32 }) => archive_sha1_base32)) {
    assert.equal(audit.sha1Base32(artifacts[source.key].bytes), source.archive_sha1_base32, source.key);
  }
  // RFC 4648 test vector: SHA-1("abc") = a9993e36 4706816a ba3e2571 7850c26c 9cd0d89d.
  assert.equal(audit.sha1Base32(Buffer.from("abc")), "VGMT4NSHA2AWVOR6EVYXQUGCNSONBWE5");
});

test("retrieve() accepts each unmodified saved artifact on the first attempt", async () => {
  const artifacts = savedArtifacts();
  for (const source of Object.values(audit.SOURCES)) {
    const fetch = serving(artifacts[source.key]);
    const retrieved = await audit.retrieve(source, { fetchImpl: fetch.fetchImpl, sleep: noRetry });
    assert.equal(retrieved.attempts, 1, source.key);
    assert.equal(fetch.calls(), 1, source.key);
  }
});

test("failure mode 1: same-length digest drift fails at once, without a retry", async () => {
  const artifacts = savedArtifacts();
  for (const source of Object.values(audit.SOURCES)) {
    const bytes = Buffer.from(artifacts[source.key].bytes);
    const index = Math.floor(bytes.length / 2);
    bytes[index] = bytes[index] === 0x20 ? 0x21 : 0x20;
    assert.equal(bytes.length, source.bytes, `${source.key}: the mutation keeps the length`);
    const fetch = serving(artifacts[source.key], { bytes });
    await assert.rejects(
      audit.retrieve(source, { fetchImpl: fetch.fetchImpl, sleep: noRetry }),
      new RegExp(`${source.key}: artifact SHA-256 drifted`),
    );
    assert.equal(fetch.calls(), 1, `${source.key}: fetched exactly once`);
  }
});

test("failure mode 2: byte-length drift fails at once, without a retry", async () => {
  const artifacts = savedArtifacts();
  for (const source of Object.values(audit.SOURCES)) {
    for (const bytes of [
      Buffer.concat([artifacts[source.key].bytes, Buffer.from("\n")]),
      artifacts[source.key].bytes.subarray(0, source.bytes - 1),
    ]) {
      const fetch = serving(artifacts[source.key], { bytes });
      await assert.rejects(
        audit.retrieve(source, { fetchImpl: fetch.fetchImpl, sleep: noRetry }),
        new RegExp(`${source.key}: artifact byte length drifted`),
      );
      assert.equal(fetch.calls(), 1, `${source.key}: fetched exactly once`);
    }
  }
});

test("failure mode 3: a drifted HTTP 200 fails at once, without a retry", async () => {
  const artifacts = savedArtifacts();
  for (const source of Object.values(audit.SOURCES)) {
    const saved = artifacts[source.key];
    const changedQuery = new URL(source.url);
    changedQuery.search = "?changed=1";
    const drifts = [
      // A different page served with status 200 and the pinned media type (an interstitial).
      [{ bytes: Buffer.from("<html><body>Preparing to download ...</body></html>") }, /artifact byte length drifted/],
      [{ contentType: "application/octet-stream" }, /media type drifted/],
      [{ finalUrl: "https://example.org/moved" }, /final URL host drifted/],
      [{ finalUrl: changedQuery.href }, /final URL query drifted/],
    ];
    if (source.memento_datetime) {
      drifts.push([{ memento: "Sat, 01 Jan 2022 00:00:00 GMT" }, /archive capture time drifted/]);
      drifts.push([{ link: '<http://example.org/other>; rel="original"' }, /archive capture is not of the pinned page/]);
    }
    for (const [drift, message] of drifts) {
      const fetch = serving(saved, drift);
      await assert.rejects(
        audit.retrieve(source, { fetchImpl: fetch.fetchImpl, sleep: noRetry }),
        message,
        `${source.key}: ${JSON.stringify(Object.keys(drift))}`,
      );
      assert.equal(fetch.calls(), 1, `${source.key}: fetched exactly once`);
    }
  }
});

test("offline verification checks every pin before parsing", () => {
  const artifacts = savedArtifacts();
  assert.doesNotThrow(() => audit.buildAudit(artifacts));
  // Same-length edits inside a statement fail on the SHA-256 pin, not later in a parser.
  const dubey = withText(artifacts, "dubey2013", (xml) => xml.replace("allotted 3 points", "allotted 4 points"));
  assert.throws(() => audit.buildAudit(dubey), /dubey2013: artifact SHA-256 drifted/);
  const barber = withText(artifacts, "barber2000", (text) => text.replace("ten regions", "nine region"));
  assert.throws(() => audit.buildAudit(barber), /barber2000: artifact SHA-256 drifted/);
  const capsule = withText(artifacts, "developers_insula_basal_ganglia", (html) =>
    html.replace("if posterior limb is hypodense", "if anterior limb is hypodense"),
  );
  assert.throws(() => audit.buildAudit(capsule), /developers_insula_basal_ganglia: artifact byte length drifted/);
  // A truncated capture fails on its byte length before the parser could miss the article body.
  const truncated = {
    ...artifacts,
    pexman2001: { ...artifacts.pexman2001, bytes: artifacts.pexman2001.bytes.subarray(0, 1000) },
  };
  assert.throws(() => audit.buildAudit(truncated), /pexman2001: artifact byte length drifted/);
  const redirected = {
    ...artifacts,
    pexman2001: { ...artifacts.pexman2001, finalUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7974585/" },
  };
  assert.throws(() => audit.buildAudit(redirected), /pexman2001: final URL host drifted/);
});

test("statement spans catch an edit inside a span even under re-pinned bytes", () => {
  const artifacts = savedArtifacts();
  const statement = audit.STATEMENTS.find(({ id }) => id === "pexman2001-results-internal-capsule-split");
  const blocks = audit.pmcArticleBlocks(artifacts.pexman2001.bytes.toString("utf8"));
  const block = blocks.find((candidate) => candidate.startsWith(statement.block));
  const mismatches = [];
  audit.checkSpans(statement, block.replace("both limbs", "one limb"), mismatches);
  assert.equal(mismatches.length, 1);
  assert.throws(() => audit.checkSpans(statement, block.replace("scored variably.", "scored."), []), /span start marker/);
  const barber = audit.pubmedAbstractText(artifacts.barber2000.bytes.toString("utf8"));
  assert.deepEqual([...barber.sections.keys()], [
    "abstract:BACKGROUND",
    "abstract:METHODS",
    "abstract:FINDINGS",
    "abstract:INTERPRETATION",
  ]);
});

test("runtime mutations fail the binding", () => {
  // Old insula-as-subcortical breakdown.
  const oldBreakdown = calculatorWith({
    compute: (values) => {
      const result = ASPECTSScore.compute(values);
      const count = (ids) => ids.filter((id) => values[id]).length;
      result["Regional Breakdown"] = `Subcortical: ${count(["caudate", "lentiform", "internal_capsule", "insular"])}/4 | Ganglionic cortical (M1-M3): ${count(["m1", "m2", "m3"])}/3 | Supraganglionic (M4-M6): ${count(["m4", "m5", "m6"])}/3`;
      return result;
    },
  });
  assert.throws(() => audit.verifyRuntime(oldBreakdown), /Regional Breakdown grouping/);

  // Old note trigger: any three of C, L, IC, I with no M region.
  const oldNote = calculatorWith({
    compute: (values) => {
      const result = ASPECTSScore.compute(values);
      const deep = ["caudate", "lentiform", "internal_capsule", "insular"].filter((id) => values[id]).length;
      const m = ["m1", "m2", "m3", "m4", "m5", "m6"].filter((id) => values[id]).length;
      const notes = (result["Clinical Notes"] ?? "").split("; ").filter(Boolean);
      const without = notes.filter((note) => note !== audit.PREDOMINANTLY_SUBCORTICAL_NOTE);
      if (deep >= 3 && m === 0) without.push(audit.PREDOMINANTLY_SUBCORTICAL_NOTE);
      result["Clinical Notes"] = without.join("; ");
      return result;
    },
  });
  assert.throws(() => audit.verifyRuntime(oldNote), /predominantly-subcortical note/);

  const withSubLabel = (id, subLabel) =>
    calculatorWith({ fields: ASPECTSScore.fields.map((field) => (field.id === id ? { ...field, subLabel } : field)) });
  assert.throws(
    () => audit.verifyRuntime(withSubLabel("m3", "Posterior temporal lobe at ganglionic level")),
    /subLabels drifted/,
  );
  assert.throws(
    () => audit.verifyRuntime(withSubLabel("internal_capsule", "Internal capsule at the ganglionic level")),
    /subLabels drifted/,
  );
  assert.throws(
    () =>
      audit.verifyRuntime(
        calculatorWith({
          info: {
            ...ASPECTSScore.info,
            text: ASPECTSScore.info.text.replace(
              "Posterior MCA cortex (behind M2)",
              "Posterior temporal lobe (posterior MCA cortex)",
            ),
          },
        }),
      ),
    /ganglionic-level region list drifted/,
  );
  assert.throws(
    () => audit.verifyRuntime(ASPECTSScore, 'subLabel: "Posterior limb of internal capsule (-1 point)"'),
    /calculator source still contains "\(-1 point\)"/,
  );
});

test("retrieval retries transport failures only", async () => {
  const source = audit.SOURCES.dubey2013;
  const saved = savedArtifacts().dubey2013;
  const sleeps = [];
  const sleep = async (ms) => {
    sleeps.push(ms);
  };

  let calls = 0;
  const flaky = async (url) => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    if (calls === 2) return fakeResponse({ status: 503, url, retryAfter: "2" });
    if (calls === 3) return fakeResponse({ status: 429, url });
    return fakeResponse({ url: saved.finalUrl, contentType: saved.contentType, bytes: saved.bytes });
  };
  const retrieved = await audit.retrieve(source, { fetchImpl: flaky, sleep });
  assert.equal(retrieved.attempts, 4);
  assert.deepEqual(sleeps, [1000, 2000, 4000]);

  for (const status of [404, 403, 410]) {
    calls = 0;
    await assert.rejects(
      audit.retrieve(source, {
        fetchImpl: async (url) => {
          calls += 1;
          return fakeResponse({ status, url });
        },
        sleep,
      }),
      new RegExp(`dubey2013: primary-source retrieval failed after 1 attempt\\(s\\) \\(HTTP ${status}\\)`),
    );
    assert.equal(calls, 1, `HTTP ${status} is not retried`);
  }

  calls = 0;
  await assert.rejects(
    audit.retrieve(source, {
      fetchImpl: async () => {
        calls += 1;
        throw new TypeError("fetch failed");
      },
      sleep,
    }),
    /after 4 attempt\(s\) \(fetch failed\)/,
  );
  assert.equal(calls, audit.FETCH_ATTEMPTS);
  assert.deepEqual(
    [408, 429, 500, 503, 404, 403].map((status) => audit.isRetryableStatus(status)),
    [true, true, true, true, false, false],
  );
  assert.equal(audit.retryDelayMs(null, 9), 20_000, "backoff is capped");
});
