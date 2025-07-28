export const HipDysplasiaIndices = {
  id: "hip-dysplasia",
  name: "Hip Dysplasia",
  desc: "Calculate migration indices and normal values in hip dysplasia",
  info: {
    text: "Migration index measurements:\n\nThe migration index is calculated as (a / (a + b)) × 100, where:\n• a = lateral distance from femoral head to acetabular line\n• b = medial distance from acetabular line to center of femoral head\n\nInterpretation ranges:\n• <22%: Normal (in children >3 years)\n• 22-32%: Borderline/At risk\n• 33-59%: Subluxation\n• 60-89%: Severe subluxation\n• ≥90%: Dislocation\n\nAcetabular Index (Tönnis Angle) normal values:\n• 0-10°: Normal\n• >10°: Hip dysplasia",
    image: "/migration_index_diagram.png",
  },
  fields: [
    { id: "dob", label: "Date of birth", type: "date" },
    {
      id: "gender",
      label: "Gender",
      type: "radio",
      opts: [
        { value: "female", label: "female" },
        { value: "male", label: "male" }
      ],
    },
    {
      id: "ac_right",
      label: "AC-Angle",
      type: "number",
      subLabel: "right",
      group: "ac"
    },
    {
      id: "ac_left", 
      label: "AC-Angle",
      type: "number",
      subLabel: "left",
      group: "ac"
    },
    {
      id: "ccd_right",
      label: "CCD-Angle", 
      type: "number",
      subLabel: "right",
      group: "ccd"
    },
    {
      id: "ccd_left",
      label: "CCD-Angle",
      type: "number", 
      subLabel: "left",
      group: "ccd"
    },
    {
      id: "mi_right_a",
      label: "Migration Index",
      type: "number",
      subLabel: "right a",
      group: "migration"
    },
    {
      id: "mi_right_b",
      label: "Migration Index", 
      type: "number",
      subLabel: "right b",
      group: "migration"
    },
    {
      id: "mi_left_a",
      label: "Migration Index",
      type: "number",
      subLabel: "left a", 
      group: "migration"
    },
    {
      id: "mi_left_b",
      label: "Migration Index",
      type: "number",
      subLabel: "left b",
      group: "migration"
    },
  ],
  compute: (v) => {
    const { dob, gender, ac_right, ac_left, ccd_right, ccd_left, mi_right_a, mi_right_b, mi_left_a, mi_left_b } = v;
    
    // Calculate age in months
    const ageMonths = dob ? Math.floor((Date.now() - new Date(dob)) / (1000 * 60 * 60 * 24 * 30.44)) : null;
    
    const result = {};
    
    // Get normal values based on age and gender
    if (ageMonths !== null && gender) {
      const normals = getNormalValues(ageMonths, gender);
      result["Normal AC-Angle"] = normals.ac;
      result["Normal CCD-Angle"] = normals.ccd;
    } else {
      result["Normal AC-Angle"] = "Enter date of birth and gender";
      result["Normal CCD-Angle"] = "Enter date of birth and gender";
    }
    
    // Calculate migration indices
    if (mi_right_a && mi_right_b) {
      const miRight = (parseFloat(mi_right_a) / (parseFloat(mi_right_a) + parseFloat(mi_right_b))) * 100;
      result["Migration Index (Right)"] = `${miRight.toFixed(1)}% - ${interpretMigrationIndex(miRight, ageMonths)}`;
    }
    
    if (mi_left_a && mi_left_b) {
      const miLeft = (parseFloat(mi_left_a) / (parseFloat(mi_left_a) + parseFloat(mi_left_b))) * 100;
      result["Migration Index (Left)"] = `${miLeft.toFixed(1)}% - ${interpretMigrationIndex(miLeft, ageMonths)}`;
    }
    
    return result;
  },
  refs: [
    {
      t: "Tönnis D. Normal values of the hip joint for the evaluation of X-rays in children and adults. Clin Orthop Relat Res. 1976;(119):39-47.", 
      u: "https://pubmed.ncbi.nlm.nih.gov/954321/",
    },
    {
      t: "Tönnis D. Die Angeborene Hüftdysplasie Und Hüftluxation Im Kindes- Und Erwachsenenalter. Springer-Verlag Berlin Heidelberg. 1984.",
      u: "https://doi.org/10.1007/978-3-662-06621-8",
    },
    {
      t: "Reimers J. The stability of the hip in children. A radiological study of the results of muscle surgery in cerebral palsy. Acta Orthop Scand Suppl. 1980;184:1-100.",
      u: "https://pubmed.ncbi.nlm.nih.gov/6930145/",
    },
  ],
};

// Helper function to get normal values based on age and gender
function getNormalValues(ageMonths, gender) {
  // Age-based normal values based on Tönnis classification
  
  if (ageMonths <= 3) {
    return {
      ac: gender === "female" ? "27 ± 5°" : "25 ± 5°",
      ccd: "140-150° (newborn)"
    };
  } else if (ageMonths <= 6) {
    return {
      ac: gender === "female" ? "25 ± 4°" : "23 ± 4°", 
      ccd: "135-145° (infant)"
    };
  } else if (ageMonths <= 12) {
    return {
      ac: gender === "female" ? "23 ± 3°" : "21 ± 3°",
      ccd: "130-140° (1 year)"
    };
  } else if (ageMonths <= 24) {
    return {
      ac: gender === "female" ? "22 ± 3°" : "20 ± 3°",
      ccd: "125-135° (2 years)"
    };
  } else if (ageMonths <= 60) {
    return {
      ac: "18-22° (preschool)",
      ccd: "125-135° (child)"
    };
  } else {
    return {
      ac: "15-20° (school age)",
      ccd: "125-135° (adult range)"
    };
  }
}

// Helper function to interpret migration index values
function interpretMigrationIndex(mi, ageMonths) {
  // For children under 3 years, normal is 0%
  if (ageMonths !== null && ageMonths < 36) {
    if (mi === 0) return "Normal";
    if (mi > 0 && mi < 10) return "Mild concern";
    if (mi >= 10 && mi < 33) return "At risk";
    if (mi >= 33 && mi < 60) return "Subluxation";
    if (mi >= 60 && mi < 90) return "Severe subluxation";
    return "Dislocation";
  }
  
  // For children 3+ years
  if (mi < 22) return "Normal";
  if (mi >= 22 && mi < 33) return "Borderline/At risk";
  if (mi >= 33 && mi < 60) return "Subluxation";
  if (mi >= 60 && mi < 90) return "Severe subluxation";
  return "Dislocation";
}