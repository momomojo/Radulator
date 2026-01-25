/**
 * CT Severity Index (CTSI) / Balthazar Score Calculator - E2E Tests
 *
 * Tests the CT Severity Index calculator for acute pancreatitis severity assessment
 * combining Balthazar grade with pancreatic necrosis extent.
 *
 * Test Coverage:
 * - Mild pancreatitis (Balthazar A/B, CTSI 0-3)
 * - Moderate pancreatitis (Balthazar C/D, CTSI 4-6)
 * - Severe pancreatitis (Balthazar E, CTSI 7-10)
 * - CTSI calculations with various necrosis extents
 * - Modified CTSI calculations with extrapancreatic complications
 * - Timing warnings for early CT
 * - Atlanta Classification integration
 * - Edge cases and boundary conditions
 *
 * References:
 * - Balthazar EJ, et al. Radiology. 1985;156(3):767-772 (Original Balthazar grade)
 * - Balthazar EJ, et al. Radiology. 1990;174(2):331-336 (CTSI with necrosis)
 * - Mortele KJ, et al. Radiology. 2004;233(3):728-735 (Modified CTSI)
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  selectRadio,
  verifyThemeConsistency,
} from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "CT Severity Index (CTSI)";

test.describe("CT Pancreatitis Severity Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    // Verify calculator loaded
    await expect(page.locator("h2")).toContainText("CT Severity Index (CTSI)");
    await expect(
      page.locator("text=Balthazar score with necrosis grading"),
    ).toBeVisible();
  });

  test.describe("Calculator Display & UI", () => {
    test("should display calculator info panel with CTSI scoring information", async ({
      page,
    }) => {
      // Verify info panel is present
      const infoPanel = page.locator(".bg-blue-50\\/60");
      await expect(infoPanel).toBeVisible();

      // Verify content mentions Balthazar grades
      await expect(infoPanel).toContainText("Grade A");
      await expect(infoPanel).toContainText("Grade B");
      await expect(infoPanel).toContainText("Grade C");
      await expect(infoPanel).toContainText("Grade D");
      await expect(infoPanel).toContainText("Grade E");

      // Verify necrosis scoring info
      await expect(infoPanel).toContainText("None (0 pts)");
      await expect(infoPanel).toContainText("≤30%");
      await expect(infoPanel).toContainText("30-50%");
      await expect(infoPanel).toContainText(">50%");

      // Verify severity categories
      await expect(infoPanel).toContainText("Mild (0-3)");
      await expect(infoPanel).toContainText("Moderate (4-6)");
      await expect(infoPanel).toContainText("Severe (7-10)");
    });

    test("should display all required input fields", async ({ page }) => {
      // Timing field
      await expect(
        page.locator('label:has-text("Time from symptom onset")'),
      ).toBeVisible();

      // Balthazar grade field
      await expect(
        page.locator('label:has-text("Balthazar CT Grade")'),
      ).toBeVisible();

      // Necrosis extent field
      await expect(
        page.locator('label:has-text("Pancreatic Necrosis Extent")'),
      ).toBeVisible();

      // Extrapancreatic complications field
      await expect(
        page.locator('label:has-text("Extrapancreatic Complications")'),
      ).toBeVisible();
    });

    test("should display radio options for timing", async ({ page }) => {
      await expect(
        page.locator("text=<48 hours (early - necrosis may not be visible)"),
      ).toBeVisible();
      await expect(
        page.locator("text=48-72 hours (optimal timing for CTSI)"),
      ).toBeVisible();
      await expect(page.locator("text=>72 hours")).toBeVisible();
    });

    test("should display radio options for Balthazar grades", async ({
      page,
    }) => {
      await expect(
        page.locator("text=Grade A - Normal pancreas (0 points)"),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=Grade B - Focal or diffuse pancreatic enlargement (1 point)",
        ),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
        ),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=Grade D - Single peripancreatic fluid collection (3 points)",
        ),
      ).toBeVisible();
      await expect(page.locator('label:has-text("Grade E")')).toBeVisible();
    });

    test("should display radio options for necrosis extent", async ({
      page,
    }) => {
      await expect(
        page.locator(
          "text=No necrosis - pancreas enhances normally (0 points)",
        ),
      ).toBeVisible();
      await expect(page.locator("text=≤30% necrosis (2 points)")).toBeVisible();
      await expect(
        page.locator("text=30-50% necrosis (4 points)"),
      ).toBeVisible();
      await expect(page.locator("text=>50% necrosis (6 points)")).toBeVisible();
    });
  });

  test.describe("Mild Pancreatitis (CTSI 0-3)", () => {
    test("Balthazar Grade A with no necrosis - CTSI 0 (Mild)", async ({
      page,
    }) => {
      // Select optimal timing
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade A: Normal pancreas (0 points)
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade A - Normal pancreas (0 points)",
      );

      // No necrosis (0 points)
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );

      // No extrapancreatic complications
      await selectRadio(page, "Extrapancreatic Complications", "None");

      // Calculate
      await page.locator('button:has-text("Calculate")').click();

      // Verify results - CTSI = 0 + 0 = 0 (Mild)
      await expect(
        page.locator('p:has-text("CT Severity Index (CTSI): 0 points - Mild")'),
      ).toBeVisible();
      await expect(
        page.locator('p:has-text("Balthazar Grade: Grade A (0 points)")'),
      ).toBeVisible();
      await expect(
        page.locator('p:has-text("Necrosis Score: 0 points (none)")'),
      ).toBeVisible();
      await expect(
        page.locator(
          'p:has-text("Pancreatitis Type: Interstitial edematous pancreatitis")',
        ),
      ).toBeVisible();
      await expect(
        page.locator('p:has-text("Morbidity Risk: ~8%")'),
      ).toBeVisible();
      await expect(
        page.locator('p:has-text("Mortality Risk: ~3%")'),
      ).toBeVisible();
    });

    test("Balthazar Grade B with no necrosis - CTSI 1 (Mild)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade B: Pancreatic enlargement (1 point)
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade B - Focal or diffuse pancreatic enlargement (1 point)",
      );

      // No necrosis (0 points)
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );

      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // Verify results - CTSI = 1 + 0 = 1 (Mild)
      await expect(
        page.locator('p:has-text("CT Severity Index (CTSI): 1 points - Mild")'),
      ).toBeVisible();
      await expect(page.locator("text=Grade B (1 points)")).toBeVisible();
      await expect(page.locator("text=Mild acute pancreatitis")).toBeVisible();
    });

    test("Balthazar Grade C with no necrosis - CTSI 2 (Mild)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade C: Peripancreatic fat stranding (2 points)
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );

      // No necrosis (0 points)
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );

      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // Verify results - CTSI = 2 + 0 = 2 (Mild)
      await expect(
        page.locator('p:has-text("CT Severity Index (CTSI): 2 points - Mild")'),
      ).toBeVisible();
      await expect(page.locator("text=Grade C (2 points)")).toBeVisible();
    });

    test("Balthazar Grade A with ≤30% necrosis - CTSI 2 (Mild)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade A (0 points)
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade A - Normal pancreas (0 points)",
      );

      // ≤30% necrosis (2 points)
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "≤30% necrosis (2 points)",
      );

      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // Verify results - CTSI = 0 + 2 = 2 (Mild)
      await expect(
        page.locator('p:has-text("CT Severity Index (CTSI): 2 points - Mild")'),
      ).toBeVisible();
      await expect(page.locator("text=2 points (≤30%)")).toBeVisible();
      await expect(
        page.locator("text=Necrotizing pancreatitis (minor)"),
      ).toBeVisible();
    });

    test("Boundary case: CTSI 3 (upper limit of Mild)", async ({ page }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade B (1 point) + ≤30% necrosis (2 points) = 3
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade B - Focal or diffuse pancreatic enlargement (1 point)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "≤30% necrosis (2 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // CTSI = 1 + 2 = 3 (still Mild)
      await expect(
        page.locator('p:has-text("CT Severity Index (CTSI): 3 points - Mild")'),
      ).toBeVisible();
      await expect(page.locator('p:has-text("Morbidity Risk: ~8%")')).toBeVisible();
    });
  });

  test.describe("Moderate Pancreatitis (CTSI 4-6)", () => {
    test("Balthazar Grade C with ≤30% necrosis - CTSI 4 (Moderate)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade C (2 points) + ≤30% necrosis (2 points) = 4
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "≤30% necrosis (2 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // Verify results - CTSI = 2 + 2 = 4 (Moderate)
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 4 points - Moderate")',
        ),
      ).toBeVisible();
      await expect(page.locator("text=Grade C (2 points)")).toBeVisible();
      await expect(page.locator("text=~35%").first()).toBeVisible(); // Morbidity for moderate
      await expect(page.locator("text=~6%").first()).toBeVisible(); // Mortality for moderate
    });

    test("Balthazar Grade D with no necrosis - CTSI 3 boundary (Mild)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade D (3 points) + no necrosis (0 points) = 3
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade D - Single peripancreatic fluid collection (3 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // CTSI = 3 + 0 = 3 (still Mild)
      await expect(
        page.locator('p:has-text("CT Severity Index (CTSI): 3 points - Mild")'),
      ).toBeVisible();
      await expect(page.locator("text=Grade D (3 points)")).toBeVisible();
    });

    test("Balthazar Grade D with ≤30% necrosis - CTSI 5 (Moderate)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade D (3 points) + ≤30% necrosis (2 points) = 5
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade D - Single peripancreatic fluid collection (3 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "≤30% necrosis (2 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // CTSI = 3 + 2 = 5 (Moderate)
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 5 points - Moderate")',
        ),
      ).toBeVisible();
    });

    test("Balthazar Grade C with 30-50% necrosis - CTSI 6 (Moderate)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade C (2 points) + 30-50% necrosis (4 points) = 6
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "30-50% necrosis (4 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // CTSI = 2 + 4 = 6 (upper limit of Moderate)
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 6 points - Moderate")',
        ),
      ).toBeVisible();
      await expect(page.locator("text=4 points (30-50%)")).toBeVisible();
      await expect(
        page.locator("text=Necrotizing pancreatitis (moderate)"),
      ).toBeVisible();
    });
  });

  test.describe("Severe Pancreatitis (CTSI 7-10)", () => {
    test("Balthazar Grade E with no necrosis - CTSI 4 (Moderate)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade E (4 points) + no necrosis (0 points) = 4
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade E - ≥2 fluid collections or retroperitoneal gas (4 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // CTSI = 4 + 0 = 4 (Moderate, not severe)
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 4 points - Moderate")',
        ),
      ).toBeVisible();
      await expect(page.locator("text=Grade E (4 points)")).toBeVisible();

      // Clinical implications for Grade E
      await expect(
        page.locator(
          "text=Multiple fluid collections may evolve into walled-off necrosis",
        ),
      ).toBeVisible();
    });

    test("Balthazar Grade E with ≤30% necrosis - CTSI 6 (Moderate)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade E (4 points) + ≤30% necrosis (2 points) = 6
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade E - ≥2 fluid collections or retroperitoneal gas (4 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "≤30% necrosis (2 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // CTSI = 4 + 2 = 6 (Moderate)
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 6 points - Moderate")',
        ),
      ).toBeVisible();
    });

    test("Balthazar Grade D with 30-50% necrosis - CTSI 7 (Severe)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade D (3 points) + 30-50% necrosis (4 points) = 7
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade D - Single peripancreatic fluid collection (3 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "30-50% necrosis (4 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // CTSI = 3 + 4 = 7 (Severe)
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 7 points - Severe")',
        ),
      ).toBeVisible();
      await expect(page.locator("text=~92%").first()).toBeVisible(); // Morbidity for severe
      await expect(page.locator("text=~17%").first()).toBeVisible(); // Mortality for severe

      // Clinical implications for high necrosis
      await expect(
        page.locator("text=High risk of infected necrosis"),
      ).toBeVisible();
      await expect(page.locator("text=Consider ICU admission")).toBeVisible();
    });

    test("Balthazar Grade E with 30-50% necrosis - CTSI 8 (Severe)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade E (4 points) + 30-50% necrosis (4 points) = 8
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade E - ≥2 fluid collections or retroperitoneal gas (4 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "30-50% necrosis (4 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // CTSI = 4 + 4 = 8 (Severe)
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 8 points - Severe")',
        ),
      ).toBeVisible();
    });

    test("Balthazar Grade D with >50% necrosis - CTSI 9 (Severe)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade D (3 points) + >50% necrosis (6 points) = 9
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade D - Single peripancreatic fluid collection (3 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        ">50% necrosis (6 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // CTSI = 3 + 6 = 9 (Severe)
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 9 points - Severe")',
        ),
      ).toBeVisible();
      await expect(page.locator("text=6 points (>50%)")).toBeVisible();
      await expect(
        page.locator("text=Necrotizing pancreatitis (extensive)"),
      ).toBeVisible();
    });

    test("Balthazar Grade E with >50% necrosis - CTSI 10 (Maximum Severe)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade E (4 points) + >50% necrosis (6 points) = 10
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade E - ≥2 fluid collections or retroperitoneal gas (4 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        ">50% necrosis (6 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // CTSI = 4 + 6 = 10 (Maximum Severe)
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 10 points - Severe")',
        ),
      ).toBeVisible();
      await expect(page.locator("text=Grade E (4 points)")).toBeVisible();
      await expect(page.locator("text=6 points (>50%)")).toBeVisible();

      // Verify Atlanta classification
      await expect(
        page.locator(
          "text=Severe acute pancreatitis (persistent organ failure likely)",
        ),
      ).toBeVisible();
    });
  });

  test.describe("Modified CTSI Calculations", () => {
    test("Modified CTSI with extrapancreatic complications adds 2 points", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade C (2 points) + no necrosis (0 points) = CTSI 2
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );

      // Add extrapancreatic complications (+2 points for MCTSI)
      await selectRadio(
        page,
        "Extrapancreatic Complications",
        "One or more: Ascites, pleural effusion, vascular/GI complications",
      );

      await page.locator('button:has-text("Calculate")').click();

      // Original CTSI = 2 (Mild), Modified CTSI = 2 + 2 = 4 (Moderate)
      await expect(
        page.locator('p:has-text("CT Severity Index (CTSI): 2 points - Mild")'),
      ).toBeVisible();
      await expect(page.locator("text=Modified CTSI:")).toBeVisible();
      await expect(
        page.locator('p:has-text("Modified CTSI: 4 points - Moderate")'),
      ).toBeVisible();
      await expect(
        page.locator("text=Extrapancreatic Complications:"),
      ).toBeVisible();
      await expect(page.locator("text=Present (+2 points)")).toBeVisible();
    });

    test("Modified CTSI severity thresholds: Mild (0-2), Moderate (3-4), Severe (5+)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade E (4 points) + 30-50% necrosis (4 points) = CTSI 8
      // With extrapancreatic: MCTSI = 8 + 2 = 10 (Severe)
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade E - ≥2 fluid collections or retroperitoneal gas (4 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "30-50% necrosis (4 points)",
      );
      await selectRadio(
        page,
        "Extrapancreatic Complications",
        "One or more: Ascites, pleural effusion, vascular/GI complications",
      );

      await page.locator('button:has-text("Calculate")').click();

      // Verify both scores
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 8 points - Severe")',
        ),
      ).toBeVisible(); // Original CTSI
      await expect(
        page.locator('p:has-text("Modified CTSI: 10 points - Severe")'),
      ).toBeVisible(); // Modified CTSI
    });

    test("Modified CTSI Mild threshold (MCTSI ≤2)", async ({ page }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Grade B (1 point) + no necrosis (0 points) = CTSI 1, MCTSI 1 (Mild)
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade B - Focal or diffuse pancreatic enlargement (1 point)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // Both CTSI and MCTSI should be Mild
      await expect(
        page.locator('p:has-text("CT Severity Index (CTSI): 1 points - Mild")'),
      ).toBeVisible();
    });
  });

  test.describe("Timing Warnings", () => {
    test("Early CT (<48 hours) shows timing warning", async ({ page }) => {
      // Select early timing
      await selectRadio(
        page,
        "Time from symptom onset",
        "<48 hours (early - necrosis may not be visible)",
      );

      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // Verify timing warning is shown
      await expect(page.locator("text=Timing Note:")).toBeVisible();
      await expect(
        page.locator(
          "text=CT performed <48 hours may underestimate necrosis extent",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=Consider repeat CT at 48-72 hours"),
      ).toBeVisible();
    });

    test("Optimal timing (48-72 hours) does not show timing warning", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // Verify timing warning is NOT shown
      await expect(page.locator("text=Timing Note:")).not.toBeVisible();
    });

    test("Late timing (>72 hours) does not show timing warning", async ({
      page,
    }) => {
      await selectRadio(page, "Time from symptom onset", ">72 hours");

      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade D - Single peripancreatic fluid collection (3 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "≤30% necrosis (2 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      // Verify timing warning is NOT shown
      await expect(page.locator("text=Timing Note:")).not.toBeVisible();
    });
  });

  test.describe("Atlanta Classification Integration", () => {
    test("Mild acute pancreatitis - no necrosis, no extrapancreatic complications", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade B - Focal or diffuse pancreatic enlargement (1 point)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      await expect(
        page.locator("text=Revised Atlanta Classification:"),
      ).toBeVisible();
      await expect(page.locator("text=Mild acute pancreatitis")).toBeVisible();
    });

    test("Moderately severe acute pancreatitis - with necrosis but low CTSI", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // CTSI 4 (Moderate) with necrosis
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "≤30% necrosis (2 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      await expect(
        page.locator("text=Revised Atlanta Classification:"),
      ).toBeVisible();
      await expect(
        page.locator("text=Moderately severe acute pancreatitis"),
      ).toBeVisible();
    });

    test("Severe acute pancreatitis - high CTSI with necrosis", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // CTSI 8 (Severe)
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade E - ≥2 fluid collections or retroperitoneal gas (4 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "30-50% necrosis (4 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      await expect(
        page.locator("text=Revised Atlanta Classification:"),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=Severe acute pancreatitis (persistent organ failure likely)",
        ),
      ).toBeVisible();
    });

    test("Moderately severe with extrapancreatic complications but low CTSI", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // CTSI 2 (Mild) but with extrapancreatic complications
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(
        page,
        "Extrapancreatic Complications",
        "One or more: Ascites, pleural effusion, vascular/GI complications",
      );

      await page.locator('button:has-text("Calculate")').click();

      // Extrapancreatic complications should trigger moderately severe
      await expect(
        page.locator("text=Revised Atlanta Classification:"),
      ).toBeVisible();
      await expect(
        page.locator("text=Moderately severe acute pancreatitis"),
      ).toBeVisible();
    });
  });

  test.describe("Clinical Implications", () => {
    test("No necrosis shows interstitial pancreatitis implications", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      await expect(
        page.locator(
          "text=Interstitial edematous pancreatitis typically resolves within 1-2 weeks",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=Low risk of infected necrosis or organ failure"),
      ).toBeVisible();
    });

    test("With necrosis shows necrotizing pancreatitis implications", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "≤30% necrosis (2 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      await expect(
        page.locator(
          "text=Necrotizing pancreatitis requires close monitoring for infection",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=Consider repeat imaging if clinical deterioration"),
      ).toBeVisible();
    });

    test("High necrosis (≥30%) shows additional complications warnings", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade D - Single peripancreatic fluid collection (3 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "30-50% necrosis (4 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      await expect(
        page.locator(
          "text=High risk of infected necrosis (~30-40% with >30% necrosis)",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=Consider ICU admission and early nutrition support"),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=Surgical/interventional consultation may be needed for infected necrosis",
        ),
      ).toBeVisible();
    });

    test("Grade E shows specific implications about fluid collections", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade E - ≥2 fluid collections or retroperitoneal gas (4 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      await expect(
        page.locator(
          "text=Multiple fluid collections may evolve into walled-off necrosis (WON) or pseudocysts",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=Gas in collections suggests infected necrosis"),
      ).toBeVisible();
    });
  });

  test.describe("Validation & Error Handling", () => {
    test("should show error when Balthazar grade is not selected", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      // Skip Balthazar grade selection
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      await expect(
        page.locator("text=Please select a Balthazar CT grade"),
      ).toBeVisible();
    });

    test("should show error when necrosis extent is not selected", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );

      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
      );
      // Skip necrosis extent selection
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();

      await expect(
        page.locator("text=Please select pancreatic necrosis extent"),
      ).toBeVisible();
    });
  });

  test.describe("References & Theme", () => {
    test("should display all reference citations", async ({ page }) => {
      // Scroll to references section
      await page.locator('h3:has-text("References")').scrollIntoViewIfNeeded();

      // Verify reference section exists
      await expect(page.locator('h3:has-text("References")')).toBeVisible();

      // Verify key references are present
      await expect(
        page.locator('a:has-text("Balthazar EJ, Ranson JH")'),
      ).toBeVisible();
      await expect(page.locator('a:has-text("Mortele KJ")')).toBeVisible();
      await expect(
        page.locator('a:has-text("Banks PA, Bollen TL")'),
      ).toBeVisible();
    });

    test("should maintain theme consistency", async ({ page }) => {
      await verifyThemeConsistency(page);
    });

    test("should be responsive on mobile devices", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Verify calculator is still usable on mobile
      await expect(
        page.locator('h2:has-text("CT Severity Index")'),
      ).toBeVisible();
      await expect(page.locator('button:has-text("Calculate")')).toBeVisible();

      // Verify sidebar is present (may be narrower on mobile)
      const sidebar = page.locator("aside").first();
      await expect(sidebar).toBeVisible();

      // Reset to desktop
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.describe("Screenshots for Documentation", () => {
    test("Screenshot: Mild pancreatitis (Grade A, no necrosis)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade A - Normal pancreas (0 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        "No necrosis - pancreas enhances normally (0 points)",
      );
      await selectRadio(page, "Extrapancreatic Complications", "None");

      await page.locator('button:has-text("Calculate")').click();
      await expect(
        page.locator('p:has-text("CT Severity Index (CTSI): 0 points - Mild")'),
      ).toBeVisible();

      await page.screenshot({
        path: "test-results/screenshots/ct-pancreatitis-mild.png",
        fullPage: true,
      });
    });

    test("Screenshot: Severe pancreatitis (Grade E, >50% necrosis)", async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Time from symptom onset",
        "48-72 hours (optimal timing for CTSI)",
      );
      await selectRadio(
        page,
        "Balthazar CT Grade",
        "Grade E - ≥2 fluid collections or retroperitoneal gas (4 points)",
      );
      await selectRadio(
        page,
        "Pancreatic Necrosis Extent",
        ">50% necrosis (6 points)",
      );
      await selectRadio(
        page,
        "Extrapancreatic Complications",
        "One or more: Ascites, pleural effusion, vascular/GI complications",
      );

      await page.locator('button:has-text("Calculate")').click();
      await expect(
        page.locator(
          'p:has-text("CT Severity Index (CTSI): 10 points - Severe")',
        ),
      ).toBeVisible();

      await page.screenshot({
        path: "test-results/screenshots/ct-pancreatitis-severe.png",
        fullPage: true,
      });
    });
  });
});
