import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateSpecs, summarizeResult } from "./run-local-qa.mjs";

test("QA accepts only existing repository browser spec files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "radulator-qa-test-"));
  await mkdir(path.join(root, "tests/e2e"), { recursive: true });
  await writeFile(path.join(root, "tests/e2e/example.spec.js"), "// fixture");
  assert.deepEqual(await validateSpecs(["tests/e2e/example.spec.js"], root), ["tests/e2e/example.spec.js"]);
  for (const args of [[], ["--config=other.js"], ["../other.spec.js"], ["tests/e2e/missing.spec.js"]]) {
    await assert.rejects(validateSpecs(args, root));
  }
});

test("QA never reports success for skipped, flaky, empty, stale or failed runs", () => {
  const stats = { expected: 5, unexpected: 0, skipped: 0, flaky: 0 };
  assert.equal(summarizeResult({ stats, errors: [] }, 0, true).passed, true);
  for (const [report, exitCode, unchanged] of [
    [{ stats: { ...stats, skipped: 1 }, errors: [] }, 0, true],
    [{ stats: { ...stats, flaky: 1 }, errors: [] }, 0, true],
    [{ stats: { ...stats, expected: 0 }, errors: [] }, 0, true],
    [{ stats, errors: ["failure"] }, 0, true],
    [{ stats, errors: [] }, 1, true],
    [{ stats, errors: [] }, 0, false],
    [{}, 0, true],
  ]) assert.equal(summarizeResult(report, exitCode, unchanged).passed, false);
});
