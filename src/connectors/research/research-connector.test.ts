import { describe, expect, it } from 'vitest'
import type { ConnectorHttpTransport, HttpRequestOptions, SseMessage, BinaryHttpResponse } from '../http-transport'
import { assertPublicHttpsUrl, ResearchConnector } from './research-connector'

class ScriptedTransport implements ConnectorHttpTransport {
  readonly calls: Array<{ url: string; options?: HttpRequestOptions }> = []
  private readonly responses: Record<string, unknown>
  constructor(responses: Record<string, unknown>) {
    this.responses = responses
  }
  async requestJson<T>(url: string, options?: HttpRequestOptions): Promise<T> {
    this.calls.push({ url, options })
    const key = Object.keys(this.responses).find((candidate) => url.startsWith(candidate) || url === candidate)
    if (!key) throw new Error(`unexpected url ${url}`)
    const payload = this.responses[key]
    if (payload instanceof Error) throw payload
    return payload as T
  }
  requestBinary(): Promise<BinaryHttpResponse> {
    throw new Error('not implemented')
  }
  async *requestSse(): AsyncGenerator<SseMessage, void, void> {}
}

describe('assertPublicHttpsUrl', () => {
  it('allows public https URLs', () => {
    expect(assertPublicHttpsUrl('https://example.com/path').hostname).toBe('example.com')
  })

  it('rejects private, loopback, and credentialed URLs', () => {
    expect(() => assertPublicHttpsUrl('http://example.com')).toThrow(/https/)
    expect(() => assertPublicHttpsUrl('https://127.0.0.1/secret')).toThrow(/Private/)
    expect(() => assertPublicHttpsUrl('https://192.168.0.5/x')).toThrow(/Private/)
    expect(() => assertPublicHttpsUrl('https://169.254.169.254/latest')).toThrow(/Private/)
    expect(() => assertPublicHttpsUrl('https://user:pass@example.com')).toThrow(/credentials/)
  })
})

describe('ResearchConnector', () => {
  it('uses Exa first and returns compact hits', async () => {
    const transport = new ScriptedTransport({
      '/connectors/status': { github: false, graph: false, exa: true, tavily: true },
      '/connectors/exa/search': {
        results: [{ title: 'Exa', url: 'https://example.com', text: 'hello' }],
      },
    })
    const connector = new ResearchConnector({ transport })
    const hits = await connector.search('shahy connectors')
    expect(hits).toEqual([{ title: 'Exa', url: 'https://example.com', snippet: 'hello', provider: 'exa' }])
    expect(transport.calls.some((call) => call.url === '/connectors/tavily/search')).toBe(false)
  })

  it('falls back to Tavily when Exa fails', async () => {
    const transport = new ScriptedTransport({
      '/connectors/status': { exa: true, tavily: true },
      '/connectors/exa/search': new Error('HTTP 503'),
      '/connectors/tavily/search': {
        results: [{ title: 'Tavily', url: 'https://example.org', content: 'fallback' }],
      },
    })
    const connector = new ResearchConnector({ transport })
    const hits = await connector.search('openvenice')
    expect(hits[0]).toMatchObject({ provider: 'tavily', url: 'https://example.org' })
  })

  it('fails closed when no research provider is configured', async () => {
    const transport = new ScriptedTransport({
      '/connectors/status': { github: true, graph: false, exa: false, tavily: false },
    })
    const connector = new ResearchConnector({ transport })
    await expect(connector.search('anything')).rejects.toThrow(/not configured/)
  })

  it('blocks fetch of private hosts before calling a provider', async () => {
    const transport = new ScriptedTransport({
      '/connectors/status': { exa: true, tavily: false },
    })
    const connector = new ResearchConnector({ transport })
    await expect(connector.fetch('https://127.0.0.1/latest')).rejects.toThrow(/Private/)
    expect(transport.calls).toHaveLength(0)
  })
})
