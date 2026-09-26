import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getProxyAccessToken,
  hydrateProxyAccessTokenFromDevice,
  saveProxyAccessToken,
  setProxyAccessToken,
} from './proxy-access'

const STORAGE_KEY = 'openvenice-proxy-access'
const TOKEN = 'host-token-at-least-24-characters'

function storage(initial = '') {
  let value = initial
  return {
    getItem: vi.fn((key: string) => key === STORAGE_KEY && value ? value : null),
    setItem: vi.fn((key: string, next: string) => { if (key === STORAGE_KEY) value = next }),
    removeItem: vi.fn((key: string) => { if (key === STORAGE_KEY) value = '' }),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('OpenVenice host access storage', () => {
  it('stores browser credentials only in the current session', async () => {
    const session = storage()
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('window', {})

    await saveProxyAccessToken(TOKEN, true)

    expect(getProxyAccessToken()).toBe(TOKEN)
    expect(session.setItem).toHaveBeenCalledWith(STORAGE_KEY, TOKEN)
  })

  it('persists a named credential through the Android secure vault', async () => {
    const session = storage()
    const nativePromise = vi.fn().mockResolvedValue({ saved: true })
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('window', { Capacitor: {
      getPlatform: () => 'android',
      isNativePlatform: () => true,
      isPluginAvailable: () => true,
      nativePromise,
    } })

    await saveProxyAccessToken(TOKEN, true)

    expect(nativePromise).toHaveBeenCalledWith('AuthVault', 'saveNamed', {
      name: 'proxyAccess',
      value: TOKEN,
    })
  })

  it('hydrates the session before protected startup requests', async () => {
    const session = storage()
    const nativePromise = vi.fn().mockResolvedValue({ found: true, value: TOKEN })
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('window', { Capacitor: {
      getPlatform: () => 'android',
      isNativePlatform: () => true,
      nativePromise,
    } })

    await expect(hydrateProxyAccessTokenFromDevice()).resolves.toBe(true)
    expect(session.setItem).toHaveBeenCalledWith(STORAGE_KEY, TOKEN)
  })

  it('rejects malformed credentials', () => {
    vi.stubGlobal('sessionStorage', storage())
    expect(() => setProxyAccessToken('short token')).toThrow(/24 URL-safe characters/)
  })
})
