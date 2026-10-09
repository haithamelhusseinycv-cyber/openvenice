import { useMutation } from '@tanstack/react-query'
import { venice } from '../lib/venice-client'
import { pingUsage } from './use-billing'
import { useImageWorkspace } from '../stores/image-workspace-store'
import { saveGeneratedImage } from '../lib/image-persistence'
import type { ImageGenerateRequest, ImageGenerateResponse } from '../types/venice'

const BALANCED_STEPS = 18
const QUALITY_STEPS = 24
const MIN_STEPS = 8
const QUALITY_PATTERN = /\b(photo|photoreal|portrait|body|skin|face|realistic|cinematic|detailed|high quality)\b/i

function closestAspectRatio(width?: number, height?: number): string {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return '1:1'
  const ratios: [string, number][] = [
    ['1:1', 1], ['3:2', 3 / 2], ['16:9', 16 / 9], ['21:9', 21 / 9],
    ['9:16', 9 / 16], ['2:3', 2 / 3], ['3:4', 3 / 4], ['4:3', 4 / 3], ['4:5', 4 / 5],
  ]
  const actual = w / h
  return ratios.reduce((best, next) => Math.abs(next[1] - actual) < Math.abs(best[1] - actual) ? next : best)[0]
}

function normalizeGenerate(req: ImageGenerateRequest): ImageGenerateRequest {
  const model = String(req.model ?? '')
  const prompt = String(req.prompt ?? '')
  const isQuality = QUALITY_PATTERN.test(prompt)
  const normalized = { ...req }

  if (/qwen-image/i.test(model)) {
    normalized.aspect_ratio = normalized.aspect_ratio ?? closestAspectRatio(normalized.width, normalized.height)
    delete normalized.width
    delete normalized.height
  }

  if (!normalized.variants || normalized.variants < 1) normalized.variants = 1
  normalized.variants = Math.min(2, Math.max(1, Math.floor(Number(normalized.variants) || 1)))

  if (!normalized.resolution && /gpt-image|nano-banana|seedream|flux-3|grok-imagine|qwen-image/i.test(model)) {
    normalized.resolution = '1K'
  }

  const requested = Number(normalized.steps)
  if (!Number.isFinite(requested) || requested <= 0) {
    normalized.steps = isQuality ? QUALITY_STEPS : BALANCED_STEPS
  } else {
    normalized.steps = Math.max(MIN_STEPS, Math.min(requested, 50))
  }

  normalized.enhance_prompt = normalized.enhance_prompt === true && isQuality
  normalized.safe_mode = normalized.safe_mode === true
  normalized.hide_watermark = normalized.hide_watermark !== false

  return normalized
}

export function useImageGenerate() {
  return useMutation({
    mutationFn: (req: ImageGenerateRequest) =>
      venice<ImageGenerateResponse>('/image/generate', {
        method: 'POST',
        body: JSON.stringify(normalizeGenerate(req)),
      }),
    onSuccess: async (data, request) => {
      useImageWorkspace.getState().addGeneratedImages(
        data.images.map((image) => typeof image === 'string' ? image : image.b64_json),
      )
      await Promise.all(data.images.map((image, index) => { const base64 = typeof image === 'string' ? image : image.b64_json; return saveGeneratedImage({ id: (data.id || crypto.randomUUID()) + '-' + index, imageUrl: base64.startsWith('data:') ? base64 : 'data:image/png;base64,' + base64, prompt: request.prompt, provider: 'venice' }) }))
    },
    onSettled: () => {
      window.setTimeout(() => pingUsage(), 1200)
    },
  })
}
