import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_QWEN_MODEL_ID, isQwenReady, resolveChatProvider, useProviderStore } from './provider-store'

const initialState = useProviderStore.getState()

function resetStore(overrides: Partial<typeof initialState> = {}) {
  useProviderStore.setState({
    ...initialState,
    chatProvider: 'qwen',
    chatProviderMode: 'auto',
    qwenBaseUrl: '',
    qwenModelId: DEFAULT_QWEN_MODEL_ID,
    qwenApiKey: '',
    fallbackEnabled: false,
    gatewayStatus: 'unknown',
    gatewayModels: [],
    gatewayCheckedAt: 0,
    gatewayDetail: '',
    ...overrides,
  })
}

beforeEach(() => {
  // Node test environment has no Web Storage; the persisted store must stay
  // silent instead of warning on every state reset.
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
  vi.stubGlobal('sessionStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
  resetStore()
})
afterEach(() => vi.unstubAllGlobals())

describe('resolveChatProvider', () => {
  it('prefers the open model when the gateway is online', () => {
    resetStore({ gatewayStatus: 'online' })
    expect(resolveChatProvider()).toBe('qwen')
  })

  it('falls back to the external provider when the gateway is disabled', () => {
    resetStore({ gatewayStatus: 'disabled' })
    expect(resolveChatProvider()).toBe('venice')
  })

  it('falls back to the external provider when the gateway is failing', () => {
    resetStore({ gatewayStatus: 'offline' })
    expect(resolveChatProvider()).toBe('venice')
  })

  it('honours an explicit manual pin even when the gateway is online', () => {
    resetStore({ chatProviderMode: 'manual', chatProvider: 'venice', gatewayStatus: 'online' })
    expect(resolveChatProvider()).toBe('venice')
  })

  it('honours an explicit manual pin on the open model when the gateway is down', () => {
    resetStore({ chatProviderMode: 'manual', chatProvider: 'qwen', gatewayStatus: 'disabled' })
    expect(resolveChatProvider()).toBe('qwen')
  })

  it('keeps the pending choice while the gateway is still unknown', () => {
    resetStore({ gatewayStatus: 'unknown', chatProvider: 'qwen' })
    expect(resolveChatProvider()).toBe('qwen')
  })
})

describe('gateway readiness', () => {
  it('reports ready once a base URL and model id are present', () => {
    resetStore({ qwenBaseUrl: '/ai/v1', qwenModelId: 'qwen3-vl-30b' })
    expect(isQwenReady()).toBe(true)
  })

  it('reports not ready without a model id', () => {
    resetStore({ qwenBaseUrl: '/ai/v1', qwenModelId: '' })
    expect(isQwenReady()).toBe(false)
  })
})

describe('refreshGateway', () => {
  it('records an online gateway and its discovered models', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ object: 'list', data: [{ id: 'qwen3-vl-30b' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))

    const status = await useProviderStore.getState().refreshGateway({ force: true })

    expect(status).toBe('online')
    expect(useProviderStore.getState().gatewayModels).toEqual(['qwen3-vl-30b'])
    expect(resolveChatProvider()).toBe('qwen')
  })

  it('records a disabled gateway without treating it as an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'AI gateway is disabled' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )))

    const status = await useProviderStore.getState().refreshGateway({ force: true })

    expect(status).toBe('disabled')
    expect(useProviderStore.getState().gatewayDetail).not.toMatch(/error|fail/i)
    expect(resolveChatProvider()).toBe('venice')
  })

  it('does not re-probe inside the recheck window', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)

    await useProviderStore.getState().refreshGateway({ force: true })
    await useProviderStore.getState().refreshGateway()

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
