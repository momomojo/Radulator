import React, { useState } from "react";
import Field from "./Field";

/**
 * Fields With Sections (Progressive Disclosure)
 * Groups form fields into collapsible sections for better organization
 */
function FieldsWithSections({ fields, vals, onFieldChange }) {
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

export default FieldsWithSections;
