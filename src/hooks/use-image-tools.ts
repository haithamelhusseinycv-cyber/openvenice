import { useMutation } from '@tanstack/react-query'
import { veniceBlob } from '../lib/venice-client'
import type { ImageEditRequest, ImageUpscaleRequest } from '../types/venice'
import { stripImageDataUrl } from '../lib/image-input'

function toVeniceEditModel(model: string | undefined): string {
  const id = (model ?? '').trim()
  if (/qwen-image-3-pro-edit/i.test(id)) return 'qwen-image-3-pro-edit'
  if (/qwen-image-3/i.test(id)) return 'qwen-image-3-edit'
  if (/seedream-v5-pro/i.test(id)) return 'seedream-v5-pro-edit'
  if (/seedream-v5-lite/i.test(id)) return 'seedream-v5-lite-edit'
  if (/seedream-v4/i.test(id)) return 'seedream-v4-edit'
  if (/qwen-edit-uncensored/i.test(id)) return 'qwen-edit-uncensored'
  if (/edit$/i.test(id)) return id
  return 'qwen-image-3-edit'
}

function normalizeEditPayload(req: ImageEditRequest) {
  return {
    images: req.images,
    prompt: req.prompt,
    model: toVeniceEditModel(req.modelId),
    aspect_ratio: req.aspect_ratio,
    output_format: req.output_format ?? 'png',
    resolution: req.resolution ?? '1K',
    disable_prompt_optimization_thinking: true,
    safe_mode: false,
  }
}

export function useImageEdit() {
  return useMutation({
    mutationFn: (req: ImageEditRequest) => veniceBlob('/image/multi-edit', normalizeEditPayload(req)),
  })
}

export function useImageMultiEdit() {
  return useMutation({
    mutationFn: (req: ImageEditRequest) => veniceBlob('/image/multi-edit', normalizeEditPayload(req)),
  })
}

export function useImageUpscale() {
  return useMutation({
    mutationFn: (req: ImageUpscaleRequest) => {
      const scale = Number(req.scale)
      const creativity = Number(req.creativity)
      return veniceBlob('/image/upscale', {
        image: stripImageDataUrl(req.image),
        scale: (Number.isFinite(scale) ? Math.min(Math.max(scale, 2), 2) : 2) as 2,
        creativity: Number.isFinite(creativity) ? Math.min(Math.max(creativity, 0), 0.01) : 0.01,
      })
    },
  })
}

export function useBackgroundRemove() {
  return useMutation({
    mutationFn: (image: string) => veniceBlob('/image/background-remove', {
      image: stripImageDataUrl(image),
    }),
  })
}
