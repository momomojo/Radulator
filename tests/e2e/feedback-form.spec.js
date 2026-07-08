import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { navigateToCalculator } from "../helpers/calculator-test-helper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const calculatorsDir = path.join(
  projectRoot,
  "src",
  "components",
  "calculators",
);

function getCalculatorIdsFromSource() {
  return fs
    .readdirSync(calculatorsDir)
    .filter((file) => file.endsWith(".jsx") && file !== "FeedbackForm.jsx")
    .map((file) => {
      const source = fs.readFileSync(path.join(calculatorsDir, file), "utf8");
      const anchor = source.search(/export\s+(?:default|const\s+\w+\s*=)\s*{/);
      const scope = anchor >= 0 ? source.slice(anchor) : source;
      return scope.match(/\bid\s*:\s*"([^"]+)"/)?.[1];
    })
    .filter(Boolean)
    .sort();
}

async function fillFeedbackForm(page, calculatorValue = "tirads") {
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Feedback Type").selectOption("general");
  await page
    .getByLabel("Related Calculator (if applicable)")
    .selectOption(calculatorValue);
  await page
    .locator("form")
    .getByRole("textbox", { name: "Message" })
    .fill("This is a focused feedback form regression test.");
}

test.describe("Feedback form", () => {
  test("lists the current calculator registry without stale hand-picked options", async ({
    page,
  }) => {
    await navigateToCalculator(page, "Send Feedback");

    const expectedCalculatorIds = getCalculatorIdsFromSource();
    const optionValues = await page
      .locator("#calculator option")
      .evaluateAll((options) => options.map((option) => option.value));
    const calculatorValues = optionValues
      .filter((value) => value && value !== "other")
      .sort();

    expect(calculatorValues).toEqual(expectedCalculatorIds);
    expect(optionValues).not.toContain("feedback-form");
    await expect(page.locator("#calculator")).toContainText("ThyPRO-39");
    await expect(page.locator("#calculator")).toContainText("Other / General");
  });

  test("shows success state and preserves feedback_submitted analytics", async ({
    page,
  }) => {
    const consoleMessages = [];
    const requestBodies = [];
    await page.addInitScript(() => {
      window.__feedbackAnalyticsEvents = [];
      window.gtag = (...args) => window.__feedbackAnalyticsEvents.push(args);
    });
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.route("**/f/xgvpkawo", async (route) => {
      expect(route.request().method()).toBe("POST");
      requestBodies.push(route.request().postData() || "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ next: "https://radulator.com/thanks" }),
      });
    });

    await navigateToCalculator(page, "Send Feedback");
    await fillFeedbackForm(page, "tirads");
    await page
      .locator("form")
      .getByRole("button", { name: "Send Feedback" })
      .click();

    await expect(
      page.locator('[role="status"]', {
        hasText: "Thank you for your feedback!",
      }),
    ).toContainText("Thank you for your feedback!");
    expect(requestBodies.join("\n")).toContain("tirads");
    await expect
      .poll(async () => {
        const gtagEvents = await page.evaluate(
          () => window.__feedbackAnalyticsEvents || [],
        );
        return (
          consoleMessages.some((message) =>
            message.includes("[GA4 Dev] feedback_submitted"),
          ) ||
          gtagEvents.some(
            ([command, eventName]) =>
              command === "event" && eventName === "feedback_submitted",
          )
        );
      })
      .toBe(true);
  });

  test("shows a safe generic submit error without leaking Formspree internals", async ({
    page,
  }) => {
    await page.route("**/f/xgvpkawo", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          errors: [
            {
              code: "BLOCKED",
              message: "internal stack trace token abc123",
            },
          ],
        }),
      });
    });

    await navigateToCalculator(page, "Send Feedback");
    await fillFeedbackForm(page, "cad-rads");
    await page
      .locator("form")
      .getByRole("button", { name: "Send Feedback" })
      .click();

    const alert = page.locator('[role="alert"]', {
      hasText: "We couldn't send your feedback.",
    });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(
      "Please check the required fields and try again.",
    );
    await expect(page.getByText("Raw error object")).not.toBeVisible();
    await expect(page.getByText("internal stack trace token abc123")).not.toBeVisible();
  });
});
