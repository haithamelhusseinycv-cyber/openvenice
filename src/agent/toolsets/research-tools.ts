import type { AgentTool } from '../types'
import { ResearchConnector } from '../../connectors/research/research-connector'

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
})

export function createResearchTools(connector = new ResearchConnector()): AgentTool[] {
  return [
    {
      id: 'research.status',
      name: 'Connector status',
      description: 'Show which host-side connectors are configured (GitHub, Microsoft Graph, Exa, Tavily) without exposing secrets.',
      risk: 'read',
      permissions: ['network'],
      inputSchema: objectSchema({}),
      execute: async (_input, context) => ({ ok: true, data: await connector.availability(context.signal) }),
    },
    {
      id: 'research.search',
      name: 'Search the web',
      description: 'Search with Exa, falling back to Tavily when Exa is unavailable. Requires EXA_API_KEY or TAVILY_API_KEY on the host. Returns titles, URLs, snippets, and the provider used.',
      risk: 'read',
      permissions: ['network'],
      inputSchema: objectSchema(
        {
          query: { type: 'string' },
          num_results: { type: 'integer', minimum: 1, maximum: 10 },
        },
        ['query'],
      ),
      execute: async (input, context) => {
        const value = input as { query: string; num_results?: number }
        return { ok: true, data: await connector.search(value.query, value.num_results ?? 5, context.signal) }
      },
    },
    {
      id: 'research.fetch',
      name: 'Fetch URL contents',
      description: 'Extract text from a public https URL through Exa contents, falling back to Tavily extract. Blocks localhost, private, and credentialed URLs.',
      risk: 'read',
      permissions: ['network'],
      inputSchema: objectSchema({ url: { type: 'string' } }, ['url']),
      execute: async (input, context) => {
        const value = input as { url: string }
        return { ok: true, data: await connector.fetch(value.url, context.signal) }
      },
    },
  ]
}
