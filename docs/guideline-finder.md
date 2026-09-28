# Guideline Finder

`public/guidelines.html` is the public Guideline Finder. For every calculator it shows:

- the guideline and version it implements;
- the official sources, linked rather than reproduced;
- Radulator's source-audit status;
- reviewed notices about those sources: corrections, retractions and newer versions.

The app footer links to it ("Guidelines").

## Where the data comes from

| Input | What it provides |
|---|---|
| `src/components/calculators/*.jsx` | id, name, category, description, keywords and tags |
| `ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json` | implemented version, sources, audit status |
| `ops/hermes/radulator/skills/radulator-operations/references/guideline-notices.json` | reviewed notices, and the date of the last currency check |

The page is generated. Do not edit it by hand:

```bash
node scripts/generate-guideline-finder.mjs          # write the page
node scripts/generate-guideline-finder.mjs --check  # fail if it is stale
```

`tests/e2e/guideline-finder.spec.js` fails if the committed page differs from the generator's output. The Full Test Suite runs it, so a registry or notices change without a regenerated page cannot pass CI.

## Keeping it current

1. **The weekly watch finds candidates.** The fleet job `radulator-guideline-currency-watch` runs every Monday at 07:00. It checks every PubMed-indexed source for retractions, expressions of concern, updates and errata, and looks for newer guideline publications on the same subject. A Jev relevance screen drops only confident non-matches. Items not seen before become one Kanban card.
2. **A reviewer decides each item.** The reviewer checks the item against the calculator and adds or updates an entry in `guideline-notices.json`. The `impact` field records the result:
   - `under-review`: the check is not finished;
   - `no-change`: the item does not change the calculator;
   - `changes-calculator`: the calculator changed. This requires its own gated change and never follows from a notice alone.
3. **Regenerate and ship.** Regenerate the page and update `currency_check.last_run`. The change goes through the normal gate.

## Privacy and safety

- The page makes no third-party requests.
- Search runs in the browser over the page's own text, so queries never leave the page.
- The Content-Security-Policy allows only the page's inline script, pinned by its SHA-256 hash.
- Without JavaScript, every entry is still listed.
- External links open with `rel="noopener noreferrer"`.
