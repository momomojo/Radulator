import assert from "node:assert/strict";
import test, { after } from "node:test";
import process from "node:process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildInventory,
  collectInventory,
  normalizeBaselineReview,
  registryReviewScope,
  renderMarkdown,
  renderJson,
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

const BASELINE_SHA = "a".repeat(40);
const syntheticRoot = mkdtempSync(join(tmpdir(), "radulator-inventory-fixtures-"));
after(() => rmSync(syntheticRoot, { recursive: true, force: true }));
mkdirSync(join(syntheticRoot, "docs/verification/plans"), { recursive: true });
for (const id of ["alpha", "birads"]) {
  writeFileSync(join(syntheticRoot, `docs/verification/plans/${id}.md`), "# Synthetic contract-test plan\n");
}

function phase(status = "pending", overrides = {}) {
  return {
    status,
    date: null,
    reviewer: null,
    revision: null,
    evidence: [],
    ...overrides,
  };
}

function baselineReview(overrides = {}) {
  return {
    plan_path: "docs/verification/plans/alpha.md",
    applicability: "current",
    supported_scope: "Synthetic scope used only for contract tests.",
    clinical_review: phase("recorded", {
      date: "2026-09-07",
      reviewer: "Dr Synthetic Reviewer",
      revision: BASELINE_SHA,
      evidence: ["synthetic-source#scope"],
      scope: "Synthetic calculator input/output scope.",
    }),
    calculation_tests: phase("pending"),
    browser_review: phase("pending"),
    release: phase("pending"),
    blockers: [],
    restrictions: [],
    ...overrides,
  };
}

function inventoryWithBaseline(record) {
  return buildInventory({
    root: syntheticRoot,
    sources: [sourceRecords[0]],
    registry: { records: [record] },
    computeFixtures: [],
    browserSpecs: [],
  });
}

test("inventory rejects recorded review plans that are missing, directories, or outside the repository", (t) => {
  const root = mkdtempSync(join(tmpdir(), "radulator-plan-reference-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  mkdirSync(repo);
  writeFileSync(join(repo, "review.md"), "# Reviewed clinical scope\n");
  mkdirSync(join(repo, "directory.md"));
  writeFileSync(join(root, "outside.md"), "# Outside the repository\n");
  symlinkSync(join(root, "outside.md"), join(repo, "outside-link.md"));
  const inventory = (planPath) => buildInventory({
    root: repo,
    sources: [sourceRecords[0]],
    registry: { records: [{ calculator_id: "alpha", baseline_review: baselineReview({ plan_path: planPath }) }] },
  });

  for (const path of ["missing.md", "directory.md", "outside-link.md"]) {
    assert.throws(() => inventory(path), /baseline_review.*plan_path.*existing.*file.*repository/i, path);
  }
  assert.equal(inventory("review.md").rows[0].registry.baselineReview.clinicalReview.status, "recorded");
});

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

test("missing baseline_review derives explicit pending and unassessed phases", () => {
  const inventory = inventoryWithBaseline({
    calculator_id: "alpha",
    verification_status: "verified",
    last_verified: "2026-08-29",
    sources: [{ title: "Legacy source" }],
  });
  const row = inventory.rows[0];

  assert.deepEqual(row.registry.baselineReview, {
    planPath: null,
    applicability: "unassessed",
    supportedScope: "not assessed",
    clinicalReview: phase("pending", { scope: null }),
    calculationTests: phase("pending"),
    browserReview: phase("pending"),
    release: phase("pending"),
    blockers: [],
    restrictions: [],
  });
  assert.equal(row.registry.status, "verified");
  assert.equal(row.registry.lastVerified, "2026-08-29");
  assert.equal(inventory.summary.baseline.applicability.unassessed, 1);
  assert.equal(inventory.summary.baseline.phases.clinicalReview.pending, 1);
  assert.equal(inventory.summary.baseline.phases.calculationTests.pending, 1);
  assert.equal(inventory.summary.baseline.phases.browserReview.pending, 1);
  assert.equal(inventory.summary.baseline.phases.release.pending, 1);
  assert.equal("certified" in inventory.summary, false);
  assert.equal("completed" in inventory.summary, false);
});

test("recorded clinical review does not promote calculation, browser, or release phases", () => {
  const inventory = inventoryWithBaseline({
    calculator_id: "alpha",
    verification_status: "seed-unverified",
    last_verified: null,
    baseline_review: baselineReview(),
    sources: [],
  });
  const baseline = inventory.rows[0].registry.baselineReview;

  assert.equal(inventory.rows[0].registry.status, "seed-unverified");
  assert.equal(baseline.clinicalReview.status, "recorded");
  assert.equal(baseline.calculationTests.status, "pending");
  assert.equal(baseline.browserReview.status, "pending");
  assert.equal(baseline.release.status, "pending");
  assert.equal(inventory.summary.baseline.phases.clinicalReview.recorded, 1);
  assert.equal(inventory.summary.baseline.phases.calculationTests.pending, 1);
  assert.equal(inventory.summary.baseline.phases.browserReview.pending, 1);
  assert.equal(inventory.summary.baseline.phases.release.pending, 1);
});

test("complete independent baseline phase metadata is preserved", () => {
  const record = {
    calculator_id: "alpha",
    verification_status: "verified",
    last_verified: "2026-08-29",
    baseline_review: baselineReview({
      clinical_review: phase("recorded", {
        date: "2026-09-01",
        reviewer: "Clinical reviewer",
        revision: "b".repeat(40),
        evidence: ["docs/evidence/alpha-clinical.md:12"],
        scope: "Clinical source scope.",
      }),
      calculation_tests: phase("recorded", {
        date: "2026-09-02",
        reviewer: "Test reviewer",
        revision: "c".repeat(40),
        evidence: ["tests/fixtures/compute/alpha.json"],
      }),
      browser_review: phase("blocked", {
        reviewer: "Browser reviewer",
      }),
      release: phase("deferred", {
        reviewer: "Release reviewer",
      }),
      blockers: ["Browser proof requires an owner-run environment."],
      restrictions: ["No live-release claim."],
    }),
    sources: [],
  };
  const row = inventoryWithBaseline(record).rows[0];

  assert.deepEqual(row.registry.baselineReview, {
    planPath: "docs/verification/plans/alpha.md",
    applicability: "current",
    supportedScope: "Synthetic scope used only for contract tests.",
    clinicalReview: {
      status: "recorded",
      date: "2026-09-01",
      reviewer: "Clinical reviewer",
      revision: "b".repeat(40),
      evidence: ["docs/evidence/alpha-clinical.md:12"],
      scope: "Clinical source scope.",
    },
    calculationTests: {
      status: "recorded",
      date: "2026-09-02",
      reviewer: "Test reviewer",
      revision: "c".repeat(40),
      evidence: ["tests/fixtures/compute/alpha.json"],
    },
    browserReview: {
      status: "blocked",
      date: null,
      reviewer: "Browser reviewer",
      revision: null,
      evidence: [],
    },
    release: {
      status: "deferred",
      date: null,
      reviewer: "Release reviewer",
      revision: null,
      evidence: [],
    },
    blockers: ["Browser proof requires an owner-run environment."],
    restrictions: ["No live-release claim."],
  });
});

test("malformed explicit baseline records are rejected instead of gaining evidence", () => {
  const cases = [
    ["invalid status", { clinical_review: phase("complete") }],
    ["invalid date", { clinical_review: phase("recorded", { date: "2026-02-30", evidence: ["source"] }) }],
    ["invalid revision", { clinical_review: phase("recorded", { revision: "A".repeat(40), evidence: ["source"] }) }],
    ["empty recorded evidence", { clinical_review: phase("recorded") }],
    ["recorded clinical review without plan", { plan_path: null }],
    ["recorded clinical review without scope", { clinical_review: phase("recorded", { evidence: ["source"] }) }],
    ["missing explicit field", { calculation_tests: undefined }],
  ];

  for (const [label, override] of cases) {
    assert.throws(
      () => normalizeBaselineReview(baselineReview(override), { calculatorId: "alpha" }),
      /baseline_review/i,
      label,
    );
  }
});

test("baseline plan and evidence paths reject URI schemes, absolutes, and traversal", () => {
  assert.throws(
    () => normalizeBaselineReview(baselineReview({ plan_path: "/tmp/clinical.md" }), { calculatorId: "alpha" }),
    /plan_path.*relative/i,
  );
  assert.throws(
    () => normalizeBaselineReview(baselineReview({ plan_path: "../clinical.md" }), { calculatorId: "alpha" }),
    /plan_path.*relative/i,
  );
  assert.throws(
    () => normalizeBaselineReview(
      baselineReview({
        clinical_review: phase("recorded", { evidence: ["docs/../secret.md"] }),
      }),
      { calculatorId: "alpha" },
    ),
    /evidence.*relative|evidence.*traversing/i,
  );

  for (const planPath of [
    "docs/verification/\u0000example.md",
    "https://example.org/review.md",
    "custom:review.md",
    "data:text/markdown,review",
    "file://review.md",
    "C:/review.md",
    "C:review.md",
  ]) {
    assert.throws(
      () => normalizeBaselineReview(baselineReview({ plan_path: planPath }), { calculatorId: "alpha" }),
      /plan_path.*repository-relative/i,
      planPath,
    );
  }

  const normalized = normalizeBaselineReview(
    baselineReview({
      clinical_review: phase("recorded", {
        evidence: ["https://example.org/source#locator"],
        scope: "Synthetic calculator input/output scope.",
      }),
    }),
    { calculatorId: "alpha" },
  );
  assert.deepEqual(normalized.clinicalReview.evidence, ["https://example.org/source#locator"]);
});

test("BI-RADS-style deferred records remain deferred with explicit restrictions", () => {
  const inventory = inventoryWithBaseline({
    calculator_id: "alpha",
    verification_status: "verified",
    last_verified: "2026-08-29",
    baseline_review: {
      plan_path: "docs/verification/plans/birads.md",
      applicability: "deferred",
      supported_scope: "Legacy assessment-summary scope only.",
      clinical_review: phase("deferred"),
      calculation_tests: phase("deferred"),
      browser_review: phase("pending"),
      release: phase("deferred"),
      blockers: ["Full current manual is unavailable for review."],
      restrictions: ["Do not claim current full-manual coverage."],
    },
    sources: [],
  });
  const row = inventory.rows[0];

  assert.equal(row.registry.baselineReview.applicability, "deferred");
  assert.equal(row.registry.baselineReview.clinicalReview.status, "deferred");
  assert.equal(row.registry.baselineReview.calculationTests.status, "deferred");
  assert.equal(row.registry.baselineReview.release.status, "deferred");
  assert.equal(inventory.summary.baseline.applicability.deferred, 1);
  assert.equal(inventory.summary.baseline.phases.clinicalReview.deferred, 1);
  assert.equal(inventory.summary.baseline.phases.calculationTests.deferred, 1);
});

test("baseline counts distinguish pending, blocked, deferred, and recorded phases", () => {
  const records = [
    { calculator_id: "alpha", verification_status: "seed-unverified", baseline_review: baselineReview(), sources: [] },
    {
      calculator_id: "alpha",
      verification_status: "verified",
      baseline_review: baselineReview({
        applicability: "legacy",
        clinical_review: phase("blocked"),
        calculation_tests: phase("deferred"),
        browser_review: phase("recorded", { evidence: ["tests/e2e/alpha.spec.js"] }),
        release: phase("recorded", { evidence: ["docs/release/alpha.md"] }),
        blockers: ["Clinical reviewer needed."],
        restrictions: ["Legacy scope only."],
      }),
      sources: [],
    },
  ];
  const inventory = buildInventory({
    sources: [sourceRecords[0], { ...sourceRecords[0], id: "beta", name: "Beta Calculator" }],
    root: syntheticRoot,
    registry: { records },
    computeFixtures: [],
    browserSpecs: [],
  });
  const phases = inventory.summary.baseline.phases;

  assert.equal(inventory.summary.baseline.applicability.unassessed, 1);
  assert.equal(inventory.summary.baseline.applicability.legacy, 1);
  assert.equal(phases.clinicalReview.pending, 1);
  assert.equal(phases.clinicalReview.blocked, 1);
  assert.equal(phases.calculationTests.pending, 1);
  assert.equal(phases.calculationTests.deferred, 1);
  assert.equal(phases.browserReview.pending, 1);
  assert.equal(phases.browserReview.recorded, 1);
  assert.equal(phases.release.pending, 1);
  assert.equal(phases.release.recorded, 1);
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

test("renderMarkdown is a compact linked index without hiding row evidence", () => {
  const inventory = collectInventory({ root: process.cwd() });
  const markdown = renderMarkdown(inventory);

  assert.ok(markdown.length < 25_000, `expected a concise index, got ${markdown.length} bytes`);
  assert.match(markdown, /\[JSON snapshot\]\(\.\/calculator-inventory\.json\)/);
  assert.match(markdown, /canonical guideline registry/);
  assert.match(markdown, /Clinical signoff: not established for any calculator/);
  assert.match(markdown, /Release\/proof: not established for any calculator/);
  assert.match(markdown, /## Calculator index/);
  assert.doesNotMatch(markdown, /## Source pointers by calculator/);
  assert.doesNotMatch(markdown, /Registry justification:/);
  assert.equal((markdown.match(/^\| `[^`]+` \|/gm) || []).length, inventory.rows.length);

  for (const row of inventory.rows) {
    assert.match(markdown, new RegExp("^\\| `" + row.id + "` \\|", "m"));
    assert.ok(markdown.includes(`../../${row.sourcePointers.calculator})`));
    for (const path of row.compute.fixturePaths) {
      assert.ok(markdown.includes(`../../${path})`));
    }
    for (const path of row.browser.specPaths) {
      assert.ok(markdown.includes(`../../${path})`));
    }
  }
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

test("generated baseline inventory JSON and Markdown are deterministic", () => {
  const first = collectInventory({ root: process.cwd() });
  const second = collectInventory({ root: process.cwd() });
  assert.equal(renderJson(first), renderJson(second));
  assert.equal(renderMarkdown(first), renderMarkdown(second));
  assert.match(renderMarkdown(first), /Baseline phase counts are independent/);
  assert.match(renderMarkdown(first), /baseline record contract/);
});
