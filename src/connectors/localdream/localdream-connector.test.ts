import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalDreamConnector } from './localdream-connector'

describe('Local Dream inference readiness', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup(health: () => Promise<{ ok: boolean }>) {
    const transport = {
      requestJson: vi.fn(async <T>(url: string): Promise<T> => {
        if (url.endsWith('/status')) return { state: 'running' } as T
        return await health() as T
      }),
      requestBinary: vi.fn(),
      requestSse: vi.fn(),
    }
    return { connector: new LocalDreamConnector({ transport }), transport }
  }

  it('does not treat the early running control state as ready', async () => {
    const health = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true })
    const { connector, transport } = setup(health)
    let settled = false
    const ready = connector.waitUntilRunning({ intervalMs: 10 }).then((result) => {
      settled = true
      return result
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    expect(health).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10)
    await expect(ready).resolves.toMatchObject({ state: 'running' })
    expect(transport.requestJson).toHaveBeenCalledWith(
      'http://127.0.0.1:8081/health', expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('waits through connection refusal while the native socket starts', async () => {
    const health = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ ok: true })
    const { connector } = setup(health)
    const ready = connector.waitUntilRunning({ intervalMs: 10 })
    await vi.advanceTimersByTimeAsync(10)
    await expect(ready).resolves.toMatchObject({ state: 'running' })
  })

  it('rejects an unauthorized inference endpoint immediately', async () => {
    const { connector } = setup(async () => { throw new Error('Connector request failed: HTTP 401') })
    await expect(connector.waitUntilRunning()).rejects.toThrow('HTTP 401')
  })

  it('honors caller cancellation before polling', async () => {
    const { connector } = setup(async () => ({ ok: true }))
    const controller = new AbortController()
    controller.abort()
    await expect(connector.waitUntilRunning({ signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('times out when control is running but inference never becomes healthy', async () => {
    const { connector } = setup(async () => ({ ok: false }))
    const ready = expect(connector.waitUntilRunning({ timeoutMs: 30, intervalMs: 10 }))
      .rejects.toThrow('inference health')
    await vi.advanceTimersByTimeAsync(30)
    await ready
  })
})
