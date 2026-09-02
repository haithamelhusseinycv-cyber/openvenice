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

export function createFaceFusionTools(connector: FaceFusionConnector): AgentTool[] {
  return [
    {
      id: 'facefusion.list_models',
      name: 'List FaceFusion models',
      description: 'List installed FaceFusion detector, recognition, landmark, swapper, face-restoration, and frame-enhancement models.',
      risk: 'read',
      permissions: ['local-app-control'],
      inputSchema: objectSchema({}),
      execute: async () => ({ ok: true, data: await connector.listModels() }),
    },
    {
      id: 'facefusion.detect_faces',
      name: 'Detect faces',
      description: 'Detect selectable faces in a target image before a swap.',
      risk: 'read',
      permissions: ['local-files', 'local-app-control'],
      inputSchema: objectSchema({ image_uri: { type: 'string' } }, ['image_uri']),
      execute: async (input) => {
        const value = input as { image_uri: string }
        return { ok: true, data: await connector.detectFaces(value.image_uri) }
      },
    },
    {
      id: 'facefusion.swap',
      name: 'Swap face with FaceFusion',
      description: 'Swap a source identity onto one or more selected target faces using the installed FaceFusion models.',
      risk: 'write',
      permissions: ['local-files', 'local-app-control'],
      inputSchema: objectSchema(
        {
          sourceUri: { type: 'string' },
          targetUri: { type: 'string' },
          targetFaceIndices: { type: 'array', items: { type: 'integer', minimum: 0 } },
          swapper: { type: 'string' },
          detector: { type: 'string' },
          recognizer: { type: 'string' },
          landmarks: { type: 'string' },
          faceEnhancer: { type: 'string' },
          frameEnhancer: { type: 'string' },
        },
        ['sourceUri', 'targetUri'],
      ),
      execute: async (input, context) => ({
        ok: true,
        data: await connector.swap(input as FaceFusionSwapRequest, context.signal),
      }),
    },
    {
      id: 'facefusion.enhance',
      name: 'Enhance with FaceFusion',
      description: 'Run face restoration and/or frame enhancement on an image using installed FaceFusion enhancement models.',
      risk: 'write',
      permissions: ['local-files', 'local-app-control'],
      inputSchema: objectSchema(
        {
          imageUri: { type: 'string' },
          faceEnhancer: { type: 'string' },
          frameEnhancer: { type: 'string' },
        },
        ['imageUri'],
      ),
      execute: async (input, context) => ({
        ok: true,
        data: await connector.enhance(input as FaceFusionEnhanceRequest, context.signal),
      }),
    },
  ]
}
