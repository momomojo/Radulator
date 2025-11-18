/**
 * Khoury Catheter Selector
 *
 * Interactive microcatheter selection tool for interventional radiology and
 * neurointerventional procedures. Helps clinicians select optimal catheters
 * based on embolic agent, device size, and procedural requirements.
 *
 * Features:
 * - 30 microcatheters across 5 categories
 * - Filtering by embolic agent (Onyx, PHIL, Squid, NBCA, coils, microspheres, Y-90)
 * - Coil and microsphere size compatibility
 * - Balloon occlusion and detachable-tip options
 * - Brand-specific adaptor support (PHIL, MicroVention)
 * - Priming volume calculator
 * - Safety warnings and injection instructions
 *
 * @references
 * - MicroVention Catheter Portfolio (Scepter, Headway, Sonic)
 * - Medtronic Neurovascular Catheters (Marathon, Apollo, Phenom)
 * - Stryker Neurovascular (Excelsior, TransForm, Trevo)
 * - Boston Scientific Embolization Catheters (TruSelect, Renegade, Direxion)
 * - Balt Magic Flow-Directed Catheters
 * - Merit Medical Maestro
 * - Terumo Progreat
 */

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, ExternalLink, Filter, ChevronDown, ChevronUp } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// CATHETER DATABASE (30 Catheters)
// ═══════════════════════════════════════════════════════════════════

const CATHETER_DATABASE = [
  {
    id: "scepter-c",
    name: "Scepter C",
    manufacturer: "TerumoNeuro (MicroVention)",
    category: "Balloon Occlusion",
    innerDiameter: 0.0165,
    outerDiameter: 0.027,
    workingLength: [142, 148],
    deadSpace: 0.44,
    deadSpaceOptions: [
      { type: "standard", volume: 0.44, label: "Standard" },
      { type: "phil", volume: 0.23, label: "With PHIL Adaptor" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: false,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.0165,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: true,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 500,
    ifuUrl: "https://assets.ctfassets.net/ka7vsj9fzri4/67Ughn2Vs6441sTO9Q2AWm/4d4105c44b48e9e81b29eb857afa7eff/IFU100302X1.pdf",
    notes: "Dual-lumen balloon catheter with 4mm balloon diameter. Dead space 0.44 mL standard, reduced to 0.23 mL with PHIL adaptor. NOT compatible with NBCA."
  },
  {
    id: "scepter-xc",
    name: "Scepter XC",
    manufacturer: "TerumoNeuro (MicroVention)",
    category: "Balloon Occlusion",
    innerDiameter: 0.0165,
    outerDiameter: 0.027,
    workingLength: [142, 148],
    deadSpace: 0.44,
    deadSpaceOptions: [
      { type: "standard", volume: 0.44, label: "Standard" },
      { type: "phil", volume: 0.23, label: "With PHIL Adaptor" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: false,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.0165,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: true,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 500,
    ifuUrl: "https://www.accessdata.fda.gov/cdrh_docs/pdf11/K113698.pdf",
    notes: "Extra-compliant balloon version of Scepter. Similar specs to Scepter C but different balloon compliance."
  },
  {
    id: "scepter-mini",
    name: "Scepter Mini",
    manufacturer: "TerumoNeuro (MicroVention)",
    category: "Balloon Occlusion",
    innerDiameter: 0.008,
    outerDiameter: 0.020,
    workingLength: [165],
    deadSpace: 0.20,
    deadSpaceOptions: [
      { type: "standard", volume: 0.20, label: "Standard" },
      { type: "phil", volume: 0.10, label: "With PHIL Adaptor (estimated)" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: false,
      phil35: false,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: false,
      coils: false,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0,
    maxMicrosphereDiameter: 500,
    features: {
      balloonOcclusion: true,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 500,
    ifuUrl: "https://assets.ctfassets.net/ka7vsj9fzri4/5Uhnz24wCK0r10WPt3ZaFq/1f8dcca10413c0b26992ca4c50bad698/Scepter_Mini_Spec_Sheet_-_NA.PDF",
    notes: "Smallest dual-lumen balloon catheter. 2.2mm x 9mm balloon. Compatible with 0.008 inch guidewires."
  },
  {
    id: "sniper",
    name: "Sniper",
    manufacturer: "Embolx",
    category: "Balloon Occlusion",
    innerDiameter: 0.0165,
    outerDiameter: 0.027,
    workingLength: [110, 130, 150, 165],
    deadSpace: 0.40,
    deadSpaceOptions: [
      { type: "standard", volume: 0.40, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: false,
      coils: true,
      microspheres: true,
      y90: true,
    },
    maxCoilDiameter: 0.0165,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: true,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 900,
    ifuUrl: "https://embolx.com/wp-content/uploads/2022/08/DC-0274-Rev-H-Sniper-IFU-SBC0629-series-normal-PDF-1.pdf",
    notes: "Peripheral balloon occlusion catheter. Designed for pressure-directed therapy including Y-90, PAE, UFE."
  },
  {
    id: "transform",
    name: "TransForm",
    manufacturer: "Stryker",
    category: "Balloon Occlusion",
    innerDiameter: 0.014,
    outerDiameter: 0.025,
    workingLength: [150],
    deadSpace: 0.30,
    deadSpaceOptions: [
      { type: "standard", volume: 0.30, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: false,
      onyx34: false,
      onyx500: false,
      phil25: false,
      phil30: false,
      phil35: false,
      squid12: false,
      squid18: false,
      squid34: false,
      nbca: false,
      coils: true,
      microspheres: false,
      y90: false,
    },
    maxCoilDiameter: 0.014,
    maxMicrosphereDiameter: 0,
    features: {
      balloonOcclusion: true,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: false,
    },
    maxInjectionPressure: 150,
    ifuUrl: "https://www.stryker.com/us/en/neurovascular/products/transform-occlusion-balloon-catheter.html",
    notes: "Single-lumen occlusion balloon for aneurysm coiling. NOT DMSO compatible. Coils only."
  },
  {
    id: "headway-duo",
    name: "Headway Duo",
    manufacturer: "TerumoNeuro (MicroVention)",
    category: "General Purpose",
    innerDiameter: 0.0165,
    outerDiameter: 0.020,
    workingLength: [156, 167],
    deadSpace: 0.34,
    deadSpaceOptions: [
      { type: "standard", volume: 0.34, label: "Standard" },
      { type: "microvention", volume: 0.18, label: "With MicroVention Adaptor (estimated)" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.0165,
    maxMicrosphereDiameter: 700,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://assets.ctfassets.net/ka7vsj9fzri4/15mFutEyvnoXZ2K1whAD6E/15014db4fd29aeee1ade318bcb17bf87/Headway_Portfolio_Data_Sheet_-_NA.PDF",
    notes: "Widely used for Onyx, PHIL, Squid. ID 0.0165 inch, dead space 0.34 mL. Hydrophilic coating."
  },
  {
    id: "headway-17",
    name: "Headway 17",
    manufacturer: "TerumoNeuro (MicroVention)",
    category: "General Purpose",
    innerDiameter: 0.017,
    outerDiameter: 0.022,
    workingLength: [150, 156],
    deadSpace: 0.41,
    deadSpaceOptions: [
      { type: "standard", volume: 0.41, label: "Standard" },
      { type: "microvention", volume: 0.26, label: "With MicroVention Hub Adaptor" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.017,
    maxMicrosphereDiameter: 700,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://www.accessdata.fda.gov/cdrh_docs/pdf10/K101542.pdf",
    notes: "Larger 0.017 inch lumen for stent/coil delivery. Dead space 0.41 mL standard, 0.26 mL with adaptor (37% reduction)."
  },
  {
    id: "headway-21",
    name: "Headway 21",
    manufacturer: "TerumoNeuro (MicroVention)",
    category: "General Purpose",
    innerDiameter: 0.021,
    outerDiameter: 0.025,
    workingLength: [150, 156],
    deadSpace: 0.50,
    deadSpaceOptions: [
      { type: "standard", volume: 0.50, label: "Standard" },
      { type: "microvention", volume: 0.32, label: "With MicroVention Adaptor (estimated)" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.021,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://assets.ctfassets.net/ka7vsj9fzri4/15mFutEyvnoXZ2K1whAD6E/15014db4fd29aeee1ade318bcb17bf87/Headway_Portfolio_Data_Sheet_-_NA.PDF",
    notes: "Large 0.021 inch lumen. Supports high-viscosity embolics including Onyx 500."
  },
  {
    id: "headway-27",
    name: "Headway 27",
    manufacturer: "TerumoNeuro (MicroVention)",
    category: "General Purpose",
    innerDiameter: 0.027,
    outerDiameter: 0.030,
    workingLength: [150],
    deadSpace: 0.60,
    deadSpaceOptions: [
      { type: "standard", volume: 0.60, label: "Standard" },
      { type: "microvention", volume: 0.38, label: "With MicroVention Adaptor (estimated)" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.027,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://assets.ctfassets.net/ka7vsj9fzri4/15mFutEyvnoXZ2K1whAD6E/15014db4fd29aeee1ade318bcb17bf87/Headway_Portfolio_Data_Sheet_-_NA.PDF",
    notes: "Largest Headway lumen (0.027 inch). Required for Neuroform stent delivery."
  },
  {
    id: "excelsior-sl10",
    name: "Excelsior SL-10",
    manufacturer: "Stryker",
    category: "General Purpose",
    innerDiameter: 0.0165,
    outerDiameter: 0.022,
    workingLength: [150],
    deadSpace: 0.29,
    deadSpaceOptions: [
      { type: "standard", volume: 0.29, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.0165,
    maxMicrosphereDiameter: 700,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://www.stryker.com/us/en/neurovascular/products/excelsior-sl-10.html",
    notes: "Dead space 0.29 mL. DMSO compatible. Widely used for coil delivery. Lower dead space than Headway Duo."
  },
  {
    id: "excelsior-xt27",
    name: "Excelsior XT-27",
    manufacturer: "Stryker",
    category: "General Purpose",
    innerDiameter: 0.027,
    outerDiameter: 0.032,
    workingLength: [150],
    deadSpace: 0.55,
    deadSpaceOptions: [
      { type: "standard", volume: 0.55, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.027,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://www.stryker.com/us/en/neurovascular/products/excelsior-xt-27.html",
    notes: "Large 0.027 inch microcatheter for stent delivery (Neuroform, Trevo 6mm retriever)."
  },
  {
    id: "via-27",
    name: "Via 27",
    manufacturer: "Sequent Medical (MicroVention)",
    category: "General Purpose",
    innerDiameter: 0.027,
    outerDiameter: 0.032,
    workingLength: [154],
    deadSpace: 0.55,
    deadSpaceOptions: [
      { type: "standard", volume: 0.55, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.027,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://accessgudid.nlm.nih.gov/devices/00851566003420",
    notes: "0.027 inch microcatheter for intrasaccular flow diverter delivery (WEB) and Pipeline Flex."
  },
  {
    id: "sonic",
    name: "Sonic",
    manufacturer: "TerumoNeuro (MicroVention)",
    category: "Detachable-Tip",
    innerDiameter: 0.0165,
    outerDiameter: 0.022,
    workingLength: [150, 165],
    deadSpace: 0.32,
    deadSpaceOptions: [
      { type: "standard", volume: 0.32, label: "Standard (without adaptor)" },
      { type: "microvention", volume: 0.24, label: "With MicroVention Adaptor" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: true,
      coils: false,
      microspheres: false,
      y90: false,
    },
    maxCoilDiameter: 0,
    maxMicrosphereDiameter: 0,
    features: {
      balloonOcclusion: false,
      detachableTip: true,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://www.terumoneuro.com/products/sonic",
    notes: "Detachable-tip for Onyx/Squid. Dead space 0.24-0.32 mL. Tip can be left in embolic cast to prevent reflux."
  },
  {
    id: "apollo",
    name: "Apollo",
    manufacturer: "Medtronic",
    category: "Detachable-Tip",
    innerDiameter: 0.013,
    outerDiameter: 0.019,
    workingLength: [165],
    deadSpace: 0.25,
    deadSpaceOptions: [
      { type: "standard", volume: 0.25, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: false,
      phil35: false,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: false,
      coils: false,
      microspheres: false,
      y90: false,
    },
    maxCoilDiameter: 0,
    maxMicrosphereDiameter: 0,
    features: {
      balloonOcclusion: false,
      detachableTip: true,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 150,
    ifuUrl: "https://www.medtronic.com/us-en/healthcare-professionals/products/neurological/avm-embolization/apollo-marathon.html",
    notes: "Detachable-tip microcatheter. Dead space 0.25 mL. 1.5cm or 3cm tip lengths available."
  },
  {
    id: "marathon",
    name: "Marathon",
    manufacturer: "Medtronic",
    category: "Flow-Directed",
    innerDiameter: 0.013,
    outerDiameter: 0.019,
    workingLength: [165],
    deadSpace: 0.23,
    deadSpaceOptions: [
      { type: "standard", volume: 0.23, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: false,
      phil35: false,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: true,
      coils: true,
      microspheres: false,
      y90: false,
    },
    maxCoilDiameter: 0.013,
    maxMicrosphereDiameter: 0,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: true,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://www.medtronic.com/us-en/healthcare-professionals/products/neurological/avm-embolization/apollo-marathon.html",
    notes: "Flow-directed. Small lumen, dead space 0.23 mL. Used for distal AVM embolization with Onyx or n-BCA."
  },
  {
    id: "magic-12",
    name: "Magic 1.2",
    manufacturer: "Balt",
    category: "Flow-Directed",
    innerDiameter: 0.008,
    outerDiameter: 0.015,
    workingLength: [165],
    deadSpace: 0.20,
    deadSpaceOptions: [
      { type: "standard", volume: 0.20, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: false,
      onyx500: false,
      phil25: true,
      phil30: false,
      phil35: false,
      squid12: true,
      squid18: false,
      squid34: false,
      nbca: true,
      coils: false,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0,
    maxMicrosphereDiameter: 300,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: true,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 500,
    ifuUrl: "https://baltgroup.com/products/magic/",
    notes: "First flow-directed microcatheter. 1.2F with olive tip. For hyperselective catheterization <1mm vessels."
  },
  {
    id: "magic-15",
    name: "Magic 1.5",
    manufacturer: "Balt",
    category: "Flow-Directed",
    innerDiameter: 0.010,
    outerDiameter: 0.019,
    workingLength: [165, 180],
    deadSpace: 0.28,
    deadSpaceOptions: [
      { type: "standard", volume: 0.28, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: true,
      phil35: false,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: true,
      coils: false,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0,
    maxMicrosphereDiameter: 500,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: true,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 500,
    ifuUrl: "https://baltgroup.com/products/magic/",
    notes: "Flow-directed. 1.5F with olive tip. Used for peripheral and neurovascular embolization."
  },
  {
    id: "magic-18",
    name: "Magic 1.8",
    manufacturer: "Balt",
    category: "Flow-Directed",
    innerDiameter: 0.013,
    outerDiameter: 0.023,
    workingLength: [165, 180],
    deadSpace: 0.34,
    deadSpaceOptions: [
      { type: "standard", volume: 0.34, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: false,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: false,
      nbca: true,
      coils: false,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0,
    maxMicrosphereDiameter: 700,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: true,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 500,
    ifuUrl: "https://baltgroup.com/products/magic/",
    notes: "Flow-directed. Dead space ~0.34 mL. Used for peripheral embolization with Onyx, PHIL, or particles."
  },
  {
    id: "progreat-24",
    name: "Progreat 2.4F",
    manufacturer: "Terumo",
    category: "Peripheral",
    innerDiameter: 0.019,
    outerDiameter: 0.030,
    workingLength: [110, 130, 150],
    deadSpace: 0.60,
    deadSpaceOptions: [
      { type: "standard", volume: 0.60, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: true,
    },
    maxCoilDiameter: 0.018,
    maxMicrosphereDiameter: 500,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 800,
    ifuUrl: "https://www.terumois.com/products/catheters/progreat.html",
    notes: "Large 0.019 inch lumen. PTFE inner layer. Designed for peripheral embolization."
  },
  {
    id: "truselect",
    name: "TruSelect",
    manufacturer: "Boston Scientific",
    category: "Peripheral",
    innerDiameter: 0.021,
    outerDiameter: 0.025,
    workingLength: [105, 130, 155, 175],
    deadSpace: 0.55,
    deadSpaceOptions: [
      { type: "standard", volume: 0.55, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: true,
    },
    maxCoilDiameter: 0.018,
    maxMicrosphereDiameter: 700,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 800,
    ifuUrl: "https://www.bostonscientific.com/en-US/products/embolization/truselect-microcatheter.html",
    notes: "2.0F OD with 0.021 inch ID. First 175cm microcatheter. Compatible with 700µm particles and Y-90."
  },
  {
    id: "maestro",
    name: "Maestro",
    manufacturer: "Merit Medical",
    category: "Peripheral",
    innerDiameter: 0.020,
    outerDiameter: 0.028,
    workingLength: [110, 130, 150, 165],
    deadSpace: 0.58,
    deadSpaceOptions: [
      { type: "standard", volume: 0.58, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: true,
    },
    maxCoilDiameter: 0.018,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 800,
    ifuUrl: "https://www.merit.com/product/merit-maestro-microcatheters/",
    notes: "Multipurpose peripheral microcatheter. Supports coils up to 0.018 inch and embolics up to 900µm."
  },
  {
    id: "renegade-hiflo",
    name: "Renegade HI-FLO",
    manufacturer: "Boston Scientific",
    category: "Peripheral",
    innerDiameter: 0.027,
    outerDiameter: 0.035,
    workingLength: [105, 115, 135, 150],
    deadSpace: 0.70,
    deadSpaceOptions: [
      { type: "standard", volume: 0.70, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: true,
    },
    maxCoilDiameter: 0.027,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 800,
    ifuUrl: "https://www.bostonscientific.com/en-US/products/embolization/Renegade_HI-FLO_Microcatheter.html",
    notes: "Large 0.027 inch lumen for high flow peripheral embolization. DMSO and alcohol compatible."
  },
  {
    id: "direxion-21",
    name: "Direxion 21",
    manufacturer: "Boston Scientific",
    category: "Peripheral",
    innerDiameter: 0.021,
    outerDiameter: 0.026,
    workingLength: [130],
    deadSpace: 0.52,
    deadSpaceOptions: [
      { type: "standard", volume: 0.52, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: true,
    },
    maxCoilDiameter: 0.021,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 1200,
    ifuUrl: "https://www.bostonscientific.com/en-US/products/embolization/Direxion_and_Direxion_HI-FLO_Microcatheters.html",
    notes: "First nitinol microcatheter. Unrivaled torqueability. Power injections up to 1200 psi."
  },
  {
    id: "direxion-27",
    name: "Direxion 27",
    manufacturer: "Boston Scientific",
    category: "Peripheral",
    innerDiameter: 0.027,
    outerDiameter: 0.032,
    workingLength: [130],
    deadSpace: 0.65,
    deadSpaceOptions: [
      { type: "standard", volume: 0.65, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: true,
    },
    maxCoilDiameter: 0.027,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 1200,
    ifuUrl: "https://www.bostonscientific.com/en-US/products/embolization/Direxion_and_Direxion_HI-FLO_Microcatheters.html",
    notes: "Nitinol torqueable microcatheter. 0.027 inch lumen. 1200 psi power injection capability."
  },
  {
    id: "phenom-21",
    name: "Phenom 21",
    manufacturer: "Medtronic",
    category: "General Purpose",
    innerDiameter: 0.021,
    outerDiameter: 0.029,
    workingLength: [160],
    deadSpace: 0.52,
    deadSpaceOptions: [
      { type: "standard", volume: 0.52, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.021,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://europe.medtronic.com/xd-en/healthcare-professionals/products/neurological/access-delivery-nv/phenom.html",
    notes: "0.021 inch ID, 160cm length. For flow diverter and coil delivery."
  },
  {
    id: "phenom-27",
    name: "Phenom 27",
    manufacturer: "Medtronic",
    category: "General Purpose",
    innerDiameter: 0.027,
    outerDiameter: 0.032,
    workingLength: [150],
    deadSpace: 0.60,
    deadSpaceOptions: [
      { type: "standard", volume: 0.60, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.027,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://europe.medtronic.com/xd-en/healthcare-professionals/products/neurological/access-delivery-nv/phenom.html",
    notes: "0.027 inch microcatheter. Used for flow diverter delivery (Pipeline, Surpass, etc)."
  },
  {
    id: "marksman",
    name: "Marksman",
    manufacturer: "Medtronic",
    category: "General Purpose",
    innerDiameter: 0.027,
    outerDiameter: 0.040,
    workingLength: [160],
    deadSpace: 0.62,
    deadSpaceOptions: [
      { type: "standard", volume: 0.62, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.027,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://europe.medtronic.com/xd-en/healthcare-professionals/products/neurological/access-delivery-nv/marksman.html",
    notes: "0.027 inch ID. PTFE liner, stainless steel braiding. For Neuroform stent delivery."
  },
  {
    id: "rebar-18",
    name: "Rebar 18",
    manufacturer: "Medtronic",
    category: "General Purpose",
    innerDiameter: 0.021,
    outerDiameter: 0.030,
    workingLength: [130],
    deadSpace: 0.50,
    deadSpaceOptions: [
      { type: "standard", volume: 0.50, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.021,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://www.medtronic.com/us-en/healthcare-professionals/products/cardiovascular/peripheral-embolization/rebar.html",
    notes: "Reinforced microcatheter. Stainless steel construction. High kink resistance."
  },
  {
    id: "trevo-trak21",
    name: "Trevo Trak 21",
    manufacturer: "Stryker",
    category: "General Purpose",
    innerDiameter: 0.021,
    outerDiameter: 0.028,
    workingLength: [162],
    deadSpace: 0.48,
    deadSpaceOptions: [
      { type: "standard", volume: 0.48, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.021,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://www.stryker.com/us/en/neurovascular/products/trak-21.html",
    notes: "0.021 inch ID, 162cm length. Designed for Trevo NXT ProVue Retriever delivery."
  },
  {
    id: "prowler-select-plus",
    name: "Prowler Select Plus",
    manufacturer: "Cerenovus (J&J)",
    category: "General Purpose",
    innerDiameter: 0.021,
    outerDiameter: 0.035,
    workingLength: [150],
    deadSpace: 0.50,
    deadSpaceOptions: [
      { type: "standard", volume: 0.50, label: "Standard" },
    ],
    embolicsCompatible: {
      onyx18: true,
      onyx34: true,
      onyx500: true,
      phil25: true,
      phil30: true,
      phil35: true,
      squid12: true,
      squid18: true,
      squid34: true,
      nbca: true,
      coils: true,
      microspheres: true,
      y90: false,
    },
    maxCoilDiameter: 0.021,
    maxMicrosphereDiameter: 900,
    features: {
      balloonOcclusion: false,
      detachableTip: false,
      flowDirected: false,
      dmsoCompatible: true,
    },
    maxInjectionPressure: 600,
    ifuUrl: "https://www.jnjmedtech.com/en-US/product/prowler-ex-microcatheter",
    notes: "0.021 inch inner diameter. Part of Codman Neurovascular (now Cerenovus) product line."
  },
];

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Filter catheters based on user selections
 */
function filterCatheters({
  emboilcAgent,
  coilSize,
  microsphereSize,
  needsBalloon,
  needsDetachableTip,
  searchTerm,
}) {
  return CATHETER_DATABASE.filter((catheter) => {
    // Search filter
    if (searchTerm && searchTerm.trim() !== "") {
      const search = searchTerm.toLowerCase();
      const matchesName = catheter.name.toLowerCase().includes(search);
      const matchesManufacturer = catheter.manufacturer.toLowerCase().includes(search);
      const matchesCategory = catheter.category.toLowerCase().includes(search);
      if (!matchesName && !matchesManufacturer && !matchesCategory) {
        return false;
      }
    }

    // Filter by embolic agent compatibility
    if (emboilcAgent && emboilcAgent !== "") {
      const compatible = catheter.embolicsCompatible[emboilcAgent];
      if (!compatible) {
        return false;
      }
    }

    // Filter by coil size (catheter ID must be >= coil size)
    if (coilSize && coilSize !== "") {
      const coilDiameter = parseFloat(coilSize);
      if (catheter.maxCoilDiameter < coilDiameter) {
        return false;
      }
    }

    // Filter by microsphere size
    if (microsphereSize && microsphereSize !== "") {
      const maxSize = parseInt(microsphereSize);
      if (catheter.maxMicrosphereDiameter < maxSize) {
        return false;
      }
    }

    // Filter by balloon requirement
    if (needsBalloon && !catheter.features.balloonOcclusion) {
      return false;
    }

    // Filter by detachable tip requirement
    if (needsDetachableTip && !catheter.features.detachableTip) {
      return false;
    }

    return true;
  });
}

/**
 * Get embolic agent display name
 */
function getEmbolieAgentName(key) {
  const names = {
    onyx18: "Onyx 18",
    onyx34: "Onyx 34",
    onyx500: "Onyx 500",
    phil25: "PHIL 25%",
    phil30: "PHIL 30%",
    phil35: "PHIL 35%",
    squid12: "Squid 12",
    squid18: "Squid 18",
    squid34: "Squid 34",
    nbca: "NBCA (n-BCA)",
    coils: "Coils",
    microspheres: "Microspheres",
    y90: "Y-90 Microspheres",
  };
  return names[key] || key;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

function KhouryCatheterSelectorComponent() {
  // State management
  const [emboilcAgent, setEmboilcAgent] = useState("");
  const [coilSize, setCoilSize] = useState("");
  const [microsphereSize, setMicrosphereSize] = useState("");
  const [needsBalloon, setNeedsBalloon] = useState(false);
  const [needsDetachableTip, setNeedsDetachableTip] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCatheter, setSelectedCatheter] = useState(null);
  const [selectedAdaptorType, setSelectedAdaptorType] = useState("standard");
  const [showFilters, setShowFilters] = useState(true);

  // Filtered catheters (useMemo for performance)
  const filteredCatheters = useMemo(() => {
    return filterCatheters({
      emboilcAgent,
      coilSize,
      microsphereSize,
      needsBalloon,
      needsDetachableTip,
      searchTerm,
    });
  }, [emboilcAgent, coilSize, microsphereSize, needsBalloon, needsDetachableTip, searchTerm]);

  // Priming volume calculation
  const primingVolume = useMemo(() => {
    if (!selectedCatheter) return null;

    const adaptorOption = selectedCatheter.deadSpaceOptions.find(
      opt => opt.type === selectedAdaptorType
    );

    return adaptorOption ? adaptorOption.volume : selectedCatheter.deadSpace;
  }, [selectedCatheter, selectedAdaptorType]);

  // Clear all filters
  const clearFilters = () => {
    setEmboilcAgent("");
    setCoilSize("");
    setMicrosphereSize("");
    setNeedsBalloon(false);
    setNeedsDetachableTip(false);
    setSearchTerm("");
    setSelectedCatheter(null);
  };

  // Active filter count
  const activeFilterCount = [
    emboilcAgent,
    coilSize,
    microsphereSize,
    needsBalloon,
    needsDetachableTip,
    searchTerm,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* STEP 1: Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Filter Catheters</h3>
              {activeFilterCount > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear All
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search by Name or Manufacturer</Label>
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g., Scepter, Headway, Medtronic..."
                className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Embolic Agent */}
            <div className="space-y-2">
              <Label htmlFor="embolicAgent">Embolic Agent</Label>
              <select
                id="embolicAgent"
                value={emboilcAgent}
                onChange={(e) => setEmboilcAgent(e.target.value)}
                className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Embolic Agents</option>
                <optgroup label="Onyx">
                  <option value="onyx18">Onyx 18 (low viscosity)</option>
                  <option value="onyx34">Onyx 34 (medium viscosity)</option>
                  <option value="onyx500">Onyx 500 (high viscosity)</option>
                </optgroup>
                <optgroup label="PHIL">
                  <option value="phil25">PHIL 25%</option>
                  <option value="phil30">PHIL 30%</option>
                  <option value="phil35">PHIL 35%</option>
                </optgroup>
                <optgroup label="Squid">
                  <option value="squid12">Squid 12</option>
                  <option value="squid18">Squid 18</option>
                  <option value="squid34">Squid 34</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="nbca">NBCA (n-Butyl Cyanoacrylate)</option>
                  <option value="coils">Coils Only</option>
                  <option value="microspheres">Microspheres</option>
                  <option value="y90">Y-90 Microspheres</option>
                </optgroup>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Coil Size */}
              <div className="space-y-2">
                <Label htmlFor="coilSize">Coil Size (if applicable)</Label>
                <select
                  id="coilSize"
                  value={coilSize}
                  onChange={(e) => setCoilSize(e.target.value)}
                  className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any / Not Applicable</option>
                  <option value="0.010">0.010 inch</option>
                  <option value="0.013">0.013 inch</option>
                  <option value="0.014">0.014 inch</option>
                  <option value="0.0165">0.0165 inch</option>
                  <option value="0.017">0.017 inch</option>
                  <option value="0.018">0.018 inch</option>
                  <option value="0.021">0.021 inch</option>
                </select>
              </div>

              {/* Microsphere Size */}
              <div className="space-y-2">
                <Label htmlFor="microsphereSize">Microsphere Size (if applicable)</Label>
                <select
                  id="microsphereSize"
                  value={microsphereSize}
                  onChange={(e) => setMicrosphereSize(e.target.value)}
                  className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any / Not Applicable</option>
                  <option value="300">≤300 µm</option>
                  <option value="500">≤500 µm</option>
                  <option value="700">≤700 µm</option>
                  <option value="900">≤900 µm</option>
                </select>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="needsBalloon"
                  checked={needsBalloon}
                  onChange={(e) => setNeedsBalloon(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="needsBalloon" className="cursor-pointer">
                  Balloon occlusion required
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="needsDetachableTip"
                  checked={needsDetachableTip}
                  onChange={(e) => setNeedsDetachableTip(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="needsDetachableTip" className="cursor-pointer">
                  Detachable tip required
                </Label>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* STEP 2: Filtered Catheter Results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-lg">
            Compatible Catheters ({filteredCatheters.length} results)
          </h3>
        </div>

        {filteredCatheters.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500 mb-2">No catheters match your criteria.</p>
              <p className="text-sm text-gray-400">Try adjusting your filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredCatheters.map((catheter) => (
              <Card
                key={catheter.id}
                className={`transition-all ${
                  selectedCatheter?.id === catheter.id
                    ? "ring-2 ring-blue-500 shadow-md"
                    : "hover:shadow-sm"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-base">{catheter.name}</h4>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                          {catheter.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{catheter.manufacturer}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <span className="text-gray-500">ID:</span>{" "}
                          <span className="font-medium">{catheter.innerDiameter}"</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Dead Space:</span>{" "}
                          <span className="font-medium">{catheter.deadSpace} mL</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Balloon:</span>{" "}
                          <span className="font-medium">
                            {catheter.features.balloonOcclusion ? "Yes" : "No"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Length:</span>{" "}
                          <span className="font-medium">
                            {catheter.workingLength.join(", ")} cm
                          </span>
                        </div>
                      </div>

                      {catheter.notes && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {catheter.notes}
                        </p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedCatheter(catheter);
                        setSelectedAdaptorType("standard");
                      }}
                      variant={selectedCatheter?.id === catheter.id ? "default" : "outline"}
                    >
                      {selectedCatheter?.id === catheter.id ? "Selected" : "Select"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* STEP 3: Selected Catheter Details */}
      {selectedCatheter && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <h3 className="text-lg font-semibold">Selected Catheter Details</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-lg mb-2">{selectedCatheter.name}</h4>
                <p className="text-sm text-gray-600 mb-4">{selectedCatheter.manufacturer}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Inner Diameter:</span>
                    <span className="font-medium">{selectedCatheter.innerDiameter} inch</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Outer Diameter:</span>
                    <span className="font-medium">{selectedCatheter.outerDiameter} inch</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Working Length:</span>
                    <span className="font-medium">{selectedCatheter.workingLength.join(", ")} cm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Injection Pressure:</span>
                    <span className="font-medium">{selectedCatheter.maxInjectionPressure} psi</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Adaptor Selection */}
                {selectedCatheter.deadSpaceOptions.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="adaptorType">Adaptor Configuration</Label>
                    <select
                      id="adaptorType"
                      value={selectedAdaptorType}
                      onChange={(e) => setSelectedAdaptorType(e.target.value)}
                      className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {selectedCatheter.deadSpaceOptions.map((option) => (
                        <option key={option.type} value={option.type}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Priming Volume */}
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-900 mb-2">Priming Volume</h5>
                  <p className="text-3xl font-bold text-blue-700">{primingVolume} mL</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {selectedCatheter.deadSpaceOptions.find(opt => opt.type === selectedAdaptorType)?.label}
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <h5 className="font-semibold text-sm">Features</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedCatheter.features.balloonOcclusion && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                        Balloon Occlusion
                      </span>
                    )}
                    {selectedCatheter.features.detachableTip && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                        Detachable Tip
                      </span>
                    )}
                    {selectedCatheter.features.flowDirected && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        Flow-Directed
                      </span>
                    )}
                    {selectedCatheter.features.dmsoCompatible && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                        DMSO Compatible
                      </span>
                    )}
                    {!selectedCatheter.features.dmsoCompatible && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                        NOT DMSO Compatible
                      </span>
                    )}
                  </div>
                </div>

                {/* IFU Link */}
                <div>
                  <a
                    href={selectedCatheter.ifuUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Manufacturer IFU
                  </a>
                </div>
              </div>
            </div>

            {/* Compatible Embolics */}
            <div className="border-t pt-4">
              <h5 className="font-semibold text-sm mb-2">Compatible Embolic Agents</h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedCatheter.embolicsCompatible)
                  .filter(([, compatible]) => compatible)
                  .map(([key]) => (
                    <span
                      key={key}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                    >
                      {getEmbolieAgentName(key)}
                    </span>
                  ))}
              </div>
            </div>

            {/* Clinical Notes */}
            {selectedCatheter.notes && (
              <div className="border-t pt-4">
                <h5 className="font-semibold text-sm mb-2">Clinical Notes</h5>
                <p className="text-sm text-gray-700">{selectedCatheter.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Safety Warnings */}
      <Card className="border-orange-200 bg-orange-50/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-orange-900">Safety Information</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-orange-900">
          <div className="space-y-2">
            <h5 className="font-semibold">Priming Instructions for Liquid Embolics</h5>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Flush microcatheter with sterile saline (5 mL recommended)</li>
              <li>Fill dead space with DMSO or manufacturer-specified solvent</li>
              <li>Use calculated priming volume ({selectedCatheter ? primingVolume : "see above"} mL for selected catheter)</li>
              <li>Slowly inject liquid embolic under fluoroscopic guidance</li>
              <li>Follow manufacturer IFU for injection rate and technique</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h5 className="font-semibold">Critical Safety Warnings</h5>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong>NBCA (n-BCA) is NOT compatible with balloon occlusion catheters</strong> (Scepter, Sniper, TransForm)</li>
              <li>Always verify catheter DMSO compatibility before using Onyx, PHIL, or Squid</li>
              <li>Dead space values may be <strong>estimated</strong> - verify with manufacturer IFU</li>
              <li>Observe maximum injection pressure limits to prevent catheter rupture</li>
              <li>This tool is for <strong>educational reference only</strong> - not a substitute for clinical judgment</li>
            </ul>
          </div>

          <div className="bg-white border border-orange-300 rounded p-3 text-xs">
            <p className="font-semibold mb-1">Disclaimer</p>
            <p>
              This catheter selector provides reference information compiled from publicly available
              manufacturer data. Dead space volumes and specifications should be verified with the
              catheter's Instructions for Use (IFU) before clinical use. Always follow institutional
              protocols and manufacturer guidelines. The tool developers assume no liability for
              clinical decisions based on this information.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT CALCULATOR DEFINITION
// ═══════════════════════════════════════════════════════════════════

export const KhouryCatheterSelector = {
  id: "khoury-catheter-selector",
  name: "Khoury Catheter Selector",
  category: "interventional",
  desc: "Interactive microcatheter selection tool for interventional procedures based on embolic agent, device size, and clinical requirements",

  info: {
    text: `The Khoury Catheter Selector helps interventionalists choose the optimal microcatheter based on:

• **Embolic Agent Compatibility**: Filter by Onyx, PHIL, Squid, NBCA, coils, microspheres, or Y-90
• **Device Size Requirements**: Specify coil diameter or microsphere size
• **Procedural Features**: Balloon occlusion or detachable-tip options
• **Dead Space Calculations**: Accurate priming volumes with brand-specific adaptor support

This tool filters 30 commonly used catheters and calculates priming volumes to optimize embolic delivery and minimize waste.

**Database Coverage:**
- 5 Balloon Occlusion Catheters (Scepter, Sniper, TransForm)
- 18 General Purpose Catheters (Headway, Excelsior, Phenom, etc.)
- 2 Detachable-Tip Catheters (Sonic, Apollo)
- 3 Flow-Directed Catheters (Marathon, Magic)
- 6 Peripheral Catheters (TruSelect, Maestro, Direxion, etc.)

Select your embolic agent and procedure requirements to view compatible catheters with detailed specifications and priming instructions.`,
  },

  // Custom component flag
  isCustomComponent: true,

  // Custom component
  Component: KhouryCatheterSelectorComponent,

  // Empty fields and compute for compatibility
  fields: [],
  compute: () => ({}),

  // References
  refs: [
    {
      t: "TerumoNeuro (MicroVention) - Scepter Family, Headway Portfolio, Sonic Detachable-Tip Microcatheters",
      u: "https://www.terumoneuro.com/",
    },
    {
      t: "Medtronic Neurovascular - Marathon Flow-Directed, Apollo Detachable-Tip, Phenom Access Catheters",
      u: "https://www.medtronic.com/us-en/healthcare-professionals/therapies-procedures/cardiovascular/neurovascular.html",
    },
    {
      t: "Stryker Neurovascular - Excelsior, TransForm, Trevo Microcatheters",
      u: "https://www.stryker.com/us/en/neurovascular.html",
    },
    {
      t: "Boston Scientific Peripheral Interventions - TruSelect, Renegade HI-FLO, Direxion Microcatheters",
      u: "https://www.bostonscientific.com/en-US/products/embolization.html",
    },
    {
      t: "Balt - Magic Flow-Directed Microcatheter Family",
      u: "https://baltgroup.com/",
    },
    {
      t: "Merit Medical - Maestro Multipurpose Microcatheter",
      u: "https://www.merit.com/peripheral-intervention/embolization/",
    },
    {
      t: "Terumo Interventional Systems - Progreat Peripheral Microcatheters",
      u: "https://www.terumois.com/",
    },
    {
      t: "Embolx - Sniper Balloon Occlusion Catheter for Pressure-Directed Therapy",
      u: "https://embolx.com/",
    },
  ],
};
