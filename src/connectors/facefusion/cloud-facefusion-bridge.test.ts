import { afterEach, expect, it, vi } from 'vitest'
import { CloudFaceFusionBridge } from './cloud-facefusion-bridge'

afterEach(() => vi.unstubAllGlobals())
it('uses the phone companion and unwraps detected faces', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ faces: [{ index: 0 }] })))
  vi.stubGlobal('fetch', fetcher)
  expect(await new CloudFaceFusionBridge().detectFaces('data:image/png;base64,AQ==')).toEqual([{ index: 0 }])
  expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:8810/detect')
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ image: 'AQ==' })
})
it('returns the companion output as an image artifact', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ outputImage: 'AQ==', mimeType: 'image/jpeg', width: 512 })))
  vi.stubGlobal('fetch', fetcher)
  const result = await new CloudFaceFusionBridge().swap({ sourceUri: 'AQ==', targetUri: 'Ag==' })
  expect(result.outputUri).toBe('data:image/jpeg;base64,AQ==')
  expect(result.width).toBe(512)
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ sourceImage: 'AQ==', targetImage: 'Ag==' })
})
it('keeps provider errors visible', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Model not downloaded' }), { status: 400 })))
  await expect(new CloudFaceFusionBridge().listModels()).rejects.toThrow('Model not downloaded')
})
it('cancels the companion once when a browser request is aborted', async () => {
  const fetcher = vi.fn((url: string, options: RequestInit) => {
    if (url.endsWith('/cancel')) return Promise.resolve(new Response('{"ok":true}'))
    return new Promise<Response>((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
  })
  vi.stubGlobal('fetch', fetcher)
  const abort = new AbortController()
  const result = new CloudFaceFusionBridge().enhance({ imageUri: 'AQ==' }, abort.signal)
  abort.abort()
  await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/cancel'))).toHaveLength(1)
})
