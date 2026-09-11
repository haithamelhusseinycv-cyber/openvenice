export const ALLOWED_CHAT_MODEL_IDS = [
  'olafangensan-glm-4.7-flash-heretic',
  'olafangensan-glm-4-7-flash-heretic',
] as const

/**
 * Venice adult image line only. General Flux/Seedream/Qwen-image stay out.
 */
export const ALLOWED_IMAGE_MODEL_IDS = [
  'lustify-v8',
  'lustify-v7',
  'lustify-sdxl',
] as const

export const ALLOWED_EDIT_MODEL_IDS = [
  'qwen-edit-uncensored',
] as const

export const DEFAULT_CHAT_MODEL_ID = 'olafangensan-glm-4.7-flash-heretic'
export const FALLBACK_CHAT_MODEL_ID = 'olafangensan-glm-4-7-flash-heretic'
export const DEFAULT_IMAGE_MODEL_ID = 'lustify-v8'
export const DEFAULT_EDIT_MODEL_ID = 'qwen-edit-uncensored'

const IMAGE_MODEL_FAMILY_PREFIXES = ['lustify'] as const
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
