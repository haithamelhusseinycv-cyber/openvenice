import { useQuery } from '@tanstack/react-query'
import { venice } from '../lib/venice-client'
import {
  isAllowedChatModel,
  isAllowedEditModel,
  isAllowedImageModel,
} from '../lib/allowed-models'
import { rankIds, type CapabilityId } from '../lib/preferred-models'
import type {
  ModelsResponse,
  VeniceModel,
} from '../types/venice'

type VeniceType = 'text' | 'image' | 'inpaint'

/**
 * Preference order lives in `preferred-models.ts` (uncensored-first per
 * capability). Discovery still decides membership; this only decides sequence.
 */
const CAPABILITY: Record<VeniceType, CapabilityId> = {
  text: 'chat',
  image: 'image',
  inpaint: 'edit',
}

function getBucket(type?: string): VeniceType | null {
  if (type === 'image') return 'image'
  if (type === 'inpaint' || type === 'edit') return 'inpaint'
  if (!type || type === 'text' || type === 'chat' || type === 'llm') return 'text'
  return null
}

function isAllowed(model: VeniceModel, bucket: VeniceType | null) {
  if (!bucket) return false
  if (bucket === 'text') return isAllowedChatModel(model.id)
  if (bucket === 'image') return isAllowedImageModel(model.id)
  return isAllowedEditModel(model.id)
}

export function useModels(type?: string, enabled = true) {
  const bucket = getBucket(type)

  return useQuery({
    queryKey: ['models', type],
    queryFn: () => venice<ModelsResponse>(`/models${type ? `?type=${type}` : ''}`),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    select: (data) => {
      const allowed: VeniceModel[] = data.data
        .filter((m) => !m.model_spec?.offline)
        .filter((m) => isAllowed(m, bucket))
      if (!bucket) return allowed

      const byId = new Map<string, VeniceModel>(allowed.map((model) => [model.id, model]))
      return rankIds(allowed.map((model) => model.id), CAPABILITY[bucket])
        .map((id) => byId.get(id))
        .filter((model): model is VeniceModel => Boolean(model))
    },
  })
}

export interface VideoModelGroup {
  name: string
  textModel?: VeniceModel
  imageModel?: VeniceModel
  sets: string[]
}

export function useVideoModels() {
  const query = useModels('video')
  const groups: VideoModelGroup[] = []
  return { ...query, groups }
}
