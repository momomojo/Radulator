// Google Analytics 4 (GA4) Helper Functions
// Provides type-safe event tracking for Radulator application
// Automatically disabled in development mode

/**
 * Check if analytics is available and not in development mode
 * @returns {boolean}
 */
const isAnalyticsEnabled = () => {
  // Disable in development mode
  if (import.meta.env.DEV) {
    return false;
  }

  // Check if gtag is available (loaded from GA4 script)
  return typeof window !== "undefined" && typeof window.gtag === "function";
};

/**
 * Send a custom event to Google Analytics
 * @param {string} eventName - Name of the event
 * @param {Object} eventParams - Event parameters
 */
const sendEvent = (eventName, eventParams = {}) => {
  if (!isAnalyticsEnabled()) {
    // Log to console in development for debugging
    if (import.meta.env.DEV) {
      console.log("[GA4 Dev]", eventName, eventParams);
    }
    return;
  }

  try {
    window.gtag("event", eventName, eventParams);
  } catch (error) {
    console.error("GA4 tracking error:", error);
  }
};

/**
 * Track when a user selects a calculator
 * @param {string} calculatorId - Unique calculator ID (e.g., "prostate-volume")
 * @param {string} calculatorName - Display name (e.g., "Prostate Volume")
 * @param {string} category - Calculator category (e.g., "Radiology", "Hepatology")
 */
export const trackCalculatorSelected = (
  calculatorId,
  calculatorName,
  category = "Unknown",
) => {
  sendEvent("calculator_selected", {
    calculator_id: calculatorId,
    calculator_name: calculatorName,
    category: category,
    event_category: "Navigation",
    event_label: calculatorName,
  });

  // Also send as virtual pageview for better navigation tracking
  if (isAnalyticsEnabled()) {
    window.gtag("event", "page_view", {
      page_title: `${calculatorName} Calculator`,
      page_location: `${window.location.origin}/calculator/${calculatorId}`,
      page_path: `/calculator/${calculatorId}`,
    });
  }
};

/**
 * Track when a user performs a calculation
 * @param {string} calculatorId - Unique calculator ID
 * @param {string} calculatorName - Display name
 * @param {string} category - Calculator category
 * @param {boolean} hasResult - Whether calculation produced a result (vs error)
 */
export const trackCalculation = (
  calculatorId,
  calculatorName,
  category = "Unknown",
  hasResult = true,
) => {
  sendEvent("calculation_performed", {
    calculator_id: calculatorId,
    calculator_name: calculatorName,
    category: category,
    has_result: hasResult,
    event_category: "Engagement",
    event_label: calculatorName,
    value: hasResult ? 1 : 0, // 1 for success, 0 for error
  });
};

/**
 * Track CSV file downloads
 * @param {string} fileName - Name of the downloaded file
 * @param {string} calculatorId - Calculator that generated the CSV
 */
export const trackCSVDownload = (fileName, calculatorId) => {
  sendEvent("file_download", {
    file_name: fileName,
    calculator_id: calculatorId,
    file_type: "csv",
    event_category: "Downloads",
    event_label: fileName,
  });
};

/**
 * Track clicks on external links (references, info buttons, etc.)
 * @param {string} url - Destination URL
 * @param {string} linkType - Type of link ('reference', 'info_button', 'external')
 * @param {string} calculatorId - Current calculator context (optional)
 */
export const trackOutboundLink = (
  url,
  linkType = "external",
  calculatorId = null,
) => {
  sendEvent("outbound_link_click", {
    link_url: url,
    link_type: linkType,
    calculator_id: calculatorId,
    event_category: "Outbound Links",
    event_label: url,
  });
};

/**
 * Track feedback form submissions
 * @param {boolean} success - Whether submission was successful
 * @param {string} formId - Form identifier (default: 'feedback-form')
 */
export const trackFeedbackSubmission = (
  success = true,
  formId = "feedback-form",
) => {
  sendEvent("feedback_submitted", {
    form_id: formId,
    success: success,
    event_category: "Forms",
    event_label: success ? "Submission Success" : "Submission Failed",
    value: success ? 1 : 0,
  });
};

/**
 * Track when a user copies calculation results to clipboard
 * @param {string} calculatorId - Unique calculator ID
 * @param {string} calculatorName - Display name
 */
export const trackResultsCopied = (calculatorId, calculatorName) => {
  sendEvent("results_copied", {
    calculator_id: calculatorId,
    calculator_name: calculatorName,
    event_category: "Engagement",
    event_label: `${calculatorName} - Results Copied`,
  });
};

/**
 * Track when calculation results are displayed
 * @param {string} calculatorId - Calculator ID
 * @param {string} calculatorName - Display name
 * @param {number} timeToCalculate - Milliseconds from page load to calculation (optional)
 */
export const trackResultViewed = (
  calculatorId,
  calculatorName,
  timeToCalculate = null,
) => {
  const params = {
    calculator_id: calculatorId,
    calculator_name: calculatorName,
    event_category: "Engagement",
    event_label: `${calculatorName} - Result Viewed`,
  };

  if (timeToCalculate !== null) {
    params.time_to_calculate = Math.round(timeToCalculate);
    params.value = Math.round(timeToCalculate / 1000); // Convert to seconds for value
  }

  sendEvent("calculator_result_viewed", params);
};

/**
 * Track search queries (if search functionality is added later)
 * @param {string} searchTerm - Search query
 */
export const trackSearch = (searchTerm) => {
  sendEvent("search", {
    search_term: searchTerm,
    event_category: "Search",
    event_label: searchTerm,
  });
};

// Development helper: Log all events in dev mode
if (import.meta.env.DEV) {
  console.log(
    "[GA4] Analytics running in DEVELOPMENT mode - events logged to console only",
  );
}
