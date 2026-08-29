import {
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_EDIT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
} from './allowed-models'
import type { VeniceParameters } from '../types/venice'

export const LOCKED_CHAT_MODEL_ID = DEFAULT_CHAT_MODEL_ID
export const LOCKED_IMAGE_MODEL_ID = DEFAULT_IMAGE_MODEL_ID
export const LOCKED_EDIT_MODEL_ID = DEFAULT_EDIT_MODEL_ID

export const LOCKED_CHAT_PARAMS: VeniceParameters = {
  include_venice_system_prompt: false,
  enable_web_search: 'off',
  enable_web_citations: false,
  include_search_results_in_stream: false,
}

export const LOCKED_CHAT_TEMPERATURE = 0.7
export const LOCKED_CHAT_TOP_P = 1
export const LOCKED_CHAT_MAX_TOKENS = 2048

export const LOCKED_IMAGE_SIZE_IDX = '2'
export const LOCKED_IMAGE_VARIANTS = 1
export const LOCKED_IMAGE_STEPS = 20

export const DEFAULT_IMAGE_PROMPT = `amateur iphone snapshot, slightly messy framing, film grain, available room light, one light source, messy lived-in bedroom, unmade bed, clutter, raw candid
2people, 1girl, 1boy, adults 18+, couple having sex, third-person view, both faces visible, woman's face clearly visible, man's face visible
natural skin, visible pores, peach fuzz, skin imperfections, realistic bodies, sweat, flushed, damp hair, half-lidded eyes, parted lips, uncensored nsfw
erect nipples, detailed areolae, wet pussy, labia, trimmed pubic hair
erect penis, hard cock, veiny shaft, testicles, pubic hair
penis inside pussy, labia stretched around the shaft, part of the shaft still visible, insertion readable, anatomically correct penetration`

export const DEFAULT_IMAGE_NEGATIVE = `cartoon, anime, illustration, CGI, 3D render, plastic skin, waxy skin, doll, airbrushed, beauty filter, studio, cyclorama, rim light, cinematic lighting, posed photoshoot, pov, hidden faces, censored, mosaic, blurry genitals, clothes, lingerie on, flaccid, small penis, deformed hands, extra fingers, extra limbs, watermark, text, no penetration, floating penis, penis beside pussy, disconnected genitals, bad insertion`

const STALE_PROMPTS = [
  'a serene mountain',
  'golden hour',
  'painterly',
  'dewdrop',
  'cyberpunk street',
  "children's book",
]

export function isStaleImagePrompt(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (!text) return true
  return STALE_PROMPTS.some((snippet) => text.includes(snippet))
}

export function loadImagePrompt(saved?: string | null) {
  return isStaleImagePrompt(saved || '') ? DEFAULT_IMAGE_PROMPT : (saved as string)
}

export function loadImageNegative(saved?: string | null) {
  const text = (saved || '').trim()
  return text ? text : DEFAULT_IMAGE_NEGATIVE
}

export function lockChatParams(params?: VeniceParameters): VeniceParameters {
  return {
    ...(params || {}),
    ...LOCKED_CHAT_PARAMS,
  }
}
