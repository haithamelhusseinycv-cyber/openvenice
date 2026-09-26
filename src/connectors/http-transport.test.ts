import { afterEach, expect, it, vi } from 'vitest'
import { FetchHttpTransport } from './http-transport'
import { useAuthStore } from '../stores/auth-store'

afterEach(() => vi.unstubAllGlobals())

it('sends the separate host token to connector routes without exposing the Venice key', async () => {
  useAuthStore.setState({ apiKey: 'sk-venice-provider' })
  vi.stubGlobal('sessionStorage', {
    getItem: vi.fn((key: string) => key === 'openvenice-proxy-access' ? 'separate-host-access-token-1234' : null),
  })
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
  vi.stubGlobal('fetch', fetchMock)

  await new FetchHttpTransport().requestJson('/connectors/status')

  const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
  expect(headers.get('X-OpenVenice-Access')).toBe('separate-host-access-token-1234')
  expect(headers.get('Authorization')).toBeNull()
  expect(headers.get('X-OpenVenice-Access')).not.toBe('sk-venice-provider')
})

it('routes Android connector calls through its native bridge to the Railway host', async () => {
  vi.stubGlobal('sessionStorage', {
    getItem: vi.fn(() => 'separate-host-access-token-1234'),
  })
  const nativePromise = vi.fn().mockResolvedValue({
    status: 200,
    contentType: 'application/json',
    bodyBase64: btoa('{"github":true}'),
  })
  vi.stubGlobal('window', { Capacitor: {
    isNativePlatform: () => true,
    nativePromise,
  } })
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('WebView fetch should not be used') }))

  const result = await new FetchHttpTransport().requestJson('/connectors/status')

  expect(result).toEqual({ github: true })
  expect(nativePromise).toHaveBeenCalledWith('VoiceChat', 'fetchBinary', expect.objectContaining({
    url: 'https://openvenice-production.up.railway.app/connectors/status',
    headers: expect.objectContaining({ 'x-openvenice-access': 'separate-host-access-token-1234' }),
  }))
})
