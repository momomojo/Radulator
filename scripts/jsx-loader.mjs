import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { transformWithEsbuild } from "vite";

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const baseUrl = new URL(`../src/${specifier.slice(2)}`, import.meta.url);
    const candidates = [baseUrl, new URL(`${baseUrl.href}.js`), new URL(`${baseUrl.href}.jsx`)];
    const url = candidates.find((candidate) => existsSync(candidate)) || baseUrl;
    return defaultResolve(url.href, context, defaultResolve);
  }
  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.endsWith(".jsx")) {
    const source = await readFile(new URL(url), "utf8");
    const transformed = await transformWithEsbuild(source, url, {
      loader: "jsx",
      jsx: "automatic",
      define: { "import.meta.env.DEV": "false" },
    });
    return {
      format: "module",
      shortCircuit: true,
      source: transformed.code,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
