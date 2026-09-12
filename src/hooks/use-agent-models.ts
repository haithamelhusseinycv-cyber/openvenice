import { useMemo } from 'react'
import { useModels } from './use-models'
import {
  ALLOWED_CHAT_MODEL_IDS,
  isAllowedChatModel,
} from '../lib/allowed-models'
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

export const ALLOWED_AGENT_MODELS = ALLOWED_CHAT_MODEL_IDS

const MODEL_ORDER = new Map<string, number>(
  ALLOWED_AGENT_MODELS.map((id, index) => [id, index]),
)

export function useAgentModels() {
  const { data, isLoading } = useModels('text')

  const models = useMemo<AgentModel[]>(() => {
    if (!data) return []

    return data
      .filter((m) => isAllowedChatModel(m.id))
      .filter((m) => !m.model_spec?.offline)
      .map<AgentModel>((m) => {
        const caps = m.model_spec?.capabilities ?? {}
        const traits = m.model_spec?.traits ?? []

        return {
          id: m.id,
          name: m.model_spec?.name || m.id,
          capabilities: {
            ...caps,
            supportsFunctionCalling: false,
          },
          traits,
          contextTokens:
            m.model_spec?.availableContextTokens,
          recommended: MODEL_ORDER.get(m.id) !== undefined,
          tier: MODEL_ORDER.get(m.id) ?? 999,
          reasoning:
            caps.supportsReasoning === true,
          uncensored:
            traits.includes('most_uncensored')
            || m.id.includes('uncensored')
            || m.id.includes('heretic'),
        }
      })
      .sort((a, b) => {
        const orderA = MODEL_ORDER.get(a.id) ?? 999
        const orderB = MODEL_ORDER.get(b.id) ?? 999
        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name)
      })
  }, [data])

  const modelListLoading = isLoading && models.length === 0

  return {
    models,
    isLoading: modelListLoading,
  }
}

export function findAgentModel(
  models: AgentModel[],
  id: string,
): AgentModel | undefined {
  return models.find((m) => m.id === id)
}
