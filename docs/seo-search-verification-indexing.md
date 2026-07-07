# Search verification and index-ping runbook

This repo has scaffolding for Google Search Console, Bing Webmaster Tools, and post-deploy index pings. It does not complete owner verification by itself; Mohib must provide the Google/Bing verification values from the logged-in dashboards.

## Owner-gated paste point

For meta-tag verification, paste the dashboard-provided `content` values into one env block:

```bash
VITE_GOOGLE_SITE_VERIFICATION=<content from Google's google-site-verification meta tag>
VITE_BING_SITE_VERIFICATION=<content from Bing's msvalidate.01 meta tag>
```

If a dashboard provides complete meta tags instead of token values, use the single raw-meta fallback:

```bash
VITE_SEARCH_VERIFICATION_META='<meta name="google-site-verification" content="..." /><meta name="msvalidate.01" content="..." />'
```

`VITE_SEARCH_VERIFICATION_META` is intentionally allowlisted to those two meta names only. DNS TXT verification is still valid, but it is a DNS-provider change rather than a repo/env change.

## Build behavior

- `index.html` contains `<!-- SEARCH_VERIFICATION_PLACEHOLDER -->`.
- `vite.config.js` injects the verification meta tags into the root page during `npm run build`.
- `scripts/generate-static-pages.js` reads the built root page, so every generated `/calculators/<id>/index.html` inherits the same verification tags.
- Empty env values remove the placeholder and emit no verification tags, keeping local/CI builds clean.

## IndexNow endpoint

The committed public IndexNow key file is:

- Key: `676f4f3d55b393fc8961a1bc934725597854671c6688488a0d73c834e5c8b8a0`
- Key URL after deploy: `https://radulator.com/676f4f3d55b393fc8961a1bc934725597854671c6688488a0d73c834e5c8b8a0.txt`

IndexNow keys are public site-verification keys, not application secrets.

## Automated pings

`npm run index:ping` runs `scripts/ping-search-indexes.mjs`, which:

1. reads `dist/sitemap.xml` when available, or fetches the live sitemap after deploy;
2. submits sitemap URLs to IndexNow generic + Bing IndexNow endpoints;
3. sends best-effort sitemap pings to Google and Bing.

Dry-run locally after a build:

```bash
npm run build
npm run index:ping:dry-run
```

Live ping manually:

```bash
npm run index:ping -- --site-url https://radulator.com --sitemap-url https://radulator.com/sitemap.xml
```

The GitHub Pages deploy workflow runs the live ping after the Pages deployment completes. The ping is best-effort so a transient search-engine rejection cannot roll back an already-successful deploy; logs still show endpoint status codes.
