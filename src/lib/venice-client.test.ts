import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatVeniceError, validateVeniceApiKey, VeniceAPIError, veniceBlob } from './venice-client'
import { useAuthStore } from '../stores/auth-store'

function response(status: number, message = `HTTP ${status}`): Response {
  if (status >= 200 && status < 300) return new Response(null, { status })
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function waitForAbort(signal?: AbortSignal | null): Promise<Response> {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener(
      'abort',
      () => reject(new DOMException('The operation was aborted.', 'AbortError')),
      { once: true },
    )
  })
}

describe('validateVeniceApiKey', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    useAuthStore.setState({ apiKey: 'sk-test' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('rejects an empty or whitespace-only key without making a request', async () => {
    await expect(validateVeniceApiKey('   ')).rejects.toMatchObject({
      message: 'API key cannot be empty.',
      status: 401,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts a valid key through the rate-limits endpoint without fallback', async () => {
    fetchMock.mockResolvedValueOnce(response(204))

    await expect(validateVeniceApiKey('  sk-valid  ')).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api_keys/rate_limits')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer sk-valid' },
    })
  })

  it('accepts HTTP 402 as proof that the key authenticated', async () => {
    fetchMock.mockResolvedValueOnce(response(402, 'Credits empty'))

    await expect(validateVeniceApiKey('sk-no-credits')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects HTTP 401 immediately without trying billing', async () => {
    fetchMock.mockResolvedValueOnce(response(401, 'Invalid API key'))

    await expect(validateVeniceApiKey('sk-invalid')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to billing after a primary endpoint error', async () => {
    fetchMock
      .mockResolvedValueOnce(response(500, 'Rate limits unavailable'))
      .mockResolvedValueOnce(response(204))

    await expect(validateVeniceApiKey('sk-account')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/billing/balance')
  })

  it('falls back to billing after a primary network error', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(response(204))

    await expect(validateVeniceApiKey('sk-account')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to billing after the primary endpoint times out', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockImplementationOnce((_input: RequestInfo | URL, init?: RequestInit) => waitForAbort(init?.signal))
      .mockResolvedValueOnce(response(204))

    const validation = validateVeniceApiKey('sk-account')
    await vi.advanceTimersByTimeAsync(8_000)

    await expect(validation).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns a clear 408 client-timeout error when both endpoints time out', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => waitForAbort(init?.signal))

    const validation = validateVeniceApiKey('sk-timeout')
    const rejection = expect(validation).rejects.toEqual(
      expect.objectContaining({
        message: 'Venice API did not respond. Check your connection and try again.',
        status: 408,
      }),
    )

    await vi.advanceTimersByTimeAsync(8_000)
    await vi.advanceTimersByTimeAsync(8_000)
    await rejection
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects a 401 returned by the billing fallback', async () => {
    fetchMock
      .mockResolvedValueOnce(response(404, 'Endpoint unavailable'))
      .mockResolvedValueOnce(response(401, 'Invalid API key'))

    await expect(validateVeniceApiKey('sk-invalid')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns VeniceAPIError instances for validation failures', async () => {
    fetchMock.mockResolvedValueOnce(response(401, 'Invalid API key'))

    await expect(validateVeniceApiKey('sk-invalid')).rejects.toBeInstanceOf(VeniceAPIError)
  })

  it('shows the string and field details returned by image endpoint validation', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'Invalid request body',
      details: { scale: { _errors: ['Expected 2 or 4'] } },
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'request-123',
      },
    }))

    const request = veniceBlob('/image/upscale', { image: 'abc', scale: 3 })
    await expect(request).rejects.toMatchObject({
      status: 400,
      message: 'Invalid request body: scale: Expected 2 or 4',
      requestId: 'request-123',
    })

    try {
      await request
    } catch (error) {
      expect(formatVeniceError(error)).toBe('Invalid request body: scale: Expected 2 or 4 · Request request-123')
    }
  })
})
