export const ALLOWED_CHAT_MODEL_IDS = [
  'qwen-3-8-27b',
  'qwen-3-6-plus',
  'venice-uncensored-1-2',
  'venice-uncensored-role-play',
  'olafangensan-glm-4.7-flash-heretic',
  'olafangensan-glm-4-7-flash-heretic',
] as const

/**
 * The API response remains authoritative: IDs listed here are only displayed
 * when Venice actually returns them as online. Forward-looking aliases let a
 * newly enabled Venice model appear without another frontend release.
 */
export const ALLOWED_IMAGE_MODEL_IDS = [
  'flux',
  'flux-2-max',
  'flux-2-pro',
  'flux-dev',
  'nano-banana',
  'nano-banana-2',
  'nano-banana-2-lite',
  'nano-banana-pro',
  'seedream-v5-pro',
  'seedream-v5-lite',
  'seedream-v4',
  'qwen-image-3-pro',
  'qwen-image-2-pro',
  'lustify-v8',
  'lustify-v7',
  'lustify-sdxl',
] as const

export const ALLOWED_EDIT_MODEL_IDS = [
  'qwen-edit-uncensored',
  'qwen-image-3-pro-edit',
  'qwen-image-2-pro-edit',
  'qwen-edit',
  'flux-2-max-edit',
  'nano-banana-2-edit',
  'nano-banana-2-lite-edit',
  'nano-banana-pro-edit',
  'seedream-v5-pro-edit',
  'seedream-v5-lite-edit',
  'seedream-v4-edit',
  'firered-image-edit',
] as const

export const DEFAULT_CHAT_MODEL_ID = 'qwen-3-8-27b'
export const FALLBACK_CHAT_MODEL_ID = 'qwen-3-6-plus'
export const DEFAULT_IMAGE_MODEL_ID = 'flux-2-max'
export const DEFAULT_EDIT_MODEL_ID = 'qwen-edit-uncensored'

export function normalizeModelId(id?: string) {
  return (id ?? '').trim().toLowerCase().replace(/\./g, '-')
}

// The API response remains authoritative and is already filtered by modality
// and online status. These families allow compatible successors to appear
// automatically without exposing unrelated model types.
const IMAGE_MODEL_FAMILY_PREFIXES = ['flux-', 'nano-banana', 'seedream-v', 'qwen-image-'] as const
const EDIT_MODEL_FAMILY_PREFIXES = [
  'flux-',
  'nano-banana',
  'seedream-v',
  'qwen-edit',
  'qwen-image-',
  'firered-image-edit',
] as const

// Noor is the only conversational surface. Create remains available as the
// dedicated image workspace; the legacy Chat view stays in source for now but
// is intentionally not exposed through app navigation.
export const VISIBLE_TABS = ['playground', 'image'] as const
export type VisibleTab = (typeof VISIBLE_TABS)[number]

export function isAllowedChatModel(id?: string) {
  if (!id) return false
  const normalized = normalizeModelId(id)
  return (ALLOWED_CHAT_MODEL_IDS as readonly string[])
    .map(normalizeModelId)
    .includes(normalized)
}

export function isAllowedImageModel(id?: string) {
  if (!id) return false
  const normalized = normalizeModelId(id)
  return (ALLOWED_IMAGE_MODEL_IDS as readonly string[]).map(normalizeModelId).includes(normalized)
    || IMAGE_MODEL_FAMILY_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

export function isAllowedEditModel(id?: string) {
  if (!id) return false
  const normalized = normalizeModelId(id)
  return (ALLOWED_EDIT_MODEL_IDS as readonly string[]).map(normalizeModelId).includes(normalized)
    || EDIT_MODEL_FAMILY_PREFIXES.some((prefix) => normalized.startsWith(prefix) && normalized.includes('edit'))
}

export function isVisibleTab(tab?: string): tab is VisibleTab {
  return !!tab && (VISIBLE_TABS as readonly string[]).includes(tab)
}
