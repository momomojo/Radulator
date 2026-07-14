import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "path";
import staticCalculatorPages from "./scripts/generate-static-pages.js";
import { injectSearchVerificationMeta } from "./scripts/search-verification-meta.mjs";
import { resolveEdition } from "./scripts/resolve-edition.mjs";

const institutionalCsp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests";

function buildInstitutionalSeoBlock() {
  const description =
    "Radulator Institutional is a controlled, browser-local reference build with no approved calculators in this release.";
  return `<!-- SEO Meta Tags -->
    <meta name="description" content="${description}" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="author" content="Radulator" />
    <!-- /SEO -->`;
}

function writeInstitutionalReleaseFiles(edition) {
  return {
    name: "institutional-release-files",
    closeBundle() {
      if (edition.id !== "institutional") return;
      const outDir = resolve(__dirname, edition.outDir);
      mkdirSync(outDir, { recursive: true });
      const release = {
        edition: edition.id,
        releaseVersion: edition.releaseVersion,
        gitCommit: edition.gitCommit,
        generatedAt: new Date().toISOString(),
        calculatorAllowlist: edition.allowlist,
        calculatorAllowlistHash: edition.allowlistHash,
        validationManifestHash: edition.validationManifestHash,
        validationSchemaHash: edition.validationSchemaHash,
        releaseControls: true,
        releaseControlFile: edition.releaseControlFile,
        publicNetworkPolicy: "first-party-static-origin-only",
      };
      const control = {
        releaseVersion: edition.releaseVersion,
        disabled: false,
        disabledCalculators: [],
        message: "",
      };
      writeFileSync(
        resolve(outDir, "release.json"),
        `${JSON.stringify(release, null, 2)}\n`,
      );
      writeFileSync(
        resolve(outDir, edition.releaseControlFile),
        `${JSON.stringify(control, null, 2)}\n`,
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const edition = resolveEdition({ env });
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
      edition.staticCalculatorPages ? staticCalculatorPages() : null,
      writeInstitutionalReleaseFiles(edition),
      // Plugin to inject GA4 Measurement ID and resource hints into HTML
      {
        name: "html-transform",
        transformIndexHtml(html) {
          if (edition.id === "institutional") {
            return html
              .replace(
                /<meta http-equiv="Content-Security-Policy" content="[^"]*" \/>/,
                `<meta http-equiv="Content-Security-Policy" content="${institutionalCsp}" />`,
              )
              .replace(
                /<title>[^<]*<\/title>/,
                `<title>${edition.title}</title>`,
              )
              .replace(
                /<!-- SEO Meta Tags -->[\s\S]*?<!-- \/SEO -->/,
                buildInstitutionalSeoBlock(),
              )
              .replace("<!-- SEARCH_VERIFICATION_PLACEHOLDER -->", "")
              .replace("<!-- GA4_PLACEHOLDER -->", "");
          }

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
    publicDir: edition.publicDir,
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    build: {
      outDir: edition.outDir,
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
