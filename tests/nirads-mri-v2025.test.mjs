import assert from "node:assert/strict";
import {
  NIRADS,
  MRI_2025_MANAGEMENT,
  MRI_2025_PATTERN_DEFINITIONS,
  classifyNiradsMri2025,
} from "../src/components/calculators/NIRADS.jsx";

const primary = {
  version: "mri_2025",
  assessment_site: "primary",
  during_treatment: false,
  assessable: true,
  primary_tumor_status: "known",
  prior_status: "available",
};

const neck = {
  version: "mri_2025",
  assessment_site: "neck",
  during_treatment: false,
  assessable: true,
  prior_status: "available",
};

const vectors = [
  ["p0-known-pending-prior", { ...primary, prior_status: "known_pending", timepoint: "new_baseline", pattern_ids: [] }, { status: "classified", category: "0", management_key: "primary.0" }],
  ["p-unknown-primary", { ...primary, primary_tumor_status: "unknown", prior_status: "unavailable_not_pending", pattern_ids: [] }, { status: "not_assessed", assessment_code: "P-unknown primary", category: null }],
  ["invalid-primary-category-0-without-new-baseline", { ...primary, prior_status: "known_pending", timepoint: "subsequent_posttreatment", pattern_ids: [] }, { status: "error", error: "category_0_requires_new_baseline" }],
  ["p1-diffuse-linear", { ...primary, pattern_ids: ["p1_diffuse_linear_mucosa"] }, { status: "classified", category: "1", management_key: "primary.1" }],
  ["p2a-focal-reduced-diffusion", { ...primary, pattern_ids: ["p2a_focal_reduced_diffusion"] }, { status: "classified", category: "2a", management_key: "primary.2a", delta_2018: "DWI-only descriptor has no source-literal CT/PET-CT equivalent; do not auto-assign a 2018 category" }],
  ["p2b-deep-intermediate-t2", { ...primary, pattern_ids: ["p2b_intermediate_t2_enhancement"] }, { status: "classified", category: "2b", management_key: "primary.2b" }],
  ["p2b-perineural-baseline", { ...primary, pattern_ids: ["p2b_baseline_thin_smooth_perineural"] }, { status: "classified", category: "2b", management_key: "primary.2b" }],
  ["p3-discrete-matching-mass", { ...primary, pattern_ids: ["p3_discrete_matching_mass"], original_features_match: "yes" }, { status: "classified", category: "3", management_key: "primary.3" }],
  ["p3-persistent-growing-mismatch", { ...primary, pattern_ids: ["p3_persistent_growing_mismatch_mass"], original_features_match: "no" }, { status: "classified", category: "3", management_key: "primary.3" }],
  ["p4-definitive-progression", { ...primary, pattern_ids: ["p4_definitive_recurrence"] }, { status: "classified", category: "4", management_key: "primary.4" }],
  ["n0-known-pending-prior", { ...neck, prior_status: "known_pending", timepoint: "new_baseline", pattern_ids: [] }, { status: "classified", category: "0", management_key: "neck.0" }],
  ["invalid-neck-category-0-without-new-baseline", { ...neck, prior_status: "known_pending", timepoint: "subsequent_posttreatment", pattern_ids: [] }, { status: "error", error: "category_0_requires_new_baseline" }],
  ["n1-no-abnormal-nodes", { ...neck, pattern_ids: ["n1_no_abnormal_nodes"] }, { status: "classified", category: "1", management_key: "neck.1" }],
  ["n1-residual-hypo-no-fdg", { ...neck, pattern_ids: ["n1_residual_hypo_no_fdg"], node_temporal_status: "residual" }, { status: "classified", category: "1", management_key: "neck.1" }],
  ["n2-residual-heterogeneous", { ...neck, pattern_ids: ["n2_residual_heterogeneous"], node_temporal_status: "residual" }, { status: "classified", category: "2", management_key: "neck.2" }],
  ["n2-new-enlarging-no-definitive-morphology", { ...neck, pattern_ids: ["n2_new_enlarging_no_definitive_morphology"], node_temporal_status: "new_or_enlarging" }, { status: "classified", category: "2", management_key: "neck.2" }],
  ["n2-pet-mri-discordance", { ...neck, pattern_ids: ["n2_pet_mri_discordance"], original_tumor_fdg_avid: "yes" }, { status: "classified", category: "2", management_key: "neck.2" }],
  ["n3-new-necrosis", { ...neck, pattern_ids: ["n3_new_enlarging_necrosis_cystic"], node_temporal_status: "new_or_enlarging" }, { status: "classified", category: "3", management_key: "neck.3" }],
  ["n3-residual-intense-fdg", { ...neck, pattern_ids: ["n3_residual_intense_fdg"], node_temporal_status: "residual" }, { status: "classified", category: "3", management_key: "neck.3" }],
  ["n4-definitive-progression", { ...neck, pattern_ids: ["n4_definitive_recurrence"] }, { status: "classified", category: "4", management_key: "neck.4" }],
  ["p-x-technical-unassessable", { ...primary, assessable: false, technical_reason: "artifact", pattern_ids: [] }, { status: "not_assessed", assessment_code: "P-x", category: null }],
  ["n-x-outside-fov", { ...neck, assessable: false, technical_reason: "outside_fov", pattern_ids: [] }, { status: "not_assessed", assessment_code: "N-x", category: null }],
  ["invalid-during-treatment", { ...primary, during_treatment: true, pattern_ids: ["p1_expected_changes"] }, { status: "error", error: "out_of_scope_during_treatment" }],
  ["invalid-version-mismatch", { ...primary, version: "ct_pet_2018", pattern_ids: ["p2a_focal_reduced_diffusion"] }, { status: "error", error: "version_mismatch" }],
  ["invalid-missing-pattern", { ...primary, pattern_ids: [] }, { status: "error", error: "insufficient_pattern" }],
  ["invalid-conflicting-patterns", { ...primary, pattern_ids: ["p2b_deep_ill_defined", "p3_discrete_matching_mass"] }, { status: "error", error: "conflicting_patterns" }],
  ["invalid-discordance-with-nonavid-original", { ...neck, pattern_ids: ["n2_pet_mri_discordance"], original_tumor_fdg_avid: "no" }, { status: "error", error: "discordance_rule_requires_original_fdg_avid" }],
  ["invalid-discordance-with-unknown-original-fdg-avidity", { ...neck, pattern_ids: ["n2_pet_mri_discordance"], original_tumor_fdg_avid: "unknown" }, { status: "error", error: "discordance_rule_requires_original_fdg_avid" }],
  ["invalid-discordance-with-missing-original-fdg-avidity", { ...neck, pattern_ids: ["n2_pet_mri_discordance"] }, { status: "error", error: "discordance_rule_requires_original_fdg_avid" }],
  ["invalid-n1-rule-on-new-node", { ...neck, pattern_ids: ["n1_residual_hypo_no_fdg"], node_temporal_status: "new_or_enlarging" }, { status: "error", error: "residual_node_pattern_requires_residual_status" }],
];

assert.equal(vectors.length, 30, "the complete independently reviewed vector set is present");
for (const [id, inputs, expected] of vectors) {
  assert.deepEqual(classifyNiradsMri2025(inputs), expected, id);
}

const expectedPatternCategories = {
  p0_known_pending_prior: "0",
  p1_expected_changes: "1",
  p1_diffuse_linear_mucosa: "1",
  p1_low_t1_t2_scar: "1",
  p1_t2_hyperintense_nonmass_edema: "1",
  p1_baseline_resolved: "1",
  p1_baseline_decreased_perineural: "1",
  p1_followup_stable_or_decreased: "1",
  p2a_focal_nonmass_mucosa: "2a",
  p2a_focal_reduced_diffusion: "2a",
  p2b_deep_ill_defined: "2b",
  p2b_mismatch_original: "2b",
  p2b_intermediate_t2_enhancement: "2b",
  p2b_baseline_partial_resolution: "2b",
  p2b_baseline_perineural_unchanged: "2b",
  p2b_baseline_thin_smooth_perineural: "2b",
  p3_discrete_matching_mass: "3",
  p3_persistent_growing_mismatch_mass: "3",
  p3_intense_focal_fdg: "3",
  p3_progressive_perineural: "3",
  p4_definitive_recurrence: "4",
  n0_known_pending_prior: "0",
  n1_no_abnormal_nodes: "1",
  n1_residual_hypo_no_fdg: "1",
  n2_residual_heterogeneous: "2",
  n2_residual_mild_mod_fdg: "2",
  n2_new_enlarging_no_definitive_morphology: "2",
  n2_pet_mri_discordance: "2",
  n3_residual_intense_fdg: "3",
  n3_residual_definite_enlargement_enhancement: "3",
  n3_new_enlarging_necrosis_cystic: "3",
  n3_new_enlarging_irregular_ene: "3",
  n3_new_enlarging_intense_fdg: "3",
  n4_definitive_recurrence: "4",
};

assert.deepEqual(
  Object.fromEntries(
    Object.entries(MRI_2025_PATTERN_DEFINITIONS).map(([id, definition]) => [
      id,
      definition.category,
    ]),
  ),
  expectedPatternCategories,
  "every reviewed source pattern is implemented with the bound category",
);
assert.equal(
  JSON.stringify(MRI_2025_PATTERN_DEFINITIONS).match(/\b(?:1f|2f)\b/g),
  null,
  "MRI v2025 must not expose archived 1f/2f categories",
);
assert.equal(
  /ADC\s*(?:<|>|≤|≥|=)|\b\d+(?:\.\d+)?\s*(?:×\s*10|mm\^?2)/i.test(
    JSON.stringify(MRI_2025_PATTERN_DEFINITIONS),
  ),
  false,
  "MRI v2025 must not invent a numeric ADC cutoff",
);

const preserved2018Cases = [
  ["incomplete", { modality: "cect", prior_available: "no_pending" }, { "Primary Site NI-RADS": "0 - Incomplete", "Neck NI-RADS": "0 - Incomplete", Management: "Obtain prior imaging for comparison, then reassign category", Note: "Prior imaging unavailable but will be procured. Reassign after review.", _severity: "info" }],
  ["category1", { modality: "cect", prior_available: "yes", primary_ct_finding: "expected", neck_ct_finding: "no_abnormal" }, { "Primary Site NI-RADS": "1 - No Evidence of Recurrence", "Primary Site Management": "Routine surveillance (typically 6 months)", "Neck NI-RADS": "1 - No Evidence of Recurrence", "Neck Management": "Routine surveillance (typically 6 months)", "Overall Assessment": "NI-RADS 1 - No Evidence of Recurrence", "Estimated Recurrence Risk": "~4%", _severity: "success" }],
  ["category2a", { modality: "cect", prior_available: "yes", primary_ct_finding: "focal_mucosal", neck_ct_finding: "no_abnormal" }, { "Primary Site NI-RADS": "2a - Low Suspicion (Superficial)", "Primary Site Management": "Direct visual inspection (laryngoscopy/endoscopy)", "Neck NI-RADS": "1 - No Evidence of Recurrence", "Neck Management": "Routine surveillance (typically 6 months)", "Overall Assessment": "NI-RADS 2 - Low Suspicion (Deep)", "Estimated Recurrence Risk": "~17%", "Clinical Notes": "Primary site and neck categories differ - both reported separately", _severity: "warning" }],
  ["category2b", { modality: "cect", prior_available: "yes", primary_ct_finding: "deep_soft_tissue", neck_ct_finding: "residual_new_enlarging" }, { "Primary Site NI-RADS": "2b - Low Suspicion (Deep)", "Primary Site Management": "Short-term follow-up imaging (3 months) with CECT or PET/CT", "Neck NI-RADS": "2 - Low Suspicion (Deep)", "Neck Management": "Short-term follow-up imaging (3 months) or PET/CT if not performed", "Overall Assessment": "NI-RADS 2 - Low Suspicion (Deep)", "Estimated Recurrence Risk": "~17%", _severity: "warning" }],
  ["pet-discordance", { modality: "pet_ct", prior_available: "yes", primary_ct_finding: "deep_soft_tissue", primary_pet_finding: "none", neck_ct_finding: "residual_new_enlarging", neck_pet_finding: "none" }, { "Primary Site NI-RADS": "1 - No Evidence of Recurrence", "Primary Site Management": "Routine surveillance (typically 6 months)", "Neck NI-RADS": "1 - No Evidence of Recurrence", "Neck Management": "Routine surveillance (typically 6 months)", "Overall Assessment": "NI-RADS 1 - No Evidence of Recurrence", "Estimated Recurrence Risk": "~4%", "Clinical Notes": "PET findings incorporated using concordance rules", _severity: "success" }],
  ["category3", { modality: "cect", prior_available: "yes", primary_ct_finding: "discrete_mass", primary_bone: "yes", neck_ct_finding: "new_necrosis" }, { "Primary Site NI-RADS": "3 - High Suspicion", "Primary Site Management": "Biopsy recommended", "Neck NI-RADS": "3 - High Suspicion", "Neck Management": "Biopsy or FNA of suspicious node", "Overall Assessment": "NI-RADS 3 - High Suspicion", "Estimated Recurrence Risk": "~59%", _severity: "danger" }],
  ["category4-unavailable-prior", { modality: "cect", prior_available: "no_unavailable", primary_ct_finding: "definite_recurrence", neck_ct_finding: "definite_recurrence" }, { "Primary Site NI-RADS": "4 - Known Recurrence", "Primary Site Management": "Treatment planning", "Neck NI-RADS": "4 - Known Recurrence", "Neck Management": "Treatment planning", "Overall Assessment": "NI-RADS 4 - Known Recurrence", "Estimated Recurrence Risk": "100%", "Clinical Notes": "Categories assigned without prior comparison (prior unavailable)", _severity: "danger" }],
  ["missing-primary", { modality: "cect", prior_available: "yes", neck_ct_finding: "no_abnormal" }, { Error: "Please select primary site findings." }],
  ["missing-neck", { modality: "cect", prior_available: "yes", primary_ct_finding: "expected" }, { Error: "Please select neck lymph node findings." }],
];

for (const [id, inputs, expected] of preserved2018Cases) {
  assert.deepEqual(NIRADS.compute(inputs), expected, `${id} implicit legacy dispatch`);
  assert.deepEqual(
    NIRADS.compute({ ...inputs, nirads_version: "ct_pet_2018" }),
    expected,
    `${id} explicit 2018 dispatch`,
  );
}

// ACR NI-RADS MRI v2025 management caveats (assessment-categories table and primary-site algorithm).
assert.match(MRI_2025_MANAGEMENT["primary.2b"], /MRI is preferred for perineural or skull-base concern/);
assert.match(MRI_2025_MANAGEMENT["primary.3"], /^Image-guided or clinical biopsy if clinically indicated;/);
assert.match(MRI_2025_MANAGEMENT["primary.3"], /multidisciplinary discussion can guide next steps when perineural biopsy is infeasible/);
assert.equal(MRI_2025_MANAGEMENT["neck.3"], "Image-guided or clinical biopsy if clinically indicated.");
assert.equal(MRI_2025_MANAGEMENT["neck.2"], "Short-interval MRI or PET.");

console.log(
  `NI-RADS tests OK: ${vectors.length} reviewed MRI vectors, ${Object.keys(expectedPatternCategories).length} source patterns, ${preserved2018Cases.length} legacy regressions`,
);
