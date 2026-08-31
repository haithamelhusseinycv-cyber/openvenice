import { useMutation } from '@tanstack/react-query'
import { veniceBlob } from '../lib/venice-client'
import type { ImageEditRequest, ImageUpscaleRequest } from '../types/venice'
import { stripImageDataUrl } from '../lib/image-input'

/**
 * All three return raw Blobs. Components use `useBlobUrl` to manage URL lifecycle
 * so previews are revoked on replace/unmount.
 */
export function useImageEdit() {
  return useMutation({
    mutationFn: (req: ImageEditRequest) => veniceBlob('/image/multi-edit', req),
  })
}

export function useImageMultiEdit() {
  return useMutation({
    mutationFn: (req: ImageEditRequest) => veniceBlob('/image/multi-edit', req),
  })
}

export function useImageUpscale() {
  return useMutation({
    mutationFn: (req: ImageUpscaleRequest) => veniceBlob('/image/upscale', {
      ...req,
      image: stripImageDataUrl(req.image),
    }),
  })
}

export function useBackgroundRemove() {
  return useMutation({
    mutationFn: (image: string) => veniceBlob('/image/background-remove', {
      image: stripImageDataUrl(image),
    }),
  })
}
