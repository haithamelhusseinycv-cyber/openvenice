/**
 * Intelligent routing: analyzes user intent and automatically selects
 * the optimal workflow, operation, and settings with minimal user input.
 * 
 * Enhanced with NSFW-specific routing, specialized model selection,
 * and comprehensive workflow templates for adult content generation.
 */

/**
 * Intelligent routing: analyzes user intent and automatically selects
 * the optimal workflow, operation, and settings with minimal user input.
 *
 * Enhanced with NSFW-specific routing, specialized model selection,
 * and comprehensive workflow templates for adult content generation.
 */
import { getNSFWWorkflow, type NSFWWorkflowTemplate } from '../lib/nsfw-workflows';
import { selectOptimalModel, buildNSFWPipeline, type PipelineStep, type LocalDreamModel, type ModelSelectionCriteria } from '../lib/localdream-specialized-models';
import { buildNSFWPrompt, buildNSFWNegativePrompt, SEXUAL_POSITIONS } from '../lib/nsfw-anatomy-knowledge';
import { intelligentOrchestrator, analyzePromptComplexity } from '../lib/nsfw-intelligence';

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
  const detected = detectIntent(input.prompt)
  const intent = input.hasImages && detected.confidence <= 0.7 ? (input.imageCount > 1 ? 'combine_photos' : 'edit_photo') : detected.intent
  const confidence = input.hasImages && detected.confidence <= 0.7 ? 0.9 : detected.confidence
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

/**
 * NSFW-specific routing and workflow selection
 */

export type NSFWCategory = 'solo' | 'couple' | 'group' | 'oral' | 'anal' | 'bdsm' | 'erotic' | 'explicit'

export interface NSFWRoutingDecision extends RoutingDecision {
  isNSFW: boolean
  nsfwCategory?: NSFWCategory
  nsfwWorkflow?: NSFWWorkflowTemplate
  nsfwPipeline?: PipelineStep[]
  nsfwPrompt?: string
  nsfwNegativePrompt?: string
  selectedModels?: {
    primary: string
    secondary: string[]
  }
}

/**
 * Detect NSFW category from prompt
 */
function detectNSFWCategory(prompt: string): NSFWCategory | undefined {
  if (!isNSFW(prompt)) return undefined

  const categoryPatterns: Record<NSFWCategory, RegExp[]> = {
    solo: [/\b(solo|alone|self|masturbat)/i],
    couple: [/\b(couple|two|pair|missionary|doggy|cowgirl|spooning)/i],
    group: [/\b(threesome|orgy|group|three|multiple|ffm|mmf)/i],
    oral: [/\b(oral|blowjob|fellatio|cunnilingus|eating|suck)/i],
    anal: [/\b(anal|butt|ass|rear)/i],
    bdsm: [/\b(bdsm|bondage|dominant|submissive|tie|restrain)/i],
    erotic: [/\b(erotic|sensual|lingerie|tease|softcore)/i],
    explicit: [/\b(explicit|hardcore|porn|xxx|intercourse|penetration)/i],
  }

  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    if (patterns.some((pattern) => pattern.test(prompt))) {
      return category as NSFWCategory
    }
  }

  return 'explicit' // Default to explicit if NSFW but no specific category
}

/**
 * Detect sexual position from prompt
 */
function detectSexualPosition(prompt: string): string | undefined {
  const positionKeywords = SEXUAL_POSITIONS.flatMap((p) => [p.id, ...p.promptKeywords])
  
  for (const keyword of positionKeywords) {
    if (prompt.toLowerCase().includes(keyword.toLowerCase())) {
      const position = SEXUAL_POSITIONS.find((p) => 
        p.id === keyword || p.promptKeywords.some((k) => k.toLowerCase() === keyword.toLowerCase())
      )
      if (position) return position.id
    }
  }
  
  return undefined
}

/**
 * Enhanced routing with NSFW workflow integration
 */
export function routeIntelligentlyNSFW(input: RoutingInput): NSFWRoutingDecision {
  const baseDecision = routeIntelligently(input)
  const nsfwDetected = isNSFW(input.prompt)
  
  if (!nsfwDetected) {
    return {
      ...baseDecision,
      isNSFW: false,
    }
  }

  // NSFW-specific routing
  const nsfwCategory = detectNSFWCategory(input.prompt)
  const position = detectSexualPosition(input.prompt)
  
  // Select appropriate workflow
  let nsfwWorkflow: NSFWWorkflowTemplate | undefined
  if (nsfwCategory && position) {
    // Try to find workflow matching both category and position
    nsfwWorkflow = getNSFWWorkflow(position) || getNSFWWorkflow(`${nsfwCategory}-${position}`)
  }
  if (!nsfwWorkflow && nsfwCategory) {
    // Fallback to category-based workflow
    const categoryWorkflows = ['solo-female', 'solo-male', 'couple-missionary', 'oral-fellatio', 'anal', 'threesome-ffm', 'bdsm-bondage', 'lingerie-erotic', 'explicit-pornographic']
    const matchingWorkflow = categoryWorkflows.find((id) => id.startsWith(nsfwCategory!))
    if (matchingWorkflow) {
      nsfwWorkflow = getNSFWWorkflow(matchingWorkflow)
    }
  }

  // Build NSFW-optimized prompt
  const nsfwPrompt = buildNSFWPrompt({
    position: position,
    lighting: 'soft diffused',
    cameraAngle: 'eye-level intimacy',
    focusType: 'shallow depth of field',
    colorTone: 'warm sensual',
    additionalDetails: nsfwWorkflow ? [nsfwWorkflow.positivePrompt] : [],
  })

  const nsfwNegativePrompt = buildNSFWNegativePrompt(
    nsfwWorkflow ? [nsfwWorkflow.negativePrompt] : []
  )

  // Select models and build pipeline
  const quality = baseDecision.quality
  const modelCriteria: ModelSelectionCriteria = {
    taskType: 'generation',
    quality,
    hasReferenceImage: input.hasImages,
    requiresAnatomyCorrection: true,
    targetResolution: nsfwWorkflow?.settings.resolution || [1024, 1024],
  }

  const primaryModel = selectOptimalModel(modelCriteria)
  
  // Build processing pipeline
  const nsfwPipeline = buildNSFWPipeline({
    quality,
    includeFaceEnhance: true,
    includeBodyEnhance: true,
    includeSkinTexture: true,
    includeUpscale: quality === 'best',
    targetResolution: nsfwWorkflow?.settings.resolution || [1024, 1024],
  })

  // Build reasoning
  const reasoning = [
    baseDecision.reasoning,
    `NSFW category: ${nsfwCategory}`,
    position ? `Detected position: ${position}` : null,
    nsfwWorkflow ? `Using workflow: ${nsfwWorkflow.label}` : null,
    `Pipeline: ${nsfwPipeline.length} steps`,
    `Primary model: ${primaryModel.name}`,
  ].filter(Boolean).join('. ')

  return {
    ...baseDecision,
    isNSFW: true,
    nsfwCategory,
    nsfwWorkflow,
    nsfwPipeline,
    nsfwPrompt,
    nsfwNegativePrompt,
    selectedModels: {
      primary: primaryModel.id,
      secondary: nsfwPipeline.slice(1).map((step) => step.model.id),
    },
    reasoning,
    autoSettings: {
      ...baseDecision.autoSettings,
      nsfw_workflow_id: nsfwWorkflow?.id,
      nsfw_category: nsfwCategory,
      position: position,
      pipeline_steps: nsfwPipeline.length,
      models: {
        primary: primaryModel.id,
        secondary: nsfwPipeline.slice(1).map((step) => step.model.id),
      },
    },
  }
}

/**
 * Get recommended settings for NSFW generation
 */
export function getNSFWRecommendations(prompt: string): {
  workflow?: NSFWWorkflowTemplate
  models: string[]
  settings: Record<string, unknown>
  tips: string[]
} {
  const category = detectNSFWCategory(prompt)
  const position = detectSexualPosition(prompt)
  
  let workflow: NSFWWorkflowTemplate | undefined
  if (position) {
    workflow = getNSFWWorkflow(position)
  }
  if (!workflow && category) {
    const categoryWorkflows = ['solo-female', 'couple-missionary', 'oral-fellatio', 'anal', 'threesome-ffm', 'bdsm-bondage', 'explicit-pornographic']
    const matchingId = categoryWorkflows.find((id) => id.startsWith(category))
    if (matchingId) {
      workflow = getNSFWWorkflow(matchingId)
    }
  }

  const primaryModel = selectOptimalModel({
    taskType: 'generation',
    quality: 'best',
    hasReferenceImage: false,
    requiresAnatomyCorrection: true,
    targetResolution: workflow?.settings.resolution || [1024, 1024],
  })

  const tips: string[] = [
    'Use ControlNet for precise pose control',
    'Enable face enhancement for realistic expressions',
    'Apply skin texture model for natural appearance',
    'Use shallow depth of field for intimate focus',
    'Enable 4x upscaling for final output',
  ]

  if (workflow) {
    tips.push(`Recommended workflow: ${workflow.label}`)
    if (workflow.loras && workflow.loras.length > 0) {
      tips.push(`Suggested LoRAs: ${workflow.loras.map((l) => l.name).join(', ')}`)
    }
  }

  return {
    workflow,
    models: [primaryModel.id],
    settings: workflow?.settings || {
      steps: 35,
      cfg: 8.0,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [1024, 1024],
    },
    tips,
  }
}

/**
 * TOP-TIER INTELLIGENT ORCHESTRATION
 * 
 * Master entry point for NSFW content generation with full intelligence:
 * - Prompt complexity analysis
 * - Smart prompt enhancement using anatomy knowledge
 * - Adaptive pipeline depth based on complexity and quality
 * - Quality prediction before generation
 * - Intelligent model selection with compatibility awareness
 * - Context memory and user preference learning
 * - Comprehensive reasoning and recommendations
 */
export interface TopIntelligentResult {
  // Core outputs
  enhancedPrompt: string
  negativePrompt: string
  pipeline: PipelineStep[]
  selectedModels: LocalDreamModel[]
  
  // Intelligence outputs
  complexityScore: number
  qualityPrediction: number
  successProbability: number
  confidence: number
  
  // Context
  workflow?: NSFWWorkflowTemplate
  position?: string
  category?: string
  
  // Metadata
  reasoning: string[]
  recommendations: string[]
  riskFactors: string[]
  estimatedDuration: number // seconds
}

export function routeWithTopIntelligence(
  userId: string,
  prompt: string,
  quality: 'fast' | 'balanced' | 'best' | 'ultra' = 'best'
): TopIntelligentResult {
  // Use the master orchestrator
  const result = intelligentOrchestrator.orchestrate(userId, prompt, quality)
  
  // Calculate estimated duration based on pipeline
  const estimatedDuration = result.pipeline.reduce((total, step) => {
    const baseTime = step.settings.steps * 0.5 // 0.5 seconds per step
    const overhead = 2 // 2 seconds overhead per model
    return total + baseTime + overhead
  }, 0)
  
  return {
    enhancedPrompt: result.enhancedPrompt,
    negativePrompt: result.negativePrompt,
    pipeline: result.pipeline,
    selectedModels: result.selectedModels,
    complexityScore: analyzePromptComplexity(prompt).score,
    qualityPrediction: result.qualityPrediction.estimatedQuality,
    successProbability: result.qualityPrediction.successProbability,
    confidence: result.qualityPrediction.confidence,
    workflow: getNSFWWorkflow(
      detectSexualPosition(prompt) || 
      (detectNSFWCategory(prompt) ? `${detectNSFWCategory(prompt)}-default` : 'couple-missionary')
    ),
    position: detectSexualPosition(prompt),
    category: detectNSFWCategory(prompt),
    reasoning: result.reasoning,
    recommendations: result.recommendations,
    riskFactors: result.qualityPrediction.riskFactors,
    estimatedDuration: Math.round(estimatedDuration),
  }
}

/**
 * Re-export intelligence functions for direct access
 */
export {
  analyzePromptComplexity,
  predictQuality,
  enhancePromptIntelligently,
  buildAdaptivePipeline,
  selectModelsIntelligently,
  ContextManager,
  intelligentOrchestrator,
} from '../lib/nsfw-intelligence'

export {
  analyzePhoto,
  analyzeImageQuality,
  analyzeComposition,
  analyzeLighting,
  analyzeColor,
  analyzeAnatomy,
  getEnhancementPipeline,
} from '../lib/photo-director'

export type {
  ImageAnalysis,
  CompositionAnalysis,
  LightingAnalysis,
  ColorAnalysis,
  AnatomyAnalysis,
} from '../lib/photo-director'

export type {
  PromptComplexity,
  QualityPrediction,
  UserContext,
  GenerationRecord,
} from '../lib/nsfw-intelligence'

export type { LocalDreamModel } from '../lib/localdream-specialized-models'
