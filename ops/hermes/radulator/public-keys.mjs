import { readFile } from "node:fs/promises";

export async function loadPublicKeysFile(filePath) {
  if (typeof filePath !== "string" || !filePath) throw new Error("--public-keys-file is required.");
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Judge public-key configuration must be an object.");
  }
  return parsed;
}
