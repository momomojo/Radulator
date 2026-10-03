import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for Wells PE Calculator
 * Wells Criteria for Pulmonary Embolism
 */

test.describe("Wells Criteria for PE Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Wells Criteria for PE");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title", async ({ page }) => {
      await expect(page.getByTestId('calculator-title').first()).toContainText("Wells Criteria for PE");
    });

    test("should have all 7 criteria as checkboxes", async ({ page }) => {
      await expect(
        page.getByText("Clinical signs/symptoms of DVT"),
      ).toBeVisible();
      await expect(
        page.getByText("Alternative diagnosis less likely than PE"),
      ).toBeVisible();
      await expect(page.getByText("Heart rate >100 bpm")).toBeVisible();
      await expect(page.getByText("Immobilization")).toBeVisible();
      await expect(page.getByText("Previous PE or DVT")).toBeVisible();
      await expect(page.getByText("Hemoptysis")).toBeVisible();
      await expect(page.getByText("Malignancy")).toBeVisible();
    });

    // Checkbox subLabels are not rendered, so each NICE NG158 Table 2 definition is part of the
    // visible label (primary judge on #342).
    test("should show each criterion's NICE NG158 definition in its visible label", async ({ page }) => {
      for (const [id, text] of [
        ["clinical_dvt", "Clinical signs/symptoms of DVT (at minimum, leg swelling and pain on palpation of the deep veins)"],
        ["immobilization_surgery", "Immobilization or surgery in the previous 4 weeks (immobilization for more than 3 days)"],
        ["malignancy", "Malignancy (under treatment, treated within the past 6 months, or palliative)"],
        ["alternative_less_likely", "Alternative diagnosis less likely than PE"],
      ]) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
        await expect(label).toContainText(text);
      }
    });

    test("should use the NICE NG158 / Wells 2000 wording for the alternative-diagnosis item", async ({
      page,
    }) => {
      // The cited rule gives these 3 points only if PE is judged more likely than the alternative;
      // the earlier "PE is #1 diagnosis OR equally likely" wording also scored a tie.
      await expect(page.getByText(/equally likely/i)).toHaveCount(0);
      await expect(page.getByText("PE is #1 diagnosis")).toHaveCount(0);

      await page.locator('button[id="alternative_less_likely"]').click();
      await page.click("button:has-text('Calculate')");

      const breakdown = page.locator(
        "section[aria-live='polite'] > div:has-text('Score Breakdown')",
      );
      await expect(breakdown).toContainText(
        "Alternative diagnosis less likely than PE: +3.0",
      );
      await expect(page.getByText(/equally likely/i)).toHaveCount(0);
    });

    test("should display info section with Wells explanation", async ({
      page,
    }) => {
      await expect(
        page.getByTestId("calculator-info").getByText("Wells Criteria"),
      ).toBeVisible();
    });
  });

  test.describe("Low Risk Calculations", () => {
    test("should calculate 0 points when no criteria selected", async ({
      page,
    }) => {
      await page.click("button:has-text('Calculate')");

      // Check that results contain expected values
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("0 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("Low");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('2-Tier Assessment')",
        ),
      ).toContainText("PE Unlikely");
    });

    test("should calculate 1 pt with hemoptysis only", async ({ page }) => {
      await page.locator('button[id="hemoptysis"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("1 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("Low");
    });
  });

  test.describe("Wells 2000 Cut Points", () => {
    test("should classify 1.5 points as Low probability (Wells 2000 low band is below 2)", async ({
      page,
    }) => {
      await page.locator('button[id="heart_rate"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("1.5 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("Low Probability");
      // The PERC note states NICE NG158 1.1.16's conditions and ACP 2015 advice 2 (primary judge on #342).
      const notes = page.locator(
        "section[aria-live='polite'] > div:has-text('Clinical Notes:')",
      );
      await expect(notes).toContainText(
        "Consider the PERC rule only if the overall clinical impression",
      );
      await expect(notes).toContainText("gives low clinical suspicion of PE and other diagnoses are feasible (NICE NG158 1.1.16)");
      await expect(notes).toContainText("A Wells score below 2 is not enough on its own.");
      await expect(notes).toContainText(
        "With a low pretest probability and all PERC criteria met, ACP 2015 advises against D-dimer testing or imaging.",
      );
      await expect(notes).toContainText("PERC is not validated in people with COVID-19.");
    });

    test("should attribute the negative D-dimer outcome and make no NPV >99% claim", async ({
      page,
    }) => {
      await page.click("button:has-text('Calculate')");

      const recommendation = page.locator(
        "section[aria-live='polite'] > div:has-text('Recommendation:')",
      );
      await expect(recommendation).toContainText("Christopher Study");
      await expect(recommendation).toContainText(
        "0.5% (95% CI 0.2–1.1%) had nonfatal VTE over 3 months of follow-up",
      );
      await expect(page.getByText(/NPV|>\s*99%|effectively excluded/)).toHaveCount(0);
    });
  });

  test.describe("Moderate Risk Calculations", () => {
    test("should calculate moderate risk with immobilization + HR >100", async ({
      page,
    }) => {
      // Immobilization (1.5 pts) + HR >100 (1.5 pts) = 3 pts
      await page.locator('button[id="immobilization_surgery"]').click();
      await page.locator('button[id="heart_rate"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("3 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("Moderate");
    });
  });

  test.describe("High Risk Calculations", () => {
    test("should calculate high risk with DVT signs + alternative less likely + HR >100", async ({
      page,
    }) => {
      // DVT signs (3 pts) + alternative diagnosis less likely than PE (3 pts) + HR >100 (1.5 pts) = 7.5 pts
      await page.locator('button[id="clinical_dvt"]').click();
      await page.locator('button[id="alternative_less_likely"]').click();
      await page.locator('button[id="heart_rate"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("7.5 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("High");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('2-Tier Assessment')",
        ),
      ).toContainText("PE Likely");
    });

    test("should calculate max score with all criteria selected", async ({
      page,
    }) => {
      // All criteria = 3+3+1.5+1.5+1.5+1+1 = 12.5 pts
      const switches = page.locator("button[role='switch']");
      const count = await switches.count();

      for (let i = 0; i < count; i++) {
        await switches.nth(i).click();
      }

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("12.5 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("High");
    });
  });

  test.describe("2-Tier Risk Classification", () => {
    test("should show PE Unlikely for score <= 4", async ({ page }) => {
      // HR >100 (1.5) + Hemoptysis (1) + Malignancy (1) = 3.5 pts
      await page.locator('button[id="heart_rate"]').click();
      await page.locator('button[id="hemoptysis"]').click();
      await page.locator('button[id="malignancy"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('2-Tier Assessment')",
        ),
      ).toContainText("PE Unlikely");
    });

    test("should show PE Likely for score > 4", async ({ page }) => {
      // DVT signs (3) + Previous PE/DVT (1.5) + Malignancy (1) = 5.5 pts
      await page.locator('button[id="clinical_dvt"]').click();
      await page.locator('button[id="previous_pe_dvt"]').click();
      await page.locator('button[id="malignancy"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('2-Tier Assessment')",
        ),
      ).toContainText("PE Likely");
    });
  });

  test.describe("Management Recommendations", () => {
    test("should recommend D-dimer for PE Unlikely", async ({ page }) => {
      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Recommendation:')",
        ),
      ).toContainText("D-dimer");
    });

    test("should recommend CTPA for PE Likely", async ({ page }) => {
      await page.locator('button[id="clinical_dvt"]').click();
      await page.locator('button[id="alternative_less_likely"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Recommendation:')",
        ),
      ).toContainText("CTPA");
    });
  });

  test.describe("References", () => {
    test("should display Wells PE references", async ({ page }) => {
      // Use the heading role to avoid matching the "Show N more references" button
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.locator("a[href*='pubmed']").first()).toBeVisible();
    });
  });
});
