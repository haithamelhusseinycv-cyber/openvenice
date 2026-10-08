export const ALLOWED_CHAT_MODEL_IDS = [
  'venice-uncensored-1-2',
  'venice-uncensored',
  'qwen-3-6-plus',
  'olafangensan-glm-4.7-flash-heretic',
  'olafangensan-glm-4-7-flash-heretic',
] as const

// NSFW-specialized image generation models - human-grade realistic adult content
export const ALLOWED_IMAGE_MODEL_IDS = [
  // Primary NSFW generation models
  'lustify-v8', 'lustify-v7', 'lustify-sdxl',
  'realvisxl-v5', 'realvisxl-v4', 'realvisxl-v3',
  'juggernaut-xl-v9', 'juggernaut-xl-v8',
  'dreamshaper-xl-v2', 'dreamshaper-xl',
  'majicmix-realistic-v7', 'majicmix-realistic-v6',
  'leosam-hello-world-xl',
  'photon-xl-v1',

  // Specialized NSFW fine-tunes
  'hassanblend-nsfw-v2', 'hassanblend-nsfw',
  'nsfw-realistic-vision-v6', 'realistic-vision-v5',
  'pornmaster-pro-v3', 'pornmaster-pro-v2',
  'adult-realism-xl-v4', 'adult-realism-xl-v3',
  'erotic-dreams-xl-v2',

  // Pony and Illustrious realism models
  'pony-realism-v23-ultra', 'cyberrealistic-pony-v170',
  'realism-illustrious-by-v55-fp16', 'illustrious-v16',

  // Face and body detail models
  'face-detailer-xl-v3', 'face-detailer-xl-v2',
  'skin-texture-pro-v2', 'skin-pores-realism-v3',
  'anatomy-corrector-v2', 'body-proportions-xl',

  // Pose and composition models
  'controlnet-pose-xl-v2', 'openpose-nsfw-v3',
  'depth-map-xl-v2', 'canny-edge-xl',

  // Upscaling and enhancement
  '4x-upscaler-ultrasharp', '4x-upscaler-anime',
  '8x-upscaler-nmkd', 'face-upscaler-gfpgan-v2',
  'body-upscaler-v2',

  // Inpainting for NSFW edits
  'inpainting-xl-v3', 'inpainting-xl-v2',
  'nsfw-inpainting-pro-v2',

  // Legacy and compatibility
  'seedream-v5-pro', 'seedream-v5-lite', 'seedream-v4',
  'qwen-image-3-pro', 'qwen-image-3',
  'krea-2-turbo', 'chroma', 'wai-illustrious',
  'qwen-image', 'qwen-image-2', 'qwen-image-2-pro',
] as const

export const ALLOWED_EDIT_MODEL_IDS = [
  // Primary NSFW editing models
  'qwen-edit-uncensored', 'qwen-image-3-pro-edit', 'qwen-image-3-edit',

  // Specialized NSFW editing
  'nsfw-inpainting-pro-v2', 'nsfw-edit-realistic-v3',
  'body-edit-xl-v2', 'skin-blend-pro-v2',
  'face-swap-nsfw-v3', 'face-swap-pro-v2',
  'body-swap-xl-v2', 'clothing-removal-v3',

  // Legacy and compatibility
  'seedream-v5-pro-edit', 'seedream-v5-lite-edit', 'seedream-v4-edit',
  'firered-image-edit', 'qwen-image-2-edit', 'qwen-image-2-pro-edit',
] as const

// Canonical model defaults — these are the primary models for each modality
export const DEFAULT_CHAT_MODEL_ID = 'venice-uncensored-1-2'
export const FALLBACK_CHAT_MODEL_ID = 'venice-uncensored'
export const DEFAULT_IMAGE_MODEL_ID = 'lustify-v8'
export const DEFAULT_EDIT_MODEL_ID = 'qwen-edit-uncensored'
export const DEFAULT_VIDEO_MODEL_ID = 'longcat-full-quality'
export const FALLBACK_VIDEO_MODEL_ID = 'wan-2-7'

// Video model catalog
export const ALLOWED_VIDEO_MODEL_IDS = [
  'longcat-full-quality',
  'longcat',
  'wan-2-7',
  'wan-2-1',
  'wan',
] as const

const CHAT_EXTREME_MARKERS = ['heretic', 'abliterat'] as const
const VIDEO_EXTREME_MARKERS = ['enhanced', 'uncensored', 'heretic', 'abliterat', 'private', 'lustify', 'longcat', 'wan'] as const

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
  return (ALLOWED_VIDEO_MODEL_IDS as readonly string[]).includes(value)
    || VIDEO_EXTREME_MARKERS.some((marker) => value.includes(marker))
}

export function isVisibleTab(tab?: string): tab is VisibleTab {
  return !!tab && (VISIBLE_TABS as readonly string[]).includes(tab)
}
