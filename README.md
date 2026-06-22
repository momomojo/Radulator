# Radulator 🩻

A comprehensive radiology calculator application built with React and Vite, providing accurate medical calculations for radiologists and clinicians.

**Live site:** [radulator.com](https://radulator.com)

## Overview

Radulator is a modern web application providing evidence-based medical calculators for radiology and adjacent specialties. It features **38 specialized calculators across 11 specialty categories**, each with evidence-based formulas, proper academic references, and built-in result interpretation. Calculators are auto-discovered from their own metadata (`src/components/calculators/registry.js`), so this list always reflects the code:

## Features

### 📊 **Medical Calculators**

#### Radiology (12)
ACR TI-RADS · Adrenal CT Washout · Adrenal MRI Chemical Shift · Bosniak Classification (Renal Cysts) · DLP to Effective Dose · Fleischner 2017 Pulmonary Nodules · Hip Dysplasia · IV Contrast Dosing · Lung-RADS v2022 · Prostate Volume & PSA Density · Radiation Dose Converter · Spleen Size

#### Hepatology/Liver (9)
ALBI Score · BCLC Staging (HCC) · Child-Pugh Score · CT Severity Index (CTSI) · LI-RADS v2018 · MELD-Na Score · Milan Criteria (HCC) · MR Elastography (Liver) · Y-90 Radioembolization Dosimetry

#### Interventional (5)
Adrenal Vein Sampling – Aldosterone · Adrenal Vein Sampling – Cortisol · Goiter Symptoms · Inferior Petrosal Sinus Sampling (IPSS) · Khoury Catheter Selector

#### Urology (3)
IIEF-5 (SHIM Score) · PI-RADS v2.1 · RENAL Nephrometry Score

#### Neuroradiology (2)
ACR NI-RADS · ASPECTS Score

#### Clinical Decision (2)
Wells Criteria for DVT · Wells Criteria for PE

#### Additional specialties (5)
ACR BI-RADS (Breast Imaging) · ACR O-RADS (Women's Imaging) · CAD-RADS 2.0 (Cardiac Imaging) · Mehran CIN Risk Score (Nephrology) · AAST Trauma Grading (Trauma)

### 🎨 **User Interface**
- **Responsive Design** - Optimized for both desktop and mobile viewing
- **Modern UI Components** - Built with shadcn/ui and Tailwind CSS
- **Interactive Elements** - Radio buttons, checkboxes, and number inputs
- **Embedded Diagrams** - Visual references for measurement techniques
- **Professional Styling** - Clean, medical-grade interface design

### 📚 **Academic Integration**
- **Evidence-Based Formulas** - All calculations based on peer-reviewed studies
- **Clickable References** - Direct links to original research papers
- **Comprehensive Citations** - Full academic references with DOIs
- **Clinical Interpretations** - Built-in result interpretation and ranges

## Prerequisites

- **Node.js** (version 16.0 or higher)
- **npm** (usually comes with Node.js)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/momomojo/Radulator.git
   cd Radulator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` (or the port shown in your terminal)

## Available Scripts

- **`npm run dev`** - Start the development server with hot reload
- **`npm run build`** - Build the application for production
- **`npm run preview`** - Preview the production build locally
- **`npm run lint`** - Run ESLint to check code quality
- **`npm run test:decompose-full-suite -- <test-results/results.json>`** - Summarize Playwright JSON reporter artifacts into deterministic failure classes for bounded remediation cards

## Project Structure

```
Radulator/
├── public/                    # Static assets and reference images
├── src/
│   ├── components/
│   │   ├── calculators/       # 38 calculator components (one .jsx each)
│   │   │   ├── registry.js    # Auto-discovery via import.meta.glob
│   │   │   └── ...
│   │   └── ui/                # Reusable UI components (shadcn/ui)
│   ├── lib/                   # Utility functions
│   ├── App.jsx                # Main application component
│   ├── main.jsx               # Application entry point
│   └── index.css              # Global styles
├── docs/
│   └── ROADMAP.md             # Public development roadmap
├── CLAUDE.md                  # Claude Code guidance file
└── README.md                  # This file
```

## Technology Stack

- **Framework:** React 19.1.0
- **Build Tool:** Vite 7.0.4
- **Styling:** Tailwind CSS 3.4.4
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Language:** JavaScript (ES modules)

## Calculator Details

Every calculator self-documents in the app: formulas, peer-reviewed references with links, input validation, and clinical interpretation of results. Calculators declare their own metadata (`id`, `name`, `category`, references), and `registry.js` auto-discovers them at build time — adding a calculator is a single self-contained `.jsx` file. See the [live site](https://radulator.com) for the full interactive details of each calculator.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the public development roadmap.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Development Guidelines

- Follow the existing code structure with modular calculator components
- Ensure all medical formulas include proper references
- Maintain responsive design principles
- Test calculations against known reference values
- Update CLAUDE.md when adding new features

## Medical Disclaimer

This application is intended for educational and professional use by qualified medical professionals. All calculations should be verified independently and are not a substitute for clinical judgment. The developers assume no responsibility for medical decisions made using this software.

## License

This project is private and proprietary. All rights reserved.

## Support

For technical issues or feature requests, please contact the development team or open an issue in the repository.

---

**Radulator** - Professional radiology calculations made simple. 🩻✨
