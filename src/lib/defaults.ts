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

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You write copy-ready Lustify v8 prompts for this app. Style target: real amateur couple porn stills, third-person, messy iPhone, not studio porn.

Output rules:
- If the user wants ONE scene: POSITIVE prompt (comma tags), then a line exactly NEGATIVE, then the negative prompt. No preamble.
- If the user uploads or describes TWO people (a man and a woman) and asks for ideas, or says variations: output FIVE numbered variations. Same two adults every time. Each variation must change SETTING and SEX POSITION. After each variation write NEGATIVE and one shared negative, or one NEGATIVE block at the end. No extra chat.
- Never invent a different couple. Keep faces, bodies, ethnicity, hair, and identity locked to the two people given.

People defaults unless the user overrides:
- Man: adult 18+, Middle Eastern or South European or North African look. Olive to tan skin. Always facial hair: stubble or short trimmed beard or full beard. Never clean shaven.
- Woman: adult 18+, girl next door / neighbor / old school crush energy. Pretty-average, approachable, not a pornstar, not a model, not glam makeup.
- Both: average real bodies, imperfect skin (pores, uneven tone, freckles/moles/redness), not gym shredded, not silicone.
- Woman pubic hair ALWAYS present unless the user explicitly asks shaved: natural or trimmed bush. Never default to clean shaven pussy.
- Woman: painted fingernails and toenails.
- Man facial hair always present unless the user explicitly asks clean shaven.

Scene defaults unless overridden:
- amateur candid third-person snapshot of actual sex, not posed for camera
- one real light: window sun by day or a normal room bulb at night
- lived-in bedroom or other ordinary amateur-porn rooms if variation requires a new setting (messy apartment, motel, sofa, kitchen counter). Never luxury set.
- both faces visible: woman >=75%, man >=50%
- readable vaginal penetration when sex is shown
- sweat, flush, messy sex hair, real moaning / biting-lip faces

Anatomy:
- Male: erect lifelike penis, glans, shaft, veins, balls, ballsack, groin hair, ass/crack/anus if the angle shows them. Never flaccid during sex.
- Female: soft real breasts, areolae/nipples matched to her skin, unique labia and clit, hairy or trimmed pussy, ass/crack/anus if the angle shows them.
- Insertion: labia stretched around the shaft, most of the cock inside, a bit still visible, wet from sex.

Never minors. Never anyone under 18. Never non-consensual undress of a real identifiable stranger.
Do not turn search on. Write from amateur-porn photo language you already know.
Keep prompts tight.`

export const LOCKED_IMAGE_SIZE_IDX = '2'
export const LOCKED_IMAGE_VARIANTS = 1
export const LOCKED_IMAGE_STEPS = 20

export const DEFAULT_IMAGE_PROMPT = `amateur iphone snapshot of a real amateur couple porn still, slightly messy framing, film grain, not a photoshoot, not staged for camera
lighting: one real bedroom light source only, either morning sunlight coming through a window or night with a normal ceiling bulb or bedside lamp, household electricity, ordinary warm or cool bulb, expected light for that room at that time of day, soft falloff, real shadows, no lighting rig, no rim light, no cinematic grade, no studio softbox
normal lived-in bedroom, unmade bed, everyday clutter, sometimes tidy sometimes messy, never luxury hotel, never set, never cyclorama
2people, 1girl, 1boy, adults 18+, same couple having sex, third-person view, both faces visible, woman's face at least 75 percent visible, man's face at least 50 percent visible
man: Middle Eastern or South European or North African adult, olive to tan skin, always facial hair, light stubble or short trimmed beard or full beard, never clean shaven face
woman: girl next door, neighbor, school crush look, pretty-average adult, approachable, not a pornstar, not a model, not glam
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
pubic hair always present, natural or trimmed bush, not clean shaven unless the user asked
when legs spread or doggy: full ass cheeks, deep ass crack, puckered star-like anus, genital skin tone slightly different from thigh skin
man: lifelike natural erect penis, hard, never flaccid, glans, shaft, veins, testicles, wrinkled ballsack, unique groin hair, not a generic porn cock stamp
when the angle shows it: male ass, ass crack, anus
correct vaginal penetration, cock inside pussy, labia stretched around the shaft, about three quarters inside, one quarter of shaft still visible, wet shine on cock and labia from sex, anatomically readable insertion, uncensored explicit, never hidden, never blurred`

export const DEFAULT_IMAGE_NEGATIVE = `cartoon, anime, illustration, CGI, 3D render, plastic skin, waxy skin, doll, silicone breasts, implant breasts, fake tits, airbrushed, beauty filter, poreless skin, smooth skin, even-tone skin, foundation mask, glossy retouch, oily beauty shine, HDR skin, overprocessed skin, pornstar makeup, glam makeup, salon hair, pornstar face, model face, clean shaven man, no beard, baby face man, shaved pussy, bald vulva, waxed bare pussy, perfect bodies, model bodies, bodybuilder, shredded abs, six pack, gym body, zero fat, oversized porn cock, horse cock, tiny penis, flaccid during sex, copy-paste genitals, mismatched areola color, neon nipples, studio, cyclorama, lighting rig, softbox, beauty dish, rim light, cinematic lighting, posed photoshoot, looking at camera pose, luxury penthouse, marble hotel, pov, hidden faces, censored, mosaic, blurry genitals, clothes, lingerie on, deformed hands, extra fingers, extra limbs, watermark, text, no penetration, floating penis, hovering cock, penis beside pussy, disconnected genitals, bad insertion, dry plastic genitals`

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
  if (!text.includes('stubble') && !text.includes('beard')) return true
  if (!text.includes('girl next door') && !text.includes('school crush')) return true
  return false
}

export function isStaleSystemPrompt(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (STALE_SYSTEM_PROMPTS.includes(text) || text.length < 40) return true
  if (!text.includes('five numbered') && !text.includes('five numbered variations')) return true
  return false
}

export function isStaleImageNegative(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (!text) return true
  return !text.includes('clean shaven man') || !text.includes('shaved pussy')
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
