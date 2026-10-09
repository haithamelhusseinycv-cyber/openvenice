import type {
  FaceFusionBridgeTransport, FaceFusionDetectedFace, FaceFusionEnhanceRequest,
  FaceFusionJobResult, FaceFusionModelCatalog, FaceFusionSwapRequest,
} from './facefusion-connector'

/** HTTP transport to the Android companion on this phone. */
export class CloudFaceFusionBridge implements FaceFusionBridgeTransport {
  private readonly apiUrl: string
  constructor(apiUrl = 'http://127.0.0.1:8810') { this.apiUrl = apiUrl }

  private async request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) controller.abort()
    const timer = setTimeout(abort, body && path !== '/cancel' ? 185_000 : 10_000)
    try {
      const response = await fetch(this.apiUrl + path, {
        method: body === undefined ? 'GET' : 'POST',
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'FaceFusion request failed: HTTP ' + response.status)
      return result as T
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }

  async isAvailable() {
    try { return (await this.request<{ status: string }>('/health')).status === 'healthy' }
    catch { return false }
  }

  listModels() { return this.request<FaceFusionModelCatalog>('/models') }

  async detectFaces(imageUri: string): Promise<FaceFusionDetectedFace[]> {
    const result = await this.request<{ faces: FaceFusionDetectedFace[] }>('/detect', { image: payload(imageUri) })
    return result.faces
  }

  private async imageJob(path: string, body: unknown, signal?: AbortSignal): Promise<FaceFusionJobResult> {
    let cancellation: Promise<void> | undefined
    const cancelOnce = () => cancellation ??= this.cancel().catch(() => {})
    const abort = () => { void cancelOnce() }
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const result = await this.request<FaceFusionJobResult & { outputImage: string }>(path, body, signal)
      if (!result.outputImage) throw new Error('FaceFusion ended without an image')
      return { ...result, outputUri: 'data:' + (result.mimeType || 'image/jpeg') + ';base64,' + result.outputImage, image: result.outputImage }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') await cancelOnce()
      throw error
    } finally { signal?.removeEventListener('abort', abort) }
  }

  swap(request: FaceFusionSwapRequest, signal?: AbortSignal) {
    return this.imageJob('/swap', { ...request, sourceImage: payload(request.sourceUri), targetImage: payload(request.targetUri),
      sourceUri: undefined, targetUri: undefined }, signal)
  }

  enhance(request: FaceFusionEnhanceRequest, signal?: AbortSignal) {
    return this.imageJob('/enhance', { ...request, image: payload(request.imageUri), imageUri: undefined }, signal)
  }

  async cancel() { await this.request('/cancel', {}) }
}

function payload(value: string) {
  if (value.startsWith('data:')) return value.slice(value.indexOf(',') + 1)
  if (/^(artifact:|content:|https?:|blob:)/.test(value)) throw new Error('Resolve the image attachment before passing it to FaceFusion')
  return value
}
