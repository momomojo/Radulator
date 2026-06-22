import { readFile } from "node:fs/promises";

export async function load(url, context, defaultLoad) {
  if (url.endsWith(".jsx")) {
    const source = await readFile(new URL(url), "utf8");
    return {
      format: "module",
      shortCircuit: true,
      source,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
