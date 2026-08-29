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
  enable_web_search: 'off',
  enable_web_citations: false,
  include_search_results_in_stream: false,
}

export const LOCKED_CHAT_TEMPERATURE = 0.5
export const LOCKED_CHAT_TOP_P = 1
export const LOCKED_CHAT_MAX_TOKENS = 3000

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You write copy-ready image prompts for Lustify v8 in this app.

Output format:
1) POSITIVE prompt only, comma-separated tags and short phrases, ready to paste into Image → Generate.
2) NEGATIVE prompt on a new line after a heading exactly: NEGATIVE
No preamble, no quotes, no markdown, no analysis.

Preserve the user's requested composition, camera, pose, anatomy, lighting, realism, and any negative-prompt rules. Do not invent a different scene. Do not add studio lighting, cinematic grade, beauty filters, CGI, clothes, hidden faces, gym bodies, or porn-star glamour unless the user asked for them.

Default look if the user does not override it:
- photoreal amateur iPhone snapshot, third-person, normal lived-in bedroom
- lighting: ONE real source only. Day = sunlight through a window. Night = a normal ceiling bulb or lamp. Never a lighting rig, never rim light, never cinematic
- two consenting average adults 18+, 1girl 1boy, real imperfect bodies, not models
- sex is happening, not posed for a photograph. Natural positions, mid-motion, messy, bedroom-real
- both faces visible: woman's face at least 75%, man's face at least 50%
- uncensored explicit genitals with person-specific detail, readable vaginal penetration when sex is requested
- sweat, flush, messy sex hair, real expressions, painted fingernails and toenails on the woman
- SKIN is the priority: real imperfect human skin. Visible pores, peach fuzz, uneven tone, freckles or moles if they fit the person, redness, texture. Never plastic, never shiny beauty-filter, never smooth, never even-tone airbrush.

Anatomy rules:
- Male: lifelike erect penis from glans through shaft, foreskin if natural to the body, veins, testicles, ballsack, unique groin hair, ass, ass crack, anus when the angle shows them. Never flaccid during sex. Never a generic copy-paste cock.
- Female: soft real breasts not silicone, areolae and nipples matched to her skin tone (pink, rose, brown, dark brown), unique pussy with labia and clit, pubic hair that varies per woman (natural, trimmed, short, long, or shaved — pick one and keep it consistent), ass, ass crack, puckered anus when legs spread or doggy. Genital coloring can be slightly different from the rest of the skin.
- During penetration: wet shine on cock and labia, stretched labia around the shaft, part of the shaft still visible, sweat from friction.
- No bodybuilder, no shredded abs, no porn-studio set.

Never write minors. Never describe anyone under 18. Never write non-consensual undress of a real identifiable person.
Keep prompts tight. Prefer concrete visual facts over adjectives.`

export const LOCKED_IMAGE_SIZE_IDX = '2'
export const LOCKED_IMAGE_VARIANTS = 1
export const LOCKED_IMAGE_STEPS = 20

export const DEFAULT_IMAGE_PROMPT = `amateur iphone snapshot, slightly messy framing, film grain, not a photoshoot, not staged for camera
lighting: one real bedroom light source only, either morning sunlight coming through a window or night with a normal ceiling bulb or bedside lamp, household electricity, ordinary warm or cool bulb, expected light for that room at that time of day, soft falloff, real shadows, no lighting rig, no rim light, no cinematic grade, no studio softbox
normal lived-in bedroom, unmade bed, everyday clutter, sometimes tidy sometimes messy, never luxury hotel, never set, never cyclorama
2people, 1girl, 1boy, adults 18+, average couple having sex in a real bedroom, third-person view, both faces visible, woman's face at least 75 percent visible, man's face at least 50 percent visible
natural sex positions, mid-motion, bodies working, not posed, not arranged for the lens, bedroom sex not porn choreography
average real bodies, natural body fat, soft belly, not models, not pornstar bodies, no gym shredded look, no bodybuilder, no zero fat
real imperfect human skin on faces and bodies, close-up skin texture, visible pores, peach fuzz, uneven skin tone, natural redness around nose cheeks chest, freckles moles scars or texture unique to each person, subsurface scatter, dry and oily patches mixed, no even foundation look
never plastic skin, never shiny retouched skin, never smooth skin, never poreless skin, never beauty-filter glow, never airbrushed, never CGI wax
sex sweat is separate from oily photoshop shine: fine beads of sweat on forehead neck chest lower back only where friction and heat are, flushed cheeks and chest, warmer skin from sex, damp messy sex hair, not salon hair
real expressions from sex, lust, half-lidded eyes, parted lips, biting lip, moaning faces, male and female both, no fashion face, no looking at camera on purpose
woman: painted fingernails, painted toenails, any polish color, nails visible when hands or feet are in frame
woman breasts: soft natural real breasts, not silicone, not plastic, not perky fake implants, natural hang and weight
areolae and nipples matched to her skin tone, pink or rose on fair skin, brown or dark brown on deeper skin, mixed sizes, not copy-paste
pussy: anatomically correct vulva, outer labia, inner labia, clitoris, wet, unique to this woman
pubic hair unique to this woman, pick one and keep it: natural bush or trimmed or short or longer or clean shaven, not the same cut on every woman
when legs spread or doggy: full ass cheeks, deep ass crack, puckered star-like anus, genital skin tone slightly different from thigh skin
man: lifelike natural erect penis, hard, never flaccid, glans, shaft, veins, testicles, wrinkled ballsack, unique groin hair, not a generic porn cock stamp
when the angle shows it: male ass, ass crack, anus
correct vaginal penetration, cock inside pussy, labia stretched around the shaft, about three quarters inside, one quarter of shaft still visible, wet shine on cock and labia from sex, anatomically readable insertion, uncensored explicit, never hidden, never blurred`

export const DEFAULT_IMAGE_NEGATIVE = `cartoon, anime, illustration, CGI, 3D render, plastic skin, waxy skin, doll, silicone breasts, implant breasts, fake tits, airbrushed, beauty filter, poreless skin, smooth skin, even-tone skin, foundation mask, glossy retouch, oily beauty shine, HDR skin, overprocessed skin, pornstar makeup, glam makeup, salon hair, perfect bodies, model bodies, bodybuilder, shredded abs, six pack, gym body, zero fat, oversized porn cock, horse cock, tiny penis, flaccid during sex, copy-paste genitals, same pubic hair on every woman, mismatched areola color, neon nipples, studio, cyclorama, lighting rig, softbox, beauty dish, rim light, cinematic lighting, posed photoshoot, looking at camera pose, luxury penthouse, marble hotel, pov, hidden faces, censored, mosaic, blurry genitals, clothes, lingerie on, deformed hands, extra fingers, extra limbs, watermark, text, no penetration, floating penis, hovering cock, penis beside pussy, disconnected genitals, bad insertion, dry plastic genitals`

const STALE_PROMPTS = [
  'a serene mountain',
  'golden hour',
  'painterly',
  'dewdrop',
  'cyberpunk street',
  "children's book",
]

const STALE_SYSTEM_PROMPTS = [
  '',
  'you are a helpful assistant',
]

export function isStaleImagePrompt(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (!text) return true
  if (STALE_PROMPTS.some((snippet) => text.includes(snippet))) return true
  if (!text.includes('uneven skin tone') && !text.includes('uneven skin')) return true
  return false
}

export function isStaleSystemPrompt(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (STALE_SYSTEM_PROMPTS.includes(text) || text.length < 40) return true
  if (!text.includes('uneven') && !text.includes('freckle')) return true
  return false
}

export function isStaleImageNegative(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (!text) return true
  return !text.includes('even-tone skin') && !text.includes('poreless skin')
}

export function loadImagePrompt(saved?: string | null) {
  return isStaleImagePrompt(saved || '') ? DEFAULT_IMAGE_PROMPT : (saved as string)
}

export function loadImageNegative(saved?: string | null) {
  return isStaleImageNegative(saved || '') ? DEFAULT_IMAGE_NEGATIVE : (saved as string)
}

export function lockChatParams(params?: VeniceParameters): VeniceParameters {
  return {
    ...(params || {}),
    ...LOCKED_CHAT_PARAMS,
  }
}

export function lockChatSystemPrompt(saved?: string | null) {
  return isStaleSystemPrompt(saved || '') ? DEFAULT_CHAT_SYSTEM_PROMPT : (saved as string)
}
