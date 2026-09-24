/**
 * NI-RADS Calculator
 *
 * Neck Imaging Reporting and Data System for post-treatment head and neck cancer surveillance.
 * Provides separate categories for primary site and neck nodes with management recommendations.
 *
 * Primary Sources:
 * - Aiken AH, et al. J Am Coll Radiol. 2018 (NI-RADS White Paper)
 * - Krieger DA, et al. AJNR Am J Neuroradiol. 2017 (Validation Study)
 * - Bunch PM, et al. J Am Coll Radiol. 2025 (NI-RADS MRI v2025)
 */

/**
 * MRI v2025 source patterns translated into concise, independently authored
 * UI wording. Categories and management are bound to the reviewed ACR packet;
 * the public source does not define a numeric ADC cutoff.
 */
export const MRI_2025_PATTERN_DEFINITIONS = Object.freeze({
  p0_known_pending_prior: {
    site: "primary",
    category: "0",
    label: "New baseline with a known prior study still pending",
  },
  p1_expected_changes: {
    site: "primary",
    category: "1",
    label: "Expected post-treatment change",
  },
  p1_diffuse_linear_mucosa: {
    site: "primary",
    category: "1",
    label: "Diffuse thin linear mucosal enhancement or submucosal edema",
  },
  p1_low_t1_t2_scar: {
    site: "primary",
    category: "1",
    label: "Low T1/T2 signal compatible with scar or fibrosis",
  },
  p1_t2_hyperintense_nonmass_edema: {
    site: "primary",
    category: "1",
    label: "Non-mass distortion with T2-hyperintense edema/inflammation",
  },
  p1_baseline_resolved: {
    site: "primary",
    category: "1",
    label: "First baseline: tumor resolved without focal mass-like tissue",
  },
  p1_baseline_decreased_perineural: {
    site: "primary",
    category: "1",
    label: "First baseline: skull-base/perineural abnormality has decreased",
  },
  p1_followup_stable_or_decreased: {
    site: "primary",
    category: "1",
    label: "Later study: no new mass and deep/perineural change is stable or decreased",
  },
  p2a_focal_nonmass_mucosa: {
    site: "primary",
    category: "2a",
    label: "Focal non-mass-like mucosal enhancement",
  },
  p2a_focal_reduced_diffusion: {
    site: "primary",
    category: "2a",
    label: "Focal reduced diffusion at a superficial or mucosal site",
  },
  p2b_deep_ill_defined: {
    site: "primary",
    category: "2b",
    label: "Deep ill-defined nonnodular soft tissue",
  },
  p2b_mismatch_original: {
    site: "primary",
    category: "2b",
    label: "Tissue differs from the original tumor on DWI, enhancement, or T1/T2 signal",
  },
  p2b_intermediate_t2_enhancement: {
    site: "primary",
    category: "2b",
    label: "Intermediate T2 signal with intermediate enhancement",
  },
  p2b_baseline_partial_resolution: {
    site: "primary",
    category: "2b",
    label: "First baseline: partial tumor resolution",
  },
  p2b_baseline_perineural_unchanged: {
    site: "primary",
    category: "2b",
    label: "First baseline: unchanged same-profile skull-base/perineural tissue",
  },
  p2b_baseline_thin_smooth_perineural: {
    site: "primary",
    category: "2b",
    label: "First baseline: new thin smooth skull-base/perineural enhancement in the radiation field",
  },
  p3_discrete_matching_mass: {
    site: "primary",
    category: "3",
    label: "Discrete new/enlarging mass matching the original tumor's MRI features",
  },
  p3_persistent_growing_mismatch_mass: {
    site: "primary",
    category: "3",
    label: "Discrete mass continues to enlarge despite MRI feature mismatch",
  },
  p3_intense_focal_fdg: {
    site: "primary",
    category: "3",
    label: "Intense focal FDG uptake when PET is available",
  },
  p3_progressive_perineural: {
    site: "primary",
    category: "3",
    label: "Progressive skull-base/perineural tissue, enhancement, or foraminal change",
  },
  p4_definitive_recurrence: {
    site: "primary",
    category: "4",
    label: "Pathologically proven recurrence or definite radiologic and clinical progression",
  },
  n0_known_pending_prior: {
    site: "neck",
    category: "0",
    label: "New baseline with a known prior study still pending",
  },
  n1_no_abnormal_nodes: {
    site: "neck",
    category: "1",
    label: "No abnormal cervical nodes",
  },
  n1_residual_hypo_no_fdg: {
    site: "neck",
    category: "1",
    label: "Residual treated nodal tissue is hypoenhancing with no FDG uptake",
  },
  n2_residual_heterogeneous: {
    site: "neck",
    category: "2",
    label: "Residual nodal tissue has persistent heterogeneous enhancement",
  },
  n2_residual_mild_mod_fdg: {
    site: "neck",
    category: "2",
    label: "Residual nodal tissue has mild or moderate FDG uptake",
  },
  n2_new_enlarging_no_definitive_morphology: {
    site: "neck",
    category: "2",
    label: "New/enlarging node without high-suspicion morphology",
  },
  n2_pet_mri_discordance: {
    site: "neck",
    category: "2",
    label: "PET/MRI discordance when the original tumor was FDG avid",
  },
  n3_residual_intense_fdg: {
    site: "neck",
    category: "3",
    label: "Residual nodal tissue has intense FDG uptake",
  },
  n3_residual_definite_enlargement_enhancement: {
    site: "neck",
    category: "3",
    label: "Residual nodal tissue definitely enlarges or enhances more",
  },
  n3_new_enlarging_necrosis_cystic: {
    site: "neck",
    category: "3",
    label: "New/enlarging node develops necrosis or cystic change",
  },
  n3_new_enlarging_irregular_ene: {
    site: "neck",
    category: "3",
    label: "New/enlarging node has irregular borders or gross extranodal extension",
  },
  n3_new_enlarging_intense_fdg: {
    site: "neck",
    category: "3",
    label: "New/enlarging node has intense focal FDG uptake",
  },
  n4_definitive_recurrence: {
    site: "neck",
    category: "4",
    label: "Pathologically proven recurrence or definite radiologic and clinical progression",
  },
});

const MRI_2025_MANAGEMENT = Object.freeze({
  "primary.0": "Add the score in an addendum when the known prior imaging becomes available.",
  "primary.1": "Routine surveillance.",
  "primary.2a": "Direct visual inspection.",
  "primary.2b": "Short-interval MRI or PET.",
  "primary.3": "Image-guided or clinical biopsy if clinically indicated.",
  "primary.4": "Clinical management or treatment of disease, with or without biopsy.",
  "neck.0": "Add the score in an addendum when the known prior imaging becomes available.",
  "neck.1": "Routine surveillance.",
  "neck.2": "Short-interval MRI or PET.",
  "neck.3": "Biopsy.",
  "neck.4": "Clinical management or treatment of disease, with or without biopsy.",
});

const MRI_2025_CATEGORY_LABELS = Object.freeze({
  0: "Incomplete",
  1: "No Evidence of Recurrence",
  "2a": "Low Suspicion",
  "2b": "Low Suspicion",
  2: "Low Suspicion",
  3: "High Suspicion",
  4: "Definitive Recurrence",
});

const RESIDUAL_NODE_PATTERNS = new Set([
  "n1_residual_hypo_no_fdg",
  "n2_residual_heterogeneous",
  "n2_residual_mild_mod_fdg",
  "n3_residual_intense_fdg",
  "n3_residual_definite_enlargement_enhancement",
]);

const NEW_NODE_PATTERNS = new Set([
  "n2_new_enlarging_no_definitive_morphology",
  "n3_new_enlarging_necrosis_cystic",
  "n3_new_enlarging_irregular_ene",
  "n3_new_enlarging_intense_fdg",
]);

function asBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "yes" || value === "true") return true;
  if (value === "no" || value === "false") return false;
  return null;
}

function selectedPatternIds(inputs) {
  if (Array.isArray(inputs.pattern_ids)) return inputs.pattern_ids.filter(Boolean);
  return inputs.pattern_id ? [inputs.pattern_id] : [];
}

/**
 * Deterministic MRI-v2025 classifier bound to the independently reviewed
 * packet. It returns source-stable machine keys so the UI and regression
 * vectors exercise the same fail-closed path.
 */
export function classifyNiradsMri2025(inputs = {}) {
  if (inputs.version !== "mri_2025") {
    return { status: "error", error: "version_mismatch" };
  }

  const site = inputs.assessment_site;
  const duringTreatment = asBoolean(inputs.during_treatment);
  const assessable = asBoolean(inputs.assessable);
  const patternIds = selectedPatternIds(inputs);

  if (duringTreatment === null) {
    return { status: "error", error: "insufficient_input" };
  }
  if (duringTreatment) {
    return { status: "error", error: "out_of_scope_during_treatment" };
  }
  if (
    !["primary", "neck"].includes(site) ||
    assessable === null
  ) {
    return { status: "error", error: "insufficient_input" };
  }

  if (site === "primary") {
    if (!['known', 'unknown'].includes(inputs.primary_tumor_status)) {
      return { status: "error", error: "insufficient_primary_tumor_status" };
    }
    if (inputs.primary_tumor_status === "unknown") {
      if (!assessable || patternIds.length > 0) {
        return { status: "error", error: "conflicting_status_inputs" };
      }
      return {
        status: "not_assessed",
        assessment_code: "P-unknown primary",
        category: null,
      };
    }
  }

  if (!assessable) {
    if (!inputs.technical_reason) {
      return { status: "error", error: "insufficient_technical_reason" };
    }
    return {
      status: "not_assessed",
      assessment_code: site === "primary" ? "P-x" : "N-x",
      category: null,
    };
  }

  if (!['available', 'known_pending', 'unavailable_not_pending'].includes(inputs.prior_status)) {
    return { status: "error", error: "insufficient_prior_status" };
  }
  if (inputs.prior_status === "known_pending") {
    if (inputs.timepoint !== "new_baseline") {
      return { status: "error", error: "category_0_requires_new_baseline" };
    }
    return {
      status: "classified",
      category: "0",
      management_key: `${site}.0`,
    };
  }

  if (patternIds.length === 0) {
    return { status: "error", error: "insufficient_pattern" };
  }

  const definitions = patternIds.map((id) => MRI_2025_PATTERN_DEFINITIONS[id]);
  if (definitions.some((definition) => !definition)) {
    return { status: "error", error: "invalid_pattern" };
  }
  if (definitions.some((definition) => definition.site !== site)) {
    return { status: "error", error: "pattern_site_mismatch" };
  }

  const categories = new Set(definitions.map((definition) => definition.category));
  if (categories.size > 1) {
    return { status: "error", error: "conflicting_patterns" };
  }

  if (
    patternIds.includes("n2_pet_mri_discordance") &&
    inputs.original_tumor_fdg_avid !== "yes"
  ) {
    return {
      status: "error",
      error: "discordance_rule_requires_original_fdg_avid",
    };
  }
  if (
    patternIds.some((id) => RESIDUAL_NODE_PATTERNS.has(id)) &&
    inputs.node_temporal_status !== "residual"
  ) {
    return {
      status: "error",
      error: "residual_node_pattern_requires_residual_status",
    };
  }
  if (
    patternIds.some((id) => NEW_NODE_PATTERNS.has(id)) &&
    inputs.node_temporal_status !== "new_or_enlarging"
  ) {
    return {
      status: "error",
      error: "new_node_pattern_requires_new_or_enlarging_status",
    };
  }
  if (
    patternIds.includes("p3_discrete_matching_mass") &&
    inputs.original_features_match !== "yes"
  ) {
    return { status: "error", error: "matching_pattern_requires_feature_match" };
  }
  if (
    (patternIds.includes("p2b_mismatch_original") ||
      patternIds.includes("p3_persistent_growing_mismatch_mass")) &&
    inputs.original_features_match !== "no"
  ) {
    return { status: "error", error: "mismatch_pattern_requires_feature_mismatch" };
  }

  const category = definitions[0].category;
  const result = {
    status: "classified",
    category,
    management_key: `${site}.${category}`,
  };
  if (patternIds.includes("p2a_focal_reduced_diffusion")) {
    result.delta_2018 =
      "DWI-only descriptor has no source-literal CT/PET-CT equivalent; do not auto-assign a 2018 category";
  }
  return result;
}

function patternOptions(site) {
  return Object.entries(MRI_2025_PATTERN_DEFINITIONS)
    .filter(([, definition]) => definition.site === site && definition.category !== "0")
    .map(([value, definition]) => ({
      value,
      label: `NI-RADS ${definition.category}: ${definition.label}`,
    }));
}

const MRI_ERROR_MESSAGES = Object.freeze({
  version_mismatch: "The selected inputs do not belong to the 2025 MRI path.",
  insufficient_input: "Select the assessment site, treatment status, and whether the site is assessable.",
  out_of_scope_during_treatment: "MRI v2025 is for surveillance after definitive or curative treatment, not during treatment.",
  insufficient_primary_tumor_status: "Select whether the primary tumor site is known.",
  conflicting_status_inputs: "Unknown-primary and technical/finding inputs conflict. Reconcile the assessment state.",
  insufficient_technical_reason: "Select why the site cannot be assessed.",
  insufficient_prior_status: "Select the prior-imaging status.",
  category_0_requires_new_baseline: "NI-RADS 0 requires a new baseline and a known prior examination that is still pending.",
  insufficient_pattern: "Select one MRI finding pattern.",
  invalid_pattern: "The selected MRI finding pattern is not recognized.",
  pattern_site_mismatch: "The selected finding belongs to the other assessment site.",
  conflicting_patterns: "Findings from different NI-RADS categories conflict. Reconcile them before assigning a category.",
  discordance_rule_requires_original_fdg_avid: "PET/MRI discordance can be used only when the original tumor was FDG avid.",
  residual_node_pattern_requires_residual_status: "This finding applies only to residual treated nodal tissue.",
  new_node_pattern_requires_new_or_enlarging_status: "This finding applies only to a new or enlarging node.",
  matching_pattern_requires_feature_match: "Confirm that the mass matches the original tumor's MRI features.",
  mismatch_pattern_requires_feature_mismatch: "Confirm that the tissue differs from the original tumor's MRI features.",
});

function computeNiradsMri2025Result(vals) {
  const unknownPrimary =
    vals.assessment_site === "primary" && vals.primary_tumor_status === "unknown";
  const patternId = unknownPrimary
    ? ""
    : vals.assessment_site === "neck"
      ? vals.neck_pattern_id || vals.pattern_id
      : vals.primary_pattern_id || vals.pattern_id;
  const classification = classifyNiradsMri2025({
    ...vals,
    assessable: unknownPrimary ? true : vals.assessable,
    pattern_id: patternId,
    version: "mri_2025",
  });
  const siteLabel = vals.assessment_site === "neck" ? "Neck Nodes" : "Primary Site";
  const common = {
    "Modality / Version": "2025 MRI",
    "Assessment Site": siteLabel,
  };

  if (classification.status === "error") {
    return {
      ...common,
      Error: MRI_ERROR_MESSAGES[classification.error] || "The MRI inputs could not be classified.",
      "Error Code": classification.error,
      _severity: "danger",
    };
  }

  if (classification.status === "not_assessed") {
    const notes = {
      "P-unknown primary": "The primary tumor is unknown; this is a nonnumeric status, not NI-RADS 0.",
      "P-x": "The known primary site cannot be assessed technically; this is not NI-RADS 0.",
      "N-x": "The neck cannot be assessed on this MRI; this is not NI-RADS 0.",
    };
    return {
      ...common,
      "NI-RADS Status": classification.assessment_code,
      Note: notes[classification.assessment_code],
      "Source / Limits": "ACR NI-RADS MRI v2025; source-provided framework, no numeric ADC cutoff.",
      _severity: "info",
    };
  }

  const resultKey = vals.assessment_site === "neck" ? "Neck NI-RADS" : "Primary Site NI-RADS";
  const result = {
    ...common,
    [resultKey]: `${classification.category} - ${MRI_2025_CATEGORY_LABELS[classification.category]}`,
    Management: MRI_2025_MANAGEMENT[classification.management_key],
    "Management Provenance": "ACR source-provided; ungraded.",
    "Source / Limits": "ACR NI-RADS MRI v2025; no numeric ADC cutoff is specified.",
  };

  if (
    patternId === "p2b_baseline_perineural_unchanged" ||
    patternId === "p2b_baseline_thin_smooth_perineural"
  ) {
    result["MRI Follow-up Note"] = "MRI is preferred over PET for perineural or skull-base concern.";
  }
  if (patternId === "p3_progressive_perineural") {
    result["Biopsy Note"] = "If perineural biopsy is infeasible, multidisciplinary discussion may determine the next step.";
  }
  if (classification.delta_2018) {
    result["2018 Comparison"] = classification.delta_2018;
  }

  const numericCategory = Number.parseInt(classification.category, 10);
  result._severity = numericCategory === 0 ? "info" : numericCategory === 1 ? "success" : numericCategory === 2 ? "warning" : "danger";
  return result;
}

export const NIRADS = {
  id: "nirads",
  category: "Neuroradiology",
  name: "ACR NI-RADS",
  desc: "Neck Imaging Reporting and Data System for post-treatment head and neck cancer surveillance",
  guidelineVersion: "ACR NI-RADS 2018 / MRI v2025",
  keywords: [
    "neck imaging",
    "head and neck",
    "squamous cell",
    "SCC",
    "recurrence",
  ],
  tags: ["Neuroradiology", "Oncology", "Head & Neck"],
  metaDesc:
    "Free NI-RADS Calculator with separate ACR 2018 CT/PET-CT and 2025 MRI surveillance paths for treated head and neck cancer.",

  info: {
    text: `NI-RADS (Neck Imaging Reporting and Data System) is the ACR standardized system for reporting surveillance imaging in treated head and neck cancer patients.

The system assigns separate categories for:
• PRIMARY TUMOR SITE (with 2a/2b subcategories)
• CERVICAL LYMPH NODES

Categories:
• NI-RADS 0: Incomplete (prior imaging unavailable)
• NI-RADS 1: No evidence of recurrence
• NI-RADS 2a: Low suspicion - superficial/mucosal (direct visualization)
• NI-RADS 2b: Low suspicion - deep (short-term follow-up)
• NI-RADS 3: High suspicion (biopsy recommended)
• NI-RADS 4: Known/definite recurrence

Recurrence rates by category:
• NI-RADS 1: ~4%
• NI-RADS 2: ~17%
• NI-RADS 3: ~59%

The calculator keeps the legacy 2018 CT/PET-CT behavior separate from the reviewed 2025 MRI path. MRI v2025 is for surveillance after definitive/curative treatment, reports the primary site and neck separately, and does not specify a numeric ADC cutoff.

Note: Management text is source-provided and ungraded; NI-RADS supports, but does not replace, radiologist judgment.`,
    link: {
      label: "View ACR NI-RADS Resources",
      url: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/NI-RADS",
    },
  },

  fields: [
    {
      id: "nirads_version",
      label: "NI-RADS Modality / Version",
      subLabel: "Choose the source-specific pathway before entering findings",
      type: "radio",
      section: "Modality / Version",
      opts: [
        { value: "ct_pet_2018", label: "2018 CT/PET-CT" },
        { value: "mri_2025", label: "2025 MRI" },
      ],
    },

    // IMAGING MODALITY
    {
      id: "modality",
      label: "Imaging Modality",
      type: "radio",
      section: "2018 CT/PET-CT",
      showIf: (vals) => vals.nirads_version !== "mri_2025",
      opts: [
        { value: "cect", label: "Contrast-Enhanced CT" },
        { value: "mri", label: "MRI" },
        { value: "pet_ct", label: "PET/CT" },
      ],
    },

    // PRIOR IMAGING
    {
      id: "prior_available",
      label: "Prior Imaging Available for Comparison",
      type: "radio",
      section: "2018 CT/PET-CT",
      showIf: (vals) => vals.nirads_version !== "mri_2025",
      opts: [
        { value: "yes", label: "Yes - prior available" },
        { value: "no_pending", label: "No - will be obtained" },
        { value: "no_unavailable", label: "No - cannot be obtained" },
      ],
    },

    // ========== PRIMARY SITE SECTION ==========
    {
      id: "primary_heading",
      label: "PRIMARY SITE ASSESSMENT",
      type: "radio",
      section: "2018 CT/PET-CT",
      showIf: (vals) => vals.nirads_version !== "mri_2025",
      opts: [{ value: "header", label: "--- Primary Tumor Site Findings ---" }],
    },

    // PRIMARY CT/MRI FINDINGS
    {
      id: "primary_ct_finding",
      label: "Primary Site CT/MRI Finding",
      type: "radio",
      section: "2018 CT/PET-CT",
      showIf: (vals) =>
        vals.nirads_version !== "mri_2025" &&
        vals.prior_available !== "no_pending",
      opts: [
        {
          value: "expected",
          label:
            "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
        },
        {
          value: "focal_mucosal",
          label: "Focal mucosal abnormality (non-masslike enhancement)",
        },
        {
          value: "deep_soft_tissue",
          label:
            "Ill-defined deep soft tissue with mild differential enhancement",
        },
        {
          value: "discrete_mass",
          label:
            "New or enlarging discrete nodule/mass with intense enhancement",
        },
        {
          value: "definite_recurrence",
          label: "Definite recurrence (pathologically proven)",
        },
      ],
    },

    // PRIMARY PET FINDINGS (conditional)
    {
      id: "primary_pet_finding",
      label: "Primary Site FDG Uptake (PET)",
      type: "radio",
      section: "2018 CT/PET-CT",
      showIf: (vals) =>
        vals.nirads_version !== "mri_2025" &&
        vals.modality === "pet_ct" &&
        vals.prior_available !== "no_pending",
      opts: [
        { value: "none", label: "No abnormal uptake" },
        {
          value: "physiologic",
          label: "Physiologic or radiation mucositis pattern",
        },
        { value: "mild_focal", label: "Mild focal mucosal uptake" },
        { value: "mild_deep", label: "Mild uptake to ill-defined deep tissue" },
        {
          value: "intense_focal",
          label: "Intense focal uptake to discrete nodule/mass",
        },
      ],
    },

    // PRIMARY BONE EROSION
    {
      id: "primary_bone",
      label: "New Bone Erosion at Primary Site",
      type: "radio",
      section: "2018 CT/PET-CT",
      showIf: (vals) =>
        vals.nirads_version !== "mri_2025" &&
        vals.primary_ct_finding === "discrete_mass",
      opts: [
        { value: "no", label: "No new bone erosion" },
        { value: "yes", label: "Yes - new bone erosion" },
      ],
    },

    // ========== NECK NODE SECTION ==========
    {
      id: "neck_heading",
      label: "NECK LYMPH NODE ASSESSMENT",
      type: "radio",
      section: "2018 CT/PET-CT",
      showIf: (vals) => vals.nirads_version !== "mri_2025",
      opts: [
        { value: "header", label: "--- Cervical Lymph Node Findings ---" },
      ],
    },

    // NECK CT/MRI FINDINGS
    {
      id: "neck_ct_finding",
      label: "Neck Node CT/MRI Finding",
      type: "radio",
      section: "2018 CT/PET-CT",
      showIf: (vals) =>
        vals.nirads_version !== "mri_2025" &&
        vals.prior_available !== "no_pending",
      opts: [
        { value: "no_abnormal", label: "No abnormal lymph nodes" },
        {
          value: "residual_stable",
          label: "Residual nodal tissue - hypoenhancing, stable",
        },
        {
          value: "residual_new_enlarging",
          label:
            "New, enlarging, or residual abnormal node WITHOUT necrosis/ENE",
        },
        {
          value: "new_necrosis",
          label: "New/enlarging node WITH necrosis or extranodal extension",
        },
        {
          value: "definite_recurrence",
          label: "Definite nodal recurrence (pathologically proven)",
        },
      ],
    },

    // NECK PET FINDINGS (conditional)
    {
      id: "neck_pet_finding",
      label: "Neck Node FDG Uptake (PET)",
      type: "radio",
      section: "2018 CT/PET-CT",
      showIf: (vals) =>
        vals.nirads_version !== "mri_2025" &&
        vals.modality === "pet_ct" &&
        vals.prior_available !== "no_pending",
      opts: [
        { value: "none", label: "No abnormal nodal uptake" },
        {
          value: "mild_moderate",
          label: "Mild to moderate uptake without discrete mass",
        },
        {
          value: "intense_focal",
          label: "Intense focal uptake to new/enlarging node",
        },
      ],
    },

    // ========== MRI v2025 PATH ==========
    {
      id: "during_treatment",
      label: "Is imaging being performed during active treatment?",
      type: "radio",
      section: "2025 MRI — Scope",
      showIf: (vals) => vals.nirads_version === "mri_2025",
      opts: [
        { value: "no", label: "No — post-treatment surveillance" },
        { value: "yes", label: "Yes — during treatment (outside scope)" },
      ],
    },
    {
      id: "assessment_site",
      label: "MRI Assessment Site",
      subLabel: "Assign primary-site and neck-node assessments separately",
      type: "radio",
      section: "2025 MRI — Scope",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" && vals.during_treatment === "no",
      opts: [
        { value: "primary", label: "Primary Site" },
        { value: "neck", label: "Neck Nodes" },
      ],
    },
    {
      id: "primary_tumor_status",
      label: "Primary Tumor Site Status",
      type: "radio",
      section: "2025 MRI — Scope",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" &&
        vals.during_treatment === "no" &&
        vals.assessment_site === "primary",
      opts: [
        { value: "known", label: "Known primary site" },
        { value: "unknown", label: "Unknown primary (P-unknown primary)" },
      ],
    },
    {
      id: "assessable",
      label: "Can this site be assessed on the MRI?",
      type: "radio",
      section: "2025 MRI — Scope",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" &&
        vals.during_treatment === "no" &&
        vals.assessment_site &&
        !(vals.assessment_site === "primary" && vals.primary_tumor_status === "unknown"),
      opts: [
        { value: "yes", label: "Yes — assessable" },
        { value: "no", label: "No — technically not assessed" },
      ],
    },
    {
      id: "technical_reason",
      label: "Reason Site Is Not Assessed",
      type: "radio",
      section: "2025 MRI — Scope",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" && vals.assessable === "no",
      opts: [
        { value: "artifact", label: "Artifact" },
        { value: "motion", label: "Motion" },
        { value: "outside_fov", label: "Outside field of view" },
        { value: "other", label: "Other technical limitation" },
      ],
    },
    {
      id: "prior_status",
      label: "Prior Imaging Status",
      type: "radio",
      section: "2025 MRI — Comparison",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" &&
        vals.assessable === "yes" &&
        !(vals.assessment_site === "primary" && vals.primary_tumor_status === "unknown"),
      opts: [
        { value: "available", label: "Available now" },
        { value: "known_pending", label: "Known to exist and pending" },
        { value: "unavailable_not_pending", label: "Unavailable and not pending" },
      ],
    },
    {
      id: "timepoint",
      label: "Post-treatment Timepoint",
      type: "radio",
      section: "2025 MRI — Comparison",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" && vals.prior_status === "known_pending",
      opts: [
        { value: "new_baseline", label: "New post-treatment baseline" },
        { value: "subsequent_posttreatment", label: "Subsequent post-treatment study" },
      ],
    },
    {
      id: "node_temporal_status",
      label: "Neck Node Timing",
      subLabel: "Used to keep residual-node and new/enlarging-node rules separate",
      type: "radio",
      section: "2025 MRI — Findings",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" &&
        vals.assessment_site === "neck" &&
        vals.assessable === "yes" &&
        vals.prior_status !== "known_pending",
      opts: [
        { value: "residual", label: "Residual treated nodal tissue" },
        { value: "new_or_enlarging", label: "New or enlarging node" },
        { value: "not_applicable", label: "No temporal qualifier needed" },
      ],
    },
    {
      id: "primary_pattern_id",
      label: "Primary Site MRI Finding Pattern",
      type: "radio",
      section: "2025 MRI — Findings",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" &&
        vals.assessment_site === "primary" &&
        vals.primary_tumor_status === "known" &&
        vals.assessable === "yes" &&
        vals.prior_status &&
        vals.prior_status !== "known_pending",
      opts: patternOptions("primary"),
    },
    {
      id: "neck_pattern_id",
      label: "Neck Node MRI Finding Pattern",
      type: "radio",
      section: "2025 MRI — Findings",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" &&
        vals.assessment_site === "neck" &&
        vals.assessable === "yes" &&
        vals.prior_status &&
        vals.prior_status !== "known_pending",
      opts: patternOptions("neck"),
    },
    {
      id: "original_features_match",
      label: "Relationship to Original Tumor MRI Features",
      subLabel: "Compare DWI, enhancement, and T1/T2 signal",
      type: "radio",
      section: "2025 MRI — Qualifiers",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" &&
        [
          "p2b_mismatch_original",
          "p3_discrete_matching_mass",
          "p3_persistent_growing_mismatch_mass",
        ].includes(vals.primary_pattern_id),
      opts: [
        { value: "yes", label: "Matches original tumor features" },
        { value: "no", label: "Differs from original tumor features" },
        { value: "unknown", label: "Unknown / cannot determine" },
      ],
    },
    {
      id: "original_tumor_fdg_avid",
      label: "Was the Original Tumor FDG Avid?",
      subLabel: "Required for the PET/MRI discordance rule",
      type: "radio",
      section: "2025 MRI — Qualifiers",
      showIf: (vals) =>
        vals.nirads_version === "mri_2025" &&
        vals.neck_pattern_id === "n2_pet_mri_discordance",
      opts: [
        { value: "yes", label: "Yes — FDG avid" },
        { value: "no", label: "No — not FDG avid" },
        { value: "unknown", label: "Unknown" },
      ],
    },
  ],

  compute: (vals) =>
    vals.nirads_version === "mri_2025"
      ? computeNiradsMri2025Result(vals)
      : NIRADS._compute2018(vals),

  // Frozen legacy implementation. The public dispatcher defaults here when
  // no version is supplied, preserving all pre-v2025 callers and saved state.
  _compute2018: (vals) => {
    const {
      modality = "",
      prior_available = "",
      primary_ct_finding = "",
      primary_pet_finding = "",
      primary_bone = "",
      neck_ct_finding = "",
      neck_pet_finding = "",
    } = vals;

    // NI-RADS 0: Incomplete
    if (prior_available === "no_pending") {
      return {
        "Primary Site NI-RADS": "0 - Incomplete",
        "Neck NI-RADS": "0 - Incomplete",
        Management:
          "Obtain prior imaging for comparison, then reassign category",
        Note: "Prior imaging unavailable but will be procured. Reassign after review.",
        _severity: "info",
      };
    }

    // Validate required fields
    if (!primary_ct_finding) {
      return { Error: "Please select primary site findings." };
    }
    if (!neck_ct_finding) {
      return { Error: "Please select neck lymph node findings." };
    }

    const isPET = modality === "pet_ct";

    // ========== PRIMARY SITE CATEGORY ==========
    let primaryCategory = "";
    let primarySubcat = "";
    let primaryManagement = "";

    // Determine primary category based on CT/MRI
    switch (primary_ct_finding) {
      case "expected":
        primaryCategory = "1";
        break;
      case "focal_mucosal":
        primaryCategory = "2";
        primarySubcat = "a";
        break;
      case "deep_soft_tissue":
        primaryCategory = "2";
        primarySubcat = "b";
        break;
      case "discrete_mass":
        primaryCategory = "3";
        break;
      case "definite_recurrence":
        primaryCategory = "4";
        break;
    }

    // PET concordance rules
    if (isPET && primary_pet_finding) {
      // Discordance rules - assign lower adjacent score when discordant
      if (
        primary_ct_finding === "deep_soft_tissue" &&
        primary_pet_finding === "none"
      ) {
        // Deep tissue WITHOUT FDG uptake -> downgrade to 1
        primaryCategory = "1";
        primarySubcat = "";
      } else if (
        primary_ct_finding === "discrete_mass" &&
        (primary_pet_finding === "mild_focal" ||
          primary_pet_finding === "mild_deep")
      ) {
        // Mass with only mild uptake -> downgrade to 2b
        primaryCategory = "2";
        primarySubcat = "b";
      } else if (
        primary_ct_finding !== "discrete_mass" &&
        primary_pet_finding === "intense_focal"
      ) {
        // Intense uptake WITHOUT mass -> upgrade to 2b (not 3)
        if (primaryCategory === "1") {
          primaryCategory = "2";
          primarySubcat = "b";
        }
      }
    }

    // Bone erosion upgrades to 3
    if (primary_bone === "yes" && primaryCategory !== "4") {
      primaryCategory = "3";
      primarySubcat = "";
    }

    // Primary management
    switch (primaryCategory) {
      case "1":
        primaryManagement = "Routine surveillance (typically 6 months)";
        break;
      case "2":
        if (primarySubcat === "a") {
          primaryManagement =
            "Direct visual inspection (laryngoscopy/endoscopy)";
        } else {
          primaryManagement =
            "Short-term follow-up imaging (3 months) with CECT or PET/CT";
        }
        break;
      case "3":
        primaryManagement = "Biopsy recommended";
        break;
      case "4":
        primaryManagement = "Treatment planning";
        break;
    }

    // ========== NECK NODE CATEGORY ==========
    let neckCategory = "";
    let neckManagement = "";

    switch (neck_ct_finding) {
      case "no_abnormal":
      case "residual_stable":
        neckCategory = "1";
        break;
      case "residual_new_enlarging":
        neckCategory = "2";
        break;
      case "new_necrosis":
        neckCategory = "3";
        break;
      case "definite_recurrence":
        neckCategory = "4";
        break;
    }

    // PET concordance for neck
    if (isPET && neck_pet_finding) {
      if (
        neck_ct_finding === "residual_new_enlarging" &&
        neck_pet_finding === "none"
      ) {
        // New/enlarging node WITHOUT uptake -> downgrade to 1
        neckCategory = "1";
      } else if (
        neck_ct_finding === "residual_new_enlarging" &&
        neck_pet_finding === "intense_focal"
      ) {
        // New/enlarging with intense uptake -> upgrade to 3
        neckCategory = "3";
      }
    }

    // Neck management
    switch (neckCategory) {
      case "1":
        neckManagement = "Routine surveillance (typically 6 months)";
        break;
      case "2":
        neckManagement =
          "Short-term follow-up imaging (3 months) or PET/CT if not performed";
        break;
      case "3":
        neckManagement = "Biopsy or FNA of suspicious node";
        break;
      case "4":
        neckManagement = "Treatment planning";
        break;
    }

    // Build primary category string
    const primaryCatStr = primarySubcat
      ? `${primaryCategory}${primarySubcat}`
      : primaryCategory;

    // Get overall category (higher of the two)
    const overallCat = Math.max(
      parseInt(primaryCategory),
      parseInt(neckCategory),
    );

    // Risk estimates
    const riskByCategory = {
      1: "~4%",
      2: "~17%",
      3: "~59%",
      4: "100%",
    };

    // Build result
    const result = {
      "Primary Site NI-RADS": `${primaryCatStr} - ${getCategoryDescription(primaryCategory, primarySubcat)}`,
      "Primary Site Management": primaryManagement,
      "Neck NI-RADS": `${neckCategory} - ${getCategoryDescription(neckCategory, "")}`,
      "Neck Management": neckManagement,
      "Overall Assessment": `NI-RADS ${overallCat} - ${getCategoryDescription(overallCat.toString(), "")}`,
      "Estimated Recurrence Risk":
        riskByCategory[overallCat.toString()] || "N/A",
    };

    // Add notes
    const notes = [];

    if (isPET) {
      notes.push("PET findings incorporated using concordance rules");
    }

    if (primaryCategory !== neckCategory) {
      notes.push(
        "Primary site and neck categories differ - both reported separately",
      );
    }

    if (prior_available === "no_unavailable") {
      notes.push(
        "Categories assigned without prior comparison (prior unavailable)",
      );
    }

    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    result._severity =
      overallCat <= 1 ? "success" : overallCat <= 2 ? "warning" : "danger";

    return result;
  },

  refs: [
    {
      t: "Aiken AH, Rath TJ, Anzai Y, et al. ACR Neck Imaging Reporting and Data Systems (NI-RADS): A White Paper of the ACR NI-RADS Committee. J Am Coll Radiol. 2018;15(8):1097-1108.",
      u: "https://pubmed.ncbi.nlm.nih.gov/29983244/",
    },
    {
      t: "Krieger DA, Hudgins PA, Nayak GK, et al. Initial Performance of NI-RADS to Predict Residual or Recurrent Head and Neck Squamous Cell Carcinoma. AJNR Am J Neuroradiol. 2017;38(6):1193-1199.",
      u: "https://pubmed.ncbi.nlm.nih.gov/28364010/",
    },
    {
      t: "Juliano AF, Spieler B, Engel JD, Glastonbury CM. NI-RADS for head and neck cancer surveillance imaging. Clin Radiol. 2020;75(4):247-257.",
      u: "https://doi.org/10.1016/j.crad.2019.08.014",
    },
    {
      t: "ACR Neck Imaging Reporting and Data System (NI-RADS) Resources.",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/NI-RADS",
    },
    {
      t: "Bunch PM, Aiken AH, Baugnon KL, et al. ACR Neck Imaging Reporting and Data System for MRI Version 2025. J Am Coll Radiol. 2025;22(11):1325-1336.",
      u: "https://pubmed.ncbi.nlm.nih.gov/40754125/",
    },
    {
      t: "American College of Radiology. NI-RADS MRI v2025 Assessment Categories and Algorithms.",
      u: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/NI-RADS",
    },
    {
      t: "Wangaryattawanich P, Hirschmann A, Stable A. Best Practices: Application of NI-RADS for Posttreatment Surveillance Imaging. AJR Am J Roentgenol. 2020;215(5):1083-1092.",
      u: "https://doi.org/10.2214/AJR.19.22524",
    },
  ],
};

function getCategoryDescription(category, subcat) {
  const descriptions = {
    0: "Incomplete",
    1: "No Evidence of Recurrence",
    2: subcat === "a" ? "Low Suspicion (Superficial)" : "Low Suspicion (Deep)",
    3: "High Suspicion",
    4: "Known Recurrence",
  };
  return descriptions[category] || "Unknown";
}
