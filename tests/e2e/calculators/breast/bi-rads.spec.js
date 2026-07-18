import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const approvedRows = [
  {
    input: "0 additional imaging",
    category:
      "0 additional imaging - Incomplete: Need Additional Imaging Evaluation",
    likelihood: "N/A",
    management: "Recall for additional imaging",
  },
  {
    input: "0 prior comparison",
    category:
      "0 prior comparison - Incomplete: Need Prior Mammograms for Comparison",
    likelihood: "N/A",
    management: "Need comparison to prior examination(s)",
  },
  {
    input: "1",
    category: "1 - Negative",
    likelihood: "Essentially 0% likelihood of malignancy",
    management: "Routine mammography screening",
  },
  {
    input: "2",
    category: "2 - Benign",
    likelihood: "Essentially 0% likelihood of malignancy",
    management: "Routine mammography screening",
  },
  {
    input: "3",
    category: "3 - Probably Benign",
    likelihood: ">0% but ≤2% likelihood of malignancy",
    management:
      "Short-interval (6-month) follow-up or continued surveillance mammography",
  },
  {
    input: "4",
    category: "4 - Suspicious",
    likelihood: ">2% but <95% likelihood of malignancy",
    management: "Tissue diagnosis",
    sourceLiteral: "2% but <95% likelihood of malignancy",
  },
  {
    input: "4A",
    category: "4A - Low suspicion for malignancy",
    likelihood: ">2% to ≤10% likelihood of malignancy",
    management: "Tissue diagnosis",
  },
  {
    input: "4B",
    category: "4B - Moderate suspicion for malignancy",
    likelihood: ">10% to ≤50% likelihood of malignancy",
    management: "Tissue diagnosis",
  },
  {
    input: "4C",
    category: "4C - High suspicion for malignancy",
    likelihood: "50% to <95% likelihood of malignancy",
    management: "Tissue diagnosis",
  },
  {
    input: "5",
    category: "5 - Highly Suggestive of Malignancy",
    likelihood: "≥95% likelihood of malignancy",
    management: "Tissue diagnosis",
  },
  {
    input: "6",
    category: "6 - Known Biopsy-Proven Malignancy",
    likelihood: "N/A",
    management:
      "Clinical follow-up with surgeon and/or oncologist, and definitive local therapy (usually surgery) when clinically appropriate",
  },
];

const officialLinks = {
  current:
    "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
  mammography:
    "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-Mammography.pdf",
  whatsNew:
    "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BIRADS-v2025-Whats-New.pdf",
};

async function selectAssessmentAndCalculate(page, input) {
  await page.getByRole("radio", { name: input, exact: true }).check();
  await page.getByRole("button", { name: "Calculate" }).click();
  return page.getByRole("status", { name: "Calculator results" });
}

test.describe("ACR BI-RADS v2025 mammography assessment guide", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "ACR BI-RADS");
  });

  test("displays the approved mammography-only v2025 scope and badge", async ({
    page,
  }) => {
    await expect(page.getByTestId("calculator-title").first()).toContainText(
      "ACR BI-RADS",
    );
    await expect(page.getByTestId("calculator-description")).toContainText(
      "ACR BI-RADS v2025 mammography assessment-category guidance",
    );
    await expect(page.getByTestId("guideline-badge")).toHaveText(
      "ACR BI-RADS v2025",
    );
    await expect(page.getByTestId("calculator-info")).toContainText(
      "mammography assessment-category guidance only",
    );
    await expect(page.getByTestId("calculator-info")).toContainText(
      "does not infer a BI-RADS category from imaging features",
    );
    await expect(page.getByRole("radio")).toHaveCount(11);
    for (const row of approvedRows) {
      await expect(
        page.getByRole("radio", { name: row.input, exact: true }),
      ).toBeVisible();
    }
  });

  for (const row of approvedRows) {
    test(`renders approved output row for ${row.input}`, async ({ page }) => {
      const results = await selectAssessmentAndCalculate(page, row.input);

      await expect(results).toContainText(row.category);
      await expect(results).toContainText(row.likelihood);
      await expect(results).toContainText(row.management);
      await expect(results).toContainText(
        "N/A (ACR source-provided, ungraded)",
      );

      if (row.sourceLiteral) {
        await expect(results).toContainText(row.sourceLiteral);
        await expect(results).toContainText(
          "Normalized UI >2% but <95%; source literal 2% but <95%",
        );
        await expect(results).toContainText(
          "basis = mammography 4A plus public aggregate US/MRI/CEM rows; owner choice Q2=A",
        );
      }
    });
  }

  test("keeps the two Category 0 outcomes split", async ({ page }) => {
    let results = await selectAssessmentAndCalculate(
      page,
      "0 additional imaging",
    );
    await expect(results).toContainText(
      "Incomplete: Need Additional Imaging Evaluation",
    );
    await expect(results).toContainText("Recall for additional imaging");

    results = await selectAssessmentAndCalculate(page, "0 prior comparison");
    await expect(results).toContainText(
      "Incomplete: Need Prior Mammograms for Comparison",
    );
    await expect(results).toContainText(
      "Need comparison to prior examination(s)",
    );
  });

  test("does not expose the retired feature-inference or modality selector workflow", async ({
    page,
  }) => {
    await expect(page.getByText("Imaging Modality")).toHaveCount(0);
    await expect(page.getByText("Study Context")).toHaveCount(0);
    await expect(page.getByText("Finding Type")).toHaveCount(0);
    await expect(page.getByText("Mass Shape")).toHaveCount(0);
    await expect(page.getByText("Calcification Morphology")).toHaveCount(0);
    await expect(
      page.getByText("Overall Assessment of Suspicion"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("radio", { name: "Ultrasound", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("radio", { name: "MRI", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("radio", { name: "CEM", exact: true }),
    ).toHaveCount(0);
  });

  test("supports keyboard selection and calculation from accessible radio labels", async ({
    page,
  }) => {
    const category3 = page.getByRole("radio", { name: "3", exact: true });
    await category3.focus();
    await expect(category3).toBeFocused();

    await page.keyboard.press("Space");
    await expect(category3).toBeChecked();

    await page.getByRole("button", { name: "Calculate" }).focus();
    await page.keyboard.press("Enter");

    const results = page.getByRole("status", { name: "Calculator results" });
    await expect(results).toContainText("3 - Probably Benign");
    await expect(results).toContainText(
      ">0% but ≤2% likelihood of malignancy",
    );
  });

  test("copies Category 4 result with normalized display and source-literal provenance", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await selectAssessmentAndCalculate(page, "4");

    await page.getByRole("button", { name: "Copy results" }).click();
    await expect(
      page.getByRole("button", { name: "Results copied" }),
    ).toBeVisible();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain(
      "Likelihood: >2% but <95% likelihood of malignancy",
    );
    expect(clipboardText).toContain(
      "Category 4 Source Literal: 2% but <95% likelihood of malignancy",
    );
    expect(clipboardText).toContain(
      "Category 4 UI Normalization: >2% but <95% likelihood of malignancy",
    );
  });

  test("links current official ACR citations and concise v2025 version history", async ({
    page,
  }) => {
    const toggle = page.getByRole("button", {
      name: /Why v2025\? .*version history/i,
    });
    await expect(toggle).toBeVisible();
    await toggle.click();

    const panel = page.getByTestId("version-history-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("ACR BI-RADS v2025 (2025)");
    await expect(panel).toContainText("does not reproduce the paid manual");
    await expect(
      panel
        .getByRole("link", { name: /ACR BI-RADS current release page/ })
        .first(),
    ).toHaveAttribute("href", officialLinks.current);
    await expect(
      panel.getByRole("link", { name: /ACR BI-RADS v2025 What's New/ }),
    ).toHaveAttribute("href", officialLinks.whatsNew);
    await expect(
      panel.getByRole("link", { name: /ACR BI-RADS mammography summary form/ }),
    ).toHaveAttribute("href", officialLinks.mammography);

    await expect(
      page.getByRole("link", {
        name: /ACR Breast Imaging Reporting & Data System/,
      }),
    ).toHaveAttribute("href", officialLinks.current);
    await expect(
      page.getByRole("link", { name: /Mammography Lexicon Summary Form/ }),
    ).toHaveAttribute("href", officialLinks.mammography);
    await expect(
      page.getByRole("link", { name: /What's New\?/ }),
    ).toHaveAttribute("href", officialLinks.whatsNew);
  });
});

test.describe("ACR BI-RADS v2025 mobile proof", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders mobile output in dark mode without changing scope", async ({
    page,
  }) => {
    await navigateToCalculator(page, "ACR BI-RADS");

    await expect(
      page.getByRole("button", { name: "Open navigation menu" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Switch to dark mode" })
      .first()
      .click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    const results = await selectAssessmentAndCalculate(page, "4A");
    await expect(results).toContainText("4A - Low suspicion for malignancy");
    await expect(results).toContainText(
      ">2% to ≤10% likelihood of malignancy",
    );
    await expect(page.getByRole("radio")).toHaveCount(11);
  });
});
