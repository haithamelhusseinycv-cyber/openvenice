export const ALLOWED_CHAT_MODEL_IDS = [
  'qwen-3-6-plus',
  'venice-uncensored',
  'venice-uncensored-1-2',
  'olafangensan-glm-4.7-flash-heretic',
  'olafangensan-glm-4-7-flash-heretic',
] as const

/**
 * Adult-first image line. Lustify stays default; Seedream V5 Pro is the
 * high-quality selectable. General Flux stays out of this picker.
 */
export const ALLOWED_IMAGE_MODEL_IDS = [
  'lustify-v8',
  'lustify-v7',
  'lustify-sdxl',
  'seedream-v5-pro',
] as const

export const ALLOWED_EDIT_MODEL_IDS = [
  'qwen-edit-uncensored',
  'qwen-image-3-pro-edit',
] as const

export const DEFAULT_CHAT_MODEL_ID = 'qwen-3-6-plus'
export const FALLBACK_CHAT_MODEL_ID = 'venice-uncensored'
export const DEFAULT_IMAGE_MODEL_ID = 'lustify-v8'
export const DEFAULT_EDIT_MODEL_ID = 'qwen-edit-uncensored'

const IMAGE_MODEL_FAMILY_PREFIXES = ['lustify', 'seedream-v5-pro'] as const
const EDIT_EXTREME_MARKERS = ['uncensored', 'heretic', 'abliterat'] as const
const CHAT_EXTREME_MARKERS = ['heretic', 'abliterat'] as const
const VIDEO_EXTREME_MARKERS = ['enhanced', 'uncensored', 'heretic', 'abliterat', 'private', 'lustify'] as const

export const VISIBLE_TABS = ['playground', 'image'] as const
export type VisibleTab = (typeof VISIBLE_TABS)[number]

function normalized(id?: string) {
  return (id || '').toLowerCase()
}

export function isAllowedChatModel(id?: string) {
  if (!id) return false
  const value = normalized(id)
  return (ALLOWED_CHAT_MODEL_IDS as readonly string[]).includes(value)
    || value.startsWith('venice-uncensored')
    || CHAT_EXTREME_MARKERS.some((marker) => value.includes(marker))
}

export function isAllowedImageModel(id?: string) {
  if (!id) return false
  const value = normalized(id)
  return (ALLOWED_IMAGE_MODEL_IDS as readonly string[]).includes(value)
    || IMAGE_MODEL_FAMILY_PREFIXES.some((prefix) => value.startsWith(prefix))
}

export function isAllowedEditModel(id?: string) {
  if (!id) return false
  const value = normalized(id)
  return (ALLOWED_EDIT_MODEL_IDS as readonly string[]).includes(value)
    || (EDIT_EXTREME_MARKERS.some((marker) => value.includes(marker)) && value.includes('edit'))
}

export function isAllowedVideoModel(id?: string) {
  if (!id) return false
  const value = normalized(id)
  return VIDEO_EXTREME_MARKERS.some((marker) => value.includes(marker))
}

export function isVisibleTab(tab?: string): tab is VisibleTab {
  return !!tab && (VISIBLE_TABS as readonly string[]).includes(tab)
}
