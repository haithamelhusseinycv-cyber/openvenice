import { useQuery } from '@tanstack/react-query'
import { venice } from '../lib/venice-client'
import {
  ALLOWED_CHAT_MODEL_IDS,
  ALLOWED_EDIT_MODEL_IDS,
  ALLOWED_IMAGE_MODEL_IDS,
  isAllowedChatModel,
  isAllowedEditModel,
  isAllowedImageModel,
  isAllowedVideoModel,
} from '../lib/allowed-models'
import type {
  ModelsResponse,
  VeniceModel,
} from '../types/venice'

type VeniceType = 'text' | 'image' | 'inpaint' | 'video'

const PRIORITY: Record<VeniceType, string[]> = {
  image: [...ALLOWED_IMAGE_MODEL_IDS],
  inpaint: [...ALLOWED_EDIT_MODEL_IDS],
  text: [...ALLOWED_CHAT_MODEL_IDS],
  video: [],
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
  if (type === 'video') return 'video'
  if (!type || type === 'text' || type === 'chat' || type === 'llm') return 'text'
  return null
}

function isAllowed(model: VeniceModel, bucket: VeniceType | null) {
  if (!bucket) return false
  if (bucket === 'text') return isAllowedChatModel(model.id)
  if (bucket === 'image') return isAllowedImageModel(model.id)
  if (bucket === 'video') return isAllowedVideoModel(model.id)
  return isAllowedEditModel(model.id)
}

function getRank(model: VeniceModel, bucket: VeniceType | null) {
  if (!bucket) return 9999
  const order = PRIORITY[bucket].map(normalize)
  const byId = order.indexOf(normalize(model.id))
  return byId === -1 ? 9999 : byId
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
  const seen = new Map<string, VideoModelGroup>()
  for (const model of query.data || []) {
    const id = model.id.toLowerCase()
    const name = (model.model_spec?.name || model.id)
      .replace(/\s*\((text|image)[- ]to[- ]video\)/i, '')
      .replace(/[- ](text|image)[- ]to[- ]video$/i, '')
      .trim()
    const group = seen.get(name) || { name, sets: model.model_spec?.model_sets || [] }
    if (id.includes('image-to-video') || id.includes('i2v')) group.imageModel = model
    else group.textModel = model
    seen.set(name, group)
  }
  groups.push(...seen.values())
  return { ...query, groups }
}
