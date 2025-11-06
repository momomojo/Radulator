// Adrenal Vein Sampling – Aldosterone (Primary Hyperaldosteronism) – Enhanced Edition
//
// This calculator provides comprehensive AVS interpretation for primary aldosteronism with:
// • Patient metadata (initials, date, side of nodule, notes for microcatheter use)
// • Multiple samples per adrenal vein (up to 2 left, up to 4 right) with averaging
// • Infrarenal and suprarenal IVC measurements
// • Pre and Post-cosyntropin (ACTH) protocol support
// • Selectivity Index (SI) with automatic validation flagging
// • Lateralization Index (LI) - Naruse/PASO criteria
// • Contralateral Suppression Ratio (CR)
// • CSI (Contralateral Suppression Index) - Chow 2024
// • RASI (Relative Aldosterone Secretion Index) - Chow 2024
// • AV/IVC Index with ipsilateral/contralateral interpretation
// • Side-by-side pre/post comparison view
// • Kahn & Angle interpretive guidance for equivocal cases
// • Comprehensive CSV output matching clinical workflow
//
// References: Naruse et al. 2021, PASO study 2018, Chow et al. 2024, Kahn & Angle 2010

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const AVSHyperaldo = {
  id: "avs-hyperaldo",
  name: "AVS – Aldosterone (PA)",
  desc: "Comprehensive primary aldosteronism AVS with CSI/RASI, multi-sample support, and pre/post-ACTH comparison.",
  isCustomComponent: true,
  Component: function AVSHyperaldoCalculator() {
    // Patient metadata
    const [patientInitials, setPatientInitials] = useState("");
    const [procedureDate, setProcedureDate] = useState("");
    const [sideOfNodule, setSideOfNodule] = useState("");
    const [notes, setNotes] = useState("");

    // Protocol selection
    const [protocol, setProtocol] = useState("post"); // "pre", "post", or "both"

    // PRE-ACTH measurements
    const [preInfrarenalIVCAld, setPreInfrarenalIVCAld] = useState("");
    const [preInfrarenalIVCCort, setPreInfrarenalIVCCort] = useState("");
    const [preSuprarenalIVCAld, setPreSuprarenalIVCAld] = useState("");
    const [preSuprarenalIVCCort, setPreSuprarenalIVCCort] = useState("");
    const [preLeftSamples, setPreLeftSamples] = useState([{ time: "", aldosterone: "", cortisol: "" }]);
    const [preRightSamples, setPreRightSamples] = useState([{ time: "", aldosterone: "", cortisol: "" }]);

    // POST-ACTH measurements
    const [postInfrarenalIVCAld, setPostInfrarenalIVCAld] = useState("");
    const [postInfrarenalIVCCort, setPostInfrarenalIVCCort] = useState("");
    const [postSuprarenalIVCAld, setPostSuprarenalIVCAld] = useState("");
    const [postSuprarenalIVCCort, setPostSuprarenalIVCCort] = useState("");
    const [postLeftSamples, setPostLeftSamples] = useState([{ time: "", aldosterone: "", cortisol: "" }]);
    const [postRightSamples, setPostRightSamples] = useState([{ time: "", aldosterone: "", cortisol: "" }]);

    const [results, setResults] = useState(null);

    // Unit selections
    const [aldoUnits, setAldoUnits] = useState("ng/dL"); // "ng/dL" or "pg/mL"
    const [cortUnits, setCortUnits] = useState("µg/dL"); // "µg/dL" or "nmol/L"

    // Unit conversion functions
    const convertAldoToStandard = (value) => {
      // Standard: ng/dL
      if (aldoUnits === "pg/mL") return value / 10; // pg/mL to ng/dL
      return value; // already in ng/dL
    };

    const convertCortToStandard = (value) => {
      // Standard: µg/dL
      if (cortUnits === "nmol/L") return value / 27.59; // nmol/L to µg/dL
      return value; // already in µg/dL
    };

    const formatAldoForDisplay = (value) => {
      // Convert from standard (ng/dL) to user's preferred units
      if (aldoUnits === "pg/mL") return (value * 10).toFixed(2);
      return value.toFixed(2);
    };

    const formatCortForDisplay = (value) => {
      // Convert from standard (µg/dL) to user's preferred units
      if (cortUnits === "nmol/L") return (value * 27.59).toFixed(2);
      return value.toFixed(2);
    };

    // Helper functions for managing samples
    const addSample = (setter, samples, maxCount) => {
      if (samples.length < maxCount) {
        setter([...samples, { time: "", aldosterone: "", cortisol: "" }]);
      }
    };

    const removeSample = (setter, samples, index) => {
      if (samples.length > 1) {
        setter(samples.filter((_, i) => i !== index));
      }
    };

    const updateSample = (setter, samples, index, field, value) => {
      const updated = [...samples];
      updated[index][field] = value;
      setter(updated);
    };

    const calculate = () => {
      const results = {};

      // Helper to compute metrics for pre or post
      const computeSet = (prefix, useACTH, ivcAld, ivcCort, leftSamples, rightSamples) => {
        // Convert IVC values to standard units
        const ivcAldStd = convertAldoToStandard(ivcAld);
        const ivcCortStd = convertCortToStandard(ivcCort);

        if (!ivcCortStd || ivcCortStd === 0) return null;

        // Process valid samples and convert to standard units
        const leftValid = leftSamples
          .map(s => ({
            aldosterone: convertAldoToStandard(parseFloat(s.aldosterone)),
            cortisol: convertCortToStandard(parseFloat(s.cortisol)),
            time: s.time
          }))
          .filter(s => !isNaN(s.aldosterone) && !isNaN(s.cortisol) && s.cortisol !== 0);

        const rightValid = rightSamples
          .map(s => ({
            aldosterone: convertAldoToStandard(parseFloat(s.aldosterone)),
            cortisol: convertCortToStandard(parseFloat(s.cortisol)),
            time: s.time
          }))
          .filter(s => !isNaN(s.aldosterone) && !isNaN(s.cortisol) && s.cortisol !== 0);

        if (leftValid.length === 0 || rightValid.length === 0) return null;

        // Calculate averages (now in standard units)
        const leftAvgAld = leftValid.reduce((sum, s) => sum + s.aldosterone, 0) / leftValid.length;
        const leftAvgCort = leftValid.reduce((sum, s) => sum + s.cortisol, 0) / leftValid.length;
        const rightAvgAld = rightValid.reduce((sum, s) => sum + s.aldosterone, 0) / rightValid.length;
        const rightAvgCort = rightValid.reduce((sum, s) => sum + s.cortisol, 0) / rightValid.length;

        // Selectivity Index (SI) - using standard units
        const siLeft = leftAvgCort / ivcCortStd;
        const siRight = rightAvgCort / ivcCortStd;
        const siThreshold = useACTH ? 5 : 2;
        const siLeftOk = siLeft >= siThreshold;
        const siRightOk = siRight >= siThreshold;

        // Check if cortisol is at least 10x peripheral (Kahn & Angle guideline) - using standard units
        const leftCort10x = leftAvgCort >= (ivcCortStd * 10);
        const rightCort10x = rightAvgCort >= (ivcCortStd * 10);

        // Aldosterone/Cortisol ratios (unit-independent ratios)
        const acLeft = leftAvgAld / leftAvgCort;
        const acRight = rightAvgAld / rightAvgCort;
        const acIVC = ivcAldStd / ivcCortStd;

        // Determine dominant side
        const dominantSide = acLeft >= acRight ? "Left" : "Right";
        const dominantAC = Math.max(acLeft, acRight);
        const nondominantAC = Math.min(acLeft, acRight);

        // Lateralization Index (LI)
        const li = dominantAC / nondominantAC;
        const liThreshold = useACTH ? 4 : 2;

        // Contralateral Suppression Ratio (CR) - Naruse definition
        const cr = nondominantAC / acIVC;

        // AV/IVC Index
        const avIvcIndex = dominantAC / acIVC;

        // CSI (Contralateral Suppression Index) - Chow 2024
        const csi = nondominantAC / acIVC;

        // RASI (Relative Aldosterone Secretion Index) - Chow 2024
        const rasi = dominantAC / acIVC;

        // Interpretation
        let interpretation = "";
        let cannulationStatus = "";

        if (!siLeftOk || !siRightOk) {
          const failedSide = !siLeftOk && !siRightOk ? "both sides" : !siLeftOk ? "left" : "right";
          cannulationStatus = `⚠️ Cannulation failure on ${failedSide} (SI < ${siThreshold})`;
          interpretation = `${cannulationStatus}. Reliable lateralization requires adequate selectivity. `;

          // Check if CSI/RASI can still help (Chow 2024 - unilateral cannulation)
          if (siLeftOk || siRightOk) {
            if (csi < 0.5 || rasi > 2.4) {
              interpretation += `However, unilateral-cannulating criteria suggest unilateral disease: `;
              if (csi < 0.5) interpretation += `CSI < 0.5 (${csi.toFixed(2)}, 92.9% PPV). `;
              if (rasi > 2.4) interpretation += `RASI > 2.4 (${rasi.toFixed(2)}, 94.4% PPV). `;
            }
          }
        } else {
          cannulationStatus = `✓ Bilateral successful cannulation (SI ≥ ${siThreshold})`;

          if (li > liThreshold) {
            interpretation = `✓ Unilateral aldosterone hypersecretion on ${dominantSide} side (LI = ${li.toFixed(2)} > ${liThreshold}). Consider unilateral adrenalectomy. `;
            if (cr < 1) {
              interpretation += `Contralateral suppression confirmed (CR = ${cr.toFixed(2)} < 1). `;
            }
            // Add CSI/RASI confirmation
            if (csi < 0.5 || rasi > 2.4) {
              interpretation += `Chow 2024 criteria also met: `;
              if (csi < 0.5) interpretation += `CSI ${csi.toFixed(2)} < 0.5 (92.9% PPV); `;
              if (rasi > 2.4) interpretation += `RASI ${rasi.toFixed(2)} > 2.4 (94.4% PPV). `;
            }
          } else if (li >= 2 && li <= liThreshold) {
            // Equivocal range (Kahn & Angle guidance)
            interpretation = `⚠️ Equivocal lateralization (LI = ${li.toFixed(2)} between 2-${liThreshold}). Per Kahn & Angle 2010: ratios between 2-3 are equivocal. `;
            if (li >= 3) {
              interpretation += `Your LI ≥ 3 suggests unilateral asymmetry (3-5x typical for unilateral disease). `;
            } else {
              interpretation += `LI < 3 suggests possible bilateral hyperplasia. `;
            }
            // Use CSI/RASI for additional guidance
            if (csi < 0.5 || rasi > 2.4) {
              interpretation += `Chow 2024 unilateral criteria favor unilateral disease: `;
              if (csi < 0.5) interpretation += `CSI ${csi.toFixed(2)} < 0.5; `;
              if (rasi > 2.4) interpretation += `RASI ${rasi.toFixed(2)} > 2.4. `;
            }
          } else {
            interpretation = `Bilateral disease likely (LI = ${li.toFixed(2)} < 2). Per Kahn & Angle: ratios differing by < 2-fold suggest bilateral adrenal hyperplasia. Medical management with mineralocorticoid receptor antagonists recommended.`;
          }
        }

        // Add AV/IVC interpretation
        if (avIvcIndex > 5.5) {
          interpretation += ` AV/IVC index ${avIvcIndex.toFixed(2)} > 5.5 supports ipsilateral (${dominantSide}) unilateral disease.`;
        } else if (avIvcIndex < 0.5) {
          interpretation += ` AV/IVC index ${avIvcIndex.toFixed(2)} < 0.5 suggests contralateral unilateral disease.`;
        }

        return {
          leftSamples: leftValid,
          rightSamples: rightValid,
          leftAvgAld,
          leftAvgCort,
          rightAvgAld,
          rightAvgCort,
          siLeft,
          siRight,
          siLeftOk,
          siRightOk,
          leftCort10x,
          rightCort10x,
          acLeft,
          acRight,
          acIVC,
          li,
          liThreshold,
          cr,
          avIvcIndex,
          csi,
          rasi,
          dominantSide,
          cannulationStatus,
          interpretation
        };
      };

      // Compute PRE-ACTH if selected
      let preResults = null;
      if (protocol === "pre" || protocol === "both") {
        const ivcAld = parseFloat(preSuprarenalIVCAld || preInfrarenalIVCAld) || 0;
        const ivcCort = parseFloat(preSuprarenalIVCCort || preInfrarenalIVCCort) || 0;
        preResults = computeSet("Pre", false, ivcAld, ivcCort, preLeftSamples, preRightSamples);
      }

      // Compute POST-ACTH if selected
      let postResults = null;
      if (protocol === "post" || protocol === "both") {
        const ivcAld = parseFloat(postSuprarenalIVCAld || postInfrarenalIVCAld) || 0;
        const ivcCort = parseFloat(postSuprarenalIVCCort || postInfrarenalIVCCort) || 0;
        postResults = computeSet("Post", true, ivcAld, ivcCort, postLeftSamples, postRightSamples);
      }

      if (!preResults && !postResults) {
        setResults({ error: "Insufficient data. Please enter at least one complete protocol with valid IVC and adrenal vein samples." });
        return;
      }

      setResults({ pre: preResults, post: postResults });
    };

    const downloadCSV = () => {
      if (!results || results.error) return;
      generateCSV(results);
    };

    const generateCSV = (data) => {
      const lines = [
        ["Adrenal Vein Sampling – Aldosterone (Primary Hyperaldosteronism)"],
        [""],
        ["Patient Information"],
        ["Patient Initials:", patientInitials || "Not provided"],
        ["Date of Procedure:", procedureDate || "Not provided"],
        ["Side of Nodule:", sideOfNodule || "Not provided"],
        ["Notes:", notes || "Not provided"],
        [""],
        ["Laboratory Units"],
        ["Aldosterone Units:", aldoUnits],
        ["Cortisol Units:", cortUnits],
        ["Note:", "All values in CSV are displayed in the units you selected. Calculations use standard units (ng/dL for aldo, µg/dL for cortisol) internally."],
        [""]
      ];

      const addSetToCSV = (prefix, results, useACTH) => {
        if (!results) return;

        lines.push(
          [`${prefix}-Cosyntropin Protocol (ACTH stimulation: ${useACTH ? "Yes" : "No"})`],
          [""]
        );

        // Individual Left Adrenal Vein Samples
        lines.push(
          ["Left Adrenal Vein Samples"],
          ["Sample", "Time", `Aldosterone (${aldoUnits})`, `Cortisol (${cortUnits})`]
        );

        results.leftSamples.forEach((s, i) => {
          lines.push([
            `Left AV ${i + 1}`,
            s.time || "—",
            formatAldoForDisplay(s.aldosterone),
            formatCortForDisplay(s.cortisol)
          ]);
        });

        lines.push(
          ["Left Average:", "", formatAldoForDisplay(results.leftAvgAld), formatCortForDisplay(results.leftAvgCort)],
          [""]
        );

        // Individual Right Adrenal Vein Samples
        lines.push(
          ["Right Adrenal Vein Samples"],
          ["Sample", "Time", `Aldosterone (${aldoUnits})`, `Cortisol (${cortUnits})`]
        );

        results.rightSamples.forEach((s, i) => {
          lines.push([
            `Right AV ${i + 1}`,
            s.time || "—",
            formatAldoForDisplay(s.aldosterone),
            formatCortForDisplay(s.cortisol)
          ]);
        });

        lines.push(
          ["Right Average:", "", formatAldoForDisplay(results.rightAvgAld), formatCortForDisplay(results.rightAvgCort)],
          [""],
          ["Selectivity Assessment"],
          [`Left SI:`, results.siLeft.toFixed(2), `(Threshold: ${useACTH ? "≥5" : "≥2"})`],
          [`Right SI:`, results.siRight.toFixed(2), `(Threshold: ${useACTH ? "≥5" : "≥2"})`],
          [`Left adequate?:`, results.siLeftOk ? "Yes" : "No", `(Cortisol ${results.leftCort10x ? "≥" : "<"}10x peripheral)`],
          [`Right adequate?:`, results.siRightOk ? "Yes" : "No", `(Cortisol ${results.rightCort10x ? "≥" : "<"}10x peripheral)`],
          [""],
          ["Aldosterone/Cortisol Ratios"],
          [`Left A/C:`, results.acLeft.toFixed(4)],
          [`Right A/C:`, results.acRight.toFixed(4)],
          [`IVC A/C:`, results.acIVC.toFixed(4)],
          [""],
          ["Lateralization Analysis"],
          [`Dominant Side:`, results.dominantSide],
          [`Lateralization Index (LI):`, results.li.toFixed(2), `(Threshold: >${results.liThreshold})`],
          [`L/R Ratio:`, results.dominantSide === "Left" ? results.li.toFixed(2) : (1 / results.li).toFixed(2)],
          [`R/L Ratio:`, results.dominantSide === "Right" ? results.li.toFixed(2) : (1 / results.li).toFixed(2)],
          [""],
          ["Additional Indices"],
          [`Contralateral Suppression Ratio (CR):`, results.cr.toFixed(2), `(< 1 indicates suppression)`],
          [`AV/IVC Index:`, results.avIvcIndex.toFixed(2), `(> 5.5 ipsilateral, < 0.5 contralateral)`],
          [`CSI (Chow 2024):`, results.csi.toFixed(2), `(< 0.5: 76.5% sens, 92.9% PPV)`],
          [`RASI (Chow 2024):`, results.rasi.toFixed(2), `(> 2.4: 85.0% sens, 94.4% PPV)`],
          [""],
          ["Cannulation Status"],
          [results.cannulationStatus.replace(/[✓⚠️]/g, "")],
          [""],
          ["Interpretation"],
          [results.interpretation.replace(/[✓⚠️]/g, "")],
          [""]
        );
      };

      if (data.pre) addSetToCSV("Pre", data.pre, false);
      if (data.post) addSetToCSV("Post", data.post, true);

      lines.push(
        ["Methodology and Criteria"],
        ["Selectivity Index (SI): Adrenal vein cortisol / IVC cortisol. Adequate if ≥5 with ACTH or ≥2 without ACTH (Naruse et al. 2021)."],
        ["Kahn & Angle 2010 guideline: Cortisol level from adrenals should be 10x higher than peripheral; minimum 2-3x needed."],
        ["Lateralization Index (LI): (A/C dominant) / (A/C nondominant). LI > 4 with ACTH or > 2 without indicates unilateral disease (PASO study)."],
        ["Unilateral asymmetric aldosterone:cortisol values 3-5 times the unaffected side consistent with lateralization (Kahn & Angle 2010)."],
        ["Ratios elevated but differing by < 2-fold more consistent with bilateral adrenal hyperplasia (Kahn & Angle 2010)."],
        ["Ratios between 2-3 are equivocal (Kahn & Angle 2010)."],
        ["CSI (Contralateral Suppression Index) < 0.5: sensitivity 76.5%, PPV 92.9% for unilateral disease (Chow et al. 2024)."],
        ["RASI (Relative Aldosterone Secretion Index) > 2.4: sensitivity 85.0%, PPV 94.4% for unilateral disease (Chow et al. 2024)."],
        ["Combined CSI < 0.5 OR RASI > 2.4: PPV 95.5% for unilateral primary aldosteronism (Chow et al. 2024)."],
        [""],
        ["References"],
        ["Naruse M, et al. Adrenal venous sampling for subtype diagnosis of primary hyperaldosteronism. Endocrinol Metab 2021;36(5):965-73."],
        ["Williams TA, et al. Outcomes after adrenalectomy for unilateral primary aldosteronism (PASO study). JCEM 2018."],
        ["Chow CM, et al. Role of unilateral-cannulating AVS for subtyping of primary aldosteronism. World J Surg 2024;48:2941-9."],
        ["Kahn SL, Angle JF. Adrenal vein sampling. Tech Vasc Interv Radiol 2010;13(2):110-25."]
      );

      const csvContent = lines.map(row => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AVS_Aldosterone_${patientInitials || "Patient"}_${procedureDate || "Results"}.csv`;
      link.style.display = "none";
      document.body.appendChild(link); // Append to DOM before clicking
      link.click();
      document.body.removeChild(link); // Clean up
      URL.revokeObjectURL(url);
    };

    const renderSampleInputs = (samples, setter, maxCount, label) => (
      <div>
        <h4 className="font-medium mb-2">{label}</h4>
        {samples.map((sample, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <Input type="time" value={sample.time} onChange={(e) => updateSample(setter, samples, index, "time", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aldosterone <span className="text-gray-500">(ng/dL)</span></Label>
              <Input type="number" value={sample.aldosterone} onChange={(e) => updateSample(setter, samples, index, "aldosterone", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cortisol <span className="text-gray-500">(µg/dL)</span></Label>
              <Input type="number" value={sample.cortisol} onChange={(e) => updateSample(setter, samples, index, "cortisol", e.target.value)} />
            </div>
            <Button variant="destructive" size="sm" onClick={() => removeSample(setter, samples, index)} disabled={samples.length === 1}>Remove</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => addSample(setter, samples, maxCount)} disabled={samples.length >= maxCount}>
          + Add Sample
        </Button>
      </div>
    );

    const renderProtocolInputs = (prefix, infraAld, setInfraAld, infraCort, setInfraCort, supraAld, setSupraAld, supraCort, setSupraCort, leftSamples, setLeftSamples, rightSamples, setRightSamples) => (
      <div className="space-y-4 border rounded-md p-4 bg-gray-50">
        <h3 className="font-semibold text-lg">{prefix}-Cosyntropin Protocol</h3>

        {/* IVC */}
        <div>
          <h4 className="font-medium mb-2">IVC Measurements</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Infrarenal IVC Aldosterone <span className="text-gray-500">(ng/dL)</span></Label>
              <Input type="number" value={infraAld} onChange={(e) => setInfraAld(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Infrarenal IVC Cortisol <span className="text-gray-500">(µg/dL)</span></Label>
              <Input type="number" value={infraCort} onChange={(e) => setInfraCort(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Suprarenal IVC Aldosterone <span className="text-gray-500">(ng/dL)</span></Label>
              <Input type="number" value={supraAld} onChange={(e) => setSupraAld(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Suprarenal IVC Cortisol <span className="text-gray-500">(µg/dL)</span></Label>
              <Input type="number" value={supraCort} onChange={(e) => setSupraCort(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Left AV */}
        {renderSampleInputs(leftSamples, setLeftSamples, 2, "Left Adrenal Vein")}

        {/* Right AV */}
        {renderSampleInputs(rightSamples, setRightSamples, 4, "Right Adrenal Vein")}
      </div>
    );

    return (
      <div className="space-y-6">
        {/* Patient Metadata */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="font-semibold mb-3">Patient Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <option value="None visible">None visible</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Notes (e.g., microcatheter used)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>

        {/* Unit Selection */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="font-semibold mb-3">Laboratory Units</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Aldosterone Units</Label>
              <select className="w-full border rounded p-2" value={aldoUnits} onChange={(e) => setAldoUnits(e.target.value)}>
                <option value="ng/dL">ng/dL (nanograms per deciliter)</option>
                <option value="pg/mL">pg/mL (picograms per milliliter)</option>
              </select>
              <p className="text-xs text-gray-600">1 ng/dL = 10 pg/mL</p>
            </div>
            <div className="space-y-1">
              <Label>Cortisol Units</Label>
              <select className="w-full border rounded p-2" value={cortUnits} onChange={(e) => setCortUnits(e.target.value)}>
                <option value="µg/dL">µg/dL (micrograms per deciliter)</option>
                <option value="nmol/L">nmol/L (nanomoles per liter)</option>
              </select>
              <p className="text-xs text-gray-600">1 µg/dL = 27.59 nmol/L</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            All calculations are performed using standard units (ng/dL for aldosterone, µg/dL for cortisol) regardless of your input units.
          </p>
        </div>

        {/* Protocol Selection */}
        <div>
          <Label className="font-semibold">Protocol</Label>
          <div className="flex gap-4 mt-2">
            <label className="flex items-center gap-2">
              <input type="radio" value="pre" checked={protocol === "pre"} onChange={(e) => setProtocol(e.target.value)} />
              <span>Pre-ACTH only</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="post" checked={protocol === "post"} onChange={(e) => setProtocol(e.target.value)} />
              <span>Post-ACTH only</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="both" checked={protocol === "both"} onChange={(e) => setProtocol(e.target.value)} />
              <span>Both (comparison view)</span>
            </label>
          </div>
        </div>

        {/* PRE-ACTH Inputs */}
        {(protocol === "pre" || protocol === "both") && renderProtocolInputs(
          "Pre",
          preInfrarenalIVCAld, setPreInfrarenalIVCAld,
          preInfrarenalIVCCort, setPreInfrarenalIVCCort,
          preSuprarenalIVCAld, setPreSuprarenalIVCAld,
          preSuprarenalIVCCort, setPreSuprarenalIVCCort,
          preLeftSamples, setPreLeftSamples,
          preRightSamples, setPreRightSamples
        )}

        {/* POST-ACTH Inputs */}
        {(protocol === "post" || protocol === "both") && renderProtocolInputs(
          "Post",
          postInfrarenalIVCAld, setPostInfrarenalIVCAld,
          postInfrarenalIVCCort, setPostInfrarenalIVCCort,
          postSuprarenalIVCAld, setPostSuprarenalIVCAld,
          postSuprarenalIVCCort, setPostSuprarenalIVCCort,
          postLeftSamples, setPostLeftSamples,
          postRightSamples, setPostRightSamples
        )}

        {/* Calculate Button */}
        <Button className="w-full" onClick={calculate}>Calculate</Button>

        {/* Results */}
        {results && (
          <div className="border-t pt-4 space-y-4">
            {results.error ? (
              <p className="text-red-600 font-medium">{results.error}</p>
            ) : (
              <>
                {/* Side-by-side comparison for both protocols */}
                {protocol === "both" && results.pre && results.post ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-md p-4 bg-blue-50">
                      <h3 className="font-semibold mb-2">Pre-ACTH Results</h3>
                      <div className="space-y-1 text-sm">
                        <p className={results.pre.siLeftOk && results.pre.siRightOk ? "text-green-600" : "text-red-600"}>
                          {results.pre.cannulationStatus}
                        </p>
                        <p><strong>LI:</strong> {results.pre.li.toFixed(2)} (threshold: &gt;2)</p>
                        <p><strong>CR:</strong> {results.pre.cr.toFixed(2)}</p>
                        <p><strong>CSI:</strong> {results.pre.csi.toFixed(2)} {results.pre.csi < 0.5 ? "✓" : ""}</p>
                        <p><strong>RASI:</strong> {results.pre.rasi.toFixed(2)} {results.pre.rasi > 2.4 ? "✓" : ""}</p>
                        <p className="text-xs mt-2 italic">{results.pre.interpretation.substring(0, 150)}...</p>
                      </div>
                    </div>
                    <div className="border rounded-md p-4 bg-green-50">
                      <h3 className="font-semibold mb-2">Post-ACTH Results</h3>
                      <div className="space-y-1 text-sm">
                        <p className={results.post.siLeftOk && results.post.siRightOk ? "text-green-600" : "text-red-600"}>
                          {results.post.cannulationStatus}
                        </p>
                        <p><strong>LI:</strong> {results.post.li.toFixed(2)} (threshold: &gt;4)</p>
                        <p><strong>CR:</strong> {results.post.cr.toFixed(2)}</p>
                        <p><strong>CSI:</strong> {results.post.csi.toFixed(2)} {results.post.csi < 0.5 ? "✓" : ""}</p>
                        <p><strong>RASI:</strong> {results.post.rasi.toFixed(2)} {results.post.rasi > 2.4 ? "✓" : ""}</p>
                        <p className="text-xs mt-2 italic">{results.post.interpretation.substring(0, 150)}...</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Single protocol detailed view */}
                {(protocol !== "both" || !results.pre || !results.post) && (
                  <>
                    {results.pre && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">Pre-ACTH Results</h3>
                        <div className="bg-gray-50 p-4 rounded-md">
                          <p className={`font-medium ${results.pre.siLeftOk && results.pre.siRightOk ? "text-green-600" : "text-red-600"}`}>
                            {results.pre.cannulationStatus}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <p><strong>Left SI:</strong> {results.pre.siLeft.toFixed(2)} {results.pre.siLeftOk ? "✓" : "✗"}</p>
                          <p><strong>Right SI:</strong> {results.pre.siRight.toFixed(2)} {results.pre.siRightOk ? "✓" : "✗"}</p>
                          <p><strong>LI:</strong> {results.pre.li.toFixed(2)}</p>
                          <p><strong>Dominant:</strong> {results.pre.dominantSide}</p>
                          <p><strong>CR:</strong> {results.pre.cr.toFixed(2)}</p>
                          <p><strong>AV/IVC:</strong> {results.pre.avIvcIndex.toFixed(2)}</p>
                          <p><strong>CSI:</strong> {results.pre.csi.toFixed(2)} {results.pre.csi < 0.5 ? "✓" : ""}</p>
                          <p><strong>RASI:</strong> {results.pre.rasi.toFixed(2)} {results.pre.rasi > 2.4 ? "✓" : ""}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                          <h4 className="font-semibold mb-2">Interpretation</h4>
                          <p className="text-sm">{results.pre.interpretation}</p>
                        </div>
                      </div>
                    )}
                    {results.post && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg">Post-ACTH Results</h3>
                        <div className="bg-gray-50 p-4 rounded-md">
                          <p className={`font-medium ${results.post.siLeftOk && results.post.siRightOk ? "text-green-600" : "text-red-600"}`}>
                            {results.post.cannulationStatus}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <p><strong>Left SI:</strong> {results.post.siLeft.toFixed(2)} {results.post.siLeftOk ? "✓" : "✗"}</p>
                          <p><strong>Right SI:</strong> {results.post.siRight.toFixed(2)} {results.post.siRightOk ? "✓" : "✗"}</p>
                          <p><strong>LI:</strong> {results.post.li.toFixed(2)}</p>
                          <p><strong>Dominant:</strong> {results.post.dominantSide}</p>
                          <p><strong>CR:</strong> {results.post.cr.toFixed(2)}</p>
                          <p><strong>AV/IVC:</strong> {results.post.avIvcIndex.toFixed(2)}</p>
                          <p><strong>CSI:</strong> {results.post.csi.toFixed(2)} {results.post.csi < 0.5 ? "✓" : ""}</p>
                          <p><strong>RASI:</strong> {results.post.rasi.toFixed(2)} {results.post.rasi > 2.4 ? "✓" : ""}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                          <h4 className="font-semibold mb-2">Interpretation</h4>
                          <p className="text-sm">{results.post.interpretation}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}

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
      t: "Naruse M et al. 2021 – AVS for subtype diagnosis of primary hyperaldosteronism (consensus guidelines)",
      u: "https://doi.org/10.3803/EnM.2021.1192",
    },
    {
      t: "Williams TA et al. 2018 – PASO study (Primary Aldosteronism Surgical Outcome)",
      u: "https://doi.org/10.1210/jc.2016-2938",
    },
    {
      t: "Chow CM et al. 2024 – Unilateral-cannulating AVS with CSI/RASI criteria",
      u: "https://doi.org/10.1007/s00268-024-08280-w",
    },
    {
      t: "Kahn SL, Angle JF 2010 – Adrenal vein sampling techniques and interpretation",
      u: "https://doi.org/10.1053/j.tvir.2010.02.008",
    },
  ],
};
