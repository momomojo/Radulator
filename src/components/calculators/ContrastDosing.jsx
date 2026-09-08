/**
 * IV Contrast Dosing Calculator
 * Iodinated Contrast Media Dosing for CT Studies
 *
 * Calculates weight-based contrast dosing with lean body weight adjustment,
 * iodine delivery rate, and renal-safety context based on eGFR, AKI, and
 * dialysis status.
 *
 * Primary Sources:
 * - ACR Manual on Contrast Media 2026
 * - ESUR Guidelines on Contrast Media Version 10.0
 * - Davenport MS, et al. Radiology. 2020;294(3):660-668 (ACR/NKF Consensus)
 * - de Bucourt M, et al. Insights Imaging. 2020;11:117 (LBW-based dosing)
 */

export const ContrastDosing = {
  id: "contrast-dosing",
  category: "Radiology",
  name: "IV Contrast Dosing",
  desc: "Iodinated contrast protocol-planning aid for CT with renal-safety context",
  keywords: ["iodine", "contrast media", "IV contrast", "iohexol", "iodixanol"],
  tags: ["Radiology", "Safety"],
  guidelineVersion: "ACR Manual on Contrast Media 2026 (renal safety and warming context)",
  metaDesc:
    "Free IV contrast protocol-planning aid for CT. Weight-based iodinated contrast dosing with lean body weight adjustment, iodine delivery rate (IDR), and eGFR/AKI/dialysis renal-safety context.",

  info: {
    text: `This calculator provides iodinated contrast protocol-planning support for CT imaging, with renal-safety and warming context from the ACR Manual on Contrast Media 2026.

The study-type iodine targets, volume cap, IV-access flow ranges, and saline-flush volume are encoded planning defaults, not universal ACR requirements. Confirm the diagnostic protocol, catheter and power-injector limits, contrast labeling, and institutional policy before administration.

Key Features:
• Weight-based dosing with lean body weight (LBW) adjustment for BMI ≥30
• Iodine Delivery Rate (IDR) calculation based on flow rate and concentration
• eGFR, AKI, and dialysis-specific renal-safety pathways
• Encoded IV-access flow ranges with device and protocol verification reminders
• Saline flush volume recommendations

Dosing Approach:
• Standard TBW dosing: 300-550 mg I/kg based on study type
• LBW dosing (obese patients): 630 mg I/kg using Boer formula
• IDR targets: 1.0-2.0 g I/s depending on application

ACR 2026 renal-safety boundaries for IV iodinated contrast:
• Stable eGFR ≥30: prophylaxis is not indicated for the general population
• Stable eGFR 30-44: prophylaxis may be considered only in individual high-risk circumstances
• AKI or stable eGFR <30: individualized risk-benefit assessment and isotonic IV volume expansion when appropriate
• Before volume expansion, assess heart failure and other hypervolemic conditions

Acute reactions require an emergency response protocol; use the official ACR adult or pediatric reaction card linked in References. This dosing aid does not manage an acute reaction.`,
    link: {
      label: "View ACR Manual on Contrast Media",
      url: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/ACR-Manual-on-Contrast-Media.pdf",
    },
  },

  fields: [
    // SECTION 1: PATIENT DEMOGRAPHICS
    {
      id: "weight_unit",
      label: "Weight Unit",
      type: "radio",
      opts: [
        { value: "kg", label: "Kilograms (kg)" },
        { value: "lbs", label: "Pounds (lbs)" },
      ],
    },
    {
      id: "weight",
      label: "Patient Weight",
      type: "number",
      subLabel: "Enter weight in selected unit",
    },
    {
      id: "height_unit",
      label: "Height Unit",
      type: "radio",
      opts: [
        { value: "cm", label: "Centimeters (cm)" },
        { value: "in", label: "Inches (in)" },
      ],
    },
    {
      id: "height",
      label: "Patient Height",
      type: "number",
      subLabel: "Enter height in selected unit",
    },
    {
      id: "sex",
      label: "Sex",
      type: "radio",
      opts: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
    },

    // SECTION 2: RENAL FUNCTION
    {
      id: "egfr",
      label: "eGFR",
      type: "number",
      subLabel: "mL/min/1.73m² when known; eGFR is not reliable for AKI risk stratification",
    },
    {
      id: "renal_status",
      label: "Renal Function Status",
      type: "radio",
      opts: [
        { value: "stable", label: "Stable renal function / no known AKI" },
        { value: "aki", label: "Known or suspected AKI" },
        {
          value: "dialysis_residual",
          label:
            "Maintenance dialysis with residual kidney function or uncertain urine output",
        },
        {
          value: "dialysis_anuric",
          label: "Anuric maintenance dialysis without a functioning transplant",
        },
        { value: "unknown", label: "Unknown / not assessed" },
      ],
    },
    {
      id: "volume_expansion_risk",
      label: "IV Volume Expansion Safety",
      type: "radio",
      subLabel:
        "Assess before prophylaxis; volume expansion can be harmful in heart failure or hypervolemia",
      showIf: (vals) =>
        vals.renal_status === "aki" ||
        vals.renal_status === "dialysis_residual" ||
        (vals.renal_status === "stable" &&
          vals.egfr !== "" &&
          Number.isFinite(Number(vals.egfr)) &&
          Number(vals.egfr) >= 0 &&
          Number(vals.egfr) < 30),
      opts: [
        {
          value: "none_known",
          label: "No known heart failure or hypervolemic condition",
        },
        {
          value: "heart_failure_or_hypervolemia",
          label: "Heart failure, hypervolemia, or uncertain volume tolerance",
        },
        { value: "uncertain", label: "Not yet assessed" },
      ],
    },

    // SECTION 3: CONTRAST SELECTION
    {
      id: "contrast_agent",
      label: "Contrast Agent / Concentration",
      type: "select",
      opts: [
        { value: "300", label: "Iohexol/Iopamidol 300 mg I/mL (Standard CT)" },
        { value: "320", label: "Iodixanol 320 mg I/mL (IOCM)" },
        { value: "350", label: "Iohexol/Iopamidol 350 mg I/mL (Enhanced CT)" },
        { value: "370", label: "Iopromide/Ioversol 370 mg I/mL (CTA)" },
      ],
    },

    // SECTION 4: STUDY TYPE
    {
      id: "study_type",
      label: "Study Type",
      type: "select",
      opts: [
        { value: "routine", label: "Routine Enhanced CT (400 mg I/kg)" },
        { value: "hepatic", label: "Hepatic/Solid Organ CT (550 mg I/kg)" },
        { value: "cta", label: "CT Angiography (350 mg I/kg)" },
        { value: "coronary", label: "Coronary CTA (300 mg I/kg)" },
        { value: "multiphase", label: "Multiphase CT (500 mg I/kg)" },
      ],
    },

    // SECTION 5: IV ACCESS
    {
      id: "iv_access",
      label: "IV Access Type",
      type: "select",
      subLabel:
        "Encoded planning defaults only; verify catheter, injection site, power-injector labeling, and local protocol",
      opts: [
        { value: "18g", label: "Peripheral 18G (max 5+ mL/s)" },
        { value: "20g", label: "Peripheral 20G (max 3-5 mL/s)" },
        { value: "22g", label: "Peripheral 22G (max 5 mL/s antecubital)" },
        { value: "22g_hand", label: "22G Hand/Wrist (max 1.5 mL/s)" },
        { value: "power_port", label: "Power Port (max 5 mL/s)" },
        { value: "central", label: "Central Line (per manufacturer specs)" },
      ],
    },
  ],

  compute: (vals) => {
    const {
      weight_unit = "kg",
      weight = "",
      height_unit = "cm",
      height = "",
      sex = "",
      egfr = "",
      renal_status = "",
      volume_expansion_risk = "",
      contrast_agent = "",
      study_type = "",
      iv_access = "",
    } = vals;

    // Validate required fields
    if (!weight || !height || !sex) {
      return {
        Error:
          "Please enter patient weight, height, and sex to calculate contrast dosing.",
      };
    }

    if (!contrast_agent || !study_type || !iv_access) {
      return {
        Error:
          "Please select contrast agent, study type, and IV access to calculate dosing.",
      };
    }

    // Convert units to metric
    const weightKg =
      weight_unit === "lbs"
        ? parseFloat(weight) * 0.453592
        : parseFloat(weight);

    const heightCm =
      height_unit === "in" ? parseFloat(height) * 2.54 : parseFloat(height);

    // Validate numeric values
    if (isNaN(weightKg) || weightKg <= 0 || isNaN(heightCm) || heightCm <= 0) {
      return {
        Error: "Please enter valid positive values for weight and height.",
      };
    }

    // Calculate BMI
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);

    // Calculate Lean Body Weight using Boer formula
    // Boer formula is recommended for obese patients per research
    let lbw;
    if (sex === "male") {
      lbw = 0.407 * weightKg + 0.267 * heightCm - 19.2;
    } else {
      lbw = 0.252 * weightKg + 0.473 * heightCm - 48.3;
    }

    // Ensure LBW is reasonable (not negative or greater than total weight)
    lbw = Math.max(lbw, weightKg * 0.4);
    lbw = Math.min(lbw, weightKg);

    // Determine iodine dose based on study type (mg I/kg)
    const iodineDoseMap = {
      routine: 400,
      hepatic: 550,
      cta: 350,
      coronary: 300,
      multiphase: 500,
    };
    const targetIodineDosePerKg = iodineDoseMap[study_type];

    // Get contrast concentration
    const concentration = parseInt(contrast_agent);

    // Determine which weight to use for dosing
    // Use LBW for BMI >= 30 per de Bucourt et al. 2020
    const useObese = bmi >= 30;
    const dosingWeight = useObese ? lbw : weightKg;
    const dosingBasis = useObese ? "LBW (BMI ≥30)" : "Total Body Weight";

    // For obese patients, use 630 mg I/kg LBW as per research
    const effectiveIodineDosePerKg = useObese ? 630 : targetIodineDosePerKg;

    // Calculate total iodine dose and contrast volume
    const totalIodineDose = effectiveIodineDosePerKg * dosingWeight;
    let contrastVolume = totalIodineDose / concentration;

    // Apply maximum volume cap (150 mL for routine)
    const maxVolume = 150;
    const volumeCapped = contrastVolume > maxVolume;
    if (volumeCapped) {
      contrastVolume = maxVolume;
    }

    // Determine flow rate based on IV access and study type
    const flowRateMap = {
      "18g": { min: 4, max: 6 },
      "20g": { min: 3, max: 5 },
      "22g": { min: 3, max: 5 },
      "22g_hand": { min: 1, max: 1.5 },
      power_port: { min: 4, max: 5 },
      central: { min: 2, max: 4 },
    };

    const studyFlowMap = {
      routine: { min: 2, max: 3 },
      hepatic: { min: 4, max: 5 },
      cta: { min: 4, max: 5 },
      coronary: { min: 4, max: 5 },
      multiphase: { min: 3, max: 4 },
    };

    const ivFlow = flowRateMap[iv_access];
    const studyFlow = studyFlowMap[study_type];

    // Use the minimum of IV capacity and study requirement
    const recommendedFlowMin = Math.min(ivFlow.min, studyFlow.max);
    const recommendedFlowMax = Math.min(ivFlow.max, studyFlow.max);
    const recommendedFlow = (recommendedFlowMin + recommendedFlowMax) / 2;

    // Calculate Iodine Delivery Rate (IDR)
    // IDR (g I/s) = [Concentration (mg I/mL) / 1000] × Flow Rate (mL/s)
    const idr = (concentration / 1000) * recommendedFlow;

    // Calculate injection duration
    const injectionDuration = contrastVolume / recommendedFlow;

    // Calculate saline flush volume (typically 20-50 mL at same rate)
    const salineFlush = 30; // Standard 30 mL saline flush

    const egfrProvided = egfr !== "" && egfr !== null && egfr !== undefined;
    const egfrValue = parseFloat(egfr);
    if (egfrProvided && (isNaN(egfrValue) || egfrValue < 0)) {
      return { Error: "Please enter a non-negative eGFR value or leave it blank." };
    }

    // Renal-safety context from ACR Manual on Contrast Media 2026.
    let renalContext = "";
    let renalRecommendation = "";
    let volumeExpansionSafety = "";
    let diagnosticDoseNote = "";
    let higherRiskRenalPathway = false;
    let warnings = [];

    if (renal_status === "aki") {
      higherRiskRenalPathway = true;
      renalContext =
        "Known or suspected AKI: eGFR is unreliable for AKI risk stratification. Iodinated contrast is a relative, not absolute, concern; proceed only when the expected diagnostic benefit outweighs the renal risk.";
      renalRecommendation =
        "IV isotonic volume expansion is indicated when clinically feasible; 0.9% normal saline is preferred, but the ideal infusion rate and volume are unknown. Use an individualized institutional regimen.";
    } else if (renal_status === "dialysis_anuric") {
      renalContext =
        "Anuric end-stage kidney disease on maintenance dialysis without a functioning transplant is not at risk for further renal injury from iodinated contrast. Confirm true anuria and consider volume/osmotic load.";
      renalRecommendation =
        "Prophylaxis is not indicated for contrast-induced acute kidney injury (CI-AKI) prevention in anuric maintenance dialysis.";
    } else if (renal_status === "dialysis_residual") {
      higherRiskRenalPathway = true;
      renalContext =
        "Maintenance dialysis with residual kidney function or uncertain urine output should be managed as a higher-risk renal state because loss of residual function remains possible.";
      renalRecommendation =
        "Use an individualized risk-benefit assessment and determine whether isotonic volume expansion is appropriate with the treating team.";
    } else if (renal_status === "stable" && egfrProvided) {
      if (egfrValue >= 45) {
        renalContext =
          `Stable eGFR ${egfrValue} mL/min/1.73m²: IV iodinated contrast is not an independent nephrotoxic risk factor at eGFR ≥45.`;
        renalRecommendation =
          "Prophylaxis is not indicated for the general population with stable eGFR ≥30.";
      } else if (egfrValue >= 30) {
        renalContext =
          `Stable eGFR ${egfrValue} mL/min/1.73m²: IV iodinated contrast is either not nephrotoxic or rarely so in the 30-44 range.`;
        renalRecommendation =
          "Prophylaxis is not indicated for the general population with stable eGFR ≥30. It may be considered only in individual high-risk circumstances such as numerous risk factors, recent AKI, or borderline eGFR.";
      } else {
        higherRiskRenalPathway = true;
        renalContext =
          `Stable eGFR ${egfrValue} mL/min/1.73m² is within the higher-risk <30 threshold. Contrast concern is relative, not absolute; weigh diagnostic benefit, alternatives, and renal risk.`;
        renalRecommendation =
          "IV isotonic volume expansion is indicated when clinically feasible; 0.9% normal saline is preferred, but the ideal infusion rate and volume are unknown. Use an individualized institutional regimen.";
      }
    } else if (renal_status === "stable") {
      renalContext =
        "Stable renal function was selected, but no eGFR was entered; the ACR eGFR threshold pathway cannot be assigned.";
      renalRecommendation =
        "Use the current renal assessment required by institutional screening policy when clinically indicated.";
    } else if (egfrProvided || renal_status === "unknown") {
      renalContext =
        "Renal function stability and AKI status are unknown. A single eGFR does not determine the appropriate prophylaxis pathway.";
      renalRecommendation =
        "Assess for AKI, severe CKD, dialysis/residual kidney function, and volume-expansion risk before applying renal-safety guidance.";
    }

    if (higherRiskRenalPathway) {
      diagnosticDoseNote =
        "Do not reduce the diagnostic contrast dose solely to mitigate CI-AKI risk. If IV contrast is clinically necessary, use a standard diagnostic dose after individualized risk-benefit assessment.";
      if (volume_expansion_risk === "none_known") {
        volumeExpansionSafety =
          "No known heart failure or hypervolemic condition was selected; apply the institutional isotonic-fluid protocol and monitor volume tolerance.";
      } else if (volume_expansion_risk === "heart_failure_or_hypervolemia") {
        volumeExpansionSafety =
          "Heart failure or hypervolemia may make volume expansion harmful; individualize or defer prophylaxis with the responsible clinical team before initiation.";
      } else {
        volumeExpansionSafety =
          "Assess volume tolerance, including heart failure and other hypervolemic conditions, before volume expansion.";
      }
    }

    // Additional warnings
    if (volumeCapped) {
      warnings.push(
        `Volume capped at ${maxVolume} mL (calculated: ${Math.round(totalIodineDose / concentration)} mL)`,
      );
    }

    if (iv_access === "22g_hand") {
      warnings.push(
        "Hand/wrist IV: Flow rate limited to 1.5 mL/s - may be suboptimal for CTA protocols",
      );
    }

    // IDR assessment based on study type
    let idrAssessment = "";
    if (study_type === "cta" || study_type === "coronary") {
      if (idr < 1.5) {
        idrAssessment = "Below optimal for CTA (target: 1.5-2.0 g I/s)";
        warnings.push(
          "IDR below optimal for angiography - consider higher concentration or flow rate",
        );
      } else if (idr >= 1.5 && idr <= 2.0) {
        idrAssessment = "Optimal for CTA";
      } else {
        idrAssessment = "Good";
      }
    } else {
      if (idr >= 1.0 && idr <= 1.5) {
        idrAssessment = "Optimal for standard CT";
      } else if (idr > 1.5) {
        idrAssessment = "Good (above minimum)";
      } else {
        idrAssessment = "Low - may result in suboptimal enhancement";
      }
    }

    // Build result object
    const injectionRate =
      recommendedFlowMin === recommendedFlowMax
        ? `${recommendedFlowMin} mL/s`
        : `${recommendedFlowMin}-${recommendedFlowMax} mL/s (recommended: ${recommendedFlow.toFixed(1)} mL/s)`;
    const contrastWarming =
      concentration === 300
        ? "Routine warming is not supported for lower-viscosity 300 mg I/mL agents; ACR 2026 found insufficient supportive evidence."
        : "Warming may be considered selectively to reduce viscosity and injection pressure for higher-viscosity agents or high-risk injections; it is not established as a routine requirement and must follow local handling policy.";

    const result = {
      "Recommended Contrast Volume": `${Math.round(contrastVolume)} mL`,
      "Total Iodine Dose": `${Math.round(totalIodineDose).toLocaleString()} mg I (${Math.round(totalIodineDose / dosingWeight)} mg I/kg ${dosingBasis})`,
      "Injection Rate": injectionRate,
      "Iodine Delivery Rate (IDR)": `${idr.toFixed(2)} g I/s - ${idrAssessment}`,
      "Injection Duration": `~${Math.round(injectionDuration)} seconds`,
      "Saline Flush": `${salineFlush} mL example at same rate; follow the diagnostic protocol and access limits`,
      "Contrast Warming": contrastWarming,
      "Acute Reaction Resources":
        "For a suspected acute reaction, activate the local emergency response and use the official ACR Adult or Pediatric Contrast Reaction Card linked in References; this dosing calculator is not a treatment algorithm.",
    };

    // Add body composition info
    result["Body Composition"] =
      `BMI: ${bmi.toFixed(1)} kg/m² | LBW: ${lbw.toFixed(1)} kg | TBW: ${weightKg.toFixed(1)} kg`;

    if (useObese) {
      const volumeSaved = Math.round(
        (targetIodineDosePerKg * weightKg) / concentration - contrastVolume,
      );
      result["LBW Dosing Applied"] =
        `Volume reduced by ~${volumeSaved > 0 ? volumeSaved : 0} mL vs TBW dosing`;
    }

    if (renalContext) {
      result["Renal Safety Context"] = renalContext;
      result["Renal Recommendation"] = renalRecommendation;
    }
    if (volumeExpansionSafety) {
      result["Volume Expansion Safety"] = volumeExpansionSafety;
    }
    if (diagnosticDoseNote) {
      result["Diagnostic Dose"] = diagnosticDoseNote;
    }

    // Add warnings if present
    if (warnings.length > 0) {
      result["WARNINGS"] = warnings.join(" | ");
    }

    // Add protocol notes
    const protocolNotes = [];
    if (study_type === "hepatic") {
      protocolNotes.push(
        "Hepatic CT: High flow rate for optimal parenchymal enhancement",
      );
    }
    if (study_type === "cta" || study_type === "coronary") {
      protocolNotes.push(
        "CTA: Use bolus tracking or test bolus for optimal timing",
      );
    }
    protocolNotes.push(
      "Follow local injector monitoring policy, maintain patient communication, and observe the IV site during injection when feasible",
    );

    result["Protocol Notes"] = protocolNotes.join("; ");

    return result;
  },

  refs: [
    {
      t: "ACR Manual on Contrast Media 2026. American College of Radiology Committee on Drugs and Contrast Media.",
      u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/ACR-Manual-on-Contrast-Media.pdf",
    },
    {
      t: "ACR Adult Contrast Reaction Card (official quick-reference card).",
      u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/Contrast-Reaction-Card-Adult.pdf",
    },
    {
      t: "ACR Pediatric Contrast Reaction Card (official quick-reference card).",
      u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/Contrast-Reaction-Card-Pediatric.pdf",
    },
    {
      t: "ESUR Guidelines on Contrast Agents Version 10.0. European Society of Urogenital Radiology.",
      u: "https://www.esur.org/esur-guidelines-on-contrast-agents/",
    },
    {
      t: "Davenport MS, Perazella MA, Yee J, et al. Use of Intravenous Iodinated Contrast Media in Patients with Kidney Disease: Consensus Statements from the American College of Radiology and the National Kidney Foundation. Radiology. 2020;294(3):660-668.",
      u: "https://doi.org/10.1148/radiol.2019192094",
    },
    {
      t: "de Bucourt M, et al. Lean body weight versus total body weight to calculate the iodinated contrast media volume in abdominal CT: a randomised controlled trial. Insights into Imaging. 2020;11:117.",
      u: "https://doi.org/10.1186/s13244-020-00920-4",
    },
    {
      t: "Bae KT. Intravenous contrast medium administration and scan timing at CT: considerations and approaches. Radiology. 2010;256(1):32-61.",
      u: "https://doi.org/10.1148/radiol.10090908",
    },
    {
      t: "McCullough PA, et al. Contrast-Induced Acute Kidney Injury. J Am Coll Cardiol. 2016;68(13):1465-1473.",
      u: "https://doi.org/10.1016/j.jacc.2016.05.099",
    },
    {
      t: "Baerlocher MO, et al. Intravenous contrast medium extravasation: systematic review and updated ESUR Contrast Media Safety Committee Guidelines. Eur Radiol. 2022;32(7):4500-4508.",
      u: "https://doi.org/10.1007/s00330-022-08701-5",
    },
  ],
};
