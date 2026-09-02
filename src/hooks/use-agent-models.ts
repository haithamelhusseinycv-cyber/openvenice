import { useMemo } from 'react'
import { useModels } from './use-models'
import type {
  ModelCapabilities,
  ModelTrait,
} from '../types/venice'

export interface AgentModel {
  id: string
  name: string
  capabilities: ModelCapabilities
  traits: ModelTrait[]
  contextTokens?: number
  recommended: boolean
  tier: number
  reasoning: boolean
  uncensored: boolean
}

/*
 * The ONLY text / agent models allowed
 * anywhere in this OpenVenice build.
 */
export const ALLOWED_AGENT_MODELS = [
  'qwen-3-8-27b',
  'qwen-3-6-plus',
  'venice-uncensored',
  'venice-uncensored-1-2',
  'venice-uncensored-role-play',
  'zai-org-glm-5-1',
  'olafangensan-glm-4-7-flash-heretic',
] as const

/*
 * Exact UI order.
 */
const MODEL_ORDER = new Map<string, number>(
  ALLOWED_AGENT_MODELS.map((id, index) => [id, index]),
)

export function useAgentModels() {
  const { data, isLoading } = useModels('text')

  const models = useMemo<AgentModel[]>(() => {
    if (!data) return []

    return data

      // Second defensive filter.
      // Even if another part of OpenVenice changes later,
      // nothing outside our selected models reaches the Agent picker.
      .filter((m) =>
        ALLOWED_AGENT_MODELS.includes(
          m.id as (typeof ALLOWED_AGENT_MODELS)[number],
        ),
      )

      .filter((m) => !m.model_spec?.offline)

      .map<AgentModel>((m) => {
        const caps = m.model_spec?.capabilities ?? {}
        const traits = m.model_spec?.traits ?? []

        return {
          id: m.id,
          name: m.model_spec?.name || m.id,

          /*
           * Noor is a conversation-first surface. The legacy function-call
           * runner is a workflow editor, so routing every function-capable
           * model through it can turn an ordinary question into a slow
           * "0 edits" result. Keep the model's other capabilities, but use
           * Noor's direct structured-response path for normal conversation
           * and workflow mutations alike. That path still emits and applies
           * workflow patches when the user actually asks for them.
           */
          capabilities: {
            ...caps,
            supportsFunctionCalling: false,
          },
          traits,
          contextTokens:
            m.model_spec?.availableContextTokens,

          /*
           * All selected models are deliberately approved for Noor,
           * so don't use OpenVenice's old recommendation logic.
           */
          recommended: true,

          /*
           * Tier follows our preferred model order.
           */
          tier: MODEL_ORDER.get(m.id) ?? 999,

          reasoning:
            caps.supportsReasoning === true,

          /*
           * These are intentionally our selected
           * uncensored / least-restricted text models.
           */
          uncensored: true,
        }
      })

      .sort((a, b) => {
        const orderA =
          MODEL_ORDER.get(a.id) ?? 999
        const orderB =
          MODEL_ORDER.get(b.id) ?? 999

        return orderA - orderB
      })
  }, [data])

  /*
   * React Query may report a background/loading state while it already has
   * usable cached model data. Noor should remain send-ready in that case.
   * Only expose "loading" while there is genuinely no compatible model yet.
   */
  const modelListLoading = isLoading && models.length === 0

  return {
    models,
    isLoading: modelListLoading,
  }
}

/*
 * Returns the AgentModel for an exact id.
 * No fallback to an unwanted model.
 */
export function findAgentModel(
  models: AgentModel[],
  id: string,
): AgentModel | undefined {
  return models.find((m) => m.id === id)
}
