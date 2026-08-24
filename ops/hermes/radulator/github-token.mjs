import { execFileSync } from "node:child_process";
import process from "node:process";

export function resolveGithubToken({ env = process.env, execFile = execFileSync } = {}) {
  const configured = `${env.GH_TOKEN || env.GITHUB_TOKEN || ""}`.trim();
  if (configured) return configured;
  try {
    return `${execFile("gh", ["auth", "token", "--hostname", "github.com"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
    })}`.trim();
  } catch {
    return "";
  }
}
