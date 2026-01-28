import React from "react";

/**
 * Result Display Component
 * Displays calculator results with enhanced visual hierarchy and severity indicators
 */
function ResultDisplay({ results, calculatorId, onDownload }) {
  if (!results || Object.keys(results).length === 0) return null;

  // Classify result severity based on common patterns
  const getSeverity = (key, value) => {
    const lowerKey = key.toLowerCase();
    const lowerValue = String(value).toLowerCase();

    // Error patterns
    if (lowerKey === "error" || lowerValue.includes("error")) {
      return "error";
    }

    // Success/low-risk patterns
    if (
      lowerValue.includes("class a") ||
      lowerValue.includes("grade 1") ||
      lowerValue.includes("benign") ||
      lowerValue.includes("low risk") ||
      lowerValue.includes("negative") ||
      lowerValue.includes("normal") ||
      lowerValue.includes("tr1") ||
      lowerValue.includes("tr2") ||
      lowerValue.includes("bi-rads 1") ||
      lowerValue.includes("bi-rads 2") ||
      lowerValue.includes("li-rads 1") ||
      lowerValue.includes("li-rads 2")
    ) {
      return "success";
    }

    // Warning/moderate-risk patterns
    if (
      lowerValue.includes("class b") ||
      lowerValue.includes("grade 2") ||
      lowerValue.includes("moderate") ||
      lowerValue.includes("intermediate") ||
      lowerValue.includes("tr3") ||
      lowerValue.includes("bi-rads 3") ||
      lowerValue.includes("li-rads 3")
    ) {
      return "warning";
    }

    // Danger/high-risk patterns
    if (
      lowerValue.includes("class c") ||
      lowerValue.includes("grade 3") ||
      lowerValue.includes("grade 4") ||
      lowerValue.includes("grade 5") ||
      lowerValue.includes("malignant") ||
      lowerValue.includes("high risk") ||
      lowerValue.includes("suspicious") ||
      lowerValue.includes("positive") ||
      lowerValue.includes("tr4") ||
      lowerValue.includes("tr5") ||
      lowerValue.includes("bi-rads 4") ||
      lowerValue.includes("bi-rads 5") ||
      lowerValue.includes("li-rads 4") ||
      lowerValue.includes("li-rads 5") ||
      lowerValue.includes("lr-5") ||
      lowerValue.includes("lr-m")
    ) {
      return "danger";
    }

    return "neutral";
  };

  // Severity badge styles - using CSS custom properties for dark mode support
  const severityStyles = {
    success:
      "bg-[hsl(var(--result-success-bg))] text-[hsl(var(--result-success))] border-[hsl(var(--result-success-border))]",
    warning:
      "bg-[hsl(var(--result-warning-bg))] text-[hsl(var(--result-warning))] border-[hsl(var(--result-warning-border))]",
    danger:
      "bg-[hsl(var(--result-danger-bg))] text-[hsl(var(--result-danger))] border-[hsl(var(--result-danger-border))]",
    error:
      "bg-[hsl(var(--result-danger-bg))] text-[hsl(var(--result-danger))] border-[hsl(var(--result-danger-border))]",
    neutral: "bg-muted text-foreground border-border",
  };

  // Severity icons (SVG paths)
  const severityIcons = {
    success: (
      <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    ),
    warning: (
      <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    danger: (
      <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    ),
    neutral: null,
  };

  // Determine if a key is a separator (Unicode line or empty value)
  const isSeparator = (key, value) => {
    const strValue = String(value);
    return (
      strValue.includes("─") ||
      strValue.includes("═") ||
      (key.trim() === "" && value === "") ||
      strValue.match(/^[-─═_]{3,}$/)
    );
  };

  // Determine if a key is a section header (empty value, non-empty key)
  const isSectionHeader = (key, value) => {
    return key.trim() !== "" && String(value).trim() === "";
  };

  // Find the primary result (first non-error, non-separator, non-empty result)
  const entries = Object.entries(results);
  const primaryIdx = entries.findIndex(([k, v]) => {
    return (
      !isSeparator(k, v) &&
      !isSectionHeader(k, v) &&
      k.toLowerCase() !== "error" &&
      String(v).trim() !== ""
    );
  });
  const primaryKey = primaryIdx >= 0 ? entries[primaryIdx][0] : null;

  // Determine overall severity by scanning all results for severity indicators
  // This catches cases like Child-Pugh where "Class B" is in a separate field
  const getOverallSeverity = () => {
    let foundSeverity = "neutral";
    for (const [key, value] of entries) {
      const severity = getSeverity(key, value);
      // Priority: error > danger > warning > success > neutral
      if (severity === "error") return "error";
      if (severity === "danger") foundSeverity = "danger";
      else if (severity === "warning" && foundSeverity !== "danger")
        foundSeverity = "warning";
      else if (severity === "success" && foundSeverity === "neutral")
        foundSeverity = "success";
    }
    return foundSeverity;
  };
  const overallSeverity = getOverallSeverity();

  return (
    <section
      className="pt-4 border-t border-border space-y-4"
      aria-live="polite"
    >
      {entries.map(([key, value], idx) => {
        // Handle separators
        if (isSeparator(key, value)) {
          return <hr key={`sep-${idx}`} className="border-border my-3" />;
        }

        // Handle section headers
        if (isSectionHeader(key, value)) {
          return (
            <h4
              key={key}
              className="text-sm font-semibold text-foreground mt-4 mb-2"
            >
              {key}
            </h4>
          );
        }

        // Handle CSV download links
        if (
          key === "Download CSV" &&
          typeof value === "string" &&
          value.includes("<a href=")
        ) {
          const match = value.match(/href="([^"]+)".*download="([^"]+)"/);
          if (match) {
            const [, href, filename] = match;
            return (
              <div key={key} className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => {
                    onDownload?.(filename, calculatorId);
                    const link = document.createElement("a");
                    link.href = href;
                    link.download = filename;
                    link.click();
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Download CSV
                </button>
              </div>
            );
          }
        }

        const severity = getSeverity(key, value);
        const isPrimary = key === primaryKey;
        const isError = key.toLowerCase() === "error";

        // Primary result styling - uses overall severity for better color coding
        if (isPrimary && !isError) {
          const primarySeverity =
            overallSeverity !== "neutral" ? overallSeverity : severity;
          return (
            <div
              key={key}
              className={`p-4 rounded-lg border ${severityStyles[primarySeverity]}`}
            >
              <div className="flex items-center">
                {severityIcons[primarySeverity]}
                <span className="text-sm font-medium opacity-80">
                  {key}:&nbsp;
                </span>
              </div>
              <div className="mt-1 text-2xl font-bold">{value}</div>
            </div>
          );
        }

        // Error result styling
        if (isError) {
          return (
            <div
              key={key}
              className="p-4 rounded-lg border bg-[hsl(var(--result-danger-bg))] border-[hsl(var(--result-danger-border))]"
            >
              <div className="flex items-center text-[hsl(var(--result-danger))]">
                {severityIcons.error}
                <span className="font-medium">{value}</span>
              </div>
            </div>
          );
        }

        // Secondary results with badges for severity
        const showBadge = severity !== "neutral" && idx < 5;

        return (
          <div key={key} className="flex items-start justify-between py-1">
            <span className="text-sm text-muted-foreground">{key}:&nbsp;</span>
            <span
              className={`text-sm font-medium text-right ${showBadge ? `px-2 py-0.5 rounded ${severityStyles[severity]}` : "text-foreground"}`}
            >
              {value}
            </span>
          </div>
        );
      })}
    </section>
  );
}

export default ResultDisplay;
