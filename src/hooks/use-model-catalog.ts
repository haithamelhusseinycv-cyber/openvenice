import { useQueries } from '@tanstack/react-query'
import { venice } from '../lib/venice-client'
import type { ModelsResponse } from '../types/venice'
import {
  ALLOWED_CHAT_MODEL_IDS,
  ALLOWED_IMAGE_MODEL_IDS,
} from '../lib/allowed-models'

export type ModelCatalog = {
  text: string[]
  image: string[]
  tts: string[]
  music: string[]
  video: string[]
}

function extractAllowed(resp: ModelsResponse | undefined, allowed: readonly string[]): string[] {
  if (!resp) return []
  const available = new Set(
    resp.data
      .filter((m) => !m.model_spec?.offline)
      .map((m) => m.id),
  )
  return allowed.filter((id) => available.has(id))
}

export function useModelCatalog() {
  const queries = useQueries({
    queries: (['text', 'image'] as const).map((type) => ({
      queryKey: ['models', type],
      queryFn: () => venice<ModelsResponse>(`/models?type=${type}`, { noAuth: true }),
      staleTime: 10 * 60 * 1000,
    })),
  })

  const catalog: ModelCatalog = {
    text: extractAllowed(queries[0].data, ALLOWED_CHAT_MODEL_IDS),
    image: extractAllowed(queries[1].data, ALLOWED_IMAGE_MODEL_IDS),
    tts: [],
    music: [],
    video: [],
  }

  const isLoading = queries.some((q) => q.isLoading)
  return { catalog, isLoading }
}
