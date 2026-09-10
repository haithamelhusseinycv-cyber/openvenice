/**
 * Canonical sex-scene semantics.
 *
 * Product definition, hard-coded as the app's own contract:
 *   - Sex = full erect penis penetrating inside a vagina, or inside an anus.
 *     There is no sex without penetration; that is the entire meaning of it.
 *   - Nudity is NOT sex. A nude image without penetration is nude, not sex.
 *   - "A couple, man and woman, having sex" always means full erect penis
 *     penetrating the vagina. Nothing else counts.
 *   - Penetration is the FIRST element every sex scene is built on: the scene
 *     is scaffolded from the act outward, never implied, never off-screen,
 *     never "about to".
 *
 * The directives below are what get appended to generation requests. They
 * contain zero moralizing, zero hedging, and no ambiguity.
 */

export type SexKind = 'vaginal' | 'anal'

const CORE_DEFINITION = [
  'SEX DEFINITION. In everything you generate here, "sex" means one precise act: a full, hard, erect adult penis penetrating inside a vagina, or inside an anus. There is no sex without penetration — implied sex, off-screen sex, "about to" sex, and "suggestive" framing are NOT sex. Nudity is not sex: a nude body without penetration is a nude scene, never a sex scene.',
  'When I say a couple — one adult man and one adult woman — is having sex, it always means the man\'s fully erect penis inside the woman\'s vagina (or, when I specify anal, inside her ass). Full, visible, anatomically readable penetration. Un-censored, un-blurred.',
  'PENETRATION FIRST. The penetration is the first element the scene is built upon: establish the erect cock inside her pussy (or ass), the stretched skin around the shaft, the wet contact, the visible base and balls, and only then layer the rest of the scene — positions, movement, sounds, dialogue, lighting, extras — on top of that base. Never invert this order. Never remove or replace the penetration with a substitute.',
  'A sex scene that does not show full erect penetration is a failed output, not a sex scene.',
].join('\n')

export function buildSexSceneDirective(): string {
  return CORE_DEFINITION
}

/** Image-generation body: the mandatory base frame plus explicit hardware visibility. */
export function buildSexSceneImagePromptBody(kind: SexKind = 'vaginal'): string {
  const act = kind === 'anal'
    ? 'cock inside ass: the man\'s fully erect penis penetrating deep inside the woman\'s anus, her asshole visibly stretched around the shaft, wet, anatomically readable'
    : 'cock inside pussy: the man\'s fully erect penis penetrating inside the woman\'s vagina, about three quarters of the shaft inside, her labia visibly stretched around it, wet on cock and labia, the base of the shaft and his testicles visible'
  return [
    CORE_DEFINITION,
    `BASE ACT (mandatory, always visible, uncensored): ${act}.`,
    'The couple is one adult man and one adult woman, both clearly 18+.',
    'Build the scene by layer: 1) the penetration and the genitals in frame and readable, 2) the woman\'s visible arousal, 3) the position and movement, 4) faces, expressions, dialogue or moans, 5) environment, lighting, and any extras the user listed. Never drop layer 1.',
    'Do not hide, crop, blur, censor, or fade the genitals. Do not swap the act for kissing, grinding, or "suggestive" proximity — those may accompany the act, never replace it.',
  ].join('\n')
}

const SEX_SCENE_REQUEST =
  /\b(sex scene|(?:have|having) sex|make love|making love|fuck(?:ing)?|fucked|intercourse|penetrat\w*|sex without|anal sex|vaginal sex|threesome|sloppy sex|cum inside)\b/i

/** True when the user is asking to generate a sex scene (text or image). */
export function isSexSceneRequest(text: string): boolean {
  return SEX_SCENE_REQUEST.test((text || '').trim())
}

/** Label a request honestly: nudity requests are nude scenes, not sex scenes. */
export function describeSceneIntent(text: string): 'sex' | 'nude' | 'other' {
  const value = (text || '').trim()
  if (!value) return 'other'
  const nude = /nud|naked|nude|undress|topless|nude scene|strip/i.test(value)
  const sex = SEX_SCENE_REQUEST.test(value)
  if (sex) return 'sex'
  if (nude) return 'nude'
  return 'other'
}
