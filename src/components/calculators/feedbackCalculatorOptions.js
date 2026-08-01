import { calcDefs } from "./registry";

export const feedbackCalculatorOptions = calcDefs
  .filter((calc) => calc.id !== "feedback-form")
  .sort((a, b) => a.name.localeCompare(b.name));
