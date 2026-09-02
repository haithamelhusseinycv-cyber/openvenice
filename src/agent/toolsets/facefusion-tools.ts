import type { AgentTool } from '../types'
import {
  FaceFusionConnector,
  type FaceFusionEnhanceRequest,
  type FaceFusionSwapRequest,
} from '../../connectors/facefusion/facefusion-connector'

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
})

function resolveArtifact(value: string, context: Parameters<AgentTool['execute']>[1]) {
  return context.artifacts?.resolveData(value) ?? value
}

export function createFaceFusionTools(connector: FaceFusionConnector): AgentTool[] {
  return [
    {
      id: 'facefusion.list_models',
      name: 'List FaceFusion models',
      description: 'List installed FaceFusion detection, recognition, landmark, runtime-supported swapper, face-restoration, and frame-enhancement models.',
      risk: 'read',
      permissions: ['local-app-control'],
      inputSchema: objectSchema({}),
      execute: async () => ({ ok: true, data: await connector.listModels() }),
    },
    {
      id: 'facefusion.detect_faces',
      name: 'Detect faces',
      description: 'Detect selectable faces in a target image before a swap. image_uri may be a content/data URI or an artifact:// handle for a chat attachment or prior agent image.',
      risk: 'read',
      permissions: ['local-files', 'local-app-control'],
      inputSchema: objectSchema({ image_uri: { type: 'string' } }, ['image_uri']),
      execute: async (input, context) => {
        const value = input as { image_uri: string }
        return { ok: true, data: await connector.detectFaces(resolveArtifact(value.image_uri, context)) }
      },
    },
    {
      id: 'facefusion.swap',
      name: 'Swap face with FaceFusion',
      description: 'Swap a source identity onto one or more selected target faces using an installed FaceFusion swapper. sourceUri and targetUri may be artifact:// handles. Optionally restore the face and enhance the final frame in the same ordered job.',
      risk: 'write',
      permissions: ['local-files', 'local-app-control'],
      inputSchema: objectSchema(
        {
          sourceUri: { type: 'string', description: 'Source face image URI or artifact:// handle.' },
          targetUri: { type: 'string', description: 'Target image URI or artifact:// handle.' },
          targetFaceIndices: { type: 'array', items: { type: 'integer', minimum: 0 } },
          swapper: { type: 'string' },
          detector: { type: 'string', description: 'Reserved for a future selectable detector runtime.' },
          recognizer: { type: 'string', description: 'Reserved for a future selectable recognizer runtime.' },
          landmarks: { type: 'string', description: 'Reserved for a future selectable landmark runtime.' },
          faceEnhancer: { type: 'string' },
          frameEnhancer: { type: 'string' },
        },
        ['sourceUri', 'targetUri'],
      ),
      execute: async (input, context) => {
        const value = input as FaceFusionSwapRequest
        return {
          ok: true,
          data: await connector.swap({
            ...value,
            sourceUri: resolveArtifact(value.sourceUri, context),
            targetUri: resolveArtifact(value.targetUri, context),
          }, context.signal),
        }
      },
    },
    {
      id: 'facefusion.enhance',
      name: 'Enhance with FaceFusion',
      description: 'Run face restoration and/or frame enhancement on an image using installed FaceFusion enhancement models. imageUri may be an artifact:// handle.',
      risk: 'write',
      permissions: ['local-files', 'local-app-control'],
      inputSchema: objectSchema(
        {
          imageUri: { type: 'string', description: 'Image URI or artifact:// handle.' },
          faceEnhancer: { type: 'string' },
          frameEnhancer: { type: 'string' },
        },
        ['imageUri'],
      ),
      execute: async (input, context) => {
        const value = input as FaceFusionEnhanceRequest
        return {
          ok: true,
          data: await connector.enhance({
            ...value,
            imageUri: resolveArtifact(value.imageUri, context),
          }, context.signal),
        }
      },
    },
  ]
}
