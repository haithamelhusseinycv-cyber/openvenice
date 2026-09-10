import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GATEWAY_BASE_URL,
  classifyHttpStatus,
  describeGatewayError,
  gatewayBaseUrl,
  gatewayUrl,
  probeGateway,
} from './ai-gateway'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('gateway URL handling', () => {
  it('defaults to the same-origin gateway', () => {
    expect(gatewayBaseUrl('')).toBe(DEFAULT_GATEWAY_BASE_URL)
    expect(gatewayBaseUrl(undefined)).toBe(DEFAULT_GATEWAY_BASE_URL)
    expect(gatewayBaseUrl('  ')).toBe(DEFAULT_GATEWAY_BASE_URL)
  })

  it('strips trailing slashes from a configured base', () => {
    expect(gatewayBaseUrl('/ai/v1///')).toBe('/ai/v1')
    expect(gatewayBaseUrl('https://host.example/v1/')).toBe('https://host.example/v1')
  })

  it('joins paths without duplicating separators', () => {
    expect(gatewayUrl('/models', '/ai/v1/')).toBe('/ai/v1/models')
    expect(gatewayUrl('models')).toBe('/ai/v1/models')
  })
})

describe('probeGateway', () => {
  it('reports a configured gateway as online and discovers models', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ object: 'list', data: [{ id: 'qwen3-vl-30b' }, { id: 'qwen2.5-14b' }] }))
    const probe = await probeGateway({ fetchImpl: fetchImpl as unknown as typeof fetch, base: '/ai/v1' })

    expect(probe.status).toBe('online')
    expect(probe.models).toEqual(['qwen3-vl-30b', 'qwen2.5-14b'])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe('/ai/v1/models')
  })

  it('reports a disabled gateway as disabled rather than as a failure', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'AI gateway is disabled' }, 503))
    const probe = await probeGateway({ fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(probe.status).toBe('disabled')
    expect(probe.models).toEqual([])
  })

  it('reports an upstream failure as offline with a provider-neutral detail', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'boom' }, 502))
    const probe = await probeGateway({ fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(probe.status).toBe('offline')
    expect(probe.detail).not.toMatch(/venice/i)
  })

  it('reports a network failure as offline', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('connect ECONNREFUSED') })
    const probe = await probeGateway({ fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(probe.status).toBe('offline')
    expect(probe.detail).toContain('ECONNREFUSED')
  })

  it('survives a healthy gateway with an unparseable model list', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>ok</html>', { status: 200 }))
    const probe = await probeGateway({ fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(probe.status).toBe('online')
    expect(probe.models).toEqual([])
  })
})

describe('error classification', () => {
  it('maps statuses to provider-neutral categories', () => {
    expect(classifyHttpStatus(401)).toBe('authentication')
    expect(classifyHttpStatus(402)).toBe('insufficient_balance')
    expect(classifyHttpStatus(404)).toBe('model_unavailable')
    expect(classifyHttpStatus(429)).toBe('rate_limit')
    expect(classifyHttpStatus(503)).toBe('provider_outage')
  })

  it('never leaks another provider name into gateway messages', () => {
    for (const status of [401, 402, 404, 429, 500]) {
      expect(describeGatewayError(status)).not.toMatch(/venice/i)
    }
  })
})
