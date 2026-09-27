import assert from "node:assert/strict";
import {
  CLAIMS,
  SOURCE,
  fetchSourceXml,
  loadCalculator,
  normalize,
  retryDelayMs,
  runAudit,
  verifyCalculatorBoundaries,
  verifyClaims,
  verifyIdentity,
  xmlToText,
} from "./audit-ipss-primary-source.mjs";

// Offline: parsing and normalization are deterministic.
assert.equal(
  normalize(xmlToText("<p>An ACTH <italic>IPS:P</italic> ratio &#x02265;2 prestimulation</p><p>next</p>")),
  "An ACTH IPS:P ratio >=2 prestimulation next",
);
assert.equal(normalize("ratios ≥ 1.8"), "ratios >= 1.8");

// Offline: a stand-in article with the statements passes; dropping one fails.
const article = `<article><front><article-meta><article-id pub-id-type="pmid">${SOURCE.pmid}</article-id>
<article-id pub-id-type="pmcid">${SOURCE.pmcid}</article-id><article-id pub-id-type="doi">${SOURCE.doi}</article-id>
<title-group><article-title>${SOURCE.title}: A Guideline</article-title></title-group></article-meta></front>
<body>${CLAIMS.map((claim) => `<p>${claim.text.replaceAll("<", "&lt;").replaceAll(">=", "&#x02265;")}</p>`).join("")}</body></article>`;
verifyClaims(verifyIdentity(article));
assert.throws(() => verifyClaims(verifyIdentity(article.replace("&#x02265;1.8", "&#x02265;2.0"))), /prl-supports/);
assert.throws(() => verifyIdentity(article.replace(SOURCE.pmid, "1")), /PMID/);

// Offline: retries back off and honour Retry-After, then fail loudly.
assert.equal(retryDelayMs(undefined, 3), 4_000);
assert.equal(retryDelayMs({ headers: new Headers({ "retry-after": "7" }) }, 1), 7_000);
const delays = [];
await assert.rejects(
  fetchSourceXml({
    fetchImpl: async () => new Response("busy", { status: 503 }),
    sleep: async (ms) => delays.push(ms),
    attempts: 3,
  }),
  /retrieval failed after 3 attempts \(HTTP 503\)/,
);
assert.deepEqual(delays, [1_000, 2_000]);

// Offline: the calculator's boundaries match the source cutoffs.
verifyCalculatorBoundaries(await loadCalculator());

// Live, at the exact head: retrieve the guideline, check identity and statements, bind the calculator.
const result = await runAudit();
console.log(`IPSS primary-source audit PASS: ${result.source.pmcid}; ${result.claims.join(", ")}`);
