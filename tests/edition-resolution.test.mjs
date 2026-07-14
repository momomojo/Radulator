import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isForbiddenInstitutionalEnv,
  resolveEdition,
} from "../scripts/resolve-edition.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

test("defaults to public edition without release metadata", () => {
  const edition = resolveEdition({ env: {}, root });
  assert.equal(edition.id, "public");
  assert.equal(edition.calculators, "all");
  assert.equal(edition.releaseVersion, "");
});

test("institutional edition fails closed without release version", () => {
  assert.throws(
    () =>
      resolveEdition({
        env: { RADULATOR_EDITION: "institutional" },
        root,
      }),
    /RADULATOR_RELEASE_VERSION is required/,
  );
});

test("institutional env guard rejects telemetry, form, and ad providers", () => {
  for (const name of [
    "VITE_GA4_MEASUREMENT_ID",
    "VITE_FORMSPREE_ID",
    "FORMSPREE_FORM_ID",
    "VITE_GOOGLE_ADS_ID",
    "SENTRY_DSN",
    "VITE_POSTHOG_KEY",
  ]) {
    assert.equal(isForbiddenInstitutionalEnv(name), true, name);
  }
});

test("institutional env guard allows benign variables containing broad substrings", () => {
  for (const name of [
    "RADULATOR_EDITION",
    "RADULATOR_RELEASE_VERSION",
    "RADULATOR_RELEASE_NOTES",
    "RADULATOR_PLATFORM",
    "TRANSFORM_CACHE",
    "CSS_MODULES",
  ]) {
    assert.equal(isForbiddenInstitutionalEnv(name), false, name);
  }
});

test("institutional edition resolves exact empty allowlist with deterministic release version", () => {
  const edition = resolveEdition({
    env: {
      RADULATOR_EDITION: "institutional",
      RADULATOR_RELEASE_VERSION: "0.0.0-local-institutional-test",
      TRANSFORM_CACHE: "allowed",
    },
    root,
  });
  assert.equal(edition.id, "institutional");
  assert.deepEqual(edition.allowlist, []);
  assert.equal(edition.telemetry.ga4, false);
  assert.equal(edition.includeFeedback, false);
});
