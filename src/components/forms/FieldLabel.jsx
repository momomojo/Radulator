import React, { useState } from "react";
import { Label } from "@/components/ui/label";

/**
 * Field Label with Tooltip Support
 * Provides accessible labels with optional help text displayed as tooltips
 */
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

export default FieldLabel;
