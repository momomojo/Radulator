import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixturesRoot = path.join(root, "tests", "fixtures");
const supersededFixture = path.join(fixturesRoot, "meld-na-test-data.json");

assert.equal(
  existsSync(supersededFixture),
  false,
  "the superseded pre-MELD-3 fixture must not be restored as current test evidence",
);

const prohibitedManagementClaims = [
  /MELD-Na is the standard for liver transplant allocation/i,
  /meets criteria for liver transplant evaluation/i,
  /candidate for transplant listing/i,
  /high priority for transplantation/i,
];

for (const entry of readdirSync(fixturesRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const relativePath = path.join("tests", "fixtures", entry.name);
  const source = readFileSync(path.join(fixturesRoot, entry.name), "utf8");
  for (const claim of prohibitedManagementClaims) {
    assert.doesNotMatch(
      source,
      claim,
      `${relativePath} must not present unsupported score-triggered transplant management as current guidance`,
    );
  }
}

console.log("MELD fixture policy regression passed");
