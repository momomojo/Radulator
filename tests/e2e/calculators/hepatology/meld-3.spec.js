/**
 * E2E Tests for adult/adolescent MELD 3.0.
 *
 * Covers the five verified examples from the MELD 3.0 source/math audit
 * packet used for the 2026-07-06 clinical signoff decision.
 */

import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const examples = [
  {
    name: "low-score bounded normal male",
    inputs: {
      ageAtRegistration: "45",
      currentAge: "45",
      sex: "male",
      creatinine: "0.8",
      bilirubin: "0.8",
      inr: "1.0",
      sodium: "140",
      albumin: "4.0",
      dialysis: false,
    },
    expectedRaw: "6.0000",
    expectedScore: "6",
  },
  {
    name: "female sex term",
    inputs: {
      ageAtRegistration: "45",
      currentAge: "45",
      sex: "female",
      creatinine: "1.0",
      bilirubin: "1.5",
      inr: "1.2",
      sodium: "135",
      albumin: "3.0",
      dialysis: false,
    },
    expectedRaw: "13.2066",
    expectedScore: "13",
  },
  {
    name: "hypoalbuminemia",
    inputs: {
      ageAtRegistration: "45",
      currentAge: "45",
      sex: "male",
      creatinine: "1.0",
      bilirubin: "2.0",
      inr: "1.5",
      sodium: "137",
      albumin: "1.8",
      dialysis: false,
    },
    expectedRaw: "15.9914",
    expectedScore: "16",
  },
  {
    name: "high-score female with hyponatremia",
    inputs: {
      ageAtRegistration: "45",
      currentAge: "45",
      sex: "female",
      creatinine: "2.5",
      bilirubin: "10.0",
      inr: "2.2",
      sodium: "128",
      albumin: "2.8",
      dialysis: false,
    },
    expectedRaw: "37.7320",
    expectedScore: "38",
  },
  {
    name: "dialysis/creatinine cap",
    inputs: {
      ageAtRegistration: "45",
      currentAge: "45",
      sex: "male",
      creatinine: "5.0",
      bilirubin: "2.0",
      inr: "1.5",
      sodium: "137",
      albumin: "3.5",
      dialysis: true,
    },
    expectedRaw: "25.0850",
    expectedScore: "25",
  },
  {
    name: "adolescent path uses +7.33 constant",
    inputs: {
      ageAtRegistration: "17",
      currentAge: "17",
      creatinine: "1.0",
      bilirubin: "1.5",
      inr: "1.2",
      sodium: "135",
      albumin: "3.0",
      dialysis: false,
    },
    expectedRaw: "13.2066",
    expectedScore: "13",
    expectedPath: "Adolescent MELD 3.0",
  },
];

async function fillMeld30(page, inputs) {
  await page.fill('input[id="currentAge"]', inputs.currentAge);
  await page.fill('input[id="ageAtRegistration"]', inputs.ageAtRegistration);
  if (inputs.sex) {
    await page.locator(`label[for="sex-${inputs.sex}"]`).click();
  }
  await page.fill('input[id="creatinine"]', inputs.creatinine);
  await page.fill('input[id="bilirubin"]', inputs.bilirubin);
  await page.fill('input[id="inr"]', inputs.inr);
  await page.fill('input[id="sodium"]', inputs.sodium);
  await page.fill('input[id="albumin"]', inputs.albumin);

  const dialysisSwitch = page.locator('button[role="switch"]').first();
  const isDialysisOn =
    (await dialysisSwitch.getAttribute("aria-checked")) === "true";
  if (isDialysisOn !== inputs.dialysis) {
    await dialysisSwitch.click();
  }
}

test.describe("MELD 3.0 Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "MELD 3.0 Score");
    await expect(page.getByTestId("calculator-title").first()).toContainText(
      "MELD 3.0 Score",
    );
  });

  test("should display adult/adolescent scope, current badge, and version disclosure", async ({
    page,
  }) => {
    await expect(page.getByTestId("guideline-badge")).toHaveText(
      "MELD 3.0 (OPTN 2023)",
    );
    const infoText = page.getByTestId("calculator-info-text");
    await expect(infoText).toContainText("candidates age 12 or older");
    await expect(
      infoText,
    ).toContainText("does not implement PELD for candidates under age 12");

    const toggle = page.getByRole("button", {
      name: /Why MELD 3\.0\? .*version history/i,
    });
    const panel = page.getByTestId("version-history-panel");
    await expect(toggle).toBeVisible();
    await expect(panel).toBeHidden();

    await toggle.click();

    await expect(panel).toBeVisible();
    await expect(panel).toContainText("MELD 3.0 (2023)");
    await expect(panel).toContainText("Replaces MELD-Na");
    await expect(panel).toContainText("Current OPTN");
    await expect(panel).toContainText("MELD-Na remains available");
  });

  for (const example of examples) {
    test(`should match verified packet example: ${example.name}`, async ({
      page,
    }) => {
      await fillMeld30(page, example.inputs);
      await page.getByRole("button", { name: "Calculate" }).click();

      await expect(
        page.locator(`text=MELD 3.0 Score: ${example.expectedScore}`).first(),
      ).toBeVisible();
      await expect(
        page.locator(`text=MELD 3.0 Raw: ${example.expectedRaw}`).first(),
      ).toBeVisible();
      if (example.expectedPath) {
        await expect(
          page.locator(`text=${example.expectedPath}`).first(),
        ).toBeVisible();
      }
      await expect(
        page.locator("text=90-Day Mortality Context:"),
      ).toBeVisible();
      await expect(page.locator("text=Adjusted Inputs:")).toBeVisible();
    });
  }
});
