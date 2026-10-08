/**
 * Local Dream specialized models integration for NSFW content generation.
 * 
 * This module documents and integrates the 7-8 specialized models from Local Dream Easy,
 * each optimized for specific aspects of NSFW image generation and editing.
 * 
 * Models are categorized by their specialization:
 * 1. Primary generation (realistic humans, NSFW content)
 * 2. Face and body detail enhancement
 * 3. Pose and composition control
 * 4. Upscaling and resolution enhancement
 * 5. Inpainting and region-specific editing
 * 6. Skin texture and anatomy correction
 * 7. Lighting and atmosphere
 * 8. Final polish and quality enhancement
 */

export interface LocalDreamModel {
  id: string
  name: string
  category: ModelCategory
  specialization: string
  description: string
  bestFor: string[]
  settings: {
    recommendedSteps: [number, number]
    recommendedCFG: [number, number]
    recommendedSampler: string
    recommendedScheduler: string
    recommendedResolution: [number, number]
  }
  loraCompatibility: string[]
  controlNetSupport: boolean
  inpaintingSupport: boolean
}

export type ModelCategory = 
  | 'primary-generation'
  | 'face-detail'
  | 'body-detail'
  | 'pose-control'
  | 'upscaling'
  | 'inpainting'
  | 'skin-texture'
  | 'lighting'
  | 'final-polish'

export const LOCAL_DREAM_SPECIALIZED_MODELS: LocalDreamModel[] = [
  // 1. PRIMARY GENERATION MODELS
  {
    id: 'lustify-v8',
    name: 'Lustify V8',
    category: 'primary-generation',
    specialization: 'Ultra-realistic NSFW content with perfect anatomy',
    description: 'Flagship model for generating photorealistic adult content with exceptional anatomical accuracy, natural skin textures, and realistic lighting. Optimized for all sexual positions and body types.',
    bestFor: [
      'Full body NSFW generation',
      'Realistic sexual positions',
      'Perfect anatomy and proportions',
      'Natural skin and lighting',
      'High-detail intimate scenes',
    ],
    settings: {
      recommendedSteps: [35, 45],
      recommendedCFG: [7.5, 9.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['add-detail-xl', 'realistic-skin-v2', 'anatomy-enhance-v3', 'skin-pores-v3'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },
  {
    id: 'realvisxl-v5',
    name: 'RealVisXL V5',
    category: 'primary-generation',
    specialization: 'Photorealistic humans with natural imperfections',
    description: 'Specializes in ultra-realistic human generation with natural skin imperfections, realistic body hair, and authentic lighting. Excellent for close-ups and intimate portraits.',
    bestFor: [
      'Photorealistic portraits',
      'Natural skin texture',
      'Realistic body hair',
      'Intimate close-ups',
      'Natural lighting scenarios',
    ],
    settings: {
      recommendedSteps: [40, 50],
      recommendedCFG: [7.5, 9.5],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['skin-pores-v3', 'natural-imperfections-v2', 'realistic-eyes-v4', 'body-hair-detail-v2'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },
  {
    id: 'pony-realism-v23-ultra',
    name: 'Pony Realism V23 Ultra',
    category: 'primary-generation',
    specialization: 'Ultra-detailed realistic generation with Pony Diffusion base',
    description: 'High-fidelity realism model built on Pony Diffusion architecture. Exceptional at detailed anatomy, natural poses, and photorealistic skin rendering. Strong at complex compositions and multi-subject scenes.',
    bestFor: [
      'Complex multi-subject scenes',
      'Detailed anatomy rendering',
      'Natural pose composition',
      'Photorealistic skin and lighting',
      'High-detail intimate scenarios',
    ],
    settings: {
      recommendedSteps: [35, 45],
      recommendedCFG: [7.5, 9.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['pony-realism-lora', 'anatomy-enhance-v3', 'skin-detail-xl', 'multi-subject-v2'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },
  {
    id: 'cyberrealistic-pony-v170',
    name: 'CyberRealistic Pony V170',
    category: 'primary-generation',
    specialization: 'Cyberpunk-enhanced realism with Pony architecture',
    description: 'Blends cyberpunk aesthetics with photorealistic human generation. Excellent for stylized NSFW content with dramatic lighting, neon accents, and futuristic settings while maintaining anatomical accuracy.',
    bestFor: [
      'Cyberpunk and sci-fi NSFW',
      'Dramatic neon lighting',
      'Futuristic intimate scenes',
      'Stylized realism',
      'High-contrast compositions',
    ],
    settings: {
      recommendedSteps: [35, 45],
      recommendedCFG: [7.5, 9.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['cyberpunk-lora', 'neon-lighting-v2', 'pony-realism-lora', 'dramatic-lighting-v3'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },
  {
    id: 'realism-illustrious-by-v55-fp16',
    name: 'Realism Illustrious By V55 FP16',
    category: 'primary-generation',
    specialization: 'Illustration-style realism with Illustrious base',
    description: 'Bridges the gap between illustration and photorealism. Produces semi-realistic images with enhanced detail, vibrant colors, and artistic composition while maintaining anatomical correctness. FP16 optimized for speed.',
    bestFor: [
      'Semi-realistic artistic NSFW',
      'Vibrant color palettes',
      'Artistic composition',
      'Enhanced detail rendering',
      'Fast generation with quality',
    ],
    settings: {
      recommendedSteps: [30, 40],
      recommendedCFG: [7.0, 8.5],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['illustrious-lora', 'artistic-enhance-v2', 'color-boost-v3', 'detail-enhance-v4'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },
  {
    id: 'illustrious-v16',
    name: 'Illustrious V16',
    category: 'primary-generation',
    specialization: 'Premium illustration-quality realism',
    description: 'Latest iteration of the Illustrious series. Delivers exceptional illustration-quality output with photorealistic elements. Strong at expressive poses, dynamic compositions, and detailed anatomy with an artistic flair.',
    bestFor: [
      'Premium illustration NSFW',
      'Expressive dynamic poses',
      'Artistic intimate scenes',
      'Detailed anatomy with style',
      'High-quality editorial content',
    ],
    settings: {
      recommendedSteps: [35, 45],
      recommendedCFG: [7.5, 9.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['illustrious-lora', 'expressive-pose-v3', 'artistic-detail-v2', 'dynamic-composition-v2'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },

  // 2. FACE DETAIL MODELS
  {
    id: 'face-detailer-xl-v3',
    name: 'Face Detailer XL V3',
    category: 'face-detail',
    specialization: 'High-resolution face enhancement and correction',
    description: 'Specialized model for enhancing facial features, correcting anatomy, and adding realistic details like skin pores, subtle expressions, and natural eye reflections. Works as a post-processing step.',
    bestFor: [
      'Face enhancement after generation',
      'Expression correction',
      'Eye detail and reflection',
      'Lip and mouth detail',
      'Skin pore addition',
    ],
    settings: {
      recommendedSteps: [25, 35],
      recommendedCFG: [6.0, 8.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [512, 512],
    },
    loraCompatibility: ['face-enhance-v3', 'realistic-eyes-v4', 'lip-detail-v2'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },

  // 3. BODY DETAIL MODELS
  {
    id: 'body-proportions-xl',
    name: 'Body Proportions XL',
    category: 'body-detail',
    specialization: 'Anatomical correctness and body proportion refinement',
    description: 'Corrects and enhances body proportions, ensures anatomical accuracy, and refines muscle definition, body curves, and natural body symmetry. Essential for fixing anatomy issues.',
    bestFor: [
      'Body proportion correction',
      'Anatomy refinement',
      'Muscle definition',
      'Body symmetry',
      'Natural body curves',
    ],
    settings: {
      recommendedSteps: [30, 40],
      recommendedCFG: [7.0, 9.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['anatomy-correct-v2', 'body-enhance-v3', 'proportion-fix-v1'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },

  // 4. POSE AND COMPOSITION CONTROL
  {
    id: 'controlnet-pose-xl-v2',
    name: 'ControlNet Pose XL V2',
    category: 'pose-control',
    specialization: 'Precise pose control and body positioning',
    description: 'Enables precise control over body positioning, limb placement, and pose accuracy. Critical for complex sexual positions and ensuring anatomical correctness in challenging poses.',
    bestFor: [
      'Complex sexual positions',
      'Precise limb placement',
      'Pose accuracy',
      'Multi-person positioning',
      'Challenging angle control',
    ],
    settings: {
      recommendedSteps: [30, 40],
      recommendedCFG: [7.5, 9.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['pose-enhance-v2', 'body-control-v3'],
    controlNetSupport: true,
    inpaintingSupport: false,
  },

  // 5. UPSCALING MODELS
  {
    id: '4x-upscaler-ultrasharp',
    name: '4x Upscaler Ultrasharp',
    category: 'upscaling',
    specialization: 'High-resolution upscaling with detail preservation',
    description: 'Upscales images 4x while preserving and enhancing fine details, skin texture, and anatomical features. Essential for final output quality.',
    bestFor: [
      'Final resolution enhancement',
      'Detail preservation',
      'Skin texture upscaling',
      'Print-quality output',
      'High-resolution delivery',
    ],
    settings: {
      recommendedSteps: [20, 30],
      recommendedCFG: [6.0, 8.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [4096, 4096],
    },
    loraCompatibility: [],
    controlNetSupport: false,
    inpaintingSupport: false,
  },

  // 6. INPAINTING MODELS
  {
    id: 'nsfw-inpainting-pro-v2',
    name: 'NSFW Inpainting Pro V2',
    category: 'inpainting',
    specialization: 'Region-specific NSFW editing and correction',
    description: 'Specialized for inpainting NSFW content: fixing anatomy, adjusting genitalia, correcting hands, refining specific body regions while maintaining consistency with surrounding areas.',
    bestFor: [
      'Anatomy correction',
      'Genital refinement',
      'Hand fixing',
      'Region-specific editing',
      'Consistency maintenance',
    ],
    settings: {
      recommendedSteps: [25, 35],
      recommendedCFG: [7.0, 9.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['anatomy-fix-v2', 'detail-enhance-v3'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },

  // 7. SKIN TEXTURE MODELS
  {
    id: 'skin-texture-pro-v2',
    name: 'Skin Texture Pro V2',
    category: 'skin-texture',
    specialization: 'Realistic skin pores, imperfections, and texture',
    description: 'Adds realistic skin texture, pores, subtle imperfections, and natural skin variations. Transforms plastic-looking skin into photorealistic human skin.',
    bestFor: [
      'Skin pore addition',
      'Natural skin texture',
      'Subtle imperfections',
      'Realistic skin tone variation',
      'Natural skin sheen',
    ],
    settings: {
      recommendedSteps: [25, 35],
      recommendedCFG: [6.5, 8.5],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['skin-pores-v3', 'natural-texture-v2'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },

  // 8. LIGHTING AND ATMOSPHERE
  {
    id: 'lighting-enhance-xl',
    name: 'Lighting Enhance XL',
    category: 'lighting',
    specialization: 'Professional lighting and atmosphere refinement',
    description: 'Enhances lighting quality, adds realistic shadows, improves atmosphere, and creates professional-grade illumination. Supports various lighting styles from soft romantic to dramatic.',
    bestFor: [
      'Lighting refinement',
      'Shadow enhancement',
      'Atmosphere creation',
      'Professional illumination',
      'Mood setting',
    ],
    settings: {
      recommendedSteps: [25, 35],
      recommendedCFG: [7.0, 9.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: ['lighting-rembrandt-v2', 'soft-light-v3', 'dramatic-shadow-v1'],
    controlNetSupport: true,
    inpaintingSupport: true,
  },

  // 9. FINAL POLISH
  {
    id: 'final-polish-xl',
    name: 'Final Polish XL',
    category: 'final-polish',
    specialization: 'Overall quality enhancement and artifact removal',
    description: 'Final post-processing model that enhances overall quality, removes artifacts, improves coherence, and adds final professional touches. The last step in the pipeline.',
    bestFor: [
      'Final quality enhancement',
      'Artifact removal',
      'Coherence improvement',
      'Professional finish',
      'Output preparation',
    ],
    settings: {
      recommendedSteps: [20, 30],
      recommendedCFG: [6.0, 8.0],
      recommendedSampler: 'DPM++ 2M Karras',
      recommendedScheduler: 'karras',
      recommendedResolution: [1024, 1024],
    },
    loraCompatibility: [],
    controlNetSupport: false,
    inpaintingSupport: true,
  },
]

/**
 * Model selection logic based on task requirements
 */
export interface ModelSelectionCriteria {
  taskType: 'generation' | 'face-enhance' | 'body-enhance' | 'pose-control' | 'upscale' | 'inpaint' | 'skin-texture' | 'lighting' | 'final-polish'
  quality: 'fast' | 'balanced' | 'best'
  hasReferenceImage: boolean
  requiresAnatomyCorrection: boolean
  targetResolution: [number, number]
}

export function selectOptimalModel(criteria: ModelSelectionCriteria): LocalDreamModel {
  const { taskType, quality, requiresAnatomyCorrection } = criteria

  // Map task type to category
  const categoryMap: Record<string, ModelCategory[]> = {
    'generation': ['primary-generation'],
    'face-enhance': ['face-detail'],
    'body-enhance': ['body-detail'],
    'pose-control': ['pose-control'],
    'upscale': ['upscaling'],
    'inpaint': ['inpainting'],
    'skin-texture': ['skin-texture'],
    'lighting': ['lighting'],
    'final-polish': ['final-polish'],
  }

  const categories = categoryMap[taskType] || ['primary-generation']

  // Filter models by category
  const candidates = LOCAL_DREAM_SPECIALIZED_MODELS.filter((model) =>
    categories.includes(model.category)
  )

  if (candidates.length === 0) {
    // Fallback to primary generation
    return LOCAL_DREAM_SPECIALIZED_MODELS.find((m) => m.id === 'lustify-v8')!
  }

  // Select based on quality preference
  if (quality === 'fast') {
    // Return first candidate (usually fastest)
    return candidates[0]
  }

  if (quality === 'best') {
    // Return highest quality model (usually highest version or most specialized)
    return candidates[candidates.length - 1]
  }

  // Balanced: prefer models with anatomy correction if needed
  if (requiresAnatomyCorrection) {
    const anatomyModel = candidates.find((m) =>
      m.bestFor.some((use) => use.toLowerCase().includes('anatomy'))
    )
    if (anatomyModel) return anatomyModel
  }

  // Default to middle option
  return candidates[Math.floor(candidates.length / 2)]
}

/**
 * Build a complete processing pipeline for NSFW content
 */
export interface PipelineStep {
  model: LocalDreamModel
  purpose: string
  settings: {
    steps: number
    cfg: number
    denoiseStrength?: number
  }
}

export function buildNSFWPipeline(criteria: {
  quality: 'fast' | 'balanced' | 'best'
  includeFaceEnhance: boolean
  includeBodyEnhance: boolean
  includeSkinTexture: boolean
  includeUpscale: boolean
  targetResolution: [number, number]
}): PipelineStep[] {
  const pipeline: PipelineStep[] = []

  // Step 1: Primary generation
  const primaryModel = selectOptimalModel({
    taskType: 'generation',
    quality: criteria.quality,
    hasReferenceImage: false,
    requiresAnatomyCorrection: false,
    targetResolution: criteria.targetResolution,
  })
  pipeline.push({
    model: primaryModel,
    purpose: 'Initial NSFW generation',
    settings: {
      steps: criteria.quality === 'fast' ? 25 : criteria.quality === 'best' ? 40 : 30,
      cfg: 8.0,
    },
  })

  // Step 2: Face enhancement (optional)
  if (criteria.includeFaceEnhance) {
    const faceModel = selectOptimalModel({
      taskType: 'face-enhance',
      quality: criteria.quality,
      hasReferenceImage: false,
      requiresAnatomyCorrection: false,
      targetResolution: [512, 512],
    })
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

  // Step 3: Body enhancement (optional)
  if (criteria.includeBodyEnhance) {
    const bodyModel = selectOptimalModel({
      taskType: 'body-enhance',
      quality: criteria.quality,
      hasReferenceImage: false,
      requiresAnatomyCorrection: true,
      targetResolution: criteria.targetResolution,
    })
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

  // Step 4: Skin texture (optional)
  if (criteria.includeSkinTexture) {
    const skinModel = selectOptimalModel({
      taskType: 'skin-texture',
      quality: criteria.quality,
      hasReferenceImage: false,
      requiresAnatomyCorrection: false,
      targetResolution: criteria.targetResolution,
    })
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

  // Step 5: Upscaling (optional)
  if (criteria.includeUpscale) {
    const upscaleModel = selectOptimalModel({
      taskType: 'upscale',
      quality: criteria.quality,
      hasReferenceImage: false,
      requiresAnatomyCorrection: false,
      targetResolution: criteria.targetResolution,
    })
    pipeline.push({
      model: upscaleModel,
      purpose: 'Resolution enhancement',
      settings: {
        steps: 25,
        cfg: 7.0,
      },
    })
  }

  // Step 6: Final polish (always for 'best' quality)
  if (criteria.quality === 'best') {
    const polishModel = selectOptimalModel({
      taskType: 'final-polish',
      quality: criteria.quality,
      hasReferenceImage: false,
      requiresAnatomyCorrection: false,
      targetResolution: criteria.targetResolution,
    })
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
 * Get model recommendations for specific NSFW scenarios
 */
export function getModelRecommendations(scenario: string): {
  primary: LocalDreamModel
  secondary: LocalDreamModel[]
  pipeline: PipelineStep[]
} {
  const scenarioMap: Record<string, {
    includeFaceEnhance: boolean
    includeBodyEnhance: boolean
    includeSkinTexture: boolean
    includeUpscale: boolean
    quality: 'fast' | 'balanced' | 'best'
  }> = {
    'solo-portrait': {
      includeFaceEnhance: true,
      includeBodyEnhance: false,
      includeSkinTexture: true,
      includeUpscale: true,
      quality: 'best',
    },
    'couple-intimate': {
      includeFaceEnhance: true,
      includeBodyEnhance: true,
      includeSkinTexture: true,
      includeUpscale: true,
      quality: 'best',
    },
    'complex-position': {
      includeFaceEnhance: true,
      includeBodyEnhance: true,
      includeSkinTexture: true,
      includeUpscale: true,
      quality: 'best',
    },
    'quick-preview': {
      includeFaceEnhance: false,
      includeBodyEnhance: false,
      includeSkinTexture: false,
      includeUpscale: false,
      quality: 'fast',
    },
  }

  const config = scenarioMap[scenario] || scenarioMap['couple-intimate']

  const primary = selectOptimalModel({
    taskType: 'generation',
    quality: config.quality,
    hasReferenceImage: false,
    requiresAnatomyCorrection: false,
    targetResolution: [1024, 1024],
  })

  const secondary: LocalDreamModel[] = []
  if (config.includeFaceEnhance) {
    secondary.push(selectOptimalModel({
      taskType: 'face-enhance',
      quality: config.quality,
      hasReferenceImage: false,
      requiresAnatomyCorrection: false,
      targetResolution: [512, 512],
    }))
  }
  if (config.includeBodyEnhance) {
    secondary.push(selectOptimalModel({
      taskType: 'body-enhance',
      quality: config.quality,
      hasReferenceImage: false,
      requiresAnatomyCorrection: true,
      targetResolution: [1024, 1024],
    }))
  }

  const pipeline = buildNSFWPipeline({
    quality: config.quality,
    includeFaceEnhance: config.includeFaceEnhance,
    includeBodyEnhance: config.includeBodyEnhance,
    includeSkinTexture: config.includeSkinTexture,
    includeUpscale: config.includeUpscale,
    targetResolution: [1024, 1024],
  })

  return { primary, secondary, pipeline }
}
