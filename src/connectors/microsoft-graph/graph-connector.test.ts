import { describe, expect, it } from 'vitest'
import type { ConnectorHttpTransport, HttpRequestOptions, SseMessage, BinaryHttpResponse } from '../http-transport'
import { GraphConnector } from './graph-connector'

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

describe('GraphConnector', () => {
  it('reads the signed-in account without requesting unused fields', async () => {
    const transport = new MemoryTransport({
      id: 'abc',
      displayName: 'Haitham',
      mail: 'haitham@example.com',
      userPrincipalName: 'haitham@example.com',
    })
    const connector = new GraphConnector({ transport })
    await expect(connector.whoami()).resolves.toMatchObject({ id: 'abc', displayName: 'Haitham' })
    expect(transport.calls[0]?.url).toContain('/connectors/graph/me?')
    expect(transport.calls[0]?.url).toContain('select=id%2CdisplayName%2Cmail%2CuserPrincipalName')
  })

  it('compacts mail results', async () => {
    const transport = new MemoryTransport({
      value: [
        {
          id: 'm1',
          subject: 'Hello',
          from: { emailAddress: { address: 'a@example.com' } },
          receivedDateTime: '2026-09-10T00:00:00Z',
          isRead: false,
          bodyPreview: 'Hi',
        },
      ],
    })
    const connector = new GraphConnector({ transport })
    const mail = await connector.listMail(5)
    expect(mail).toEqual([
      {
        id: 'm1',
        subject: 'Hello',
        from: 'a@example.com',
        receivedDateTime: '2026-09-10T00:00:00Z',
        isRead: false,
        bodyPreview: 'Hi',
      },
    ])
    expect(transport.calls[0]?.options?.headers).toBeUndefined()
  })

  it('sends ConsistencyLevel when searching mail', async () => {
    const transport = new MemoryTransport({ value: [] })
    const connector = new GraphConnector({ transport })
    await connector.listMail(5, 'invoice')
    expect(transport.calls[0]?.url).toContain('%24search=')
    expect(transport.calls[0]?.options?.headers).toEqual({ ConsistencyLevel: 'eventual' })
  })
})
