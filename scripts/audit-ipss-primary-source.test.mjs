import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BOUNDARIES,
  CLAIMS,
  PIN,
  SOURCE,
  fetchSource,
  formatPass,
  loadCalculator,
  normalize,
  retryDelayMs,
  runAudit,
  sha256,
  verifyBytes,
  verifyCalculatorBoundaries,
  verifyClaims,
  verifyFinalUrl,
  verifyIdentity,
  verifyMediaType,
  xmlToText,
} from "./audit-ipss-primary-source.mjs";

const LOCATED = ["Important Lab Values", "Supporting Literature Summary"];
const encode = (text) => text.replaceAll("<", "&lt;").replaceAll(">=", "&#x02265;");
const paragraphs = (claims = CLAIMS) => claims.map((claim) => `<p>${encode(claim.text)}</p>`).join("");

// A stand-in PMC article: identity in <front>, statements in the located <body> section.
function article({ body } = {}) {
  const located = `<sec><title>Important Lab Values</title><p>Overview.</p><sec><title>Supporting Literature Summary</title>${paragraphs()}</sec></sec>`;
  return (
    `<?xml version="1.0"  ?><pmc-articleset><article><front><article-meta>` +
    `<article-id pub-id-type="pmcid">${SOURCE.pmcid}</article-id><article-id pub-id-type="pmcid-ver">${SOURCE.pmcidVersion}</article-id>` +
    `<article-id pub-id-type="pmid">${SOURCE.pmid}</article-id><article-id pub-id-type="doi">${SOURCE.doi}</article-id>` +
    `<title-group><article-title>${SOURCE.title}</article-title></title-group>` +
    `<permissions><license><ali:license_ref xmlns:ali="http://www.niso.org/schemas/ali/1.0/" specific-use="textmining">${SOURCE.license}</ali:license_ref></license></permissions>` +
    `</article-meta></front><body><sec><title>Pathophysiology</title><p>Unrelated.</p></sec>${body ?? located}</body></article></pmc-articleset>`
  );
}

// A fetch response as the audit sees it after redirects: final URL, headers and decoded bytes.
function reply({ status = 200, url = SOURCE.url, contentType = "text/xml; charset=UTF-8", body = article() } = {}) {
  const bytes = Buffer.from(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: new Headers(contentType === null ? {} : { "content-type": contentType }),
    body: { cancel: async () => {} },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}
// Pins for the stand-in bytes, so the offline fetch path can pass; the committed PIN never matches them.
const standInPin = (body = article()) => ({ ...PIN, bytes: Buffer.byteLength(body), sha256: sha256(Buffer.from(body)) });

test("parsing and normalization are deterministic", () => {
  assert.equal(
    normalize(xmlToText("<p>An ACTH <italic>IPS:P</italic> ratio &#x02265;2 prestimulation</p><p>next</p>")),
    "An ACTH IPS:P ratio >=2 prestimulation next",
  );
  assert.equal(normalize("ratios ≥ 1.8"), "ratios >= 1.8");
  assert.equal(normalize("ratio\u00a0\u2212\u20091.8"), "ratio - 1.8");
});

test("a stand-in article passes identity and locates every statement in its section", () => {
  verifyIdentity(article());
  assert.deepEqual(
    verifyClaims(article()),
    CLAIMS.map((claim) => ({ id: claim.id, section_path: LOCATED })),
  );
  for (const claim of CLAIMS) {
    assert.deepEqual(claim.locator.section_path, LOCATED, claim.id);
    assert.ok(Object.isFrozen(claim) && Object.isFrozen(claim.locator) && Object.isFrozen(claim.locator.section_path), claim.id);
  }
  // JATS <sec-meta> and <label> precede the <title>; neither is a nested section or part of the path.
  const withMeta = article({
    body: `<sec id="s1"><label>4</label><title>Important Lab Values</title><sec><sec-meta><kwd-group><kwd>ACTH</kwd></kwd-group></sec-meta><title>Supporting Literature Summary</title>${paragraphs()}</sec></sec>`,
  });
  assert.deepEqual(verifyClaims(withMeta), CLAIMS.map((claim) => ({ id: claim.id, section_path: LOCATED })));
});

test("a changed statement or identity fails", () => {
  assert.throws(() => verifyClaims(article().replace("&#x02265;1.8", "&#x02265;2.0")), /prl-supports-adequate-sampling/);
  assert.throws(() => verifyIdentity(article().replace(`>${SOURCE.pmid}<`, ">1<")), /PMID/);
  assert.throws(() => verifyIdentity(article().replace(`>${SOURCE.pmcidVersion}<`, `>${SOURCE.pmcid}.2<`)), /article version/);
  assert.throws(() => verifyIdentity(article().replace(": A Guideline From", ": A Review From")), /article title/);
  assert.throws(() => verifyIdentity(article().replace("by-nc-nd", "by-nc")), /license/);
});

test("a missing section fails", () => {
  const renamed = article().replace("<title>Important Lab Values</title>", "<title>Laboratory Values</title>");
  assert.throws(() => verifyClaims(renamed), /section not found \(acth-basal-and-stimulated-cutoffs\): Important Lab Values > Supporting Literature Summary/);
  const flattened = article({ body: `<sec><title>Important Lab Values</title>${paragraphs()}</sec>` });
  assert.throws(() => verifyClaims(flattened), /section not found/);
});

test("a statement outside its located section fails", () => {
  // In the parent section rather than the located child: the child's own text lacks it.
  const inParent = article({
    body: `<sec><title>Important Lab Values</title>${paragraphs()}<sec><title>Supporting Literature Summary</title><p>Other.</p></sec></sec>`,
  });
  assert.throws(() => verifyClaims(inParent), /source statement not found once in Important Lab Values > Supporting Literature Summary \(acth-basal-and-stimulated-cutoffs\)/);
  // In a different section that happens to share the child title.
  const elsewhere = article({
    body: `<sec><title>Indications</title><sec><title>Supporting Literature Summary</title>${paragraphs()}</sec></sec><sec><title>Important Lab Values</title><sec><title>Supporting Literature Summary</title><p>Other.</p></sec></sec>`,
  });
  assert.throws(() => verifyClaims(elsewhere), /source statement not found once/);
  // Stated twice in the located section: the locator no longer identifies one statement.
  const twice = article({ body: `<sec><title>Important Lab Values</title><sec><title>Supporting Literature Summary</title>${paragraphs()}${paragraphs()}</sec></sec>` });
  assert.throws(() => verifyClaims(twice), /source statement not found once/);
});

test("an ambiguous section path fails", () => {
  const located = `<sec><title>Important Lab Values</title><sec><title>Supporting Literature Summary</title>${paragraphs()}</sec></sec>`;
  assert.throws(() => verifyClaims(article({ body: located + located })), /section path is ambiguous/);
  assert.throws(() => verifyClaims(article({ body: `<sec><title>Important Lab Values</title>` })), /unbalanced <sec>/);
});

test("the committed pins are well formed and name the requested record", () => {
  assert.ok(Object.isFrozen(PIN) && Object.isFrozen(PIN.query));
  assert.match(PIN.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(PIN.bytes) && PIN.bytes > 0);
  assert.equal(PIN.mediaType, "text/xml");
  assert.equal(PIN.charset, "utf-8");
  const requested = verifyFinalUrl(SOURCE.url);
  assert.equal(`${requested.protocol}//${requested.host}${requested.pathname}`, "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
  assert.equal(PIN.query.id, SOURCE.pmcid.replace("PMC", ""));
});

test("the final URL must be the pinned host and path for the same record", () => {
  const url = new URL(SOURCE.url);
  const variant = (change) => { const copy = new URL(url); change(copy); return copy.href; };
  assert.throws(() => verifyFinalUrl(variant((u) => { u.host = "www.ncbi.nlm.nih.gov"; })), /final response host www\.ncbi\.nlm\.nih\.gov is not eutils\.ncbi\.nlm\.nih\.gov/);
  assert.throws(() => verifyFinalUrl(variant((u) => { u.host = "eutils.ncbi.nlm.nih.gov:8443"; })), /final response host/);
  assert.throws(() => verifyFinalUrl(variant((u) => { u.pathname = "/pmc/articles/PMC13138407/"; })), /final response path/);
  assert.throws(() => verifyFinalUrl(variant((u) => { u.protocol = "http:"; })), /final response protocol/);
  assert.throws(() => verifyFinalUrl(variant((u) => { u.searchParams.set("id", "13138408"); })), /final response query id/);
  assert.throws(() => verifyFinalUrl(""), /final response URL missing or invalid/);
});

test("the media type must be text/xml in UTF-8", () => {
  assert.equal(verifyMediaType("text/xml; charset=UTF-8"), "text/xml; charset=utf-8");
  assert.equal(verifyMediaType('Text/XML;Charset="utf-8"'), "text/xml; charset=utf-8");
  assert.throws(() => verifyMediaType("text/html; charset=UTF-8"), /media type/);
  assert.throws(() => verifyMediaType("application/xml; charset=UTF-8"), /media type/);
  assert.throws(() => verifyMediaType("text/xml"), /charset/);
  assert.throws(() => verifyMediaType(null), /media type <missing>/);
});

test("a tampered digest, changed bytes or a different length fail", () => {
  const body = Buffer.from(article());
  const pin = standInPin();
  assert.equal(verifyBytes(body, pin), pin.sha256);
  const flipped = `${pin.sha256[0] === "0" ? "1" : "0"}${pin.sha256.slice(1)}`;
  assert.throws(() => verifyBytes(body, { ...pin, sha256: flipped }), /response SHA-256 [0-9a-f]{64} is not pinned/);
  const changed = Buffer.from(article().replace("prestimulation", "Prestimulation"));
  assert.equal(changed.length, body.length);
  assert.throws(() => verifyBytes(changed, pin), /response SHA-256/);
  assert.throws(() => verifyBytes(body.subarray(0, body.length - 1), pin), /bytes, pinned/);
  assert.throws(() => verifyBytes(body), /pinned 118457/, "the committed pin rejects the stand-in");
});

test("fetchSource accepts only a pinned response and never retries a pin mismatch", async () => {
  const pin = standInPin();
  const noSleep = async () => assert.fail("a pin mismatch must not be retried");
  const accepted = await fetchSource({ pin, sleep: noSleep, fetchImpl: async () => reply() });
  assert.equal(accepted.sha256, pin.sha256);
  assert.equal(accepted.finalUrl, "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
  assert.equal(accepted.mediaType, "text/xml; charset=utf-8");
  for (const [response, expected] of [
    [reply({ url: SOURCE.url.replace("eutils.ncbi", "www.ncbi") }), /final response host/],
    [reply({ url: SOURCE.url.replace("/entrez/eutils/efetch.fcgi", "/pmc/oai/oai.cgi") }), /final response path/],
    [reply({ contentType: "text/html; charset=UTF-8" }), /media type/],
    [reply({ body: article().replace("1.8 support", "1.9 support") }), /response SHA-256/],
  ]) {
    let calls = 0;
    await assert.rejects(fetchSource({ pin, sleep: noSleep, fetchImpl: async () => { calls += 1; return response; } }), expected);
    assert.equal(calls, 1);
  }
});

test("retries back off and honour Retry-After, then fail loudly", async () => {
  assert.equal(retryDelayMs(undefined, 3), 4_000);
  assert.equal(retryDelayMs({ headers: new Headers({ "retry-after": "7" }) }, 1), 7_000);
  const delays = [];
  await assert.rejects(
    fetchSource({
      fetchImpl: async () => new Response("busy", { status: 503 }),
      sleep: async (ms) => delays.push(ms),
      attempts: 3,
    }),
    /retrieval failed after 3 attempts \(HTTP 503\)/,
  );
  assert.deepEqual(delays, [1_000, 2_000]);
  // A transient failure is retried; the response that follows must still match every pin.
  const replies = [new Response("busy", { status: 503 }), reply()];
  const retried = await fetchSource({ pin: standInPin(), fetchImpl: async () => replies.shift(), sleep: async (ms) => delays.push(ms) });
  assert.equal(retried.sha256, standInPin().sha256);
  assert.deepEqual(delays, [1_000, 2_000, 1_000]);
});

test("the calculator's boundaries match the source cutoffs on both sides", async () => {
  assert.deepEqual(verifyCalculatorBoundaries(await loadCalculator()), BOUNDARIES);
});

test("an exclusive comparison at any source boundary fails the binding", async () => {
  const source = readFileSync(new URL("../src/components/calculators/IPSS.jsx", import.meta.url), "utf8");
  const load = async (text) => (await import(`data:text/javascript;base64,${Buffer.from(text).toString("base64")}`)).IPSS;
  // Basal ACTH >=2 (left, right), stimulated peak >=3, basal PRL >=1.8 (left, right).
  for (const [inclusive, count] of [["[2n, 1n]) >= 0", 2], ["[3n, 1n]) >= 0", 1], ["[18n, 10n]) >= 0", 2]]) {
    const parts = source.split(inclusive);
    assert.equal(parts.length - 1, count, `IPSS.jsx should contain ${count} "${inclusive}" comparison(s)`);
    for (let index = 0; index < count; index += 1) {
      const mutant = `${parts.slice(0, index + 1).join(inclusive)}${inclusive.replace(">= 0", "> 0")}${parts.slice(index + 1).join(inclusive)}`;
      const IPSS = await load(mutant);
      assert.throws(() => verifyCalculatorBoundaries(IPSS), `exclusive ${inclusive} (occurrence ${index + 1}) must fail`);
    }
  }
});

// Live, at the exact head: the pinned source, its located statements and the calculator binding.
test("live primary source matches every pin", async () => {
  const result = await runAudit();
  assert.equal(result.finalUrl, `${PIN.protocol}//${PIN.host}${PIN.path}`);
  assert.equal(result.mediaType, `${PIN.mediaType}; charset=${PIN.charset}`);
  assert.equal(result.bytes, PIN.bytes);
  assert.equal(result.sha256, PIN.sha256);
  assert.deepEqual(result.claims, CLAIMS.map((claim) => ({ id: claim.id, section_path: LOCATED })));
  const line = formatPass(result);
  assert.ok(line.startsWith("IPSS primary-source audit PASS: ") && line.includes(`sha256=${PIN.sha256}`));
  console.log(line);
});
