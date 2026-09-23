// Pure ALBI clinical calculation. User-facing copy and display formatting stay in the adapter.

const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

function parseFiniteDecimal(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  if (typeof value !== "string") return Number.NaN;

  const text = value.trim();
  if (!DECIMAL_NUMBER_PATTERN.test(text)) return Number.NaN;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function calculateAlbi(input = {}) {
  const values =
    input !== null && typeof input === "object" && !Array.isArray(input)
      ? input
      : {};
  const hasUnitSystem = Object.prototype.hasOwnProperty.call(values, "unit_system");
  const unit_system = hasUnitSystem ? values.unit_system : "SI";
  if (unit_system !== "SI" && unit_system !== "US") {
    return { ok: false, code: "INVALID_UNITS", value: null };
  }

  const albuminInput = parseFiniteDecimal(values.albumin);
  const bilirubinInput = parseFiniteDecimal(values.bilirubin);
  const usedUSUnits = unit_system === "US";

  if (
    !Number.isFinite(albuminInput) ||
    !Number.isFinite(bilirubinInput) ||
    albuminInput <= 0 ||
    bilirubinInput <= 0
  ) {
    return { ok: false, code: "INVALID_INPUT", value: null };
  }

  let bilirubinSI;
  let albuminSI;
  if (usedUSUnits) {
    bilirubinSI = bilirubinInput * 17.104;
    albuminSI = albuminInput * 10;
  } else {
    bilirubinSI = bilirubinInput;
    albuminSI = albuminInput;
  }

  if (!Number.isFinite(albuminSI) || !Number.isFinite(bilirubinSI) ||
      albuminSI <= 0 || bilirubinSI <= 0) {
    return { ok: false, code: "INVALID_CONVERSION", value: null };
  }

  // Formula printed by Johnson et al. 2015:
  // (log₁₀ bilirubin [μmol/L] × 0.66) + (albumin [g/L] × −0.085)
  const score = Math.log10(bilirubinSI) * 0.66 + albuminSI * -0.085;
  if (!Number.isFinite(score)) {
    return { ok: false, code: "INVALID_CALCULATION", value: null };
  }

  let grade;
  if (score <= -2.6) {
    grade = 1;
  } else if (score <= -1.39) {
    grade = 2;
  } else {
    grade = 3;
  }

  return {
    ok: true,
    score,
    grade,
    albuminSI,
    bilirubinSI,
    usedUSUnits,
    albuminInput,
    bilirubinInput,
    // Software input checks, not physiological or model-validation boundaries.
    inputReviewRequired: albuminSI < 5 || albuminSI > 60 ||
      bilirubinSI < 1 || bilirubinSI > 1000,
  };
}
