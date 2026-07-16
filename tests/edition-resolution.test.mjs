import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isForbiddenInstitutionalEnv,
  resolveEdition,
} from "../scripts/resolve-edition.mjs";
import { validateReleaseControlPayload } from "../src/lib/releaseControl.js";

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

test("institutional env guard rejects build-exposed telemetry, form, and ad providers", () => {
  for (const name of [
    "VITE_GA4_MEASUREMENT_ID",
    "VITE_GTM_CONTAINER_ID",
    "VITE_FORMSPREE_ID",
    "VITE_GOOGLE_ADS_ID",
    "VITE_SENTRY_DSN",
    "INDEXNOW_KEY",
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
    "GA4_CLIENT_ID",
    "GA4_CLIENT_SECRET",
    "GA4_NUMERIC_PROPERTY_ID",
    "GA4_PROPERTY_ID",
    "GA4_REFRESH_TOKEN",
    "SENTRY_DSN",
    "FORMSPREE_FORM_ID",
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

test("institutional edition resolves with ambient GA4 OAuth admin variables", () => {
  const edition = resolveEdition({
    env: {
      RADULATOR_EDITION: "institutional",
      RADULATOR_RELEASE_VERSION: "0.0.0-local-institutional-test",
      GA4_CLIENT_ID: "dummy",
      GA4_CLIENT_SECRET: "dummy",
      GA4_NUMERIC_PROPERTY_ID: "123",
      GA4_PROPERTY_ID: "properties/123",
      GA4_REFRESH_TOKEN: "dummy",
    },
    root,
  });
  assert.equal(edition.id, "institutional");
  assert.deepEqual(edition.allowlist, []);
});

test("institutional edition still rejects artifact-exposed GA4 variables", () => {
  assert.throws(
    () =>
      resolveEdition({
        env: {
          RADULATOR_EDITION: "institutional",
          RADULATOR_RELEASE_VERSION: "0.0.0-local-institutional-test",
          VITE_GA4_MEASUREMENT_ID: "G-TEST",
        },
        root,
      }),
    /VITE_GA4_MEASUREMENT_ID/,
  );
});

test("release control validation enforces version, boolean disabled, and allowlist subset", () => {
  const fakeEdition = {
    releaseVersion: "2026.07.13-test",
    calculatorAllowlist: ["tirads", "pirads"],
  };

  assert.deepEqual(
    validateReleaseControlPayload(
      {
        releaseVersion: "2026.07.13-test",
        disabled: false,
        disabledCalculators: ["tirads", "tirads"],
        message: "",
      },
      fakeEdition,
    ),
    {
      releaseVersion: "2026.07.13-test",
      disabled: false,
      disabledCalculatorIds: ["tirads"],
      message: "",
    },
  );

  assert.throws(
    () =>
      validateReleaseControlPayload(
        {
          releaseVersion: "wrong",
          disabled: false,
          disabledCalculators: [],
        },
        fakeEdition,
      ),
    /releaseVersion/,
  );
  assert.throws(
    () =>
      validateReleaseControlPayload(
        {
          releaseVersion: "2026.07.13-test",
          disabled: "false",
          disabledCalculators: [],
        },
        fakeEdition,
      ),
    /disabled must be boolean/,
  );
  assert.throws(
    () =>
      validateReleaseControlPayload(
        {
          releaseVersion: "2026.07.13-test",
          disabled: false,
          disabledCalculators: ["unknown"],
        },
        fakeEdition,
      ),
    /not in the allowlist/,
  );
});
