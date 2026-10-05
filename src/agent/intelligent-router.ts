/**
 * Intelligent routing: analyzes user intent and automatically selects
 * the optimal workflow, operation, and settings with minimal user input.
 */

export type WorkflowIntent =
  | 'create_from_scratch'
  | 'edit_photo'
  | 'combine_photos'
  | 'upscale'
  | 'remove_background'
  | 'refine_faces'
  | 'extract_mask'
  | 'edit_region'
  | 'analyze'

export type QualityTier = 'fast' | 'balanced' | 'best'

export interface RoutingDecision {
  intent: WorkflowIntent
  quality: QualityTier
  useCloud: boolean
  operation: string
  confidence: number
  reasoning: string
  autoSettings: Record<string, unknown>
}

export interface RoutingInput {
  prompt: string
  hasImages: boolean
  imageCount: number
  imageTypes?: string[]
  userExplicitPreferences?: {
    quality?: QualityTier
    speed?: 'fast' | 'quality'
  }
}

const INTENT_PATTERNS: Array<{ intent: WorkflowIntent; patterns: RegExp[]; weight: number }> = [
  {
    intent: 'upscale',
    patterns: [
      /\b(upscale|enlarge|increase\s+resolution|4k|high\s+res)\b/i,
      /\b(sharper|more\s+detail|enhance\s+quality)\b/i,
    ],
    weight: 0.95,
  },
  {
    intent: 'remove_background',
    patterns: [
      /\b(remove|cut\s*out|extract)\b.*\b(background|bg)\b/i,
      /\b(transparent|png\s+with\s+no\s+bg)\b/i,
      /\b(isolate|separate)\b.*\b(subject|person|object)\b/i,
    ],
    weight: 0.95,
  },
  {
    intent: 'refine_faces',
    patterns: [
      /\b(refine|fix|improve|enhance)\b.*\b(face|facial|features)\b/i,
      /\b(face\s+detail|face\s+enhance|beautify)\b/i,
      /\b(smooth|clear)\b.*\b(skin|complexion)\b/i,
    ],
    weight: 0.9,
  },
  {
    intent: 'edit_region',
    patterns: [
      /\b(edit|change|modify|replace)\b.*\b(region|area|part|section)\b/i,
      /\b(inpaint|mask\s+edit)\b/i,
      /\b(change|replace)\b.*\b(clothes|clothing|outfit|shirt|dress)\b/i,
    ],
    weight: 0.85,
  },
  {
    intent: 'extract_mask',
    patterns: [
      /\b(extract|create|make|generate)\b.*\b(mask|selection)\b/i,
      /\b(select|isolate)\b.*\b(region|area|part)\b/i,
    ],
    weight: 0.85,
  },
  {
    intent: 'combine_photos',
    patterns: [
      /\b(combine|merge|blend|mix)\b.*\b(photo|image|picture)s?\b/i,
      /\b(two|multiple|several)\b.*\b(photo|image)s?\b.*\b(together|into\s+one)\b/i,
      /\b(collage|composite|montage)\b/i,
    ],
    weight: 0.9,
  },
  {
    intent: 'edit_photo',
    patterns: [
      /\b(edit|modify|change|alter|transform)\b.*\b(photo|image|picture)\b/i,
      /\b(make|turn|convert)\b.*\b(into|to)\b/i,
      /\b(add|remove|change)\b.*\b(element|detail|feature)\b/i,
      /\b(img2img|image\s+to\s+image)\b/i,
    ],
    weight: 0.8,
  },
  {
    intent: 'analyze',
    patterns: [
      /\b(analyze|examine|inspect|look\s+at)\b/i,
      /\b(what|who|where|when|how)\b.*\b(is|are|do|does)\b/i,
      /\b(describe|tell\s+me|explain)\b/i,
    ],
    weight: 0.75,
  },
  {
    intent: 'create_from_scratch',
    patterns: [
      /\b(create|generate|make|produce|render)\b/i,
      /\b(a|an|the)\b.*\b(photo|image|picture|portrait|scene|landscape)\b/i,
      /\b(show\s+me|give\s+me|i\s+want)\b/i,
    ],
    weight: 0.7,
  },
]

const NSFW_INDICATORS = [
  /\b(nude|naked|bare|undressed|unclothed)\b/i,
  /\b(sexy|erotic|sensual|provocative|alluring)\b/i,
  /\b(porn|xxx|adult|explicit)\b/i,
  /\b(kinky|fetish|bdsm|dominant|submissive)\b/i,
  /\b(obscene|filthy|dirty|naughty)\b/i,
  /\b(intimate|seductive|tempting|steamy)\b/i,
]

function detectIntent(prompt: string): { intent: WorkflowIntent; confidence: number } {
  const scores = new Map<WorkflowIntent, number>()

  for (const { intent, patterns, weight } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(prompt)) {
        const current = scores.get(intent) ?? 0
        scores.set(intent, Math.max(current, weight))
      }
    }
  }

  if (scores.size === 0) {
    return { intent: 'create_from_scratch', confidence: 0.6 }
  }

  const [bestIntent, confidence] = Array.from(scores.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))
  return { intent: bestIntent, confidence }
}

function isNSFW(prompt: string): boolean {
  return NSFW_INDICATORS.some((pattern) => pattern.test(prompt))
}

function selectQuality(prompt: string, hasImages: boolean, userPref?: QualityTier): QualityTier {
  if (userPref) return userPref

  const qualityHints = /\b(high\s+quality|best|premium|professional|detailed|realistic|photorealistic)\b/i.test(prompt)
  const speedHints = /\b(quick|fast|rapid|instant|draft|preview)\b/i.test(prompt)

  if (qualityHints || isNSFW(prompt)) return 'best'
  if (speedHints) return 'fast'
  if (hasImages) return 'balanced'
  return 'balanced'
}

function shouldUseCloud(intent: WorkflowIntent, quality: QualityTier, imageCount: number): boolean {
  if (quality === 'best') return true
  if (intent === 'combine_photos' && imageCount > 1) return true
  if (intent === 'remove_background' || intent === 'refine_faces') return true
  if (intent === 'upscale' && quality !== 'fast') return true
  return false
}

function mapIntentToOperation(intent: WorkflowIntent): string {
  const mapping: Record<WorkflowIntent, string> = {
    create_from_scratch: 'create',
    edit_photo: 'edit',
    combine_photos: 'combine',
    upscale: 'upscale',
    remove_background: 'remove_background',
    refine_faces: 'face_detailer',
    extract_mask: 'mask',
    edit_region: 'masked_edit',
    analyze: 'auto',
  }
  return mapping[intent]
}

function generateAutoSettings(intent: WorkflowIntent, prompt: string, quality: QualityTier): Record<string, unknown> {
  const settings: Record<string, unknown> = {}

  if (intent === 'create_from_scratch') {
    settings.aspect_ratio = detectAspectRatio(prompt)
    if (isNSFW(prompt)) {
      settings.negative_prompt = 'ugly, blurry, low quality, deformed, watermark, text'
    }
  }

  if (intent === 'upscale') {
    settings.upscale_factor = quality === 'best' ? 4 : 2
  }

  if (intent === 'edit_photo' || intent === 'edit_region') {
    settings.denoise_strength = quality === 'best' ? 0.75 : 0.65
  }

  return settings
}

function detectAspectRatio(prompt: string): string {
  if (/\b(portrait|vertical|phone|mobile)\b/i.test(prompt)) return '9:16'
  if (/\b(landscape|horizontal|wide|panorama)\b/i.test(prompt)) return '16:9'
  if (/\b(square|insta|profile)\b/i.test(prompt)) return '1:1'
  return '1:1'
}

export function routeIntelligently(input: RoutingInput): RoutingDecision {
  const { intent, confidence } = detectIntent(input.prompt)
  const quality = selectQuality(input.prompt, input.hasImages, input.userExplicitPreferences?.quality)
  const useCloud = shouldUseCloud(intent, quality, input.imageCount)
  const operation = mapIntentToOperation(intent)
  const autoSettings = generateAutoSettings(intent, input.prompt, quality)

  const reasoning = buildReasoning(intent, quality, useCloud, confidence)

  return {
    intent,
    quality,
    useCloud,
    operation,
    confidence,
    reasoning,
    autoSettings,
  }
}

function buildReasoning(intent: WorkflowIntent, quality: QualityTier, useCloud: boolean, confidence: number): string {
  const parts: string[] = []

  parts.push(`Detected intent: ${intent.replace(/_/g, ' ')} (${Math.round(confidence * 100)}% confidence)`)

  if (useCloud) {
    parts.push(`Routing to cloud for ${quality} quality`)
  } else {
    parts.push(`Using local generation for speed`)
  }

  return parts.join('. ')
}

export function enhancePromptForNSFW(prompt: string): string {
  if (!isNSFW(prompt)) return prompt

  const enhancements = [
    'highly detailed',
    'professional photography',
    'sharp focus',
    'exquisite quality',
  ]

  const hasQualityTerms = /\b(hd|high\s+quality|detailed|professional|4k|8k)\b/i.test(prompt)

  if (hasQualityTerms) return prompt

  return `${prompt}, ${enhancements.join(', ')}`
}
