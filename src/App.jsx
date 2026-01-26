// App.jsx – RadCalc Clone v1.0 (shadcn/ui edition)
// React + Tailwind + shadcn/ui components
// All formulas mirror radcalc.online calculators with referenced studies.

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import {
  AdrenalCTWashout,
  AdrenalMRICSI,
  ALBIScore,
  ProstateVolume,
  RenalCystBosniak,
  SpleenSizeULN,
  HipDysplasiaIndices,
  MRElastography,
  RenalNephrometry,
  FeedbackForm,
  AVSCortisol,
  AVSHyperaldo,
  BCLCStaging,
  ChildPugh,
  SHIMCalculator,
  IPSS,
  MilanCriteria,
  MELDNa,
  Y90RadiationSegmentectomy,
  KhouryCatheterSelector,
  TIRADS,
  PIRADS,
  Fleischner,
  LIRADS,
  ASPECTSScore,
  ContrastDosing,
  RadiationDoseConverter,
  AASTTraumaGrading,
  WellsPE,
  WellsDVT,
  MehranCIN,
  DLPDose,
  CTPancreatitis,
  LUNGRADS,
  CADRADS,
  NIRADS,
  BIRADS,
  ORADS,
} from "@/components/calculators";
import {
  trackCalculatorSelected,
  trackCalculation,
  trackOutboundLink,
  trackCSVDownload,
} from "@/lib/analytics";

/*******************************************************************
  ⬇️  Calculator Definitions (100 % parity with radcalc.online)
*******************************************************************/
const calcDefs = [
  AdrenalCTWashout,
  AdrenalMRICSI,
  ALBIScore,
  AVSCortisol,
  AVSHyperaldo,
  BCLCStaging,
  ChildPugh,
  Fleischner,
  IPSS,
  MilanCriteria,
  MELDNa,
  PIRADS,
  ProstateVolume,
  RenalCystBosniak,
  RenalNephrometry,
  SHIMCalculator,
  SpleenSizeULN,
  HipDysplasiaIndices,
  MRElastography,
  TIRADS,
  Y90RadiationSegmentectomy,
  KhouryCatheterSelector,
  LIRADS,
  ASPECTSScore,
  ContrastDosing,
  RadiationDoseConverter,
  AASTTraumaGrading,
  WellsPE,
  WellsDVT,
  MehranCIN,
  DLPDose,
  CTPancreatitis,
  LUNGRADS,
  CADRADS,
  NIRADS,
  BIRADS,
  ORADS,
  FeedbackForm,
];

// Category organization for sidebar
const categories = {
  Radiology: [
    "adrenal-ct",
    "adrenal-mri",
    "contrast-dosing",
    "dlp-dose",
    "fleischner",
    "lung-rads",
    "prostate-volume",
    "radiation-dose-converter",
    "bosniak",
    "spleen-size",
    "hip-dysplasia",
    "tirads",
  ],
  Neuroradiology: ["aspects-score", "nirads"],
  Trauma: ["aast-trauma-grading"],
  "Cardiac Imaging": ["cad-rads"],
  "Breast Imaging": ["birads"],
  "Women's Imaging": ["orads"],
  "Clinical Decision": ["wells-pe", "wells-dvt"],
  "Hepatology/Liver": [
    "albi-score",
    "avs-cortisol",
    "avs-hyperaldo",
    "bclc-staging",
    "child-pugh",
    "ct-pancreatitis",
    "lirads",
    "milan-criteria",
    "meld-na",
    "mr-elastography",
    "y90-radiation-segmentectomy",
  ],
  Urology: ["ipss", "pirads", "renal-nephrometry", "shim"],
  Interventional: ["khoury-catheter-selector"],
  Nephrology: ["mehran-cin"],
  Feedback: ["feedback-form"],
};

/*******************************************************************
  ⬇️  Fields With Sections (Progressive Disclosure)
*******************************************************************/
function FieldsWithSections({ fields, vals, update, onFieldChange }) {
  const [expandedSections, setExpandedSections] = useState({});

  // Filter visible fields
  const visibleFields = fields.filter((f) => !f.showIf || f.showIf(vals));

  // Group fields by section
  const groupedFields = visibleFields.reduce((acc, field) => {
    const section = field.section || "_default";
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {});

  const sections = Object.keys(groupedFields);
  const hasMultipleSections = sections.length > 1 || !groupedFields["_default"];

  // If no sections defined, render flat
  if (!hasMultipleSections && groupedFields["_default"]) {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        aria-label="Input fields"
      >
        {groupedFields["_default"].map((f) => (
          <Field key={f.id} f={f} val={vals[f.id]} on={onFieldChange} />
        ))}
      </div>
    );
  }

  // Initialize all sections as expanded by default
  const isSectionExpanded = (section) => {
    return expandedSections[section] !== false; // Default to expanded
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !isSectionExpanded(section),
    }));
  };

  return (
    <div className="space-y-4" aria-label="Input fields">
      {sections.map((section) => {
        if (section === "_default") {
          // Render default section without header
          return (
            <div
              key="_default"
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {groupedFields["_default"].map((f) => (
                <Field key={f.id} f={f} val={vals[f.id]} on={onFieldChange} />
              ))}
            </div>
          );
        }

        const isExpanded = isSectionExpanded(section);
        const fieldCount = groupedFields[section].length;

        return (
          <div
            key={section}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleSection(section)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              aria-expanded={isExpanded}
            >
              <span className="font-medium text-gray-700">{section}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {fieldCount} field{fieldCount > 1 ? "s" : ""}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>
            {isExpanded && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedFields[section].map((f) => (
                  <Field key={f.id} f={f} val={vals[f.id]} on={onFieldChange} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/*******************************************************************
  ⬇️  Field Label with Tooltip Support
*******************************************************************/
function FieldLabel({ htmlFor, label, subLabel, helpText }) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>
          {label}
          {subLabel && (
            <span className="text-sm text-gray-500 ml-2">({subLabel})</span>
          )}
        </Label>
        {helpText && (
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="text-gray-400 hover:text-blue-600 focus:outline-none focus:text-blue-600 md:relative md:group"
            aria-label={`Help for ${label}`}
            title={helpText}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {/* Desktop tooltip */}
            <span className="hidden md:group-hover:block absolute left-0 top-6 z-50 w-64 p-2 text-xs text-left font-normal text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg">
              {helpText}
            </span>
          </button>
        )}
      </div>
      {/* Mobile help text - shown inline when toggled */}
      {helpText && showHelp && (
        <p className="md:hidden text-xs text-gray-600 bg-gray-50 p-2 rounded">
          {helpText}
        </p>
      )}
    </div>
  );
}

/*******************************************************************
  ⬇️  Generic Field Renderer (uses shadcn Switch where needed)
*******************************************************************/
function Field({ f, val, on }) {
  if (f.type === "textarea") {
    return (
      <div className="space-y-1 md:col-span-2">
        <FieldLabel
          htmlFor={f.id}
          label={f.label}
          subLabel={f.subLabel}
          helpText={f.helpText}
        />
        <textarea
          id={f.id}
          className="w-full border rounded p-2 min-h-[120px] focus:outline-none focus:ring focus:ring-blue-300 font-mono text-sm"
          value={val ?? ""}
          onChange={(e) => on(f.id, e.target.value)}
          placeholder={f.subLabel}
        />
      </div>
    );
  }
  if (f.type === "select") {
    return (
      <div className="space-y-1">
        <FieldLabel htmlFor={f.id} label={f.label} helpText={f.helpText} />
        <Select
          id={f.id}
          value={val || ""}
          onChange={(e) => on(f.id, e.target.value)}
          placeholder="Select…"
        >
          {f.opts.map((o) => {
            // Support both string options and {value, label} objects
            const optValue = typeof o === "object" ? o.value : o;
            const optLabel = typeof o === "object" ? o.label : o;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </Select>
      </div>
    );
  }
  if (f.type === "radio") {
    return (
      <div className="space-y-2 md:col-span-2">
        <FieldLabel label={f.label} helpText={f.helpText} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {f.opts.map((opt) => (
            <div key={opt.value} className="flex items-center space-x-2">
              <input
                id={`${f.id}-${opt.value}`}
                type="radio"
                name={f.id}
                value={opt.value}
                checked={val === opt.value}
                onChange={(e) => on(f.id, e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <Label
                htmlFor={`${f.id}-${opt.value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (f.type === "checkbox") {
    return (
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <Switch
            id={f.id}
            checked={!!val}
            onCheckedChange={(c) => on(f.id, c)}
          />
          <FieldLabel htmlFor={f.id} label={f.label} helpText={f.helpText} />
        </div>
      </div>
    );
  }
  return (
    <div className={`space-y-1 ${f.type === "date" ? "md:col-span-2" : ""}`}>
      <FieldLabel
        htmlFor={f.id}
        label={f.label}
        subLabel={f.subLabel}
        helpText={f.helpText}
      />
      <Input
        id={f.id}
        type={f.type}
        value={val ?? ""}
        onChange={(e) => on(f.id, e.target.value)}
        placeholder={f.subLabel}
      />
    </div>
  );
}

/*******************************************************************
  ⬇️  Result Display Component (enhanced visual hierarchy)
*******************************************************************/
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

  // Severity badge styles
  const severityStyles = {
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    danger: "bg-red-100 text-red-800 border-red-200",
    error: "bg-red-100 text-red-800 border-red-200",
    neutral: "bg-gray-100 text-gray-800 border-gray-200",
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
    <div className="pt-4 border-t space-y-4" aria-live="polite">
      {entries.map(([key, value], idx) => {
        // Handle separators
        if (isSeparator(key, value)) {
          return <hr key={`sep-${idx}`} className="border-gray-200 my-3" />;
        }

        // Handle section headers
        if (isSectionHeader(key, value)) {
          return (
            <h4
              key={key}
              className="text-sm font-semibold text-gray-700 mt-4 mb-2"
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
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
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
                <span className="text-sm font-medium opacity-80">{key}</span>
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
              className="p-4 rounded-lg border bg-red-50 border-red-200"
            >
              <div className="flex items-center text-red-800">
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
            <span className="text-sm text-gray-600">{key}</span>
            <span
              className={`text-sm font-medium text-right ${showBadge ? `px-2 py-0.5 rounded ${severityStyles[severity]}` : "text-gray-900"}`}
            >
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/*******************************************************************
  ⬇️  Collapsible References Component
*******************************************************************/
function CollapsibleReferences({ refs, calculatorId, onLinkClick }) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE_COUNT = 3;
  const hasMore = refs.length > VISIBLE_COUNT;
  const visibleRefs = expanded ? refs : refs.slice(0, VISIBLE_COUNT);
  const hiddenCount = refs.length - VISIBLE_COUNT;

  return (
    <section className="pt-4 border-t">
      <h3 className="font-medium mb-2">References</h3>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        {visibleRefs.map((r) => (
          <li key={r.u}>
            <a
              href={r.u}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
              onClick={() => onLinkClick?.(r.u, "reference", calculatorId)}
            >
              {r.t}
            </a>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          {expanded ? (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
              Show fewer references
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              Show {hiddenCount} more reference{hiddenCount > 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </section>
  );
}

/*******************************************************************
  ⬇️  Main Component
*******************************************************************/
// localStorage key for disclaimer preference (extracted to avoid duplication)
const DISCLAIMER_STORAGE_KEY = "radulator-disclaimer-seen";

export default function App() {
  // Initialize from URL hash or default to first calculator
  const [active, setActive] = useState(() => {
    const hash = window.location.hash.replace("#/", "").replace("#", "");
    const calc = calcDefs.find((c) => c.id === hash);
    return calc ? calc.id : calcDefs[0].id;
  });
  const [vals, setVals] = useState({});
  const [out, setOut] = useState(null);
  const [mreRows, setMreRows] = useState([{ kpa: "", area: "" }]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState(() => {
    try {
      const stored = localStorage.getItem("radulator-favorites");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [recentCalcs, setRecentCalcs] = useState(() => {
    try {
      const stored = localStorage.getItem("radulator-recent");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem("radulator-dark-mode");
      if (stored !== null) return stored === "true";
      // Fallback to system preference
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try {
      return localStorage.getItem(DISCLAIMER_STORAGE_KEY) !== "true";
    } catch {
      // localStorage unavailable (private mode, storage quota, etc.)
      return true; // Show disclaimer by default if we can't check
    }
  });
  const [ipssRows, setIpssRows] = useState([
    {
      time: "",
      leftACTH: "",
      rightACTH: "",
      periphACTH: "",
      leftPRL: "",
      rightPRL: "",
      periphPRL: "",
    },
  ]);

  const def = calcDefs.find((c) => c.id === active);
  const update = (k, v) => setVals((p) => ({ ...p, [k]: v }));

  // Toggle favorite status for a calculator
  const toggleFavorite = (calcId) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(calcId)
        ? prev.filter((id) => id !== calcId)
        : [...prev, calcId];
      try {
        localStorage.setItem(
          "radulator-favorites",
          JSON.stringify(newFavorites),
        );
      } catch {
        // Silently fail if localStorage is unavailable
      }
      return newFavorites;
    });
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      try {
        localStorage.setItem("radulator-dark-mode", String(newMode));
      } catch {
        // Silently fail
      }
      return newMode;
    });
  };

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Add to recent calculators (max 5)
  const addToRecent = (calcId) => {
    setRecentCalcs((prev) => {
      const filtered = prev.filter((id) => id !== calcId);
      const newRecent = [calcId, ...filtered].slice(0, 5);
      try {
        localStorage.setItem("radulator-recent", JSON.stringify(newRecent));
      } catch {
        // Silently fail
      }
      return newRecent;
    });
  };

  const dismissDisclaimer = () => {
    try {
      localStorage.setItem(DISCLAIMER_STORAGE_KEY, "true");
    } catch {
      // Silently fail - user can still dismiss visually
    }
    setShowDisclaimer(false);
  };
  const run = () => {
    const result = def.compute(vals);
    setOut(result);

    // Find category for tracking
    const category =
      Object.keys(categories).find((cat) => categories[cat].includes(active)) ||
      "Unknown";

    // Track calculation with result status
    const hasResult = result && Object.keys(result).length > 0;
    trackCalculation(def.id, def.name, category, hasResult);
  };

  // Sync dynamic MRE rows into compute values
  useEffect(() => {
    if (def?.id === "mr-elastography") {
      setVals((p) => ({ ...p, roi_rows: mreRows }));
    }
  }, [def?.id, mreRows]);

  // Sync dynamic IPSS rows into compute values
  useEffect(() => {
    if (def?.id === "ipss") {
      setVals((p) => ({ ...p, ipssRows: ipssRows }));
    }
  }, [def?.id, ipssRows]);

  // Update page title and meta description for SEO
  useEffect(() => {
    if (def) {
      // Update document title
      document.title = `${def.name} Calculator | Radulator`;

      // Update meta description
      const metaDescription = document.querySelector(
        'meta[name="description"]',
      );
      if (metaDescription) {
        const description =
          def.metaDesc ||
          def.desc ||
          `Calculate ${def.name} - free online medical calculator with peer-reviewed references.`;
        metaDescription.setAttribute("content", description);
      }

      // Update Open Graph tags
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute("content", `${def.name} Calculator | Radulator`);
      }

      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) {
        const description =
          def.metaDesc ||
          def.desc ||
          `Calculate ${def.name} - free online medical calculator.`;
        ogDesc.setAttribute("content", description);
      }
    }
  }, [def]);

  // Sync URL hash with active calculator for shareable links
  useEffect(() => {
    const newHash = `#/${active}`;
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, "", newHash);
    }
  }, [active]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#/", "").replace("#", "");
      const calc = calcDefs.find((c) => c.id === hash);
      if (calc && calc.id !== active) {
        setActive(calc.id);
        setVals({});
        setOut(null);
        setMreRows([{ kpa: "", area: "" }]);
        setIpssRows([
          {
            time: "",
            leftACTH: "",
            rightACTH: "",
            periphACTH: "",
            leftPRL: "",
            rightPRL: "",
            periphPRL: "",
          },
        ]);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [active]);

  // Disable Calculate for MRE until at least one valid ROI pair exists
  const canRun = (() => {
    if (def.id !== "mr-elastography") return true;
    const parseValue = (val) => {
      if (val === undefined || val === null || val === "") return NaN;
      const parsed = parseFloat(String(val).replace(",", "."));
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
    };
    const roisFromFields = [
      {
        kpa: parseValue(vals["roi1_kpa"]),
        area: parseValue(vals["roi1_area"]),
      },
      {
        kpa: parseValue(vals["roi2_kpa"]),
        area: parseValue(vals["roi2_area"]),
      },
      {
        kpa: parseValue(vals["roi3_kpa"]),
        area: parseValue(vals["roi3_area"]),
      },
      {
        kpa: parseValue(vals["roi4_kpa"]),
        area: parseValue(vals["roi4_area"]),
      },
    ].filter(
      (r) => Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0,
    );
    const csv = String(vals["roi_csv"] || "");
    const roisFromCsv = csv
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split(/[;,\s]+/).filter(Boolean);
        const kpa = parseValue(parts[0]);
        const area = parseValue(parts[1]);
        return { kpa, area };
      })
      .filter(
        (r) => Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0,
      );
    const roisFromRows = Array.isArray(mreRows)
      ? mreRows
          .map((r) => ({ kpa: parseValue(r?.kpa), area: parseValue(r?.area) }))
          .filter(
            (r) =>
              Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0,
          )
      : [];
    return roisFromFields.length + roisFromCsv.length + roisFromRows.length > 0;
  })();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Maintenance Banner */}
      <div
        role="status"
        className="bg-amber-100 border-b border-amber-300 px-4 py-3 text-sm text-amber-900 text-center"
      >
        <p>
          <strong>Under Maintenance:</strong> Radulator is currently undergoing
          development and expansion. Full functionality will resume by{" "}
          <strong>January 27, 2026</strong>. Mohib apologizes for any
          inconvenience.
        </p>
      </div>

      {/* Dismissible Medical Disclaimer Banner */}
      {showDisclaimer && (
        <div
          role="alert"
          className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-xs md:text-sm text-blue-800 flex items-center justify-between"
        >
          <p>
            <strong>Medical Disclaimer:</strong> For educational purposes only.
            Not a substitute for professional medical advice.{" "}
            <a href="/terms.html" className="underline ml-1">
              Learn more
            </a>
          </p>
          <button
            onClick={dismissDisclaimer}
            className="ml-4 text-blue-600 hover:text-blue-800 font-medium text-sm"
            aria-label="Dismiss medical disclaimer banner"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content wrapper for sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Header with Hamburger */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b dark:border-gray-700 shadow-sm px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Radulator</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64
            bg-white dark:bg-gray-900 border-r dark:border-gray-700 shadow-lg md:shadow-sm
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            p-4 space-y-2 overflow-y-auto
          `}
        >
          {/* Close button for mobile */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Radulator</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 -mr-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close navigation menu"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Calculator Search */}
          <div className="relative mb-4">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search calculators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Search calculators"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Favorites Section */}
          {favorites.length > 0 && !searchQuery && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wide px-2 mb-1 flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Favorites
              </h3>
              <div className="space-y-1">
                {favorites.map((calcId) => {
                  const calc = calcDefs.find((c) => c.id === calcId);
                  if (!calc) return null;
                  return (
                    <button
                      key={calc.id}
                      onClick={() => {
                        setActive(calc.id);
                        setVals({});
                        setOut(null);
                        setSidebarOpen(false);
                        addToRecent(calc.id);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition text-sm flex items-center justify-between ${
                        calc.id === active
                          ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <span>{calc.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(calc.id);
                        }}
                        className="text-amber-500 hover:text-amber-600"
                        aria-label="Remove from favorites"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Section */}
          {recentCalcs.length > 0 && !searchQuery && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-1 flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Recent
              </h3>
              <div className="space-y-1">
                {recentCalcs
                  .filter((id) => !favorites.includes(id))
                  .slice(0, 3)
                  .map((calcId) => {
                    const calc = calcDefs.find((c) => c.id === calcId);
                    if (!calc) return null;
                    return (
                      <button
                        key={calc.id}
                        onClick={() => {
                          setActive(calc.id);
                          setVals({});
                          setOut(null);
                          setSidebarOpen(false);
                          addToRecent(calc.id);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg transition text-sm ${
                          calc.id === active
                            ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {calc.name}
                      </button>
                    );
                  })}
              </div>
              <hr className="border-gray-200 my-3" />
            </div>
          )}

          {/* Calculator List */}
          {(() => {
            const query = searchQuery.toLowerCase().trim();
            const filteredCategories = Object.entries(categories)
              .map(([categoryName, calcIds]) => {
                const filteredCalcs = calcIds.filter((calcId) => {
                  const calc = calcDefs.find((c) => c.id === calcId);
                  if (!calc) return false;
                  if (!query) return true;
                  return (
                    calc.name.toLowerCase().includes(query) ||
                    calc.desc.toLowerCase().includes(query) ||
                    calc.id.toLowerCase().includes(query)
                  );
                });
                return [categoryName, filteredCalcs];
              })
              .filter(([, calcIds]) => calcIds.length > 0);

            if (query && filteredCategories.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm">No calculators found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              );
            }

            return filteredCategories.map(([categoryName, calcIds]) => (
              <div key={categoryName}>
                {/* Visual separator before Feedback category */}
                {categoryName === "Feedback" && (
                  <hr className="border-gray-200 my-3" />
                )}
                <div className="space-y-1 mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-1">
                    {categoryName}
                  </h3>
                  {calcIds.map((calcId) => {
                    const calc = calcDefs.find((c) => c.id === calcId);
                    if (!calc) return null;
                    return (
                      <button
                        key={calc.id}
                        onClick={() => {
                          setActive(calc.id);
                          setVals({});
                          setOut(null);
                          setMreRows([{ kpa: "", area: "" }]);
                          setIpssRows([
                            {
                              time: "",
                              leftACTH: "",
                              rightACTH: "",
                              periphACTH: "",
                              leftPRL: "",
                              rightPRL: "",
                              periphPRL: "",
                            },
                          ]);
                          // Close sidebar on mobile
                          setSidebarOpen(false);
                          // Track recent calculators
                          addToRecent(calc.id);
                          // Track calculator selection
                          trackCalculatorSelected(
                            calc.id,
                            calc.name,
                            categoryName,
                          );
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg transition text-sm flex items-center justify-between group ${
                          calc.id === active
                            ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <span>{calc.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(calc.id);
                          }}
                          className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                            favorites.includes(calc.id)
                              ? "opacity-100 text-amber-500"
                              : "text-gray-400 hover:text-amber-500"
                          }`}
                          aria-label={
                            favorites.includes(calc.id)
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          <svg
                            className="w-4 h-4"
                            fill={
                              favorites.includes(calc.id)
                                ? "currentColor"
                                : "none"
                            }
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            />
                          </svg>
                        </button>
                      </button>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </aside>

        {/* Main Panel */}
        <main className="flex-1 p-4 pt-16 md:pt-4 md:p-8 flex justify-center overflow-y-auto">
          <Card className="w-full max-w-4xl">
            <CardContent className="space-y-6 p-8">
              <header>
                <h2 className="text-xl font-semibold mb-1">{def.name}</h2>
                <p className="text-sm text-gray-600">{def.desc}</p>
              </header>

              {def.info && (
                <div className="bg-blue-50/60 border border-blue-200 rounded-md p-4 text-sm space-y-4">
                  <div
                    className={
                      def.info.image
                        ? "grid grid-cols-1 lg:grid-cols-2 gap-4"
                        : ""
                    }
                  >
                    <div>
                      <p className="whitespace-pre-line text-gray-800">
                        {def.info.text}
                      </p>
                      {def.info.link && (
                        <Button
                          className="mt-2 bg-blue-500 text-white hover:bg-blue-600"
                          onClick={() => {
                            trackOutboundLink(
                              def.info.link.url,
                              "info_button",
                              def.id,
                            );
                            window.open(def.info.link.url, "_blank");
                          }}
                        >
                          {def.info.link.label}
                        </Button>
                      )}
                    </div>
                    {def.info.image && (
                      <div className="flex justify-center">
                        <img
                          src={def.info.image}
                          alt="Reference diagram"
                          className="max-w-full h-auto rounded-md border border-gray-200"
                          style={{ maxHeight: "300px" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {def.isCustomComponent ? (
                <def.Component />
              ) : (
                <FieldsWithSections
                  fields={def.fields}
                  vals={vals}
                  update={update}
                  onFieldChange={update}
                />
              )}

              {def.id === "mr-elastography" && (
                <div className="space-y-3" aria-label="Dynamic ROI table">
                  <h4 className="font-medium">Dynamic ROIs</h4>
                  <p className="text-sm text-gray-600">
                    Tip: You can paste multiple pairs in the CSV box above, or
                    add rows here. Use decimals and consistent units.
                  </p>
                  <div className="grid grid-cols-3 gap-4 font-medium">
                    <div>Slice / ROI</div>
                    <div>Stiffness (kPa)</div>
                    <div>ROI Area</div>
                  </div>
                  {mreRows.map((r, i) => {
                    const parseValue = (val) => {
                      if (val === undefined || val === null || val === "")
                        return NaN;
                      const parsed = parseFloat(String(val).replace(",", "."));
                      return Number.isFinite(parsed) && parsed >= 0
                        ? parsed
                        : NaN;
                    };
                    const kpaNum = parseValue(r.kpa);
                    const areaNum = parseValue(r.area);
                    const kpaInvalid = r.kpa !== "" && !Number.isFinite(kpaNum);
                    const areaInvalid =
                      r.area !== "" &&
                      (!Number.isFinite(areaNum) || areaNum <= 0);
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-3 gap-4 items-center"
                      >
                        <div className="text-gray-500">#{i + 1}</div>
                        <Input
                          placeholder="e.g., 2.8"
                          value={r.kpa}
                          inputMode="decimal"
                          className={kpaInvalid ? "border-red-500" : ""}
                          aria-invalid={kpaInvalid ? "true" : "false"}
                          aria-label={`ROI ${i + 1} stiffness in kPa`}
                          onChange={(e) => {
                            const next = mreRows.slice();
                            next[i] = { ...next[i], kpa: e.target.value };
                            setMreRows(next);
                          }}
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., 50.0"
                            value={r.area}
                            inputMode="decimal"
                            className={areaInvalid ? "border-red-500" : ""}
                            aria-invalid={areaInvalid ? "true" : "false"}
                            aria-label={`ROI ${i + 1} area in cm²`}
                            onChange={(e) => {
                              const next = mreRows.slice();
                              next[i] = { ...next[i], area: e.target.value };
                              setMreRows(next);
                            }}
                          />
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setMreRows((rows) =>
                                rows.filter((_, idx) => idx !== i),
                              )
                            }
                            disabled={mreRows.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setMreRows((rows) => [...rows, { kpa: "", area: "" }])
                    }
                  >
                    Add ROI
                  </Button>
                </div>
              )}

              {def.id === "ipss" && (
                <div className="space-y-3" aria-label="Post-CRH Sample Table">
                  <h4 className="font-medium">Post-CRH Stimulation Samples</h4>
                  <p className="text-sm text-gray-600">
                    Add time-series samples after CRH administration (typically
                    at +3, +6, +9, +15 minutes). These help identify peak ACTH
                    response and improve lateralization accuracy.
                  </p>
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-8 gap-2 font-medium text-xs min-w-max">
                      <div>Time</div>
                      <div>Lt ACTH</div>
                      <div>Rt ACTH</div>
                      <div>Per ACTH</div>
                      <div>Lt PRL</div>
                      <div>Rt PRL</div>
                      <div>Per PRL</div>
                      <div>Action</div>
                    </div>
                    {ipssRows.map((r, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-8 gap-2 items-center min-w-max"
                      >
                        <Input
                          placeholder="+3"
                          value={r.time}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) => {
                            const next = ipssRows.slice();
                            next[i] = { ...next[i], time: e.target.value };
                            setIpssRows(next);
                          }}
                        />
                        <Input
                          placeholder="pg/mL"
                          value={r.leftACTH}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) => {
                            const next = ipssRows.slice();
                            next[i] = { ...next[i], leftACTH: e.target.value };
                            setIpssRows(next);
                          }}
                        />
                        <Input
                          placeholder="pg/mL"
                          value={r.rightACTH}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) => {
                            const next = ipssRows.slice();
                            next[i] = { ...next[i], rightACTH: e.target.value };
                            setIpssRows(next);
                          }}
                        />
                        <Input
                          placeholder="pg/mL"
                          value={r.periphACTH}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) => {
                            const next = ipssRows.slice();
                            next[i] = {
                              ...next[i],
                              periphACTH: e.target.value,
                            };
                            setIpssRows(next);
                          }}
                        />
                        <Input
                          placeholder="ng/mL"
                          value={r.leftPRL}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) => {
                            const next = ipssRows.slice();
                            next[i] = { ...next[i], leftPRL: e.target.value };
                            setIpssRows(next);
                          }}
                        />
                        <Input
                          placeholder="ng/mL"
                          value={r.rightPRL}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) => {
                            const next = ipssRows.slice();
                            next[i] = { ...next[i], rightPRL: e.target.value };
                            setIpssRows(next);
                          }}
                        />
                        <Input
                          placeholder="ng/mL"
                          value={r.periphPRL}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) => {
                            const next = ipssRows.slice();
                            next[i] = { ...next[i], periphPRL: e.target.value };
                            setIpssRows(next);
                          }}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setIpssRows((rows) =>
                              rows.filter((_, idx) => idx !== i),
                            )
                          }
                          disabled={ipssRows.length <= 1}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setIpssRows((rows) => [
                          ...rows,
                          {
                            time: "",
                            leftACTH: "",
                            rightACTH: "",
                            periphACTH: "",
                            leftPRL: "",
                            rightPRL: "",
                            periphPRL: "",
                          },
                        ])
                      }
                    >
                      Add Sample Time Point
                    </Button>
                  </div>
                </div>
              )}

              {!canRun && def.id === "mr-elastography" && (
                <p className="text-xs text-gray-600" role="note">
                  Enter at least one valid ROI (kPa and area &gt; 0) in fields,
                  CSV, or dynamic rows to enable Calculate.
                </p>
              )}
              {!def.isCustomComponent && (
                <Button
                  className="w-full"
                  onClick={run}
                  disabled={!canRun}
                  aria-disabled={!canRun}
                >
                  Calculate
                </Button>
              )}

              {out && !def.isCustomComponent && (
                <>
                  <ResultDisplay
                    results={out}
                    calculatorId={def.id}
                    onDownload={(filename, calcId) =>
                      trackCSVDownload(filename, calcId)
                    }
                  />
                  {/* Calculator-specific interpretive notes */}
                  {def.id === "adrenal-ct" &&
                    parseFloat(out["Absolute Washout (%)"]) >= 60 && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center text-green-800">
                          <svg
                            className="w-4 h-4 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="font-medium">
                            Absolute washout ≥60% indicates benign adenoma.
                          </span>
                        </div>
                      </div>
                    )}
                  {def.id === "prostate-volume" &&
                    parseFloat(
                      out["Volume (cm³)"]?.replace(/[^\d.]/g, "") || "0",
                    ) <= 30 && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center text-green-800">
                          <svg
                            className="w-4 h-4 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="font-medium">
                            Normal prostate volume (≤30 cm³).
                          </span>
                        </div>
                      </div>
                    )}
                  {/* Print Results Button */}
                  <div className="mt-4 flex justify-end no-print">
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors print-button"
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
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                        />
                      </svg>
                      Print Results
                    </button>
                  </div>
                </>
              )}

              {/* References */}
              {def.refs && def.refs.length > 0 && (
                <CollapsibleReferences
                  refs={def.refs}
                  calculatorId={def.id}
                  onLinkClick={trackOutboundLink}
                />
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-center md:text-left">
            For educational purposes only.{" "}
            <a href="/terms.html" className="hover:underline">
              Full disclaimer
            </a>
          </p>
          <div className="flex items-center gap-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {darkMode ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
            <a
              href="/about.html"
              className="hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
            >
              About
            </a>
            <a
              href="/privacy.html"
              className="hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
            >
              Privacy
            </a>
            <a
              href="/terms.html"
              className="hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
            >
              Terms
            </a>
            <span>&copy; {new Date().getFullYear()} Radulator</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/*******************************************************************
  ➕  Adding new calculators
  ------------------------------------------------------------------
  1. Create a new calculator component in src/components/calculators/
  2. Export it from the index.js file
  3. Import and add it to the calcDefs array above
  4. Supported field types: number, date, select {opts:[]}, radio {opts:[{value,label}]}, checkbox.
*******************************************************************/
