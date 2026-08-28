import { useQuery } from '@tanstack/react-query'
import { venice } from '../lib/venice-client'
import type { ModelsResponse, VeniceModel, VideoConstraints } from '../types/venice'
import {
  ALLOWED_CHAT_MODEL_IDS,
  ALLOWED_IMAGE_MODEL_IDS,
  ALLOWED_INPAINT_MODEL_IDS,
} from '../lib/allowed-models'

type VeniceType = 'text' | 'image' | 'inpaint'

const ALLOWED_MODELS: Record<VeniceType, readonly string[]> = {
  text: ALLOWED_CHAT_MODEL_IDS,
  image: ALLOWED_IMAGE_MODEL_IDS,
  inpaint: ALLOWED_INPAINT_MODEL_IDS,
}

function getModelName(model: VeniceModel) {
  return model.model_spec?.name || model.id
}

function getBucket(type?: string): VeniceType | null {
  if (type === 'image') return 'image'
  if (type === 'inpaint' || type === 'edit') return 'inpaint'
  if (!type || type === 'text' || type === 'chat' || type === 'llm') return 'text'
  return null
}

function isAllowed(model: VeniceModel, bucket: VeniceType | null) {
  if (!bucket) return false
  return ALLOWED_MODELS[bucket].includes(model.id as never)
}

function getRank(model: VeniceModel, bucket: VeniceType | null) {
  if (!bucket) return 9999
  const rank = ALLOWED_MODELS[bucket].indexOf(model.id as never)
  return rank === -1 ? 9999 : rank
}

export function useModels(type?: string) {
  const bucket = getBucket(type)

  return useQuery({
    queryKey: ['models', type],
    queryFn: () => venice<ModelsResponse>(`/models${type ? `?type=${type}` : ''}`),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (data) =>
      data.data
        .filter((model) => !model.model_spec?.offline)
        .filter((model) => isAllowed(model, bucket))
        .sort((a, b) => {
          const rankDiff = getRank(a, bucket) - getRank(b, bucket)
          if (rankDiff !== 0) return rankDiff
          return getModelName(a).localeCompare(getModelName(b))
        }),
  })
}

// Kept for legacy code imports. Video is disabled, so useModels('video') returns no models.
export interface VideoModelGroup {
  name: string
  textModel?: VeniceModel
  imageModel?: VeniceModel
  sets: string[]
}

export function useVideoModels() {
  const query = useModels('video')
  const groups: VideoModelGroup[] = []

  if (query.data) {
    const map = new Map<string, VideoModelGroup>()
    for (const model of query.data) {
      const constraints = model.model_spec?.constraints as VideoConstraints | undefined
      if (!constraints) continue
      const name = getModelName(model)
      const key = name.toLowerCase()
      if (!map.has(key)) map.set(key, { name, sets: model.model_spec?.model_sets || [] })
      const group = map.get(key)!
      if (constraints.model_type === 'text-to-video') group.textModel = model
      else if (constraints.model_type === 'image-to-video') group.imageModel = model
      for (const setName of model.model_spec?.model_sets || []) {
        if (!group.sets.includes(setName)) group.sets.push(setName)
      }
    }
    groups.push(...map.values())
  }

  return { ...query, groups }
}
