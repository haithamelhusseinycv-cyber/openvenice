/**
 * Surgical copy-paste contract for identity swaps.
 *
 * faceswap / headswap / bodyswap are copy-paste operations, period:
 *   - copy the stated identity part from the source
 *   - erase the target part in the photo
 *   - paste the source part as-is into the exact position the old part occupied
 *   - minor editing is allowed ONLY to seat the pasted part into that position
 *
 * Editing anything else — even to "improve" it — is a failure. No beautifying,
 * no reshaping, no skin rework, no relighting, no touch.
 */

export type SwapKind = 'face' | 'head' | 'body'
export type SwapPerson = 'woman' | 'man'

const SWAP_NEGATIVE =
  'different face, similar face, cousin face, beautified face, face mix, identity drift, expression change, smile change, age change, gender change, different hair, different bone structure, slimmer body, heavier body, taller, shorter, extra person, extra limbs, extra fingers, warped hands, melted blend, halo, mismatch lighting, plastic skin, airbrush, poreless skin, smooth skin, even-tone skin, glossy retouch, beauty filter, cartoon, anime, CGI, text, watermark, mosaic, censor bar, clothes change, pose change, background change, camera change, studio light'

/**
 * The absolute no-touch clause. The ONLY permitted operation is the stated
 * copy-paste plus the minimum positional fit. Everything else, including
 * "improvements", is forbidden.
 */
const NO_TOUCH =
  'Do not invent. Do not beautify. Do not slim, thicken, age-shift, or change bone structure, expression, eye shape, nose, lips, hair texture, or skin tone. Keep the real imperfect skin from the identity photo: pores, peach fuzz, freckles, moles, redness, uneven tone. Never plastic, never smooth, never even-tone airbrush. The only allowed change is the minimum surgical warp needed so the copied identity sits on image 1\'s existing pose and camera. You are completing a copy-paste task, not creating art: changing, improving or retouching anything other than the stated replacement is a failure.'

export function buildSwapPrompt(kind: SwapKind, person: SwapPerson) {
  const subject = person === 'man' ? 'man' : 'woman'
  const bodyParts = person === 'man'
    ? 'torso, chest, belly, hips, legs, arms, skin'
    : 'torso, breasts, belly, hips, legs, arms, skin'

  if (kind === 'face') {
    return `Image 1 is the target photograph. Image 2 is the identity source.\n\nCopy-paste ONLY the face of the ${subject} from image 2 onto the ${subject} in image 1 at 100% 1:1 identity. Same bone structure, eyes, eyelids, brows, nose, lips, teeth if visible, pores, moles, freckles, scars, wrinkles, age, ethnicity, uneven skin tone, and the SAME expression as image 1. ${NO_TOUCH}\n\nKeep image 1 pose, body, hands, hair, neck, ears, clothing, jewelry, background, lighting, shadows, camera angle, crop, and anatomy identical.\n\nAvoid: ${SWAP_NEGATIVE}`
  }

  if (kind === 'head') {
    return `Image 1 is the target photograph. Image 2 is the identity source.\n\nCopy-paste the entire head of the ${subject} from image 2 onto image 1 at 100% 1:1 identity, including face, hair, ears, neck, and the same imperfect skin texture. Same expression as image 1. ${NO_TOUCH}\n\nKeep image 1 body, pose, hands, clothing, jewelry, background, lighting, shadows, camera angle, and crop identical. Blend only at the neck seam.\n\nAvoid: ${SWAP_NEGATIVE}, hair from image 1`
  }

  // Body swap: erase the target body entirely, paste the reference body as-is,
  // place it in the same position the old body occupied. Nothing else.
  return `Image 1 is the target photograph. Image 2 is the body source.\n\nBODY SWAP. Step 1: erase the entire body of the ${subject} in image 1 — every trace of the old body is removed. Step 2: copy the body of the ${subject} from image 2 at 100% 1:1 and paste it as-is into image 1, including ${bodyParts} and any visible anatomy, clothing, tattoos, scars, or skin texture from image 2, unmodified. Step 3: place the pasted body in the SAME position, pose, orientation, perspective, and size as the old body it replaced — minor editing is allowed only to seat the new body into that exact position, never to change the body itself. ${NO_TOUCH}\n\nKeep the exact face, hair, and expression of image 1 100% unchanged. Keep image 1 pose, camera, bed or background, and lighting. Everything the body swap did not touch must remain pixel-identical. Blend only at neck and shoulders.\n\nAvoid: ${SWAP_NEGATIVE}, different face from image 1, face from image 2, new pose, gym body, silicone breasts, sculpted abs, remodelled body`
}

/**
 * Dual-person swap: three references — target scene plus one identity source per
 * subject. Same copy-paste discipline, never cross-mapped.
 */
export function buildDualSwapPrompt(maleKind: SwapKind, femaleKind: SwapKind): string {
  return `Reference 1 is the target scene and composition. Reference 2 maps ONLY to the male subject and requires a ${maleKind} swap. Reference 3 maps ONLY to the female subject and requires a ${femaleKind} swap. Perform each swap as a surgical copy-paste: copy the stated identity part from its source reference, erase the corresponding part in the target scene, paste it as-is into the exact position the old part occupied, with minimal editing only to seat it into that position. ${NO_TOUCH}\n\nPreserve the target pose, framing, camera angle, lighting, background, interaction and all non-identity details. Keep both identities separate; never blend, exchange or cross-map them. Any change beyond the two stated swaps is a failure.\n\nAvoid: ${SWAP_NEGATIVE}, cross-mapped identities, blended identity, face of female on male, face of male on female`
}

const UNDRESS_NEGATIVE =
  'child, teen, underage, clothes remaining, shirt, bra, panties, lingerie, towel, sheet covering, mosaic, censor bar, black bar, blur over genitals, different face, different hair, different expression, different pose, different background, different height, different weight, different width, slimmer, fatter, taller, shorter, gym body, shredded, bodybuilder, zero fat, silicone breasts, implant breasts, pornstar body, beauty filter, plastic skin, poreless skin, smooth skin, even-tone skin, glossy retouch, doll, airbrush, cartoon, anime, CGI, extra limbs, extra breasts, extra fingers, warped hands, text, watermark'

/**
 * Undressing is an analysis-plus-reveal task, never a generic generator:
 *
 * 1. READ the clothed photograph first — height, weight, complexion, colour,
 *    tone, body frame, actual breast size, hip size, thigh shape — and derive
 *    the unclothed body from THAT specific person's parameters.
 * 2. Body skin renders one shade darker than the face; human, imperfect, with
 *    pores and natural pigmentation.
 * 3. Genitals and nipples are never standard issue: every person is unique.
 *    Produce a unique anatomical description closest to the reality implied by
 *    the person in the photo.
 * 4. Pubic hair is assumed present unless the user explicitly says otherwise:
 *    medium length, natural, soft strands.
 * 5. Areolae and nipples are two shades darker than the chest skin.
 * 6. General anatomy (pussy, cock, balls, ballsack, asshole) follows the
 *    accepted anatomical reality — correct anatomy is the bible.
 */
export function buildUndressPrompt(person: SwapPerson = 'woman'): string {
  const breasts = person === 'man'
    ? ''
    : 'Soft natural real breasts sized from what the clothes actually show: same cup volume the visible shape implies, natural hang and weight, not silicone, not enhanced.'
  const pubic = person === 'man'
    ? 'Cropped natural groin hair in the exact shape and density the visible pants/undies line implies.'
    : 'Pubic hair ALWAYS present as the default: medium length, natural, soft strands, shaped as a natural bush or trimmed line — never clean shaven, never waxed bare, unless the user explicitly states otherwise.'
  const vulva = person === 'man'
    ? ''
    : 'VULVA (woman) — agreed general anatomy as a bible: outer labia, inner labia, clitoris, wetness appropriate to the context, anatomically correct placement and proportion, tissue tone one to two shades darker than thighs.'
  const cock = person === 'woman'
    ? ''
    : 'COCK AND BALLS (man) — agreed general anatomy as a bible: shaft, glans, foreskin state implied by the person, veins, testicles, wrinkled ballsack, correct placement and proportion.'
  return `UNDRESS. Adult 18+ only.

FIRST: ANALYZE the photograph. This is not a generic task. Read the clothed person and extract: height, weight, build, complexion, skin colour and tone, body frame, actual breast size (if ${person === 'man' ? 'male chest' : 'a woman'}), hip size, shape of thighs, and the skin visible on face, neck, arms and hands.

Then remove every piece of clothing and reveal the body that those clothes were already covering: same proportions, same height, same weight, same width, same fat, same muscle, same pose, same hands, same camera, same crop, same lighting, same background.

SKIN RULE. Body skin is exactly ONE shade darker than the face skin of this person, with fully human imperfect skin: visible pores, freckles, moles, pigmentation patches, natural redness, uneven tone, peach fuzz where it belongs. Never plastic, never shiny, never smooth, never even-tone airbrushed, never porcelain.

NIPPLE RULE. Areolae and nipples are TWO shades darker than the chest skin of this person. Size and shape are unique to this person, derived from the size and shape of the chest the photo shows: not default circles, not standard issue.

ANATOMY RULE. Every person is unique below the waist: generate a unique description of the genitals that is closest to the reality implied of the person unclothed, based on the viewer's parameters (the person's visible build and features). Never paste a generic description.

${breasts}
${pubic}
${vulva}
${cock}
ANUS — agreed general anatomy as a bible: puckered ring, tone slightly darker than the surrounding skin of the body of this same person.

Correct anatomy is the bible. No caricature, no over-exaggerated porn anatomy, no copy-paste genitals.

Avoid: ${UNDRESS_NEGATIVE}`
}

export const UNDRESS_PROMPT = buildUndressPrompt('woman')
