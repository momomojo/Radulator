import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import viteConfig from "../vite.config.js";

const registrySource = readFileSync(
  new URL("../src/components/calculators/registry.js", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  registrySource,
  /import\.meta\.glob\([^\n]+\{\s*eager:\s*true\s*\}/,
  "calculator implementations must not be eagerly imported into the initial bundle",
);
assert.match(
  registrySource,
  /virtual:calculator-registry/,
  "registry must use build-generated metadata and dynamic loaders",
);
assert.match(
  registrySource,
  /calc\.load\(\)/,
  "registry entries must expose a dynamic calculator loader",
);

const config = viteConfig({ mode: "development" });
const registryPlugin = config.plugins.find(
  (plugin) => plugin.name === "calculator-registry",
);
const resolvedVirtualId = registryPlugin.resolveId("virtual:calculator-registry");
const watchedFiles = [];
const virtualRegistry = registryPlugin.load.call(
  { addWatchFile: (file) => watchedFiles.push(file) },
  resolvedVirtualId,
);

assert.match(
  virtualRegistry,
  /keywords/,
  "generated registry metadata must preserve keyword-only search terms",
);
assert.equal(
  watchedFiles.length,
  39,
  "development registry metadata must watch every calculator source file",
);

const invalidated = [];
const virtualModule = { id: resolvedVirtualId };
const windowsStyleWatchFile = watchedFiles[0].replaceAll("/", "\\");
const hmrModules = registryPlugin.handleHotUpdate({
  file: windowsStyleWatchFile,
  modules: [{ id: watchedFiles[0] }],
  server: {
    moduleGraph: {
      getModuleById: (id) => (id === resolvedVirtualId ? virtualModule : null),
      invalidateModule: (module) => invalidated.push(module),
    },
  },
});

assert.deepEqual(invalidated, [virtualModule]);
assert.deepEqual(
  hmrModules,
  [{ id: watchedFiles[0] }, virtualModule],
  "calculator metadata edits must refresh the virtual registry in development",
);

console.log("calculator registry code-splitting contract passed");
