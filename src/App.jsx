// App.jsx – RadCalc Clone v1.0 (shadcn/ui edition)
// React + Tailwind + shadcn/ui components
// All formulas mirror radcalc.online calculators with referenced studies.

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  ASPECTSScore,
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
  ASPECTSScore,
  FeedbackForm,
];

// Category organization for sidebar
const categories = {
  Radiology: [
    "adrenal-ct",
    "adrenal-mri",
    "fleischner",
    "prostate-volume",
    "bosniak",
    "spleen-size",
    "hip-dysplasia",
    "tirads",
  ],
  Neuroradiology: ["aspects-score"],
  "Hepatology/Liver": [
    "albi-score",
    "avs-cortisol",
    "avs-hyperaldo",
    "bclc-staging",
    "child-pugh",
    "milan-criteria",
    "meld-na",
    "mr-elastography",
    "y90-radiation-segmentectomy",
  ],
  Urology: ["ipss", "pirads", "renal-nephrometry", "shim"],
  Interventional: ["khoury-catheter-selector"],
  Feedback: ["feedback-form"],
};

/*******************************************************************
  ⬇️  Generic Field Renderer (uses shadcn Switch where needed)
*******************************************************************/
function Field({ f, val, on }) {
  if (f.type === "textarea") {
    return (
      <div className="space-y-1 md:col-span-2">
        <Label htmlFor={f.id}>
          {f.label}
          {f.subLabel && (
            <span className="text-sm text-gray-500 ml-2">({f.subLabel})</span>
          )}
        </Label>
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
        <Label>{f.label}</Label>
        <select
          className="w-full border rounded p-2 focus:outline-none focus:ring focus:ring-blue-300"
          value={val || ""}
          onChange={(e) => on(f.id, e.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {f.opts.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
    );
  }
  if (f.type === "radio") {
    return (
      <div className="space-y-2 md:col-span-2">
        <Label>{f.label}</Label>
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
      <div className="flex items-center space-x-2">
        <Switch
          id={f.id}
          checked={!!val}
          onCheckedChange={(c) => on(f.id, c)}
        />
        <Label htmlFor={f.id}>{f.label}</Label>
      </div>
    );
  }
  return (
    <div className={`space-y-1 ${f.type === "date" ? "md:col-span-2" : ""}`}>
      <Label htmlFor={f.id}>
        {f.label}
        {f.subLabel && (
          <span className="text-sm text-gray-500 ml-2">({f.subLabel})</span>
        )}
      </Label>
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
  ⬇️  Main Component
*******************************************************************/
export default function App() {
  const [active, setActive] = useState(calcDefs[0].id);
  const [vals, setVals] = useState({});
  const [out, setOut] = useState(null);
  const [mreRows, setMreRows] = useState([{ kpa: "", area: "" }]);
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
    <div className="min-h-screen flex bg-gray-50 text-gray-900 pb-16">
      {/* Sidebar */}
      <aside className="w-48 md:w-64 p-4 bg-white border-r shadow-sm space-y-2 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">Radulator</h1>
        {Object.entries(categories).map(([categoryName, calcIds]) => (
          <div key={categoryName} className="space-y-1 mb-3">
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
                    // Track calculator selection
                    trackCalculatorSelected(calc.id, calc.name, categoryName);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition text-sm ${
                    calc.id === active
                      ? "bg-blue-200 font-semibold"
                      : "hover:bg-blue-100"
                  }`}
                >
                  {calc.name}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-4 md:p-8 flex justify-center">
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
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                aria-label="Input fields"
              >
                {def.fields
                  .filter((f) => !f.showIf || f.showIf(vals))
                  .map((f) => (
                    <Field key={f.id} f={f} val={vals[f.id]} on={update} />
                  ))}
              </div>
            )}

            {def.id === "mr-elastography" && (
              <div className="space-y-3" aria-label="Dynamic ROI table">
                <h4 className="font-medium">Dynamic ROIs</h4>
                <p className="text-sm text-gray-600">
                  Tip: You can paste multiple pairs in the CSV box above, or add
                  rows here. Use decimals and consistent units.
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
                  Add time-series samples after CRH administration (typically at
                  +3, +6, +9, +15 minutes). These help identify peak ACTH
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
                          next[i] = { ...next[i], periphACTH: e.target.value };
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
              <section
                className="pt-4 border-t space-y-1 text-sm"
                aria-live="polite"
              >
                {Object.entries(out).map(([k, v]) => {
                  if (
                    def.id === "mr-elastography" &&
                    k === "Area-weighted Mean (kPa)" &&
                    out["Area-weighted Mean Raw (kPa)"]
                  ) {
                    return (
                      <p key={k}>
                        <span className="font-mono font-medium">{k}:</span>{" "}
                        <span
                          title={`Raw: ${out["Area-weighted Mean Raw (kPa)"]}`}
                        >
                          {v}
                        </span>
                      </p>
                    );
                  }
                  // Handle CSV download links for AVS calculators
                  if (
                    k === "Download CSV" &&
                    typeof v === "string" &&
                    v.includes("<a href=")
                  ) {
                    const match = v.match(/href="([^"]+)".*download="([^"]+)"/);
                    if (match) {
                      const [, href, filename] = match;
                      return (
                        <p key={k} className="mt-2">
                          <span className="font-mono font-medium">{k}:</span>{" "}
                          <a
                            href={href}
                            download={filename}
                            className="text-blue-600 underline hover:text-blue-800"
                            onClick={() => trackCSVDownload(filename, def.id)}
                          >
                            Click to download results as CSV
                          </a>
                        </p>
                      );
                    }
                  }
                  return (
                    <p key={k}>
                      <span className="font-mono font-medium">{k}:</span> {v}
                    </p>
                  );
                })}
                {def.id === "adrenal-ct" &&
                  parseFloat(out["Absolute Washout (%)"]) >= 60 && (
                    <p className="mt-1 font-medium text-gray-600">
                      Absolute washout is 60% or higher, the lesion is
                      classified as a benign adenoma.
                    </p>
                  )}
                {def.id === "prostate-volume" && (
                  <p className="mt-1 font-medium text-gray-600">
                    Normal prostate volume (≤ 30 cm³).
                  </p>
                )}
              </section>
            )}

            {/* References */}
            {def.refs && def.refs.length > 0 && (
              <section className="pt-4 border-t">
                <h3 className="font-medium mb-2">References</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {def.refs.map((r) => (
                    <li key={r.u}>
                      <a
                        href={r.u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                        onClick={() =>
                          trackOutboundLink(r.u, "reference", def.id)
                        }
                      >
                        {r.t}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer with Medical Disclaimer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-200 py-2 px-4 text-xs text-gray-600">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-center md:text-left">
            <strong>Medical Disclaimer:</strong> This tool is for educational
            and informational purposes only. It is not intended as a substitute
            for professional medical advice, diagnosis, or treatment. Always
            consult a qualified healthcare provider.
          </p>
          <div className="flex gap-4 text-gray-500">
            <a
              href="/about.html"
              className="hover:text-gray-700 hover:underline"
            >
              About
            </a>
            <a
              href="/privacy.html"
              className="hover:text-gray-700 hover:underline"
            >
              Privacy
            </a>
            <a
              href="/terms.html"
              className="hover:text-gray-700 hover:underline"
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
