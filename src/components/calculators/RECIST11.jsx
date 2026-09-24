import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function trackRecistEvent(exportName) {
  void import("@/lib/analytics").then((analytics) => {
    analytics[exportName]?.("recist-1-1", "RECIST 1.1 Tumor Response");
  });
}

const VALID_NON_TARGET = new Set([
  "none",
  "cr",
  "non_cr_non_pd",
  "unequivocal_pd",
  "not_evaluated",
]);
const VALID_NEW_LESION = new Set(["none", "unequivocal", "equivocal"]);
const VALID_PRIOR_RESPONSE = new Set(["none", "PR", "CR"]);
const VALID_REAPPEARANCE_COMPARTMENT = new Set([
  "none",
  "target",
  "non_target",
  "unknown",
]);

const POWERS_OF_TEN = [1n];

function powerOfTen(exponent) {
  while (POWERS_OF_TEN.length <= exponent) {
    POWERS_OF_TEN.push(POWERS_OF_TEN.at(-1) * 10n);
  }
  return POWERS_OF_TEN[exponent];
}

class ExactDecimal {
  constructor(coefficient, scale = 0) {
    let normalizedCoefficient = BigInt(coefficient);
    let normalizedScale = scale;
    while (
      normalizedScale > 0 &&
      normalizedCoefficient !== 0n &&
      normalizedCoefficient % 10n === 0n
    ) {
      normalizedCoefficient /= 10n;
      normalizedScale -= 1;
    }
    this.coefficient = normalizedCoefficient;
    this.scale = normalizedCoefficient === 0n ? 0 : normalizedScale;
  }

  static from(value, name = "value") {
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    ) {
      throw new Error(`${name} must be a finite number`);
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`${name} must be a finite number`);
    }

    const source = String(value).trim();
    const match = source.match(
      /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/,
    );
    if (!match) throw new Error(`${name} must be a finite number`);

    const sign = match[1] === "-" ? -1n : 1n;
    const integerPart = match[2] || "0";
    const fractionPart = match[3] ?? match[4] ?? "";
    const exponent = Number(match[5] || 0);
    if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) {
      throw new Error(`${name} must be a finite number`);
    }

    let coefficient = BigInt(`${integerPart}${fractionPart}` || "0") * sign;
    let scale = fractionPart.length - exponent;
    if (scale < 0) {
      coefficient *= powerOfTen(-scale);
      scale = 0;
    }
    return new ExactDecimal(coefficient, scale);
  }

  static zero() {
    return new ExactDecimal(0n);
  }

  alignedCoefficients(other) {
    const scale = Math.max(this.scale, other.scale);
    return [
      this.coefficient * powerOfTen(scale - this.scale),
      other.coefficient * powerOfTen(scale - other.scale),
      scale,
    ];
  }

  compare(otherValue) {
    const other =
      otherValue instanceof ExactDecimal
        ? otherValue
        : ExactDecimal.from(otherValue);
    const [left, right] = this.alignedCoefficients(other);
    return left < right ? -1 : left > right ? 1 : 0;
  }

  add(otherValue) {
    const other =
      otherValue instanceof ExactDecimal
        ? otherValue
        : ExactDecimal.from(otherValue);
    const [left, right, scale] = this.alignedCoefficients(other);
    return new ExactDecimal(left + right, scale);
  }

  subtract(otherValue) {
    const other =
      otherValue instanceof ExactDecimal
        ? otherValue
        : ExactDecimal.from(otherValue);
    const [left, right, scale] = this.alignedCoefficients(other);
    return new ExactDecimal(left - right, scale);
  }

  multiplyInteger(multiplier) {
    return new ExactDecimal(this.coefficient * BigInt(multiplier), this.scale);
  }

  isZero() {
    return this.coefficient === 0n;
  }

  toString() {
    if (this.coefficient === 0n) return "0";
    const negative = this.coefficient < 0n;
    const digits = (negative ? -this.coefficient : this.coefficient).toString();
    if (this.scale === 0) return `${negative ? "-" : ""}${digits}`;
    const padded = digits.padStart(this.scale + 1, "0");
    const splitAt = padded.length - this.scale;
    return `${negative ? "-" : ""}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
  }
}

function sumDecimals(values) {
  return values.reduce(
    (sum, value) => sum.add(value),
    ExactDecimal.zero(),
  );
}

function ratioToDecimalString(numerator, denominator, maxFractionDigits = 28) {
  if (denominator === 0n) return null;
  const negative = (numerator < 0n) !== (denominator < 0n);
  let remainderNumerator = numerator < 0n ? -numerator : numerator;
  const positiveDenominator = denominator < 0n ? -denominator : denominator;
  const integerPart = remainderNumerator / positiveDenominator;
  let remainder = remainderNumerator % positiveDenominator;
  let fraction = "";
  while (remainder !== 0n && fraction.length < maxFractionDigits) {
    remainder *= 10n;
    fraction += (remainder / positiveDenominator).toString();
    remainder %= positiveDenominator;
  }
  fraction = fraction.replace(/0+$/, "");
  const magnitude = fraction ? `${integerPart}.${fraction}` : `${integerPart}`;
  return negative && magnitude !== "0" ? `-${magnitude}` : magnitude;
}

function percentageParts(current, reference) {
  if (reference.isZero()) return null;
  const difference = current.subtract(reference);
  const numerator =
    difference.coefficient * 100n * powerOfTen(reference.scale);
  const denominator =
    reference.coefficient * powerOfTen(difference.scale);
  return { difference, numerator, denominator };
}

function percentageString(current, reference) {
  const parts = percentageParts(current, reference);
  return parts
    ? ratioToDecimalString(parts.numerator, parts.denominator)
    : null;
}

function percentageOneDecimal(current, reference) {
  const parts = percentageParts(current, reference);
  if (!parts) return null;
  const negative = parts.numerator < 0n;
  const numerator = (negative ? -parts.numerator : parts.numerator) * 10n;
  const denominator = parts.denominator < 0n
    ? -parts.denominator
    : parts.denominator;
  let roundedTenths = numerator / denominator;
  if ((numerator % denominator) * 2n >= denominator) roundedTenths += 1n;
  const whole = roundedTenths / 10n;
  const fraction = roundedTenths % 10n;
  const prefix = negative && roundedTenths !== 0n ? "-" : "";
  return `${prefix}${whole}.${fraction}`;
}

function exactMinimum(left, right) {
  return left.compare(right) <= 0 ? left : right;
}

function targetSumMeetsPd(current, priorNadir) {
  return (
    !priorNadir.isZero() &&
    current.multiplyInteger(5).compare(priorNadir.multiplyInteger(6)) >= 0 &&
    current.subtract(priorNadir).compare(5) >= 0
  );
}

export function validateRecistBaselineTarget(input) {
  const kind = input.kind;
  const modality = input.modality;
  const measurement = ExactDecimal.from(
    input.measurement_mm,
    "measurement_mm",
  );
  if (measurement.compare(0) < 0) {
    throw new Error("measurement_mm must be >= 0");
  }
  const sliceThickness = ExactDecimal.from(
    input.slice_thickness_mm ?? 5,
    "slice_thickness_mm",
  );
  if (sliceThickness.compare(0) <= 0) {
    throw new Error("slice_thickness_mm must be > 0");
  }

  if (kind === "node") {
    if (!new Set(["CT", "MRI"]).has(modality)) {
      throw new Error(
        "node target validation requires CT or MRI short-axis measurement",
      );
    }
    if (measurement.compare(15) >= 0) {
      return { classification: "measurable_target_candidate" };
    }
    if (measurement.compare(10) >= 0) {
      return { classification: "non_target_pathologic" };
    }
    return { classification: "non_pathologic" };
  }
  if (kind !== "non_nodal") {
    throw new Error("kind must be node or non_nodal");
  }

  let threshold;
  if (new Set(["CT", "MRI"]).has(modality)) {
    threshold =
      sliceThickness.compare(5) <= 0
        ? ExactDecimal.from(10)
        : sliceThickness.multiplyInteger(2);
  } else if (modality === "clinical_caliper") {
    threshold = ExactDecimal.from(10);
  } else if (modality === "chest_xray") {
    threshold = ExactDecimal.from(20);
  } else {
    throw new Error("unsupported modality");
  }
  return {
    classification:
      measurement.compare(threshold) >= 0
        ? "measurable_target_candidate"
        : "non_measurable",
  };
}

function deriveReappearanceState(caseData, priorOverall, mode) {
  const active = Boolean(caseData.reappeared_malignant_lesion);
  const compartment = caseData.reappearing_lesion_compartment ?? "none";
  if (!VALID_REAPPEARANCE_COMPARTMENT.has(compartment)) {
    throw new Error("invalid reappearing_lesion_compartment");
  }
  if (!active) {
    if (compartment !== "none") {
      throw new Error(
        "reappearance compartment requires reappeared_malignant_lesion",
      );
    }
    return {
      afterPriorOverallCr: false,
      compartment: "none",
      overallOnly: false,
    };
  }
  if (compartment === "none") {
    throw new Error("reappearing lesion compartment is required");
  }
  if (mode === "non_target_only" && compartment === "target") {
    throw new Error("target reappearance is invalid in non-target-only mode");
  }
  if (caseData.reappearing_lesion_is_node) {
    const nodeMeasurement = ExactDecimal.from(
      caseData.reappearing_node_short_axis_mm,
      "reappearing_node_short_axis_mm",
    );
    if (nodeMeasurement.compare(10) < 0) {
      throw new Error(
        "reappearing nodal lesion must be >= 10 mm short axis",
      );
    }
  }
  if (
    compartment === "non_target" &&
    !caseData.reappearance_unequivocal
  ) {
    throw new Error("non-target reappearance must be unequivocal");
  }
  const explicitOverallOnly = Boolean(
    caseData.reappearance_overall_only_override,
  );
  if (compartment === "unknown" && !explicitOverallOnly) {
    throw new Error(
      "unknown reappearance compartment requires explicit overall-only override",
    );
  }
  if (
    mode === "measurable" &&
    compartment === "target" &&
    caseData.all_target_cr
  ) {
    throw new Error("target reappearance conflicts with all_target_cr");
  }
  return {
    afterPriorOverallCr: priorOverall === "CR",
    compartment,
    overallOnly: compartment === "unknown" && explicitOverallOnly,
  };
}

function baseOverallResponse(target, nonTarget) {
  if (target === "PD" || nonTarget === "unequivocal_pd") return "PD";
  if (target === "NE") return "NE";
  if (target === "INDETERMINATE_REAPPEARANCE") return "INDETERMINATE";
  if (target === "CR") {
    if (new Set(["none", "cr"]).has(nonTarget)) return "CR";
    if (new Set(["non_cr_non_pd", "not_evaluated"]).has(nonTarget)) {
      return "PR";
    }
  }
  if (
    new Set(["PR", "SD"]).has(target) &&
    new Set(["none", "cr", "non_cr_non_pd", "not_evaluated"]).has(
      nonTarget,
    )
  ) {
    return target;
  }
  return "NE";
}

function classifyNonTargetOnly(caseData) {
  const nonTarget = caseData.non_target_status;
  const newLesion = caseData.new_lesion_status;
  const priorOverall = caseData.prior_confirmed_overall_response ?? "none";
  if (
    !VALID_NON_TARGET.has(nonTarget) ||
    nonTarget === "none"
  ) {
    throw new Error(
      "non-target-only mode requires cr, non_cr_non_pd, unequivocal_pd, or not_evaluated",
    );
  }
  if (!VALID_NEW_LESION.has(newLesion)) {
    throw new Error("invalid new_lesion_status");
  }
  if (!VALID_PRIOR_RESPONSE.has(priorOverall)) {
    throw new Error("invalid prior_confirmed_overall_response");
  }
  const reappearance = deriveReappearanceState(
    caseData,
    priorOverall,
    "non_target_only",
  );
  if (reappearance.afterPriorOverallCr) {
    return {
      overall_response: "PD",
      pd_driver: "reappearance_after_cr",
      ...(reappearance.overallOnly
        ? { reappearance_scope: "overall_only" }
        : {}),
    };
  }
  if (nonTarget === "unequivocal_pd") {
    return { overall_response: "PD", pd_driver: "non_target" };
  }
  if (newLesion === "unequivocal") {
    return { overall_response: "PD", pd_driver: "new_lesion" };
  }
  const base = {
    cr: "CR",
    non_cr_non_pd: "NON_CR_NON_PD",
    not_evaluated: "NE",
  }[nonTarget];
  if (newLesion === "equivocal") {
    return {
      overall_response: "INDETERMINATE",
      provisional_base_response: base,
      reassess: true,
    };
  }
  return { overall_response: base };
}

export function classifyRecistTimePoint(caseData) {
  if (caseData.mode === "non_target_only") {
    return classifyNonTargetOnly(caseData);
  }
  if (caseData.mode !== "measurable") {
    throw new Error("mode must be measurable or non_target_only");
  }

  const baseline = ExactDecimal.from(
    caseData.baseline_sum_mm,
    "baseline_sum_mm",
  );
  const priorNadir = ExactDecimal.from(
    caseData.prior_nadir_sum_mm,
    "prior_nadir_sum_mm",
  );
  const current = ExactDecimal.from(
    caseData.current_sum_mm,
    "current_sum_mm",
  );
  if (baseline.compare(0) <= 0) {
    throw new Error("baseline_sum_mm must be > 0");
  }
  if (priorNadir.compare(0) < 0 || current.compare(0) < 0) {
    throw new Error(
      "prior_nadir_sum_mm and current_sum_mm must be >= 0",
    );
  }
  if (priorNadir.compare(baseline) > 0) {
    throw new Error("prior_nadir_sum_mm cannot exceed baseline_sum_mm");
  }

  const nonTarget = caseData.non_target_status;
  const newLesion = caseData.new_lesion_status;
  const priorTarget = caseData.prior_confirmed_target_response ?? "none";
  const priorOverall = caseData.prior_confirmed_overall_response ?? "none";
  if (!VALID_NON_TARGET.has(nonTarget)) {
    throw new Error("invalid non_target_status");
  }
  if (!VALID_NEW_LESION.has(newLesion)) {
    throw new Error("invalid new_lesion_status");
  }
  if (!VALID_PRIOR_RESPONSE.has(priorTarget)) {
    throw new Error("invalid prior_confirmed_target_response");
  }
  if (!VALID_PRIOR_RESPONSE.has(priorOverall)) {
    throw new Error("invalid prior_confirmed_overall_response");
  }
  const reappearance = deriveReappearanceState(
    caseData,
    priorOverall,
    "measurable",
  );

  const result = {
    baseline_change_pct: percentageString(current, baseline),
    nadir_change_pct: percentageString(current, priorNadir),
    display_baseline_change_1dp: percentageOneDecimal(current, baseline),
    display_nadir_change_1dp: percentageOneDecimal(current, priorNadir),
    absolute_nadir_change_mm: current.subtract(priorNadir).toString(),
    updated_nadir_sum_mm: exactMinimum(priorNadir, current).toString(),
  };

  let targetResponse;
  if (
    reappearance.afterPriorOverallCr &&
    reappearance.compartment === "target"
  ) {
    targetResponse = "PD";
    result.pd_driver = "reappearance_after_cr";
  } else if (!caseData.target_measurements_complete) {
    if (caseData.measured_subset_definite_pd) {
      targetResponse = "PD";
      result.pd_driver = "measured_subset_definite_pd";
    } else {
      targetResponse = "NE";
    }
  } else if (caseData.all_target_cr) {
    targetResponse = "CR";
  } else if (priorNadir.isZero() && current.compare(0) > 0) {
    targetResponse = "INDETERMINATE_REAPPEARANCE";
  } else if (targetSumMeetsPd(current, priorNadir)) {
    targetResponse = "PD";
    result.pd_driver = "target_sum";
  } else if (priorTarget === "PR") {
    targetResponse = "PR";
    result.continued_response_rule = true;
  } else if (
    current.multiplyInteger(10).compare(baseline.multiplyInteger(7)) <= 0
  ) {
    targetResponse = "PR";
  } else {
    targetResponse = "SD";
  }
  result.target_response = targetResponse;

  if (reappearance.afterPriorOverallCr) {
    result.overall_response = "PD";
    result.pd_driver = "reappearance_after_cr";
    if (reappearance.overallOnly) {
      result.reappearance_scope = "overall_only";
    }
    return result;
  }

  const base = baseOverallResponse(targetResponse, nonTarget);
  if (base === "PD") {
    result.overall_response = "PD";
    if (nonTarget === "unequivocal_pd") result.pd_driver = "non_target";
    return result;
  }
  if (newLesion === "unequivocal") {
    result.overall_response = "PD";
    result.pd_driver = "new_lesion";
    return result;
  }
  if (
    newLesion === "equivocal" ||
    targetResponse === "INDETERMINATE_REAPPEARANCE"
  ) {
    result.overall_response = "INDETERMINATE";
    result.provisional_base_response =
      base === "INDETERMINATE" ? "UNRESOLVED" : base;
    result.reassess = true;
    return result;
  }
  result.overall_response = base;
  return result;
}

function parseCurrentLesionMeasurement(lesion, index) {
  if (lesion.currentStatus === "disappeared") return ExactDecimal.zero();
  if (lesion.currentStatus === "too_small_to_measure") {
    return ExactDecimal.from(5);
  }
  if (lesion.currentStatus === "missing") return null;
  if (lesion.currentStatus !== "measured") {
    throw new Error(`Target lesion ${index + 1} has an invalid current status.`);
  }
  const measurement = ExactDecimal.from(
    lesion.currentMeasurementMm,
    `Target lesion ${index + 1} current measurement`,
  );
  if (measurement.compare(0) < 0) {
    throw new Error("Current measurements must be finite and >=0.");
  }
  return measurement;
}

function deriveReappearanceInput(reappearance, targetLesions, mode) {
  if (!reappearance?.confirmed) {
    return {
      reappeared_malignant_lesion: false,
      reappearing_lesion_compartment: "none",
    };
  }
  const source = reappearance.source || "none";
  if (source.startsWith("target:")) {
    if (mode === "non_target_only") {
      throw new Error("target reappearance is invalid in non-target-only mode");
    }
    const targetId = source.slice("target:".length);
    const lesion = targetLesions.find((item) => item.id === targetId);
    if (!lesion) throw new Error("Select the reappearing target lesion.");
    const currentMeasurement = parseCurrentLesionMeasurement(
      lesion,
      targetLesions.indexOf(lesion),
    );
    if (!currentMeasurement) {
      throw new Error(
        "A reappearing target lesion requires a current measurement or disappeared/too-small state.",
      );
    }
    return {
      reappeared_malignant_lesion: true,
      reappearing_lesion_compartment: "target",
      reappearing_lesion_is_node: lesion.kind === "node",
      ...(lesion.kind === "node"
        ? {
            reappearing_node_short_axis_mm: currentMeasurement.toString(),
          }
        : {}),
    };
  }
  if (!new Set(["non_target", "unknown"]).has(source)) {
    throw new Error("reappearing lesion compartment is required");
  }
  const isNode = reappearance.lesionKind === "node";
  return {
    reappeared_malignant_lesion: true,
    reappearing_lesion_compartment: source,
    reappearing_lesion_is_node: isNode,
    ...(isNode
      ? { reappearing_node_short_axis_mm: reappearance.nodeShortAxisMm }
      : {}),
    reappearance_unequivocal:
      source === "non_target" && Boolean(reappearance.unequivocal),
    reappearance_overall_only_override:
      source === "unknown" && Boolean(reappearance.overallOnlyOverride),
  };
}

function confirmationSummary(studyDesign, endpoint) {
  if (studyDesign === "non_randomized" && endpoint === "response_primary") {
    return "CR or PR generally requires protocol-specified confirmation at a subsequent time point.";
  }
  return "Response confirmation is not generally required by RECIST 1.1 for this design/endpoint selection; follow the study protocol.";
}

export function computeRecist11(inputs) {
  const mode = inputs.mode;
  if (!new Set(["measurable", "non_target_only"]).has(mode)) {
    throw new Error("Select measurable or non-target-only disease.");
  }
  const nonTargetStatus = inputs.nonTargetStatus ?? "none";
  const newLesionStatus = inputs.newLesionStatus ?? "none";
  const priorTarget = inputs.priorConfirmedTargetResponse ?? "none";
  const priorOverall = inputs.priorConfirmedOverallResponse ?? "none";
  const targetLesions = Array.isArray(inputs.targetLesions)
    ? inputs.targetLesions
    : [];
  const reappearanceInput = deriveReappearanceInput(
    inputs.reappearance,
    targetLesions,
    mode,
  );

  if (mode === "non_target_only") {
    const classified = classifyRecistTimePoint({
      mode,
      non_target_status: nonTargetStatus,
      new_lesion_status: newLesionStatus,
      prior_confirmed_overall_response: priorOverall,
      ...reappearanceInput,
    });
    return {
      ...classified,
      mode,
      non_target_status: nonTargetStatus,
      new_lesion_status: newLesionStatus,
      confirmation_summary: confirmationSummary(
        inputs.studyDesign,
        inputs.endpoint,
      ),
    };
  }

  if (targetLesions.length < 1 || targetLesions.length > 5) {
    throw new Error(
      "RECIST 1.1 permits at most five target lesions and two per organ.",
    );
  }
  const stableIds = new Set();
  const organCounts = new Map();
  const baselineMeasurements = [];
  const currentMeasurements = [];
  const lesionSummaries = [];

  targetLesions.forEach((lesion, index) => {
    if (!lesion.id || stableIds.has(lesion.id)) {
      throw new Error("Each target lesion requires a unique stable identifier.");
    }
    stableIds.add(lesion.id);
    const organ = String(lesion.organ || "").trim();
    if (!organ) throw new Error(`Target lesion ${index + 1} requires an organ.`);
    const organKey = organ.toLocaleLowerCase();
    const nextOrganCount = (organCounts.get(organKey) || 0) + 1;
    organCounts.set(organKey, nextOrganCount);
    if (nextOrganCount > 2) {
      throw new Error(
        "RECIST 1.1 permits at most five target lesions and two per organ.",
      );
    }
    if (!lesion.plane) {
      throw new Error(`Target lesion ${index + 1} requires a measurement plane.`);
    }

    const baseline = ExactDecimal.from(
      lesion.baselineMeasurementMm,
      `Target lesion ${index + 1} baseline measurement`,
    );
    const validation = validateRecistBaselineTarget({
      kind: lesion.kind,
      modality: lesion.modality,
      measurement_mm: baseline.toString(),
      slice_thickness_mm: lesion.sliceThicknessMm ?? 5,
    });
    if (validation.classification !== "measurable_target_candidate") {
      if (lesion.kind === "node") {
        throw new Error(
          "A nodal target must be >=15 mm short axis at baseline.",
        );
      }
      throw new Error(
        "This baseline lesion is non-measurable for the selected modality/slice thickness.",
      );
    }
    baselineMeasurements.push(baseline);

    const current = parseCurrentLesionMeasurement(lesion, index);
    currentMeasurements.push(current);
    lesionSummaries.push({
      id: lesion.id,
      organ,
      kind: lesion.kind,
      baseline_mm: baseline.toString(),
      current_status: lesion.currentStatus,
      current_mm: current?.toString() ?? null,
      imputed_5_mm: lesion.currentStatus === "too_small_to_measure",
    });
  });

  const baselineSum = sumDecimals(baselineMeasurements);
  if (baselineSum.compare(0) <= 0) {
    throw new Error("Baseline target sum must be >0 mm.");
  }
  const measuredCurrent = currentMeasurements.filter(Boolean);
  const currentLowerBound = sumDecimals(measuredCurrent);
  const measurementsComplete = measuredCurrent.length === targetLesions.length;
  const allTargetCr =
    measurementsComplete &&
    targetLesions.every((lesion, index) => {
      if (lesion.kind === "node") {
        return currentMeasurements[index].compare(10) < 0;
      }
      return lesion.currentStatus === "disappeared";
    });

  const priorNadir = ExactDecimal.from(
    inputs.priorNadirSumMm,
    "prior_nadir_sum_mm",
  );
  const classified = classifyRecistTimePoint({
    mode,
    baseline_sum_mm: baselineSum.toString(),
    prior_nadir_sum_mm: priorNadir.toString(),
    current_sum_mm: currentLowerBound.toString(),
    all_target_cr: allTargetCr,
    target_measurements_complete: measurementsComplete,
    measured_subset_definite_pd:
      !measurementsComplete && targetSumMeetsPd(currentLowerBound, priorNadir),
    non_target_status: nonTargetStatus,
    new_lesion_status: newLesionStatus,
    prior_confirmed_target_response: priorTarget,
    prior_confirmed_overall_response: priorOverall,
    ...reappearanceInput,
  });

  return {
    ...classified,
    mode,
    baseline_sum_mm: baselineSum.toString(),
    current_sum_mm: currentLowerBound.toString(),
    current_sum_is_measured_subset: !measurementsComplete,
    prior_nadir_sum_mm: priorNadir.toString(),
    lesion_summaries: lesionSummaries,
    non_target_status: nonTargetStatus,
    new_lesion_status: newLesionStatus,
    confirmation_summary: confirmationSummary(
      inputs.studyDesign,
      inputs.endpoint,
    ),
  };
}

export function computeRecist11Result(inputs) {
  try {
    return computeRecist11(inputs);
  } catch (error) {
    return { Error: error instanceof Error ? error.message : String(error) };
  }
}

const RESPONSE_LABELS = {
  CR: "Complete Response",
  PR: "Partial Response",
  SD: "Stable Disease",
  PD: "Progressive Disease",
  NE: "Not Evaluable",
  INDETERMINATE: "Indeterminate",
  INDETERMINATE_REAPPEARANCE: "Indeterminate reappearance",
  NON_CR_NON_PD: "Non-CR/non-PD",
};

const NON_TARGET_LABELS = {
  none: "None",
  cr: "CR",
  non_cr_non_pd: "Non-CR/non-PD",
  unequivocal_pd: "Unequivocal PD",
  not_evaluated: "Not evaluated",
};

const NEW_LESION_LABELS = {
  none: "None",
  equivocal: "Equivocal",
  unequivocal: "Unequivocal malignant new lesion",
};

const CURRENT_STATUS_LABELS = {
  measured: "Measured",
  disappeared: "Disappeared (0 mm)",
  too_small_to_measure: "Present but too small to measure (5 mm imputed)",
  missing: "Required measurement missing",
};

const PD_DRIVER_LABELS = {
  target_sum: "target sum",
  measured_subset_definite_pd: "measured target subset independently proves PD",
  non_target: "unequivocal non-target progression",
  new_lesion: "unequivocal new lesion",
  reappearance_after_cr: "reappearance after confirmed overall CR",
};

function withSign(value, suffix = "") {
  if (value === null || value === undefined) return "not calculable";
  const prefix = !String(value).startsWith("-") && Number(value) > 0 ? "+" : "";
  return `${prefix}${value}${suffix}`;
}

export function buildRecistImpression(result) {
  if (result.overall_response === "INDETERMINATE") {
    const reason =
      result.new_lesion_status === "equivocal"
        ? "a possible new lesion is equivocal; reassessment is required"
        : "the prior target nadir is zero and reappearance cannot be classified safely; manual RECIST review is required";
    return `RECIST 1.1 time-point response unresolved: indeterminate because ${reason}. Clinician/radiologist and protocol confirmation required.`;
  }
  if (result.overall_response === "NE") {
    const reason =
      result.mode === "measurable"
        ? "a required target measurement is missing and available measurements do not independently prove progression"
        : "non-target disease was not evaluated";
    return `RECIST 1.1 time-point response unresolved: Not Evaluable (NE) because ${reason}. Clinician/radiologist and protocol confirmation required.`;
  }

  const response = result.overall_response;
  const category =
    response === "NON_CR_NON_PD"
      ? "Non-CR/non-PD"
      : `${RESPONSE_LABELS[response]} (${response})`;
  const driver = result.pd_driver
    ? ` Driver: ${PD_DRIVER_LABELS[result.pd_driver]}.`
    : "";

  if (result.mode === "non_target_only") {
    return `RECIST 1.1 time-point response: ${category}. Non-target lesions: ${NON_TARGET_LABELS[result.non_target_status]}. New lesions: ${NEW_LESION_LABELS[result.new_lesion_status]}.${driver}`;
  }

  const nadirChange =
    result.display_nadir_change_1dp === null
      ? "percentage not calculable"
      : withSign(result.display_nadir_change_1dp, "%");
  return `RECIST 1.1 time-point response: ${category}. Target-lesion sum ${result.current_sum_mm} mm (${withSign(result.display_baseline_change_1dp, "%")} vs baseline ${result.baseline_sum_mm} mm; ${nadirChange} / ${withSign(result.absolute_nadir_change_mm, " mm")} vs prior nadir ${result.prior_nadir_sum_mm} mm). Non-target lesions: ${NON_TARGET_LABELS[result.non_target_status]}. New lesions: ${NEW_LESION_LABELS[result.new_lesion_status]}.${driver}`;
}

function initialLesion(id) {
  return {
    id,
    organ: "",
    kind: "non_nodal",
    modality: "CT",
    plane: "axial",
    sliceThicknessMm: "5",
    baselineMeasurementMm: "",
    currentStatus: "measured",
    currentMeasurementMm: "",
  };
}

function SelectControl({ id, label, value, onChange, children, help, ariaLabel }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
      >
        {children}
      </select>
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function CheckboxControl({ id, checked, onChange, children }) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-5 w-5 shrink-0 accent-gray-600"
      />
      <span>{children}</span>
    </label>
  );
}

function Recist11Calculator() {
  const nextLesionId = useRef(2);
  const [mode, setMode] = useState("measurable");
  const [targetLesions, setTargetLesions] = useState([
    initialLesion("target-1"),
  ]);
  const [priorNadirSumMm, setPriorNadirSumMm] = useState("");
  const [nonTargetStatus, setNonTargetStatus] = useState("none");
  const [newLesionStatus, setNewLesionStatus] = useState("none");
  const [priorTarget, setPriorTarget] = useState("none");
  const [priorOverall, setPriorOverall] = useState("none");
  const [studyDesign, setStudyDesign] = useState("randomized");
  const [endpoint, setEndpoint] = useState("other");
  const [reappearance, setReappearance] = useState({
    confirmed: false,
    source: "none",
    lesionKind: "non_nodal",
    nodeShortAxisMm: "",
    unequivocal: false,
    overallOnlyOverride: false,
  });
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [copyStatus, setCopyStatus] = useState("");

  const invalidate = () => {
    setResult(null);
    setErrors([]);
    setCopyStatus("");
  };

  const updateLesion = (index, key, value) => {
    setTargetLesions((current) =>
      current.map((lesion, lesionIndex) =>
        lesionIndex === index ? { ...lesion, [key]: value } : lesion,
      ),
    );
    invalidate();
  };

  const addLesion = () => {
    if (targetLesions.length >= 5) return;
    const id = `target-${nextLesionId.current}`;
    nextLesionId.current += 1;
    setTargetLesions((current) => [...current, initialLesion(id)]);
    invalidate();
  };

  const removeLesion = (index) => {
    if (targetLesions.length <= 1) return;
    setTargetLesions((current) =>
      current.filter((_, lesionIndex) => lesionIndex !== index),
    );
    invalidate();
  };

  const moveLesion = (index, direction) => {
    const destination = index + direction;
    if (destination < 0 || destination >= targetLesions.length) return;
    setTargetLesions((current) => {
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [
        reordered[destination],
        reordered[index],
      ];
      return reordered;
    });
    invalidate();
  };

  const calculate = () => {
    try {
      const nextResult = computeRecist11({
        mode,
        targetLesions,
        priorNadirSumMm,
        nonTargetStatus,
        newLesionStatus,
        priorConfirmedTargetResponse: priorTarget,
        priorConfirmedOverallResponse: priorOverall,
        studyDesign,
        endpoint,
        reappearance,
      });
      setResult(nextResult);
      setErrors([]);
      setCopyStatus("");
      trackRecistEvent("trackResultViewed");
    } catch (error) {
      setResult(null);
      setErrors([error instanceof Error ? error.message : String(error)]);
    }
  };

  const copyImpression = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildRecistImpression(result));
      setCopyStatus("RECIST impression copied to clipboard.");
      trackRecistEvent("trackResultsCopied");
      window.setTimeout(() => setCopyStatus(""), 2500);
    } catch {
      setCopyStatus("Unable to copy the RECIST impression.");
    }
  };

  return (
    <div className="min-w-0 space-y-5" data-testid="recist-calculator">
      <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground">
        <p className="font-medium">Clinical-trial time-point classification only</p>
        <p className="mt-1 text-muted-foreground">
          Enter measurements already selected and assessed by a qualified
          clinician/radiologist under the study protocol. This educational aid
          does not interpret images, determine malignancy, calculate best
          overall response, apply iRECIST, or provide treatment advice.
          Clinician/radiologist and protocol confirmation remain required.
        </p>
      </div>

      <details open className="rounded-lg border border-border bg-card">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          1. Target lesion measurements and sums
        </summary>
        <div className="space-y-4 border-t border-border p-4">
          <SelectControl
            id="recist-mode"
            label="Disease measurement mode"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value);
              if (event.target.value === "non_target_only" && nonTargetStatus === "none") {
                setNonTargetStatus("non_cr_non_pd");
              }
              invalidate();
            }}
          >
            <option value="measurable">Measurable target disease</option>
            <option value="non_target_only">Non-target-only disease</option>
          </SelectControl>

          {mode === "measurable" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Up to five targets total and two per organ. Non-nodal targets
                use longest diameter; nodes use short axis. Additional
                restrictions for bone, cystic, brain, lymphoma, previously
                treated, and disease-specific settings are outside this aid.
              </p>
              <div className="space-y-4">
                {targetLesions.map((lesion, index) => {
                  const identity = `Target lesion ${index + 1}, ${lesion.organ || "organ not entered"}, ${lesion.kind === "node" ? "node" : "non-nodal"}`;
                  return (
                    <fieldset
                      key={lesion.id}
                      className="min-w-0 space-y-4 rounded-md border border-border p-3 sm:p-4"
                      aria-describedby={`${lesion.id}-identity`}
                    >
                      <legend className="px-1 font-medium text-foreground">
                        Target lesion {index + 1}
                      </legend>
                      <p id={`${lesion.id}-identity`} className="sr-only">
                        {identity}; baseline and current time point
                      </p>
                      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="min-w-0 space-y-1.5">
                          <Label htmlFor={`${lesion.id}-organ`}>Organ</Label>
                          <Input
                            id={`${lesion.id}-organ`}
                            className="min-h-11"
                            value={lesion.organ}
                            onChange={(event) =>
                              updateLesion(index, "organ", event.target.value)
                            }
                            aria-label={`${identity} organ`}
                            placeholder="e.g., liver"
                          />
                        </div>
                        <SelectControl
                          id={`${lesion.id}-kind`}
                          label="Lesion type"
                          value={lesion.kind}
                          onChange={(event) => {
                            updateLesion(index, "kind", event.target.value);
                            if (
                              event.target.value === "node" &&
                              !new Set(["CT", "MRI"]).has(lesion.modality)
                            ) {
                              updateLesion(index, "modality", "CT");
                            }
                          }}
                          ariaLabel={`${identity} lesion type`}
                        >
                          <option value="non_nodal">Non-nodal target</option>
                          <option value="node">Lymph node (short axis)</option>
                        </SelectControl>
                        <SelectControl
                          id={`${lesion.id}-modality`}
                          label="Measurement modality"
                          value={lesion.modality}
                          onChange={(event) =>
                            updateLesion(index, "modality", event.target.value)
                          }
                          ariaLabel={`${identity} modality`}
                        >
                          <option value="CT">CT</option>
                          <option value="MRI">MRI</option>
                          {lesion.kind !== "node" ? (
                            <>
                              <option value="clinical_caliper">Clinical caliper</option>
                              <option value="chest_xray">Chest radiograph</option>
                            </>
                          ) : null}
                        </SelectControl>
                        <SelectControl
                          id={`${lesion.id}-plane`}
                          label="Measurement plane"
                          value={lesion.plane}
                          onChange={(event) =>
                            updateLesion(index, "plane", event.target.value)
                          }
                          ariaLabel={`${identity} measurement plane`}
                        >
                          <option value="axial">Axial</option>
                          <option value="sagittal">Sagittal</option>
                          <option value="coronal">Coronal</option>
                          <option value="clinical">Clinical</option>
                        </SelectControl>
                        {new Set(["CT", "MRI"]).has(lesion.modality) ? (
                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor={`${lesion.id}-slice`}>
                              Slice thickness (mm)
                            </Label>
                            <Input
                              id={`${lesion.id}-slice`}
                              type="number"
                              min="0.1"
                              step="any"
                              inputMode="decimal"
                              className="min-h-11"
                              value={lesion.sliceThicknessMm}
                              onChange={(event) =>
                                updateLesion(
                                  index,
                                  "sliceThicknessMm",
                                  event.target.value,
                                )
                              }
                              aria-label={`${identity} slice thickness in millimetres`}
                            />
                            <p className="text-xs text-muted-foreground">
                              If greater than 5 mm, a non-nodal target must be at
                              least twice the slice thickness.
                            </p>
                          </div>
                        ) : null}
                        <div className="min-w-0 space-y-1.5">
                          <Label htmlFor={`${lesion.id}-baseline`}>
                            Baseline {lesion.kind === "node" ? "short axis" : "longest diameter"} (mm)
                          </Label>
                          <Input
                            id={`${lesion.id}-baseline`}
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            className="min-h-11"
                            value={lesion.baselineMeasurementMm}
                            onChange={(event) =>
                              updateLesion(
                                index,
                                "baselineMeasurementMm",
                                event.target.value,
                              )
                            }
                            aria-label={`${identity} baseline measurement in millimetres`}
                          />
                        </div>
                        <SelectControl
                          id={`${lesion.id}-current-status`}
                          label="Current time-point state"
                          value={lesion.currentStatus}
                          onChange={(event) =>
                            updateLesion(
                              index,
                              "currentStatus",
                              event.target.value,
                            )
                          }
                          ariaLabel={`${identity} current time-point state`}
                        >
                          <option value="measured">Measured</option>
                          <option value="disappeared">Disappeared (record 0 mm)</option>
                          <option value="too_small_to_measure">
                            Present but genuinely too small to measure (impute 5 mm)
                          </option>
                          <option value="missing">Required measurement missing</option>
                        </SelectControl>
                        {lesion.currentStatus === "measured" ? (
                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor={`${lesion.id}-current`}>
                              Current {lesion.kind === "node" ? "short axis" : "longest diameter"} (mm)
                            </Label>
                            <Input
                              id={`${lesion.id}-current`}
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              className="min-h-11"
                              value={lesion.currentMeasurementMm}
                              onChange={(event) =>
                                updateLesion(
                                  index,
                                  "currentMeasurementMm",
                                  event.target.value,
                                )
                              }
                              aria-label={`${identity} current measurement in millimetres`}
                            />
                            <p className="text-xs text-muted-foreground">
                              Record the actual value, including a node below 10
                              mm or an accurately measurable lesion below 5 mm.
                            </p>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => moveLesion(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move target lesion ${index + 1} up`}
                        >
                          Move up
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => moveLesion(index, 1)}
                          disabled={index === targetLesions.length - 1}
                          aria-label={`Move target lesion ${index + 1} down`}
                        >
                          Move down
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => removeLesion(index)}
                          disabled={targetLesions.length === 1}
                          aria-label={`Remove target lesion ${index + 1}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </fieldset>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
                onClick={addLesion}
                disabled={targetLesions.length >= 5}
              >
                Add target lesion ({targetLesions.length}/5)
              </Button>
              <div className="max-w-sm space-y-1.5">
                <Label htmlFor="prior-nadir">Prior nadir target sum (mm)</Label>
                <Input
                  id="prior-nadir"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className="min-h-11"
                  value={priorNadirSumMm}
                  onChange={(event) => {
                    setPriorNadirSumMm(event.target.value);
                    invalidate();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Smallest target sum before this assessment, with baseline
                  included. Do not enter an updated nadir from this same time
                  point.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No target-lesion arithmetic is calculated in non-target-only
              mode.
            </p>
          )}
        </div>
      </details>

      <details className="rounded-lg border border-border bg-card">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          2. Non-target, new-lesion, and longitudinal context
        </summary>
        <div className="space-y-5 border-t border-border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectControl
              id="non-target-status"
              label="Non-target lesion status"
              value={nonTargetStatus}
              onChange={(event) => {
                setNonTargetStatus(event.target.value);
                invalidate();
              }}
              help="Select an assessment already made by the clinician/radiologist; this calculator cannot decide whether progression is unequivocal."
            >
              {mode === "measurable" ? <option value="none">None</option> : null}
              <option value="cr">CR</option>
              <option value="non_cr_non_pd">Non-CR/non-PD</option>
              <option value="unequivocal_pd">Unequivocal PD</option>
              <option value="not_evaluated">Not evaluated</option>
            </SelectControl>
            <SelectControl
              id="new-lesion-status"
              label="New lesion status"
              value={newLesionStatus}
              onChange={(event) => {
                setNewLesionStatus(event.target.value);
                invalidate();
              }}
              help="An equivocal possible new lesion produces an indeterminate result requiring reassessment."
            >
              <option value="none">None</option>
              <option value="equivocal">Equivocal possible new lesion</option>
              <option value="unequivocal">
                Unequivocal new malignant lesion
              </option>
            </SelectControl>
            {mode === "measurable" ? (
              <SelectControl
                id="prior-target-response"
                label="Prior confirmed target-lesion response"
                value={priorTarget}
                onChange={(event) => {
                  setPriorTarget(event.target.value);
                  invalidate();
                }}
                help="Only confirmed target PR controls the continuing-target-PR rule."
              >
                <option value="none">None</option>
                <option value="PR">PR</option>
                <option value="CR">CR</option>
              </SelectControl>
            ) : null}
            <SelectControl
              id="prior-overall-response"
              label="Prior confirmed overall response"
              value={priorOverall}
              onChange={(event) => {
                setPriorOverall(event.target.value);
                invalidate();
              }}
              help="Only prior confirmed overall CR controls the malignant-reappearance progression rule."
            >
              <option value="none">None</option>
              <option value="PR">PR</option>
              <option value="CR">CR</option>
            </SelectControl>
          </div>

          <div className="space-y-3 rounded-md border border-border p-3 sm:p-4">
            <CheckboxControl
              id="reappearance-confirmed"
              checked={reappearance.confirmed}
              onChange={(event) => {
                setReappearance((current) => ({
                  ...current,
                  confirmed: event.target.checked,
                  source: event.target.checked ? current.source : "none",
                }));
                invalidate();
              }}
            >
              A clinician/radiologist has confirmed malignant reappearance of
              a previously resolved lesion.
            </CheckboxControl>
            {reappearance.confirmed ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectControl
                  id="reappearance-source"
                  label="Reappearing lesion source"
                  value={reappearance.source}
                  onChange={(event) => {
                    setReappearance((current) => ({
                      ...current,
                      source: event.target.value,
                    }));
                    invalidate();
                  }}
                >
                  <option value="none">Select source</option>
                  {mode === "measurable"
                    ? targetLesions.map((lesion, index) => (
                        <option key={lesion.id} value={`target:${lesion.id}`}>
                          Target lesion {index + 1}: {lesion.organ || "organ not entered"}
                        </option>
                      ))
                    : null}
                  <option value="non_target">Non-target lesion</option>
                  <option value="unknown">
                    Compartment cannot be assigned (overall only)
                  </option>
                </SelectControl>
                {new Set(["non_target", "unknown"]).has(reappearance.source) ? (
                  <SelectControl
                    id="reappearance-kind"
                    label="Reappearing lesion type"
                    value={reappearance.lesionKind}
                    onChange={(event) => {
                      setReappearance((current) => ({
                        ...current,
                        lesionKind: event.target.value,
                      }));
                      invalidate();
                    }}
                  >
                    <option value="non_nodal">Non-nodal lesion</option>
                    <option value="node">Lymph node</option>
                  </SelectControl>
                ) : null}
                {new Set(["non_target", "unknown"]).has(reappearance.source) &&
                reappearance.lesionKind === "node" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="reappearance-node-mm">
                      Current nodal short axis (mm)
                    </Label>
                    <Input
                      id="reappearance-node-mm"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      className="min-h-11"
                      value={reappearance.nodeShortAxisMm}
                      onChange={(event) => {
                        setReappearance((current) => ({
                          ...current,
                          nodeShortAxisMm: event.target.value,
                        }));
                        invalidate();
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      A reappearing node must be at least 10 mm short axis.
                    </p>
                  </div>
                ) : null}
                {reappearance.source === "non_target" ? (
                  <CheckboxControl
                    id="reappearance-unequivocal"
                    checked={reappearance.unequivocal}
                    onChange={(event) => {
                      setReappearance((current) => ({
                        ...current,
                        unequivocal: event.target.checked,
                      }));
                      invalidate();
                    }}
                  >
                    The clinician/radiologist has judged this non-target
                    reappearance unequivocal.
                  </CheckboxControl>
                ) : null}
                {reappearance.source === "unknown" ? (
                  <CheckboxControl
                    id="reappearance-overall-only"
                    checked={reappearance.overallOnlyOverride}
                    onChange={(event) => {
                      setReappearance((current) => ({
                        ...current,
                        overallOnlyOverride: event.target.checked,
                      }));
                      invalidate();
                    }}
                  >
                    Apply an explicit overall-only override. Do not invent a
                    target-compartment response.
                  </CheckboxControl>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectControl
              id="study-design"
              label="Study design"
              value={studyDesign}
              onChange={(event) => {
                setStudyDesign(event.target.value);
                invalidate();
              }}
            >
              <option value="randomized">Randomized trial</option>
              <option value="non_randomized">Non-randomized trial</option>
            </SelectControl>
            <SelectControl
              id="study-endpoint"
              label="Endpoint context"
              value={endpoint}
              onChange={(event) => {
                setEndpoint(event.target.value);
                invalidate();
              }}
            >
              <option value="other">Response is not the primary endpoint</option>
              <option value="response_primary">Response is the primary endpoint</option>
            </SelectControl>
          </div>
        </div>
      </details>

      <Button
        type="button"
        size="lg"
        className="min-h-11 w-full"
        onClick={calculate}
      >
        Calculate RECIST 1.1 time-point response
      </Button>

      <div aria-live="assertive" aria-atomic="true">
        {errors.length ? (
          <div
            role="alert"
            className="rounded-md border border-destructive bg-destructive/5 p-4 text-sm text-foreground"
            data-testid="recist-validation-errors"
          >
            <p className="font-medium">Resolve the following before classification:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {result ? (
        <Card
          role="status"
          aria-label="Calculator results"
          aria-live="polite"
          data-testid="recist-results"
        >
          <CardHeader>
            <p className="text-sm font-medium text-muted-foreground">
              RECIST 1.1 time-point response
            </p>
            <CardTitle className="text-xl">
              {RESPONSE_LABELS[result.overall_response]}
              {new Set(["CR", "PR", "SD", "PD", "NE"]).has(
                result.overall_response,
              )
                ? ` (${result.overall_response})`
                : ""}
            </CardTitle>
            {result.pd_driver ? (
              <p className="text-sm text-foreground">
                Progression driver: {PD_DRIVER_LABELS[result.pd_driver]}
              </p>
            ) : null}
            {result.overall_response === "INDETERMINATE" ? (
              <p className="text-sm text-foreground">
                No definitive category is produced. Reassessment and
                clinician/radiologist/protocol review are required.
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {result.mode === "measurable" ? (
              <>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Target response</dt>
                    <dd className="font-medium text-foreground">
                      {RESPONSE_LABELS[result.target_response]} ({result.target_response})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {result.current_sum_is_measured_subset
                        ? "Measured target subset"
                        : "Current target sum"}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {result.current_sum_mm} mm
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Baseline denominator</dt>
                    <dd className="font-medium text-foreground">
                      {result.baseline_sum_mm} mm ({withSign(result.display_baseline_change_1dp, "%")})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Prior nadir denominator</dt>
                    <dd className="font-medium text-foreground">
                      {result.prior_nadir_sum_mm} mm (
                      {result.display_nadir_change_1dp === null
                        ? "percentage not calculable"
                        : withSign(result.display_nadir_change_1dp, "%")}
                      ; {withSign(result.absolute_nadir_change_mm, " mm")})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Updated nadir</dt>
                    <dd className="font-medium text-foreground">
                      {result.updated_nadir_sum_mm} mm
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Non-target lesions</dt>
                    <dd className="font-medium text-foreground">
                      {NON_TARGET_LABELS[result.non_target_status]}
                    </dd>
                  </div>
                </dl>
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Target lesion states
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {result.lesion_summaries.map((lesion, index) => (
                      <li key={lesion.id}>
                        Lesion {index + 1} ({lesion.organ}; {lesion.kind === "node" ? "node" : "non-nodal"}): {CURRENT_STATUS_LABELS[lesion.current_status]}
                        {lesion.current_mm !== null ? `, ${lesion.current_mm} mm` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Non-target lesions</dt>
                  <dd className="font-medium text-foreground">
                    {NON_TARGET_LABELS[result.non_target_status]}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">New lesions</dt>
                  <dd className="font-medium text-foreground">
                    {NEW_LESION_LABELS[result.new_lesion_status]}
                  </dd>
                </div>
              </dl>
            )}
            <div className="rounded-md bg-muted/50 p-3 text-sm text-foreground">
              <p>{result.confirmation_summary}</p>
              <p className="mt-2">
                This is a time-point classification, not best overall response.
                Follow-up timing and confirmation are protocol specific.
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">Copy impression</p>
              <p className="mt-1 break-words text-sm text-muted-foreground" data-testid="recist-impression">
                {buildRecistImpression(result)}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 min-h-11 w-full sm:w-auto"
                onClick={copyImpression}
              >
                Copy impression
              </Button>
              <p className="sr-only" role="status" aria-live="polite">
                {copyStatus}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2 rounded-md border border-border p-4 text-sm">
        <h3 className="font-medium text-foreground">Sources and limitations</h3>
        <p className="text-muted-foreground">
          Classification uses unrounded recorded sums. Reader variability,
          lesion selection, technique, non-target interpretation, and new-lesion
          assessment can change the category. Disease- or therapy-specific
          criteria may control; iRECIST and immune-response workflows are
          separate.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <a
              href="https://project.eortc.org/recist/wp-content/uploads/sites/4/2015/03/RECISTGuidelines.pdf"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              RECIST 1.1 primary guideline (Eisenhauer et al., 2009)
            </a>
          </li>
          <li>
            <a
              href="https://recist.eortc.org/recist-1-1"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Current RECIST Working Group page and clarifications
            </a>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Evidence reviewed 2026-08-25. Independent source/math review PASS is
          not owner clinical signoff and is not legal or rights clearance.
        </p>
      </div>
    </div>
  );
}

export const RECIST11 = {
  id: "recist-1-1",
  category: "Oncology",
  name: "RECIST 1.1 Tumor Response",
  desc: "Classifies conventional RECIST 1.1 solid-tumor clinical-trial response at one assessment time point.",
  guidelineVersion:
    "RECIST 1.1 (2009; official clarifications current through 2026-08-25)",
  keywords: [
    "RECIST",
    "tumor response",
    "oncology",
    "target lesions",
    "clinical trial",
  ],
  tags: ["Oncology", "Clinical Trial", "Tumor Response"],
  metaDesc:
    "Free RECIST 1.1 time-point response calculator for conventional solid-tumor clinical trials, with target sums, prior-nadir comparison, and safeguarded overall classification.",
  info: {
    text: `RECIST 1.1 standardizes solid-tumor response measurement in clinical trials. This calculator validates already selected target lesions, calculates baseline and prior-nadir changes without rounding thresholds, and combines target, non-target, new-lesion, and longitudinal states into one time-point response.

Scope is conventional adult and paediatric solid-tumor trial assessment. It excludes iRECIST/irRECIST, disease-specific adaptations, image interpretation, malignancy determination, prognosis, treatment decisions, best overall response, PFS/censoring, and trial statistical analysis.

Rules are paraphrased and linked to official sources. No journal tables, logos, or marks are reproduced. Public-use rights and clinical release authority are separate from source/math review.`,
    link: {
      label: "View the official RECIST 1.1 guideline",
      url: "https://project.eortc.org/recist/wp-content/uploads/sites/4/2015/03/RECISTGuidelines.pdf",
    },
  },
  isCustomComponent: true,
  Component: Recist11Calculator,
  compute: computeRecist11Result,
  refs: [
    {
      t: "Eisenhauer EA, Therasse P, Bogaerts J, et al. New response evaluation criteria in solid tumours: revised RECIST guideline (version 1.1). Eur J Cancer. 2009;45(2):228-247.",
      u: "https://doi.org/10.1016/j.ejca.2008.10.026",
    },
    {
      t: "RECIST Working Group. RECIST 1.1 current guidance and clarifications.",
      u: "https://recist.eortc.org/recist-1-1/",
    },
    {
      t: "Schwartz LH, Litière S, de Vries E, et al. RECIST 1.1—Update and clarification: From the RECIST committee. Eur J Cancer. 2016;62:132-137.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5737828/",
    },
  ],
};
