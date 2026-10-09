import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestBiometricGate } from './auth-gate'

afterEach(() => vi.unstubAllGlobals())
function native(result: unknown, error?: Error) {
  const nativePromise = error ? vi.fn().mockRejectedValue(error) : vi.fn().mockResolvedValue(result)
  vi.stubGlobal('window', { Capacitor: {
    isNativePlatform: () => true,
    isPluginAvailable: () => true,
    nativePromise,
  } })
  return nativePromise
}
describe('device authentication gate', () => {
  it('accepts a verified native result', async () => {
    native({ unlocked: true })
    await expect(requestBiometricGate()).resolves.toEqual({ unlocked: true })
  })
  it.each([{ unlocked: false }, {}, { unlocked: true, fallback: true }])('rejects an unverified native result: %j', async result => {
    native(result)
    await expect(requestBiometricGate()).rejects.toThrow('not verified')
  })
  it('keeps cancellation and unavailable hardware rejected', async () => {
    native(null, new Error('Authentication cancelled'))
    await expect(requestBiometricGate()).rejects.toThrow('Authentication cancelled')
  })
})
