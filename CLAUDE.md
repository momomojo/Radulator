# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Radulator** (RadCalc 2.0) is a comprehensive React-based medical calculator web application built with Vite. It provides **23 medical calculators** across radiology, hepatology/liver, urology, and interventional specialties for various clinical measurements, classifications, and decision support.

**Repository:** https://github.com/momomojo/Radulator.git

## Key Commands

```bash
# Development
npm run dev          # Start development server (http://localhost:5173)

# Production Build
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build
npm run deploy       # Build + deploy to GitHub Pages

# Code Quality
npm run lint         # Run ESLint to check code quality

# Testing (Playwright E2E)
npm run test              # Run all tests
npm run test:headed       # Run with browser visible
npm run test:debug        # Debug mode
npm run test:ui           # Interactive UI mode
npm run test:report       # View HTML test report
npm run test:smoke        # Smoke tests only
npm run test:calculator   # Calculator tests only
npm run test:chromium     # Chrome only
npm run test:firefox      # Firefox only
npm run test:webkit       # Safari only
npm run test:mobile       # Mobile browsers only
```

## Architecture

### Tech Stack

- **Framework**: React 19.1.0 (functional components with hooks)
- **Build Tool**: Vite 7.0.4
- **Styling**: Tailwind CSS 3.4.4 + shadcn/ui components
- **Language**: JavaScript (ES modules, no TypeScript)
- **Testing**: Playwright E2E (multi-browser, multi-device)
- **Analytics**: Google Analytics 4 (optional)
- **Deployment**: GitHub Pages via GitHub Actions

### Project Structure

```
radcalc-2.0/
├── .github/workflows/     # CI/CD (deploy.yml)
├── public/                # Static assets, images, CNAME
├── src/
│   ├── App.jsx           # Main application
│   ├── components/
│   │   ├── calculators/  # 23 calculator definitions
│   │   │   └── index.js  # Barrel export
│   │   └── ui/           # shadcn/ui components
│   └── lib/
│       ├── utils.js      # cn() className helper
│       └── analytics.js  # GA4 tracking functions
├── tests/
│   ├── e2e/              # Playwright test suites
│   │   └── calculators/  # Tests by specialty
│   ├── fixtures/         # Test data (JSON)
│   └── helpers/          # Test utilities
├── docs/                 # Documentation
├── playwright.config.js  # Test configuration
├── Dockerfile.dev        # Docker dev container
└── docker-compose.test.yml
```

### Path Aliases

- `@/` maps to `src/` directory (configured in vite.config.js and jsconfig.json)

## Calculator Implementations

All calculators are defined in `src/components/calculators/` and imported into `src/App.jsx`. Organized by medical specialty:

### Radiology (8 calculators)

1. **AdrenalCTWashout** - Calculates absolute/relative washout percentages for adrenal lesions
2. **AdrenalMRICSI** - MRI signal-intensity index and adrenal-to-spleen ratios
3. **Fleischner** - 2017 Fleischner Society pulmonary nodule follow-up guidelines
4. **ProstateVolume** - Volume (ellipsoid formula) and PSA-Density calculations
5. **RenalCystBosniak** - Bosniak classification for cystic renal lesions (I, II, IIF, III, IV)
6. **SpleenSizeULN** - Height/sex-adjusted spleen size limits (Chow et al. 2016)
7. **HipDysplasiaIndices** - Age/gender-specific normal values and migration indices
8. **TIRADS** - ACR TI-RADS thyroid nodule risk stratification with FNA recommendations

### Hepatology/Liver (9 calculators)

9. **ALBIScore** - Albumin-Bilirubin grade for liver function in HCC (SI/US units)
10. **AVSCortisol** - Adrenal Vein Sampling for ACTH-independent hypercortisolism (custom component)
11. **AVSHyperaldo** - Adrenal Vein Sampling for primary hyperaldosteronism (custom component)
12. **BCLCStaging** - Barcelona Clinic Liver Cancer staging with treatment recommendations
13. **ChildPugh** - Child-Pugh score (A/B/C) for cirrhosis severity
14. **MilanCriteria** - Milan and UCSF criteria for HCC transplant eligibility
15. **MELDNa** - MELD-Na score for liver transplant prioritization
16. **MRElastography** - Area-weighted mean liver stiffness across ROIs (dynamic rows)
17. **Y90RadiationSegmentectomy** - Y-90 Radioembolization dosimetry calculations

### Urology (4 calculators)

18. **IPSS** - Inferior Petrosal Sinus Sampling (dynamic post-CRH samples)
19. **PIRADS** - PI-RADS v2.1 prostate MRI risk stratification
20. **RenalNephrometry** - R.E.N.A.L. Nephrometry Score for renal mass complexity
21. **SHIMCalculator** - SHIM/IIEF-5 Score for erectile dysfunction assessment

### Interventional (1 calculator)

22. **KhouryCatheterSelector** - Interactive microcatheter selection tool

### Feedback

23. **FeedbackForm** - User feedback collection via Formspree (custom component)

## Calculator Definition Pattern

Each calculator exports a constant object with this structure:

```javascript
export const CalculatorName = {
  id: "unique-kebab-case-id",
  name: "Display Name",
  desc: "Short description",
  info: { text: "...", link?: {...}, image?: "..." },
  fields: [...],              // Array of field definitions
  compute: (values) => {...}, // Function returning results object
  refs: [{ t: "Title", u: "URL" }], // Array of references

  // Optional for custom components:
  isCustomComponent: true,
  Component: function() {...}
}
```

### Field Types Supported

- `number` - Numeric input fields
- `date` - Date picker fields
- `textarea` - Multi-line text input
- `select` - Dropdown with options array
- `radio` - Radio button groups with {value, label} options
- `checkbox` - Toggle switches using shadcn/ui Switch component

### Field Properties

- `id` - Unique field identifier
- `label` - Display label
- `subLabel` - Hint/unit text (gray)
- `type` - Field type
- `opts` - Options array (for select/radio)
- `showIf` - Conditional rendering function: `(vals) => boolean`
- `group` - Field grouping (used in Hip Dysplasia)

### Custom Components

Three calculators use `isCustomComponent: true` for complex UIs:

- **AVSCortisol** - Dynamic multi-sample management, unit conversion, CSV export
- **AVSHyperaldo** - Similar to AVSCortisol
- **FeedbackForm** - Formspree integration

### Dynamic Row Patterns

Two calculators manage dynamic rows in App.jsx state:

- **MRElastography** - `mreRows` state for ROI management
- **IPSS** - `ipssRows` state for post-CRH samples

## UI Components (shadcn/ui)

Located in `src/components/ui/`:

- **Button** - CVA-based variants (default, destructive, outline, secondary, ghost, link)
- **Card** - Compound component (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- **Input** - Full-width responsive input with focus ring
- **Label** - Accessible form labels
- **Switch** - Toggle switch (Radix UI based)

### Styling Approach

- Tailwind CSS with CSS variables for theming (dark mode support)
- Responsive design: single column mobile, 2-column desktop
- Sidebar: `w-48` (mobile) → `w-64` (desktop)
- Main content: `max-w-4xl` with centered layout
- Color palette: gray-600 primary, blue-600 accents

## Testing Infrastructure

### Framework: Playwright

- **Configuration**: `playwright.config.js`
- **Test Location**: `tests/e2e/`
- **Coverage**: All 20 calculators

### Browser/Device Coverage

- Desktop: Chromium, Firefox, WebKit
- Mobile: Chrome (Pixel 5), Safari (iPhone 12)

### Test Features

- Parallel execution
- Screenshots/video on failure
- HTML, List, and JSON reporters
- Auto-starts dev server
- 2 retries on CI

### Test Organization

```
tests/
├── e2e/calculators/
│   ├── radiology/        # 6 test files
│   ├── hepatology/       # 9 test files
│   ├── urology/          # 3 test files
│   └── interventional/   # 1 test file
├── fixtures/             # JSON test data
├── helpers/
│   └── calculator-test-helper.js  # Reusable utilities
└── test-data/            # Additional test datasets
```

### Test Helper Functions

- `navigateToCalculator(page, name)` - Navigate to calculator
- `fillInput(page, label, value)` - Fill form fields
- `verifyResult(page, label, expected)` - Verify calculations
- `verifyCalculationAccuracy(page, results, tolerance)` - Accuracy testing
- `verifyMobileResponsive(page)` - Responsive testing

## Deployment Protection & Testing Verification

### CRITICAL: Branch Protection Rules

**NEVER push directly to main.** This application is used by radiology professionals in clinical settings. All changes must be:

1. Developed on a feature branch (e.g., `feature/new-calculators-seo`)
2. Tested with Playwright E2E tests (`npm run test`)
3. Visually verified with Agent Browser skill (dev-browser)
4. Logged in `tests/TESTING_VERIFICATION_DIR.md`
5. Only merged to main after full regression pass

### Testing Verification Workflow

```
Feature Branch → Playwright Tests → Agent Browser Verification → Report Logged → PR → Merge to Main
```

### Verification Tracking

All test results are tracked in `tests/TESTING_VERIFICATION_DIR.md`:

- **Calculator Coverage Matrix**: Which calculators have Playwright tests + Agent Browser verification
- **SEO/Infrastructure Verification**: Static files, schema, meta tags
- **Reports Log**: Date, branch, tester, tool, scope, result, report file path
- **Regression Checklist**: Pre-merge requirements

### Agent Browser Testing

Use the `dev-browser` skill for visual verification:

- Navigate to each calculator on the dev server
- Fill in test values and verify outputs render correctly
- Check mobile responsiveness
- Verify SEO elements (view-source for meta tags, schema)
- Screenshot evidence saved to `tests/reports/`

### Report Files

All verification reports go in `tests/reports/` with naming convention:

```
tests/reports/YYYY-MM-DD-<branch>-<scope>.md
```

Example: `tests/reports/2026-01-20-feature-new-calculators-tirads.md`

After each verification session, update `tests/TESTING_VERIFICATION_DIR.md` with the report entry.

## CI/CD & Deployment

### GitHub Actions (`.github/workflows/deploy.yml`)

- **Trigger**: Push to `main` branch
- **Process**: Install → Build → Deploy to GitHub Pages
- **Node**: v20
- **Output**: `dist/` folder deployed automatically

### Environment Variables

- `VITE_GA4_MEASUREMENT_ID` - Google Analytics 4 measurement ID (optional)

## Analytics (Google Analytics 4)

Located in `src/lib/analytics.js`. Tracked events:

- `calculator_selected` - User selects a calculator
- `calculation_performed` - Calculation executed (success/error)
- `file_download` - CSV downloads
- `outbound_link_click` - Reference link clicks
- `feedback_submitted` - Feedback form submissions

Analytics auto-disabled in development mode.

## Docker Support

For QA testing environment:

- `Dockerfile.dev` - Development container
- `docker-compose.test.yml` - Test service configuration
- `.mcp.json` - MCP Docker gateway configuration

```bash
docker-compose -f docker-compose.test.yml up
```

## Calculator Complexity Levels

**Simple** (2-4 numeric inputs):

- Adrenal CT Washout, Adrenal MRI CSI, Prostate Volume

**Moderate** (5-8 fields with radio/select):

- Child-Pugh, ALBI Score, SHIM, RENAL Nephrometry

**Complex** (10+ fields with conditionals):

- BCLC Staging, Milan Criteria, Renal Cyst Bosniak

**Very Complex** (custom components with state):

- AVS Cortisol, AVS Hyperaldosteronism, IPSS, MR Elastography

## Important Notes

- **Testing**: Comprehensive Playwright E2E testing is configured - run `npm test` before major changes
- **ESLint**: Configured but no Prettier - follow existing code formatting
- **Medical Accuracy**: All formulas include references to source studies in comments
- **State Management**: Controlled components via `vals` object in App.jsx
- **Adding Calculators**: Create `.jsx` in `src/components/calculators/`, export from `index.js`, add to `calcDefs` array and `categories` object in App.jsx
- **References**: All calculators include `refs` array with academic citations (PubMed, DOI links)
- **Custom Components**: Use `isCustomComponent: true` for calculators needing complex UI beyond the standard field system

## Project Planning System

### Location

All planning artifacts are in `.dev/planning/` (gitignored, local only):

- **ROADMAP.yaml**: Master task tree with all planned work
- **ROLES.md**: Role definitions (@human, @claude, @agent:\*, etc.)
- **DECISIONS.md**: Key decisions with rationale
- **archive/**: Completed work organized by month

### Quick Commands

- `/roadmap-status` - Get current progress report
- `/roadmap-add <task>` - Add a new task

### Task Workflow

1. Tasks are defined in `ROADMAP.yaml` with status, priority, assignee, effort
2. Mark tasks `in_progress` when starting
3. Mark tasks `completed` with `completed_date` when done
4. Periodically archive completed items

### Roles

- **@human**: Decisions, external accounts, medical expertise
- **@claude**: Code, documentation, implementation
- **@agent:explore**: Research, codebase analysis
- **@agent:business**: Market research, competitive analysis
- **@agent:architect**: System design
- **@tool:playwright**: Test execution

### Skills Available

- `roadmap-manager`: Task management operations
- `analytics-review`: Traffic and metrics analysis (requires GA4 MCP)
- `seo-audit`: Search optimization checks

## Autonomous Operation Authority

### Surrogate Decision-Maker

The project owner (@human / Mohib) has granted Claude surrogate decision-making authority for this project. This means:

1. **Continue working autonomously** after completing tasks
2. **Make judgment calls** on next priorities based on project goals
3. **Log decisions** in `.dev/decision-logs/` (one sentence per major decision)
4. **Stop and ask** only for:
   - Decisions requiring human credentials/accounts
   - Medical accuracy validation
   - Significant architectural changes
   - Anything with financial implications

### Decision Framework

When deciding what to do next, ask: "What would Mohib want me to do?"

Priority order:

1. Critical blockers (things preventing progress)
2. High-priority tasks from ROADMAP.yaml
3. Tasks that unblock other work
4. Quality improvements
5. Future planning

### Decision Logging

Location: `.dev/decision-logs/YYYY-MM-DD.md`

Format: One sentence per decision, append-only.

```
- Chose to implement meta descriptions before sitemap because they provide immediate SEO value.
- Started legal-001 (disclaimer) as it blocks AdSense application.
```

Keep sparse. Only log non-obvious decisions.

## Weekly Agent System

### Purpose

Automated weekly analysis to:

1. Discover new task opportunities
2. Research competitive landscape
3. Identify technical improvements
4. Keep the project growing even when @human is busy

### Schedule

Run weekly (Sundays) or when @human requests: `/run-weekly-agents`

### Agent Team

1. **@agent:explore** - Codebase analysis
   - Find technical debt
   - Identify missing tests
   - Spot improvement opportunities

2. **@agent:business** - Market research
   - Check competitor updates (MDCalc, etc.)
   - Research new calculator ideas
   - Find backlink opportunities

3. **@agent:architect** - System design
   - Review architecture for scale
   - Suggest infrastructure improvements
   - Plan for growth milestones

### Output Location

`.dev/agent-runs/YYYY-MM-DD-weekly.md`

Contents:

- Date and agents run
- Discoveries (bulleted)
- Tasks added to ROADMAP.yaml
- Infrastructure changes made
- Recommendations for @human

### Verification

After each run:

1. Check `.dev/agent-runs/` for new report
2. Review ROADMAP.yaml for new tasks
3. Validate no breaking changes via `npm test`

### Triggering

```
/run-weekly-agents
```

Or Claude may run proactively if:

- More than 7 days since last run
- Significant milestone completed
- @human requests strategic review
