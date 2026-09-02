import type { AgentTool } from '../types'
import { LocalDreamConnector, type LocalDreamGenerateRequest } from '../../connectors/localdream/localdream-connector'

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
})

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
      description: 'List downloaded Local Dream generation models, defaults, supported resolutions, and upscalers.',
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
      description: 'Run Local Dream text-to-image, img2img, or inpaint. Include image for img2img; include image and mask for inpaint.',
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
          image: { type: 'string', description: 'Base64-encoded input image payload.' },
          mask: { type: 'string', description: 'Base64-encoded mask payload.' },
          output_format: { enum: ['raw', 'jpeg', 'png'] },
        },
        ['prompt'],
      ),
      execute: async (input, context) => {
        const events = []
        let completed: unknown
        for await (const event of connector.generate(input as LocalDreamGenerateRequest, context.signal)) {
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
