import { useQuery } from '@tanstack/react-query'
import { venice } from '../lib/venice-client'
import type {
  ModelsResponse,
  VeniceModel,
  VideoConstraints,
} from '../types/venice'
import {
  ALLOWED_CHAT_MODEL_IDS,
  ALLOWED_IMAGE_MODEL_IDS,
  ALLOWED_INPAINT_MODEL_IDS,
  CHAT_MODEL_LABELS,
  IMAGE_MODEL_LABELS,
  INPAINT_MODEL_LABELS,
} from '../lib/allowed-models'

type VeniceType = 'text' | 'image' | 'inpaint'

type AllowedConfig = {
  ids: readonly string[]
  names: string[]
}

const ALLOWED_MODELS: Record<VeniceType, AllowedConfig> = {
  image: {
    ids: ALLOWED_IMAGE_MODEL_IDS,
    names: Object.values(IMAGE_MODEL_LABELS),
  },
  inpaint: {
    ids: ALLOWED_INPAINT_MODEL_IDS,
    names: Object.values(INPAINT_MODEL_LABELS),
  },
  text: {
    ids: ALLOWED_CHAT_MODEL_IDS,
    names: Object.values(CHAT_MODEL_LABELS),
  },
}

const PRIORITY: Record<VeniceType, string[]> = {
  image: [...ALLOWED_IMAGE_MODEL_IDS, ...Object.values(IMAGE_MODEL_LABELS)],
  inpaint: [...ALLOWED_INPAINT_MODEL_IDS, ...Object.values(INPAINT_MODEL_LABELS)],
  text: [...ALLOWED_CHAT_MODEL_IDS, ...Object.values(CHAT_MODEL_LABELS)],
}

function normalize(value?: string) {
  return (value || '').trim().toLowerCase()
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
  const allowed = ALLOWED_MODELS[bucket]
  const modelId = normalize(model.id)
  const modelName = normalize(getModelName(model))
  return (
    allowed.ids.map(normalize).includes(modelId) ||
    allowed.names.map(normalize).includes(modelName)
  )
}

function getRank(model: VeniceModel, bucket: VeniceType | null) {
  if (!bucket) return 9999
  const order = PRIORITY[bucket].map(normalize)
  const modelId = normalize(model.id)
  const modelName = normalize(getModelName(model))
  const byId = order.indexOf(modelId)
  if (byId !== -1) return byId
  const byName = order.indexOf(modelName)
  if (byName !== -1) return byName
  return 9999
}

export function useModels(type?: string) {
  const bucket = getBucket(type)

  return useQuery({
    queryKey: ['models', type],
    queryFn: () =>
      venice<ModelsResponse>(
        `/models${type ? `?type=${type}` : ''}`,
      ),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    select: (data) =>
      data.data
        .filter((m) => !m.model_spec?.offline)
        .filter((m) => isAllowed(m, bucket))
        .sort((a, b) => {
          const rankDiff = getRank(a, bucket) - getRank(b, bucket)
          if (rankDiff !== 0) return rankDiff
          return getModelName(a).localeCompare(getModelName(b))
        }),
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

  if (query.data) {
    const map = new Map<string, VideoModelGroup>()
    for (const m of query.data) {
      const c = m.model_spec?.constraints as VideoConstraints | undefined
      if (!c) continue
      const name = getModelName(m)
      const key = name.toLowerCase()
      if (!map.has(key)) {
        map.set(key, { name, sets: m.model_spec?.model_sets || [] })
      }
      const group = map.get(key)!
      if (c.model_type === 'text-to-video') group.textModel = m
      else if (c.model_type === 'image-to-video') group.imageModel = m
      for (const s of m.model_spec?.model_sets || []) {
        if (!group.sets.includes(s)) group.sets.push(s)
      }
    }
    groups.push(...map.values())
  }

  return { ...query, groups }
}
