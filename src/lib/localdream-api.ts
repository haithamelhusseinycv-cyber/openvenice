/**
 * Local Dream image generation API client
 * Handles local/on-device image generation via Local Dream backend
 */

export interface LocalDreamGenerateRequest {
  prompt: string
  negative_prompt?: string
  steps?: number
  cfg_scale?: number
  width?: number
  height?: number
  seed?: number
  sampler?: string
}

export interface LocalDreamGenerateResponse {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  image_url?: string
  image_base64?: string
  seed: number
  error?: string
}

export interface LocalDreamJobStatus {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress?: number
  image_url?: string
  message?: string
  error?: string
}

class LocalDreamAPI {
  private baseUrl = 'http://127.0.0.1:8807'

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 min timeout

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Local Dream error (${response.status}): ${error}`)
      }

      return response.json()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Local Dream request timed out. The local GPU may be busy.')
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async generateImage(params: LocalDreamGenerateRequest): Promise<LocalDreamGenerateResponse> {
    return this.request<LocalDreamGenerateResponse>('/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: params.prompt,
        negative_prompt: params.negative_prompt || 'ugly, blurry, low quality, deformed',
        steps: params.steps || 25,
        cfg_scale: params.cfg_scale || 7.5,
        width: params.width || 512,
        height: params.height || 512,
        seed: params.seed ?? -1,
        sampler: params.sampler || 'DPM++ 2M Karras',
      }),
    })
  }

  async health(): Promise<{ ok: boolean; gpu?: string; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) return { ok: false, message: `Status ${response.status}` }
      const data = await response.json()
      return { ok: true, gpu: data.gpu, message: data.message }
    } catch {
      return { ok: false, message: 'Local Dream backend not reachable' }
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.request(`/job/${jobId}/cancel`, { method: 'POST' })
      return true
    } catch {
      return false
    }
  }

  async getJobStatus(jobId: string): Promise<LocalDreamJobStatus> {
    return this.request<LocalDreamJobStatus>(`/job/${jobId}/status`)
  }
}

export const localDreamAPI = new LocalDreamAPI()
