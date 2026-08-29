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

Every prompt is a MAN + WOMAN having sex unless the user clearly asks for one person. Same two adults if photos or descriptions were given. Never a different couple.

Output:
- ONE scene: POSITIVE comma tags, then a line exactly NEGATIVE, then negatives. No preamble.
- Variations / generate a prompt / two photos attached: FIVE numbered variations. Same man, same woman. Each changes ROOM and SEX POSITION. Only use positions where BOTH faces can turn toward the camera. End with one NEGATIVE block.

People unless the user overrides:
- Man 18+: Middle Eastern, North African, South European, or Texas / Southern US. Olive, tan, or sun-worn skin. ALWAYS facial hair: stubble, short, medium, long, trimmed or wild. Never clean shaven.
- Woman 18+: girl next door / neighbor / old crush. Average-pretty. Not pornstar. Not model.
- Always together in frame. Both looking toward the camera in a natural mid-sex glance, not a fashion stare. Each face at least 78 percent visible. Alive wet eyes, catchlight, not dead or doll eyes.
- Skin: matte living human skin. Pores, peach fuzz, uneven tone, freckles/moles/redness. Never shiny, never plastic, never glossy beauty, never poreless.
- Woman ALWAYS has pubic hair (natural or trimmed). Never shaved pussy unless the user types shaved.
- Woman ALWAYS has visible nipples and areolae matched to her skin. Painted fingernails and toenails.

Positions that keep both faces on camera (pick from these unless user orders otherwise):
- cowgirl / woman sitting on him facing the lens, man under her looking at the lens
- sitting on his lap facing the camera, both looking at the lens
- side-front missionary or spoon, heads toward the lens
- standing, woman facing camera, man behind looking over her shoulder toward the lens
Do NOT pick face-down doggy, faces buried in pillow, back-of-head, or man fully behind with his face gone.

Scene:
- amateur candid, one real light (window sun or room bulb), lived-in room
- readable vaginal penetration, sweat from sex not oily retouch, messy hair, real mouths

Anatomy:
- Man: erect penis, glans, shaft, veins, balls, ballsack, groin hair
- Woman: soft real breasts, nipples, unique labia and clit, pussy hair always, ass/crack/anus if the angle shows them
- Insertion readable: labia stretched around shaft, most inside, a bit of shaft still visible, wet from sex

Never minors. Never under 18.
Search stays OFF. Do not browse. Write amateur-still language from these rules.
After each prompt you may add one line SCORE: pass/fail on faces-to-camera, beard, pussy hair, matte skin, alive eyes, insertion. No payment language.`

export const LOCKED_IMAGE_SIZE_IDX = '2'
export const LOCKED_IMAGE_VARIANTS = 1
export const LOCKED_IMAGE_STEPS = 20

export const DEFAULT_IMAGE_PROMPT = `amateur iphone snapshot of a real amateur couple porn still, slightly messy framing, film grain, not a photoshoot, not a studio set
lighting: one real bedroom light source only, either morning sunlight coming through a window or night with a normal ceiling bulb or bedside lamp, household electricity, ordinary bulb, expected light for that room, soft falloff, real shadows, no lighting rig, no rim light, no cinematic grade, no studio softbox
normal lived-in bedroom, unmade bed, everyday clutter, sometimes tidy sometimes messy, never luxury hotel, never set, never cyclorama
2people, 1girl, 1boy, adults 18+, couple having sex together in one frame, third-person view
both looking toward the camera during sex, natural glance not fashion pose, both faces at least 78 percent visible, no hidden faces, no back of head
alive eyes, wet living eyes, catchlight in eyes, engaged expression, never dead eyes, never doll eyes, never blank stare
position chosen so both faces stay on camera: cowgirl facing the lens, or woman sitting on his lap facing the lens, or side-front missionary with heads toward the lens, or standing woman facing camera and man behind looking over her shoulder toward the lens
man: Middle Eastern or North African or South European or Texas Southern adult, olive tan or sun-worn skin, ALWAYS facial hair, stubble or short beard or medium beard or long beard, trimmed or untrimmed, never clean shaven face
woman: girl next door, neighbor, school crush look, pretty-average adult, approachable, not a pornstar, not a model, not glam
average real bodies, natural body fat, soft belly, not models, not pornstar bodies, no gym shredded look, no bodybuilder, no zero fat
matte living human skin on faces and bodies, close-up skin texture, visible pores, peach fuzz, uneven skin tone, natural redness, freckles moles scars, dry and oily patches mixed, always matte, never shiny skin, never plastic skin, never glossy retouch, never smooth, never poreless, never beauty-filter glow, never airbrushed, never CGI wax
sex sweat only as fine beads on forehead neck chest lower back from heat, not an oily full-body shine, flushed cheeks and chest, damp messy sex hair, not salon hair
real sex expressions, lust, half-lidded but ALIVE eyes looking toward camera, parted lips, biting lip, moaning faces
woman: painted fingernails, painted toenails, any polish color, nails visible when hands or feet are in frame
woman breasts: soft natural real breasts, nipples always visible, areolae always visible, not silicone, natural hang and weight
areolae and nipples matched to her skin tone, pink or rose on fair skin, brown or dark brown on deeper skin, mixed sizes
pussy: anatomically correct vulva, outer labia, inner labia, clitoris, wet, unique to this woman
pubic hair ALWAYS present, natural or trimmed bush, never clean shaven, never waxed bare
when legs spread: full ass cheeks, deep ass crack, puckered anus if the angle shows it, genital skin tone slightly different from thigh skin
man: lifelike natural erect penis, hard, never flaccid, glans, shaft, veins, testicles, wrinkled ballsack, unique groin hair
correct vaginal penetration, cock inside pussy, labia stretched around the shaft, about three quarters inside, one quarter of shaft still visible, wet on cock and labia from sex, anatomically readable insertion, uncensored explicit, never hidden, never blurred`

export const DEFAULT_IMAGE_NEGATIVE = `cartoon, anime, illustration, CGI, 3D render, plastic skin, waxy skin, doll, shiny skin, glossy skin, oily beauty shine, wet look skin, HDR glow skin, silicone breasts, implant breasts, fake tits, airbrushed, beauty filter, poreless skin, smooth skin, even-tone skin, foundation mask, overprocessed skin, pornstar makeup, glam makeup, salon hair, pornstar face, model face, dead eyes, doll eyes, blank stare, looking away, faces turned away, back of head, hidden face, clean shaven man, no beard, baby face man, shaved pussy, bald vulva, waxed bare pussy, hidden nipples, covered nipples, perfect bodies, model bodies, bodybuilder, shredded abs, six pack, gym body, zero fat, oversized porn cock, horse cock, tiny penis, flaccid during sex, copy-paste genitals, mismatched areola color, neon nipples, studio, cyclorama, lighting rig, softbox, beauty dish, rim light, cinematic lighting, posed fashion photoshoot, luxury penthouse, marble hotel, pov, censored, mosaic, blurry genitals, clothes, lingerie on, deformed hands, extra fingers, extra limbs, watermark, text, no penetration, floating penis, hovering cock, penis beside pussy, disconnected genitals, bad insertion, dry plastic genitals, face-down doggy with hidden faces`

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
  if (!text.includes('78 percent') && !text.includes('78%')) return true
  if (!text.includes('matte')) return true
  return false
}

export function isStaleSystemPrompt(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (STALE_SYSTEM_PROMPTS.includes(text) || text.length < 40) return true
  if (!text.includes('78 percent') && !text.includes('78%')) return true
  return false
}

export function isStaleImageNegative(value?: string) {
  const text = (value || '').trim().toLowerCase()
  if (!text) return true
  return !text.includes('dead eyes') || !text.includes('shiny skin')
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
