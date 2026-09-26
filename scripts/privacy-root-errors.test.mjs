import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

const ROOT_ERROR_CODE = "RADULATOR_RENDER_ERROR";
const RAW_CANARY = "SYNTHETIC-RAW-RENDER-CANARY";

const bundle = async (contents, mode) => {
  const result = await build({
    stdin: {
      contents,
      resolveDir: process.cwd(),
      sourcefile: `privacy-root-errors-${mode}.jsx`,
      loader: "jsx",
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
      "import.meta.env.DEV": String(mode === "development"),
    },
  });
  return result.outputFiles[0].text;
};

const runScenario = async (browser, contents, mode, setup, verify) => {
  const page = await browser.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setContent(setup);
  await page.addScriptTag({ content: await bundle(contents, mode) });
  await verify(page, consoleMessages, pageErrors);
  await page.close();
};

const assertRedacted = (consoleMessages, pageErrors) => {
  assert.equal(
    [...consoleMessages, ...pageErrors].some((message) => message.includes(RAW_CANARY)),
    false,
    "raw synthetic error text must not reach console or pageerror",
  );
  assert.equal(
    consoleMessages.some((message) => message.includes(ROOT_ERROR_CODE)),
    true,
    "the fixed generic render diagnostic must be present",
  );
};

const caughtSource = `
  import React from "react";
  import { createRoot } from "react-dom/client";
  import ErrorBoundary from "./src/components/ErrorBoundary.jsx";
  import { ROOT_ERROR_OPTIONS } from "./src/lib/rootErrorDiagnostics.js";

  function Broken() {
    throw new Error(${JSON.stringify(RAW_CANARY)});
  }

  createRoot(document.getElementById("root"), ROOT_ERROR_OPTIONS).render(
    <ErrorBoundary><Broken /></ErrorBoundary>,
  );
`;

const uncaughtSource = `
  import React from "react";
  import { createRoot } from "react-dom/client";
  import { ROOT_ERROR_OPTIONS } from "./src/lib/rootErrorDiagnostics.js";

  function Broken() {
    throw new Error(${JSON.stringify(RAW_CANARY)});
  }

  createRoot(document.getElementById("root"), ROOT_ERROR_OPTIONS).render(<Broken />);
`;

const hydrationSource = `
  import React from "react";
  import { hydrateRoot } from "react-dom/client";
  import { ROOT_ERROR_OPTIONS } from "./src/lib/rootErrorDiagnostics.js";

  function Hydrated() {
    return <span data-testid="hydrated">client text</span>;
  }

  hydrateRoot(document.getElementById("root"), <Hydrated />, ROOT_ERROR_OPTIONS);
`;

const browser = await chromium.launch();
try {
  for (const mode of ["development", "production"]) {
    await runScenario(
      browser,
      caughtSource,
      mode,
      '<div id="root"></div>',
      async (page, consoleMessages, pageErrors) => {
        await page.getByRole("alert").waitFor({ state: "visible" });
        assert.match(await page.getByRole("alert").textContent(), /unexpected error/i);
        assertRedacted(consoleMessages, pageErrors);
        assert.equal(
          consoleMessages.filter((message) => message.includes(ROOT_ERROR_CODE)).length,
          1,
          "a caught render failure must emit one fixed diagnostic",
        );
      },
    );

    await runScenario(
      browser,
      uncaughtSource,
      mode,
      '<div id="root"></div>',
      async (_page, consoleMessages, pageErrors) => {
        await expect.poll(() => consoleMessages.some((message) => message.includes(ROOT_ERROR_CODE))).toBe(true);
        assertRedacted(consoleMessages, pageErrors);
      },
    );

    await runScenario(
      browser,
      hydrationSource,
      mode,
      `<div id="root"><span>${RAW_CANARY}</span></div>`,
      async (page, consoleMessages, pageErrors) => {
        await page.getByTestId("hydrated").waitFor({ state: "visible" });
        assertRedacted(consoleMessages, pageErrors);
      },
    );
  }
} finally {
  await browser.close();
}

console.log("privacy root error diagnostics passed");
