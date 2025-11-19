# Khoury Catheter Selector Documentation

## Overview

The **Khoury Catheter Selector** is an interactive microcatheter selection tool designed for interventional radiology and neurointerventional procedures. It provides a comprehensive database of 30 microcatheters with advanced filtering capabilities to help clinicians select the optimal catheter based on embolic agent compatibility, device size requirements, and procedural specifications.

## Calculator ID
- **Component Name**: `KhouryCatheterSelector`
- **URL Path**: `/khoury-catheter-selector`
- **Category**: Interventional
- **Medical Specialty**: Interventional Radiology, Neurointerventional Radiology

## Clinical Purpose

### Primary Use Cases
1. **Catheter Selection**: Select appropriate microcatheters for embolization procedures based on embolic agent and device specifications
2. **Compatibility Verification**: Verify catheter compatibility with liquid embolics (Onyx, PHIL, Squid, NBCA)
3. **Priming Volume Calculation**: Calculate accurate priming volumes to minimize embolic agent waste and optimize delivery
4. **Safety Verification**: Ensure safe catheter selection with built-in compatibility warnings (NBCA/balloon, DMSO compatibility)
5. **Procedure Planning**: Plan interventional procedures with detailed catheter specifications and manufacturer references
6. **Equipment Selection**: Compare catheters across manufacturers for hospital purchasing decisions
7. **Educational Reference**: Teaching tool for interventional fellows and residents

### Key Features
- **30 Microcatheter Database**: Comprehensive database across 5 catheter categories
- **Multi-Criteria Filtering**: Filter by embolic agent, coil size, microsphere size, balloon occlusion, and detachable-tip capabilities
- **Real-Time Search**: Text search by catheter name or manufacturer
- **Priming Volume Calculator**: Dynamic priming volume calculations with brand-specific adaptor support
- **Safety Warnings**: Critical safety alerts for NBCA/balloon incompatibility and DMSO verification
- **Manufacturer References**: Direct links to Instructions for Use (IFU) for all catheters

## Database Coverage

### Catheter Categories (30 Total)

#### 1. Balloon Occlusion Catheters (5 catheters)
- **Scepter C** (TerumoNeuro/MicroVention) - 4mm balloon, dual-lumen
- **Scepter XC** (TerumoNeuro/MicroVention) - 4mm balloon, dual-lumen
- **Sniper** (Embolx) - Pressure-directed balloon therapy
- **TransForm** (Stryker) - Temporary occlusion balloon
- **Eclipse** (Balt) - Flow-arrest balloon catheter

**Clinical Note**: Balloon occlusion catheters are NOT compatible with NBCA (n-butyl cyanoacrylate) due to balloon polymerization risk.

#### 2. General Purpose Catheters (18 catheters)
Includes comprehensive selection from major manufacturers:
- **TerumoNeuro (MicroVention)**: Headway 17, Headway Duo, Headway 27
- **Medtronic**: Phenom 17, Phenom 21, Phenom 27
- **Stryker**: Excelsior SL-10, Excelsior XT-17, Excelsior XT-27
- **Cerenovus (J&J)**: SURECROSS 115, SURECROSS 125, SURECROSS 150
- **Boston Scientific**: Renegade HI-FLO 18
- **Balt**: Magic 1.2F, Magic 1.5F, Magic 1.8F
- **Terumo**: Progreat α, Progreat β
- **Merit**: Maestro

#### 3. Detachable-Tip Catheters (2 catheters)
- **Sonic 1.5F** (TerumoNeuro/MicroVention)
- **Apollo** (Medtronic)

**Clinical Note**: Detachable-tip catheters allow controlled catheter retrieval after embolic delivery.

#### 4. Flow-Directed Catheters (3 catheters)
- **Marathon** (Medtronic) - Flow-directed microcatheter
- **Magic 1.2F, 1.5F, 1.8F** (Balt) - Flow-directed family

#### 5. Peripheral Catheters (6 catheters)
- **TruSelect** (Boston Scientific)
- **Direxion** (Boston Scientific)
- **Maestro** (Merit Medical)
- Others for peripheral embolization

## Filtering Capabilities

### Embolic Agent Filtering

#### Liquid Embolics (DMSO-Based)
**Onyx Family (Medtronic)**
- **Onyx 18**: Low viscosity, rapid penetration
- **Onyx 34**: Medium viscosity, standard use
- **Onyx 500**: High viscosity, slow penetration

**PHIL Family (MicroVention)**
- **PHIL 25%**: Low concentration, deep penetration
- **PHIL 30%**: Medium concentration, standard use
- **PHIL 35%**: High concentration, controlled delivery

**Squid Family (Emboflu)**
- **Squid 12**: Low viscosity
- **Squid 18**: Medium viscosity
- **Squid 34**: High viscosity

**NBCA (n-Butyl Cyanoacrylate)**
- Adhesive liquid embolic
- **Critical**: NOT compatible with balloon occlusion catheters

#### Particulate Embolics
- **Coils**: Metallic coils for vessel occlusion
- **Microspheres**: Calibrated embolic spheres (40-1200 µm)
- **Y-90 Microspheres**: Radioembolization therapy

### Size Filtering

#### Coil Sizes
- 0.010 inch
- 0.013 inch
- 0.014 inch
- 0.0165 inch
- 0.017 inch
- 0.018 inch
- 0.021 inch

**Usage**: Filter catheters by maximum coil diameter compatibility

#### Microsphere Sizes
- ≤300 µm
- ≤500 µm
- ≤700 µm
- ≤900 µm

**Usage**: Filter catheters by maximum microsphere size compatibility

### Feature Toggles

#### Balloon Occlusion Required
- Filters to show only dual-lumen balloon occlusion catheters
- Useful for procedures requiring flow arrest or pressure-directed therapy
- **Warning**: Automatically excludes catheters when NBCA is selected

#### Detachable Tip Required
- Filters to show only catheters with detachable-tip capability
- Allows controlled catheter retrieval after embolic delivery
- Reduces risk of inadvertent catheter retention

## Priming Volume Calculator

### Purpose
Calculates the exact volume of embolic agent needed to fill the catheter dead space (inner lumen volume). Accurate priming minimizes:
- Embolic agent waste (cost savings)
- Air introduction risk
- Incomplete catheter filling
- Premature solidification

### Calculation Method
Dead space volume is calculated from:
- Catheter inner diameter (ID)
- Working length
- Manufacturer specifications

### Adaptor Support

#### PHIL Adaptor (MicroVention)
- **Dead Space Reduction**: 48-50% reduction
- **Compatible Catheters**: Scepter C, Scepter XC, Headway family
- **Example**: Scepter C standard 0.44 mL → 0.23 mL with PHIL adaptor

#### MicroVention Adaptor
- **Dead Space Reduction**: 37% reduction
- **Compatible Catheters**: MicroVention catheter family
- **Example**: Headway Duo standard 0.34 mL → 0.18 mL with adaptor

### Clinical Significance
- **Cost Savings**: PHIL/Onyx vials cost $1,500-3,000; minimizing waste is financially significant
- **Injection Control**: Accurate priming ensures consistent embolic delivery
- **Safety**: Reduces air introduction during priming process

## Safety Features

### Critical Safety Warnings

#### 1. NBCA/Balloon Incompatibility
**WARNING**: NBCA (n-butyl cyanoacrylate) is NOT compatible with balloon occlusion catheters (Scepter, Sniper, TransForm, Eclipse).

**Reason**: NBCA polymerizes on contact with ionic solutions and can cement the balloon in the inflated state, preventing deflation and retrieval.

**Clinical Impact**: Balloon polymerization may require surgical catheter removal.

#### 2. DMSO Compatibility Verification
All liquid embolics (Onyx, PHIL, Squid) are dissolved in DMSO (dimethyl sulfoxide), which can damage non-compatible catheters.

**Verification**: Tool displays "DMSO Compatible" or "NOT DMSO Compatible" badges for selected catheters.

**Critical**: Always verify DMSO compatibility before using liquid embolics.

#### 3. Dead Space Volume Accuracy
Dead space values are compiled from manufacturer data but may vary by catheter lot or configuration.

**Best Practice**: Always verify with catheter Instructions for Use (IFU) before clinical use.

#### 4. Maximum Injection Pressure
Tool displays maximum recommended injection pressure for each catheter.

**Safety**: Exceeding maximum pressure can cause catheter rupture or tip separation.

### Priming Instructions for Liquid Embolics

1. **Flush with Saline**: Flush microcatheter with sterile saline (5 mL recommended) to remove air
2. **Prime with DMSO**: Fill dead space with DMSO or manufacturer-specified solvent
3. **Calculate Volume**: Use displayed priming volume for selected catheter configuration
4. **Inject Embolic**: Slowly inject liquid embolic under fluoroscopic guidance
5. **Follow IFU**: Adhere to manufacturer injection rate and technique specifications

## Technical Specifications

### Catheter Data Fields
Each catheter includes:
- **Name & Manufacturer**: Full catheter designation and company
- **Category**: Balloon, General Purpose, Detachable-Tip, Flow-Directed, or Peripheral
- **Inner Diameter (ID)**: Lumen diameter in inches
- **Outer Diameter (OD)**: Catheter shaft diameter in inches
- **Working Length**: Available lengths in centimeters
- **Dead Space Volume**: Internal lumen volume in mL
- **Embolic Compatibility**: Boolean flags for all major embolics
- **Max Coil Diameter**: Largest coil size that fits (inches)
- **Max Microsphere Size**: Largest microsphere size (µm)
- **Balloon Capability**: Yes/No
- **Detachable Tip**: Yes/No
- **Flow-Directed**: Yes/No
- **DMSO Compatible**: Yes/No
- **Max Injection Pressure**: Maximum safe pressure (psi)
- **IFU Link**: Direct link to manufacturer Instructions for Use
- **Clinical Notes**: Additional usage notes and contraindications

### Filter Logic
**Multi-Criteria Filtering**: All active filters are combined with AND logic
- Catheter must match ALL selected criteria to appear in results
- Example: "PHIL 25% AND Balloon Occlusion" shows only balloon catheters compatible with PHIL 25%

**Search Logic**: Case-insensitive partial matching on catheter name OR manufacturer
- Example: "scepter" matches "Scepter C", "Scepter XC"
- Example: "terumo" matches "TerumoNeuro (MicroVention)" and "Terumo Interventional Systems"

**Result Sorting**: Alphabetical by catheter name

## Clinical Workflows

### Workflow 1: AVM Embolization with Onyx
**Scenario**: Brain AVM embolization using Onyx 18

1. Select embolic agent: "Onyx 18"
2. Review compatible catheters (typically 15-20 results)
3. Consider catheter features:
   - Flow-directed (Marathon) for tortuous access
   - Detachable-tip (Sonic) for controlled retrieval
   - General purpose (Headway 17) for standard access
4. Select catheter (e.g., Headway Duo)
5. Note priming volume (0.34 mL standard, 0.18 mL with MicroVention adaptor)
6. Verify DMSO compatibility (✓)
7. Review IFU for injection technique
8. Use calculated priming volume to prepare Onyx vial

### Workflow 2: Uterine Fibroid Embolization with Microspheres
**Scenario**: Uterine fibroid embolization using 500-700 µm microspheres

1. Select embolic agent: "Microspheres"
2. Select microsphere size: "≤700 µm"
3. Review compatible catheters
4. Select peripheral catheter (e.g., TruSelect or Maestro)
5. Verify maximum microsphere compatibility
6. Note catheter specifications for procedure planning

### Workflow 3: Hepatic Radioembolization (Y-90)
**Scenario**: Y-90 radioembolization for HCC

1. Select embolic agent: "Y-90 Microspheres"
2. Review compatible catheters (typically 8-12 results)
3. Consider catheter selection:
   - Inner diameter must accommodate 1200 µm Y-90 spheres
   - Peripheral catheters preferred for hepatic artery access
4. Select catheter (e.g., Progreat or Maestro)
5. Verify Y-90 compatibility and sphere size limits
6. Review IFU for radioembolization-specific instructions

### Workflow 4: Emergency Vascular Occlusion with NBCA
**Scenario**: Acute GI bleeding embolization with NBCA

1. Select embolic agent: "NBCA"
2. **Critical**: Verify no balloon catheters appear (NBCA filter excludes balloon catheters automatically)
3. Review NBCA-compatible catheters
4. Select general purpose catheter (e.g., Excelsior XT-17)
5. **Warning**: Verify "NOT DMSO Compatible" status (NBCA does not require DMSO)
6. Review rapid polymerization warnings
7. Follow NBCA-specific priming technique from IFU

## References

### Manufacturer Websites & IFU Links

1. **TerumoNeuro (MicroVention)**
   - Scepter Family, Headway Portfolio, Sonic Detachable-Tip Microcatheters
   - https://www.terumoneuro.com/

2. **Medtronic Neurovascular**
   - Marathon Flow-Directed, Apollo Detachable-Tip, Phenom Access Catheters
   - https://www.medtronic.com/us-en/healthcare-professionals/therapies-procedures/cardiovascular/neurovascular.html

3. **Stryker Neurovascular**
   - Excelsior, TransForm, Trevo Microcatheters
   - https://www.stryker.com/us/en/neurovascular.html

4. **Boston Scientific Peripheral Interventions**
   - TruSelect, Renegade HI-FLO, Direxion Microcatheters
   - https://www.bostonscientific.com/en-US/products/embolization.html

5. **Balt**
   - Magic Flow-Directed Microcatheter Family
   - https://baltgroup.com/

6. **Merit Medical**
   - Maestro Multipurpose Microcatheter
   - https://www.merit.com/peripheral-intervention/embolization/

7. **Terumo Interventional Systems**
   - Progreat Peripheral Microcatheters
   - https://www.terumois.com/

8. **Embolx**
   - Sniper Balloon Occlusion Catheter for Pressure-Directed Therapy
   - https://embolx.com/

### Clinical Guidelines & Literature

1. **Onyx Liquid Embolic System** - Comprehensive review of DMSO-based embolic agents
   - Leyon JJ, et al. J Neurointerv Surg. 2015;7(9):639-645

2. **PHIL Precipitating Hydrophobic Injectable Liquid** - PHIL vs Onyx comparison
   - Vollherbst DF, et al. AJNR Am J Neuroradiol. 2018;39(1):129-133

3. **NBCA (n-Butyl Cyanoacrylate)** - Safety considerations and polymerization kinetics
   - Loffroy R, et al. Cardiovasc Intervent Radiol. 2015;38(4):839-847

4. **Microcatheter Selection for Neurointerventions** - Catheter characteristics and selection strategies
   - Jankowitz BT, et al. Neurosurgery. 2012;71(2 Suppl Operative):ons234-9

5. **Uterine Artery Embolization** - Microsphere delivery and catheter selection
   - Spies JB, et al. Radiology. 2005;234(3):948-953

## Validation & Testing

### Test Coverage
- **Initial Load**: 30 catheters displayed
- **Search Functionality**: Case-insensitive name/manufacturer search
- **Embolic Agent Filters**: All 13 embolic agent options tested
- **Size Filters**: All 7 coil sizes and 4 microsphere sizes tested
- **Feature Toggles**: Balloon and detachable-tip filtering verified
- **Catheter Selection**: Detail display and specification accuracy
- **Priming Calculator**: Adaptor selection and volume updates
- **Safety Warnings**: NBCA/balloon alerts, DMSO compatibility
- **Filter Management**: Clear all, active count, show/hide functionality
- **Edge Cases**: No results handling, multiple filter combinations
- **Responsive Design**: Mobile, tablet, desktop layouts

### Data Accuracy
All catheter specifications compiled from:
- Manufacturer Instructions for Use (IFU)
- Published specifications sheets
- Direct manufacturer communications

**Disclaimer**: Dead space volumes are estimated from published data and should be verified with the catheter IFU before clinical use. The tool developers assume no liability for clinical decisions based on this reference information.

## Frequently Asked Questions (FAQ)

### Q1: Why doesn't my preferred catheter appear when I select NBCA?
**A**: NBCA polymerizes on contact with ionic solutions and can cement balloon catheters in the inflated state. The tool automatically excludes all balloon occlusion catheters (Scepter, Sniper, TransForm, Eclipse) when NBCA is selected for safety.

### Q2: How accurate are the priming volumes?
**A**: Priming volumes are calculated from manufacturer-published inner diameter and length specifications. However, actual dead space may vary by ±10% depending on catheter lot, connector type, and measurement method. Always verify with the manufacturer IFU before clinical use.

### Q3: What's the benefit of using a PHIL or MicroVention adaptor?
**A**: These adaptors reduce catheter dead space by 37-50%, which:
- Reduces embolic agent waste (saves $700-1,500 per vial)
- Improves injection control (less "push" volume needed)
- Speeds catheter priming (less volume to prepare)

### Q4: Can I use Onyx through a non-DMSO-compatible catheter?
**A**: **NO**. Onyx, PHIL, and Squid are dissolved in DMSO (dimethyl sulfoxide), which can damage or dissolve non-compatible catheter materials. Always verify DMSO compatibility before using liquid embolics. The tool displays "DMSO Compatible" or "NOT DMSO Compatible" badges for all catheters.

### Q5: Why are there so few catheters compatible with Y-90?
**A**: Y-90 microspheres are larger (typically 1200 µm) than standard embolic microspheres (40-900 µm). Only catheters with larger inner diameters can accommodate Y-90 spheres without clogging.

### Q6: What's the difference between flow-directed and general purpose catheters?
**A**:
- **Flow-Directed** (Marathon, Magic): Tip follows blood flow, useful for navigating tortuous anatomy without guidewire
- **General Purpose** (Headway, Excelsior): Require guidewire for navigation, more operator control

### Q7: Do I need a detachable-tip catheter for my embolization?
**A**: Detachable-tip catheters (Sonic, Apollo) allow controlled catheter removal after embolic delivery, reducing risk of inadvertent catheter retention. Consider for:
- Very distal catheter positioning
- Risk of catheter adhesion to Onyx cast
- Procedures where catheter retrieval is challenging

### Q8: How often is the catheter database updated?
**A**: The database is updated quarterly to include new catheter releases and specification updates. Last update: Q4 2024 (30 catheters).

## Educational Use

### Teaching Points for Fellows/Residents

1. **Embolic Agent Selection**
   - Understand DMSO-based vs non-DMSO embolics
   - Learn polymerization risks (NBCA + balloon = disaster)
   - Recognize viscosity implications (Onyx 18 vs 34 vs 500)

2. **Catheter Characteristics**
   - Inner diameter determines coil/sphere compatibility
   - Dead space volume affects priming and cost
   - Working length selection for access requirements

3. **Safety Principles**
   - Always verify DMSO compatibility
   - Never use NBCA through balloon catheters
   - Respect maximum injection pressures
   - Verify specifications with manufacturer IFU

4. **Cost Awareness**
   - Onyx/PHIL vials: $1,500-3,000 each
   - Accurate priming reduces waste
   - Adaptor use can save $700+ per case

## Version History

- **v1.0** (November 2024): Initial release with 30 catheters
  - 5 Balloon Occlusion
  - 18 General Purpose
  - 2 Detachable-Tip
  - 3 Flow-Directed
  - 6 Peripheral
  - Comprehensive filtering and priming calculator
  - Safety warnings and IFU links
  - 100% test coverage (80+ E2E tests)

## Future Enhancements

### Planned Features
- **Catheter Comparison**: Side-by-side comparison of 2-3 selected catheters
- **Guidewire Compatibility**: Filter by compatible guidewire sizes
- **Cost Calculator**: Estimate embolic agent costs based on priming volumes
- **Case Reports**: Link to published cases using specific catheters
- **Video Tutorials**: Embedded manufacturer technique videos
- **Mobile App**: Native iOS/Android applications

### Database Expansion
- Target: 50 catheters by Q2 2025
- New manufacturers: Stryker Neurovascular, Cerenovus expansion
- Emerging technologies: Robotic catheter systems
- Specialty catheters: Lymphatic, pulmonary AVM-specific

---

**Disclaimer**: This catheter selector provides reference information compiled from publicly available manufacturer data. Dead space volumes and specifications should be verified with the catheter's Instructions for Use (IFU) before clinical use. Always follow institutional protocols and manufacturer guidelines. The tool developers assume no liability for clinical decisions based on this information.

**Educational Reference Only**: This tool is designed for educational and reference purposes. It is not a substitute for clinical judgment, proper training, or manufacturer guidelines.
