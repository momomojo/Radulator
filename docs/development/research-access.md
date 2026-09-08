# Reproducible research access

Development tooling for public literature only. Never enter patient identifiers,
clinical notes, calculator inputs or results.

## Discovery and retained evidence

Use PubMed MCP for discovery when loaded, official guidance/web search for society
material, and the CLI for reproducible source packets. The CLI uses Python's
standard library and NCBI E-utilities directly: no model calls or extra packages.

```sh
npm run research -- search 'ALBI grade[Title]' --limit 5
npm run research -- fetch 25512453 --expect-doi 10.1200/JCO.2014.57.9151 --full-text
npm run research -- verify /absolute/path/from/fetch/record.json
```

`fetch` prints its record path. Repeated fetches verify and reuse cached source
bytes; `--refresh` retrieves a new dated record while retaining previous records.
Cache defaults to `<git-common-directory>/radulator-research-cache`, shared by
this repository's worktrees and not automatically committed or published.
An optional `--cache-dir /absolute/local/directory` goes before the subcommand.

Packets retain exact PMID/DOI/PMCID, title/authors/date/journal, structured abstract,
publication types, correction/retraction relationships, source URL, retrieval time,
raw XML, SHA-256 and full-text availability/license. `verify` reparses identity
and checks local hashes; it does not establish freshness or clinical validity.

Clinical review still requires:

1. Read the source at exact section/table/page locators, not merely its citation
   or abstract. PubMed inclusion is not endorsement.
2. Follow relevant correction, retraction or concern PMIDs in `notices`. Preserve
   relationship direction: `RetractionIn` differs from `RetractionOf`. No notices
   means “none returned at retrieval time,” not “confirmed unretracted.”
3. Record supported population, rules, applicability and independent cases in the
   existing calculator document. Link retrieval identity and concise lawful
   excerpts; do not commit full copyrighted articles automatically.
4. Refresh relevant sources at review and re-review changed scope/content.
   Cached evidence does not preserve stale exact-head release authorization.

PMC presence does not guarantee machine-readable full text. Matching metadata-only
responses are access gaps; wrong identifiers/malformed responses fail validation.
Use legitimate publisher, repository or user-supplied sources to fill gaps. Never
bypass access controls.

## Limits, keys and provider boundaries

The CLI serializes requests across worktrees with a cache lock, paces calls below
3/second, bounds response size/time/retries and omits private request parameters
from receipts. A busy cache fails promptly; retry after that command completes.
Do not create multiple caches to evade provider limits.

An optional NCBI account key raises the default provider allowance from 3 to 10
requests/second per IP; it does **not** unlock paywalled articles. This CLI remains
conservatively paced even with a key. If needed, set `NCBI_API_KEY` and optional
registered developer contact `NCBI_EMAIL` in the host's private environment.
Do not paste keys into chat, source, Vite `.env` files, PRs or command arguments.

The `pubmed@life-sciences` plugin uses Anthropic's hosted
`https://pubmed.mcp.claude.com/mcp`. Public-query arguments reach that service.
The inspected manifest has no local hooks/executables. Its seven research tools
supplement the direct NCBI evidence path. New sessions may be necessary to load
installed tools. Do not send NCBI keys or patient information to that connector.

No extra research plugins are mandatory. Add one only for a demonstrated access
or coverage benefit. Europe PMC/Crossref are additional public discovery and
bibliographic cross-check routes, not independent clinical adjudicators.

## Official references

- [NCBI limits, keys and copyright](https://www.ncbi.nlm.nih.gov/books/NBK25497/)
- [E-utilities parameters](https://www.ncbi.nlm.nih.gov/books/NBK25499/)
- [PMC permitted automated retrieval](https://pmc.ncbi.nlm.nih.gov/tools/textmining/)
- [PMC OA service retirement](https://pmc.ncbi.nlm.nih.gov/tools/oa-service/): do not use retired `oa.fcgi`.
- [PubMed correction schema](https://dtd.nlm.nih.gov/ncbi/pubmed/doc/out/230101/el-CommentsCorrections.html)
- [PubMed connector provider/setup](https://academy.claude.com/tutorials/using-the-pubmed-connector-in-claude)
- [NLM disclaimer/copyright](https://www.ncbi.nlm.nih.gov/About/disclaimer.html)

`npm run test:research` is deterministic/network-free. Report live retrieval
separately; neither activity substitutes for source-based clinical review.
