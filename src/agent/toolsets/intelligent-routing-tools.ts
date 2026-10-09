import { createImageStudioTools } from './image-studio-tools'
import type { AgentTool } from '../types'
import { routeIntelligently, enhancePromptForNSFW, type RoutingInput } from '../intelligent-router'
import { LocalDreamCloudConnector, type CloudOperation } from '../../connectors/localdream/cloud-connector'

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
})

export function createIntelligentRoutingTools(cloudConnector = new LocalDreamCloudConnector(localStorage)): AgentTool[] {
  return [
    ...createImageStudioTools(),
    {
      id: 'intelligent.analyze_and_route',
      name: 'Analyze and route intelligently',
      description: 'Keyword intent hint only; does not inspect pixels. Use intelligent.run_image_workflow for visual reasoning and automatic model settings. Returns routing decision with reasoning. Use this BEFORE calling generation tools to ensure optimal configuration.',
      risk: 'read',
      permissions: ['network'],
      inputSchema: objectSchema(
        {
          prompt: { type: 'string', description: 'User prompt describing what they want' },
          has_images: { type: 'boolean', description: 'Whether user provided images' },
          image_count: { type: 'integer', minimum: 0, description: 'Number of images provided' },
          preferred_quality: { type: 'string', enum: ['best'], description: 'Optional quality preference' },
        },
        ['prompt', 'has_images', 'image_count'],
      ),
      execute: async (input) => {
        const raw = input as { prompt: string; has_images: boolean; image_count: number }
        const value: RoutingInput = { prompt: raw.prompt, hasImages: raw.has_images, imageCount: raw.image_count, userExplicitPreferences: { quality: 'best' } }
        const decision = routeIntelligently(value)

        return {
          ok: true,
          data: {
            ...decision,
            enhanced_prompt: enhancePromptForNSFW(value.prompt),
            recommendation: buildRecommendation(decision),
          },
        }
      },
    },
    {
      id: 'intelligent.submit_cloud_auto',
      name: 'Submit to cloud with intelligent routing',
      description: 'Automatically submit a cloud job using intelligent routing. Analyzes the prompt, selects the best operation and settings, then submits. Minimal user input required. Returns job ID and reasoning.',
      risk: 'write',
      permissions: ['network', 'local-app-control'],
      inputSchema: objectSchema(
        {
          prompt: { type: 'string', description: 'User prompt' },
          image_handles: { type: 'array', items: { type: 'string' }, description: 'Array of uploaded image handles (filenames)' },
          budget_usd: { type: 'number', minimum: 0.01, maximum: 5, description: 'GPU cost limit' },
        },
        ['prompt'],
      ),
      execute: async (input, context) => {
        const value = input as {
          prompt: string
          image_handles?: string[]
          budget_usd?: number
        }

        const routingInput: RoutingInput = {
          prompt: value.prompt,
          hasImages: Boolean(value.image_handles?.length),
          imageCount: value.image_handles?.length ?? 0,
        }

        const decision = routeIntelligently({ ...routingInput, userExplicitPreferences: { quality: 'best' } })
        const enhancedPrompt = enhancePromptForNSFW(value.prompt)

        const cloudRequest = {
          operation: 'auto' as CloudOperation, // Backend vision planner applies validated settings, never keyword-only routing.
          prompt: enhancedPrompt,
          image: value.image_handles?.[0],
          references: value.image_handles?.slice(1).filter(Boolean),
          max_cost_usd: value.budget_usd ?? 1,
        }

        const job = await cloudConnector.submit(cloudRequest, context.signal)

        return {
          ok: true,
          data: {
            job_id: job.id,
            state: job.state,
            message: job.message,
            routing: decision,
            enhanced_prompt: enhancedPrompt,
          },
        }
      },
    },
  ]
}

function buildRecommendation(decision: ReturnType<typeof routeIntelligently>): string {
  const parts: string[] = []

  parts.push(`Intent: ${decision.intent.replace(/_/g, ' ')}`)
  parts.push(`Quality: ${decision.quality}`)
  parts.push(decision.useCloud ? 'Using cloud GPU for best results' : 'Using local generation for speed')
  parts.push(`Operation: ${decision.operation}`)

  if (Object.keys(decision.autoSettings).length > 0) {
    parts.push(`Auto-configured: ${Object.keys(decision.autoSettings).join(', ')}`)
  }

  return parts.join('. ')
}
