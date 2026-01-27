/**
 * useUrlSync - Manages URL hash synchronization for deep linking
 * Enables shareable calculator URLs and browser navigation support
 */
import { useState, useEffect, useCallback } from "react";

/**
 * Parse calculator ID from URL hash
 * Supports formats: #/calculator-id, #calculator-id
 */
function parseHashCalculatorId(hash) {
  return hash.replace("#/", "").replace("#", "");
}

/**
 * Hook for URL hash synchronization
 * @param {Array} calcDefs - Array of calculator definitions
 * @param {Function} onCalculatorChange - Callback when calculator changes from URL
 */
export function useUrlSync(calcDefs, onCalculatorChange) {
  // Get initial calculator ID from URL or default
  const [initialId] = useState(() => {
    const hash = parseHashCalculatorId(window.location.hash);
    const calc = calcDefs.find((c) => c.id === hash);
    return calc ? calc.id : calcDefs[0]?.id;
  });

  // Sync URL hash with active calculator
  const syncUrlToCalculator = useCallback((calculatorId) => {
    const newHash = `#/${calculatorId}`;
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, "", newHash);
    }
  }, []);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = parseHashCalculatorId(window.location.hash);
      const calc = calcDefs.find((c) => c.id === hash);
      if (calc && onCalculatorChange) {
        onCalculatorChange(calc.id);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [calcDefs, onCalculatorChange]);

  return {
    initialId,
    syncUrlToCalculator,
  };
}

/**
 * Hook for updating page meta tags based on calculator
 * @param {Object} calculator - Current calculator definition
 */
export function usePageMeta(calculator) {
  useEffect(() => {
    if (!calculator) return;

    // Update document title
    document.title = `${calculator.name} Calculator | Radulator`;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      const description =
        calculator.metaDesc ||
        calculator.desc ||
        `Calculate ${calculator.name} - free online medical calculator with peer-reviewed references.`;
      metaDescription.setAttribute("content", description);
    }

    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute(
        "content",
        `${calculator.name} Calculator | Radulator`,
      );
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      const description =
        calculator.metaDesc ||
        calculator.desc ||
        `Calculate ${calculator.name} - free online medical calculator.`;
      ogDesc.setAttribute("content", description);
    }
  }, [calculator]);
}

export default useUrlSync;
