#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const loopIndex = process.env.RADULATOR_LOOP_INDEX
  ? path.resolve(process.env.RADULATOR_LOOP_INDEX)
  : path.join(root, ".radulator-loop-index");
const metricsDir = path.join(loopIndex, "metrics");
const now = new Date().toISOString();

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function countCalculators() {
  const dir = path.join(root, "src", "components", "calculators");
  const files = readdirSync(dir).filter((file) => file.endsWith(".jsx"));
  let feedback = 0;
  let calculators = 0;
  for (const file of files) {
    const source = readFileSync(path.join(dir, file), "utf8");
    if (/category\s*:\s*["']Feedback["']/.test(source)) feedback += 1;
    else if (/\bid\s*:/.test(source)) calculators += 1;
  }
  return { calculators, feedback, files: files.length };
}

async function maybeReadJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function testResultsSummary() {
  const data = await maybeReadJson(path.join(root, "test-results", "results.json"));
  if (!data) return { present: false };
  const stats = data.stats || {};
  return {
    present: true,
    expected: stats.expected ?? null,
    unexpected: stats.unexpected ?? null,
    flaky: stats.flaky ?? null,
    skipped: stats.skipped ?? null,
    durationMs: stats.duration ?? null,
  };
}

async function medicalPacketSummary() {
  const evidenceRoot = process.env.RADULATOR_MEDICAL_EVIDENCE || "";
  if (!evidenceRoot) return { present: false, reason: "RADULATOR_MEDICAL_EVIDENCE not set" };
  const indexPath = path.join(evidenceRoot, "indexes", "approval-packets.json");
  const data = await maybeReadJson(indexPath);
  if (!data) return { present: false, indexPath };
  const rows = Array.isArray(data) ? data : data.packets || data.rows || [];
  const byVerdict = {};
  for (const row of rows) {
    const verdict = row.verdict || row.final_packet_qa_verdict || row.status || "unknown";
    byVerdict[verdict] = (byVerdict[verdict] || 0) + 1;
  }
  return { present: true, indexPath, total: rows.length, byVerdict };
}

function packageScripts() {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  return Object.keys(pkg.scripts || {}).sort();
}

async function main() {
  await mkdir(metricsDir, { recursive: true });
  const calculatorCounts = countCalculators();
  const changedFiles = git(["diff", "--name-only", "origin/develop...HEAD"])
    .split("\n")
    .filter(Boolean);

  const snapshots = [
    {
      domain: "ci-health",
      timestamp: now,
      gitHead: git(["rev-parse", "--short", "HEAD"]),
      calculatorCounts,
      packageScripts: packageScripts().filter((script) => script.startsWith("test") || script.startsWith("check") || script === "lint" || script === "build"),
      testResults: await testResultsSummary(),
    },
    {
      domain: "release-train",
      timestamp: now,
      branch: git(["branch", "--show-current"]),
      base: "origin/develop",
      changedFilesCount: changedFiles.length,
      changedFiles,
    },
    {
      domain: "medical-validation",
      timestamp: now,
      approvalPackets: await medicalPacketSummary(),
    },
    {
      domain: "seo-growth",
      timestamp: now,
      note: "GA4/search/referrer metrics are collected by Radulator scheduled jobs; this scorecard reserves the domain stream.",
    },
    {
      domain: "guideline-watch",
      timestamp: now,
      note: "Guideline version deltas are handled by WF-3; this scorecard reserves the domain stream.",
    },
  ];

  for (const snapshot of snapshots) {
    await appendFile(path.join(metricsDir, `${snapshot.domain}.jsonl`), `${JSON.stringify(snapshot)}\n`, "utf8");
  }

  const latestPath = path.join(metricsDir, "scorecard-latest.md");
  const lines = [
    "# Radulator loop metrics scorecard",
    "",
    `Generated: ${now}`,
    `Repo head: ${snapshots[0].gitHead}`,
    "",
    "## CI health",
    `- Calculators: ${calculatorCounts.calculators}; feedback entries: ${calculatorCounts.feedback}; JSX files: ${calculatorCounts.files}`,
    `- Test results JSON present: ${snapshots[0].testResults.present}`,
    "",
    "## Release train",
    `- Branch: ${snapshots[1].branch}`,
    `- Changed files vs origin/develop: ${snapshots[1].changedFilesCount}`,
    "",
    "## Medical validation",
    snapshots[2].approvalPackets.present
      ? `- Approval packets: ${snapshots[2].approvalPackets.total}; verdicts: ${JSON.stringify(snapshots[2].approvalPackets.byVerdict)}`
      : `- Approval packet index unavailable: ${snapshots[2].approvalPackets.reason || snapshots[2].approvalPackets.indexPath || "not found"}`,
    "",
    "## Reserved streams",
    "- seo-growth: GA4/search/referrer collector integration",
    "- guideline-watch: guideline-version delta collector integration",
    "",
  ];
  await writeFile(latestPath, lines.join("\n"), "utf8");
  console.log(JSON.stringify({ ok: true, loopIndex, metricsDir, latestPath, domains: snapshots.map((item) => item.domain) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
