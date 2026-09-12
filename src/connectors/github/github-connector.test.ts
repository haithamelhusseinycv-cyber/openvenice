import { describe, expect, it } from 'vitest'
import type { ConnectorHttpTransport, HttpRequestOptions, SseMessage, BinaryHttpResponse } from '../http-transport'
import { GithubConnector } from './github-connector'

class MemoryTransport implements ConnectorHttpTransport {
  readonly calls: Array<{ url: string; options?: HttpRequestOptions }> = []
  private readonly payload: unknown
  constructor(payload: unknown) {
    this.payload = payload
  }
  async requestJson<T>(url: string, options?: HttpRequestOptions): Promise<T> {
    this.calls.push({ url, options })
    return this.payload as T
  }
  requestBinary(): Promise<BinaryHttpResponse> {
    throw new Error('not implemented')
  }
  async *requestSse(): AsyncGenerator<SseMessage, void, void> {}
}

describe('GithubConnector', () => {
  it('searches repositories through the same-origin proxy and returns compact records', async () => {
    const transport = new MemoryTransport({
      items: [
        {
          full_name: 'haithamelhusseinycv-cyber/openvenice',
          description: 'OpenVenice',
          html_url: 'https://github.com/haithamelhusseinycv-cyber/openvenice',
          default_branch: 'master',
          private: true,
        },
      ],
    })
    const connector = new GithubConnector({ transport })
    const results = await connector.searchRepositories('openvenice')
    expect(transport.calls[0]?.url).toBe('/connectors/github/search/repositories?q=openvenice&per_page=5')
    expect(results).toEqual([
      {
        fullName: 'haithamelhusseinycv-cyber/openvenice',
        description: 'OpenVenice',
        htmlUrl: 'https://github.com/haithamelhusseinycv-cyber/openvenice',
        defaultBranch: 'master',
        private: true,
      },
    ])
  })

  it('lists issues and drops pull-request entries', async () => {
    const transport = new MemoryTransport([
      { number: 61, title: 'Continue Shahy', state: 'open', html_url: 'https://example/61', user: { login: 'haitham' } },
      { number: 62, title: 'PR', state: 'open', html_url: 'https://example/62', pull_request: {} },
    ])
    const connector = new GithubConnector({ transport })
    const issues = await connector.listIssues('acme', 'openvenice')
    expect(transport.calls[0]?.url).toBe('/connectors/github/repos/acme/openvenice/issues?state=open&per_page=10')
    expect(issues).toHaveLength(1)
    expect(issues[0]?.number).toBe(61)
  })
})
