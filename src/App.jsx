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
  ProstateVolume,
  RenalCystBosniak,
  SpleenSizeULN,
  HipDysplasiaIndices,
  MRElastography,
  RenalNephrometry,
  FeedbackForm,
} from "@/components/calculators";

/*******************************************************************
  ⬇️  Calculator Definitions (100 % parity with radcalc.online)
*******************************************************************/
const calcDefs = [
  AdrenalCTWashout,
  AdrenalMRICSI,
  ProstateVolume,
  RenalCystBosniak,
  RenalNephrometry,
  SpleenSizeULN,
  HipDysplasiaIndices,
  MRElastography,
  FeedbackForm,
];

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

  const def = calcDefs.find((c) => c.id === active);
  const update = (k, v) => setVals((p) => ({ ...p, [k]: v }));
  const run = () => setOut(def.compute(vals));

  // Sync dynamic MRE rows into compute values
  useEffect(() => {
    if (def?.id === "mr-elastography") {
      setVals((p) => ({ ...p, roi_rows: mreRows }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def?.id, mreRows]);

  // Disable Calculate for MRE until at least one valid ROI pair exists
  const canRun = (() => {
    if (def.id !== "mr-elastography") return true;
    const parseValue = (val) => {
      if (val === undefined || val === null || val === "") return NaN;
      const parsed = parseFloat(String(val).replace(",", "."));
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
    };
    const roisFromFields = [
      { kpa: parseValue(vals["roi1_kpa"]), area: parseValue(vals["roi1_area"]) },
      { kpa: parseValue(vals["roi2_kpa"]), area: parseValue(vals["roi2_area"]) },
      { kpa: parseValue(vals["roi3_kpa"]), area: parseValue(vals["roi3_area"]) },
      { kpa: parseValue(vals["roi4_kpa"]), area: parseValue(vals["roi4_area"]) },
    ].filter((r) => Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0);
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
      .filter((r) => Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0);
    const roisFromRows = Array.isArray(mreRows)
      ? mreRows
          .map((r) => ({ kpa: parseValue(r?.kpa), area: parseValue(r?.area) }))
          .filter((r) => Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0)
      : [];
    return roisFromFields.length + roisFromCsv.length + roisFromRows.length > 0;
  })();

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="w-48 md:w-64 p-4 bg-white border-r shadow-sm space-y-2">
        <h1 className="text-2xl font-bold mb-4">Radulator</h1>
        {calcDefs.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setActive(c.id);
              setVals({});
              setOut(null);
              setMreRows([{ kpa: "", area: "" }]);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              c.id === active
                ? "bg-blue-200 font-semibold"
                : "hover:bg-blue-100"
            }`}
          >
            {c.name}
          </button>
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
                <div className={def.info.image ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : ""}>
                  <div>
                    <p className="whitespace-pre-line text-gray-800">
                      {def.info.text}
                    </p>
                    {def.info.link && (
                      <Button
                        className="mt-2 bg-blue-500 text-white hover:bg-blue-600"
                        onClick={() => window.open(def.info.link.url, "_blank")}
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
                        style={{ maxHeight: '300px' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {def.isCustomComponent ? (
              <def.Component />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Input fields">
                {def.fields.map((f) => (
                  <Field key={f.id} f={f} val={vals[f.id]} on={update} />
                ))}
              </div>
            )}

            {def.id === "mr-elastography" && (
              <div className="space-y-3" aria-label="Dynamic ROI table">
                <h4 className="font-medium">Dynamic ROIs</h4>
                <p className="text-sm text-gray-600">Tip: You can paste multiple pairs in the CSV box above, or add rows here. Use decimals and consistent units.</p>
                <div className="grid grid-cols-3 gap-4 font-medium">
                  <div>Slice / ROI</div>
                  <div>Stiffness (kPa)</div>
                  <div>ROI Area</div>
                </div>
                {mreRows.map((r, i) => {
                  const parseValue = (val) => {
                    if (val === undefined || val === null || val === "") return NaN;
                    const parsed = parseFloat(String(val).replace(",", "."));
                    return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
                  };
                  const kpaNum = parseValue(r.kpa);
                  const areaNum = parseValue(r.area);
                  const kpaInvalid = r.kpa !== "" && !Number.isFinite(kpaNum);
                  const areaInvalid = r.area !== "" && (!Number.isFinite(areaNum) || areaNum <= 0);
                  return (
                    <div key={i} className="grid grid-cols-3 gap-4 items-center">
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
                          onClick={() => setMreRows((rows) => rows.filter((_, idx) => idx !== i))}
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
                  onClick={() => setMreRows((rows) => [...rows, { kpa: "", area: "" }])}
                >
                  Add ROI
                </Button>
              </div>
            )}

            {!canRun && def.id === "mr-elastography" && (
              <p className="text-xs text-gray-600" role="note">Enter at least one valid ROI (kPa and area &gt; 0) in fields, CSV, or dynamic rows to enable Calculate.</p>
            )}
            {!def.isCustomComponent && (
              <Button className="w-full" onClick={run} disabled={!canRun} aria-disabled={!canRun}>
                Calculate
              </Button>
            )}

            {out && !def.isCustomComponent && (
              <section className="pt-4 border-t space-y-1 text-sm" aria-live="polite">
                {Object.entries(out).map(([k, v]) => {
                  if (
                    def.id === "mr-elastography" &&
                    k === "Area-weighted Mean (kPa)" &&
                    out["Area-weighted Mean Raw (kPa)"]
                  ) {
                    return (
                      <p key={k}>
                        <span className="font-mono font-medium">{k}:</span>{" "}
                        <span title={`Raw: ${out["Area-weighted Mean Raw (kPa)"]}`}>{v}</span>
                      </p>
                    );
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
