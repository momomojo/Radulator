const modules = import.meta.glob(["./*.jsx", "!./FeedbackForm.jsx"], {
  eager: true,
});

export const feedbackCalculatorOptions = Object.values(modules)
  .map((module) => module.default || Object.values(module)[0])
  .filter((calc) => calc?.id && calc?.name && calc.id !== "feedback-form")
  .sort((a, b) => a.name.localeCompare(b.name));
