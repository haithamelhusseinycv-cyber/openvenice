import { venice, veniceBlob } from './venice-client'
import { DEFAULT_IMAGE_MODEL_ID, DEFAULT_EDIT_MODEL_ID } from './allowed-models'
import { stripImageDataUrl } from './image-input'
import type { ImageGenerateResponse } from '../types/venice'

export interface VeniceImageGenerateRequest {
  prompt: string; negative_prompt?: string; model?: string; width?: number; height?: number
  steps?: number; cfg_scale?: number; seed?: number; num_images?: number; aspect_ratio?: string
}
export interface VeniceImageGenerateResponse {
  id: string; status: 'completed'; images: Array<{ url: string; seed: number }>; created_at: number
}
class VeniceImageAPI {
  async generateImage(params: VeniceImageGenerateRequest, signal?: AbortSignal): Promise<VeniceImageGenerateResponse> {
    const data = await venice<ImageGenerateResponse>('/image/generate', {
      method: 'POST', signal, body: JSON.stringify({
        ...params, model: params.model || DEFAULT_IMAGE_MODEL_ID,
        variants: 1, format: 'png', hide_watermark: true,
        safe_mode: false, enhance_prompt: false,
      }),
    })
    const images = data.images.map(image => {
      const base64 = typeof image === 'string' ? image : image.b64_json
      if (!base64) throw new Error('Provider returned an empty image')
      return { url: base64.startsWith('data:') ? base64 : 'data:image/png;base64,' + base64, seed: params.seed ?? 0 }
    })
    if (!images.length) throw new Error('Provider returned no image')
    return { id: data.id || crypto.randomUUID(), status: 'completed', images, created_at: Date.now() }
  }
  async process(operation: string, images: string[], prompt: string, settings: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    if (!images.length) throw new Error('Attach a source photo for this operation')
    const blob = operation === 'upscale'
      ? await veniceBlob('/image/upscale', { image: stripImageDataUrl(images[0]), scale: 2, creativity: 0.01 }, { signal })
      : operation === 'remove_background'
        ? await veniceBlob('/image/background-remove', { image: stripImageDataUrl(images[0]) }, { signal })
        : await veniceBlob('/image/multi-edit', {
          images, prompt, model: DEFAULT_EDIT_MODEL_ID,
          aspect_ratio: settings.aspect_ratio || 'auto', output_format: 'png', resolution: '1K',
          safe_mode: false, disable_prompt_optimization_thinking: true,
        }, { signal })
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  }
  async listModels() {
    const result = await venice<{ data: Array<{ id: string; model_spec?: { name?: string } }> }>('/models?type=image')
    return result.data.map(model => ({ id: model.id, name: model.model_spec?.name || model.id, capabilities: ['generate'] }))
  }
}
export const veniceImageAPI = new VeniceImageAPI()
