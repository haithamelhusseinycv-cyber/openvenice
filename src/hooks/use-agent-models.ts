import { useMemo } from 'react'
import { useModels } from './use-models'
import type { ModelCapabilities, ModelTrait } from '../types/venice'
import { ALLOWED_CHAT_MODEL_IDS } from '../lib/allowed-models'

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

const MODEL_ORDER = new Map<string, number>(
  ALLOWED_CHAT_MODEL_IDS.map((id, index) => [id, index]),
)

export function useAgentModels() {
  const { data, isLoading } = useModels('text')

  const models = useMemo<AgentModel[]>(() => {
    if (!data) return []
    return data
      .filter((m) => MODEL_ORDER.has(m.id))
      .filter((m) => !m.model_spec?.offline)
      .map<AgentModel>((m) => {
        const caps = m.model_spec?.capabilities ?? {}
        const traits = m.model_spec?.traits ?? []
        return {
          id: m.id,
          name: m.model_spec?.name || m.id,
          capabilities: caps,
          traits,
          contextTokens: m.model_spec?.availableContextTokens,
          recommended: true,
          tier: MODEL_ORDER.get(m.id) ?? 999,
          reasoning: caps.supportsReasoning === true,
          uncensored: true,
        }
      })
      .sort((a, b) => (MODEL_ORDER.get(a.id) ?? 999) - (MODEL_ORDER.get(b.id) ?? 999))
  }, [data])

  return { models, isLoading }
}

export function findAgentModel(models: AgentModel[], id: string): AgentModel | undefined {
  return models.find((m) => m.id === id)
}
