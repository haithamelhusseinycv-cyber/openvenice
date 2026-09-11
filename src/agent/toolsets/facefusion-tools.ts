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
      id: 'facefusion.status',
      name: 'FaceFusion status',
      description: 'Check whether the FaceFusion companion is bound and whether the minimum on-device model packs are downloaded.',
      risk: 'read',
      permissions: ['local-app-control'],
      inputSchema: objectSchema({}),
      execute: async () => {
        const available = await connector.isAvailable()
        if (!available) {
          return {
            ok: false,
            error: 'FaceFusion companion is not installed or the signature-protected bridge is unavailable.',
          }
        }
        const catalog = await connector.listModels()
        return { ok: true, data: { available, ...catalog } }
      },
    },
    {
      id: 'facefusion.list_models',
      name: 'List FaceFusion models',
      description: 'List installed FaceFusion detection, recognition, landmark, runtime-supported swapper, face-restoration, and frame-enhancement models. Also reports missing minimum packs.',
      risk: 'read',
      permissions: ['local-app-control'],
      inputSchema: objectSchema({}),
      execute: async () => ({ ok: true, data: await connector.listModels() }),
    },
    {
      id: 'facefusion.ensure_models',
      name: 'Download FaceFusion models',
      description:
        'Download the minimum on-device FaceFusion packs if they are missing (RetinaFace, ArcFace, 2DFAN4, INSwapper 128 FP16). Pass packIds to download specific Complete Models packs. Set includeOptional to also fetch CodeFormer and Real-ESRGAN x4 FP16. Large downloads stay on the phone; nothing is uploaded to Shahy.',
      risk: 'write',
      permissions: ['network', 'local-app-control'],
      inputSchema: objectSchema({
        packIds: { type: 'array', items: { type: 'string' } },
        includeOptional: { type: 'boolean' },
      }),
      execute: async (input, context) => {
        const value = input as { packIds?: string[]; includeOptional?: boolean }
        const result = await connector.ensureModels({
          packIds: value.packIds,
          includeOptional: value.includeOptional,
        }, context.signal)
        if (!result.ready && (value.packIds == null || value.packIds.length === 0)) {
          return {
            ok: false,
            error: 'FaceFusion is still missing required on-device packs. Update the FaceFusion companion if this command is unknown, or open Complete Models and download RetinaFace, ArcFace, 2DFAN4, and INSwapper 128 FP16.',
            data: result,
          }
        }
        return { ok: true, data: result }
      },
    },
    {
      id: 'facefusion.detect_faces',
      name: 'Detect faces',
      description: 'Detect selectable faces in a target image before a swap. image_uri may be a content/data URI or an artifact:// handle for a chat attachment or prior agent image. Requires the minimum FaceFusion packs.',
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
      description: 'Swap a source identity onto one or more selected target faces using an installed FaceFusion swapper. sourceUri and targetUri may be artifact:// handles. Optionally restore the face and enhance the final frame in the same ordered job. Call facefusion.ensure_models first if no swapper is installed.',
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
      description: 'Run face restoration and/or frame enhancement on an image using installed FaceFusion enhancement models. imageUri may be an artifact:// handle. Download CodeFormer or Real-ESRGAN with facefusion.ensure_models includeOptional=true if none are installed.',
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
