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

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You write copy-ready Lustify v8 prompts for this app. Style target: real amateur couple porn stills, third-person iPhone, messy room, not studio porn.

FRAMING IS A HARD FAIL RULE:
- Default and variations = ONE man + ONE woman together. Landscape wide frame. FULL BODIES head to toe. Hairdos fully visible on both. Feet visible. Do not crop heads or feet.
- Solo man or solo woman ONLY if the user clearly asks for one person. Solo MUST be a torso / bust crop (head, hairdo, chest, nipples). Full-body solo is a FAIL. Do not write a full-body solo prompt. Refuse and write a torso prompt instead.
- Never square. Couple = landscape 3:2 or 16:9. Solo = portrait torso 4:5.

Every couple prompt is a MAN + WOMAN having sex unless the user clearly asks for one person. Same two adults if photos were given.

Output:
- ONE scene: POSITIVE comma tags, then a line exactly NEGATIVE, then negatives. No preamble.
- Variations / generate a prompt / two photos attached: FIVE numbered variations. Same man, same woman. Each changes ROOM and SEX POSITION. Landscape full body every time. Only positions where BOTH faces can turn toward the camera. End with one NEGATIVE block.

People unless the user overrides:
- Man 18+: Middle Eastern, North African, South European, or Texas / Southern US. Olive, tan, or sun-worn skin. ALWAYS facial hair: stubble, short, medium, long, trimmed or wild. Never clean shaven. Hairdo always visible.
- Woman 18+: girl next door / neighbor / old crush. Average-pretty. Not pornstar. Hairdo always visible.
- Couple: both looking toward the camera, each face at least 78 percent visible. Alive eyes with catchlight.
- Skin: matte living human skin. Never shiny, never plastic.
- Woman ALWAYS has pubic hair (natural or trimmed). ALWAYS visible nipples and areolae. Painted fingernails and toenails.

Positions that keep both faces AND both full bodies on a landscape frame:
- cowgirl facing the lens, man under her looking at the lens, both bodies head to toe
- sitting on his lap facing the lens
- side-front missionary or spoon, heads toward the lens, feet in frame
- standing, woman facing camera, man behind looking over her shoulder, both full bodies
Do NOT pick face-down doggy, cropped waists, missing feet, missing hair, or back-of-head.

Scene: amateur candid, one real light, lived-in room, readable vaginal penetration on couple shots.

Never minors. Never under 18.
Search stays OFF.
SCORE pass/fail: landscape-or-torso-rule, head-to-toe-if-couple, hairdos visible, faces-to-camera, beard, pussy hair, matte skin, alive eyes, insertion.`

export const LOCKED_IMAGE_SIZE_IDX = '2'
export const LOCKED_IMAGE_VARIANTS = 1
export const LOCKED_IMAGE_STEPS = 20
export const LOCKED_COUPLE_ASPECT = '3:2'
export const LOCKED_SOLO_ASPECT = '4:5'
export const LOCKED_COUPLE_SIZE = { w: 1280, h: 832 }

export const DEFAULT_IMAGE_PROMPT = `landscape 3:2 amateur iphone snapshot of a real amateur couple porn still, wide frame, slightly messy framing, film grain, not a photoshoot, not a studio set, not square, not portrait crop
full bodies of the man and the woman, head to toe, entire figures in frame, feet visible, hairdos fully visible on both, do not crop heads, do not crop feet, do not crop hair
lighting: one real bedroom light source only, either morning sunlight coming through a window or night with a normal ceiling bulb or bedside lamp, household electricity, ordinary bulb, expected light for that room, soft falloff, real shadows, no lighting rig, no rim light, no cinematic grade, no studio softbox
normal lived-in bedroom, unmade bed, everyday clutter, sometimes tidy sometimes messy, never luxury hotel, never set, never cyclorama
2people, 1girl, 1boy, adults 18+, couple having sex together in one landscape frame, third-person view
both looking toward the camera during sex, natural glance not fashion pose, both faces at least 78 percent visible, no hidden faces, no back of head
alive eyes, wet living eyes, catchlight in eyes, engaged expression, never dead eyes, never doll eyes, never blank stare
position chosen so both faces and both full bodies stay on camera: cowgirl facing the lens, or woman sitting on his lap facing the lens, or side-front missionary with heads toward the lens and feet in frame, or standing woman facing camera and man behind looking over her shoulder toward the lens
man: Middle Eastern or North African or South European or Texas Southern adult, olive tan or sun-worn skin, ALWAYS facial hair, stubble or short beard or medium beard or long beard, trimmed or untrimmed, never clean shaven face, visible hairdo
woman: girl next door, neighbor, school crush look, pretty-average adult, approachable, not a pornstar, not a model, not glam, visible hairdo messy from sex not salon
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

export const DEFAULT_IMAGE_NEGATIVE = `cartoon, anime, illustration, CGI, 3D render, square crop, portrait couple crop, close-up only, cropped heads, cropped feet, missing feet, missing hair, hair out of frame, cropped hairdo, headshot couple, waist-up couple, plastic skin, waxy skin, doll, shiny skin, glossy skin, oily beauty shine, wet look skin, HDR glow skin, silicone breasts, implant breasts, fake tits, airbrushed, beauty filter, poreless skin, smooth skin, even-tone skin, foundation mask, overprocessed skin, pornstar makeup, glam makeup, salon hair, pornstar face, model face, dead eyes, doll eyes, blank stare, looking away, faces turned away, back of head, hidden face, clean shaven man, no beard, baby face man, shaved pussy, bald vulva, waxed bare pussy, hidden nipples, covered nipples, perfect bodies, model bodies, bodybuilder, shredded abs, six pack, gym body, zero fat, oversized porn cock, horse cock, tiny penis, flaccid during sex, copy-paste genitals, mismatched areola color, neon nipples, studio, cyclorama, lighting rig, softbox, beauty dish, rim light, cinematic lighting, posed fashion photoshoot, luxury penthouse, marble hotel, pov, censored, mosaic, blurry genitals, clothes, lingerie on, deformed hands, extra fingers, extra limbs, watermark, text, no penetration, floating penis, hovering cock, penis beside pussy, disconnected genitals, bad insertion, dry plastic genitals, face-down doggy with hidden faces, full body solo, standing solo full figure`

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
  if (!text.includes('head to toe') && !text.includes('full bodies')) return true
  if (!text.includes('landscape')) return true
  return false
}

export function isStaleSystemPrompt(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (STALE_SYSTEM_PROMPTS.includes(text) || text.length < 40) return true
  if (!text.includes('torso') || !text.includes('landscape')) return true
  return false
}

export function isStaleImageNegative(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (!text) return true
  return !text.includes('cropped feet') || !text.includes('full body solo')
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
