/**
 * Advanced Photo Director and Analyzer
 * 
 * Provides intelligent image analysis, quality assessment, and enhancement recommendations.
 * This module makes the system the most intelligent photo director by:
 * - Analyzing image quality metrics
 * - Scoring composition and framing
 * - Assessing lighting and color
 * - Validating anatomy and proportions
 * - Providing actionable enhancement recommendations
 */

export interface ImageAnalysis {
  overallScore: number // 0-100
  qualityMetrics: {
    sharpness: number
    detail: number
    noise: number
    compression: number
  }
  compositionScore: number
  lightingScore: number
  colorScore: number
  anatomyScore: number
  recommendations: string[]
  strengths: string[]
  weaknesses: string[]
}

export interface CompositionAnalysis {
  score: number
  ruleOfThirds: boolean
  leadingLines: boolean
  symmetry: boolean
  framing: 'tight' | 'medium' | 'wide'
  balance: number
  suggestions: string[]
}

export interface LightingAnalysis {
  score: number
  type: 'natural' | 'studio' | 'dramatic' | 'soft' | 'harsh'
  direction: 'front' | 'side' | 'back' | 'top' | 'bottom'
  quality: 'hard' | 'soft'
  exposure: 'under' | 'correct' | 'over'
  suggestions: string[]
}

export interface ColorAnalysis {
  score: number
  temperature: 'warm' | 'cool' | 'neutral'
  saturation: 'low' | 'medium' | 'high'
  contrast: 'low' | 'medium' | 'high'
  harmony: 'complementary' | 'analogous' | 'triadic' | 'monochromatic'
  suggestions: string[]
}

export interface AnatomyAnalysis {
  score: number
  proportions: number
  symmetry: number
  detail: number
  issues: string[]
  corrections: string[]
}

/**
 * Analyze overall image quality
 */
export function analyzeImageQuality(imageData: {
  width: number
  height: number
  hasAlpha: boolean
  colorDepth: number
}): { score: number; issues: string[] } {
  const issues: string[] = []
  let score = 100

  // Check resolution
  const pixels = imageData.width * imageData.height
  if (pixels < 1024 * 1024) {
    score -= 20
    issues.push('Low resolution - consider upscaling')
  } else if (pixels < 2048 * 2048) {
    score -= 10
    issues.push('Medium resolution - upscaling recommended for best quality')
  }

  // Check aspect ratio
  const aspectRatio = imageData.width / imageData.height
  const commonRatios = [1, 1.5, 1.777, 0.75, 0.5625] // 1:1, 3:2, 16:9, 4:3, 9:16
  const ratioDiff = Math.min(...commonRatios.map(r => Math.abs(aspectRatio - r)))
  if (ratioDiff > 0.1) {
    score -= 5
    issues.push('Uncommon aspect ratio - may not display optimally')
  }

  // Check color depth
  if (imageData.colorDepth < 24) {
    score -= 15
    issues.push('Low color depth - limited color range')
  }

  return { score: Math.max(0, score), issues }
}

/**
 * Analyze composition
 */
export function analyzeComposition(features: {
  subjectPosition: { x: number; y: number } // 0-1 normalized
  hasLeadingLines: boolean
  hasSymmetry: boolean
  backgroundComplexity: number // 0-100
}): CompositionAnalysis {
  const { subjectPosition, hasLeadingLines, hasSymmetry, backgroundComplexity } = features
  
  let score = 50 // Base score
  
  const suggestions: string[] = []
  
  // Rule of thirds check
  const ruleOfThirds = (
    (subjectPosition.x > 0.25 && subjectPosition.x < 0.45) ||
    (subjectPosition.x > 0.55 && subjectPosition.x < 0.75)
  ) && (
    (subjectPosition.y > 0.25 && subjectPosition.y < 0.45) ||
    (subjectPosition.y > 0.55 && subjectPosition.y < 0.75)
  )
  
  if (ruleOfThirds) {
    score += 15
  } else {
    suggestions.push('Consider placing subject on rule of thirds intersection')
  }
  
  // Leading lines
  if (hasLeadingLines) {
    score += 10
  } else {
    suggestions.push('Add leading lines to guide viewer eye')
  }
  
  // Symmetry
  if (hasSymmetry) {
    score += 10
  }
  
  // Background complexity
  if (backgroundComplexity > 70) {
    score -= 10
    suggestions.push('Simplify background to reduce distraction')
  } else if (backgroundComplexity < 20) {
    score -= 5
    suggestions.push('Add background elements for context')
  }
  
  // Determine framing
  const framing = subjectPosition.x > 0.3 && subjectPosition.x < 0.7 && 
                  subjectPosition.y > 0.3 && subjectPosition.y < 0.7 ? 'tight' :
                  subjectPosition.x > 0.2 && subjectPosition.x < 0.8 && 
                  subjectPosition.y > 0.2 && subjectPosition.y < 0.8 ? 'medium' : 'wide'
  
  // Balance score
  const centerX = 0.5
  const centerY = 0.5
  const distanceFromCenter = Math.sqrt(
    Math.pow(subjectPosition.x - centerX, 2) + 
    Math.pow(subjectPosition.y - centerY, 2)
  )
  const balance = Math.max(0, 100 - distanceFromCenter * 100)
  
  score = Math.min(100, Math.max(0, score))
  
  return {
    score,
    ruleOfThirds,
    leadingLines: hasLeadingLines,
    symmetry: hasSymmetry,
    framing,
    balance,
    suggestions,
  }
}

/**
 * Analyze lighting
 */
export function analyzeLighting(features: {
  brightness: number // 0-100
  contrast: number // 0-100
  shadowDetail: number // 0-100
  highlightDetail: number // 0-100
  lightDirection?: 'front' | 'side' | 'back' | 'top' | 'bottom'
}): LightingAnalysis {
  const { brightness, contrast, shadowDetail, highlightDetail, lightDirection = 'front' } = features
  
  let score = 50
  const suggestions: string[] = []
  
  // Determine exposure
  let exposure: 'under' | 'correct' | 'over' = 'correct'
  if (brightness < 30) {
    exposure = 'under'
    score -= 20
    suggestions.push('Image is underexposed - increase brightness')
  } else if (brightness > 80) {
    exposure = 'over'
    score -= 15
    suggestions.push('Image is overexposed - reduce brightness')
  } else {
    score += 10
  }
  
  // Determine light quality
  const quality = contrast > 60 ? 'hard' : 'soft'
  
  // Determine light type
  let type: 'natural' | 'studio' | 'dramatic' | 'soft' | 'harsh'
  if (contrast > 70 && brightness < 50) {
    type = 'dramatic'
    score += 10
  } else if (contrast < 30) {
    type = 'soft'
    score += 15
  } else if (contrast > 80) {
    type = 'harsh'
    score -= 10
    suggestions.push('Lighting is too harsh - consider softening')
  } else if (brightness > 60 && contrast > 40) {
    type = 'studio'
    score += 10
  } else {
    type = 'natural'
    score += 5
  }
  
  // Check detail retention
  if (shadowDetail < 30) {
    score -= 10
    suggestions.push('Shadow detail is lost - reduce contrast or add fill light')
  }
  if (highlightDetail < 30) {
    score -= 10
    suggestions.push('Highlight detail is blown out - reduce exposure')
  }
  
  score = Math.min(100, Math.max(0, score))
  
  return {
    score,
    type,
    direction: lightDirection,
    quality,
    exposure,
    suggestions,
  }
}

/**
 * Analyze color
 */
export function analyzeColor(features: {
  temperature: number // -100 (cool) to 100 (warm)
  saturation: number // 0-100
  contrast: number // 0-100
  dominantHues: string[]
}): ColorAnalysis {
  const { temperature, saturation, contrast, dominantHues } = features
  
  let score = 50
  const suggestions: string[] = []
  
  // Temperature
  let temp: 'warm' | 'cool' | 'neutral'
  if (temperature > 20) {
    temp = 'warm'
    score += 5
  } else if (temperature < -20) {
    temp = 'cool'
    score += 5
  } else {
    temp = 'neutral'
    score += 10
  }
  
  // Saturation
  let sat: 'low' | 'medium' | 'high'
  if (saturation < 30) {
    sat = 'low'
    score -= 10
    suggestions.push('Colors are muted - consider increasing saturation')
  } else if (saturation > 80) {
    sat = 'high'
    score -= 5
    suggestions.push('Colors are very saturated - may look unnatural')
  } else {
    sat = 'medium'
    score += 10
  }
  
  // Contrast
  let cont: 'low' | 'medium' | 'high'
  if (contrast < 30) {
    cont = 'low'
    score -= 10
    suggestions.push('Low contrast - image may look flat')
  } else if (contrast > 80) {
    cont = 'high'
    score += 5
  } else {
    cont = 'medium'
    score += 10
  }
  
  // Color harmony
  let harmony: 'complementary' | 'analogous' | 'triadic' | 'monochromatic'
  if (dominantHues.length <= 2) {
    harmony = 'monochromatic'
    score += 5
  } else if (dominantHues.length === 3) {
    harmony = 'analogous'
    score += 10
  } else {
    harmony = 'triadic'
    score += 8
  }
  
  score = Math.min(100, Math.max(0, score))
  
  return {
    score,
    temperature: temp,
    saturation: sat,
    contrast: cont,
    harmony,
    suggestions,
  }
}

/**
 * Analyze anatomy (for NSFW content)
 */
export function analyzeAnatomy(features: {
  bodyProportions: number // 0-100
  symmetry: number // 0-100
  detailLevel: number // 0-100
  hasIssues: boolean
  issueTypes: string[]
}): AnatomyAnalysis {
  const { bodyProportions, symmetry, detailLevel, hasIssues, issueTypes } = features
  
  let score = 50
  const issues: string[] = []
  const corrections: string[] = []
  
  // Proportions
  if (bodyProportions > 80) {
    score += 20
  } else if (bodyProportions > 60) {
    score += 10
  } else {
    score -= 10
    issues.push('Body proportions are off')
    corrections.push('Use body proportions correction model')
  }
  
  // Symmetry
  if (symmetry > 80) {
    score += 15
  } else if (symmetry > 60) {
    score += 5
  } else {
    score -= 15
    issues.push('Asymmetry detected')
    corrections.push('Apply symmetry correction')
  }
  
  // Detail level
  if (detailLevel > 80) {
    score += 15
  } else if (detailLevel > 60) {
    score += 5
  } else {
    score -= 10
    issues.push('Insufficient detail')
    corrections.push('Add detail enhancement model')
  }
  
  // Specific issues
  if (hasIssues) {
    score -= 20
    issues.push(...issueTypes)
    corrections.push('Run anatomy correction pipeline')
  }
  
  score = Math.min(100, Math.max(0, score))
  
  return {
    score,
    proportions: bodyProportions,
    symmetry,
    detail: detailLevel,
    issues,
    corrections,
  }
}

/**
 * Master photo analyzer - combines all analyses
 */
export function analyzePhoto(features: {
  image: { width: number; height: number; hasAlpha: boolean; colorDepth: number }
  composition: { subjectPosition: { x: number; y: number }; hasLeadingLines: boolean; hasSymmetry: boolean; backgroundComplexity: number }
  lighting: { brightness: number; contrast: number; shadowDetail: number; highlightDetail: number; lightDirection?: 'front' | 'side' | 'back' | 'top' | 'bottom' }
  color: { temperature: number; saturation: number; contrast: number; dominantHues: string[] }
  anatomy?: { bodyProportions: number; symmetry: number; detailLevel: number; hasIssues: boolean; issueTypes: string[] }
}): ImageAnalysis {
  const quality = analyzeImageQuality(features.image)
  const composition = analyzeComposition(features.composition)
  const lighting = analyzeLighting(features.lighting)
  const color = analyzeColor(features.color)
  const anatomy = features.anatomy ? analyzeAnatomy(features.anatomy) : null
  
  // Calculate overall score (weighted average)
  const weights = {
    quality: 0.25,
    composition: 0.20,
    lighting: 0.20,
    color: 0.15,
    anatomy: anatomy ? 0.20 : 0,
  }
  
  const overallScore = Math.round(
    quality.score * weights.quality +
    composition.score * weights.composition +
    lighting.score * weights.lighting +
    color.score * weights.color +
    (anatomy ? anatomy.score * weights.anatomy : 0)
  )
  
  // Collect all recommendations
  const recommendations: string[] = [
    ...quality.issues,
    ...composition.suggestions,
    ...lighting.suggestions,
    ...color.suggestions,
    ...(anatomy?.corrections || []),
  ]
  
  // Identify strengths
  const strengths: string[] = []
  if (quality.score > 80) strengths.push('High image quality')
  if (composition.score > 75) strengths.push('Strong composition')
  if (lighting.score > 75) strengths.push('Professional lighting')
  if (color.score > 75) strengths.push('Excellent color grading')
  if (anatomy && anatomy.score > 80) strengths.push('Perfect anatomy')
  
  // Identify weaknesses
  const weaknesses: string[] = []
  if (quality.score < 60) weaknesses.push('Low image quality')
  if (composition.score < 60) weaknesses.push('Weak composition')
  if (lighting.score < 60) weaknesses.push('Poor lighting')
  if (color.score < 60) weaknesses.push('Color issues')
  if (anatomy && anatomy.score < 60) weaknesses.push('Anatomy problems')
  
  return {
    overallScore,
    qualityMetrics: {
      sharpness: quality.score,
      detail: quality.score,
      noise: 100 - quality.score,
      compression: quality.score,
    },
    compositionScore: composition.score,
    lightingScore: lighting.score,
    colorScore: color.score,
    anatomyScore: anatomy?.score || 0,
    recommendations,
    strengths,
    weaknesses,
  }
}

/**
 * Get enhancement pipeline based on analysis
 */
export function getEnhancementPipeline(analysis: ImageAnalysis): string[] {
  const pipeline: string[] = []
  
  if (analysis.qualityMetrics.sharpness < 70) {
    pipeline.push('face-detailer-xl-v3')
  }
  
  if (analysis.anatomyScore < 70) {
    pipeline.push('body-proportions-xl')
  }
  
  if (analysis.lightingScore < 70) {
    pipeline.push('lighting-enhance-xl')
  }
  
  if (analysis.colorScore < 70) {
    pipeline.push('final-polish-xl')
  }
  
  if (analysis.qualityMetrics.detail < 80) {
    pipeline.push('skin-texture-pro-v2')
  }
  
  if (analysis.overallScore < 90) {
    pipeline.push('4x-upscaler-ultrasharp')
  }
  
  return pipeline
}
