export type SwapKind = 'face' | 'head' | 'body'
export type SwapPerson = 'woman' | 'man'

const SWAP_NEGATIVE =
  'different face, similar face, cousin face, beautified face, face mix, identity drift, expression change, smile change, age change, gender change, different hair, different bone structure, slimmer body, heavier body, taller, shorter, extra person, extra limbs, extra fingers, warped hands, melted blend, halo, mismatch lighting, plastic skin, airbrush, poreless skin, cartoon, anime, CGI, text, watermark, mosaic, censor bar, clothes change, pose change, background change, camera change, studio light'

export function buildSwapPrompt(kind: SwapKind, person: SwapPerson) {
  const subject = person === 'man' ? 'man' : 'woman'
  const bodyParts = person === 'man'
    ? 'torso, chest, belly, hips, legs, arms, skin'
    : 'torso, breasts, belly, hips, legs, arms, skin'

  const lock = `Do not invent. Do not beautify. Do not slim, thicken, age-shift, or change bone structure, expression, eye shape, nose, lips, hair texture, or skin tone. The only allowed change is the minimum surgical warp needed so the copied identity sits on image 1's existing pose and camera. Nothing else.`

  if (kind === 'face') {
    return `Image 1 is the target photograph. Image 2 is the identity source.\n\nCopy-paste ONLY the face of the ${subject} from image 2 onto the ${subject} in image 1 at 100% 1:1 identity. Same bone structure, eyes, eyelids, brows, nose, lips, teeth if visible, pores, moles, freckles, scars, wrinkles, age, ethnicity, and the SAME expression as image 1. ${lock}\n\nKeep image 1 pose, body, hands, hair, neck, ears, clothing, jewelry, background, lighting, shadows, camera angle, crop, and anatomy identical.\n\nAvoid: ${SWAP_NEGATIVE}`
  }

  if (kind === 'head') {
    return `Image 1 is the target photograph. Image 2 is the identity source.\n\nCopy-paste the entire head of the ${subject} from image 2 onto image 1 at 100% 1:1 identity, including face, hair, ears, and neck. Same expression as image 1. ${lock}\n\nKeep image 1 body, pose, hands, clothing, jewelry, background, lighting, shadows, camera angle, and crop identical. Blend only at the neck seam.\n\nAvoid: ${SWAP_NEGATIVE}, hair from image 1`
  }

  return `Image 1 is the target photograph. Image 2 is the body source.\n\nCopy-paste the body of the ${subject} from image 2 onto image 1 at 100% 1:1 identity, including ${bodyParts} and any visible anatomy or clothing from image 2. Keep exact height, width, weight, fat, and proportions from image 2. ${lock}\n\nKeep the exact face, hair, and expression of image 1 100% unchanged. Keep image 1 pose, camera, bed or background, and lighting. Blend only at neck and shoulders.\n\nAvoid: ${SWAP_NEGATIVE}, different face from image 1, face from image 2, new pose, gym body, silicone breasts`
}

const UNDRESS_NEGATIVE =
  'child, teen, underage, clothes remaining, shirt, bra, panties, lingerie, towel, sheet covering, mosaic, censor bar, black bar, blur over genitals, different face, different hair, different expression, different pose, different background, different height, different weight, different width, slimmer, fatter, taller, shorter, gym body, shredded, bodybuilder, zero fat, silicone breasts, implant breasts, pornstar body, beauty filter, plastic skin, poreless skin, doll, airbrush, cartoon, anime, CGI, extra limbs, extra breasts, extra fingers, warped hands, text, watermark'

export const UNDRESS_PROMPT = `UNDRESS. Adult 18+ only.\n\nRemove every piece of clothing. Leave the person fully naked and uncensored.\n\nCopy-paste identity: same face, same expression, same hair, same age, same pose, same hands, same camera, same crop, same lighting, same background.\n\nDo not change height, width, weight, fat, muscle, or proportions. Read the clothes and visible body and keep THAT body. Average real person, not a pornstar. Soft real breasts if a woman, not silicone. Natural belly if it is there. No gym body. No shredded look. No zero-fat retouch.\n\nSkin must stay photoreal: pores, peach fuzz, imperfections. Never plastic, never smooth, never airbrushed.\n\nThe only allowed change is removing cloth and revealing the body that those clothes were already covering. Minimum surgical fit to the existing pose. Nothing else.\n\nAvoid: ${UNDRESS_NEGATIVE}`
