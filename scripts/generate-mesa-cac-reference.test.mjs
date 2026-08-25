import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  buildReferenceGroups,
  hashReferenceData,
  parseMesaReferenceHtml,
  validateReferenceData,
} from "./generate-mesa-cac-reference.mjs";
import {
  MESA_CAC_REFERENCE,
  MESA_CAC_REFERENCE_SOURCE,
} from "../src/data/mesaCacReference.js";

const fixture = `
  <span id="Label10"><b><font>56 %.</font></b></span>
  <table id="Table1">
    <tr><td>25th</td><td>50th</td><td>75th</td><td>90th</td></tr>
    <tr><td><b>0</b></td><td><b>6</b></td><td><b>68</b></td><td><b>234</b></td></tr>
  </table>
  <span id="Label11">Percentiles and Calcium Scores for: white male of age 55</span>
`;

assert.deepEqual(parseMesaReferenceHtml(fixture), {
  probabilityNonzero: 56,
  referenceScores: [0, 6, 68, 234],
});

const groups = buildReferenceGroups();
assert.equal(groups.length, 320);
assert.deepEqual(groups[0], {
  key: "black:female:45",
  age: 45,
  sex: "female",
  sexValue: "0",
  race: "black",
  raceValue: "0",
});
assert.deepEqual(groups.at(-1), {
  key: "white:male:84",
  age: 84,
  sex: "male",
  sexValue: "1",
  race: "white",
  raceValue: "3",
});

assert.deepEqual(validateReferenceData(MESA_CAC_REFERENCE), {
  groupCount: 320,
  recordFieldCount: 2,
});
assert.equal(MESA_CAC_REFERENCE_SOURCE.tlsVerified, true);
assert.equal(MESA_CAC_REFERENCE_SOURCE.groupCount, 320);
assert.equal(
  MESA_CAC_REFERENCE_SOURCE.dataSha256,
  hashReferenceData(MESA_CAC_REFERENCE),
);

const auditManifestUrl = new URL(
  "../docs/evidence/mesa-cac-reference-audit/manifest.json",
  import.meta.url,
);
const audit = JSON.parse(
  readFileSync(
    auditManifestUrl,
    "utf8",
  ),
);
assert.equal(audit.tlsVerified, true);
assert.equal(audit.groupCount, 320);
assert.equal(audit.dataSha256, MESA_CAC_REFERENCE_SOURCE.dataSha256);
assert.equal(audit.chunks.length, 8);
const auditedEntries = [];
for (const chunkMetadata of audit.chunks) {
  const chunk = JSON.parse(
    readFileSync(new URL(chunkMetadata.file, auditManifestUrl), "utf8"),
  );
  assert.equal(chunk.tlsVerified, true);
  assert.equal(chunk.dataSha256, audit.dataSha256);
  assert.equal(chunk.groups.length, 40);
  const chunkData = Object.fromEntries(
    chunk.groups.map(({ key, p, r }) => [key, { p, r }]),
  );
  assert.equal(
    chunk.chunkSha256,
    createHash("sha256").update(JSON.stringify(chunkData)).digest("hex"),
  );
  assert.equal(chunk.chunkSha256, chunkMetadata.chunkSha256);
  auditedEntries.push(...chunk.groups);
}
assert.deepEqual(
  auditedEntries.map(({ key }) => key),
  groups.map(({ key }) => key),
);
for (const entry of auditedEntries) {
  const record = MESA_CAC_REFERENCE[entry.key];
  assert.deepEqual({ p: entry.p, r: entry.r }, record);
  assert.equal(
    entry.recordSha256,
    createHash("sha256").update(JSON.stringify(record)).digest("hex"),
  );
}
const documentation = readFileSync(
  new URL("../docs/calculators/cardiac/cac-mesa.md", import.meta.url),
  "utf8",
);
assert.match(documentation, /normal\s+TLS certificate verification/);
assert.ok(documentation.includes(MESA_CAC_REFERENCE_SOURCE.dataSha256));

console.log("MESA CAC reference generator tests passed.");
