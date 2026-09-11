export interface FaceFusionModelCatalog {
  detectors: string[]
  recognizers: string[]
  landmarks: string[]
  swappers: string[]
  faceEnhancers: string[]
  frameEnhancers: string[]
  selected?: {
    swapper?: string
    faceEnhancer?: string
    frameEnhancer?: string
  }
  ready?: boolean
  missing?: string[]
}

export interface FaceFusionEnsureModelsRequest {
  packIds?: string[]
  includeOptional?: boolean
}

export interface FaceFusionEnsureModelsResult {
  ready: boolean
  downloaded: string[]
  skipped: string[]
  failed: Array<{ id: string; error: string }>
  missing: string[]
  selected?: {
    swapper?: string
    faceEnhancer?: string
    frameEnhancer?: string
  }
}

export interface FaceFusionDetectedFace {
  index: number
  confidence?: number
  bounds?: { left: number; top: number; right: number; bottom: number }
}

export interface FaceFusionSwapRequest {
  sourceUri: string
  targetUri: string
  targetFaceIndices?: number[]
  swapper?: string
  detector?: string
  recognizer?: string
  landmarks?: string
  faceEnhancer?: string
  frameEnhancer?: string
}

export interface FaceFusionEnhanceRequest {
  imageUri: string
  faceEnhancer?: string
  frameEnhancer?: string
}

export interface FaceFusionJobResult {
  outputUri: string
  elapsedMs?: number
  image?: string
  format?: string
  mimeType?: string
  width?: number
  height?: number
  metadata?: Record<string, unknown>
}

/**
 * Android implementation is supplied by the native OpenVenice Capacitor
 * bridge. Keeping this interface transport-neutral preserves the browser/PWA
 * build while the Android shell binds to the signature-protected service.
 */
export interface FaceFusionBridgeTransport {
  isAvailable(): Promise<boolean>
  listModels(): Promise<FaceFusionModelCatalog>
  ensureModels(request?: FaceFusionEnsureModelsRequest, signal?: AbortSignal): Promise<FaceFusionEnsureModelsResult>
  detectFaces(imageUri: string): Promise<FaceFusionDetectedFace[]>
  swap(request: FaceFusionSwapRequest, signal?: AbortSignal): Promise<FaceFusionJobResult>
  enhance(request: FaceFusionEnhanceRequest, signal?: AbortSignal): Promise<FaceFusionJobResult>
  cancel(jobId?: string): Promise<void>
}

export class FaceFusionConnector {
  private readonly bridge: FaceFusionBridgeTransport

  constructor(bridge: FaceFusionBridgeTransport) {
    this.bridge = bridge
  }

  isAvailable() {
    return this.bridge.isAvailable()
  }

  listModels() {
    return this.bridge.listModels()
  }

  ensureModels(request: FaceFusionEnsureModelsRequest = {}, signal?: AbortSignal) {
    return this.bridge.ensureModels(request, signal)
  }

  detectFaces(imageUri: string) {
    return this.bridge.detectFaces(imageUri)
  }

  swap(request: FaceFusionSwapRequest, signal?: AbortSignal) {
    return this.bridge.swap(request, signal)
  }

  enhance(request: FaceFusionEnhanceRequest, signal?: AbortSignal) {
    return this.bridge.enhance(request, signal)
  }

  cancel(jobId?: string) {
    return this.bridge.cancel(jobId)
  }
}
