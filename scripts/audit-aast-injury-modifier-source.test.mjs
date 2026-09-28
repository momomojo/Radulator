#!/usr/bin/env node

// Tests for scripts/audit-aast-injury-modifier-source.mjs.
// - Runs the exact-head audit live and checks its pinned artifacts, statements and bindings.
// - Mutation checks: runtime mutants (the former unconditional multiple-injury rule, visibility
//   and ceiling regressions, reverted wording/citation) must each be rejected by the audit's
//   runtime verifier; source-side mutation checks run inside the live audit on the real spans.
// - Offline checks of span anchoring, retries and Cloudflare-challenge recognition.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";
import test from "node:test";

await import("./register-jsx-loader.mjs");
const { AASTTraumaGrading } = await import("../src/components/calculators/AASTTraumaGrading.jsx");
const audit = await import("./audit-aast-injury-modifier-source.mjs");

const noSleep = async () => {};

function response({ status = 200, url = "https://example.test/", body = "", headers = {} }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    url,
    headers: new Headers(headers),
    body: { cancel: async () => {} },
    async text() {
      return body;
    },
    async arrayBuffer() {
      return new TextEncoder().encode(body).buffer;
    },
  };
}

const CHALLENGE_BODY =
  '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></body></html>';

function mutant(overrides = {}) {
  return {
    ...AASTTraumaGrading,
    fields: overrides.fields ?? AASTTraumaGrading.fields,
    compute: overrides.compute ?? AASTTraumaGrading.compute,
    refs: overrides.refs ?? AASTTraumaGrading.refs,
    info: overrides.info ?? AASTTraumaGrading.info,
  };
}

function withField(id, change) {
  return AASTTraumaGrading.fields.map((field) => (field.id === id ? change({ ...field }) : field));
}

// Reapplies an advance on top of the real (modifier-free) grade, the way a regression would.
function computeWithRule(predicate) {
  return (vals) => {
    const result = AASTTraumaGrading.compute({ ...vals, multiple_injuries: false, kidney_2018_bilateral: false });
    if (result.Error) return result;
    const base = Number(result["AAST Grade"].replace("Grade ", ""));
    if (!predicate(vals, base)) return result;
    return {
      ...result,
      "AAST Grade": `Grade ${base + 1}`,
      "Key Findings": `${result["Key Findings"]}; Multiple injuries (+1 grade)`,
      "Multiple Injury Adjustment": `Base grade ${base} advanced to Grade ${base + 1} due to multiple injuries`,
    };
  };
}

test("the real calculator satisfies every runtime binding", () => {
  const runtime = audit.verifyRuntime(AASTTraumaGrading);
  assert.equal(runtime.vectors, 270);
  assert.deepEqual(Object.keys(runtime.bindings).sort(), audit.CLAIM_BINDINGS.map((binding) => binding.claim_id).sort());
  assert.deepEqual(runtime.fail_safe, {
    provenance: "radulator-fail-safe-policy",
    publication_derived: false,
    paths: ["kidney2025", "kidneyDefault", "pancreas"],
    modifiers_shown: false,
    stale_values_applied: false,
  });
});

test("mutation checks: runtime regressions are rejected", () => {
  const mutants = {
    "former unconditional multiple-injury rule on every organ": mutant({
      fields: withField("multiple_injuries", (field) => ({ ...field, showIf: undefined })),
      compute: computeWithRule((vals, base) => vals.multiple_injuries && base > 0 && base < 3),
    }),
    "multiple-injury rule still applied to the kidney": mutant({
      compute: computeWithRule(
        (vals, base) => vals.multiple_injuries === true && ["liver", "spleen", "kidney"].includes(vals.organ) && base < 3,
      ),
    }),
    "multiple-injury rule applied to the 2024 pancreas path": mutant({
      compute: (vals) =>
        vals.organ === "pancreas"
          ? computeWithRule((_, base) => vals.multiple_injuries === true && base < 3)(vals)
          : AASTTraumaGrading.compute(vals),
    }),
    "multiple-injury checkbox shown for the kidney": mutant({
      fields: withField("multiple_injuries", (field) => ({
        ...field,
        showIf: (vals) => ["liver", "spleen", "kidney"].includes(vals.organ),
      })),
    }),
    "bilateral checkbox shown on the 2025 kidney path": mutant({
      fields: withField("kidney_2018_bilateral", (field) => ({ ...field, showIf: (vals) => vals.organ === "kidney" })),
    }),
    "bilateral advance applied on the 2025 kidney path": mutant({
      compute: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version !== "2018" && vals.kidney_2018_bilateral === true
          ? computeWithRule((_, base) => base < 3)(vals)
          : AASTTraumaGrading.compute(vals),
    }),
    "grade III ceiling removed": mutant({
      compute: computeWithRule((vals, base) => vals.multiple_injuries === true && ["liver", "spleen"].includes(vals.organ) && base < 4),
    }),
    "loose truthy value applies the modifier": mutant({
      compute: (vals) => AASTTraumaGrading.compute({ ...vals, multiple_injuries: Boolean(vals.multiple_injuries) }),
    }),
    "2018 urinary extravasation subLabel reverted": mutant({
      fields: withField("kidney_2018_urinary_extrav", (field) => ({
        ...field,
        subLabel: "Contrast extravasation on delayed phase → Grade IV",
      })),
    }),
    "pancreas grade V subLabel reverted to the 1990 wording": mutant({
      fields: withField("pancreas_destructive", (field) => ({
        ...field,
        subLabel: "Massive disruption of pancreatic head with nonviable parenchyma → Grade V",
      })),
    }),
    "Keihani 2025 citation reverted to the wrong third author": mutant({
      refs: AASTTraumaGrading.refs.map((ref) =>
        ref.u === "https://pubmed.ncbi.nlm.nih.gov/39836096/" ? { ...ref, t: ref.t.replace("Matta R", "Swaroop M") } : ref,
      ),
    }),
    "info text no longer states the modifiers": mutant({
      info: { ...AASTTraumaGrading.info, text: AASTTraumaGrading.info.text.split("GRADE-ADVANCE MODIFIERS")[0] },
    }),
  };
  for (const [name, calculator] of Object.entries(mutants)) {
    assert.throws(() => audit.verifyRuntime(calculator), `mutant was not rejected: ${name}`);
  }
});

test("span anchors fail closed when missing, repeated or changed (synthetic text)", () => {
  const text = "alpha beta gamma delta epsilon zeta";
  assert.equal(audit.spanText(text, "beta", "delta", "ok"), "beta gamma delta");
  assert.throws(() => audit.spanText(text, "omega", "delta", "missing"), /start anchor/);
  assert.throws(() => audit.spanText(`${text} beta`, "beta", "delta", "repeated"), /not unique/);
  assert.throws(() => audit.spanText(text, "beta", "omega", "no end"), /end anchor/);
  const statement = { id: "synthetic", spans: [{ from: "beta", to: "delta", length: 16, sha256: audit.sha256("beta gamma delta") }] };
  const clean = [];
  audit.checkSpans(statement, text, (value) => value, clean);
  assert.deepEqual(clean, []);
  const drifted = [];
  audit.checkSpans(statement, text.replace("gamma", "gamme"), (value) => value, drifted);
  assert.equal(drifted.length, 1, "a one-letter change inside a pinned span must be reported");
  assert.throws(
    () => audit.paragraphSlice("one two one", { id: "dup", start: "one", end: null }),
    /not unique/,
  );
});

test("retrieval retries 429/5xx and network errors (and NCBI's transient 400) but not other client errors", async () => {
  const source = { key: "synthetic", url: "https://example.test/doc.pdf" };
  let calls = 0;
  const sleeps = [];
  const recordSleep = async (ms) => {
    sleeps.push(ms);
  };
  const flaky = async () => {
    calls += 1;
    return calls === 1
      ? response({ status: 503, headers: { "retry-after": "2" } })
      : response({ status: 200, url: source.url, body: "%PDF-1.4", headers: { "content-type": "application/pdf" } });
  };
  const ok = await audit.retrieve(source, { fetchImpl: flaky, sleepImpl: recordSleep });
  assert.equal(ok.mode, "live");
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [2000], "Retry-After is honoured");
  assert.equal(audit.retryDelayMs(response({ status: 503, headers: { "retry-after": "600" } }), 1), 20000, "Retry-After is capped");
  assert.equal(audit.retryDelayMs(undefined, 3), 4000, "exponential backoff without Retry-After");

  calls = 0;
  const throttled = async () => {
    calls += 1;
    return response({ status: 429 });
  };
  await assert.rejects(audit.retrieve(source, { fetchImpl: throttled, sleepImpl: noSleep }), /after 5 attempts \(HTTP 429\)/);
  assert.equal(calls, 5);

  calls = 0;
  const offline = async () => {
    calls += 1;
    throw new Error("socket hang up");
  };
  await assert.rejects(audit.retrieve(source, { fetchImpl: offline, sleepImpl: noSleep }), /socket hang up/);
  assert.equal(calls, 5);

  calls = 0;
  const missing = async () => {
    calls += 1;
    return response({ status: 404 });
  };
  await assert.rejects(audit.retrieve(source, { fetchImpl: missing, sleepImpl: noSleep }), /HTTP 404/);
  assert.equal(calls, 1);

  // HTTP 400 is retried only for the NCBI source.
  calls = 0;
  const badRequest = async () => {
    calls += 1;
    return response({ status: 400 });
  };
  await assert.rejects(audit.retrieve(source, { fetchImpl: badRequest, sleepImpl: noSleep }), /HTTP 400/);
  assert.equal(calls, 1);
  assert.equal(audit.SOURCES.pubmed.retry_http_400, true);
  assert.equal(audit.SOURCES.kozar2018.retry_http_400, undefined);
  calls = 0;
  const ncbiTransient = async () => {
    calls += 1;
    return calls < 3 ? response({ status: 400 }) : response({ status: 200, url: audit.SOURCES.pubmed.url, body: "<x/>", headers: { "content-type": "text/xml" } });
  };
  const ncbi = await audit.retrieve(audit.SOURCES.pubmed, { fetchImpl: ncbiTransient, sleepImpl: noSleep });
  assert.equal(ncbi.mode, "live");
  assert.equal(calls, 3);
});

test("only a recognised Cloudflare challenge is reported as challenged", async () => {
  const challenge = audit.detectCloudflareChallenge({
    status: 403,
    headers: new Headers({ "cf-mitigated": "challenge" }),
    body: CHALLENGE_BODY,
  });
  assert.equal(challenge.challenged, true);
  assert.equal(audit.detectCloudflareChallenge({ status: 403, headers: new Headers(), body: "Forbidden" }).challenged, false);
  assert.equal(
    audit.detectCloudflareChallenge({ status: 200, headers: new Headers({ "cf-mitigated": "challenge" }), body: CHALLENGE_BODY }).challenged,
    false,
  );
  assert.equal(
    audit.detectCloudflareChallenge({ status: 403, headers: new Headers({ "cf-mitigated": "challenge" }), body: "" }).challenged,
    false,
    "one signal is not enough",
  );
  // Cloudflare block page (e.g. error 1020) served in front of the site.
  assert.equal(
    audit.detectCloudflareChallenge({
      status: 403,
      headers: new Headers({ server: "cloudflare", "cf-ray": "0000000000000000-XXX" }),
      body: '<html><head><title>Access denied | www.aast.org used Cloudflare to restrict access</title></head><body><div id="cf-error-details">Error 1020</div></body></html>',
    }).challenged,
    true,
  );
  // An origin 403 that merely passes through Cloudflare is a real failure.
  assert.equal(
    audit.detectCloudflareChallenge({
      status: 403,
      headers: new Headers({ server: "cloudflare", "cf-ray": "0000000000000000-XXX" }),
      body: "<html><head><title>Forbidden</title></head><body>Forbidden</body></html>",
    }).challenged,
    false,
  );

  const source = { key: "synthetic", url: "https://www.aast.org/asset/x/" };
  const challenged = async () => response({ status: 403, body: CHALLENGE_BODY, headers: { "cf-mitigated": "challenge" } });
  const result = await audit.retrieve(source, { fetchImpl: challenged, sleepImpl: noSleep, allowChallenge: true });
  assert.equal(result.mode, "challenged-by-cloudflare-bot-protection");
  await assert.rejects(audit.retrieve(source, { fetchImpl: challenged, sleepImpl: noSleep }), /HTTP 403/);
  const plainForbidden = async () => response({ status: 403, body: "Forbidden" });
  await assert.rejects(
    audit.retrieve(source, { fetchImpl: plainForbidden, sleepImpl: noSleep, allowChallenge: true }),
    /HTTP 403/,
  );
});

test("a Cloudflare challenge on aast.org keeps every runtime and PubMed check, and fails with --require-live", async () => {
  const fetchImpl = (url, init) =>
    String(url).startsWith("https://www.aast.org/")
      ? Promise.resolve(response({ status: 403, body: CHALLENGE_BODY, headers: { "cf-mitigated": "challenge" } }))
      : fetch(url, init);
  const challenged = await audit.runAudit({ calculator: AASTTraumaGrading, fetchImpl, sleepImpl: noSleep });
  assert.equal(challenged.sources[0].mode, "challenged-by-cloudflare-bot-protection");
  assert.equal(challenged.sources[1].mode, "live");
  assert.equal(challenged.notices.length, 1);
  assert.match(challenged.notices[0], /statements were not re-read in this run/);
  assert.equal(challenged.source_mutation_checks.length, 0);
  assert.deepEqual(
    challenged.claim_bindings.filter((binding) => binding.source_verified_this_run).map((binding) => binding.claim_id),
    ["pancreas-2024-grade-v-sublabel"],
  );
  assert.equal(challenged.runtime.vectors, 270);
  await assert.rejects(
    audit.runAudit({ calculator: AASTTraumaGrading, fetchImpl, sleepImpl: noSleep, requireLive: true }),
    /--require-live/,
  );
  // A mutant still fails even when the PDF could not be re-read.
  await assert.rejects(
    audit.runAudit({
      calculator: mutant({ compute: computeWithRule((vals, base) => vals.multiple_injuries === true && base < 3) }),
      fetchImpl,
      sleepImpl: noSleep,
    }),
  );
});

test("live exact-head audit and the compute regression tests pass", () => {
  const run = spawnSync(
    process.execPath,
    ["--import", "./scripts/register-jsx-loader.mjs", "scripts/audit-aast-injury-modifier-source.mjs", "--json"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(run.status, 0, `AAST source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);

  const computeTests = spawnSync(
    process.execPath,
    ["--import", "./scripts/register-jsx-loader.mjs", "--test", "tests/aast-trauma-grading-compute.test.mjs"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(computeTests.status, 0, `AAST compute tests failed\nstdout:\n${computeTests.stdout}\nstderr:\n${computeTests.stderr}`);

  const result = JSON.parse(run.stdout);
  assert.equal(result.schema, "radulator-aast-injury-modifier-source-audit/v1");
  assert.equal(result.calculator_id, "aast-trauma-grading");
  assert.equal(result.calculator_path, "src/components/calculators/AASTTraumaGrading.jsx");
  assert.equal(result.source_bytes_committed, false);

  const [kozar, pubmed] = result.sources;
  assert.equal(kozar.key, "kozar2018");
  assert.equal(kozar.url, "https://www.aast.org/asset/1EDF1B04-6B52-4E7B-9130ACA30413089D/");
  assert.equal(kozar.doi, "10.1097/TA.0000000000002058");
  assert.equal(kozar.pmid, "30462622");
  assert.equal(kozar.pin, "raw-bytes");
  assert.equal(kozar.bytes, 174748);
  assert.equal(kozar.sha256, "bcd66906506efee3757ce1ea39e0da66bf30e39ffa7ccf3c33cc2678b3430965");
  assert.equal(kozar.pages, 4);
  assert.equal(pubmed.key, "pubmed");
  assert.equal(pubmed.mode, "live");
  assert.equal(
    pubmed.url,
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=30462622,39836096,39898876&retmode=xml&tool=radulator-aast-audit",
  );
  assert.equal(pubmed.final_url, pubmed.url);
  assert.equal(pubmed.pin, "pubmed-record-fields");
  assert.equal(pubmed.records_sha256, "20638d0a63f3574ea7a5b7c07640233d9ab8ab2c9b721b111342954f9366bca7");
  assert.equal(pubmed.observed_raw.enforced, false);

  const kozarStatementIds = [
    "kozar2018-identity",
    "kozar2018-intro-multiple-grade-i-ii",
    "kozar2018-table1-spleen-notes",
    "kozar2018-table2-liver-notes",
    "kozar2018-table3-kidney-notes",
    "kozar2018-table3-kidney-grade-iv-urinary-extravasation",
    "kozar2018-table3-active-bleeding-delayed-phase",
    "kozar2018-delayed-excretory-phase",
  ];
  const pubmedStatementIds = [
    "kozar2018-pubmed-identity",
    "keihani2025-pubmed-identity",
    "notrica2025-pubmed-identity",
    "notrica2025-abstract-grade-v",
  ];
  if (kozar.mode === "live") {
    assert.match(kozar.final_url, /^https:\/\/www\.aast\.org\/static\/journal_pdf_[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/);
    assert.deepEqual(result.notices, []);
    assert.deepEqual(
      result.source_statements.map(({ id }) => id),
      [...kozarStatementIds, ...pubmedStatementIds],
    );
    const statements = new Map(result.source_statements.map((statement) => [statement.id, statement]));
    const digests = (id) => statements.get(id).spans.map(({ sha256 }) => sha256);
    assert.deepEqual(digests("kozar2018-table3-kidney-notes"), [
      "b039c9dd44be2b078d880698ef176fdfb197aafaed3ab9a94784c1cdc204182a",
      "9890ed6ae41178c64c3064697c32e9b08671b5b90b7f507959a7cf8f9ef2ca67",
    ]);
    assert.deepEqual(digests("kozar2018-table1-spleen-notes"), [
      "cfe3115003f594c7db901176958e61f2e95bc36e40121d68921df686566aadab",
      "b85de582ee4b5967f096d3e7c059b002806955b901bfb4423e4c806be6c9dbf8",
    ]);
    assert.deepEqual(digests("kozar2018-table2-liver-notes"), [
      "06919be0ee7d77a806f173d1c16209dee7450ba48bfe6416d40a9e3ee6f5b7b1",
      "b85de582ee4b5967f096d3e7c059b002806955b901bfb4423e4c806be6c9dbf8",
    ]);
    assert.deepEqual(digests("kozar2018-intro-multiple-grade-i-ii"), [
      "ef31c680b05fae8abab6ca881f2239599503fe5ff6218189da8c4d7115c8707e",
    ]);
    assert.deepEqual(statements.get("kozar2018-table3-kidney-notes").absent_anchors, ["Advance one grade for multiple"]);
    assert.deepEqual(statements.get("kozar2018-table1-spleen-notes").absent_anchors, ["Advance one grade for bilateral"]);
    assert.deepEqual(statements.get("kozar2018-table2-liver-notes").absent_anchors, ["Advance one grade for bilateral"]);
    // Source-side mutation checks: each trigger word and the grade III ceiling sit inside a pinned span.
    assert.equal(result.source_mutation_checks.length, 11);
    assert.ok(result.source_mutation_checks.every((check) => check.rejected === true));
    assert.deepEqual(
      result.source_mutation_checks
        .filter((check) => check.statement_id === "kozar2018-table3-kidney-notes")
        .map(({ replaced, with: replacement }) => [replaced, replacement]),
      [
        ["bilateral", "multiple"],
        ["gradeiii", "gradeiv"],
      ],
    );
    assert.ok(result.claim_bindings.every((binding) => binding.source_verified_this_run));
  } else {
    // Cloudflare challenged the AAST PDF in this environment: pins stay committed, runtime still enforced.
    assert.equal(kozar.mode, "challenged-by-cloudflare-bot-protection");
    assert.equal(result.notices.length, 1);
    assert.deepEqual(result.source_statements.map(({ id }) => id), pubmedStatementIds);
  }
  for (const statement of result.source_statements) {
    assert.equal(typeof statement.paraphrase, "string", `${statement.id}: paraphrase`);
    for (const span of statement.spans ?? []) {
      assert.ok(span.from && span.to && span.length > 0, `${statement.id}: span anchors and length`);
      for (const anchor of [span.from, span.to]) {
        assert.ok(anchor.split(/\s+/).length <= 6, `${statement.id}: anchor longer than six words`);
      }
    }
  }

  assert.deepEqual(
    result.claim_bindings.map(({ claim_id, source_statement_ids }) => [claim_id, source_statement_ids]),
    [
      ["liver-2018-multiple-injury-advance", ["kozar2018-intro-multiple-grade-i-ii", "kozar2018-table2-liver-notes"]],
      ["spleen-2018-multiple-injury-advance", ["kozar2018-intro-multiple-grade-i-ii", "kozar2018-table1-spleen-notes"]],
      ["kidney-2018-bilateral-advance", ["kozar2018-table3-kidney-notes"]],
      ["kidney-2018-no-multiple-injury-advance", ["kozar2018-table3-kidney-notes"]],
      [
        "kidney-2018-urinary-extravasation-sublabel",
        [
          "kozar2018-table3-kidney-grade-iv-urinary-extravasation",
          "kozar2018-table3-active-bleeding-delayed-phase",
          "kozar2018-delayed-excretory-phase",
        ],
      ],
      ["pancreas-2024-grade-v-sublabel", ["notrica2025-abstract-grade-v"]],
      [
        "reference-list-identities",
        ["kozar2018-identity", "kozar2018-pubmed-identity", "keihani2025-pubmed-identity", "notrica2025-pubmed-identity"],
      ],
    ],
  );
  assert.equal(result.runtime.vectors, 270);
  assert.equal(result.runtime.fail_safe.publication_derived, false);
  assert.deepEqual(result.scope.not_asserted, [
    "whether the 2025 kidney revision (Keihani 2025) keeps any grade-advance rule: full text not openly retrievable",
    "whether the 2024 pancreas revision (Notrica 2025) keeps any grade-advance rule: full text not openly retrievable",
    "2024 pancreas grade V ductal subgrades (not modeled by the calculator)",
    "whole-calculator clinical acceptance",
  ]);
});
