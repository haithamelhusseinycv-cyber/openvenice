/**
 * NSFW Model Capabilities
 * Detects which models support NSFW content and at what level
 * Maps Venice, Local Dream, and Atelier models to their NSFW capabilities
 */

export type NSFWCapability = 'none' | 'softcore' | 'artistic' | 'explicit' | 'full'

export interface ModelNSFWInfo {
  id: string
  name: string
  provider: 'venice' | 'localdream' | 'atelier'
  capability: NSFWCapability
  supportsEdit: boolean
  supportsInpainting: boolean
  strengths: string[]
  limitations: string[]
}

const VENICE_MODELS: ModelNSFWInfo[] = [
  {
    id: 'qwen-image-3',
    name: 'Qwen Image 3',
    provider: 'venice',
    capability: 'artistic',
    supportsEdit: true,
    supportsInpainting: false,
    strengths: ['photorealistic', 'portraits', 'artistic nudes'],
    limitations: ['may refuse explicit content', 'safe mode restrictions'],
  },
  {
    id: 'qwen-image-3-pro',
    name: 'Qwen Image 3 Pro',
    provider: 'venice',
    capability: 'explicit',
    supportsEdit: true,
    supportsInpainting: false,
    strengths: ['high quality', 'detailed', 'photorealistic'],
    limitations: ['slower generation', 'higher cost'],
  },
  {
    id: 'seedream-v5-pro',
    name: 'Seedream V5 Pro',
    provider: 'venice',
    capability: 'explicit',
    supportsEdit: true,
    supportsInpainting: false,
    strengths: ['realistic', 'detailed anatomy', 'good lighting'],
    limitations: ['may have content filters'],
  },
  {
    id: 'seedream-v5-lite',
    name: 'Seedream V5 Lite',
    provider: 'venice',
    capability: 'artistic',
    supportsEdit: true,
    supportsInpainting: false,
    strengths: ['fast', 'efficient', 'good quality'],
    limitations: ['less detail than pro'],
  },
  {
    id: 'flux-1-dev',
    name: 'Flux 1 Dev',
    provider: 'venice',
    capability: 'artistic',
    supportsEdit: false,
    supportsInpainting: false,
    strengths: ['artistic', 'creative', 'versatile'],
    limitations: ['may refuse NSFW', 'slower'],
  },
]

const LOCALDREAM_MODELS: ModelNSFWInfo[] = [
  {
    id: 'lustify-v8',
    name: 'Lustify V8',
    provider: 'localdream',
    capability: 'full',
    supportsEdit: true,
    supportsInpainting: true,
    strengths: ['uncensored', 'NSFW specialized', 'anatomically correct', 'high detail'],
    limitations: ['requires GPU', 'slower on CPU'],
  },
  {
    id: 'realvisxl-v5',
    name: 'RealVisXL V5',
    provider: 'localdream',
    capability: 'full',
    supportsEdit: true,
    supportsInpainting: true,
    strengths: ['photorealistic', 'versatile', 'good anatomy'],
    limitations: ['large model size'],
  },
  {
    id: 'pony-realism-v23-ultra',
    name: 'Pony Realism V23 Ultra',
    provider: 'localdream',
    capability: 'full',
    supportsEdit: true,
    supportsInpainting: true,
    strengths: ['uncensored', 'anime/realistic hybrid', 'very flexible'],
    limitations: ['pony-style aesthetics'],
  },
  {
    id: 'cyberrealistic-pony-v170',
    name: 'CyberRealistic Pony V1.7.0',
    provider: 'localdream',
    capability: 'full',
    supportsEdit: true,
    supportsInpainting: true,
    strengths: ['cyberpunk aesthetic', 'realistic', 'uncensored'],
    limitations: ['stylized look'],
  },
  {
    id: 'realism-illustrious-by-v55-fp16',
    name: 'Realism Illustrious V5.5',
    provider: 'localdream',
    capability: 'explicit',
    supportsEdit: true,
    supportsInpainting: true,
    strengths: ['illustrative', 'realistic', 'good skin tones'],
    limitations: ['may need prompt tuning'],
  },
  {
    id: 'illustrious-v16',
    name: 'Illustrious V16',
    provider: 'localdream',
    capability: 'artistic',
    supportsEdit: true,
    supportsInpainting: false,
    strengths: ['anime style', 'artistic', 'creative'],
    limitations: ['less photorealistic'],
  },
]

const ATELIER_MODELS: ModelNSFWInfo[] = [
  {
    id: 'atelier-sdxl-uncensored',
    name: 'Atelier SDXL Uncensored',
    provider: 'atelier',
    capability: 'full',
    supportsEdit: true,
    supportsInpainting: true,
    strengths: ['GPU accelerated', 'uncensored', 'high quality', 'complex workflows'],
    limitations: ['requires SSH tunnel', 'GPU cost'],
  },
  {
    id: 'atelier-pony-gpu',
    name: 'Atelier Pony GPU',
    provider: 'atelier',
    capability: 'full',
    supportsEdit: true,
    supportsInpainting: true,
    strengths: ['fast GPU', 'flexible', 'LoRA support'],
    limitations: ['requires Vast AI'],
  },
]

const ALL_MODELS = [...VENICE_MODELS, ...LOCALDREAM_MODELS, ...ATELIER_MODELS]

export function getModelNSFWInfo(modelId: string): ModelNSFWInfo | undefined {
  return ALL_MODELS.find((m) => m.id === modelId || m.id === modelId.replace(/-edit$/, ''))
}

export function getNSFWCapability(modelId: string): NSFWCapability {
  return getModelNSFWInfo(modelId)?.capability ?? 'none'
}

export function canHandleNSFW(modelId: string, level: NSFWCapability): boolean {
  const capability = getNSFWCapability(modelId)
  const hierarchy: NSFWCapability[] = ['none', 'softcore', 'artistic', 'explicit', 'full']
  return hierarchy.indexOf(capability) >= hierarchy.indexOf(level)
}

export function filterModelsByNSFW(
  modelIds: string[],
  requiredLevel: NSFWCapability
): string[] {
  return modelIds.filter((id) => canHandleNSFW(id, requiredLevel))
}

export function getBestNSFWModel(
  modelIds: string[],
  level: NSFWCapability
): string | undefined {
  const capable = filterModelsByNSFW(modelIds, level)
  if (capable.length === 0) return undefined

  const priority: Record<string, number> = {
    'lustify-v8': 100,
    'atelier-sdxl-uncensored': 95,
    'realvisxl-v5': 90,
    'pony-realism-v23-ultra': 85,
    'cyberrealistic-pony-v170': 80,
    'qwen-image-3-pro': 70,
    'seedream-v5-pro': 65,
    'qwen-image-3': 60,
  }

  return capable.sort((a, b) => (priority[b] ?? 0) - (priority[a] ?? 0))[0]
}

export function getModelsByProvider(provider: 'venice' | 'localdream' | 'atelier'): ModelNSFWInfo[] {
  return ALL_MODELS.filter((m) => m.provider === provider)
}

export function getNSFWModelRecommendations(level: NSFWCapability): ModelNSFWInfo[] {
  return ALL_MODELS.filter((m) => canHandleNSFW(m.id, level))
    .sort((a, b) => {
      const providerOrder = { localdream: 0, atelier: 1, venice: 2 }
      return providerOrder[a.provider] - providerOrder[b.provider]
    })
}

export function supportsInpainting(modelId: string): boolean {
  return getModelNSFWInfo(modelId)?.supportsInpainting ?? false
}

export function supportsEditing(modelId: string): boolean {
  return getModelNSFWInfo(modelId)?.supportsEdit ?? false
}
