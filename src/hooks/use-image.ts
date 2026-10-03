import { useMutation } from '@tanstack/react-query'
import { venice } from '../lib/venice-client'
import { pingUsage } from './use-billing'
import { useImageWorkspace } from '../stores/image-workspace-store'
import type { ImageGenerateRequest, ImageGenerateResponse } from '../types/venice'

export function useImageGenerate() {
  return useMutation({
    mutationFn: (req: ImageGenerateRequest) =>
      venice<ImageGenerateResponse>('/image/generate', {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    onSuccess: (data) => {
      useImageWorkspace.getState().addGeneratedImages(
        data.images.map((image) => typeof image === 'string' ? image : image.b64_json),
      )
    },
    onSettled: () => {
      window.setTimeout(() => pingUsage(), 1200)
    },
  })
}
