export const ALLOWED_CHAT_MODEL_IDS = [
  'qwen-3-6-plus',
  'venice-uncensored',
  'venice-uncensored-1-2',
  'olafangensan-glm-4.7-flash-heretic',
  'olafangensan-glm-4-7-flash-heretic',
] as const

// IDs seed priority and support older catalogues. Live uncensored metadata
// admits newly available models without another app release.
export const ALLOWED_IMAGE_MODEL_IDS = [
  'lustify-v8', 'lustify-v7', 'lustify-sdxl', 'seedream-v5-pro',
  'seedream-v5-lite', 'seedream-v4', 'qwen-image-3-pro', 'qwen-image-3',
  'krea-2-turbo', 'chroma', 'wai-illustrious',
  'qwen-image', 'qwen-image-2', 'qwen-image-2-pro',
] as const

export const ALLOWED_EDIT_MODEL_IDS = [
  'qwen-edit-uncensored', 'qwen-image-3-pro-edit', 'qwen-image-3-edit',
  'seedream-v5-pro-edit', 'seedream-v5-lite-edit', 'seedream-v4-edit',
  'firered-image-edit', 'qwen-image-2-edit', 'qwen-image-2-pro-edit',
] as const

export const DEFAULT_CHAT_MODEL_ID = 'qwen-3-6-plus'
export const FALLBACK_CHAT_MODEL_ID = 'venice-uncensored'
export const DEFAULT_IMAGE_MODEL_ID = 'lustify-v8'
export const DEFAULT_EDIT_MODEL_ID = 'qwen-edit-uncensored'

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

export function isAllowedImageModel(id?: string, uncensored?: boolean) {
  if (!id) return false
  return uncensored === true || (ALLOWED_IMAGE_MODEL_IDS as readonly string[]).includes(normalized(id))
}

export function isAllowedEditModel(id?: string, uncensored?: boolean) {
  if (!id) return false
  return uncensored === true || (ALLOWED_EDIT_MODEL_IDS as readonly string[]).includes(normalized(id))
}

export function isAllowedVideoModel(id?: string) {
  if (!id) return false
  const value = normalized(id)
  return VIDEO_EXTREME_MARKERS.some((marker) => value.includes(marker))
}

export function isVisibleTab(tab?: string): tab is VisibleTab {
  return !!tab && (VISIBLE_TABS as readonly string[]).includes(tab)
}
