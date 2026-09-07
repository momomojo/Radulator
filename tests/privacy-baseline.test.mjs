import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { parse as parseYaml } from "yaml";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const analyticsSource = read("src/lib/analytics.js");
const appSource = read("src/App.jsx");
const boundarySource = read("src/components/ErrorBoundary.jsx");
const mainSource = read("src/main.jsx");
const rootErrorSource = read("src/lib/rootErrorDiagnostics.js");
const indexSource = read("index.html");
const scripts = JSON.parse(read("package.json")).scripts;
const smoke = parseYaml(read(".github/workflows/e2e-tests.yml")).jobs["smoke-tests"];
assert.equal(scripts["test:privacy"], "npm run test:privacy:artifact && npm run test:privacy:browser",
  "the documented privacy command must build once and exercise that artifact in a real browser");
assert.match(scripts["test:privacy:browser"], /test:privacy:errors/);
assert.match(scripts["test:privacy:browser"], /privacy-baseline.spec.js/);
const buildStep = smoke.steps.findIndex((step) => step.run === "npm run test:privacy:artifact");
const browserStep = smoke.steps.findIndex((step) => step.run === "npm run test:privacy:browser");
assert.ok(buildStep >= 0 && browserStep > buildStep, "configured build precedes its browser checks");
assert.equal(smoke.steps.filter((step) => /npm run (?:build|test:privacy(?::artifact)?)(?:\s|$)/.test(step.run || "")).length, 1,
  "Smoke must not replace the configured artifact with another build");

assert.doesNotMatch(analyticsSource, /window\.gtag|dataLayer|console\.(log|error)/);
assert.doesNotMatch(appSource, /window\.gtag|trackSearch|page_location|\[GA4 Dev\]/);
assert.doesNotMatch(boundarySource, /console\.(error|warn|log)\([^)]*(error|info)/s);
assert.match(appSource, /console\.error\("RADULATOR_COMPUTE_ERROR"\)/);
assert.match(mainSource, /ROOT_ERROR_OPTIONS/);
assert.match(mainSource, /export const ROOT_OPTIONS = ROOT_ERROR_OPTIONS/);
assert.match(mainSource, /hydrateRoot\(root, app, ROOT_OPTIONS\)/);
assert.match(mainSource, /createRoot\(root, ROOT_OPTIONS\)\.render\(app\)/);
assert.doesNotMatch(boundarySource, /componentDidCatch/);
assert.match(rootErrorSource, /onCaughtError: reportRootError/);
assert.match(rootErrorSource, /onUncaughtError: reportRootError/);
assert.match(rootErrorSource, /onRecoverableError: reportRootError/);
assert.doesNotMatch(rootErrorSource, /JSON\.stringify|\.\.\.args|error\./);
assert.doesNotMatch(indexSource, /googletagmanager|google-analytics/i);
assert.match(indexSource, /https:\/\/formspree\.io/);

const analytics = await import("../src/lib/analytics.js");
const telemetryCalls = [];
const consoleCalls = [];
const originalWindow = globalThis.window;
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

globalThis.window = {
  dataLayer: [],
  gtag: (...args) => telemetryCalls.push(["gtag", args]),
};
console.log = (...args) => consoleCalls.push(["log", args]);
console.warn = (...args) => consoleCalls.push(["warn", args]);
console.error = (...args) => consoleCalls.push(["error", args]);

try {
  analytics.trackCalculatorSelected("tirads", "ACR TI-RADS", "Radiology");
  analytics.trackCalculation("tirads", "ACR TI-RADS", "Radiology", true);
  analytics.trackCSVDownload("results.csv", "tirads");
  analytics.trackOutboundLink("https://example.test/reference", "reference", "tirads");
  analytics.trackFeedbackSubmission(true, "feedback-form");
  analytics.trackResultsCopied("tirads", "ACR TI-RADS");
  analytics.trackResultViewed("tirads", "ACR TI-RADS", 12);
  analytics.trackOnboarding("guide_opened", "welcome_card");
  analytics.trackSearch("synthetic-search-canary");
} finally {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
}

assert.deepEqual(telemetryCalls, []);
assert.deepEqual(consoleCalls, []);

const distIndex = read("dist/index.html");
assert.doesNotMatch(distIndex, /googletagmanager|google-analytics|dataLayer|gtag\s*\(/i);
assert.doesNotMatch(distIndex, /GA4_PLACEHOLDER/);
assert.doesNotMatch(distIndex, /SEARCH_VERIFICATION_PLACEHOLDER/);
assert.match(distIndex, /google-site-verification[^>]+privacy-google-token/);
assert.match(distIndex, /msvalidate\.01[^>]+privacy-bing-token/);
assert.match(distIndex, /connect-src 'self' https:\/\/formspree\.io/);
assert.doesNotMatch(distIndex, /connect-src[^;]*(google-analytics|analytics\.google)/i);

const staticCalculatorPage = read("dist/calculators/tirads/index.html");
assert.match(staticCalculatorPage, /data-static-calculator="tirads"/);
assert.match(staticCalculatorPage, /google-site-verification[^>]+privacy-google-token/);
assert.match(staticCalculatorPage, /msvalidate\.01[^>]+privacy-bing-token/);

const privacyPage = read("dist/privacy.html");
assert.match(privacyPage, /analytics are paused/i);
assert.match(privacyPage, /Do not (?:place|enter) patient information/i);

console.log("privacy baseline regressions passed");
