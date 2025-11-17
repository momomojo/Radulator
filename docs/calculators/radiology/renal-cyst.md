# Renal Cyst (Bosniak CT) Calculator

## Overview

The Renal Cyst (Bosniak CT) Calculator implements the Bosniak classification system for cystic renal lesions based on CT imaging characteristics. This classification helps predict the likelihood of malignancy and guides clinical management decisions.

**Version**: Bosniak 2005 (CT-based classification)

**Specialty**: Radiology

**Clinical Use**: Classify cystic renal lesions to determine malignancy risk and guide follow-up vs. surgical intervention

## Medical Background

### Bosniak Classification System

The Bosniak classification was first introduced in 1986 by Dr. Morton Bosniak and has undergone several revisions, with the 2005 version being the most widely used CT-based system. The classification categorizes cystic renal masses into five categories (I, II, IIF, III, IV) based on imaging features that correlate with malignancy risk.

### Malignancy Risk by Category

| Category | Description | Malignancy Risk | Management |
|----------|-------------|-----------------|------------|
| **I** | Simple benign cyst | ~0% | No follow-up |
| **II** | Minimally complex benign cyst | <5% | No follow-up |
| **IIF** | Minimally complex requiring follow-up | 5-10% | Imaging follow-up |
| **III** | Indeterminate cystic mass | 50-55% | Surgical evaluation |
| **IV** | Clearly malignant cystic mass | >90% | Surgical resection |

*IIF = "F" stands for "follow-up"*

### Key Imaging Features

#### 1. Wall Characteristics
- **Hairline thin**: Barely visible, smooth wall
- **Minimally thick**: Smooth but slightly thickened, minimal enhancement possible
- **Thick/irregular**: Thickened with irregular contours and enhancement

#### 2. Septa (Internal Divisions)
- **None**: No internal divisions
- **Few, hairline thin**: Minimal thin separations, no enhancement
- **Thick**: Multiple or thickened septa, minimal enhancement possible
- **Thickened/irregular**: Thick, irregular septa with enhancement

#### 3. Calcifications
- **None**: No calcifications
- **Fine/sheet-like**: Thin, curvilinear, or sheet-like calcifications
- **Thick/nodular**: Thick, nodular, or irregular calcifications

#### 4. Density/Attenuation
- **Water density**: 0-20 Hounsfield Units (HU)
- **High attenuation**: >20 HU (may indicate proteinaceous or hemorrhagic content)

#### 5. Size and Location
- **Size**: Cysts ≥3 cm may require follow-up
- **Totally intrarenal**: Completely within kidney parenchyma (vs. exophytic)

#### 6. Soft Tissue Enhancement
- **Present**: Enhancing soft tissue component (indicates malignancy)
- **Absent**: No enhancing soft tissue

## Calculator Implementation

### Input Fields

| Field | Type | Options | Clinical Significance |
|-------|------|---------|----------------------|
| **Walls** | Radio | hairline-thin / minimally-thick / thick-irregular | Wall thickness and enhancement indicate complexity |
| **Septa** | Radio | no / few-thin / thick / thickened-irregular | Septal characteristics suggest benign vs. malignant |
| **Calcifications** | Radio | no / fine / thick-nodular | Calcification pattern affects classification |
| **Density** | Radio | water / high (>20 HU) | High attenuation requires follow-up |
| **Totally intrarenal** | Checkbox | yes / no | Intrarenal location is IIF criterion |
| **≥3cm size** | Checkbox | yes / no | Large size requires follow-up |
| **Enhancing soft tissue** | Radio | yes / no | Soft tissue = malignancy |

### Classification Logic

The calculator uses a hierarchical decision tree:

1. **Category IV** (Highest priority): Enhancing soft tissue present → Malignant
2. **Category III**: Thick irregular walls OR thickened irregular septa OR thick nodular calcifications → Indeterminate
3. **Category IIF**: Minimally thick walls OR thick septa OR high attenuation OR totally intrarenal OR ≥3cm → Follow-up needed
4. **Category II**: Few thin septa OR fine calcifications → Benign, no follow-up
5. **Category I** (Default): Simple cyst with none of the above features

### Output

The calculator provides:

1. **Bosniak Category** (I, II, IIF, III, or IV)
2. **Management Recommendation**
   - Category I/II: "No follow up needed"
   - Category IIF: "Follow up recommended"
   - Category III/IV: "Surgical resection"
3. **Text Module** (Category I only): Pre-formatted radiology report text

## Clinical Guidelines

### Follow-up Protocol for Category IIF

Recommended imaging follow-up schedule:
- **Initial**: CT or MRI at 6 months
- **Subsequent**: Annually for 5 years
- **Stable lesions**: Can discontinue follow-up after 5 years

### Surgical Management

- **Category III**: Surgical consultation recommended; 50% are malignant
- **Category IV**: Surgical resection indicated; >90% are malignant

### Important Considerations

1. **MRI vs. CT**: The 2005 Bosniak classification is CT-based. For MRI evaluation, use the Bosniak MRI criteria (version 2019).

2. **High-attenuation cysts**: A homogeneous mass ≥70 HU at unenhanced CT is consistent with a high-attenuation benign renal cyst (proteinaceous or hemorrhagic content).

3. **Enhancement assessment**: Use pre- and post-contrast images to assess for enhancement (≥15-20 HU increase suggests enhancement).

4. **Interreader variability**: The Bosniak classification has known interreader variability, particularly for Categories IIF and III.

## Test Cases

### Category I - Simple Cyst
```javascript
{
  walls: "hairline-thin",
  septa: "no",
  calcs: "no",
  density: "water",
  intrarenal: false,
  large: false,
  soft: "no"
}
// Expected: Category I, "No follow up needed"
```

### Category II - Minimally Complex Benign
```javascript
{
  walls: "hairline-thin",
  septa: "few-thin",
  calcs: "no",
  density: "water",
  intrarenal: false,
  large: false,
  soft: "no"
}
// Expected: Category II, "No follow up needed"
```

### Category IIF - High Attenuation
```javascript
{
  walls: "hairline-thin",
  septa: "no",
  calcs: "no",
  density: "high",  // >20 HU
  intrarenal: false,
  large: false,
  soft: "no"
}
// Expected: Category IIF, "Follow up recommended"
```

### Category III - Irregular Walls
```javascript
{
  walls: "thick-irregular",
  septa: "no",
  calcs: "no",
  density: "water",
  intrarenal: false,
  large: false,
  soft: "no"
}
// Expected: Category III, "Surgical resection"
```

### Category IV - Enhancing Soft Tissue
```javascript
{
  walls: "hairline-thin",
  septa: "no",
  calcs: "no",
  density: "water",
  intrarenal: false,
  large: false,
  soft: "yes"  // Malignant
}
// Expected: Category IV, "Surgical resection"
```

## Known Issues and Limitations

### Critical Bugs Identified

1. **Logic Error in Category II Classification** (Line 110):
   ```javascript
   // CURRENT (INCORRECT):
   else if (
     walls !== "hairline-thin" ||  // ❌ BUG: Catches ALL non-hairline walls
     septa === "few-thin" ||
     calcs === "fine"
   )
   ```

   **Issue**: The condition `walls !== "hairline-thin"` will incorrectly classify cysts with `minimally-thick` or `thick-irregular` walls as Category II, when they should be IIF or III respectively.

   **Impact**: Cysts that should be classified as IIF or III may be incorrectly classified as Category II, potentially leading to inadequate follow-up.

   **Suggested Fix**: Remove the wall condition from Category II logic, as wall thickness is already handled in IIF/III logic:
   ```javascript
   // SUGGESTED FIX:
   else if (
     septa === "few-thin" ||
     calcs === "fine"
   )
   ```

2. **Missing Text Modules**: Text modules are only generated for Category I. Categories II, IIF, III, and IV do not have pre-formatted report text.

3. **Checkbox UI Pattern**: The `intrarenal` and `large` fields use a checkbox with nested radio buttons (`subFields`), which is an uncommon UI pattern that may confuse users.

### Limitations

1. **Version**: Implements Bosniak 2005 (CT) classification, not the newer 2019 version that incorporates MRI criteria
2. **No Category V**: The 2019 version introduced Category V, not supported here
3. **No validation**: Missing required field validation
4. **No input constraints**: No range validation for HU values or size measurements

## References

### Primary Literature

1. **Bosniak MA**. The current radiological approach to renal cysts. *Radiology*. 2005 Jul;236(1):33-42.
   - DOI: [10.1148/radiol.2362040218](https://doi.org/10.1148/radiol.2362040218)
   - **Description**: Original 2005 update of the Bosniak classification system

2. **Silverman SG, Pedrosa I, Ellis JH, et al.** Bosniak Classification of Cystic Renal Masses, Version 2019: An Update Proposal and Needs Assessment. *Radiology*. 2019 Aug;292(2):475-488.
   - DOI: [10.1148/radiol.2019182646](https://doi.org/10.1148/radiol.2019182646)
   - **Description**: 2019 update incorporating MRI criteria (referenced in calculator info text)

### Supporting Literature

3. **Israel GM, Bosniak MA**. How I do it: evaluating renal masses. *Radiology*. 2005 Jul;236(2):441-450.
   - **Description**: Practical application of Bosniak classification

4. **O'Malley RL, Godoy G, Hecht EM, et al.** Bosniak category IIF designation and surgery for complex renal cysts. *J Urol*. 2009 Mar;181(3):1091-5.
   - **Description**: Outcomes of Category IIF cysts

5. **Smith AD, Remer EM, Cox KL, et al.** Bosniak category IIF and III cystic renal lesions: outcomes and associations. *Radiology*. 2012 Mar;262(1):152-60.
   - **Description**: Natural history and malignancy rates

## File Locations

- **Calculator Implementation**: `/Users/momomojo/Documents/Radulator/src/components/calculators/RenalCystBosniak.jsx`
- **Test Specification**: `/Users/momomojo/Documents/Radulator/tests/e2e/calculators/radiology/renal-cyst.spec.js`
- **Test Data**: `/Users/momomojo/Documents/Radulator/.dev/test-data/renal-cyst-bosniak-test-cases.json`
- **Documentation**: `/Users/momomojo/Documents/Radulator/docs/calculators/radiology/renal-cyst.md`

## Changelog

### Version History

- **v1.0** (Initial): Implemented Bosniak 2005 CT classification with 5 categories
- **Known Issues**: Logic bug in Category II classification (documented above)

## Future Enhancements

1. **Fix Category II logic bug** to prevent misclassification
2. **Add text modules** for all categories (II, IIF, III, IV)
3. **Implement Bosniak 2019** version with MRI support
4. **Add input validation** for required fields
5. **Improve UI** for intrarenal/large checkbox fields
6. **Add visual diagrams** showing example cysts for each category
7. **Include malignancy percentages** in results display
8. **Add follow-up schedule** for Category IIF results

---

**Last Updated**: 2025-11-16

**Reviewer**: QA Testing - Radulator Project

**Status**: ⚠️ Active with known bugs - requires code review and fixes before production deployment
