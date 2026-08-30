export const ALLOWED_CHAT_MODEL_IDS = [
  'venice-uncensored-1-2',
  'venice-uncensored-role-play',
  'qwen-3-6-plus',
  'olafangensan-glm-4.7-flash-heretic',
  'olafangensan-glm-4-7-flash-heretic',
] as const

/**
 * The API response remains authoritative: IDs listed here are only displayed
 * when Venice actually returns them as online. Forward-looking aliases let a
 * newly enabled Venice model appear without another frontend release.
 */
export const ALLOWED_IMAGE_MODEL_IDS = [
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

export const DEFAULT_CHAT_MODEL_ID = 'venice-uncensored-1-2'
export const DEFAULT_IMAGE_MODEL_ID = 'flux-2-max'
export const DEFAULT_EDIT_MODEL_ID = 'qwen-edit-uncensored'

export const VISIBLE_TABS = ['chat', 'image', 'playground'] as const
export type VisibleTab = (typeof VISIBLE_TABS)[number]

export function isAllowedChatModel(id?: string) {
  return !!id && (ALLOWED_CHAT_MODEL_IDS as readonly string[]).includes(id)
}

export function isAllowedImageModel(id?: string) {
  return !!id && (ALLOWED_IMAGE_MODEL_IDS as readonly string[]).includes(id.toLowerCase())
}

export function isVisibleTab(tab?: string): tab is VisibleTab {
  return !!tab && (VISIBLE_TABS as readonly string[]).includes(tab)
}
