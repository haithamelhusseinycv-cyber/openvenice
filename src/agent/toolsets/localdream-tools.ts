import type { AgentTool } from '../types'
import {
  LocalDreamConnector,
  type LocalDreamGenerateRequest,
} from '../../connectors/localdream/localdream-connector'

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
})

function base64Payload(value: string) {
  if (!value.startsWith('data:')) return value
  const comma = value.indexOf(',')
  return comma >= 0 ? value.slice(comma + 1) : value
}

function resolveImagePayload(value: string | undefined, context: Parameters<AgentTool['execute']>[1]) {
  if (!value) return value
  return base64Payload(context.artifacts?.resolveData(value) ?? value)
}

export function createLocalDreamTools(connector = new LocalDreamConnector()): AgentTool[] {
  return [
    {
      id: 'localdream.info',
      name: 'Local Dream status',
      description: 'Read Local Dream host identity and version on this Android device.',
      risk: 'read',
      permissions: ['network', 'local-app-control'],
      inputSchema: objectSchema({}),
      execute: async (_input, context) => ({ ok: true, data: await connector.info(context.signal) }),
    },
    {
      id: 'localdream.list_models',
      name: 'List Local Dream models',
      description: 'List downloaded Local Dream generation models, defaults, supported resolutions, and installed upscalers.',
      risk: 'read',
      permissions: ['network', 'local-app-control'],
      inputSchema: objectSchema({}),
      execute: async (_input, context) => ({ ok: true, data: await connector.listModels(context.signal) }),
    },
    {
      id: 'localdream.select_model',
      name: 'Select Local Dream model',
      description: 'Activate a downloaded Local Dream model and start its local generation backend.',
      risk: 'write',
      permissions: ['network', 'local-app-control'],
      inputSchema: objectSchema(
        {
          model_id: { type: 'string' },
          width: { type: 'integer', minimum: 8 },
          height: { type: 'integer', minimum: 8 },
        },
        ['model_id'],
      ),
      execute: async (input, context) => {
        const value = input as { model_id: string; width?: number; height?: number }
        const selected = await connector.selectModel(
          value.model_id,
          value.width ?? 512,
          value.height ?? 512,
          context.signal,
        )
        if (!selected.ok) return { ok: false, error: 'Local Dream rejected model selection' }
        const status = await connector.waitUntilRunning({ signal: context.signal })
        return { ok: true, data: status }
      },
    },
    {
      id: 'localdream.generate',
      name: 'Generate or edit with Local Dream',
      description: 'Run Local Dream text-to-image, img2img, or inpaint. image and mask may be artifact:// handles for user attachments or prior agent outputs. Include image for img2img; image and mask for inpaint. When a 4x upscale will follow, set output_format to raw so the returned artifact can be passed directly to localdream.upscale.',
      risk: 'write',
      permissions: ['network', 'local-app-control', 'local-files'],
      inputSchema: objectSchema(
        {
          prompt: { type: 'string' },
          negative_prompt: { type: 'string' },
          steps: { type: 'number', minimum: 1 },
          cfg: { type: 'number', minimum: 0 },
          scheduler: { type: 'string' },
          seed: { type: 'integer' },
          width: { type: 'integer', minimum: 8 },
          height: { type: 'integer', minimum: 8 },
          aspect_ratio: { type: 'string' },
          denoise_strength: { type: 'number', minimum: 0, maximum: 1 },
          image: { type: 'string', description: 'Base64 image payload or artifact:// handle.' },
          mask: { type: 'string', description: 'Base64 mask payload or artifact:// handle.' },
          output_format: { enum: ['raw', 'jpeg', 'png'] },
        },
        ['prompt'],
      ),
      execute: async (input, context) => {
        const value = input as LocalDreamGenerateRequest
        const request: LocalDreamGenerateRequest = {
          ...value,
          image: resolveImagePayload(value.image, context),
          mask: resolveImagePayload(value.mask, context),
        }
        const events = []
        let completed: unknown
        for await (const event of connector.generate(request, context.signal)) {
          if (event.type === 'progress') {
            events.push({ step: event.step, total_steps: event.total_steps })
          } else if (event.type === 'error') {
            return { ok: false, error: event.message, metadata: { progress: events } }
          } else {
            completed = event
          }
        }
        if (!completed) return { ok: false, error: 'Local Dream ended without a completed image' }
        return { ok: true, data: completed, metadata: { progress: events } }
      },
    },
    {
      id: 'localdream.upscale',
      name: 'Upscale with Local Dream',
      description: 'Upscale a raw RGB Local Dream image by 4x using one of the installed Local Dream upscalers. Call localdream.list_models to discover upscaler IDs. The image may be an artifact:// reference returned from a previous raw Local Dream generation.',
      risk: 'write',
      permissions: ['network', 'local-app-control', 'local-files'],
      inputSchema: objectSchema(
        {
          image: { type: 'string', description: 'Raw RGB base64 image or artifact:// reference from Local Dream generation.' },
          width: { type: 'integer', minimum: 1 },
          height: { type: 'integer', minimum: 1 },
          upscaler_id: { type: 'string', description: 'Installed upscaler ID from localdream.list_models.' },
          use_opencl: { type: 'boolean', description: 'Optional OpenCL acceleration for MNN upscalers.' },
        },
        ['image', 'width', 'height', 'upscaler_id'],
      ),
      execute: async (input, context) => {
        const value = input as {
          image: string
          width: number
          height: number
          upscaler_id: string
          use_opencl?: boolean
        }

        const artifact = context.artifacts?.get(value.image)
        if (artifact?.metadata.format && artifact.metadata.format !== 'raw') {
          return {
            ok: false,
            error: `Local Dream upscale requires a raw RGB artifact; received ${artifact.metadata.format}`,
          }
        }

        const catalog = await connector.listModels(context.signal)
        const upscaler = catalog.upscalers.find((item) => item.id === value.upscaler_id)
        if (!upscaler) {
          return {
            ok: false,
            error: `Unknown Local Dream upscaler: ${value.upscaler_id}`,
            metadata: { available_upscalers: catalog.upscalers.map((item) => item.id) },
          }
        }

        const image = context.artifacts?.resolveData(value.image) ?? value.image
        const result = await connector.upscale(
          {
            image,
            width: value.width,
            height: value.height,
            upscalerPath: upscaler.path,
            useOpenCl: value.use_opencl,
          },
          context.signal,
        )
        return { ok: true, data: result }
      },
    },
    {
      id: 'localdream.stop',
      name: 'Stop Local Dream backend',
      description: 'Stop the active Local Dream generation backend.',
      risk: 'write',
      permissions: ['network', 'local-app-control'],
      inputSchema: objectSchema({ model_id: { type: 'string' } }),
      execute: async (input, context) => {
        const value = input as { model_id?: string }
        return { ok: true, data: await connector.stop(value.model_id, context.signal) }
      },
    },
  ]
}
