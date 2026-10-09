/**
 * NSFW workflow templates for Chili.
 *
 * Pre-configured workflows for common adult content generation scenarios.
 * Each template includes: prompt structure, model selection, settings, and negative prompts.
 */

export type NSFWWorkflowType =
  | 'solo-female'
  | 'solo-male'
  | 'couple-missionary'
  | 'couple-doggy'
  | 'couple-cowgirl'
  | 'couple-reverse-cowgirl'
  | 'oral-fellatio'
  | 'oral-cunnilingus'
  | 'anal'
  | 'threesome-ffm'
  | 'threesome-mmf'
  | 'group-orgy'
  | 'bdsm-bondage'
  | 'bdsm-dominance'
  | 'lingerie-erotic'
  | 'nude-artistic'
  | 'explicit-pornographic'

export interface NSFWWorkflowTemplate {
  id: NSFWWorkflowType
  label: string
  description: string
  category: 'solo' | 'couple' | 'group' | 'bdsm' | 'erotic' | 'explicit'

  /** Base positive prompt structure */
  positivePrompt: string

  /** Recommended negative prompt */
  negativePrompt: string

  /** Model recommendations */
  models: {
    primary: string
    alternative: string
    upscaler: string
    faceDetail: string
  }

  /** Generation settings */
  settings: {
    steps: number
    cfg: number
    sampler: string
    scheduler: string
    resolution: [number, number]
    aspectRatio: string
  }

  /** LoRA recommendations */
  loras?: Array<{
    name: string
    weight: number
  }>

  /** ControlNet recommendations */
  controlNet?: {
    type: 'openpose' | 'depth' | 'canny' | 'none'
    weight: number
  }

  /** Inpainting guidance */
  inpainting?: {
    denoiseStrength: number
    maskedBlur: number
  }
}

export const NSFW_WORKFLOW_TEMPLATES: Record<NSFWWorkflowType, NSFWWorkflowTemplate> = {
  'solo-female': {
    id: 'solo-female',
    label: 'Solo Female',
    description: 'Single female subject, full body or portrait',
    category: 'solo',
    positivePrompt: 'beautiful woman, detailed face, realistic skin texture, detailed skin pores, subsurface scattering, natural lighting, professional photography, 8k resolution, photorealistic, hyperdetailed',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'realvisxl-v5',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.0,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [768, 1024],
      aspectRatio: '3:4',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.6 },
    ],
    controlNet: { type: 'openpose', weight: 0.7 },
    inpainting: { denoiseStrength: 0.75, maskedBlur: 4 },
  },

  'solo-male': {
    id: 'solo-male',
    label: 'Solo Male',
    description: 'Single male subject, full body or portrait',
    category: 'solo',
    positivePrompt: 'handsome man, muscular build, detailed face, realistic skin texture, detailed skin pores, natural lighting, professional photography, 8k resolution, photorealistic',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'realvisxl-v5',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.0,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [768, 1024],
      aspectRatio: '3:4',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'muscular-physique-v2', weight: 0.5 },
    ],
    controlNet: { type: 'openpose', weight: 0.7 },
    inpainting: { denoiseStrength: 0.75, maskedBlur: 4 },
  },

  'couple-missionary': {
    id: 'couple-missionary',
    label: 'Missionary Position',
    description: 'Couple in missionary position, intimate embrace',
    category: 'couple',
    positivePrompt: 'couple, missionary position, intimate embrace, man on top, woman underneath, eye contact, passionate, realistic skin texture, detailed anatomy, natural lighting, bedroom setting, professional photography, 8k resolution',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo, unnatural positions',
    models: {
      primary: 'lustify-v8',
      alternative: 'adult-realism-xl-v4',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [1024, 768],
      aspectRatio: '4:3',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
      { name: 'couple-dynamics-v2', weight: 0.6 },
    ],
    controlNet: { type: 'openpose', weight: 0.85 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'couple-doggy': {
    id: 'couple-doggy',
    label: 'Doggy Style',
    description: 'Couple in doggy style position, rear entry',
    category: 'couple',
    positivePrompt: 'couple, doggy style position, rear entry, woman on all fours, man behind, realistic skin texture, detailed anatomy, natural lighting, bedroom setting, professional photography, 8k resolution, photorealistic',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo, unnatural positions',
    models: {
      primary: 'lustify-v8',
      alternative: 'adult-realism-xl-v4',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [1024, 768],
      aspectRatio: '4:3',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
      { name: 'couple-dynamics-v2', weight: 0.6 },
    ],
    controlNet: { type: 'openpose', weight: 0.9 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'couple-cowgirl': {
    id: 'couple-cowgirl',
    label: 'Cowgirl Position',
    description: 'Woman on top, riding position',
    category: 'couple',
    positivePrompt: 'couple, cowgirl position, woman on top, riding, man underneath, eye contact, realistic skin texture, detailed anatomy, natural lighting, bedroom setting, professional photography, 8k resolution',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'adult-realism-xl-v4',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [768, 1024],
      aspectRatio: '3:4',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
    ],
    controlNet: { type: 'openpose', weight: 0.85 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'couple-reverse-cowgirl': {
    id: 'couple-reverse-cowgirl',
    label: 'Reverse Cowgirl',
    description: 'Woman on top facing away, rear view',
    category: 'couple',
    positivePrompt: 'couple, reverse cowgirl position, woman on top facing away, rear view, man underneath, realistic skin texture, detailed anatomy, natural lighting, bedroom setting, professional photography, 8k resolution',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'adult-realism-xl-v4',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [768, 1024],
      aspectRatio: '3:4',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
    ],
    controlNet: { type: 'openpose', weight: 0.85 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'oral-fellatio': {
    id: 'oral-fellatio',
    label: 'Fellatio',
    description: 'Oral sex, woman performing fellatio',
    category: 'explicit',
    positivePrompt: 'oral sex, fellatio, woman performing blowjob, man receiving, realistic anatomy, detailed mouth and throat, realistic skin texture, intimate setting, professional photography, 8k resolution, photorealistic',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'pornmaster-pro-v3',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [1024, 768],
      aspectRatio: '4:3',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
      { name: 'oral-anatomy-v2', weight: 0.6 },
    ],
    controlNet: { type: 'openpose', weight: 0.8 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'oral-cunnilingus': {
    id: 'oral-cunnilingus',
    label: 'Cunnilingus',
    description: 'Oral sex, man performing cunnilingus',
    category: 'explicit',
    positivePrompt: 'oral sex, cunnilingus, man performing oral on woman, woman receiving, realistic anatomy, detailed vulva and mouth, realistic skin texture, intimate setting, professional photography, 8k resolution',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'pornmaster-pro-v3',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [1024, 768],
      aspectRatio: '4:3',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
      { name: 'oral-anatomy-v2', weight: 0.6 },
    ],
    controlNet: { type: 'openpose', weight: 0.8 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'anal': {
    id: 'anal',
    label: 'Anal Sex',
    description: 'Anal intercourse position',
    category: 'explicit',
    positivePrompt: 'anal sex, anal intercourse, rear entry, realistic anatomy, detailed anatomy, lubrication, realistic skin texture, intimate setting, professional photography, 8k resolution, photorealistic',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'pornmaster-pro-v3',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [1024, 768],
      aspectRatio: '4:3',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
      { name: 'anal-anatomy-v2', weight: 0.6 },
    ],
    controlNet: { type: 'openpose', weight: 0.85 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'threesome-ffm': {
    id: 'threesome-ffm',
    label: 'Threesome FFM',
    description: 'Two females, one male',
    category: 'group',
    positivePrompt: 'threesome, FFM, two women one man, group sex, realistic anatomy, detailed bodies, realistic skin texture, intimate setting, professional photography, 8k resolution, photorealistic',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'adult-realism-xl-v4',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 45,
      cfg: 9.0,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [1024, 768],
      aspectRatio: '4:3',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
      { name: 'group-dynamics-v2', weight: 0.6 },
    ],
    controlNet: { type: 'openpose', weight: 0.9 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'threesome-mmf': {
    id: 'threesome-mmf',
    label: 'Threesome MMF',
    description: 'Two males, one female',
    category: 'group',
    positivePrompt: 'threesome, MMF, two men one woman, group sex, realistic anatomy, detailed bodies, realistic skin texture, intimate setting, professional photography, 8k resolution',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'adult-realism-xl-v4',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 45,
      cfg: 9.0,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [1024, 768],
      aspectRatio: '4:3',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
      { name: 'group-dynamics-v2', weight: 0.6 },
    ],
    controlNet: { type: 'openpose', weight: 0.9 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'group-orgy': {
    id: 'group-orgy',
    label: 'Group/Orgy',
    description: 'Multiple people, group scene',
    category: 'group',
    positivePrompt: 'group sex, orgy, multiple people, realistic anatomy, detailed bodies, realistic skin texture, intimate setting, professional photography, 8k resolution, photorealistic',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'adult-realism-xl-v4',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 50,
      cfg: 9.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [1280, 720],
      aspectRatio: '16:9',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
      { name: 'group-dynamics-v2', weight: 0.7 },
    ],
    controlNet: { type: 'openpose', weight: 0.95 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'bdsm-bondage': {
    id: 'bdsm-bondage',
    label: 'BDSM Bondage',
    description: 'Bondage, restraints, submissive',
    category: 'bdsm',
    positivePrompt: 'BDSM, bondage, restraints, ropes, submissive, dominant, realistic anatomy, detailed skin, realistic skin texture, dramatic lighting, professional photography, 8k resolution',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'erotic-dreams-xl-v2',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [768, 1024],
      aspectRatio: '3:4',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'bdsm-aesthetics-v2', weight: 0.7 },
    ],
    controlNet: { type: 'openpose', weight: 0.85 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'bdsm-dominance': {
    id: 'bdsm-dominance',
    label: 'BDSM Dominance',
    description: 'Dominant/submissive dynamics',
    category: 'bdsm',
    positivePrompt: 'BDSM, dominance, submission, power exchange, realistic anatomy, detailed skin, realistic skin texture, dramatic lighting, professional photography, 8k resolution',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'erotic-dreams-xl-v2',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [768, 1024],
      aspectRatio: '3:4',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'bdsm-aesthetics-v2', weight: 0.7 },
    ],
    controlNet: { type: 'openpose', weight: 0.85 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },

  'lingerie-erotic': {
    id: 'lingerie-erotic',
    label: 'Lingerie/Erotic',
    description: 'Erotic lingerie, sensual pose',
    category: 'erotic',
    positivePrompt: 'lingerie, erotic, sensual pose, beautiful woman, detailed face, realistic skin texture, detailed skin pores, soft lighting, bedroom setting, professional photography, 8k resolution, photorealistic',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'majicmix-realistic-v7',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 40,
      cfg: 8.0,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [768, 1024],
      aspectRatio: '3:4',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'lingerie-collection-v3', weight: 0.7 },
      { name: 'realistic-skin-v2', weight: 0.6 },
    ],
    controlNet: { type: 'openpose', weight: 0.7 },
    inpainting: { denoiseStrength: 0.75, maskedBlur: 4 },
  },

  'nude-artistic': {
    id: 'nude-artistic',
    label: 'Artistic Nude',
    description: 'Artistic nude photography',
    category: 'erotic',
    positivePrompt: 'artistic nude, nude photography, beautiful body, realistic skin texture, detailed skin pores, natural lighting, professional photography, 8k resolution, photorealistic, tasteful',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo, pornographic',
    models: {
      primary: 'realvisxl-v5',
      alternative: 'majicmix-realistic-v7',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 45,
      cfg: 8.5,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [768, 1024],
      aspectRatio: '3:4',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.8 },
      { name: 'realistic-skin-v2', weight: 0.7 },
    ],
    controlNet: { type: 'openpose', weight: 0.7 },
    inpainting: { denoiseStrength: 0.75, maskedBlur: 4 },
  },

  'explicit-pornographic': {
    id: 'explicit-pornographic',
    label: 'Explicit Pornographic',
    description: 'Hardcore explicit content',
    category: 'explicit',
    positivePrompt: 'explicit pornographic, hardcore, realistic anatomy, detailed genitalia, realistic skin texture, detailed skin pores, professional adult photography, 8k resolution, photorealistic, hyperdetailed',
    negativePrompt: 'cartoon, anime, drawing, painting, deformed, ugly, bad anatomy, bad proportions, extra limbs, mutated hands, poorly drawn face, mutation, disfigured, blurry, bad art, watermark, text, logo',
    models: {
      primary: 'lustify-v8',
      alternative: 'pornmaster-pro-v3',
      upscaler: '4x-upscaler-ultrasharp',
      faceDetail: 'face-detailer-xl-v3',
    },
    settings: {
      steps: 45,
      cfg: 9.0,
      sampler: 'DPM++ 2M Karras',
      scheduler: 'karras',
      resolution: [1024, 768],
      aspectRatio: '4:3',
    },
    loras: [
      { name: 'add-detail-xl', weight: 0.9 },
      { name: 'realistic-skin-v2', weight: 0.8 },
      { name: 'explicit-detail-v3', weight: 0.7 },
    ],
    controlNet: { type: 'openpose', weight: 0.9 },
    inpainting: { denoiseStrength: 0.7, maskedBlur: 4 },
  },
}

/**
 * Get workflow template by ID
 */
export function getNSFWWorkflow(id: string): NSFWWorkflowTemplate | undefined {
  return Object.prototype.hasOwnProperty.call(NSFW_WORKFLOW_TEMPLATES, id) ? NSFW_WORKFLOW_TEMPLATES[id as NSFWWorkflowType] : undefined
}

/**
 * Get all workflows in a category
 */
export function getNSFWWorkflowsByCategory(category: NSFWWorkflowTemplate['category']): NSFWWorkflowTemplate[] {
  return Object.values(NSFW_WORKFLOW_TEMPLATES).filter(w => w.category === category)
}

/**
 * Build a complete prompt from template with user customizations
 */
export function buildNSFWPrompt(
  template: NSFWWorkflowTemplate,
  customizations: {
    subject?: string
    setting?: string
    lighting?: string
    cameraAngle?: string
    additionalDetails?: string
  },
): { positive: string; negative: string } {
  const parts = [template.positivePrompt]

  if (customizations.subject) parts.push(customizations.subject)
  if (customizations.setting) parts.push(customizations.setting)
  if (customizations.lighting) parts.push(customizations.lighting)
  if (customizations.cameraAngle) parts.push(customizations.cameraAngle)
  if (customizations.additionalDetails) parts.push(customizations.additionalDetails)

  return {
    positive: parts.join(', '),
    negative: template.negativePrompt,
  }
}
