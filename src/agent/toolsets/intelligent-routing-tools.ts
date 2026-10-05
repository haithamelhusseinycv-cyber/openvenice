import type { AgentTool } from '../types'
import { routeIntelligently, enhancePromptForNSFW, type RoutingInput } from '../intelligent-router'
import { LocalDreamCloudConnector, type CloudOperation } from '../../connectors/localdream/cloud-connector'

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
})

export function createIntelligentRoutingTools(cloudConnector = new LocalDreamCloudConnector()): AgentTool[] {
  return [
    {
      id: 'intelligent.analyze_and_route',
      name: 'Analyze and route intelligently',
      description: 'Analyze user prompt and images, then automatically select the optimal workflow, operation, quality tier, and settings. Returns routing decision with reasoning. Use this BEFORE calling generation tools to ensure optimal configuration.',
      risk: 'read',
      permissions: ['network'],
      inputSchema: objectSchema(
        {
          prompt: { type: 'string', description: 'User prompt describing what they want' },
          has_images: { type: 'boolean', description: 'Whether user provided images' },
          image_count: { type: 'integer', minimum: 0, description: 'Number of images provided' },
          preferred_quality: { type: 'string', enum: ['fast', 'balanced', 'best'], description: 'Optional quality preference' },
        },
        ['prompt', 'has_images', 'image_count'],
      ),
      execute: async (input) => {
        const value = input as RoutingInput
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

        const decision = routeIntelligently(routingInput)
        const enhancedPrompt = enhancePromptForNSFW(value.prompt)

        const cloudRequest = {
          operation: decision.operation as CloudOperation,
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
