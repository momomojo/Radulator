/**
 * Wells Criteria for DVT Calculator
 *
 * The Wells criteria for DVT is a validated clinical decision rule used to estimate
 * the pre-test probability of deep vein thrombosis. It helps guide diagnostic workup
 * and determines appropriateness of D-dimer testing vs. immediate ultrasound.
 *
 * Primary Sources:
 * - Wells PS, et al. Lancet. 1997;350(9094):1795-1798
 * - Wells PS, et al. N Engl J Med. 2003;349(13):1227-1235
 * - Goodacre S, et al. BMJ. 2005;330(7497):821 (Systematic review)
 */

export const WellsDVT = {
  id: "wells-dvt",
  category: "Clinical Decision",
  name: "Wells Criteria for DVT",
  desc: "Clinical decision rule for deep vein thrombosis probability assessment",
  guidelineVersion: "Modified Wells DVT / NICE NG158",
  keywords: ["deep vein thrombosis", "DVT", "leg swelling", "venous"],
  tags: ["Clinical Decision", "Vascular", "Emergency"],
  metaDesc:
    "Free Wells Criteria for DVT Calculator. Estimate pre-test probability of deep vein thrombosis with evidence-based scoring and diagnostic pathway guidance.",

  info: {
    text: `The Wells Criteria for lower-extremity DVT estimate clinical probability from clinician-assessed findings; the score does not diagnose or exclude a clot.

Applied rule: NICE NG158 Table 1, adapted from the modified Wells rule. Nine positive features score +1 each; an alternative diagnosis at least as likely scores -2. The two-level result is DVT likely at 2 or more points, unlikely at 1 or fewer. A secondary historical three-band grouping is shown for reference, not as a separately calibrated current model.

Scope: adults with suspected lower-extremity DVT. Not a pregnancy, pediatric or upper-extremity DVT pathway. Assess all items before calculating; an unselected checkbox is not proof that a finding was examined and absent.

NICE diagnostic context: unlikely starts with D-dimer; likely starts with proximal leg ultrasound. Further steps depend on actual test results, assay, scan quality and timing. This form does not collect those results or prescribe anticoagulation. Follow the linked complete pathway, including urgent investigation and interim-treatment provisions.

Historical prevalence varies by study population and score version. Cohort rates shown in the report are not individual risk estimates. ASH uses separately defined probability/imaging strategies; do not combine branches from different guidelines.`,
    link: {
      label: "NICE NG158: two-level Wells score and diagnostic pathway",
      url: "https://www.nice.org.uk/guidance/ng158/chapter/Recommendations",
    },
  },

  fields: [
    // CLINICAL SIGNS AND SYMPTOMS
    {
      id: "active_cancer",
      label: "Active cancer",
      subLabel: "Treatment ongoing, within 6 months, or palliative",
      type: "checkbox",
    },
    {
      id: "paralysis_paresis",
      label: "Paralysis, paresis, or recent plaster immobilization",
      subLabel: "Of the lower extremities",
      type: "checkbox",
    },
    {
      id: "bedridden_surgery",
      label: "Recently bedridden at least 3 days or major surgery within 12 weeks",
      subLabel: "Requiring general or regional anesthesia",
      type: "checkbox",
    },
    {
      id: "tenderness_deep_veins",
      label: "Localized tenderness along deep venous system",
      type: "checkbox",
    },
    {
      id: "leg_swelling",
      label: "Entire leg swollen",
      type: "checkbox",
    },
    {
      id: "calf_swelling",
      label: "Calf swelling at least 3 cm compared to asymptomatic leg",
      subLabel: "Measured 10 cm below tibial tuberosity",
      type: "checkbox",
    },
    {
      id: "pitting_edema",
      label: "Pitting edema confined to symptomatic leg",
      type: "checkbox",
    },
    {
      id: "collateral_veins",
      label: "Collateral superficial veins (non-varicose)",
      type: "checkbox",
    },
    {
      id: "previous_dvt",
      label: "Previously documented DVT",
      type: "checkbox",
    },
    {
      id: "alternative_diagnosis",
      label: "Alternative diagnosis at least as likely as DVT",
      subLabel: "e.g., cellulitis, Baker's cyst, muscle strain (-2 points)",
      type: "checkbox",
    },
  ],

  compute: (vals) => {
    // NICE NG158 Table 1: fixed clinical weights, not inferred findings.
    const criteria = [
      ["active_cancer", "Active cancer", 1],
      ["paralysis_paresis", "Paralysis/paresis/immobilization", 1],
      ["bedridden_surgery", "Bedridden at least 3 days or major surgery within 12 weeks requiring general or regional anesthesia", 1],
      ["tenderness_deep_veins", "Tenderness along deep veins", 1],
      ["leg_swelling", "Entire leg swollen", 1],
      ["calf_swelling", "Calf swelling at least 3 cm compared with the asymptomatic leg, measured 10 cm below the tibial tuberosity", 1],
      ["pitting_edema", "Pitting edema", 1],
      ["collateral_veins", "Collateral superficial veins", 1],
      ["previous_dvt", "Previously documented DVT", 1],
      ["alternative_diagnosis", "Alternative diagnosis as likely", -2],
    ];
    if (criteria.some(([id]) => vals[id] !== undefined && typeof vals[id] !== "boolean")) {
      return { Error: "Assess each clinical item and select it using its checkbox. Supplied findings must be true or false." };
    }
    const selected = criteria.filter(([id]) => vals[id] === true);
    const score = selected.reduce((total, [, , weight]) => total + weight, 0);
    const likely = score >= 2;
    const threeBand = score <= 0 ? "Low" : score <= 2 ? "Moderate" : "High";
    const result = {
      "Wells Score": `${score} points`,
      "2-Tier Assessment (NICE NG158)": likely ? "DVT Likely" : "DVT Unlikely",
      "3-Tier Assessment": `${threeBand} — historical score band; not a separate current pathway`,
      "Score Breakdown": selected.length
        ? selected.map(([, label, weight]) => `${label}: ${weight > 0 ? "+" : ""}${weight}`).join("; ")
        : "No positive findings selected (0 points); confirm every item was assessed.",
      "Rule applied": "Modified Wells criteria as adapted in NICE NG158 Table 1; prior DVT counted once.",
      Recommendation: likely
        ? "NICE NG158: start with proximal leg vein ultrasound. If negative, obtain D-dimer. In this likely-score pathway, a negative proximal scan and positive D-dimer calls for repeat proximal ultrasound in 6–8 days. Follow the full pathway for other result combinations and investigation timing."
        : "NICE NG158: start with D-dimer; a positive result leads to proximal leg vein ultrasound. A negative result is interpreted within the complete validated diagnostic pathway, not from this score alone. Follow the full pathway for assay, timing, imaging results and safety-net advice.",
      "Decision boundary": "This score does not diagnose or exclude DVT. Test results, clinical assessment and the complete diagnostic pathway are required. Investigation delays and interim anticoagulation require clinician review; this form does not issue start/stop or dosing instructions.",
      "Clinical scope": "Adult suspected lower-extremity DVT. Pregnancy, pediatric and upper-extremity pathways are not supported. Historical calibration is predominantly outpatient; inpatient, cancer-associated and recurrent presentations require contextual assessment.",
      "Historical cohort context": "Two-level studies: unlikely ~6%, likely ~28% (CHEST 2012, section 3.1.1). Three-level pooled outpatient studies: low ~5%, moderate ~17%, high ~53% (Wells et al., JAMA 2006). These are historical cohort rates, not individual probabilities or recalibrated estimates for this exact NICE-adapted input set.",
      "ASH reference context": "ASH 2018 uses separately defined pretest-probability populations and whole-leg versus proximal ultrasound strategies. At intermediate probability, negative whole-leg imaging may complete evaluation; negative proximal imaging may require serial ultrasound if no alternative diagnosis is found. Higher probability, recurrence and suboptimal studies require their own pathways. Do not combine these branches with NICE's algorithm.",
      _severity: "info",
    };
    const notes = [];
    if (score < 0) notes.push("Negative score reflects the alternative-diagnosis deduction; it does not establish absence of DVT.");
    if (vals.previous_dvt) notes.push("Prior DVT: compare previous imaging when available; recurrent thrombosis requires dedicated assessment and prior DVT is counted only once.");
    if (vals.active_cancer) notes.push("Cancer-associated presentations may have different baseline probability and D-dimer performance; the score does not determine anticoagulation duration.");
    if (notes.length) result["Clinical Notes"] = notes.join(" ");
    if (vals.alternative_diagnosis) result["Common Alternatives"] = "Baker's cyst, cellulitis, muscle strain/tear, superficial thrombophlebitis, lymphedema and chronic venous insufficiency; selecting an alternative does not establish that diagnosis.";
    return result;
  },

  refs: [
    {
      t: "NICE NG158. Table 1 and recommendations 1.1.1–1.1.14: adult lower-extremity DVT score and diagnostic pathway.",
      u: "https://www.nice.org.uk/guidance/ng158/chapter/Recommendations",
    },
    {
      t: "Lim W, Le Gal G, Bates SM, et al. ASH 2018 guidelines: diagnosis of venous thromboembolism. Recommendations 5–8 and remarks.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6258916/",
    },
    {
      t: "Wells PS, Anderson DR, Rodger M, et al. Evaluation of D-dimer in the diagnosis of suspected deep-vein thrombosis. N Engl J Med. 2003;349:1227–1235.",
      u: "https://doi.org/10.1056/NEJMoa023153",
    },
    {
      t: "Wells PS, Owen C, Doucette S, Fergusson D, Tran H. Does this patient have deep vein thrombosis? JAMA. 2006;295:199–207. Historical pooled outpatient prevalence.",
      u: "https://pubmed.ncbi.nlm.nih.gov/16403932/",
    },
    {
      t: "Bates SM, Jaeschke R, Stevens SM, et al. Diagnosis of DVT. CHEST 2012 guideline, section 3.1.1: historical Wells cohort prevalence and version context.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3278048/",
    },
    {
      t: "Geersing GJ, Zuithoff NPA, Kearon C, et al. Exclusion of deep vein thrombosis using the Wells rule in clinically important subgroups: individual patient data meta-analysis. BMJ. 2014;348:g1340.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3948465/",
    },
  ],
};
