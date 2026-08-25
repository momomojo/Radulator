import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const calculatorName = "Mammography Assessment Guide (BI-RADS v2025 context)";

async function calculate(page, option) {
  await page.getByLabel(option, { exact: true }).click();
  await page.getByRole("button", { name: "Calculate" }).click();
}

test.describe("Mammography assessment categories with BI-RADS v2025 context", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, calculatorName);
  });

  test("states its independent, selected-category, mammography-only scope", async ({ page }) => {
    await expect(page.getByTestId("calculator-title").first()).toHaveText(calculatorName);
    await expect(page.getByTestId("guideline-badge")).toHaveText(
      "FDA MQSA 2024 · ACR BI-RADS v2025 context",
    );
    await expect(page.getByText("not an ACR-licensed BI-RADS implementation")).toBeVisible();
    await expect(page.getByText("does not assign a category from imaging features")).toBeVisible();
    await expect(page.getByText("mammography assessment categories only")).toBeVisible();

    await expect(page.getByText("Imaging Modality")).not.toBeVisible();
    await expect(page.getByText("Mass Shape")).not.toBeVisible();
    await expect(page.getByText("Calcification Morphology")).not.toBeVisible();
  });

  test("distinguishes the two incomplete-assessment paths", async ({ page }) => {
    await calculate(page, "Additional imaging evaluation is needed");
    await expect(page.getByText("Incomplete — additional imaging evaluation is needed")).toBeVisible();
    await expect(page.getByText("Complete the recommended imaging evaluation")).toBeVisible();

    await calculate(page, "Prior mammograms are needed for comparison");
    await expect(page.getByText("Incomplete — prior mammograms are needed for comparison")).toBeVisible();
    await expect(
      page.getByText(
        /Under U\.S\. MQSA.*within 30 calendar days.*Alternative Standard #25 permits "Incomplete: Need additional imaging evaluation"/,
      ),
    ).toBeVisible();
  });

  test("reports the probably-benign boundary and evidence-supported initial follow-up", async ({ page }) => {
    await calculate(page, "3 — Probably benign");
    await expect(page.getByText(">0% to ≤2% expected likelihood of malignancy")).toBeVisible();
    await expect(page.getByText("initial 6-month follow-up")).toBeVisible();
    await expect(page.getByText("does not calculate patient-specific risk")).toBeVisible();
  });

  for (const category of [
    ["4 — Suspicious", ">2% to <95%"],
    ["4A — Low suspicion", ">2% to ≤10%"],
    ["4B — Moderate suspicion", ">10% to ≤50%"],
    ["4C — High suspicion", ">50% to <95%"],
    ["5 — Highly suggestive of malignancy", "≥95%"],
  ]) {
    test(`preserves the ${category[0]} malignancy boundary`, async ({ page }) => {
      await calculate(page, category[0]);
      await expect(page.getByText(`${category[1]} expected likelihood of malignancy`)).toBeVisible();
      await expect(page.getByText("a qualified interpreting physician assigns the category")).toBeVisible();
    });
  }

  test("keeps known malignancy distinct from a new probability assessment", async ({ page }) => {
    await calculate(page, "6 — Known Biopsy-Proven Malignancy");
    await expect(page.getByText("malignancy has already been established by tissue diagnosis")).toBeVisible();
    await expect(page.getByText("surgeon and/or oncologist")).toBeVisible();
    await expect(page.getByText("Definitive local therapy")).toBeVisible();
    await expect(page.getByText("treatment planning")).toBeVisible();
    await expect(page.getByText("response assessment")).toBeVisible();
  });

  test("includes the FDA marker-placement assessment without assigning a BI-RADS number", async ({ page }) => {
    await calculate(page, "Post-procedure mammogram for marker placement");
    await expect(
      page
        .getByRole("status", { name: "Calculator results" })
        .getByText("Post-procedure mammogram for marker placement", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("not a numbered BI-RADS category")).toBeVisible();
    await expect(page.getByText("document marker deployment and position")).toBeVisible();
  });

  test("exposes version history and authoritative direct links", async ({ page }) => {
    const toggle = page.getByRole("button", { name: /Why v2025 context.*version history/i });
    await toggle.click();
    const panel = page.getByTestId("version-history-panel");
    await expect(panel).toContainText("ACR BI-RADS v2025 context (2025)");
    await expect(panel).toContainText("two incomplete-assessment pathways");
    await expect(panel).toContainText("does not reproduce the proprietary lexicon");

    await expect(panel.getByRole("link", { name: /FDA MQSA final-rule overview/i })).toHaveAttribute(
      "href",
      "https://www.fda.gov/radiation-emitting-products/mammography-quality-standards-act-mqsa-and-mqsa-program/important-information-final-rule-amend-mammography-quality-standards-act-mqsa",
    );
    await expect(page.getByRole("link", { name: /ACR BI-RADS current release/i }).first()).toHaveAttribute(
      "href",
      "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
    );
    await expect(
      page.locator(
        'a[href="https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-Mammography.pdf"]',
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: /Show 6 more references/i }).click();
    await expect(
      page.locator('a[href="https://pubmed.ncbi.nlm.nih.gov/42233890/"]'),
    ).toBeVisible();
  });
});
