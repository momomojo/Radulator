// Adrenal Vein Sampling – Cortisol (Autonomous Cushing) Calculator – Enhanced Edition
//
// This calculator provides comprehensive cortisol lateralization analysis during
// adrenal vein sampling for ACTH-independent cortisol excess (mild or subclinical
// Cushing syndrome). It implements Young et al. criteria with full support for:
// • Patient metadata (initials, date, side of nodule)
// • Multiple samples per adrenal vein with averaging
// • Infrarenal and suprarenal IVC measurements
// • Automatic "Adrenal Blood" validation (epinephrine gradient >100 pg/mL)
// • Visual indicators for cannulation success
// • Comprehensive CSV output matching clinical workflow templates
//
// References: Young WF et al. World J Surg 2008; Acharya R et al. World J Surg 2019

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const AVSCortisol = {
  id: "avs-cortisol",
  name: "AVS – Cortisol (Cushing)",
  desc: "Comprehensive adrenal vein sampling interpretation for ACTH-independent hypercortisolism with multi-sample support.",
  isCustomComponent: true,
  Component: function AVSCortisolCalculator() {
    // Patient metadata
    const [patientInitials, setPatientInitials] = useState("");
    const [procedureDate, setProcedureDate] = useState("");
    const [sideOfNodule, setSideOfNodule] = useState("");

    // IVC measurements
    const [infrarenalIVCCort, setInfrarenalIVCCort] = useState("");
    const [infrarenalIVCEpi, setInfrarenalIVCEpi] = useState("");
    const [suprarenalIVCCort, setSuprarenalIVCCort] = useState("");
    const [suprarenalIVCEpi, setSuprarenalIVCEpi] = useState("");

    // Left adrenal vein samples (support up to 2)
    const [leftSamples, setLeftSamples] = useState([
      { time: "", cortisol: "", epinephrine: "" }
    ]);

    // Right adrenal vein samples (support up to 4)
    const [rightSamples, setRightSamples] = useState([
      { time: "", cortisol: "", epinephrine: "" }
    ]);

    const [results, setResults] = useState(null);

    // Unit selections
    const [cortUnits, setCortUnits] = useState("µg/dL"); // "µg/dL" or "nmol/L"
    const [epiUnits, setEpiUnits] = useState("pg/mL"); // "pg/mL" or "ng/L" (same numerically)

    // Unit conversion functions
    const convertCortToStandard = (value) => {
      // Standard: µg/dL
      if (cortUnits === "nmol/L") return value / 27.59; // nmol/L to µg/dL
      return value; // already in µg/dL
    };

    const formatCortForDisplay = (value) => {
      // Convert from standard (µg/dL) to user's preferred units
      if (cortUnits === "nmol/L") return (value * 27.59).toFixed(2);
      return value.toFixed(2);
    };

    const addLeftSample = () => {
      if (leftSamples.length < 2) {
        setLeftSamples([...leftSamples, { time: "", cortisol: "", epinephrine: "" }]);
      }
    };

    const addRightSample = () => {
      if (rightSamples.length < 4) {
        setRightSamples([...rightSamples, { time: "", cortisol: "", epinephrine: "" }]);
      }
    };

    const removeLeftSample = (index) => {
      if (leftSamples.length > 1) {
        setLeftSamples(leftSamples.filter((_, i) => i !== index));
      }
    };

    const removeRightSample = (index) => {
      if (rightSamples.length > 1) {
        setRightSamples(rightSamples.filter((_, i) => i !== index));
      }
    };

    const updateLeftSample = (index, field, value) => {
      const updated = [...leftSamples];
      updated[index][field] = value;
      setLeftSamples(updated);
    };

    const updateRightSample = (index, field, value) => {
      const updated = [...rightSamples];
      updated[index][field] = value;
      setRightSamples(updated);
    };

    const calculate = () => {
      // Use suprarenal IVC if available, otherwise infrarenal - convert to standard units
      const ivcCortStd = convertCortToStandard(parseFloat(suprarenalIVCCort || infrarenalIVCCort) || 0);
      const ivcEpi = parseFloat(suprarenalIVCEpi || infrarenalIVCEpi) || 0; // Epi units are already standard (pg/mL)

      // Process left samples - convert to standard units and validate epinephrine INDIVIDUALLY
      const leftValidSamples = leftSamples
        .map(s => ({
          cortisol: convertCortToStandard(parseFloat(s.cortisol)),
          epinephrine: parseFloat(s.epinephrine), // Epi already in pg/mL
          time: s.time
        }))
        .filter(s => !isNaN(s.cortisol) && !isNaN(s.epinephrine));

      // Process right samples - convert to standard units and validate epinephrine INDIVIDUALLY
      const rightValidSamples = rightSamples
        .map(s => ({
          cortisol: convertCortToStandard(parseFloat(s.cortisol)),
          epinephrine: parseFloat(s.epinephrine), // Epi already in pg/mL
          time: s.time
        }))
        .filter(s => !isNaN(s.cortisol) && !isNaN(s.epinephrine));

      if (leftValidSamples.length === 0 || rightValidSamples.length === 0 || ivcCortStd === 0) {
        setResults({ error: "Insufficient data. Please enter at least one valid sample per side and IVC cortisol." });
        return;
      }

      // Filter samples that pass epinephrine validation (each sample must have Epi Δ > 100 pg/mL)
      const leftSuccessfulSamples = leftValidSamples.filter(s => (s.epinephrine - ivcEpi) > 100);
      const rightSuccessfulSamples = rightValidSamples.filter(s => (s.epinephrine - ivcEpi) > 100);

      // Cannulation success determined by whether ANY samples passed epinephrine threshold
      const leftAdrenalBlood = leftSuccessfulSamples.length > 0;
      const rightAdrenalBlood = rightSuccessfulSamples.length > 0;

      // Calculate averages for display (all samples)
      const leftAvgCort = leftValidSamples.reduce((sum, s) => sum + s.cortisol, 0) / leftValidSamples.length;
      const leftAvgEpi = leftValidSamples.reduce((sum, s) => sum + s.epinephrine, 0) / leftValidSamples.length;
      const rightAvgCort = rightValidSamples.reduce((sum, s) => sum + s.cortisol, 0) / rightValidSamples.length;
      const rightAvgEpi = rightValidSamples.reduce((sum, s) => sum + s.epinephrine, 0) / rightValidSamples.length;

      // Calculate Epi Δ for display using SUCCESSFUL samples only
      const leftEpiDelta = leftAdrenalBlood
        ? (leftSuccessfulSamples.reduce((sum, s) => sum + s.epinephrine, 0) / leftSuccessfulSamples.length) - ivcEpi
        : leftAvgEpi - ivcEpi; // Fallback to all samples if no successful samples
      const rightEpiDelta = rightAdrenalBlood
        ? (rightSuccessfulSamples.reduce((sum, s) => sum + s.epinephrine, 0) / rightSuccessfulSamples.length) - ivcEpi
        : rightAvgEpi - ivcEpi; // Fallback to all samples if no successful samples

      // AV/PV cortisol ratios - ONLY use samples that passed epinephrine validation
      let leftRatio = null;
      let rightRatio = null;
      let clr = null;

      if (leftAdrenalBlood) {
        const leftSuccessfulAvgCort = leftSuccessfulSamples.reduce((sum, s) => sum + s.cortisol, 0) / leftSuccessfulSamples.length;
        leftRatio = leftSuccessfulAvgCort / ivcCortStd;
      }

      if (rightAdrenalBlood) {
        const rightSuccessfulAvgCort = rightSuccessfulSamples.reduce((sum, s) => sum + s.cortisol, 0) / rightSuccessfulSamples.length;
        rightRatio = rightSuccessfulAvgCort / ivcCortStd;
      }

      // CLR (cortisol lateralization ratio) - only compute if BOTH sides successful
      if (leftAdrenalBlood && rightAdrenalBlood) {
        clr = Math.max(leftRatio, rightRatio) / Math.min(leftRatio, rightRatio);
      }

      // Interpretation per Young criteria
      let interpretation = "";
      let dominantSide = "INDETERMINATE";

      if (leftRatio !== null && rightRatio !== null) {
        dominantSide = leftRatio > rightRatio ? "LEFT" : "RIGHT";
      }

      if (!leftAdrenalBlood || !rightAdrenalBlood) {
        const failedSide = !leftAdrenalBlood && !rightAdrenalBlood ? "both sides" :
                          !leftAdrenalBlood ? "left side" : "right side";
        interpretation = `⚠️ Cannulation unsuccessful on ${failedSide}. Epinephrine gradient must be >100 pg/mL above IVC for each sample per Young et al. protocol. Ratios cannot be reliably interpreted.`;
      } else if (leftRatio > 6.5 && rightRatio <= 3.3 && clr >= 2.3) {
        interpretation = `✓ Unilateral cortisol-secreting adenoma on LEFT side. Criteria met: left AV/PV >6.5 (${leftRatio.toFixed(2)}), right AV/PV ≤3.3 (${rightRatio.toFixed(2)}), CLR ≥2.3 (${clr.toFixed(2)}).`;
      } else if (rightRatio > 6.5 && leftRatio <= 3.3 && clr >= 2.3) {
        interpretation = `✓ Unilateral cortisol-secreting adenoma on RIGHT side. Criteria met: right AV/PV >6.5 (${rightRatio.toFixed(2)}), left AV/PV ≤3.3 (${leftRatio.toFixed(2)}), CLR ≥2.3 (${clr.toFixed(2)}).`;
      } else if (clr <= 2) {
        interpretation = `Bilateral cortisol hypersecretion likely (CLR ≤2, actual: ${clr.toFixed(2)}). Suggests bilateral adrenal hyperplasia.`;
      } else {
        interpretation = `Indeterminate lateralization. AV/PV ratios (L: ${leftRatio.toFixed(2)}, R: ${rightRatio.toFixed(2)}) and CLR (${clr.toFixed(2)}) do not meet criteria for unilateral disease. Consider multidisciplinary review.`;
      }

      const resultData = {
        patientInitials,
        procedureDate,
        sideOfNodule,
        ivcCort: ivcCortStd, // Store in standard units
        ivcEpi,
        leftSamples: leftValidSamples,
        rightSamples: rightValidSamples,
        leftAvgCort,
        leftAvgEpi,
        rightAvgCort,
        rightAvgEpi,
        leftEpiDelta,
        rightEpiDelta,
        leftAdrenalBlood,
        rightAdrenalBlood,
        leftRatio,
        rightRatio,
        clr,
        dominantSide,
        interpretation
      };

      setResults(resultData);
    };

    const downloadCSV = () => {
      if (!results || results.error) return;
      generateCSV(results);
    };

    const generateCSV = (data) => {
      const lines = [
        ["Adrenal Vein Sampling – Cortisol (Autonomous Cushing Syndrome)"],
        [""],
        ["Patient Information"],
        ["Patient Initials:", data.patientInitials || "Not provided"],
        ["Date of Procedure:", data.procedureDate || "Not provided"],
        ["Side of Nodule:", data.sideOfNodule || "Not provided"],
        [""],
        ["Laboratory Units"],
        ["Cortisol Units:", cortUnits],
        ["Epinephrine Units:", epiUnits],
        ["Note:", "All values in CSV are displayed in the units you selected. Calculations use standard units (µg/dL for cortisol) internally."],
        [""],
        ["Peripheral (IVC) Measurements"],
        [`IVC Cortisol (${cortUnits}):`, formatCortForDisplay(data.ivcCort)],
        [`IVC Epinephrine (${epiUnits}):`, data.ivcEpi.toFixed(2)],
        [""],
        ["Left Adrenal Vein Samples"],
        ["Sample", "Time", `Cortisol (${cortUnits})`, `Epinephrine (${epiUnits})`, "Epi Δ (pg/mL)", "Adrenal Blood?"]
      ];

      data.leftSamples.forEach((s, i) => {
        const delta = s.epinephrine - data.ivcEpi;
        lines.push([
          `Left AV ${i + 1}`,
          s.time || "—",
          formatCortForDisplay(s.cortisol),
          s.epinephrine.toFixed(2),
          delta.toFixed(2),
          delta > 100 ? "YES" : "NO"
        ]);
      });

      lines.push(
        ["Left Average:", "", formatCortForDisplay(data.leftAvgCort), data.leftAvgEpi.toFixed(2), data.leftEpiDelta.toFixed(2), data.leftAdrenalBlood ? "YES" : "NO"],
        [""],
        ["Right Adrenal Vein Samples"],
        ["Sample", "Time", `Cortisol (${cortUnits})`, `Epinephrine (${epiUnits})`, "Epi Δ (pg/mL)", "Adrenal Blood?"]
      );

      data.rightSamples.forEach((s, i) => {
        const delta = s.epinephrine - data.ivcEpi;
        lines.push([
          `Right AV ${i + 1}`,
          s.time || "—",
          formatCortForDisplay(s.cortisol),
          s.epinephrine.toFixed(2),
          delta.toFixed(2),
          delta > 100 ? "YES" : "NO"
        ]);
      });

      lines.push(
        ["Right Average:", "", formatCortForDisplay(data.rightAvgCort), data.rightAvgEpi.toFixed(2), data.rightEpiDelta.toFixed(2), data.rightAdrenalBlood ? "YES" : "NO"],
        [""],
        ["Cortisol Lateralization Analysis"],
        ["Left AV/PV Ratio:", data.leftRatio !== null ? data.leftRatio.toFixed(3) : "N/A (cannulation failed)"],
        ["Right AV/PV Ratio:", data.rightRatio !== null ? data.rightRatio.toFixed(3) : "N/A (cannulation failed)"],
        ["Side-to-side Cortisol Lateralization Ratio (CLR):", data.clr !== null ? data.clr.toFixed(3) : "N/A (bilateral cannulation required)"],
        ["Dominant Side:", data.dominantSide],
        [""],
        ["Interpretation"],
        [data.interpretation.replace(/[✓⚠️]/g, "")],
        [""],
        ["Methodology"],
        ["Catheterization of an AV was considered successful if plasma epinephrine (Epi) concentration in the AV was 100 pg/mL above the PV (AV-PV >100 pg/mL), per protocol by Young et al."],
        ["Cortisol gradients were then calculated by computing the AV/PV ratios. Only the AV cortisol values from samples with Epi levels >100 pg/mL above the PV were included in the analysis."],
        ["We calculated the AV/PV ratio for each adrenal gland using the mean of the values. Side-to-side (higher cortisol/lower cortisol) cortisol lateralization ratios (CLR) were also calculated."],
        ["The data were analyzed using criteria from study by Young et al. of an AV/PV cortisol ratio of >6.5 on one side and ≤3.3 on the contralateral side, and CLR ≥2.3 to indicate a unilateral cortisol-secreting adenoma."],
        ["A CLR of ≤2 was used to indicate bilateral cortisol hypersecretion."],
        [""],
        ["References"],
        ["Acharya R et al. Outcomes of adrenal venous sampling in patients with bilateral adrenal masses and ACTH-independent Cushing syndrome. World J Surg 2019 43(2) 527-533"],
        ["Young WF et al. The clinical conundrum of corticotropin-independent autonomous cortisol secretion in patients with bilateral adrenal masses. World J Surg 2008 32 856-862"]
      );

      const csvContent = lines.map(row => row.join(",")).join("\n");

      // Use data URI instead of Blob for better cross-browser compatibility
      const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
      const link = document.createElement("a");
      link.href = dataUri;
      link.download = `AVS_Cortisol_${data.patientInitials || "Patient"}_${data.procedureDate || "Results"}.csv`;
      link.style.display = "none";
      document.body.appendChild(link);

      // Trigger download
      link.click();

      // Clean up
      document.body.removeChild(link);
    };

    return (
      <div className="space-y-6">
        {/* Patient Metadata */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="font-semibold mb-3">Patient Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Patient Initials</Label>
              <Input value={patientInitials} onChange={(e) => setPatientInitials(e.target.value)} placeholder="e.g., JD" />
            </div>
            <div className="space-y-1">
              <Label>Date of Procedure</Label>
              <Input type="date" value={procedureDate} onChange={(e) => setProcedureDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Side of Nodule</Label>
              <select className="w-full border rounded p-2" value={sideOfNodule} onChange={(e) => setSideOfNodule(e.target.value)}>
                <option value="">Select...</option>
                <option value="Left">Left</option>
                <option value="Right">Right</option>
                <option value="Bilateral">Bilateral</option>
              </select>
            </div>
          </div>
        </div>

        {/* Unit Selection */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="font-semibold mb-3">Laboratory Units</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Cortisol Units</Label>
              <select className="w-full border rounded p-2" value={cortUnits} onChange={(e) => setCortUnits(e.target.value)}>
                <option value="µg/dL">µg/dL (micrograms per deciliter)</option>
                <option value="nmol/L">nmol/L (nanomoles per liter)</option>
              </select>
              <p className="text-xs text-gray-600">1 µg/dL = 27.59 nmol/L</p>
            </div>
            <div className="space-y-1">
              <Label>Epinephrine Units</Label>
              <select className="w-full border rounded p-2" value={epiUnits} onChange={(e) => setEpiUnits(e.target.value)} disabled>
                <option value="pg/mL">pg/mL (picograms per milliliter)</option>
              </select>
              <p className="text-xs text-gray-600">Standard unit (no conversion needed)</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            All calculations are performed using standard units (µg/dL for cortisol, pg/mL for epinephrine) regardless of your input units.
          </p>
        </div>

        {/* IVC Measurements */}
        <div>
          <h3 className="font-semibold mb-3">Peripheral (IVC) Measurements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Infrarenal IVC Cortisol <span className="text-gray-500 text-sm">(µg/dL or nmol/L)</span></Label>
              <Input type="number" value={infrarenalIVCCort} onChange={(e) => setInfrarenalIVCCort(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Infrarenal IVC Epinephrine <span className="text-gray-500 text-sm">(pg/mL)</span></Label>
              <Input type="number" value={infrarenalIVCEpi} onChange={(e) => setInfrarenalIVCEpi(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Suprarenal IVC Cortisol <span className="text-gray-500 text-sm">(µg/dL or nmol/L)</span></Label>
              <Input type="number" value={suprarenalIVCCort} onChange={(e) => setSuprarenalIVCCort(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Suprarenal IVC Epinephrine <span className="text-gray-500 text-sm">(pg/mL)</span></Label>
              <Input type="number" value={suprarenalIVCEpi} onChange={(e) => setSuprarenalIVCEpi(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">Note: If both provided, suprarenal IVC will be used for calculations.</p>
        </div>

        {/* Left Adrenal Vein Samples */}
        <div>
          <h3 className="font-semibold mb-3">Left Adrenal Vein Samples</h3>
          {leftSamples.map((sample, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 items-end">
              <div className="space-y-1">
                <Label>Time Drawn</Label>
                <Input type="time" value={sample.time} onChange={(e) => updateLeftSample(index, "time", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cortisol <span className="text-gray-500 text-sm">(µg/dL or nmol/L)</span></Label>
                <Input type="number" value={sample.cortisol} onChange={(e) => updateLeftSample(index, "cortisol", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Epinephrine <span className="text-gray-500 text-sm">(pg/mL)</span></Label>
                <Input type="number" value={sample.epinephrine} onChange={(e) => updateLeftSample(index, "epinephrine", e.target.value)} />
              </div>
              <Button variant="destructive" onClick={() => removeLeftSample(index)} disabled={leftSamples.length === 1}>Remove</Button>
            </div>
          ))}
          <Button variant="secondary" onClick={addLeftSample} disabled={leftSamples.length >= 2}>+ Add Left Sample</Button>
        </div>

        {/* Right Adrenal Vein Samples */}
        <div>
          <h3 className="font-semibold mb-3">Right Adrenal Vein Samples</h3>
          {rightSamples.map((sample, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 items-end">
              <div className="space-y-1">
                <Label>Time Drawn</Label>
                <Input type="time" value={sample.time} onChange={(e) => updateRightSample(index, "time", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cortisol <span className="text-gray-500 text-sm">(µg/dL or nmol/L)</span></Label>
                <Input type="number" value={sample.cortisol} onChange={(e) => updateRightSample(index, "cortisol", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Epinephrine <span className="text-gray-500 text-sm">(pg/mL)</span></Label>
                <Input type="number" value={sample.epinephrine} onChange={(e) => updateRightSample(index, "epinephrine", e.target.value)} />
              </div>
              <Button variant="destructive" onClick={() => removeRightSample(index)} disabled={rightSamples.length === 1}>Remove</Button>
            </div>
          ))}
          <Button variant="secondary" onClick={addRightSample} disabled={rightSamples.length >= 4}>+ Add Right Sample</Button>
        </div>

        {/* Calculate Button */}
        <Button className="w-full" onClick={calculate}>Calculate</Button>

        {/* Results */}
        {results && (
          <div className="border-t pt-4 space-y-3">
            {results.error ? (
              <p className="text-red-600 font-medium">{results.error}</p>
            ) : (
              <>
                <div className="bg-gray-50 p-4 rounded-md space-y-2">
                  <h3 className="font-semibold text-lg">Cannulation Success</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Left Adrenal</p>
                      <p className={`text-lg ${results.leftAdrenalBlood ? "text-green-600" : "text-red-600"}`}>
                        {results.leftAdrenalBlood ? "✓ Successful" : "✗ Failed"}
                      </p>
                      <p className="text-xs text-gray-600">Epi Δ: {results.leftEpiDelta.toFixed(1)} pg/mL</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Right Adrenal</p>
                      <p className={`text-lg ${results.rightAdrenalBlood ? "text-green-600" : "text-red-600"}`}>
                        {results.rightAdrenalBlood ? "✓ Successful" : "✗ Failed"}
                      </p>
                      <p className="text-xs text-gray-600">Epi Δ: {results.rightEpiDelta.toFixed(1)} pg/mL</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Left AV/PV Cortisol Ratio:</span> {results.leftRatio !== null ? results.leftRatio.toFixed(3) : "N/A (cannulation failed)"}</p>
                  <p><span className="font-medium">Right AV/PV Cortisol Ratio:</span> {results.rightRatio !== null ? results.rightRatio.toFixed(3) : "N/A (cannulation failed)"}</p>
                  <p><span className="font-medium">CLR (Side-to-side Ratio):</span> {results.clr !== null ? results.clr.toFixed(3) : "N/A (bilateral cannulation required)"}</p>
                  <p><span className="font-medium">Dominant Side:</span> {results.dominantSide}</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h3 className="font-semibold mb-2">Interpretation</h3>
                  <p className="text-sm">{results.interpretation}</p>
                </div>

                {/* Download CSV Button */}
                <Button className="w-full" variant="secondary" onClick={downloadCSV}>
                  Download Results as CSV
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    );
  },
  refs: [
    {
      t: "Acharya R et al. 2019 – AVS outcomes in bilateral adrenal masses and ACTH-independent Cushing's syndrome",
      u: "https://doi.org/10.1007/s00268-018-4788-2",
    },
    {
      t: "Young WF et al. 2008 – Cortisol lateralization criteria in AVS",
      u: "https://doi.org/10.1007/s00268-007-9332-8",
    },
  ],
};
