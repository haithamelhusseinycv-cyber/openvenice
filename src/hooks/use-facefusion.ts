import { useMutation } from '@tanstack/react-query'
import { FaceFusionConnector } from '../connectors/facefusion/facefusion-connector'
import { CloudFaceFusionBridge } from '../connectors/facefusion/cloud-facefusion-bridge'

const connector = new FaceFusionConnector(new CloudFaceFusionBridge())

export function useFaceFusionSwap() {
  return useMutation({
    mutationFn: async (params: {
      sourceImage: string
      targetImage: string
      targetFaceIndices?: number[]
      swapper?: string
      faceEnhancer?: string
    }) => {
      const result = await connector.swap({
        sourceUri: params.sourceImage,
        targetUri: params.targetImage,
        targetFaceIndices: params.targetFaceIndices,
        swapper: params.swapper,
        faceEnhancer: params.faceEnhancer,
      })
      return result
    },
  })
}

export function useFaceFusionDetect() {
  return useMutation({
    mutationFn: async (imageUri: string) => {
      return await connector.detectFaces(imageUri)
    },
  })
}

export function useFaceFusionEnhance() {
  return useMutation({
    mutationFn: async (params: {
      imageUri: string
      faceEnhancer?: string
      frameEnhancer?: string
    }) => {
      return await connector.enhance({
        imageUri: params.imageUri,
        faceEnhancer: params.faceEnhancer,
        frameEnhancer: params.frameEnhancer,
      })
    },
  })
}

export function useFaceFusionAvailability() {
  return useMutation({
    mutationFn: async () => {
      return await connector.isAvailable()
    },
  })
}
