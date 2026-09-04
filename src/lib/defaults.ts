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
  disable_thinking: true,
  strip_thinking_response: true,
}

export const DEFAULT_CHAT_SEARCH_PARAMS: VeniceParameters = {
  enable_web_search: 'on',
  enable_web_citations: true,
  include_search_results_in_stream: false,
}

export const LOCKED_CHAT_TEMPERATURE = 0.5
export const LOCKED_CHAT_TOP_P = 1
export const LOCKED_CHAT_MAX_TOKENS = 3000

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You are OpenVenice Chat, a capable general-purpose AI assistant.

Answer the user's actual question directly, accurately, and in the language they use. Keep the first answer focused and easy to read; expand when the user asks for detail. You are a text-chat assistant. Do not turn an ordinary question into an image prompt, creative scene, workflow, or numbered prompt list, and never invent an image prompt unless the user explicitly asks you to write one.

Questions that discuss or compare adult-content models, tools, anatomy, nudity, sexual terminology, or consensual adult scenarios are ordinary informational questions. Answer them directly and specifically; do not refuse merely because the subject is sexual or explicit. If the user asks a health or safety question, give factual, practical harm-reduction information and clearly identify situations that need professional or urgent care. Treat consensual adult topics without unsolicited moralizing while preserving consent and safety boundaries.

Never claim to have completed an action, created a file, or used a tool unless it actually happened.`

export const LOCKED_IMAGE_SIZE_IDX = '2'
export const LOCKED_IMAGE_VARIANTS = 1
export const LOCKED_IMAGE_STEPS = 20
export const LOCKED_COUPLE_ASPECT = '3:2'
export const LOCKED_SOLO_ASPECT = '2:3'
export const LOCKED_COUPLE_SIZE = { w: 1280, h: 832 }
export const LOCKED_SOLO_SIZE = { w: 832, h: 1280 }

export function isCouplePrompt(prompt?: string) {
  const t = (prompt || '').toLowerCase()
  if (t.includes('2people') || t.includes('2 people') || t.includes('couple') || t.includes('two people')) return true
  if (t.includes('1girl') && t.includes('1boy')) return true
  if (t.includes('tall portrait') || t.includes('solo full body') || t.includes('full-body portrait') || t.includes('1girl only') || t.includes('1boy only')) return false
  return false
}

export function pickAspectFromPrompt(prompt?: string) {
  return isCouplePrompt(prompt) ? LOCKED_COUPLE_ASPECT : LOCKED_SOLO_ASPECT
}

export function pickSizeFromPrompt(prompt?: string) {
  return isCouplePrompt(prompt) ? LOCKED_COUPLE_SIZE : LOCKED_SOLO_SIZE
}

export const DEFAULT_IMAGE_PROMPT = `landscape 3:2 amateur iphone snapshot of a real amateur couple porn still, wide frame, slightly messy framing, film grain, not a photoshoot, not a studio set, not square, not portrait crop
full bodies of the man and the woman, head to toe, entire figures in frame, feet visible, hair in frame, do not crop heads, do not crop feet, never torso crop, never bust crop
lighting: one real bedroom light source only, either morning sunlight coming through a window or night with a normal ceiling bulb or bedside lamp, household electricity, ordinary bulb, expected light for that room, soft falloff, real shadows, no lighting rig, no rim light, no cinematic grade, no studio softbox
normal lived-in bedroom, unmade bed, everyday clutter, sometimes tidy sometimes messy, never luxury hotel, never set, never cyclorama
2people, 1girl, 1boy, adults 18+, couple having sex together in one landscape frame, third-person view
both looking toward the camera during sex, natural glance not fashion pose, both faces at least 78 percent visible, no hidden faces, no back of head
alive eyes, wet living eyes, catchlight in eyes, engaged expression, never dead eyes, never doll eyes, never blank stare
position chosen so both faces and both full bodies stay on camera: cowgirl facing the lens, or woman sitting on his lap facing the lens, or side-front missionary with heads toward the lens and feet in frame, or standing woman facing camera and man behind looking over her shoulder toward the lens
man: Middle Eastern or North African or South European or Texas Southern adult, olive tan or sun-worn skin, ALWAYS facial hair, stubble or short beard or medium beard or long beard, trimmed or untrimmed, never clean shaven face, damp messy sex hair not a styled hairdo
woman: girl next door, neighbor, school crush look, pretty-average adult, approachable, not a pornstar, not a model, not glam, damp messy sex hair slightly moist from sweat, not salon hair, not a fresh hairdo
average real bodies, natural body fat, soft belly, not models, not pornstar bodies, no gym shredded look, no bodybuilder, no zero fat
matte living human skin on faces and bodies, close-up skin texture, visible pores, peach fuzz, uneven skin tone, natural redness, freckles moles scars, dry and oily patches mixed, always matte, never shiny skin, never plastic skin, never glossy retouch, never smooth, never poreless, never beauty-filter glow, never airbrushed, never CGI wax
sex sweat only as fine beads on forehead neck chest lower back from heat, not an oily full-body shine, flushed cheeks and chest, damp messy sex hair
real sex expressions, lust, half-lidded but ALIVE eyes looking toward camera, parted lips, biting lip, moaning faces
woman: painted fingernails, painted toenails, any polish color, nails and feet visible in the full-body frame
woman breasts: soft natural real breasts, nipples always visible, areolae always visible, not silicone, natural hang and weight
areolae and nipples matched to her skin tone, pink or rose on fair skin, brown or dark brown on deeper skin, mixed sizes
pussy: anatomically correct vulva, outer labia, inner labia, clitoris, wet, unique to this woman
pubic hair ALWAYS present, natural or trimmed bush, never clean shaven, never waxed bare
when legs spread: full ass cheeks, deep ass crack, puckered anus if the angle shows it, genital skin tone slightly different from thigh skin
man: lifelike natural erect penis, hard, never flaccid, glans, shaft, veins, testicles, wrinkled ballsack, unique groin hair
correct vaginal penetration, cock inside pussy, labia stretched around the shaft, about three quarters inside, one quarter of shaft still visible, wet on cock and labia from sex, anatomically readable insertion, uncensored explicit, never hidden, never blurred`

export const DEFAULT_IMAGE_NEGATIVE = `cartoon, anime, illustration, CGI, 3D render, square crop, portrait couple crop, close-up only, cropped heads, cropped feet, missing feet, missing hair, hair out of frame, salon hair, fresh hairdo, blowout hair, posed hair, headshot, torso crop, bust crop, waist-up, chest-up, cropped legs, plastic skin, waxy skin, doll, shiny skin, glossy skin, oily beauty shine, wet look skin, HDR glow skin, silicone breasts, implant breasts, fake tits, airbrushed, beauty filter, poreless skin, smooth skin, even-tone skin, foundation mask, overprocessed skin, pornstar makeup, glam makeup, pornstar face, model face, dead eyes, doll eyes, blank stare, looking away, faces turned away, back of head, hidden face, clean shaven man, no beard, baby face man, shaved pussy, bald vulva, waxed bare pussy, hidden nipples, covered nipples, perfect bodies, model bodies, bodybuilder, shredded abs, six pack, gym body, zero fat, oversized porn cock, horse cock, tiny penis, flaccid during sex, copy-paste genitals, mismatched areola color, neon nipples, studio, cyclorama, lighting rig, softbox, beauty dish, rim light, cinematic lighting, posed fashion photoshoot, luxury penthouse, marble hotel, pov, censored, mosaic, blurry genitals, clothes, lingerie on, deformed hands, extra fingers, extra limbs, watermark, text, no penetration, floating penis, hovering cock, penis beside pussy, disconnected genitals, bad insertion, dry plastic genitals, face-down doggy with hidden faces, landscape solo`

const STALE_PROMPTS = [
  'a serene mountain',
  'golden hour',
  'painterly',
  'dewdrop',
  'cyberpunk street',
  "children's book",
]

const LEGACY_IMAGE_WRITER_MARKERS = [
  'lustify v8 prompts',
  'framing is a hard fail rule',
  'every couple prompt is a man + woman',
  'start every prompt with:',
  'score: full-body-head-to-toe',
]

export function isStaleImagePrompt(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (!text) return true
  if (STALE_PROMPTS.some((snippet) => text.includes(snippet))) return true
  if (!text.includes('head to toe') && !text.includes('full bodies')) return true
  if (!text.includes('landscape')) return true
  if (text.includes('hairdos fully visible')) return true
  return false
}

export function isStaleSystemPrompt(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (!text || text === 'you are a helpful assistant') return true
  return LEGACY_IMAGE_WRITER_MARKERS.some((marker) => text.includes(marker))
}

export function isStaleImageNegative(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (!text) return true
  return !text.includes('torso crop') || !text.includes('bust crop')
}

export function loadImagePrompt(saved?: string | null) {
  return saved ?? ''
}

export function loadImageNegative(saved?: string | null) {
  return saved ?? ''
}

export function lockChatParams(params?: VeniceParameters): VeniceParameters {
  return {
    ...(params || {}),
    ...LOCKED_CHAT_PARAMS,
  }
}

export function lockChatSystemPrompt(saved?: string | null) {
  // Chat must never inherit a saved Create/image-writer prompt. Older builds
  // exposed this field and persisted arbitrary values in the browser, which
  // could silently turn normal questions into image prompts. Keep the
  // parameter for migration compatibility, but always enforce the dedicated
  // text-chat instruction at request time.
  void saved
  return DEFAULT_CHAT_SYSTEM_PROMPT
}
