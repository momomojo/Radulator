# Radulator 🩻

A comprehensive radiology calculator application built with React and Vite, providing accurate medical calculations for radiologists and clinicians.

## Overview

Radulator is a modern web application that replicates and enhances the functionality of popular radiology calculators. It provides six specialized calculators for common radiological measurements and assessments, each with evidence-based formulas and proper academic references.

## Features

### 📊 **Medical Calculators**

1. **Adrenal CT Washout** - Calculate absolute and relative washout percentages for adrenal lesion characterization
2. **Adrenal MRI CSI** - Signal-intensity index and adrenal-to-spleen CSI ratio calculations
3. **Prostate Volume** - Ellipsoid volume estimation and PSA-Density calculations with PI-RADS integration
4. **Renal Cyst (Bosniak CT)** - Comprehensive Bosniak classification for cystic renal lesions
5. **Spleen Size (ULN)** - Gender and height-adjusted upper limits of normal spleen measurements
6. **Hip Dysplasia** - Migration index calculations with age-specific normal values

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
   git clone <repository-url>
   cd radcalc-2.0
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

## Project Structure

```
radcalc-2.0/
├── public/                    # Static assets and reference images
│   ├── migration_index_diagram.png
│   ├── lesion_map.png
│   └── pirads_map_clone.html
├── src/
│   ├── components/
│   │   ├── calculators/       # Individual calculator components
│   │   │   ├── AdrenalCTWashout.jsx
│   │   │   ├── AdrenalMRICSI.jsx
│   │   │   ├── ProstateVolume.jsx
│   │   │   ├── RenalCystBosniak.jsx
│   │   │   ├── SpleenSizeULN.jsx
│   │   │   ├── HipDysplasiaIndices.jsx
│   │   │   └── index.js
│   │   └── ui/                # Reusable UI components (shadcn/ui)
│   ├── lib/                   # Utility functions
│   ├── App.jsx               # Main application component
│   ├── main.jsx              # Application entry point
│   └── index.css             # Global styles
├── CLAUDE.md                 # Claude Code guidance file
└── README.md                 # This file
```

## Technology Stack

- **Framework:** React 19.1.0
- **Build Tool:** Vite 7.0.4
- **Styling:** Tailwind CSS 3.4.4
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Language:** JavaScript (ES modules)

## Calculator Details

### Adrenal CT Washout
- Calculates absolute and relative washout percentages
- Helps differentiate adenomas from non-adenomas
- Based on Caoili et al. (2000), Choi et al. (2013), Park et al. (2015)

### Adrenal MRI CSI  
- Signal-intensity index calculations
- Adrenal-to-spleen CSI ratio analysis
- References: Blake et al. (2012), Schieda et al. (2017)

### Prostate Volume
- Ellipsoid formula volume estimation
- PSA-Density calculations
- Integrated PI-RADS sector map
- Based on Paterson et al. (2016), Aminsharifi et al. (2018)

### Renal Cyst (Bosniak CT)
- Comprehensive Bosniak classification system
- Multiple morphological criteria assessment
- Management recommendations included
- References: Bosniak (2005), Silverman et al. (2019)

### Spleen Size (ULN)
- Gender and height-adjusted normal values
- 95% confidence intervals
- Validation ranges for accuracy
- Based on Chow et al. (2016)

### Hip Dysplasia
- Migration index calculations with age-specific interpretation
- AC-Angle and CCD-Angle normal values
- Bilateral assessment capability
- References: Tönnis (1976, 1984), Reimers (1980)

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