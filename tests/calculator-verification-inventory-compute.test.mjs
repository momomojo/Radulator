import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInventory,
  collectInventory,
  registryReviewScope,
  renderMarkdown,
  runCli,
  specContainsCalculator,
  summarizeComputeFixtures,
} from "../scripts/calculator-verification-inventory.mjs";

const sourceRecords = [
  {
    id: "alpha",
    name: "Alpha Calculator",
    category: "Radiology",
    guidelineVersion: "Alpha 2026",
    sourcePath: "src/components/calculators/Alpha.jsx",
  },
  {
    id: "feedback-form",
    name: "Send Feedback",
    category: "Feedback",
    guidelineVersion: null,
    sourcePath: "src/components/calculators/FeedbackForm.jsx",
  },
];

test("buildInventory excludes Feedback while preserving medical calculator rows", () => {
  const inventory = buildInventory({
    sources: sourceRecords,
    registry: {
      records: [
        {
          calculator_id: "alpha",
          verification_status: "seed-unverified",
          last_verified: null,
          sources: [],
        },
        {
          calculator_id: "feedback-form",
          verification_status: "seed-unverified",
          last_verified: null,
          sources: [],
        },
      ],
    },
    computeFixtures: [],
    browserSpecs: [],
  });

  assert.deepEqual(inventory.rows.map((row) => row.id), ["alpha"]);
  assert.deepEqual(inventory.excluded.map((row) => row.id), ["feedback-form"]);
  assert.equal(inventory.summary.medicalCalculators, 1);
  assert.equal(inventory.summary.registry.seedUnverified, 1);
  assert.equal(inventory.rows[0].clinicalSignoff, "not established");
  assert.equal(inventory.rows[0].releaseProof, "not established");
});

test("buildInventory records missing registry and canonical cases without inventing verification", () => {
  const inventory = buildInventory({
    sources: [sourceRecords[0]],
    registry: { records: [] },
    computeFixtures: [
      {
        calculatorId: "other",
        path: "tests/fixtures/compute/other.json",
        cases: [{ id: "one" }, { id: "two" }],
        declaredCaseCount: 999,
      },
    ],
    browserSpecs: [
      { path: "tests/e2e/calculators/radiology/alpha.spec.js", shared: false, calculatorIds: [] },
    ],
  });

  const row = inventory.rows[0];
  assert.equal(row.registry.status, "missing");
  assert.equal(row.registry.reviewScope, "no registry row");
  assert.equal(row.compute.caseCount, 0);
  assert.equal(row.compute.fixturePaths.length, 0);
  assert.equal(row.browser.specCount, 0);
  assert.equal(row.clinicalSignoff, "not established");
  assert.equal(row.releaseProof, "not established");
  assert.match(renderMarkdown(inventory), /not a clinical certification/i);
});

test("browser inventory associates specs only with actual navigation or routes", () => {
  const calculator = { id: "alpha", name: "Alpha Calculator" };
  assert.equal(
    specContainsCalculator("// Alpha Calculator appears in a comment", calculator),
    false,
  );
  assert.equal(
    specContainsCalculator('await navigateToCalculator(page, "Alpha Calculator");', calculator),
    true,
  );
  assert.equal(
    specContainsCalculator("await navigateToCalculator(page, 'Alpha (2026) Calculator');", {
      id: "alpha-2026",
      name: "Alpha (2026) Calculator",
    }),
    true,
  );
  assert.equal(
    specContainsCalculator('await page.goto("/#/alpha");', calculator),
    true,
  );
});

test("registry review scope renders claim and vector counts without dangling punctuation", () => {
  assert.equal(
    registryReviewScope({ implementation_evidence: { claims: [{}, {}], source_audit: { vector_ids: ["a", "b"] } } }),
    "source-derived evidence (2 claim(s), 2 vector(s))",
  );
  assert.equal(
    registryReviewScope({ implementation_evidence: { claims: [{}], source_audit: { vector_ids: [] } } }),
    "source-derived evidence (1 claim(s))",
  );
});

test("summarizeComputeFixtures derives counts from cases rather than stale declared coverage", () => {
  const summary = summarizeComputeFixtures([
    {
      calculatorId: "alpha",
      path: "tests/fixtures/compute/alpha.json",
      cases: [{ id: "a" }, { id: "b" }],
      declaredCaseCount: 200,
    },
    {
      calculatorId: "beta",
      path: "tests/fixtures/compute/beta.json",
      cases: [{ id: "c" }],
      declaredCaseCount: 0,
    },
  ]);

  assert.equal(summary.fixtureFiles, 2);
  assert.equal(summary.cases, 3);
  assert.deepEqual(summary.byCalculator.alpha, {
    caseCount: 2,
    fixturePaths: ["tests/fixtures/compute/alpha.json"],
  });
  assert.deepEqual(summary.byCalculator.beta, {
    caseCount: 1,
    fixturePaths: ["tests/fixtures/compute/beta.json"],
  });
});

test("collectInventory reflects the checked-out source, registry, fixtures, and browser specs", () => {
  const inventory = collectInventory({ root: process.cwd() });

  assert.equal(inventory.rows.length, 42);
  assert.equal(inventory.excluded.length, 1);
  assert.equal(inventory.excluded[0].id, "feedback-form");
  assert.equal(inventory.summary.registry.verified, 10);
  assert.equal(inventory.summary.registry.seedUnverified, 32);
  assert.equal(inventory.summary.compute.fixtureFiles, 12);
  assert.equal(inventory.summary.compute.cases, 313);
  assert.equal(inventory.summary.browser.calculatorSpecificSpecFiles, 42);
  assert.equal(inventory.summary.browser.sharedSpecFiles, 3);
  assert.ok(inventory.rows.every((row) => row.clinicalSignoff === "not established"));
  assert.ok(inventory.rows.every((row) => row.releaseProof === "not established"));

  const albi = inventory.rows.find((row) => row.id === "albi-score");
  assert.equal(albi.registry.status, "verified");
  assert.equal(albi.registry.lastVerified, "2026-08-29");
  assert.equal(albi.compute.caseCount, 6);
  assert.equal(albi.browser.specCount, 1);
  assert.equal(albi.registry.implementationEvidence.sourceAuditVectorCount, 6);
  assert.equal("vectorCount" in albi.registry.implementationEvidence, false);
  assert.ok(albi.registry.sourceReferences.some((source) => source.url.includes("PMC4322258")));
});

test("runCli --check accepts the committed deterministic snapshots", () => {
  const messages = [];
  const status = runCli(["--check", "--root", process.cwd()], {
    log: (message) => messages.push(message),
    error: (message) => messages.push(message),
  });

  assert.equal(status, 0);
  assert.deepEqual(messages, ["calculator verification inventory is current"]);
});
