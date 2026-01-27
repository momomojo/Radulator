// Child-Pugh Score Calculator
// Scoring system for classification and prognosis of chronic liver disease and cirrhosis
// References: Pugh et al. 1973, Child & Turcotte 1964

export const ChildPugh = {
  id: "child-pugh",
  category: "Hepatology/Liver",
  name: "Child-Pugh Score",
  desc: "Classification and prognosis of chronic liver disease and cirrhosis",
  metaDesc:
    "Free Child-Pugh Score Calculator. Assess liver cirrhosis severity and prognosis (Class A, B, C). Calculates points for bilirubin, albumin, INR, ascites, and encephalopathy.",
  info: {
    text: "The Child-Pugh score is used to assess the prognosis of chronic liver disease, mainly cirrhosis. It uses five clinical measures: total bilirubin, serum albumin, INR, ascites, and hepatic encephalopathy.\n\nEach parameter is scored from 1 to 3 points, with a total score ranging from 5 to 15 points. The score classifies patients into three classes (A, B, C) that correlate with surgical risk and mortality.",
  },
  fields: [
    {
      id: "bilirubin",
      label: "Total Bilirubin",
      subLabel: "mg/dL",
      type: "number",
    },
    {
      id: "albumin",
      label: "Serum Albumin",
      subLabel: "g/dL",
      type: "number",
    },
    {
      id: "inr",
      label: "INR",
      type: "number",
    },
    {
      id: "ascites",
      label: "Ascites",
      type: "radio",
      opts: [
        { value: "none", label: "None" },
        { value: "slight", label: "Slight" },
        { value: "moderate", label: "Moderate to Severe" },
      ],
    },
    {
      id: "encephalopathy",
      label: "Hepatic Encephalopathy",
      type: "radio",
      opts: [
        { value: "none", label: "None" },
        { value: "grade1-2", label: "Grade 1-2 (mild)" },
        { value: "grade3-4", label: "Grade 3-4 (severe)" },
      ],
    },
  ],
  compute: ({ bilirubin, albumin, inr, ascites, encephalopathy }) => {
    // Validate required inputs
    const bil = parseFloat(bilirubin);
    const alb = parseFloat(albumin);
    const inrVal = parseFloat(inr);

    if (!Number.isFinite(bil) || bil < 0) {
      return { Error: "Please enter a valid bilirubin value (≥ 0)" };
    }
    if (!Number.isFinite(alb) || alb < 0) {
      return { Error: "Please enter a valid albumin value (≥ 0)" };
    }
    if (!Number.isFinite(inrVal) || inrVal < 0) {
      return { Error: "Please enter a valid INR value (≥ 0)" };
    }
    if (!ascites) {
      return { Error: "Please select ascites status" };
    }
    if (!encephalopathy) {
      return { Error: "Please select encephalopathy grade" };
    }

    // Calculate points for each parameter
    let bilirubinPoints,
      albuminPoints,
      inrPoints,
      ascitesPoints,
      encephalopathyPoints;

    // Bilirubin scoring: <2 (1pt), 2-3 (2pts), >3 (3pts)
    if (bil < 2.0) {
      bilirubinPoints = 1;
    } else if (bil <= 3.0) {
      bilirubinPoints = 2;
    } else {
      bilirubinPoints = 3;
    }

    // Albumin scoring: >3.5 (1pt), 2.8-3.5 (2pts), <2.8 (3pts)
    if (alb > 3.5) {
      albuminPoints = 1;
    } else if (alb >= 2.8) {
      albuminPoints = 2;
    } else {
      albuminPoints = 3;
    }

    // INR scoring: <1.7 (1pt), 1.7-2.2 (2pts), >2.2 (3pts)
    if (inrVal < 1.7) {
      inrPoints = 1;
    } else if (inrVal <= 2.2) {
      inrPoints = 2;
    } else {
      inrPoints = 3;
    }

    // Ascites scoring
    if (ascites === "none") {
      ascitesPoints = 1;
    } else if (ascites === "slight") {
      ascitesPoints = 2;
    } else {
      ascitesPoints = 3;
    }

    // Encephalopathy scoring
    if (encephalopathy === "none") {
      encephalopathyPoints = 1;
    } else if (encephalopathy === "grade1-2") {
      encephalopathyPoints = 2;
    } else {
      encephalopathyPoints = 3;
    }

    // Calculate total score
    const totalScore =
      bilirubinPoints +
      albuminPoints +
      inrPoints +
      ascitesPoints +
      encephalopathyPoints;

    // Determine class and prognosis
    let childPughClass, description, mortality1yr, surgicalRisk;

    if (totalScore <= 6) {
      childPughClass = "A";
      description = "Well-compensated disease";
      mortality1yr = "5-10%";
      surgicalRisk = "10%";
    } else if (totalScore <= 9) {
      childPughClass = "B";
      description = "Significant functional compromise";
      mortality1yr = "15-20%";
      surgicalRisk = "30%";
    } else {
      childPughClass = "C";
      description = "Decompensated disease";
      mortality1yr = "45-55%";
      surgicalRisk = "70-80%";
    }

    // Build detailed results
    const result = {
      "Total Score": `${totalScore} points`,
      "Child-Pugh Class": childPughClass,
      Classification: description,
      "1-Year Mortality": mortality1yr,
      "Perioperative Mortality": surgicalRisk,
      "": "─────────────────────",
      "Points Breakdown": "",
      Bilirubin: `${bil.toFixed(1)} mg/dL → ${bilirubinPoints} point${bilirubinPoints > 1 ? "s" : ""}`,
      Albumin: `${alb.toFixed(1)} g/dL → ${albuminPoints} point${albuminPoints > 1 ? "s" : ""}`,
      INR: `${inrVal.toFixed(1)} → ${inrPoints} point${inrPoints > 1 ? "s" : ""}`,
      Ascites: `${ascites.charAt(0).toUpperCase() + ascites.slice(1).replace("-", " ")} → ${ascitesPoints} point${ascitesPoints > 1 ? "s" : ""}`,
      Encephalopathy: `${encephalopathy === "none" ? "None" : encephalopathy.replace("grade", "Grade ").replace("-", "-")} → ${encephalopathyPoints} point${encephalopathyPoints > 1 ? "s" : ""}`,
    };

    return result;
  },
  refs: [
    {
      t: "Pugh RN, Murray-Lyon IM, Dawson JL, et al. Transection of the oesophagus for bleeding oesophageal varices. Br J Surg. 1973;60(8):646-649.",
      u: "https://doi.org/10.1002/bjs.1800600817",
    },
    {
      t: "Child CG, Turcotte JG. Surgery and portal hypertension. In: The liver and portal hypertension. Philadelphia: Saunders, 1964:50-64.",
      u: "https://www.ncbi.nlm.nih.gov/books/NBK541016/",
    },
    {
      t: "Durand F, Valla D. Assessment of the prognosis of cirrhosis: Child-Pugh versus MELD. J Hepatol. 2005;42 Suppl:S100-7.",
      u: "https://doi.org/10.1016/j.jhep.2004.11.015",
    },
    {
      t: "Kamath PS, Kim WR. The model for end-stage liver disease (MELD). Hepatology. 2007;45(3):797-805.",
      u: "https://doi.org/10.1002/hep.21563",
    },
  ],
};
