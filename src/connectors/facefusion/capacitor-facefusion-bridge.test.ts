import { afterEach, expect, it, vi } from 'vitest'
import { CapacitorFaceFusionBridge } from './capacitor-facefusion-bridge'

afterEach(() => { vi.unstubAllGlobals() })
it('settles abort even when the native operation and cancellation never reply', async () => {
  const nativePromise = vi.fn(() => new Promise<unknown>(() => {}))
  vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true, nativePromise } })
  const controller = new AbortController()
  const operation = new CapacitorFaceFusionBridge().swap({ sourceUri: 'source', targetUri: 'target' }, controller.signal)
  const rejected = expect(operation).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejected
  expect(nativePromise).toHaveBeenCalledWith('FaceFusionAgent', 'cancel', {})
})
it('does not dispatch an already aborted operation', async () => {
  const nativePromise = vi.fn()
  vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true, nativePromise } })
  const controller = new AbortController(); controller.abort()
  await expect(new CapacitorFaceFusionBridge().enhance({ imageUri: 'image' }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(nativePromise).not.toHaveBeenCalled()
})
