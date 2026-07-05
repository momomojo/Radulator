/**
 * E2E Test Suite: Renal Cyst (Bosniak Classification) Calculator
 *
 * Tests Bosniak Classification, version 2019 CT criteria for cystic renal
 * masses, including categories that intentionally changed from 2005 logic.
 *
 * @see https://doi.org/10.1148/radiol.2019182646 - Silverman SG Radiology 2019
 * @see https://doi.org/10.1148/radiol.2362040218 - Bosniak MA Radiology 2005
 */

import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const resultPanel = (page) =>
  page.getByRole("status", { name: "Calculator results" });

async function choose(page, name, value) {
  await page.locator(`input[name="${name}"][value="${value}"]`).click();
}

async function fillBaseBosniakV2019(page, overrides = {}) {
  const values = {
    solidComponent: "under25",
    wall: "thin",
    septaCount: "none",
    septaThickness: null,
    nodule: "none",
    calcifications: "absent",
    density: "water",
    enhancement: "absent",
    ...overrides,
  };

  await choose(page, "solidComponent", values.solidComponent);
  await choose(page, "wall", values.wall);
  await choose(page, "septaCount", values.septaCount);
  if (values.septaCount !== "none" && values.septaThickness) {
    await choose(page, "septaThickness", values.septaThickness);
  }
  await choose(page, "nodule", values.nodule);
  await choose(page, "calcifications", values.calcifications);
  await choose(page, "density", values.density);
  await choose(page, "enhancement", values.enhancement);
}

test.describe("Renal Cyst (Bosniak Classification) Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Bosniak Classification (Renal Cysts)");
    await expect(
      page.getByRole("heading", {
        name: "Bosniak Classification (Renal Cysts)",
        level: 2,
      }),
    ).toBeVisible();
  });

  test("should display calculator title, v2019 badge, and description", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", {
        name: "Bosniak Classification (Renal Cysts)",
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Classify cystic renal masses using Bosniak Classification, version 2019 CT criteria.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("guideline-badge")).toHaveText(
      "Bosniak v2019",
    );
  });

  test("should display v2019 education and clinical guidance", async ({
    page,
  }) => {
    const infoPanel = page.getByTestId("calculator-info");
    await expect(infoPanel).toBeVisible();
    await expect(infoPanel).toContainText(
      "less than approximately 25% enhancing tissue",
    );
    await expect(infoPanel).toContainText("Version history");
    await expect(infoPanel).toContainText("2/3/4 mm");
    await expect(infoPanel).toContainText("10.1148/radiol.2019182646");
  });

  test("should display v2019 fields and remove 2005 intrarenal/size criteria", async ({
    page,
  }) => {
    await expect(
      page.getByText("Enhancing solid component", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Wall thickness / morphology", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Septa count", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Enhancing nodule morphology", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Calcifications", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Homogeneous CT density subtype", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Wall, septal, or nodule enhancement", { exact: true }),
    ).toBeVisible();

    await expect(page.getByText("Totally intrarenal")).toHaveCount(0);
    await expect(page.getByText("3cm or larger")).toHaveCount(0);
  });

  test("should display references section with v2019 and 2005 DOI links", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "References", level: 3 }),
    ).toBeVisible();

    const silvermanRef = page.getByRole("link", {
      name: /Silverman SG.*Version 2019/,
    });
    await expect(silvermanRef).toBeVisible();
    await expect(silvermanRef).toHaveAttribute(
      "href",
      "https://doi.org/10.1148/radiol.2019182646",
    );

    const bosniakRef = page.getByRole("link", {
      name: "Bosniak MA Radiology 2005",
    });
    await expect(bosniakRef).toBeVisible();
    await expect(bosniakRef).toHaveAttribute(
      "href",
      "https://doi.org/10.1148/radiol.2362040218",
    );
  });

  test("should classify simple cyst as Bosniak I", async ({ page }) => {
    await fillBaseBosniakV2019(page);

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toBeVisible();
    await expect(results).toContainText("Bosniak Category: I");
    await expect(results).toContainText("v2019 Term: Benign simple cyst");
    await expect(results).toContainText("Management: No follow-up required");
  });

  test("should classify few thin septa as Bosniak II", async ({ page }) => {
    await fillBaseBosniakV2019(page, {
      septaCount: "few",
      septaThickness: "thin",
      enhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: II");
    await expect(results).toContainText("v2019 Term: Benign cystic mass");
    await expect(results).toContainText("few (1-3) thin septa");
  });

  test("should classify homogeneous high-attenuation cyst as Bosniak II", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      density: "hyperattenuating70",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: II");
    await expect(results).toContainText(
      "homogeneous >=70 HU at noncontrast CT",
    );
    await expect(results).toContainText("Management: No follow-up required");
  });

  test("should classify calcifications-only case as Bosniak II", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      calcifications: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: II");
    await expect(results).toContainText("calcification of any morphology");
    await expect(results).toContainText("Management: No follow-up required");
  });

  test("should classify many thin enhancing septa as Bosniak IIF", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      septaCount: "many",
      septaThickness: "thin",
      enhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: IIF");
    await expect(results).toContainText(
      "Probably benign cystic mass",
    );
    await expect(results).toContainText("Follow-up imaging at 6 months");
  });

  test("should classify thick enhancing wall as Bosniak III", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wall: "thick",
      enhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: III");
    await expect(results).toContainText("Indeterminate cystic mass");
    await expect(results).toContainText("Consider urology consultation");
  });

  test("should classify enhancing acute-margin nodule as Bosniak IV", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      nodule: "acuteAny",
      enhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: IV");
    await expect(results).toContainText(
      "Cystic mass, highly suspicious for malignancy",
    );
    await expect(results).toContainText("acute margins");
  });

  test("should gate masses with >25% enhancing solid tissue", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      solidComponent: "over25",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not applicable");
    await expect(results).toContainText(
      "Not a Bosniak-classifiable cystic renal mass",
    );
    await expect(results).toContainText(">25% enhancing solid tissue");
  });
});
