import { afterEach, expect, it, vi } from 'vitest'
import { copyImage, saveImage, shareImage } from './native-media'
afterEach(() => vi.unstubAllGlobals())
it.each([['saveImage', saveImage], ['shareImage', shareImage], ['copyImage', copyImage]] as const)('passes image bytes to native %s for tool blob URLs', async (method, action) => {
  const nativePromise = vi.fn().mockResolvedValue({ uri: 'content://saved/image' })
  vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true, nativePromise } })
  const payload = new Blob(['image bytes'], { type: 'image/png' })
  const fetchImage = vi.fn().mockResolvedValue({ ok: true, blob: async () => payload })
  vi.stubGlobal('fetch', fetchImage)
  vi.stubGlobal('FileReader', class {
    result = ''
    onload?: () => void
    async readAsDataURL(blob: Blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer())
      this.result = `data:${blob.type};base64,${btoa(String.fromCharCode(...bytes))}`
      this.onload?.()
    }
  })
  await action('blob:https://localhost/test-result', 'image/png', 'result.png')
  expect(fetchImage).toHaveBeenCalledWith('blob:https://localhost/test-result')
  expect(nativePromise).toHaveBeenCalledWith('MediaActions', method, expect.objectContaining({ imageUri: 'data:image/png;base64,aW1hZ2UgYnl0ZXM=', mimeType: 'image/png' }))
})
