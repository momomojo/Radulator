// Pure ALBI clinical calculation. User-facing copy and display formatting stay in the adapter.

const parsedNumber = (value) => parseFloat(value) || 0;

export function calculateAlbi({ unit_system = "SI", albumin = 0, bilirubin = 0 } = {}) {
  const albuminInput = parsedNumber(albumin);
  const bilirubinInput = parsedNumber(bilirubin);
  const usedUSUnits = unit_system === "US";

  if (albuminInput <= 0 || bilirubinInput <= 0) {
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

  if (albuminSI < 5 || albuminSI > 60) {
    return { ok: false, code: "ALBUMIN_RANGE", value: albuminSI };
  }

  if (bilirubinSI < 1 || bilirubinSI > 1000) {
    return { ok: false, code: "BILIRUBIN_RANGE", value: bilirubinSI };
  }

  // Formula printed by Johnson et al. 2015:
  // (log₁₀ bilirubin [μmol/L] × 0.66) + (albumin [g/L] × −0.085)
  const score = Math.log10(bilirubinSI) * 0.66 + albuminSI * -0.085;

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
  };
}
