import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readdirSync, readFileSync } from "fs";
import staticCalculatorPages from "./scripts/generate-static-pages.js";
import { injectSearchVerificationMeta } from "./scripts/search-verification-meta.mjs";

const calculatorDirectory = resolve(__dirname, "src/components/calculators");

function extractCalculatorMetadata(source, filename) {
  const anchor = source.search(/export\s+(?:default|const\s+\w+\s*=)\s*{/);
  const scope = anchor >= 0 ? source.slice(anchor) : source;
  const stringProperty = (key) => {
    const raw = scope.match(new RegExp(`^\\s{2}${key}:\\s*("(?:\\\\.|[^"\\\\])*")`, "m"))?.[1];
    if (!raw) throw new Error(`calculator-registry: ${filename} is missing static ${key} metadata`);
    return JSON.parse(raw);
  };
  const tagsBlock = scope.match(/^\s{2}tags:\s*\[([\s\S]*?)\],/m)?.[1] || "";
  const tags = [...tagsBlock.matchAll(/"((?:\\.|[^"\\])*)"/g)].map((match) => JSON.parse(`"${match[1]}"`));

  return {
    id: stringProperty("id"),
    name: stringProperty("name"),
    desc: stringProperty("desc"),
    metaDesc: stringProperty("metaDesc"),
    category: stringProperty("category"),
    tags,
  };
}

function calculatorRegistry() {
  const virtualId = "virtual:calculator-registry";
  const resolvedVirtualId = `\0${virtualId}`;

  return {
    name: "calculator-registry",
    resolveId(id) {
      return id === virtualId ? resolvedVirtualId : null;
    },
    load(id) {
      if (id !== resolvedVirtualId) return null;
      const calculators = readdirSync(calculatorDirectory)
        .filter((filename) => filename.endsWith(".jsx"))
        .sort()
        .map((filename) => ({
          ...extractCalculatorMetadata(
            readFileSync(resolve(calculatorDirectory, filename), "utf8"),
            filename,
          ),
          path: `/src/components/calculators/${filename}`,
        }));
      const ids = new Set(calculators.map((calculator) => calculator.id));
      if (ids.size !== calculators.length) {
        throw new Error("calculator-registry: duplicate calculator ids are not supported");
      }

      return `
        const modules = import.meta.glob("/src/components/calculators/*.jsx");
        const metadata = ${JSON.stringify(calculators)};
        export const calcDefs = metadata.map((calculator) => ({
          ...calculator,
          load: () => modules[calculator.path](),
        }));
      `;
    },
  };
}

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
      calculatorRegistry(),
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
