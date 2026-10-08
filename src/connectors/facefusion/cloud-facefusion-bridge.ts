import type {
  FaceFusionBridgeTransport,
  FaceFusionDetectedFace,
  FaceFusionEnhanceRequest,
  FaceFusionJobResult,
  FaceFusionModelCatalog,
  FaceFusionSwapRequest,
} from './facefusion-connector'

const FACEFUSION_API_URL = 'http://localhost:8081'

function toBase64(dataUrl: string): string {
  if (dataUrl.startsWith('data:')) {
    const commaIndex = dataUrl.indexOf(',')
    if (commaIndex !== -1) {
      return dataUrl.substring(commaIndex + 1)
    }
  }
  return dataUrl
}

function fromBase64(base64: string, mimeType: string = 'image/jpeg'): string {
  return `data:${mimeType};base64,${base64}`
}

export class CloudFaceFusionBridge implements FaceFusionBridgeTransport {
  private readonly apiUrl: string

  constructor(apiUrl: string = FACEFUSION_API_URL) {
    this.apiUrl = apiUrl
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) return false
      const data = await response.json()
      return data.status === 'healthy'
    } catch {
      return false
    }
  }

  async listModels(): Promise<FaceFusionModelCatalog> {
    const response = await fetch(`${this.apiUrl}/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.statusText}`)
    }
    return await response.json()
  }

  async detectFaces(imageUri: string): Promise<FaceFusionDetectedFace[]> {
    const base64Image = toBase64(imageUri)
    
    const formData = new FormData()
    formData.append('image', base64Image)

    const response = await fetch(`${this.apiUrl}/detect`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Face detection failed: ${response.statusText}`)
    }

    const faces = await response.json()
    return faces.map((face: FaceFusionDetectedFace) => ({
      index: face.index,
      confidence: face.confidence,
      bounds: face.bounds,
    }))
  }

  async swap(request: FaceFusionSwapRequest, signal?: AbortSignal): Promise<FaceFusionJobResult> {
    const sourceBase64 = toBase64(request.sourceUri)
    const targetBase64 = toBase64(request.targetUri)

    const response = await fetch(`${this.apiUrl}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceImage: sourceBase64,
        targetImage: targetBase64,
        targetFaceIndices: request.targetFaceIndices,
        swapper: request.swapper,
        detector: request.detector,
        recognizer: request.recognizer,
        faceEnhancer: request.faceEnhancer,
        frameEnhancer: request.frameEnhancer,
      }),
      signal,
    })

    if (!response.ok) {
      throw new Error(`Face swap failed: ${response.statusText}`)
    }

    const result = await response.json()
    
    return {
      outputUri: fromBase64(result.outputImage, result.mimeType || 'image/jpeg'),
      elapsedMs: result.elapsedMs,
      image: result.outputImage,
      format: result.format,
      mimeType: result.mimeType,
      width: result.width,
      height: result.height,
      metadata: result.metadata,
    }
  }

  async enhance(request: FaceFusionEnhanceRequest, signal?: AbortSignal): Promise<FaceFusionJobResult> {
    const base64Image = toBase64(request.imageUri)

    const response = await fetch(`${this.apiUrl}/enhance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        faceEnhancer: request.faceEnhancer,
        frameEnhancer: request.frameEnhancer,
      }),
      signal,
    })

    if (!response.ok) {
      throw new Error(`Face enhancement failed: ${response.statusText}`)
    }

    const result = await response.json()
    
    return {
      outputUri: fromBase64(result.outputImage, result.mimeType || 'image/jpeg'),
      elapsedMs: result.elapsedMs,
      image: result.outputImage,
      format: result.format,
      mimeType: result.mimeType,
      width: result.width,
      height: result.height,
      metadata: result.metadata,
    }
  }

  async cancel(): Promise<void> {
    // Cloud API doesn't support cancellation yet
    // Could be implemented with job IDs in the future
  }
}
