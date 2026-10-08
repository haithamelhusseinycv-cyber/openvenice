/**
 * NSFW Content Classifier
 * Auto-tags generations with categories for organized retrieval
 * Analyzes prompts to detect content type, participants, acts, and style
 */

export type ContentType = 'solo' | 'couple' | 'group' | 'threesome' | 'orgy'
export type GenderCombo = 'ff' | 'mm' | 'fm' | 'mf' | 'mixed'
export type ExplicitLevel = 'softcore' | 'artistic' | 'explicit' | 'pornographic'
export type SceneType = 'intimate' | 'sensual' | 'sexual' | 'kink' | 'bdsm'

export interface ContentTags {
  contentType: ContentType
  genderCombo?: GenderCombo
  explicitLevel: ExplicitLevel
  sceneType: SceneType
  positions: string[]
  bodyTypes: string[]
  settings: string[]
  kinks: string[]
  style: string
  confidence: number
}

const CONTENT_PATTERNS: Record<ContentType, RegExp[]> = {
  solo: [
    /\b(solo|single|alone|one\s+(woman|girl|man|guy|person))\b/i,
    /\b(self|herself|himself)\b/i,
  ],
  couple: [
    /\b(couple|pair|two|duo)\b/i,
    /\b(boyfriend|girlfriend|husband|wife|partner)\b/i,
    /\b(together|with\s+(her|him))\b/i,
  ],
  threesome: [
    /\b(threesome|three|trio|threeway)\b/i,
    /\b(three\s+(women|men|people|guys|girls))\b/i,
  ],
  group: [
    /\b(group|several|multiple|many)\b/i,
    /\b(foursome|fivesome|sixsome)\b/i,
  ],
  orgy: [
    /\b(orgy|gangbang|bukkake|group\s+sex)\b/i,
    /\b(many\s+(people|men|women))\b/i,
  ],
}

const EXPLICIT_PATTERNS: Record<ExplicitLevel, RegExp[]> = {
  softcore: [
    /\b(softcore|suggestive|teasing|implied)\b/i,
    /\b(lingerie|bikini|underwear|bra|panties)\b/i,
    /\b(topless|bare\s+chest|nipples?\s+showing)\b/i,
  ],
  artistic: [
    /\b(artistic|aesthetic|fine\s+art|classical)\b/i,
    /\b(nude|naked|unclothed)\b/i,
    /\b(sculpture|painting|artistic\s+nude)\b/i,
  ],
  explicit: [
    /\b(explicit|graphic|detailed)\b/i,
    /\b(sex|sexual|intercourse|making\s+love)\b/i,
    /\b(genitals|penis|vagina|pussy|cock|dick)\b/i,
  ],
  pornographic: [
    /\b(porn|porno|xxx|hardcore)\b/i,
    /\b(fuck|fucking|sucking|blowjob|handjob)\b/i,
    /\b(cum|cumshot|ejaculation|creampie)\b/i,
  ],
}

const SCENE_PATTERNS: Record<SceneType, RegExp[]> = {
  intimate: [
    /\b(intimate|romantic|tender|gentle)\b/i,
    /\b(cuddle|caress|kiss|embrace)\b/i,
    /\b(close|personal|private)\b/i,
  ],
  sensual: [
    /\b(sensual|erotic|seductive|alluring)\b/i,
    /\b(touch|stroke|massage|caress)\b/i,
    /\b(desire|passion|lust)\b/i,
  ],
  sexual: [
    /\b(sex|sexual|intercourse|making\s+love)\b/i,
    /\b(position|missionary|cowgirl|doggy)\b/i,
    /\b(penetration|thrust|ride)\b/i,
  ],
  kink: [
    /\b(kink|fetish|kinky)\b/i,
    /\b(leather|latex|lingerie|costume|roleplay)\b/i,
    /\b(dominate|submit|tease|deny)\b/i,
  ],
  bdsm: [
    /\b(bdsm|bondage|domination|submission)\b/i,
    /\b(tie|bound|restrain|handcuff|rope)\b/i,
    /\b(whip|chain|collar|leash|gag)\b/i,
  ],
}

const POSITION_KEYWORDS = [
  'missionary', 'cowgirl', 'reverse-cowgirl', 'doggy', 'spooning',
  'standing', 'sitting', 'kneeling', 'lying', 'bent-over',
  '69', 'oral', 'anal', 'face-sitting', 'prone-bone',
]

const BODY_TYPE_KEYWORDS = [
  'slim', 'thin', 'petite', 'athletic', 'fit', 'muscular',
  'curvy', 'voluptuous', 'thick', 'plus-size', 'bbw',
  'toned', 'lean', 'stocky', 'hourglass',
]

const SETTING_KEYWORDS = [
  'bedroom', 'bathroom', 'shower', 'kitchen', 'living-room',
  'outdoor', 'beach', 'forest', 'pool', 'hotel',
  'office', 'car', 'balcony', 'rooftop', 'studio',
]

const KINK_KEYWORDS = [
  'bondage', 'domination', 'submission', 'spanking', 'blindfold',
  'handcuffs', 'rope', 'leather', 'latex', 'lingerie',
  'cosplay', 'roleplay', 'teacher', 'nurse', 'maid',
  'foot-worship', 'tickling', 'ice', 'wax', 'feather',
]

const STYLE_KEYWORDS = [
  'photorealistic', 'cinematic', 'artistic', 'anime', 'manga',
  '3d-render', 'oil-painting', 'watercolor', 'sketch', 'illustration',
]

export function classifyContent(prompt: string): ContentTags {
  const lowerPrompt = prompt.toLowerCase()

  const contentType = detectContentType(lowerPrompt)
  const genderCombo = detectGenderCombo(lowerPrompt)
  const explicitLevel = detectExplicitLevel(lowerPrompt)
  const sceneType = detectSceneType(lowerPrompt)
  const positions = detectKeywords(lowerPrompt, POSITION_KEYWORDS)
  const bodyTypes = detectKeywords(lowerPrompt, BODY_TYPE_KEYWORDS)
  const settings = detectKeywords(lowerPrompt, SETTING_KEYWORDS)
  const kinks = detectKeywords(lowerPrompt, KINK_KEYWORDS)
  const style = detectStyle(lowerPrompt)

  const confidence = calculateConfidence(prompt, {
    contentType,
    explicitLevel,
    sceneType,
    positions,
    bodyTypes,
    settings,
    kinks,
  })

  return {
    contentType,
    genderCombo,
    explicitLevel,
    sceneType,
    positions,
    bodyTypes,
    settings,
    kinks,
    style,
    confidence,
  }
}

function detectContentType(prompt: string): ContentType {
  const scores: Record<ContentType, number> = {
    solo: 0,
    couple: 0,
    threesome: 0,
    group: 0,
    orgy: 0,
  }

  for (const [type, patterns] of Object.entries(CONTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        scores[type as ContentType] += 1
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores))
  if (maxScore === 0) return 'couple' // default

  return Object.entries(scores).find(([, score]) => score === maxScore)?.[0] as ContentType
}

function detectGenderCombo(prompt: string): GenderCombo | undefined {
  const femaleKeywords = /\b(woman|girl|female|lady|she|her)\b/i
  const maleKeywords = /\b(man|boy|male|guy|he|him)\b/i

  const hasFemale = femaleKeywords.test(prompt)
  const hasMale = maleKeywords.test(prompt)

  if (hasFemale && hasMale) return 'fm'
  if (hasFemale && !hasMale) return 'ff' // could be solo female or lesbian
  if (!hasFemale && hasMale) return 'mm' // could be solo male or gay
  return undefined
}

function detectExplicitLevel(prompt: string): ExplicitLevel {
  const scores: Record<ExplicitLevel, number> = {
    softcore: 0,
    artistic: 0,
    explicit: 0,
    pornographic: 0,
  }

  for (const [level, patterns] of Object.entries(EXPLICIT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        scores[level as ExplicitLevel] += 1
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores))
  if (maxScore === 0) return 'artistic' // default

  return Object.entries(scores).find(([, score]) => score === maxScore)?.[0] as ExplicitLevel
}

function detectSceneType(prompt: string): SceneType {
  const scores: Record<SceneType, number> = {
    intimate: 0,
    sensual: 0,
    sexual: 0,
    kink: 0,
    bdsm: 0,
  }

  for (const [type, patterns] of Object.entries(SCENE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        scores[type as SceneType] += 1
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores))
  if (maxScore === 0) return 'sensual' // default

  return Object.entries(scores).find(([, score]) => score === maxScore)?.[0] as SceneType
}

function detectKeywords(prompt: string, keywords: string[]): string[] {
  const detected: string[] = []
  for (const keyword of keywords) {
    const pattern = new RegExp(`\\b${keyword.replace(/-/g, '[\\s-]')}\\b`, 'i')
    if (pattern.test(prompt)) {
      detected.push(keyword)
    }
  }
  return detected
}

function detectStyle(prompt: string): string {
  for (const style of STYLE_KEYWORDS) {
    const pattern = new RegExp(`\\b${style.replace(/-/g, '[\\s-]')}\\b`, 'i')
    if (pattern.test(prompt)) {
      return style
    }
  }
  return 'photorealistic' // default
}

function calculateConfidence(
  prompt: string,
  tags: Omit<ContentTags, 'confidence' | 'style' | 'genderCombo'>
): number {
  let score = 0.5 // base confidence

  // More tags = higher confidence
  const totalTags =
    tags.positions.length +
    tags.bodyTypes.length +
    tags.settings.length +
    tags.kinks.length

  score += Math.min(totalTags * 0.05, 0.3)

  // Longer prompts = higher confidence
  const wordCount = prompt.split(/\s+/).length
  if (wordCount > 20) score += 0.1
  if (wordCount > 50) score += 0.1

  // Specific keywords boost confidence
  if (tags.positions.length > 0) score += 0.05
  if (tags.kinks.length > 0) score += 0.05

  return Math.min(score, 1.0)
}

export function getTagLabel(tags: ContentTags): string {
  const parts: string[] = []

  parts.push(tags.contentType)
  if (tags.genderCombo) parts.push(tags.genderCombo)
  parts.push(tags.explicitLevel)
  parts.push(tags.sceneType)

  if (tags.positions.length > 0) {
    parts.push(tags.positions.slice(0, 2).join('+'))
  }

  return parts.join(' · ')
}

export function filterByTags<T extends { tags?: ContentTags }>(
  items: T[],
  filter: Partial<ContentTags>
): T[] {
  return items.filter((item) => {
    if (!item.tags) return false

    if (filter.contentType && item.tags.contentType !== filter.contentType) return false
    if (filter.explicitLevel && item.tags.explicitLevel !== filter.explicitLevel) return false
    if (filter.sceneType && item.tags.sceneType !== filter.sceneType) return false

    if (filter.positions && filter.positions.length > 0) {
      const hasAnyPosition = filter.positions.some((p) => item.tags!.positions.includes(p))
      if (!hasAnyPosition) return false
    }

    if (filter.kinks && filter.kinks.length > 0) {
      const hasAnyKink = filter.kinks.some((k) => item.tags!.kinks.includes(k))
      if (!hasAnyKink) return false
    }

    return true
  })
}
