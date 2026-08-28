export const ALLOWED_CHAT_MODEL_IDS = [
  'venice-uncensored-1-2',
  'venice-uncensored-role-play',
  'qwen-3-6-plus',
  'olafangensan-glm-4-7-flash-heretic',
] as const

export const ALLOWED_IMAGE_MODEL_IDS = [
  'lustify-v8',
  'lustify-v7',
  'lustify-sdxl',
] as const

export const ALLOWED_INPAINT_MODEL_IDS = [
  'qwen-edit-uncensored',
  'firered-image-edit',
] as const

export const DEFAULT_CHAT_MODEL_ID = 'venice-uncensored-1-2'
export const DEFAULT_IMAGE_MODEL_ID = 'lustify-v8'
export const DEFAULT_INPAINT_MODEL_ID = 'qwen-edit-uncensored'
export const DEFAULT_CHAT_MAX_TOKENS = 1024
export const DEFAULT_AGENT_MAX_TOKENS = 1536

export const CHAT_MODEL_LABELS: Record<(typeof ALLOWED_CHAT_MODEL_IDS)[number], string> = {
  'venice-uncensored-1-2': 'Venice Uncensored 1.2',
  'venice-uncensored-role-play': 'Venice Role Play Uncensored',
  'qwen-3-6-plus': 'Qwen 3.6 Plus Uncensored',
  'olafangensan-glm-4-7-flash-heretic': 'GLM 4.7 Flash Heretic',
}

export const IMAGE_MODEL_LABELS: Record<(typeof ALLOWED_IMAGE_MODEL_IDS)[number], string> = {
  'lustify-v8': 'Lustify v8',
  'lustify-v7': 'Lustify v7',
  'lustify-sdxl': 'Lustify SDXL',
}

export const INPAINT_MODEL_LABELS: Record<(typeof ALLOWED_INPAINT_MODEL_IDS)[number], string> = {
  'qwen-edit-uncensored': 'Qwen Edit Uncensored',
  'firered-image-edit': 'FireRed Edit',
}

export const ENABLED_APP_TABS = ['chat', 'image', 'workflows', 'playground'] as const
export const DISABLED_APP_TABS = ['audio', 'music', 'video', 'embeddings'] as const

export type EnabledAppTab = (typeof ENABLED_APP_TABS)[number]

export const ENABLED_WORKFLOW_NODE_TYPES = ['textInput', 'output', 'chat', 'imageGen'] as const

export function isAllowedChatModel(id?: string) {
  return !!id && (ALLOWED_CHAT_MODEL_IDS as readonly string[]).includes(id)
}

export function isAllowedImageModel(id?: string) {
  return !!id && (ALLOWED_IMAGE_MODEL_IDS as readonly string[]).includes(id)
}

export function isAllowedInpaintModel(id?: string) {
  return !!id && (ALLOWED_INPAINT_MODEL_IDS as readonly string[]).includes(id)
}

export function isEnabledAppTab(tab?: string): tab is EnabledAppTab {
  return !!tab && (ENABLED_APP_TABS as readonly string[]).includes(tab)
}

export function resolveChatModel(id?: string) {
  return isAllowedChatModel(id) ? id! : DEFAULT_CHAT_MODEL_ID
}

export function resolveImageModel(id?: string) {
  return isAllowedImageModel(id) ? id! : DEFAULT_IMAGE_MODEL_ID
}

export function resolveInpaintModel(id?: string) {
  return isAllowedInpaintModel(id) ? id! : DEFAULT_INPAINT_MODEL_ID
}
