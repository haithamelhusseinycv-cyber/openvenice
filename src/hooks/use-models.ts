import { useQuery } from '@tanstack/react-query'
import { venice } from '../lib/venice-client'
import {
  ALLOWED_CHAT_MODEL_IDS,
  ALLOWED_EDIT_MODEL_IDS,
  ALLOWED_IMAGE_MODEL_IDS,
  isAllowedChatModel,
  isAllowedEditModel,
  isAllowedImageModel,
} from '../lib/allowed-models'
import type {
  ModelsResponse,
  VeniceModel,
} from '../types/venice'

type VeniceType = 'text' | 'image' | 'inpaint'

const PRIORITY: Record<VeniceType, string[]> = {
  image: [...ALLOWED_IMAGE_MODEL_IDS],
  inpaint: [...ALLOWED_EDIT_MODEL_IDS],
  text: [...ALLOWED_CHAT_MODEL_IDS],
}

function normalize(value?: string) {
  return (value || '').trim().toLowerCase().replace(/\./g, '-')
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
  if (bucket === 'text') return isAllowedChatModel(model.id)
  if (bucket === 'image') return isAllowedImageModel(model.id)
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
  return { ...query, groups }
}
