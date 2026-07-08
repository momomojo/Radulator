import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import staticCalculatorPages from "./scripts/generate-static-pages.js";
import { injectSearchVerificationMeta } from "./scripts/search-verification-meta.mjs";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const ga4Id = env.VITE_GA4_MEASUREMENT_ID || "";
  // E2E/CI builds intentionally omit the real GA4 ID so automated visits do
  // not pollute analytics. Keep the warning for local production builds and
  // the real deploy workflow, where a missing ID would mean production tracking
  // was not injected.
  const shouldWarnMissingGa4 =
    mode === "production" &&
    (process.env.CI !== "true" ||
      process.env.GITHUB_WORKFLOW === "Deploy to GitHub Pages");

  return {
    plugins: [
      react(),
      staticCalculatorPages(),
      // Plugin to inject GA4 Measurement ID and resource hints into HTML
      {
        name: "html-transform",
        transformIndexHtml(html) {
          // Add resource hints for performance
          const resourceHints = `
    <!-- Resource Hints for Performance -->
    <link rel="dns-prefetch" href="https://www.googletagmanager.com">
    <link rel="dns-prefetch" href="https://www.google-analytics.com">
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>`;

          html = html.replace("</head>", `${resourceHints}\n  </head>`);
          html = injectSearchVerificationMeta(html, env);

          // Only inject GA4 if ID is provided and not a placeholder
          if (!ga4Id || ga4Id === "G-XXXXXXXXXX") {
            if (shouldWarnMissingGa4) {
              console.warn(
                "⚠️  GA4 Measurement ID not configured. Set VITE_GA4_MEASUREMENT_ID in .env file.",
              );
            }
            return html;
          }

          console.log(`✓ GA4 tracking enabled with ID: ${ga4Id}`);

          return html.replace(
            "<!-- GA4_PLACEHOLDER -->",
            `<!-- Google Analytics 4 -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${ga4Id}', {
        send_page_view: false // We'll handle page views manually for SPA
      });
    </script>`,
          );
        },
      },
    ],
    base: "/",
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    build: {
      // Optimize chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunk: React and core dependencies
            "vendor-react": ["react", "react-dom"],
            // UI library chunk: Radix UI primitives
            "vendor-ui": [
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "class-variance-authority",
              "clsx",
              "tailwind-merge",
            ],
          },
        },
      },
      // Target modern browsers for smaller bundles
      target: "es2020",
      // Increase warning threshold since we're code-splitting
      chunkSizeWarningLimit: 300,
    },
  };
});
