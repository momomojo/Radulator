# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
RadCalc 2.0 is a React-based medical calculator application built with Vite. It provides 18 medical calculators across radiology, hepatology/liver, and urology specialties for various clinical measurements and classifications.

## Key Commands

```bash
# Development
npm run dev          # Start development server (http://localhost:5173)

# Production Build
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint to check code quality
```

## Architecture

### Tech Stack
- **Framework**: React 19.1.0 (functional components with hooks)
- **Build Tool**: Vite 7.0.4
- **Styling**: Tailwind CSS 3.4.4 + shadcn/ui components
- **Language**: JavaScript (ES modules, no TypeScript)

### Key Directories
- `src/App.jsx` - Main application with all 18 calculator implementations
- `src/components/ui/` - shadcn/ui components (button, card, input, label, switch)
- `src/lib/utils.js` - Utility functions (primarily for className management)
- `.dev/` - Local development artifacts (tests, docs, archived files) - excluded from git

### Path Aliases
- `@/` maps to `src/` directory (configured in vite.config.js and jsconfig.json)

### Calculator Implementations
All calculators are implemented in `src/App.jsx`, organized by medical specialty:

#### Radiology (6 calculators)
1. **AdrenalCTWashout** - Calculates washout percentages for adrenal lesions
2. **AdrenalMRICSI** - MRI signal-intensity index calculations
3. **ProstateVolume** - Volume and PSA-Density calculations
4. **RenalCystBosniak** - Bosniak classification for renal cysts
5. **SpleenSizeULN** - Height/sex-adjusted spleen size limits
6. **HipDysplasiaIndices** - Reference limits for hip measurements

#### Hepatology/Liver (9 calculators)
7. **ALBIScore** - Albumin-Bilirubin grade for liver function assessment
8. **AVSCortisol** - Adrenal Vein Sampling cortisol-corrected ratios
9. **AVSHyperaldo** - Adrenal Vein Sampling for primary hyperaldosteronism
10. **BCLCStaging** - Barcelona Clinic Liver Cancer staging system
11. **ChildPugh** - Child-Pugh score for cirrhosis severity
12. **MilanCriteria** - Milan Criteria for HCC transplant eligibility
13. **MELDNa** - MELD-Na score for liver transplant prioritization
14. **MRElastography** - MR Elastography for liver fibrosis staging
15. **Y90RadiationSegmentectomy** - Y-90 Radioembolization dosimetry

#### Urology (3 calculators)
16. **IPSS** - International Prostate Symptom Score
17. **RenalNephrometry** - R.E.N.A.L. Nephrometry Score for renal masses
18. **SHIMCalculator** - SHIM Score for erectile dysfunction

### Styling Approach
- Uses Tailwind CSS with custom CSS variables for theming
- Responsive design with mobile-first approach:
  - Main containers: `max-w-4xl` for better desktop viewing
  - Grid layouts: 2-column on md+ screens, single column on mobile
  - Sidebar: Responsive width (48px on mobile, 64px on desktop)
- shadcn/ui components follow a consistent pattern with:
  - Component variants defined using `cva` (class-variance-authority)
  - Compound components pattern (e.g., Card.Header, Card.Content)
  - CSS variables for colors (e.g., `--primary`, `--background`)

### Field Types Supported
- `number` - Numeric input fields
- `date` - Date picker fields
- `select` - Dropdown with options array
- `radio` - Radio button groups with {value, label} options
- `checkbox` - Toggle switches using shadcn/ui Switch component

### Calculator Patterns & Evolution

The application has evolved from simple calculators to comprehensive clinical tools. Key patterns:

#### Enhanced Features in Newer Calculators
- **subLabel** - Provides units, ranges, and clinical guidance for inputs
- **showIf** - Conditional field display based on other inputs
- **Validation** - Comprehensive input validation with explicit error messages
- **Multi-step calculations** - Complex decision trees and intermediate values
- **Clinical context** - Extensive header comments with formulas, units, and bounds
- **Structured output** - Section separators using empty-string keys (e.g., "═══ SECTION ═══")
- **Clinical interpretation** - Detailed result explanations with management recommendations
- **Comprehensive references** - Multiple citations including original studies, validation studies, and guidelines

#### Consistency Across All Calculators
- Controlled components with React state via `vals` object
- Generic `Field` component renders all field types
- `compute` function returns result object
- State management in App.jsx (except MRElastography which uses additional `mreRows` state)

### Important Notes
- No test framework is configured - consider adding tests before major changes
- ESLint is configured but no Prettier - follow existing code formatting
- All medical formulas include references to source studies in comments
- The application uses controlled components with React state for all inputs
- Renal Cyst calculator includes comprehensive Bosniak classification with detailed options and text modules
- Spleen Size calculator includes gender-specific formulas with validation ranges and 95% confidence interpretation
- Hip Dysplasia calculator includes age/gender-specific normal values, migration index calculations, and interpretive ranges