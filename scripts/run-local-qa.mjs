import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPayloadManifest, payloadDigest } from "./write-release-marker.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

export async function validateSpecs(args, cwd) {
  if (!args.length) throw new Error("Specify at least one tests/e2e/*.spec.js file.");
  for (const spec of args) {
    if (!/^tests\/e2e\/[\w./-]+\.spec\.js$/.test(spec) || spec.split("/").includes("..")) {
      throw new Error("Only repository browser spec paths are accepted; no config overrides.");
    }
    const resolved = await realpath(path.join(cwd, spec));
    if (!resolved.startsWith(`${await realpath(cwd)}${path.sep}tests${path.sep}e2e${path.sep}`)) {
      throw new Error("Browser spec escapes this worktree.");
    }
  }
  return args;
}

export function summarizeResult(report, exitCode, unchanged) {
  const stats = report.stats || {};
  return { passed: exitCode === 0 && unchanged && stats.expected > 0 &&
      stats.unexpected === 0 && stats.skipped === 0 && stats.flaky === 0 &&
      Array.isArray(report.errors) && report.errors.length === 0,
    exitCode, unchanged, stats };
}

async function sourceIdentity() {
  const git = (args) => execFileSync("git", args, { cwd: root });
  const files = [...new Set(git(["ls-files", "-co", "--exclude-standard", "-z"]).toString().split("\0").filter(Boolean))].sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file).update("\0");
    try { hash.update(await readFile(path.join(root, file))); }
    catch (error) { if (error.code !== "ENOENT") throw error; hash.update("deleted"); }
    hash.update("\0");
  }
  return { head: git(["rev-parse", "HEAD"]).toString().trim(), worktreeSha256: hash.digest("hex") };
}

async function runLogged(command, args, env, destination) {
  const output = await open(destination, "w");
  try {
    const result = spawnSync(command, args, { cwd: root, env, stdio: ["ignore", output.fd, output.fd] });
    return result.status ?? 1;
  } finally { await output.close(); }
}

async function main() {
  const specs = await validateSpecs(process.argv.slice(2), root);
  const outputRoot = path.join(root, "test-results/local-qa");
  await mkdir(outputRoot, { recursive: true });
  const lockPath = path.join(root, "node_modules/.radulator-qa.lock");
  const lock = await open(lockPath, "wx");
  const outputDir = await mkdtemp(path.join(outputRoot, "run-"));
  const receipt = { schema: "radulator-local-qa/v1", cwd: root, specs, startedAt: new Date().toISOString(),
    scope: "local production-configured preview; not release authorization, deployment or native printing", outputDir };
  try {
    const before = await sourceIdentity();
    receipt.source = before;
    // Build with the existing synthetic production configuration/privacy checks.
    const env = { ...process.env, RADULATOR_QA_PREVIEW: "1" };
    const buildExit = await runLogged("npm", ["run", "test:privacy:artifact"], env, path.join(outputDir, "build.log"));
    receipt.buildExit = buildExit;
    if (buildExit !== 0) throw new Error("Configured production build failed; see build.log.");
    const manifest = await buildPayloadManifest({ distDir: path.join(root, "dist"), sha: before.head });
    receipt.artifactSha256 = payloadDigest(manifest);
    await writeFile(path.join(outputDir, "artifact-manifest.json"), JSON.stringify(manifest, null, 2));
    // Import after setting preview mode so receipt target matches Playwright's config.
    process.env.RADULATOR_QA_PREVIEW = "1";
    const { default: config } = await import("../playwright.config.js");
    receipt.baseURL = config.use.baseURL;
    const reportPath = path.join(outputDir, "playwright.json");
    const exitCode = await runLogged(process.execPath, [path.join(root, "node_modules/@playwright/test/cli.js"),
      "test", ...specs, "--project=chromium", "--reporter=json", `--output=${path.join(outputDir, "artifacts")}`],
    { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath }, path.join(outputDir, "browser.log"));
    let report = {};
    try { report = JSON.parse(await readFile(reportPath, "utf8")); } catch { /* Missing report fails closed. */ }
    const after = await sourceIdentity();
    const afterDigest = payloadDigest(await buildPayloadManifest({ distDir: path.join(root, "dist"), sha: before.head }));
    const unchanged = JSON.stringify(before) === JSON.stringify(after) && receipt.artifactSha256 === afterDigest;
    Object.assign(receipt, summarizeResult(report, exitCode, unchanged));
    process.exitCode = receipt.passed ? 0 : 1;
  } catch (error) {
    receipt.passed = false;
    receipt.error = error.message;
    process.exitCode = 1;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    const receiptPath = path.join(outputDir, "receipt.json");
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
    await lock.close();
    await unlink(lockPath);
    console.log(JSON.stringify({ passed: receipt.passed, stats: receipt.stats, receipt: receiptPath, error: receipt.error }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
