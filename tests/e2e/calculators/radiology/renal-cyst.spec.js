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
    scopeEligibility: "eligible",
    solidComponent: "under25",
    wellDefined: "yes",
    wall: "thin",
    wallEnhancement: "absent",
    septaCount: "none",
    septaThickness: null,
    septaEnhancement: null,
    nodule: "none",
    noduleEnhancement: null,
    calcifications: "absent",
    density: "water",
    hyperattenuatingSize: "atMost3",
    ...overrides,
  };

  await choose(page, "scopeEligibility", values.scopeEligibility);
  await choose(page, "solidComponent", values.solidComponent);
  await choose(page, "wellDefined", values.wellDefined);
  await choose(page, "wall", values.wall);
  await choose(page, "wallEnhancement", values.wallEnhancement);
  await choose(page, "septaCount", values.septaCount);
  if (values.septaCount !== "none" && values.septaThickness) {
    await choose(page, "septaThickness", values.septaThickness);
    await choose(page, "septaEnhancement", values.septaEnhancement);
  }
  await choose(page, "nodule", values.nodule);
  if (values.nodule !== "none") {
    await choose(page, "noduleEnhancement", values.noduleEnhancement);
  }
  await choose(page, "calcifications", values.calcifications);
  await choose(page, "density", values.density);
  if (values.density === "hyperattenuating70") {
    await choose(page, "hyperattenuatingSize", values.hyperattenuatingSize);
  }
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
    await expect(infoPanel).toContainText(
      "infectious, inflammatory, or vascular etiologies and necrotic solid masses are excluded",
    );
    await expect(infoPanel).toContainText(
      "not patients with a known or suspected renal cell carcinoma syndrome",
    );
    await expect(infoPanel).toContainText("Version history");
    await expect(infoPanel).toContainText("2/3/4 mm");
    await expect(infoPanel).toContainText("10.1148/radiol.2019182646");
  });

  test("should display v2019 fields and remove the 2005 intrarenal/automatic-size upgrade", async ({
    page,
  }) => {
    await expect(
      page.getByText("Bosniak v2019 eligibility", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Enhancing-tissue proportion", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Mass definition", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Wall thickness / morphology", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Septa count", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Convex protrusion / nodule morphology", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Calcifications", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("CT attenuation characterization", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Wall enhancement", { exact: true }),
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
      septaEnhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: II");
    await expect(results).toContainText(
      "v2019 Term: Benign Bosniak II renal cyst",
    );
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

  test("should require MRI before assigning a large or size-uncertain hyperattenuating mass", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      density: "hyperattenuating70",
      hyperattenuatingSize: "over3OrUncertain",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not assigned");
    await expect(results).toContainText("larger than 3 cm");
    await expect(results).toContainText("renal mass protocol MRI");
    await expect(results).not.toContainText("No follow-up required");
  });

  test("should defer a heterogeneous nonenhancing mass despite benign II features", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      septaCount: "few",
      septaThickness: "thin",
      septaEnhancement: "absent",
      calcifications: "present",
      density: "heterogeneousOrIncomplete",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not assigned");
    await expect(results).toContainText(
      "heterogeneous or otherwise incompletely characterized",
    );
    await expect(results).toContainText("renal mass protocol MRI");
    await expect(results).not.toContainText("No follow-up required");
  });

  for (const wall of ["minimallyThick", "thick"]) {
    test(`should require MRI for heterogeneous CT attenuation despite an enhancing ${wall} wall`, async ({
      page,
    }) => {
      await fillBaseBosniakV2019(page, {
        wall,
        wallEnhancement: "present",
        density: "heterogeneousOrIncomplete",
      });

      await page.getByRole("button", { name: "Calculate" }).click();

      const results = resultPanel(page);
      await expect(results).toContainText("Bosniak Category: Not assigned");
      await expect(results).toContainText(
        "heterogeneous or otherwise incompletely characterized",
      );
      await expect(results).toContainText("renal mass protocol MRI");
      await expect(results).not.toContainText("Bosniak Category: IIF");
      await expect(results).not.toContainText("Bosniak Category: III");
    });
  }

  for (const [wall, expectedCategory] of [
    ["minimallyThick", "IIF"],
    ["thick", "III"],
  ]) {
    test(`should assign ${expectedCategory} from definite wall enhancement despite other attenuation`, async ({
      page,
    }) => {
      await fillBaseBosniakV2019(page, {
        wall,
        wallEnhancement: "present",
        density: "otherCharacterized",
      });

      await page.getByRole("button", { name: "Calculate" }).click();

      const results = resultPanel(page);
      await expect(results).toContainText(`Bosniak Category: ${expectedCategory}`);
      await expect(results).not.toContainText("Bosniak Category: Not assigned");
    });

    test(`should assign ${expectedCategory} from definite wall enhancement in a large hyperattenuating mass`, async ({
      page,
    }) => {
      await fillBaseBosniakV2019(page, {
        wall,
        wallEnhancement: "present",
        density: "hyperattenuating70",
        hyperattenuatingSize: "over3OrUncertain",
      });

      await page.getByRole("button", { name: "Calculate" }).click();

      const results = resultPanel(page);
      await expect(results).toContainText(`Bosniak Category: ${expectedCategory}`);
      await expect(results).not.toContainText("Bosniak Category: Not assigned");
    });
  }

  test("should require a well-defined mass before assigning Bosniak IIF", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wellDefined: "no",
      wall: "minimallyThick",
      wallEnhancement: "present",
      density: "otherCharacterized",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not assigned");
    await expect(results).toContainText("IIF requires a well-defined");
    await expect(results).not.toContainText("Bosniak Category: IIF");
  });

  for (const [density, expectedText] of [
    ["renalMassNonenhancing", "non-enhancing >20 HU at renal mass protocol CT"],
    ["portalVenous21to30", "21-30 HU at portal venous phase CT"],
    ["tooSmallLowAttenuation", "low-attenuation mass too small to characterize"],
  ]) {
    test(`should classify ${density} benign CT subtype as Bosniak II`, async ({ page }) => {
      await fillBaseBosniakV2019(page, { density });

      await page.getByRole("button", { name: "Calculate" }).click();

      const results = resultPanel(page);
      await expect(results).toContainText("Bosniak Category: II");
      await expect(results).toContainText(expectedText);
      await expect(results).toContainText(
        "v2019 Term: Likely benign Bosniak II renal mass",
      );
    });
  }

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

  test("should not let calcification override a nonenhancing thick wall", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wall: "thick",
      calcifications: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not assigned");
    await expect(results).toContainText(
      "Bosniak II requires a well-defined thin (≤2 mm), smooth wall",
    );
    await expect(results).toContainText("renal mass protocol MRI");
  });

  test("should require MRI for many thin septa without confirmed enhancement", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      septaCount: "many",
      septaThickness: "thin",
      septaEnhancement: "absent",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not assigned");
    await expect(results).toContainText(
      "selected many (≥4), 3 mm, thick or irregular septum is not confirmed to enhance",
    );
  });

  test("should not treat a protrusion without confirmed enhancement as benign", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      nodule: "obtuse4",
      noduleEnhancement: "absent",
      calcifications: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not assigned");
    await expect(results).toContainText(
      "selected protrusion is not confirmed to enhance",
    );
  });

  test("should classify many thin enhancing septa as Bosniak IIF", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      septaCount: "many",
      septaThickness: "thin",
      septaEnhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: IIF");
    await expect(results).toContainText(
      "Probably benign cystic mass",
    );
    await expect(results).toContainText(
      "Generally follow with imaging at 6 months and 12 months, then annually for a total of 5 years",
    );
  });

  test("should classify a minimally thick enhancing wall as Bosniak IIF", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wall: "minimallyThick",
      wallEnhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: IIF");
    await expect(results).toContainText("Enhancing 3 mm smooth wall");
  });

  test("should classify thick enhancing wall as Bosniak III", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wall: "thick",
      wallEnhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: III");
    await expect(results).toContainText("Indeterminate cystic mass");
    await expect(results).toContainText("Consider urology consultation");
  });

  test("should classify an irregular enhancing wall as Bosniak III", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wall: "irregular",
      wallEnhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: III");
    await expect(results).toContainText("irregular wall/septa");
  });

  test("should classify enhancing acute-margin nodule as Bosniak IV", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      nodule: "acuteAny",
      noduleEnhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: IV");
    await expect(results).toContainText(
      "Cystic mass, highly suspicious for malignancy",
    );
    await expect(results).toContainText("acute margins");
  });

  test("should classify an enhancing >=4 mm obtuse-margin nodule as Bosniak IV", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      nodule: "obtuse4",
      noduleEnhancement: "present",
      calcifications: "present",
      density: "hyperattenuating70",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: IV");
    await expect(results).toContainText(
      "Enhancing >=4 mm convex protrusion with obtuse margins",
    );
  });

  test("should preserve confirmed Bosniak IV when unrelated lower features are nonenhancing", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wall: "thick",
      wallEnhancement: "absent",
      septaCount: "many",
      septaThickness: "thick",
      septaEnhancement: "absent",
      nodule: "acuteAny",
      noduleEnhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: IV");
    await expect(results).toContainText("Enhancing nodule with acute margins");
    await expect(results).not.toContainText("Bosniak Category: Not assigned");
  });

  test("should not assign Bosniak I or II when the mass is not well defined", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wellDefined: "no",
      calcifications: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not assigned");
    await expect(results).toContainText(
      "Bosniak I and II require a well-defined mass",
    );
    await expect(results).not.toContainText("Bosniak Category: II");
  });

  test("should gate masses with approximately one-quarter enhancing tissue", async ({
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
    await expect(results).toContainText(
      "approximately one-quarter or more of the mass is enhancing tissue",
    );
  });

  test("should not let enhancing septa upgrade an unrelated nonenhancing thick wall", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wall: "thick",
      wallEnhancement: "absent",
      septaCount: "few",
      septaThickness: "thin",
      septaEnhancement: "present",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not assigned");
    await expect(results).toContainText("thick or irregular wall is not confirmed to enhance");
    await expect(results).not.toContainText("Bosniak Category: III");
  });

  test("should not let wall enhancement upgrade unrelated nonenhancing thick septa", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wallEnhancement: "present",
      septaCount: "few",
      septaThickness: "thick",
      septaEnhancement: "absent",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not assigned");
    await expect(results).toContainText("thick or irregular septum is not confirmed to enhance");
    await expect(results).not.toContainText("Bosniak Category: III");
  });

  test("should not let wall enhancement turn an unrelated nonenhancing protrusion into category IV", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      wall: "thick",
      wallEnhancement: "present",
      nodule: "acuteAny",
      noduleEnhancement: "absent",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not assigned");
    await expect(results).toContainText("selected protrusion is not confirmed to enhance");
    await expect(results).not.toContainText("Bosniak Category: IV");
  });

  test("should not apply Bosniak before alternative etiologies and necrotic solid masses are excluded", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      scopeEligibility: "notExcluded",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not applicable");
    await expect(results).toContainText(
      "infectious, inflammatory, or vascular etiologies and necrotic solid masses are excluded",
    );
  });

  test("should not apply general-population Bosniak management to a hereditary RCC syndrome", async ({
    page,
  }) => {
    await fillBaseBosniakV2019(page, {
      scopeEligibility: "hereditaryRccSyndrome",
    });

    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultPanel(page);
    await expect(results).toContainText("Bosniak Category: Not applicable");
    await expect(results).toContainText("hereditary renal cell carcinoma syndrome");
    await expect(results).toContainText("general population");
    await expect(results).toContainText("syndrome-specific");
    await expect(results).not.toContainText("No follow-up required");
  });
});
