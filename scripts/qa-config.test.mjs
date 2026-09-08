import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ESLint } from "eslint";

const root = fileURLToPath(new URL("../", import.meta.url));
function config(extra = {}, name = "playwright.config.js") {
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e",
    `import c from "./${name}"; console.log(JSON.stringify({baseURL:c.use.baseURL,server:c.webServer,mode:c.metadata.serverMode}));`], {
    cwd: root, encoding: "utf8", env: { PATH: process.env.PATH, ...extra },
  }));
}

test("a dedicated QA port drives both the client and the strict server", () => {
  const value = config({ RADULATOR_QA_PORT: "43129", RADULATOR_QA_PREVIEW: "1" });
  assert.equal(value.baseURL, "http://127.0.0.1:43129");
  assert.equal(value.server.url, value.baseURL);
  assert.match(value.server.command, /preview.*--host 127\.0\.0\.1 --port 43129 --strictPort/);
  assert.equal(value.server.cwd.replace(/\/$/, ""), root.replace(/\/$/, ""));
  assert.equal(value.server.reuseExistingServer, false);
  assert.equal(value.mode, "preview");
});

test("ordinary development is not mislabeled as a production preview", () => {
  assert.equal(config().mode, "dev");
});

test("nightly browsers share the same strict isolated server contract", () => {
  const env = { RADULATOR_QA_PORT: "43129", RADULATOR_QA_PREVIEW: "1" };
  assert.deepEqual(config(env, "playwright.nightly.config.js"), config(env));
});

test("invalid and shell-bearing ports cannot reach the server command", () => {
  for (const port of ["0", "65536", "4.5", "4173;whoami", "-1", ""]) {
    assert.throws(() => config({ RADULATOR_QA_PORT: port }), /port/i);
  }
});

test("CI keeps production preview but cannot attach to a pre-existing server", () => {
  const value = config({ CI: "true" });
  assert.equal(value.baseURL, "http://127.0.0.1:4173");
  assert.match(value.server.command, /preview.*--strictPort/);
  assert.equal(value.server.reuseExistingServer, false);
});

test("lint ignores scratch receipts but still checks maintained app and test code", async () => {
  const eslint = new ESLint({ cwd: root });
  assert.equal(await eslint.isPathIgnored(`${root}.superpowers/sdd/scratch.mjs`), true);
  assert.equal(await eslint.isPathIgnored(`${root}src/App.jsx`), false);
  assert.equal(await eslint.isPathIgnored(`${root}scripts/qa-config.test.mjs`), false);
});

test("a real pre-existing server is refused and left running", { timeout: 20000 }, async () => {
  const foreignServer = createServer((_request, response) => response.end("FOREIGN_CHECKOUT"));
  await new Promise((resolve) => foreignServer.listen(0, "127.0.0.1", resolve));
  const port = foreignServer.address().port;
  try {
    const result = await new Promise((resolve) => execFile(process.execPath, [
      `${root}node_modules/@playwright/test/cli.js`, "test", "tests/e2e/smoke.spec.js", "--reporter=line",
    ], { cwd: root, timeout: 15000, env: { PATH: process.env.PATH,
      RADULATOR_QA_PORT: String(port), RADULATOR_QA_PREVIEW: "1" } },
    (error, stdout, stderr) => resolve({ error, output: stdout + stderr })));
    assert.equal(result.error?.code, 1);
    assert.match(result.output, /already used/);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), "FOREIGN_CHECKOUT");
  } finally { await new Promise((resolve) => foreignServer.close(resolve)); }
});
