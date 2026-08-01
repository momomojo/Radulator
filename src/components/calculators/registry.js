/**
 * Calculator Registry - Auto-discovery using Vite's import.meta.glob
 * Automatically discovers all calculator files and builds categories from metadata
 */

import { calcDefs as generatedCalcDefs } from "virtual:calculator-registry";

// The Vite plugin derives lightweight navigation metadata from calculator source
// while each implementation stays behind its own dynamic loader.
export const calcDefs = generatedCalcDefs
  .map((calc) => ({ ...calc, load: () => calc.load() }))
  .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name

/**
 * Auto-generate categories from calculator metadata
 * Groups calculators by their self-declared 'category' field
 */
export const categories = calcDefs.reduce((acc, calc) => {
  const category = calc.category || "Other";
  if (!acc[category]) {
    acc[category] = [];
  }
  acc[category].push(calc.id);
  return acc;
}, {});

/**
 * Category display order (defines sidebar ordering)
 * Categories not in this list will appear at the end alphabetically
 */
export const categoryOrder = [
  "Radiology",
  "Neuroradiology",
  "Trauma",
  "Cardiac Imaging",
  "Breast Imaging",
  "Women's Imaging",
  "Clinical Decision",
  "Hepatology/Liver",
  "Urology",
  "Interventional",
  "Nephrology",
  "Feedback",
];

/**
 * Get categories sorted by preferred order
 */
export function getSortedCategories() {
  const allCategories = Object.keys(categories);
  const ordered = categoryOrder.filter((cat) => allCategories.includes(cat));
  const remaining = allCategories
    .filter((cat) => !categoryOrder.includes(cat))
    .sort();
  return [...ordered, ...remaining];
}

/**
 * Get calculator definition by ID
 */
export function getCalculatorById(id) {
  return calcDefs.find((calc) => calc.id === id);
}

/**
 * Get all calculators in a category
 */
export function getCalculatorsByCategory(category) {
  const ids = categories[category] || [];
  return ids.map((id) => getCalculatorById(id)).filter(Boolean);
}

/**
 * Auto-discover all unique tags from calculator metadata
 */
export const allTags = [
  ...new Set(calcDefs.flatMap((c) => c.tags || [])),
].sort();

/**
 * Get calculators filtered by tag
 */
export function getCalculatorsByTag(tag) {
  return calcDefs.filter((c) => c.tags?.includes(tag));
}

export default calcDefs;
