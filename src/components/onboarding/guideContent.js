/**
 * Static content for the Radulator User Guide.
 * Each section has an id (anchor target), title, and body paragraphs.
 */
export const guideContent = [
  {
    id: "getting-started",
    title: "Getting Started",
    body: [
      "Radulator is a suite of 38 evidence-based medical calculators spanning 11 clinical specialties, including radiology, neuroradiology, trauma surgery, cardiac imaging, breast imaging, women's imaging, hepatology, urology, interventional radiology, nephrology, and clinical decision support.",
      "To begin, select any calculator from the sidebar. On mobile devices, tap the menu icon in the top-left corner to open the navigation panel. Each calculator is grouped under its respective specialty for rapid access.",
    ],
  },
  {
    id: "navigating-calculators",
    title: "Navigating Calculators",
    body: [
      "The sidebar organizes all calculators by specialty. Categories include Radiology, Neuroradiology, Trauma, Cardiac Imaging, Breast Imaging, Women's Imaging, Clinical Decision, Hepatology/Liver, Urology, Interventional, and Nephrology.",
      "On desktop, the sidebar is always visible. On mobile, tap the hamburger menu to open it, then tap any calculator name to navigate. The sidebar closes automatically after selection.",
    ],
  },
  {
    id: "search-filtering",
    title: "Search and Tag Filtering",
    body: [
      "Use the search bar at the top of the sidebar to filter calculators by name, description, or keyword. Results update as you type.",
      'Below the search bar, tag pills provide one-tap filtering by modality or clinical domain (e.g., CT, MRI, Ultrasound, Oncology). Tap a tag to filter; tap it again or select "Clear filter" to reset.',
    ],
  },
  {
    id: "favorites-recent",
    title: "Favorites and Recent Calculators",
    body: [
      "Star any calculator by hovering over its name in the sidebar and clicking the star icon. Starred calculators appear in a dedicated Favorites section at the top of the sidebar for quick access.",
      "The Recent section displays the last five calculators you used. Both Favorites and Recent lists persist across sessions via local storage.",
    ],
  },
  {
    id: "using-calculator",
    title: "Using a Calculator",
    body: [
      "Each calculator presents a set of input fields appropriate to the clinical scenario: numeric inputs, dropdowns, radio buttons, or checkboxes. Some fields appear conditionally based on prior selections.",
      'After entering values, press the Calculate button to generate results. Certain calculators display a guideline badge (e.g., "ACR TI-RADS 2017") indicating the source classification system. An information panel below the title provides clinical context and methodology.',
    ],
  },
  {
    id: "understanding-results",
    title: "Understanding Results",
    body: [
      "Results are displayed with color-coded severity indicators: green for benign or normal findings, amber for indeterminate or moderate-risk findings, red for high-risk or malignant findings, and blue for informational or staging data. Results without a specific risk connotation appear without color.",
      "Primary results (e.g., classification, score) are displayed prominently. Secondary results (e.g., management recommendations, differential considerations) follow below.",
    ],
  },
  {
    id: "copy-print",
    title: "Copy and Print Results",
    body: [
      "After calculating, use the Copy Results button to copy a formatted text summary to your clipboard. This is suitable for pasting into reports or electronic health records.",
      "The Print Results button opens your browser's print dialog with a clean, print-optimized layout. For AVS calculators (Cortisol and Hyperaldosteronism), a CSV export option is also available for spreadsheet analysis.",
    ],
  },
  {
    id: "dark-mode",
    title: "Dark Mode",
    body: [
      "Toggle dark mode using the sun/moon icon in the sidebar header (desktop), the mobile header bar, or the footer. Dark mode uses a PACS-inspired low-luminance color scheme designed for reading-room environments.",
      "Radulator respects your system preference on first visit. Your choice persists across sessions.",
    ],
  },
  {
    id: "clinical-references",
    title: "Clinical References",
    body: [
      "Every calculator includes a references section listing the source publications, guidelines, and validation studies used in its implementation. References link directly to PubMed or DOI records.",
      'When more than three references are present, the list is initially collapsed. Click "Show all" to expand the full citation list.',
    ],
  },
];
