import type { ConnectorHttpTransport } from '../http-transport'
import { FetchHttpTransport } from '../http-transport'

export interface LocalDreamHostInfo {
  app: string
  protocol: number
  version: string
  device: string
}

export interface LocalDreamModelDefaults {
  prompt: string
  negative_prompt: string
  steps: number
  cfg: number
  scheduler: string
}

export interface LocalDreamModelInfo {
  id: string
  name: string
  description?: string
  run_on_cpu: boolean
  is_sdxl: boolean
  is_anima: boolean
  is_custom: boolean
  generation_size: number
  defaults: LocalDreamModelDefaults
  resolutions: Array<[number, number]>
}

export interface LocalDreamCatalog {
  use_img2img: boolean
  models: LocalDreamModelInfo[]
  upscalers: Array<{ id: string; path: string }>
}

export interface LocalDreamStatus {
  serving_model_id?: string | null
  state: 'idle' | 'starting' | 'running' | 'error' | string
  message?: string | null
  error_model_id?: string | null
  width?: number | null
  height?: number | null
}

export interface LocalDreamGenerateRequest {
  prompt: string
  negative_prompt?: string
  steps?: number
  cfg?: number
  scheduler?: string
  seed?: number
  width?: number
  height?: number
  size?: number
  aspect_ratio?: string
  denoise_strength?: number
  image?: string
  mask?: string
  ultrafix?: boolean
  tile_size?: number
  preview_format?: 'raw' | 'jpeg' | 'png'
  output_format?: 'raw' | 'jpeg' | 'png'
  show_diffusion_process?: boolean
  show_diffusion_stride?: number
}

export type LocalDreamGenerationEvent =
  | { type: 'progress'; step: number; total_steps: number; image?: string; format?: string }
  | {
      type: 'complete'
      image: string
      format: string
      seed: number
      width: number
      height: number
      channels: number
      generation_time_ms?: number
      first_step_time_ms?: number
    }
  | { type: 'error'; message: string }

export interface LocalDreamUpscaleRequest {
  image: string
  width: number
  height: number
  upscalerPath: string
  useOpenCl?: boolean
}

export interface LocalDreamUpscaleResult {
  image: string
  format: 'jpeg'
  width: number
  height: number
  duration_ms?: number
}

export interface LocalDreamConnectorOptions {
  host?: string
  controlPort?: number
  generationPort?: number
  transport?: ConnectorHttpTransport
}

function decodeBase64(value: string) {
  const payload = value.startsWith('data:') ? value.slice(value.indexOf(',') + 1) : value
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encodeBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))
    for (let i = 0; i < chunk.length; i++) binary += String.fromCharCode(chunk[i])
  }
  return btoa(binary)
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export class LocalDreamConnector {
  readonly host: string
  readonly controlPort: number
  readonly generationPort: number
  private readonly transport: ConnectorHttpTransport

  constructor(options: LocalDreamConnectorOptions = {}) {
    this.host = options.host || '127.0.0.1'
    this.controlPort = options.controlPort || 8808
    this.generationPort = options.generationPort || 8081
    this.transport = options.transport || new FetchHttpTransport()
  }

  private controlUrl(path: string) {
    return `http://${this.host}:${this.controlPort}${path}`
  }

  private generationUrl(path: string) {
    return `http://${this.host}:${this.generationPort}${path}`
  }

  info(signal?: AbortSignal) {
    return this.transport.requestJson<LocalDreamHostInfo>(this.controlUrl('/info'), { signal })
  }

  listModels(signal?: AbortSignal) {
    return this.transport.requestJson<LocalDreamCatalog>(this.controlUrl('/models'), { signal })
  }

  selectModel(modelId: string, width = 512, height = 512, signal?: AbortSignal) {
    return this.transport.requestJson<{ ok: boolean }>(this.controlUrl('/select'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId, width, height }),
      signal,
    })
  }

  status(signal?: AbortSignal) {
    return this.transport.requestJson<LocalDreamStatus>(this.controlUrl('/status'), { signal })
  }

  stop(modelId?: string, signal?: AbortSignal) {
    return this.transport.requestJson<{ ok: boolean; ignored?: boolean }>(this.controlUrl('/stop'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelId ? { model_id: modelId } : {}),
      signal,
    })
  }

  async waitUntilRunning(options: { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal } = {}) {
    const timeoutMs = options.timeoutMs ?? 45_000
    const intervalMs = options.intervalMs ?? 500
    const started = Date.now()

    while (Date.now() - started < timeoutMs) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const status = await this.status(options.signal)
      if (status.state === 'running') return status
      if (status.state === 'error') throw new Error(status.message || 'Local Dream backend failed to start')
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error('Timed out waiting for Local Dream backend')
  }

  async *generate(
    request: LocalDreamGenerateRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<LocalDreamGenerationEvent, void, void> {
    const stream = this.transport.requestSse(this.generationUrl('/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })

    for await (const message of stream) {
      let payload: LocalDreamGenerationEvent
      try {
        payload = JSON.parse(message.data) as LocalDreamGenerationEvent
      } catch {
        continue
      }
      yield payload
      if (payload.type === 'complete' || payload.type === 'error') return
    }
  }

  /**
   * Local Dream's native /upscale endpoint consumes raw RGB bytes and always
   * returns a JPEG at 4x the original dimensions. The upscaler path comes from
   * the host's /models catalog.
   */
  async upscale(request: LocalDreamUpscaleRequest, signal?: AbortSignal): Promise<LocalDreamUpscaleResult> {
    if (!request.image) throw new Error('Local Dream upscale requires an image payload')
    if (!request.upscalerPath) throw new Error('Local Dream upscale requires an upscaler path')
    if (request.width <= 0 || request.height <= 0) throw new Error('Local Dream upscale requires valid image dimensions')

    const rawRgb = decodeBase64(request.image)
    const expectedBytes = request.width * request.height * 3
    if (rawRgb.length !== expectedBytes) {
      throw new Error(`Local Dream upscale expects raw RGB (${expectedBytes} bytes), received ${rawRgb.length} bytes`)
    }

    const response = await this.transport.requestBinary(this.generationUrl('/upscale'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Image-Width': String(request.width),
        'X-Image-Height': String(request.height),
        'X-Upscaler-Path': request.upscalerPath,
        ...(request.useOpenCl !== undefined ? { 'X-Use-OpenCL': request.useOpenCl ? 'true' : 'false' } : {}),
      },
      body: rawRgb,
      signal,
    })

    return {
      image: encodeBase64(response.data),
      format: 'jpeg',
      width: parsePositiveInt(response.headers['x-output-width'], request.width * 4),
      height: parsePositiveInt(response.headers['x-output-height'], request.height * 4),
      duration_ms: response.headers['x-duration-ms'] ? Number.parseInt(response.headers['x-duration-ms'], 10) : undefined,
    }
  }
}
