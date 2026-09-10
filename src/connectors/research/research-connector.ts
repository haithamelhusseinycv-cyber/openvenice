import type { ConnectorHttpTransport } from '../http-transport'
import { FetchHttpTransport } from '../http-transport'

export interface ResearchConnectorOptions {
  statusUrl?: string
  exaBaseUrl?: string
  tavilyBaseUrl?: string
  transport?: ConnectorHttpTransport
}

export interface ConnectorAvailability {
  github: boolean
  graph: boolean
  exa: boolean
  tavily: boolean
}

export interface ResearchHit {
  title: string
  url: string
  snippet?: string
  provider: 'exa' | 'tavily'
}

export interface ResearchDocument {
  url: string
  title?: string
  text: string
  provider: 'exa' | 'tavily'
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|0\.|192\.168\.|169\.254\.|::1$|0\.0\.0\.0$)/i
const PRIVATE_172 = /^172\.(1[6-9]|2\d|3[0-1])\./

function trimBase(value: string) {
  return value.replace(/\/+$/, '')
}

export function assertPublicHttpsUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid URL')
  }
  if (url.protocol !== 'https:') throw new Error('Only https URLs are allowed')
  if (url.username || url.password) throw new Error('URLs with credentials are not allowed')
  const host = url.hostname.toLowerCase()
  if (host.endsWith('.local') || host.endsWith('.localhost') || host === 'metadata.google.internal') {
    throw new Error('Private or metadata hosts are not allowed')
  }
  if (PRIVATE_HOST.test(host) || PRIVATE_172.test(host)) {
    throw new Error('Private or loopback hosts are not allowed')
  }
  return url
}

export class ResearchConnector {
  readonly statusUrl: string
  readonly exaBaseUrl: string
  readonly tavilyBaseUrl: string
  private readonly transport: ConnectorHttpTransport

  constructor(options: ResearchConnectorOptions = {}) {
    this.statusUrl = options.statusUrl || '/connectors/status'
    this.exaBaseUrl = trimBase(options.exaBaseUrl || '/connectors/exa')
    this.tavilyBaseUrl = trimBase(options.tavilyBaseUrl || '/connectors/tavily')
    this.transport = options.transport || new FetchHttpTransport()
  }

  async availability(signal?: AbortSignal): Promise<ConnectorAvailability> {
    try {
      const data = await this.transport.requestJson<Partial<ConnectorAvailability>>(this.statusUrl, { signal })
      return {
        github: Boolean(data.github),
        graph: Boolean(data.graph),
        exa: Boolean(data.exa),
        tavily: Boolean(data.tavily),
      }
    } catch {
      return { github: false, graph: false, exa: false, tavily: false }
    }
  }

  async search(query: string, numResults = 5, signal?: AbortSignal): Promise<ResearchHit[]> {
    const availability = await this.availability(signal)
    if (availability.exa) {
      try {
        return await this.searchExa(query, numResults, signal)
      } catch (error) {
        if (!availability.tavily) throw error
      }
    }
    if (availability.tavily) return this.searchTavily(query, numResults, signal)
    throw new Error('Research connector is not configured. Set EXA_API_KEY or TAVILY_API_KEY on the OpenVenice host.')
  }

  async fetch(url: string, signal?: AbortSignal): Promise<ResearchDocument> {
    const safe = assertPublicHttpsUrl(url)
    const availability = await this.availability(signal)
    if (availability.exa) {
      try {
        return await this.fetchExa(safe.toString(), signal)
      } catch (error) {
        if (!availability.tavily) throw error
      }
    }
    if (availability.tavily) return this.fetchTavily(safe.toString(), signal)
    throw new Error('Research fetch is not configured. Set EXA_API_KEY or TAVILY_API_KEY on the OpenVenice host.')
  }

  private async searchExa(query: string, numResults: number, signal?: AbortSignal): Promise<ResearchHit[]> {
    const data = await this.transport.requestJson<{
      results?: Array<{ title?: string; url?: string; text?: string; summary?: string }>
    }>(`${this.exaBaseUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        numResults,
        type: 'auto',
        contents: { text: { maxCharacters: 1200 } },
      }),
      signal,
    })
    return (data.results || [])
      .filter((item) => item.url)
      .map((item) => ({
        title: item.title || item.url || '',
        url: item.url as string,
        snippet: item.summary || item.text,
        provider: 'exa' as const,
      }))
  }

  private async searchTavily(query: string, numResults: number, signal?: AbortSignal): Promise<ResearchHit[]> {
    const data = await this.transport.requestJson<{
      results?: Array<{ title?: string; url?: string; content?: string }>
    }>(`${this.tavilyBaseUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, max_results: numResults, include_answer: false }),
      signal,
    })
    return (data.results || [])
      .filter((item) => item.url)
      .map((item) => ({
        title: item.title || item.url || '',
        url: item.url as string,
        snippet: item.content,
        provider: 'tavily' as const,
      }))
  }

  private async fetchExa(url: string, signal?: AbortSignal): Promise<ResearchDocument> {
    const data = await this.transport.requestJson<{
      results?: Array<{ url?: string; title?: string; text?: string }>
    }>(`${this.exaBaseUrl}/contents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url], text: { maxCharacters: 8000 } }),
      signal,
    })
    const item = data.results?.[0]
    if (!item?.text) throw new Error('Exa returned no extractable text for that URL')
    return { url: item.url || url, title: item.title, text: item.text, provider: 'exa' }
  }

  private async fetchTavily(url: string, signal?: AbortSignal): Promise<ResearchDocument> {
    const data = await this.transport.requestJson<{
      results?: Array<{ url?: string; title?: string; raw_content?: string; content?: string }>
    }>(`${this.tavilyBaseUrl}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] }),
      signal,
    })
    const item = data.results?.[0]
    const text = item?.raw_content || item?.content
    if (!text) throw new Error('Tavily returned no extractable text for that URL')
    return { url: item?.url || url, title: item?.title, text, provider: 'tavily' }
  }
}
