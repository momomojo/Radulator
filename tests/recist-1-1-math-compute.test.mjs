import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildRecistImpression,
  classifyRecistTimePoint,
  computeRecist11,
  validateRecistBaselineTarget,
} from "../src/components/calculators/RECIST11.jsx";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/recist-1-1-vectors.json", "utf8"),
);

assert.equal(fixture.sealedVectors.length, 29);
assert.equal(fixture.adversarialVectors.length, 48);

function executeVector(vector) {
  const operation = vector.operation || "classify";
  const input =
    operation === "classify" && vector.input.mode !== "non_target_only"
      ? { ...fixture.measurableDefaults, ...vector.input }
      : vector.input;
  const execute = () =>
    operation === "validate_baseline_target"
      ? validateRecistBaselineTarget(input)
      : classifyRecistTimePoint(input);

  if (vector.expectedError) {
    assert.throws(execute, {
      message: vector.expectedError,
    }, vector.id);
    return;
  }

  const actual = execute();
  for (const [key, expected] of Object.entries(vector.expected)) {
    assert.deepEqual(actual[key], expected, `${vector.id}/${key}`);
  }
}

for (const vector of fixture.sealedVectors) executeVector(vector);
for (const vector of fixture.adversarialVectors) executeVector(vector);

function targetLesion(overrides = {}) {
  return {
    id: "target-1",
    organ: "Liver",
    kind: "non_nodal",
    modality: "CT",
    plane: "axial",
    sliceThicknessMm: "5",
    baselineMeasurementMm: "40",
    currentStatus: "measured",
    currentMeasurementMm: "28",
    ...overrides,
  };
}

function measurableInputs(overrides = {}) {
  return {
    mode: "measurable",
    targetLesions: [targetLesion()],
    priorNadirSumMm: "40",
    nonTargetStatus: "none",
    newLesionStatus: "none",
    priorConfirmedTargetResponse: "none",
    priorConfirmedOverallResponse: "none",
    studyDesign: "randomized",
    endpoint: "other",
    reappearance: { confirmed: false },
    ...overrides,
  };
}

const exactPr = computeRecist11(measurableInputs());
assert.equal(exactPr.baseline_sum_mm, "40");
assert.equal(exactPr.current_sum_mm, "28");
assert.equal(exactPr.target_response, "PR");
assert.equal(exactPr.overall_response, "PR");
assert.match(buildRecistImpression(exactPr), /baseline 40 mm/);
assert.match(buildRecistImpression(exactPr), /prior nadir 40 mm/);

const nodalCr = computeRecist11(
  measurableInputs({
    targetLesions: [
      targetLesion({
        kind: "node",
        baselineMeasurementMm: "15",
        currentMeasurementMm: "8",
      }),
    ],
    priorNadirSumMm: "8",
  }),
);
assert.equal(nodalCr.current_sum_mm, "8");
assert.equal(nodalCr.target_response, "CR");
assert.equal(nodalCr.overall_response, "CR");

const missingSubsetPd = computeRecist11(
  measurableInputs({
    targetLesions: [
      targetLesion({
        id: "target-1",
        baselineMeasurementMm: "50",
        currentMeasurementMm: "25",
      }),
      targetLesion({
        id: "target-2",
        organ: "Lung",
        baselineMeasurementMm: "50",
        currentStatus: "missing",
        currentMeasurementMm: "",
      }),
    ],
    priorNadirSumMm: "20",
  }),
);
assert.equal(missingSubsetPd.current_sum_is_measured_subset, true);
assert.equal(missingSubsetPd.target_response, "PD");
assert.equal(missingSubsetPd.pd_driver, "measured_subset_definite_pd");

assert.throws(
  () =>
    computeRecist11(
      measurableInputs({
        targetLesions: [
          targetLesion({ id: "target-1" }),
          targetLesion({ id: "target-2" }),
          targetLesion({ id: "target-3" }),
        ],
      }),
    ),
  /at most five target lesions and two per organ/,
);

const targetNodalReappearance = computeRecist11(
  measurableInputs({
    targetLesions: [
      targetLesion({
        kind: "node",
        baselineMeasurementMm: "15",
        currentMeasurementMm: "10",
      }),
    ],
    priorNadirSumMm: "8",
    priorConfirmedTargetResponse: "CR",
    priorConfirmedOverallResponse: "CR",
    reappearance: {
      confirmed: true,
      source: "target:target-1",
    },
  }),
);
assert.equal(targetNodalReappearance.target_response, "PD");
assert.equal(targetNodalReappearance.overall_response, "PD");
assert.equal(targetNodalReappearance.pd_driver, "reappearance_after_cr");

assert.throws(
  () =>
    computeRecist11(
      measurableInputs({
        priorConfirmedOverallResponse: "CR",
        reappearance: {
          confirmed: true,
          source: "non_target",
          lesionKind: "non_nodal",
          unequivocal: false,
        },
      }),
    ),
  /non-target reappearance must be unequivocal/,
);

assert.throws(
  () =>
    computeRecist11(
      measurableInputs({
        priorConfirmedOverallResponse: "CR",
        reappearance: {
          confirmed: true,
          source: "unknown",
          lesionKind: "non_nodal",
          overallOnlyOverride: false,
        },
      }),
    ),
  /unknown reappearance compartment requires explicit overall-only override/,
);

const nonTargetOnly = computeRecist11({
  mode: "non_target_only",
  targetLesions: [],
  nonTargetStatus: "non_cr_non_pd",
  newLesionStatus: "none",
  priorConfirmedOverallResponse: "none",
  studyDesign: "randomized",
  endpoint: "other",
  reappearance: { confirmed: false },
});
const nonTargetCopy = buildRecistImpression(nonTargetOnly);
assert.equal(nonTargetOnly.overall_response, "NON_CR_NON_PD");
assert.match(nonTargetCopy, /Non-CR\/non-PD/);
assert.doesNotMatch(nonTargetCopy, /target sum|baseline|nadir|%/i);

const indeterminate = computeRecist11(
  measurableInputs({ newLesionStatus: "equivocal" }),
);
const indeterminateCopy = buildRecistImpression(indeterminate);
assert.match(indeterminateCopy, /time-point response unresolved/i);
assert.match(indeterminateCopy, /reassessment is required/i);
assert.doesNotMatch(indeterminateCopy, /Target-lesion sum/);

console.log(
  `RECIST 1.1 tests PASS: ${fixture.sealedVectors.length}/29 sealed vectors, ${fixture.adversarialVectors.length}/48 adversarial vectors, and lesion-derived workflow safeguards`,
);
