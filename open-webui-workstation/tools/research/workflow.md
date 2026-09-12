# Research Workflow

1. Search with Exa (fallback: Tavily).
2. Inspect top relevant sources.
3. Follow links for primary evidence via Exa contents / Tavily extract.
4. Cross-check claims with at least two credible sources when practical.
5. Return answer with citations and uncertainty notes.

Implementation:
- Plugin id `research` (enabled by default)
- Browser client: `src/connectors/research/research-connector.ts`
- Same-origin proxies: `/connectors/exa/` and `/connectors/tavily/`
- Agent tools: `research.status`, `research.search`, `research.fetch`
- `research.fetch` allows public https URLs only (no localhost, private, metadata, or credentialed URLs)

Runtime secrets:
- `EXA_API_KEY` (primary)
- `TAVILY_API_KEY` (fallback)
