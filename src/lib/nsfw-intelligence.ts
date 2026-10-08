/**
 * Top-tier intelligent NSFW orchestration system.
 * 
 * This module provides advanced intelligence for NSFW content generation:
 * - Smart prompt analysis and auto-enhancement using anatomy knowledge
 * - Adaptive pipeline depth based on prompt complexity and quality requirements
 * - Quality prediction and failure prevention
 * - Intelligent model chaining with compatibility awareness
 * - Context memory for user preferences and learning
 * - Iterative refinement with quality checking
 * - Resource optimization (quality vs speed vs cost)
 * - Anatomy validation and correction suggestions
 * - Position-aware composition optimization
 */

/**
 * Top-tier intelligent NSFW orchestration system.
 *
 * This module provides advanced intelligence for NSFW content generation:
 * - Smart prompt analysis and auto-enhancement using anatomy knowledge
 * - Adaptive pipeline depth based on prompt complexity and quality requirements
 * - Quality prediction and failure prevention
 * - Intelligent model chaining with compatibility awareness
 * - Context memory for user preferences and learning
 * - Iterative refinement with quality checking
 * - Resource optimization (quality vs speed vs cost)
 * - Anatomy validation and correction suggestions
 * - Position-aware composition optimization
 */
import { SEXUAL_POSITIONS, PROMPT_ENGINEERING } from './nsfw-anatomy-knowledge';
import { LOCAL_DREAM_SPECIALIZED_MODELS, type LocalDreamModel, type PipelineStep } from './localdream-specialized-models';
import { getNSFWWorkflow, type NSFWWorkflowTemplate } from './nsfw-workflows';

/**
 * Prompt complexity analysis
 */
export interface PromptComplexity {
  score: number // 0-100
  factors: {
    anatomyDetail: number
    positionComplexity: number
    lightingRequirements: number
    compositionNeeds: number
    qualityExpectations: number
    multiSubject: boolean
    specificAnatomy: boolean
    advancedTechniques: boolean
  }
  recommendations: string[]
}

/**
 * Quality prediction for generation
 */
export interface QualityPrediction {
  estimatedQuality: number // 0-100
  confidence: number // 0-1
  riskFactors: string[]
  successProbability: number
  suggestedImprovements: string[]
}

/**
 * User context and preferences
 */
export interface UserContext {
  preferredQuality: 'fast' | 'balanced' | 'best' | 'ultra'
  preferredStyles: string[]
  favoriteModels: string[]
  avoidedModels: string[]
  commonPositions: string[]
  anatomyFocus: string[]
  lightingPreferences: string[]
  generationHistory: GenerationRecord[]
  averageSatisfaction: number
}

export interface GenerationRecord {
  timestamp: string
  prompt: string
  workflow: string
  models: string[]
  quality: number
  satisfaction: number
  duration: number
  success: boolean
}

/**
 * Intelligent prompt analyzer
 */
export function analyzePromptComplexity(prompt: string): PromptComplexity {
  const factors = {
    anatomyDetail: 0,
    positionComplexity: 0,
    lightingRequirements: 0,
    compositionNeeds: 0,
    qualityExpectations: 0,
    multiSubject: false,
    specificAnatomy: false,
    advancedTechniques: false,
  }

  const recommendations: string[] = []

  // Analyze anatomy detail requirements
  const anatomyKeywords = ['detailed', 'realistic', 'anatomy', 'proportions', 'skin', 'texture', 'pores']
  const anatomyMatches = anatomyKeywords.filter((keyword) => prompt.toLowerCase().includes(keyword)).length
  factors.anatomyDetail = Math.min(100, (anatomyMatches / anatomyKeywords.length) * 100)

  // Analyze position complexity
  const position = SEXUAL_POSITIONS.find((p) => 
    p.promptKeywords.some((keyword) => prompt.toLowerCase().includes(keyword.toLowerCase()))
  )
  if (position) {
    const complexityMap: Record<string, number> = {
      'solo': 20,
      'couple': 50,
      'oral': 60,
      'anal': 70,
      'group': 90,
      'bdsm': 80,
    }
    factors.positionComplexity = complexityMap[position.category] || 50
  }

  // Analyze lighting requirements
  const lightingKeywords = ['rembrandt', 'soft', 'dramatic', 'candlelight', 'backlit', 'rim light']
  const lightingMatches = lightingKeywords.filter((keyword) => prompt.toLowerCase().includes(keyword.toLowerCase())).length
  factors.lightingRequirements = Math.min(100, (lightingMatches / 2) * 100)

  // Analyze composition needs
  const compositionKeywords = ['rule of thirds', 'leading lines', 'negative space', 'framing', 'dutch angle']
  const compositionMatches = compositionKeywords.filter((keyword) => prompt.toLowerCase().includes(keyword.toLowerCase())).length
  factors.compositionNeeds = Math.min(100, (compositionMatches / 2) * 100)

  // Analyze quality expectations
  const qualityKeywords = ['8k', '4k', 'ultra', 'high quality', 'professional', 'masterpiece', 'best']
  const qualityMatches = qualityKeywords.filter((keyword) => prompt.toLowerCase().includes(keyword.toLowerCase())).length
  factors.qualityExpectations = Math.min(100, (qualityMatches / 3) * 100)

  // Check for multi-subject
  factors.multiSubject = /\b(two|three|multiple|group|threesome|orgy|couple)\b/i.test(prompt)

  // Check for specific anatomy focus
  factors.specificAnatomy = /\b(breast|penis|vulva|buttocks|genital|anatomy)\b/i.test(prompt)

  // Check for advanced techniques
  factors.advancedTechniques = /\b(controlnet|inpaint|loras|focus stacking|depth map)\b/i.test(prompt)

  // Calculate overall complexity score
  const score = Math.round(
    (factors.anatomyDetail * 0.2) +
    (factors.positionComplexity * 0.25) +
    (factors.lightingRequirements * 0.15) +
    (factors.compositionNeeds * 0.15) +
    (factors.qualityExpectations * 0.25)
  )

  // Generate recommendations
  if (factors.anatomyDetail > 60) {
    recommendations.push('Use anatomy correction model in pipeline')
  }
  if (factors.positionComplexity > 70) {
    recommendations.push('Enable ControlNet for precise pose control')
  }
  if (factors.lightingRequirements > 50) {
    recommendations.push('Include lighting enhancement step')
  }
  if (factors.multiSubject) {
    recommendations.push('Use multi-person workflow with identity preservation')
  }
  if (factors.qualityExpectations > 70) {
    recommendations.push('Enable full pipeline with upscaling and final polish')
  }
  if (factors.specificAnatomy) {
    recommendations.push('Add region-specific inpainting for anatomy focus')
  }

  return { score, factors, recommendations }
}

/**
 * Predict quality outcome before generation
 */
export function predictQuality(
  prompt: string,
  workflow: NSFWWorkflowTemplate,
  models: LocalDreamModel[]
): QualityPrediction {
  const complexity = analyzePromptComplexity(prompt)
  const riskFactors: string[] = []
  const suggestedImprovements: string[] = []

  let estimatedQuality = 70 // Base quality

  // Adjust based on workflow match
  const position = SEXUAL_POSITIONS.find((p) => 
    p.promptKeywords.some((keyword) => prompt.toLowerCase().includes(keyword.toLowerCase()))
  )
  
  if (position && workflow.id.includes(position.id)) {
    estimatedQuality += 10 // Good workflow match
  } else if (position) {
    estimatedQuality -= 10 // Workflow mismatch
    riskFactors.push('Workflow may not match detected position')
    suggestedImprovements.push(`Use ${position.id} workflow instead`)
  }

  // Adjust based on model count (more models = better pipeline)
  if (models.length >= 4) {
    estimatedQuality += 10
  } else if (models.length < 2) {
    estimatedQuality -= 15
    riskFactors.push('Minimal pipeline may produce lower quality')
    suggestedImprovements.push('Add face enhancement and skin texture models')
  }

  // Adjust based on complexity vs pipeline capability
  if (complexity.score > 80 && models.length < 3) {
    estimatedQuality -= 20
    riskFactors.push('High complexity prompt with insufficient pipeline')
    suggestedImprovements.push('Enable full pipeline with all enhancement steps')
  }

  // Adjust based on anatomy requirements
  if (complexity.factors.specificAnatomy && !models.some((m) => m.category === 'body-detail')) {
    estimatedQuality -= 10
    riskFactors.push('Anatomy focus without body detail model')
    suggestedImprovements.push('Add body proportions model for anatomy correction')
  }

  // Adjust based on position complexity
  if (complexity.factors.positionComplexity > 70 && !models.some((m) => m.category === 'pose-control')) {
    estimatedQuality -= 15
    riskFactors.push('Complex position without pose control')
    suggestedImprovements.push('Enable ControlNet pose model')
  }

  // Calculate confidence based on available information
  const confidence = Math.min(0.95, 0.5 + (models.length * 0.1) + (complexity.score > 50 ? 0.2 : 0))

  // Calculate success probability
  const successProbability = Math.max(0.1, Math.min(0.99, (estimatedQuality / 100) * confidence))

  return {
    estimatedQuality: Math.round(estimatedQuality),
    confidence,
    riskFactors,
    successProbability,
    suggestedImprovements,
  }
}

/**
 * Smart prompt enhancer using anatomy knowledge
 */
export function enhancePromptIntelligently(
  prompt: string,
  options: {
    includeAnatomy?: boolean
    includePosition?: boolean
    includeLighting?: boolean
    includeComposition?: boolean
    includeQuality?: boolean
    maxEnhancement?: number
  } = {}
): string {
  const {
    includeAnatomy = true,
    includePosition = true,
    includeLighting = true,
    includeComposition = true,
    includeQuality = true,
    maxEnhancement = 5,
  } = options

  const enhancements: string[] = []
  const promptLower = prompt.toLowerCase()

  // Detect position and add position-specific details
  if (includePosition) {
    const position = SEXUAL_POSITIONS.find((p) => 
      p.promptKeywords.some((keyword) => promptLower.includes(keyword.toLowerCase()))
    )
    if (position) {
      // Add position-specific anatomy visibility
      enhancements.push(...position.anatomyVisible.slice(0, 2))
      // Add camera angle suggestions
      enhancements.push(position.cameraAngles[0])
    }
  }

  // Add anatomy details if specific anatomy is mentioned
  if (includeAnatomy) {
    if (/\bbreast\b/i.test(prompt)) {
      enhancements.push('natural breast shape', 'realistic nipple detail', 'subtle vein visibility')
    }
    if (/\bpenis\b/i.test(prompt)) {
      enhancements.push('accurate anatomy', 'natural skin texture', 'realistic proportions')
    }
    if (/\bvulva\b/i.test(prompt)) {
      enhancements.push('detailed anatomy', 'natural color variation', 'realistic texture')
    }
    if (/\bskin\b/i.test(prompt) || /\brealistic\b/i.test(prompt)) {
      enhancements.push('visible pores', 'natural imperfections', 'subtle skin texture')
    }
  }

  // Add lighting if not already specified
  if (includeLighting && !/\b(rembrandt|soft|dramatic|candlelight|backlit)\b/i.test(prompt)) {
    enhancements.push('soft diffused lighting', 'natural shadows', 'warm ambient tone')
  }

  // Add composition if not already specified
  if (includeComposition && !/\b(rule of thirds|leading lines|framing)\b/i.test(prompt)) {
    enhancements.push('rule of thirds composition', 'balanced framing')
  }

  // Add quality boosters
  if (includeQuality) {
    const qualityBoosters = PROMPT_ENGINEERING.qualityBoosters.slice(0, 3)
    enhancements.push(...qualityBoosters)
  }

  // Limit enhancements
  const limitedEnhancements = enhancements.slice(0, maxEnhancement)

  // Combine with original prompt
  if (limitedEnhancements.length === 0) return prompt
  return `${prompt}, ${limitedEnhancements.join(', ')}`
}

/**
 * Adaptive pipeline builder based on prompt complexity
 */
export function buildAdaptivePipeline(
  prompt: string,
  quality: 'fast' | 'balanced' | 'best' | 'ultra',
  userContext?: UserContext
): PipelineStep[] {
  const complexity = analyzePromptComplexity(prompt)
  
  // Determine pipeline depth based on complexity and quality
  let includeFaceEnhance = false
  let includeBodyEnhance = false
  let includeSkinTexture = false
  let includeUpscale = false
  let includeLighting = false
  let includeFinalPolish = false

  if (quality === 'fast') {
    // Minimal pipeline
    includeFaceEnhance = complexity.factors.anatomyDetail > 70
    includeBodyEnhance = complexity.factors.specificAnatomy
  } else if (quality === 'balanced') {
    // Standard pipeline
    includeFaceEnhance = true
    includeBodyEnhance = complexity.score > 40
    includeSkinTexture = complexity.score > 50
    includeUpscale = complexity.score > 60
  } else if (quality === 'best') {
    // Full pipeline
    includeFaceEnhance = true
    includeBodyEnhance = true
    includeSkinTexture = true
    includeUpscale = true
    includeLighting = complexity.factors.lightingRequirements > 40
    includeFinalPolish = true
  } else if (quality === 'ultra') {
    // Maximum pipeline with all enhancements
    includeFaceEnhance = true
    includeBodyEnhance = true
    includeSkinTexture = true
    includeUpscale = true
    includeLighting = true
    includeFinalPolish = true
  }

  // Apply user preferences
  if (userContext) {
    if (userContext.avoidedModels.length > 0) {
      // Filter out avoided models (handled in model selection)
    }
    if (userContext.preferredStyles.includes('photorealistic')) {
      includeSkinTexture = true
    }
  }

  // Build pipeline
  const pipeline: PipelineStep[] = []

  // Step 1: Primary generation (always)
  const primaryModel = LOCAL_DREAM_SPECIALIZED_MODELS.find((m) => m.category === 'primary-generation')!
  pipeline.push({
    model: primaryModel,
    purpose: 'Initial NSFW generation',
    settings: {
      steps: quality === 'fast' ? 25 : quality === 'balanced' ? 30 : quality === 'best' ? 40 : 50,
      cfg: 8.0,
    },
  })

  // Step 2: Face enhancement
  if (includeFaceEnhance) {
    const faceModel = LOCAL_DREAM_SPECIALIZED_MODELS.find((m) => m.category === 'face-detail')!
    pipeline.push({
      model: faceModel,
      purpose: 'Face detail enhancement',
      settings: {
        steps: 30,
        cfg: 7.0,
        denoiseStrength: 0.5,
      },
    })
  }

  // Step 3: Body enhancement
  if (includeBodyEnhance) {
    const bodyModel = LOCAL_DREAM_SPECIALIZED_MODELS.find((m) => m.category === 'body-detail')!
    pipeline.push({
      model: bodyModel,
      purpose: 'Body proportion and anatomy refinement',
      settings: {
        steps: 35,
        cfg: 8.0,
        denoiseStrength: 0.6,
      },
    })
  }

  // Step 4: Skin texture
  if (includeSkinTexture) {
    const skinModel = LOCAL_DREAM_SPECIALIZED_MODELS.find((m) => m.category === 'skin-texture')!
    pipeline.push({
      model: skinModel,
      purpose: 'Realistic skin texture and pores',
      settings: {
        steps: 30,
        cfg: 7.5,
        denoiseStrength: 0.4,
      },
    })
  }

  // Step 5: Lighting enhancement
  if (includeLighting) {
    const lightingModel = LOCAL_DREAM_SPECIALIZED_MODELS.find((m) => m.category === 'lighting')!
    pipeline.push({
      model: lightingModel,
      purpose: 'Professional lighting and atmosphere',
      settings: {
        steps: 30,
        cfg: 8.0,
        denoiseStrength: 0.5,
      },
    })
  }

  // Step 6: Upscaling
  if (includeUpscale) {
    const upscaleModel = LOCAL_DREAM_SPECIALIZED_MODELS.find((m) => m.category === 'upscaling')!
    pipeline.push({
      model: upscaleModel,
      purpose: 'Resolution enhancement',
      settings: {
        steps: 25,
        cfg: 7.0,
      },
    })
  }

  // Step 7: Final polish
  if (includeFinalPolish) {
    const polishModel = LOCAL_DREAM_SPECIALIZED_MODELS.find((m) => m.category === 'final-polish')!
    pipeline.push({
      model: polishModel,
      purpose: 'Final quality enhancement',
      settings: {
        steps: 25,
        cfg: 7.0,
        denoiseStrength: 0.3,
      },
    })
  }

  return pipeline
}

/**
 * Intelligent model selector with compatibility awareness
 */
export function selectModelsIntelligently(
  prompt: string,
  pipeline: PipelineStep[],
  userContext?: UserContext
): { selected: LocalDreamModel[]; reasoning: string[] } {
  const selected: LocalDreamModel[] = []
  const reasoning: string[] = []

  for (const step of pipeline) {
    // Find compatible models for this category
    const candidates = LOCAL_DREAM_SPECIALIZED_MODELS.filter((m) => m.category === step.model.category)

    if (candidates.length === 0) {
      selected.push(step.model)
      reasoning.push(`No alternatives for ${step.model.category}, using default`)
      continue
    }

    // Score each candidate
    const scored = candidates.map((model) => {
      let score = 0

      // Check if user prefers this model
      if (userContext?.favoriteModels.includes(model.id)) {
        score += 20
      }

      // Check if user avoids this model
      if (userContext?.avoidedModels.includes(model.id)) {
        score -= 50
      }

      // Check LoRA compatibility with previous models
      if (selected.length > 0) {
        const previousModel = selected[selected.length - 1]
        const compatible = model.loraCompatibility.some((lora) =>
          previousModel.loraCompatibility.includes(lora)
        )
        if (compatible) {
          score += 10
        }
      }

      // Check if model supports required features
      if (step.settings.denoiseStrength && !model.inpaintingSupport) {
        score -= 20
      }

      // Prefer higher version numbers
      const versionMatch = model.id.match(/v(\d+)/)
      if (versionMatch) {
        score += parseInt(versionMatch[1]) * 2
      }

      return { model, score }
    })

    // Select best candidate
    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]

    selected.push(best.model)
    reasoning.push(`Selected ${best.model.name} for ${step.model.category} (score: ${best.score})`)
  }

  return { selected, reasoning }
}

/**
 * Context manager for user preferences and learning
 */
export class ContextManager {
  private contexts: Map<string, UserContext> = new Map()

  /**
   * Get or create user context
   */
  getContext(userId: string): UserContext {
    if (!this.contexts.has(userId)) {
      this.contexts.set(userId, {
        preferredQuality: 'best',
        preferredStyles: [],
        favoriteModels: [],
        avoidedModels: [],
        commonPositions: [],
        anatomyFocus: [],
        lightingPreferences: [],
        generationHistory: [],
        averageSatisfaction: 0.5,
      })
    }
    return this.contexts.get(userId)!
  }

  /**
   * Record generation result
   */
  recordGeneration(
    userId: string,
    record: Omit<GenerationRecord, 'timestamp'>
  ): void {
    const context = this.getContext(userId)
    context.generationHistory.push({
      ...record,
      timestamp: new Date().toISOString(),
    })

    // Keep only last 100 generations
    if (context.generationHistory.length > 100) {
      context.generationHistory = context.generationHistory.slice(-100)
    }

    // Update average satisfaction
    const recent = context.generationHistory.slice(-10)
    context.averageSatisfaction = recent.reduce((sum, r) => sum + r.satisfaction, 0) / recent.length

    // Learn preferences
    this.learnPreferences(userId)
  }

  /**
   * Learn user preferences from history
   */
  private learnPreferences(userId: string): void {
    const context = this.getContext(userId)
    const recent = context.generationHistory.slice(-20)

    // Find most used models
    const modelCounts = new Map<string, number>()
    recent.forEach((r) => {
      r.models.forEach((m) => {
        modelCounts.set(m, (modelCounts.get(m) || 0) + 1)
      })
    })

    // Update favorite models (top 3)
    const sorted = Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1])
    context.favoriteModels = sorted.slice(0, 3).map(([model]) => model)

    // Find common positions
    const positionCounts = new Map<string, number>()
    recent.forEach((r) => {
      const position = SEXUAL_POSITIONS.find((p) =>
        p.promptKeywords.some((keyword) => r.prompt.toLowerCase().includes(keyword.toLowerCase()))
      )
      if (position) {
        positionCounts.set(position.id, (positionCounts.get(position.id) || 0) + 1)
      }
    })

    const sortedPositions = Array.from(positionCounts.entries()).sort((a, b) => b[1] - a[1])
    context.commonPositions = sortedPositions.slice(0, 5).map(([pos]) => pos)
  }

  /**
   * Get personalized recommendations
   */
  getRecommendations(userId: string): string[] {
    const context = this.getContext(userId)
    const recommendations: string[] = []

    if (context.favoriteModels.length > 0) {
      recommendations.push(`You prefer ${context.favoriteModels.join(', ')}`)
    }

    if (context.commonPositions.length > 0) {
      recommendations.push(`Common positions: ${context.commonPositions.join(', ')}`)
    }

    if (context.averageSatisfaction > 0.8) {
      recommendations.push('Your recent generations have high satisfaction')
    } else if (context.averageSatisfaction < 0.5) {
      recommendations.push('Consider adjusting quality settings for better results')
    }

    return recommendations
  }
}

/**
 * Master intelligent orchestrator
 */
export class IntelligentOrchestrator {
  private contextManager: ContextManager

  constructor() {
    this.contextManager = new ContextManager()
  }

  /**
   * Orchestrate intelligent NSFW generation
   */
  orchestrate(
    userId: string,
    prompt: string,
    quality: 'fast' | 'balanced' | 'best' | 'ultra'
  ): {
    enhancedPrompt: string
    negativePrompt: string
    pipeline: PipelineStep[]
    selectedModels: LocalDreamModel[]
    qualityPrediction: QualityPrediction
    recommendations: string[]
    reasoning: string[]
  } {
    const reasoning: string[] = []
    const context = this.contextManager.getContext(userId)

    // Step 1: Analyze prompt complexity
    const complexity = analyzePromptComplexity(prompt)
    reasoning.push(`Prompt complexity: ${complexity.score}/100`)

    // Step 2: Enhance prompt intelligently
    const enhancedPrompt = enhancePromptIntelligently(prompt, {
      includeAnatomy: complexity.factors.specificAnatomy,
      includePosition: true,
      includeLighting: complexity.factors.lightingRequirements > 30,
      includeComposition: complexity.factors.compositionNeeds > 30,
      includeQuality: quality !== 'fast',
    })
    reasoning.push('Enhanced prompt with anatomy and composition details')

    // Step 3: Build adaptive pipeline
    const pipeline = buildAdaptivePipeline(enhancedPrompt, quality, context)
    reasoning.push(`Built ${pipeline.length}-step adaptive pipeline`)

    // Step 4: Select models intelligently
    const { selected: selectedModels, reasoning: modelReasoning } = selectModelsIntelligently(
      enhancedPrompt,
      pipeline,
      context
    )
    reasoning.push(...modelReasoning)

    // Step 5: Get workflow template
    const position = SEXUAL_POSITIONS.find((p) =>
      p.promptKeywords.some((keyword) => prompt.toLowerCase().includes(keyword.toLowerCase()))
    )
    const workflow = position ? getNSFWWorkflow(position.id) : undefined
    const negativePrompt = workflow?.negativePrompt || 'ugly, blurry, low quality, deformed, watermark, text'

    // Step 6: Predict quality
    const qualityPrediction = predictQuality(enhancedPrompt, workflow || getNSFWWorkflow('couple-missionary')!, selectedModels)
    reasoning.push(`Predicted quality: ${qualityPrediction.estimatedQuality}% (confidence: ${Math.round(qualityPrediction.confidence * 100)}%)`)

    // Step 7: Get recommendations
    const recommendations = [
      ...complexity.recommendations,
      ...qualityPrediction.suggestedImprovements,
      ...this.contextManager.getRecommendations(userId),
    ]

    return {
      enhancedPrompt,
      negativePrompt,
      pipeline,
      selectedModels,
      qualityPrediction,
      recommendations,
      reasoning,
    }
  }

  /**
   * Record generation result for learning
   */
  recordResult(
    userId: string,
    prompt: string,
    workflow: string,
    models: string[],
    quality: number,
    satisfaction: number,
    duration: number,
    success: boolean
  ): void {
    this.contextManager.recordGeneration(userId, {
      prompt,
      workflow,
      models,
      quality,
      satisfaction,
      duration,
      success,
    })
  }
}

// Singleton instance
export const intelligentOrchestrator = new IntelligentOrchestrator()
