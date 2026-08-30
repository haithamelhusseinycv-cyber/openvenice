export const ALLOWED_CHAT_MODEL_IDS = [
  'venice-uncensored-1-2',
  'venice-uncensored-role-play',
  'qwen-3-6-plus',
  'olafangensan-glm-4.7-flash-heretic',
  'olafangensan-glm-4-7-flash-heretic',
] as const

export const ALLOWED_IMAGE_MODEL_IDS = [
  'lustify-v8',
  'lustify-v7',
  'lustify-sdxl',
] as const

export const ALLOWED_EDIT_MODEL_IDS = [
  'qwen-edit-uncensored',
  'firered-image-edit',
] as const

export const DEFAULT_CHAT_MODEL_ID = 'venice-uncensored-1-2'
export const DEFAULT_IMAGE_MODEL_ID = 'lustify-v8'
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
