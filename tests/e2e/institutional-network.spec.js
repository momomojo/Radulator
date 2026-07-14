import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const origin =
  process.env.RADULATOR_INSTITUTIONAL_ORIGIN || "http://127.0.0.1:4173";
const firstPartyHost = new URL(origin).host;
const releaseVersion =
  process.env.RADULATOR_RELEASE_VERSION || "0.0.0-local-institutional-test";

function isFirstParty(url) {
  const parsed = new URL(url);
  return parsed.host === firstPartyHost;
}

function validReleaseControl(overrides = {}) {
  return {
    releaseVersion,
    disabled: false,
    disabledCalculators: [],
    message: "",
    ...overrides,
  };
}

function collectPageRequests(page) {
  const requests = [];
  const offOrigin = [];

  page.on("request", (req) => {
    const record = {
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
    };
    requests.push(record);
    if (!isFirstParty(req.url())) offOrigin.push(record);
  });

  return { requests, offOrigin };
}

function releaseControlRequests(requests) {
  return requests.filter(
    (item) => new URL(item.url).pathname === "/release-control.json",
  );
}

async function expectNoCalculatorUi(page) {
  await expect(page.getByLabel("Search calculators")).toHaveCount(0);
  await expect(page.getByTestId("institutional-empty-catalog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Calculate" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send Feedback" })).toHaveCount(0);
}

function expectReleaseControlRequestProof(requests, offOrigin) {
  expect(
    offOrigin,
    `off-origin requests:\n${offOrigin.map((item) => item.url).join("\n")}`,
  ).toEqual([]);
  expect(releaseControlRequests(requests)).toHaveLength(1);
  expect(
    releaseControlRequests(requests).every((item) => isFirstParty(item.url)),
  ).toBe(true);
}

test.describe("Institutional zero-network build", () => {
  test("exposes empty catalog and makes no off-origin requests", async ({
    page,
    request,
  }) => {
    const { requests, offOrigin } = collectPageRequests(page);
    const releaseControlResponsePromise = page.waitForResponse(
      `${origin}/release-control.json`,
    );

    await page.goto(`${origin}/`);
    const releaseControlResponse = await releaseControlResponsePromise;
    expect(releaseControlResponse.ok()).toBe(true);
    expect(await releaseControlResponse.json()).toMatchObject(
      validReleaseControl(),
    );

    await expect(
      page.getByRole("heading", {
        name: "No calculators approved for this release",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("institutional-empty-catalog")).toBeVisible();
    await expect(page.getByLabel("Search calculators")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send Feedback" })).toHaveCount(0);
    await expect(page.getByLabel("Name")).toHaveCount(0);
    await expect(page.getByLabel("Email")).toHaveCount(0);
    await expect(page.getByLabel(/MRN|medical record|date of birth|DOB/i)).toHaveCount(0);

    for (const hash of ["#/tirads", "#/feedback-form"]) {
      await page.goto(`${origin}/${hash}`);
      await expect(
        page.getByRole("heading", {
          name: "No calculators approved for this release",
        }),
      ).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("");
    }

    const release = await request.get(`${origin}/release.json`);
    expect(release.ok()).toBe(true);
    expect(await release.json()).toMatchObject({
      edition: "institutional",
      calculatorAllowlist: [],
    });

    mkdirSync("test-results", { recursive: true });
    writeFileSync(
      path.join("test-results", "institutional-network-requests.json"),
      `${JSON.stringify(requests, null, 2)}\n`,
    );

    expect(requests.some((item) => /googletagmanager/i.test(item.url))).toBe(false);
    expect(requests.some((item) => /google-analytics/i.test(item.url))).toBe(false);
    expect(requests.some((item) => /formspree/i.test(item.url))).toBe(false);
    expect(requests.some((item) => /cdnjs/i.test(item.url))).toBe(false);
    expectReleaseControlRequestProof(requests, offOrigin);
  });

  test("disabled release control renders an unavailable state with no calculator UI", async ({
    page,
  }) => {
    const { requests, offOrigin } = collectPageRequests(page);
    await page.route(`${origin}/release-control.json`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          validReleaseControl({
            disabled: true,
            message: "Paused for institutional review.",
          }),
        ),
      });
    });

    await page.goto(`${origin}/`);
    await expect(
      page.getByRole("heading", { name: "Institutional release disabled" }),
    ).toBeVisible();
    await expect(page.getByTestId("institutional-release-disabled")).toBeVisible();
    await expect(page.getByText("Paused for institutional review.")).toBeVisible();
    await expectNoCalculatorUi(page);
    expectReleaseControlRequestProof(requests, offOrigin);
  });

  const failClosedScenarios = [
    {
      name: "malformed",
      handle: (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{not-json",
        }),
    },
    {
      name: "missing",
      handle: (route) =>
        route.fulfill({
          status: 404,
          contentType: "text/plain",
          body: "not found",
        }),
    },
    {
      name: "mismatched",
      handle: (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            validReleaseControl({ releaseVersion: "different-release" }),
          ),
        }),
    },
    {
      name: "non-boolean disabled",
      handle: (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(validReleaseControl({ disabled: "false" })),
        }),
    },
    {
      name: "unknown disabled calculator",
      handle: (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            validReleaseControl({ disabledCalculators: ["tirads"] }),
          ),
        }),
    },
    {
      name: "unreachable",
      handle: (route) => route.abort("failed"),
    },
  ];

  for (const scenario of failClosedScenarios) {
    test(`fails closed when release control is ${scenario.name}`, async ({
      page,
    }) => {
      const { requests, offOrigin } = collectPageRequests(page);
      await page.route(`${origin}/release-control.json`, scenario.handle);

      await page.goto(`${origin}/`);
      await expect(
        page.getByRole("heading", { name: "Institutional release unavailable" }),
      ).toBeVisible();
      await expect(page.getByTestId("institutional-release-blocked")).toBeVisible();
      await expectNoCalculatorUi(page);
      expectReleaseControlRequestProof(requests, offOrigin);
    });
  }
});
