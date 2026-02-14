/**
 * Milan Criteria Calculator for HCC Liver Transplant Eligibility
 * Category: Hepatology/Liver
 *
 * Evaluates both Milan and UCSF (University of California San Francisco) criteria
 * for hepatocellular carcinoma patients considering liver transplantation.
 *
 * Milan Criteria (Mazzaferro et al., 1996):
 * - Single tumor ≤5 cm, OR
 * - 2-3 tumors each ≤3 cm
 * - NO macrovascular invasion
 * - NO extrahepatic disease
 *
 * UCSF Criteria (Yao et al., 2001):
 * - Single tumor ≤6.5 cm, OR
 * - 2-3 tumors with largest ≤4.5 cm AND total diameter ≤8 cm
 * - NO macrovascular invasion
 * - NO extrahepatic disease
 *
 * @references
 * - Mazzaferro V et al. N Engl J Med 1996;334:693-9 (PMID: 8594428)
 * - Yao FY et al. Hepatology 2001;33:1394-403 (PMID: 11391528)
 * - Mazzaferro V et al. Lancet Oncol 2009;10:35-43 (PMID: 19058754)
 * - Duffy JP et al. Ann Surg 2007;246(3):502-9 (PMID: 17717454)
 */

export const MilanCriteria = {
  id: "milan-criteria",
  category: "Hepatology/Liver",
  name: "Milan Criteria (HCC)",
  desc: "Liver transplant eligibility criteria for hepatocellular carcinoma patients",
  guidelineVersion: "Milan Criteria (Mazzaferro 1996)",
  keywords: ["liver transplant", "HCC", "transplant eligibility", "UCSF"],
  tags: ["Hepatology", "Oncology", "Transplant"],
  metaDesc:
    "Free Milan and UCSF Criteria Calculator for HCC. Assess liver transplant eligibility for hepatocellular carcinoma based on tumor size, number, and vascular invasion.",
  info: {
    text: "The Milan Criteria, established in 1996, define the standard for liver transplant eligibility in HCC patients. Meeting these criteria is associated with excellent post-transplant outcomes (>70% 4-year survival).\n\nThe expanded UCSF criteria offer a less restrictive alternative while maintaining good outcomes, with 5-year survival rates of approximately 75%.\n\nNote: Patients with 'unknown' vascular invasion or extrahepatic disease status should undergo further diagnostic workup before transplant candidacy determination.",
  },
  fields: [
    {
      id: "tumorCount",
      label: "Number of Tumors",
      type: "select",
      opts: ["1", "2", "3", "4 or more"],
    },
    {
      id: "tumor1Size",
      label: "Largest Tumor Diameter (cm)",
      type: "number",
      subLabel: "Required",
    },
    {
      id: "tumor2Size",
      label: "Second Tumor Diameter (cm)",
      type: "number",
      subLabel: "Required when 2+ tumors",
      showIf: (vals) => vals.tumorCount === "2" || vals.tumorCount === "3",
    },
    {
      id: "tumor3Size",
      label: "Third Tumor Diameter (cm)",
      type: "number",
      subLabel: "Required when 3 tumors",
      showIf: (vals) => vals.tumorCount === "3",
    },
    {
      id: "macrovascularInvasion",
      label: "Macrovascular Invasion",
      type: "radio",
      opts: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes" },
        { value: "unknown", label: "Unknown" },
      ],
    },
    {
      id: "extrahepaticDisease",
      label: "Extrahepatic Disease",
      type: "radio",
      opts: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes" },
        { value: "unknown", label: "Unknown" },
      ],
    },
  ],
  compute: (v) => {
    const {
      tumorCount = "",
      tumor1Size = "",
      tumor2Size = "",
      tumor3Size = "",
      macrovascularInvasion = "",
      extrahepaticDisease = "",
    } = v;

    // Parse tumor count
    const count = tumorCount === "4 or more" ? 4 : parseInt(tumorCount) || 0;

    // Parse tumor sizes
    const t1 = parseFloat(tumor1Size) || 0;
    const t2 = parseFloat(tumor2Size) || 0;
    const t3 = parseFloat(tumor3Size) || 0;

    // Validation
    if (!tumorCount || count === 0) {
      return { Error: "Please select the number of tumors" };
    }
    if (t1 <= 0) {
      return { Error: "Please enter the largest tumor diameter" };
    }
    // Validate tumor2Size is required when count is 2 or 3
    if ((count === 2 || count === 3) && t2 <= 0) {
      return { Error: "Please enter the second tumor diameter" };
    }
    // Validate tumor3Size is required when count is 3
    if (count === 3 && t3 <= 0) {
      return { Error: "Please enter the third tumor diameter" };
    }
    if (!macrovascularInvasion) {
      return { Error: "Please specify macrovascular invasion status" };
    }
    if (!extrahepaticDisease) {
      return { Error: "Please specify extrahepatic disease status" };
    }

    // Calculate total tumor diameter for multiple tumors
    // At this point, validation ensures all required tumor sizes are present
    const totalDiameter =
      count === 1 ? t1 : count === 2 ? t1 + t2 : t1 + t2 + t3;

    // Get largest tumor (should be t1, but verify)
    const largestTumor = Math.max(t1, t2, t3);

    // MILAN CRITERIA EVALUATION
    let milanMet = false;
    let milanReason = "";

    // Check for absolute contraindications first
    if (macrovascularInvasion === "yes") {
      milanMet = false;
      milanReason =
        "Macrovascular invasion present (absolute contraindication)";
    } else if (extrahepaticDisease === "yes") {
      milanMet = false;
      milanReason = "Extrahepatic disease present (absolute contraindication)";
    } else if (macrovascularInvasion === "unknown") {
      milanMet = false;
      milanReason =
        "Macrovascular invasion status unknown - further workup required";
    } else if (extrahepaticDisease === "unknown") {
      milanMet = false;
      milanReason =
        "Extrahepatic disease status unknown - further workup required";
    } else if (count === 1) {
      // Single tumor: must be ≤5 cm
      if (t1 <= 5) {
        milanMet = true;
        milanReason = `Single tumor ${t1.toFixed(1)} cm (≤5 cm required)`;
      } else {
        milanMet = false;
        milanReason = `Single tumor ${t1.toFixed(1)} cm exceeds 5 cm limit`;
      }
    } else if (count >= 2 && count <= 3) {
      // 2-3 tumors: each must be ≤3 cm
      const tumors = [t1, t2, t3].filter((t) => t > 0).slice(0, count);
      const maxTumor = Math.max(...tumors);

      if (maxTumor <= 3) {
        milanMet = true;
        milanReason = `${count} tumors, largest ${maxTumor.toFixed(1)} cm (each ≤3 cm required)`;
      } else {
        milanMet = false;
        milanReason = `${count} tumors, largest ${maxTumor.toFixed(1)} cm exceeds 3 cm limit`;
      }
    } else {
      // 4 or more tumors
      milanMet = false;
      milanReason = "4 or more tumors present (Milan limit: 1-3 tumors)";
    }

    // UCSF CRITERIA EVALUATION
    let ucsfMet = false;
    let ucsfReason = "";

    // Check absolute contraindications
    if (macrovascularInvasion === "yes") {
      ucsfMet = false;
      ucsfReason = "Macrovascular invasion present (absolute contraindication)";
    } else if (extrahepaticDisease === "yes") {
      ucsfMet = false;
      ucsfReason = "Extrahepatic disease present (absolute contraindication)";
    } else if (macrovascularInvasion === "unknown") {
      ucsfMet = false;
      ucsfReason =
        "Macrovascular invasion status unknown - further workup required";
    } else if (extrahepaticDisease === "unknown") {
      ucsfMet = false;
      ucsfReason =
        "Extrahepatic disease status unknown - further workup required";
    } else if (count === 1) {
      // Single tumor: must be ≤6.5 cm
      if (t1 <= 6.5) {
        ucsfMet = true;
        ucsfReason = `Single tumor ${t1.toFixed(1)} cm (≤6.5 cm required)`;
      } else {
        ucsfMet = false;
        ucsfReason = `Single tumor ${t1.toFixed(1)} cm exceeds 6.5 cm limit`;
      }
    } else if (count >= 2 && count <= 3) {
      // 2-3 tumors: largest ≤4.5 cm AND total ≤8 cm
      const tumors = [t1, t2, t3].filter((t) => t > 0).slice(0, count);
      const maxTumor = Math.max(...tumors);
      const total = tumors.reduce((sum, t) => sum + t, 0);

      if (maxTumor <= 4.5 && total <= 8) {
        ucsfMet = true;
        ucsfReason = `${count} tumors, largest ${maxTumor.toFixed(1)} cm, total ${total.toFixed(1)} cm (largest ≤4.5 cm and total ≤8 cm required)`;
      } else if (maxTumor > 4.5) {
        ucsfMet = false;
        ucsfReason = `${count} tumors, largest ${maxTumor.toFixed(1)} cm exceeds 4.5 cm limit`;
      } else {
        ucsfMet = false;
        ucsfReason = `${count} tumors, total diameter ${total.toFixed(1)} cm exceeds 8 cm limit`;
      }
    } else {
      // 4 or more tumors
      ucsfMet = false;
      ucsfReason = "4 or more tumors present (UCSF limit: 1-3 tumors)";
    }

    // Determine transplant eligibility and expected outcomes
    let eligibility = "";
    let expectedOutcome = "";

    if (milanMet) {
      eligibility = "ELIGIBLE - Meets Milan Criteria (standard)";
      expectedOutcome =
        "Expected 4-year survival >70% (Mazzaferro 1996), 5-year recurrence-free survival 83% (Mazzaferro 2009 validation)";
    } else if (ucsfMet) {
      eligibility = "ELIGIBLE - Meets UCSF Criteria (expanded)";
      expectedOutcome =
        "Expected 5-year survival ~75% (Yao 2001), though not meeting standard Milan criteria";
    } else if (
      macrovascularInvasion === "unknown" ||
      extrahepaticDisease === "unknown"
    ) {
      eligibility = "INDETERMINATE - Further diagnostic workup required";
      expectedOutcome =
        "Cannot determine eligibility until vascular invasion and extrahepatic disease status are clarified";
    } else {
      eligibility = "NOT ELIGIBLE - Beyond both Milan and UCSF criteria";
      expectedOutcome =
        "Consider alternative treatments (ablation, TACE, systemic therapy). Down-staging protocols may be available at some centers.";
    }

    // Build results object
    const results = {
      "Number of Tumors": count === 4 ? "4 or more" : count.toString(),
      "Largest Tumor Diameter": `${largestTumor.toFixed(1)} cm`,
    };

    if (count >= 2) {
      results["Total Tumor Diameter"] = `${totalDiameter.toFixed(1)} cm`;
    }

    results["Macrovascular Invasion"] =
      macrovascularInvasion.charAt(0).toUpperCase() +
      macrovascularInvasion.slice(1);
    results["Extrahepatic Disease"] =
      extrahepaticDisease.charAt(0).toUpperCase() +
      extrahepaticDisease.slice(1);
    results[""] = ""; // Spacer
    results["Milan Criteria"] = milanMet
      ? "WITHIN CRITERIA"
      : "BEYOND CRITERIA";
    results["Milan Details"] = milanReason;
    results[" "] = ""; // Spacer
    results["UCSF Criteria"] = ucsfMet ? "WITHIN CRITERIA" : "BEYOND CRITERIA";
    results["UCSF Details"] = ucsfReason;
    results["  "] = ""; // Spacer
    results["Transplant Eligibility"] = eligibility;
    results["Expected Outcomes"] = expectedOutcome;

    results._severity = milanMet ? "success" : ucsfMet ? "warning" : "danger";

    return results;
  },
  refs: [
    {
      t: "Mazzaferro V et al. N Engl J Med 1996;334:693-9 - Original Milan Criteria",
      u: "https://pubmed.ncbi.nlm.nih.gov/8594428/",
    },
    {
      t: "Yao FY et al. Hepatology 2001;33:1394-403 - UCSF Expanded Criteria",
      u: "https://pubmed.ncbi.nlm.nih.gov/11391528/",
    },
    {
      t: "Mazzaferro V et al. Lancet Oncol 2009;10:35-43 - Milan Criteria Validation",
      u: "https://pubmed.ncbi.nlm.nih.gov/19058754/",
    },
    {
      t: "Duffy JP et al. Ann Surg 2007;246(3):502-9 - UCSF vs Milan Outcomes",
      u: "https://pubmed.ncbi.nlm.nih.gov/17717454/",
    },
  ],
};
