import assert from "node:assert/strict";
import fs from "node:fs";

const path = "docs/calculators/radiology/bosniak-v2019-research-brief.md";
const brief = fs.readFileSync(path, "utf8");

assert.match(brief, /\*\*Status:\*\* Implemented and source-verified/);
assert.match(brief, /\*\*Live algorithm base:\*\* Silverman SG et al\..*Version 2019/);
assert.doesNotMatch(brief, /stage 1 of two-stage medical pipeline/i);
assert.doesNotMatch(brief, /Stage 2 trigger/i);
assert.doesNotMatch(brief, /Actual algorithm base:.*2005/i);
assert.doesNotMatch(brief, /awaiting physician sign-off for stage 2/i);
assert.doesNotMatch(brief, /current implementation to its 2005 source criterion/i);
assert.doesNotMatch(brief, /Current hierarchy: IV.*III.*IIF.*II.*I/i);
assert.match(brief, /Option B: Full v2019 Upgrade \(Selected and Implemented\)/);

console.log("Bosniak documentation status regression passed");
