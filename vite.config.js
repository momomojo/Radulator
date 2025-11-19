import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  const ga4Id = env.VITE_GA4_MEASUREMENT_ID || '';

  return {
    plugins: [
      react(),
      // Plugin to inject GA4 Measurement ID into HTML
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          // Only inject GA4 if ID is provided and not a placeholder
          if (!ga4Id || ga4Id === 'G-XXXXXXXXXX') {
            console.warn('⚠️  GA4 Measurement ID not configured. Set VITE_GA4_MEASUREMENT_ID in .env file.');
            return html;
          }

          console.log(`✓ GA4 tracking enabled with ID: ${ga4Id}`);

          return html.replace(
            '<!-- GA4_PLACEHOLDER -->',
            `<!-- Google Analytics 4 -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${ga4Id}', {
        send_page_view: false // We'll handle page views manually for SPA
      });
    </script>`
          );
        }
      }
    ],
    base: '/',
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
  };
});
