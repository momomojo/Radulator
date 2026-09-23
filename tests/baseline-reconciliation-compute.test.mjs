import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { collectInventory } from "../scripts/calculator-verification-inventory.mjs";

const registry = JSON.parse(readFileSync(
  "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json",
  "utf8",
));
const inventory = collectInventory({ root: process.cwd() });
const records = new Map(registry.records.map((record) => [record.calculator_id, record]));

test("every existing medical route has an explicit disposition, with an actionable unreviewed gap", () => {
  assert.equal(inventory.rows.length, 42);
  assert.deepEqual(inventory.excluded.map((row) => row.id), ["feedback-form"]);
  for (const row of inventory.rows) {
    assert.ok(records.get(row.id)?.baseline_review, `${row.id}: disposition missing`);
    const review = row.registry.baselineReview;
    assert.notEqual(review.supportedScope, "not assessed", row.id);
    if (review.clinicalReview.status === "pending") {
      assert.ok(review.restrictions.some((text) => text.startsWith("Next action:")),
        `${row.id}: missing concrete reconciliation task`);
      assert.equal(review.clinicalReview.date, null, `${row.id}: no invented clinical review date`);
    }
  }
});

test("original ALBI acceptance points to its existing exact-revision release receipt", () => {
  const row = inventory.rows.find((row) => row.id === "albi-score");
  const review = row.registry.baselineReview;
  assert.equal(review.planPath, "docs/verification/calculators/albi-score.md");
  for (const phase of [review.clinicalReview, review.calculationTests, review.browserReview, review.release]) {
    assert.equal(phase.status, "recorded");
    assert.ok(phase.evidence.includes("https://github.com/momomojo/Radulator/pull/265#issuecomment-5591825061"));
  }
  assert.equal(review.release.revision, "d2ce877263bb762c8a1cf8e4f7c27eeb4547f5e5");
  assert.equal(review.release.date, "2026-09-09");
  assert.match(review.supportedScope, /original/i);
  assert.equal(row.clinicalSignoff, "not established");
});

test("BI-RADS rebuild remains deferred rather than inheriting its legacy verified label", () => {
  const review = inventory.rows.find((row) => row.id === "birads").registry.baselineReview;
  assert.equal(review.applicability, "deferred");
  assert.equal(review.clinicalReview.status, "deferred");
  assert.equal(review.release.status, "deferred");
  assert.ok(review.restrictions.some((text) => /2013/.test(text)));
  assert.ok(review.blockers.some((text) => /material/i.test(text)));
});
