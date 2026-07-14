import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const origin =
  process.env.RADULATOR_INSTITUTIONAL_ORIGIN || "http://127.0.0.1:4173";
const firstPartyHost = new URL(origin).host;

function isFirstParty(url) {
  const parsed = new URL(url);
  return parsed.host === firstPartyHost;
}

test.describe("Institutional zero-network build", () => {
  test("exposes empty catalog and makes no off-origin requests", async ({
    page,
    request,
  }) => {
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

    await page.goto(`${origin}/`);
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

    const releaseControl = await request.get(`${origin}/release-control.json`);
    expect(releaseControl.ok()).toBe(true);
    expect(await releaseControl.json()).toMatchObject({
      disabled: false,
      disabledCalculators: [],
    });

    mkdirSync("test-results", { recursive: true });
    writeFileSync(
      path.join("test-results", "institutional-network-requests.json"),
      `${JSON.stringify(requests, null, 2)}\n`,
    );

    expect(
      offOrigin,
      `off-origin requests:\n${offOrigin.map((item) => item.url).join("\n")}`,
    ).toEqual([]);
    expect(requests.some((item) => /googletagmanager/i.test(item.url))).toBe(false);
    expect(requests.some((item) => /google-analytics/i.test(item.url))).toBe(false);
    expect(requests.some((item) => /formspree/i.test(item.url))).toBe(false);
    expect(requests.some((item) => /cdnjs/i.test(item.url))).toBe(false);
  });
});
