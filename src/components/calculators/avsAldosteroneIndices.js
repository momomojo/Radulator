// Single paired sample per site, already converted to common standard units.
// No site selection, aggregation, diagnostic threshold or treatment decision.
const unavailable = reason => ({ value: null, reason });
const available = value => ({ value, reason: null });

function concentration(value, label) {
  if (value === undefined || value === null || value === "") {
    return unavailable(`${label} is missing.`);
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return unavailable(`${label} must be a positive finite concentration; zero or below-assay-limit values require separate handling.`);
  }
  return available(value);
}

function divide(numerator, denominator) {
  if (numerator.reason) return unavailable(numerator.reason);
  if (denominator.reason) return unavailable(denominator.reason);
  const value = numerator.value / denominator.value;
  return Number.isFinite(value) && value > 0
    ? available(value)
    : unavailable("Ratio is outside the supported numerical range.");
}

export function calculateAldosteroneIndices({ peripheral = {}, left = {}, right = {} } = {}) {
  const read = (sample, label) => ({
    a: concentration(sample.aldosterone, `${label} aldosterone`),
    c: concentration(sample.cortisol, `${label} cortisol`),
  });
  const p = read(peripheral, "Peripheral");
  const l = read(left, "Left adrenal");
  const r = read(right, "Right adrenal");
  const leftAC = divide(l.a, l.c);
  const rightAC = divide(r.a, r.c);
  const peripheralAC = divide(p.a, p.c);
  const missingSide = leftAC.reason || rightAC.reason;
  const higher = missingSide ? unavailable(missingSide) : available(Math.max(leftAC.value, rightAC.value));
  const lower = missingSide ? unavailable(missingSide) : available(Math.min(leftAC.value, rightAC.value));
  return {
    leftSI: divide(l.c, p.c),
    rightSI: divide(r.c, p.c),
    leftAC,
    rightAC,
    peripheralAC,
    li: divide(higher, lower),
    cr: divide(lower, peripheralAC),
    avIvc: divide(higher, peripheralAC),
    numericHigherSide: missingSide || leftAC.value === rightAC.value
      ? null : leftAC.value > rightAC.value ? "Left" : "Right",
  };
}
