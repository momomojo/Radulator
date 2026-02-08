/**
 * Calculator Registry - Auto-discovery using Vite's import.meta.glob
 * Automatically discovers all calculator files and builds categories from metadata
 */

// Eager load all calculator JSX files (excluding index and registry)
const modules = import.meta.glob("./*.jsx", { eager: true });

/**
 * Extract calculator definitions from modules
 * Each module should export a calculator object with id, name, category, etc.
 */
export const calcDefs = Object.entries(modules)
  .filter(([path]) => {
    // Exclude index.js and registry.js
    const filename = path.split("/").pop();
    return !filename.includes("index") && !filename.includes("registry");
  })
  .map(([path, module]) => {
    // Get the default export or first named export
    const calc = module.default || Object.values(module)[0];
    if (!calc?.id) {
      console.warn(`Calculator at ${path} missing required 'id' field`);
    }
    return calc;
  })
  .filter((calc) => calc?.id) // Must have id property
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
