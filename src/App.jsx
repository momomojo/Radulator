// App.jsx – RadCalc Clone v2.0 (Refactored with Context + Hooks)
// React + Tailwind + shadcn/ui components
// All formulas mirror radcalc.online calculators with referenced studies.

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldsWithSections } from "@/components/forms";
import { ResultDisplay, CollapsibleReferences } from "@/components/display";
import { CalculatorProvider, useCalculator } from "@/context";
import { usePreferences, useUrlSync, usePageMeta } from "@/hooks";
// Auto-discovered calculator registry
import { calcDefs, categories } from "@/components/calculators";
import {
  trackCalculatorSelected,
  trackCalculation,
  trackOutboundLink,
  trackCSVDownload,
} from "@/lib/analytics";

/*******************************************************************
  App Wrapper - Provides Context
  Calculator definitions and categories are auto-discovered from registry
*******************************************************************/
export default function App() {
  // Get initial calculator from URL
  const { initialId } = useUrlSync(calcDefs, null);

  return (
    <CalculatorProvider defaultCalculatorId={initialId}>
      <AppContent />
    </CalculatorProvider>
  );
}

/*******************************************************************
  Main App Content - Uses Context
*******************************************************************/
function AppContent() {
  // Calculator state from context
  const {
    active,
    vals,
    out,
    mreRows,
    ipssRows,
    selectCalculator,
    updateField,
    setResults,
    addMreRow,
    removeMreRow,
    updateMreRow,
    addIpssRow,
    removeIpssRow,
    updateIpssRow,
  } = useCalculator();

  // User preferences
  const {
    favorites,
    toggleFavorite,
    isFavorite,
    recentCalcs,
    addToRecent,
    darkMode,
    toggleDarkMode,
    showDisclaimer,
    dismissDisclaimer,
  } = usePreferences();

  // UI state (local only)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Current calculator definition
  const def = useMemo(() => calcDefs.find((c) => c.id === active), [active]);

  // URL sync
  const { syncUrlToCalculator } = useUrlSync(calcDefs, (id) => {
    if (id !== active) {
      selectCalculator(id);
    }
  });

  // Update URL when calculator changes
  useEffect(() => {
    syncUrlToCalculator(active);
  }, [active, syncUrlToCalculator]);

  // Page meta tags
  usePageMeta(def);

  // Sync MRE rows into compute values
  useEffect(() => {
    if (def?.id === "mr-elastography") {
      updateField("roi_rows", mreRows);
    }
  }, [def?.id, mreRows, updateField]);

  // Sync IPSS rows into compute values
  useEffect(() => {
    if (def?.id === "ipss") {
      updateField("ipssRows", ipssRows);
    }
  }, [def?.id, ipssRows, updateField]);

  // Handle calculator selection
  const handleSelectCalculator = (calc, categoryName) => {
    selectCalculator(calc.id);
    setSidebarOpen(false);
    addToRecent(calc.id);
    trackCalculatorSelected(calc.id, calc.name, categoryName);
  };

  // Run calculation
  const run = () => {
    const result = def.compute(vals);
    setResults(result);

    const category =
      Object.keys(categories).find((cat) => categories[cat].includes(active)) ||
      "Unknown";
    const hasResult = result && Object.keys(result).length > 0;
    trackCalculation(def.id, def.name, category, hasResult);
  };

  // Disable Calculate for MRE until at least one valid ROI pair exists
  const canRun = useMemo(() => {
    if (def?.id !== "mr-elastography") return true;
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
  }, [def?.id, vals, mreRows]);

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
          <div className="w-10" />
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
                      onClick={() => handleSelectCalculator(calc, "Favorites")}
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
                        onClick={() => handleSelectCalculator(calc, "Recent")}
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

          {/* Calculator List by Category */}
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
                        onClick={() =>
                          handleSelectCalculator(calc, categoryName)
                        }
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
                            isFavorite(calc.id)
                              ? "opacity-100 text-amber-500"
                              : "text-gray-400 hover:text-amber-500"
                          }`}
                          aria-label={
                            isFavorite(calc.id)
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          <svg
                            className="w-4 h-4"
                            fill={isFavorite(calc.id) ? "currentColor" : "none"}
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
                  onFieldChange={updateField}
                />
              )}

              {/* MR Elastography Dynamic Rows */}
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
                          onChange={(e) =>
                            updateMreRow(i, { kpa: e.target.value })
                          }
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., 50.0"
                            value={r.area}
                            inputMode="decimal"
                            className={areaInvalid ? "border-red-500" : ""}
                            aria-invalid={areaInvalid ? "true" : "false"}
                            aria-label={`ROI ${i + 1} area in cm²`}
                            onChange={(e) =>
                              updateMreRow(i, { area: e.target.value })
                            }
                          />
                          <Button
                            variant="secondary"
                            onClick={() => removeMreRow(i)}
                            disabled={mreRows.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <Button variant="secondary" onClick={addMreRow}>
                    Add ROI
                  </Button>
                </div>
              )}

              {/* IPSS Dynamic Rows */}
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
                          onChange={(e) =>
                            updateIpssRow(i, { time: e.target.value })
                          }
                        />
                        <Input
                          placeholder="pg/mL"
                          value={r.leftACTH}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) =>
                            updateIpssRow(i, { leftACTH: e.target.value })
                          }
                        />
                        <Input
                          placeholder="pg/mL"
                          value={r.rightACTH}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) =>
                            updateIpssRow(i, { rightACTH: e.target.value })
                          }
                        />
                        <Input
                          placeholder="pg/mL"
                          value={r.periphACTH}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) =>
                            updateIpssRow(i, { periphACTH: e.target.value })
                          }
                        />
                        <Input
                          placeholder="ng/mL"
                          value={r.leftPRL}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) =>
                            updateIpssRow(i, { leftPRL: e.target.value })
                          }
                        />
                        <Input
                          placeholder="ng/mL"
                          value={r.rightPRL}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) =>
                            updateIpssRow(i, { rightPRL: e.target.value })
                          }
                        />
                        <Input
                          placeholder="ng/mL"
                          value={r.periphPRL}
                          inputMode="decimal"
                          className="text-sm"
                          onChange={(e) =>
                            updateIpssRow(i, { periphPRL: e.target.value })
                          }
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => removeIpssRow(i)}
                          disabled={ipssRows.length <= 1}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button variant="secondary" onClick={addIpssRow}>
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
