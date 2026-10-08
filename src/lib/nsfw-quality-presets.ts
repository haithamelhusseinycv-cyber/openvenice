/**
 * NSFW Quality Presets
 * Tuned settings for different explicit levels: artistic nude, softcore, explicit
 * Each preset adjusts steps, CFG, resolution, and sampler differently
 */

import type { QualityTier } from '../agent/intelligent-router'

export type NSFWPreset = 'softcore' | 'artistic' | 'explicit' | 'pornographic'

export interface NSFWPresetConfig {
  label: string
  description: string
  steps: { min: number; max: number; default: number }
  cfg: { min: number; max: number; default: number }
  resolution: string
  aspectRatio: string
  sampler: string
  scheduler: string
  negativePromptBoost: string
  promptEnhancement: string
  recommendedModels: string[]
}

export const NSFW_PRESETS: Record<NSFWPreset, NSFWPresetConfig> = {
  softcore: {
    label: 'Softcore',
    description: 'Suggestive, lingerie, implied nudity — tasteful and teasing',
    steps: { min: 15, max: 25, default: 20 },
    cfg: { min: 5, max: 9, default: 7 },
    resolution: '1024x1024',
    aspectRatio: '2:3',
    sampler: 'dpm++_2m',
    scheduler: 'karras',
    negativePromptBoost: 'explicit genitalia, penetration, hardcore, pornographic, xxx, vulgar',
    promptEnhancement: 'soft lighting, warm tones, sensual atmosphere, elegant composition, fashion photography style',
    recommendedModels: ['lustify-v8', 'realvisxl-v5', 'cyberrealistic-pony-v170'],
  },
  artistic: {
    label: 'Artistic Nude',
    description: 'Fine art nudes — classical, sculptural, aesthetic focus',
    steps: { min: 20, max: 35, default: 28 },
    cfg: { min: 6, max: 10, default: 8 },
    resolution: '1024x1024',
    aspectRatio: '3:4',
    sampler: 'dpm++_2m_sde',
    scheduler: 'karras',
    negativePromptBoost: 'vulgar, cheap, low quality, deformed, bad anatomy, extra limbs, blurry, watermark',
    promptEnhancement: 'fine art photography, classical composition, Rembrandt lighting, museum quality, tasteful nude, artistic merit',
    recommendedModels: ['realvisxl-v5', 'lustify-v8', 'realism-illustrious-by-v55-fp16'],
  },
  explicit: {
    label: 'Explicit',
    description: 'Graphic sexual content — detailed and uncensored',
    steps: { min: 25, max: 40, default: 32 },
    cfg: { min: 7, max: 12, default: 9 },
    resolution: '1024x1024',
    aspectRatio: '3:4',
    sampler: 'dpm++_2m_sde',
    scheduler: 'karras',
    negativePromptBoost: 'bad anatomy, extra limbs, deformed hands, mutated fingers, blurry, low quality, watermark, text, signature, worst quality, low resolution',
    promptEnhancement: 'anatomically correct, detailed skin texture, natural lighting, photorealistic, high detail, sharp focus',
    recommendedModels: ['lustify-v8', 'pony-realism-v23-ultra', 'cyberrealistic-pony-v170'],
  },
  pornographic: {
    label: 'Pornographic',
    description: 'Maximum explicit detail — hardcore content',
    steps: { min: 30, max: 50, default: 40 },
    cfg: { min: 8, max: 14, default: 11 },
    resolution: '1024x1024',
    aspectRatio: '3:4',
    sampler: 'dpm++_3m_sde',
    scheduler: 'exponential',
    negativePromptBoost: 'bad anatomy, extra limbs, deformed, mutated, disfigured, worst quality, low quality, blurry, watermark, text, signature, cropped, out of frame, double, error',
    promptEnhancement: 'ultra detailed, anatomically precise, photorealistic skin, natural body proportions, explicit detail, sharp focus, professional lighting',
    recommendedModels: ['lustify-v8', 'pony-realism-v23-ultra'],
  },
}

export interface PresetOverrides {
  steps?: number
  cfg?: number
  resolution?: string
  aspectRatio?: string
}

export function getPresetConfig(preset: NSFWPreset, overrides?: PresetOverrides): NSFWPresetConfig {
  const base = NSFW_PRESETS[preset]
  if (!overrides) return base

  return {
    ...base,
    steps: overrides.steps ? { ...base.steps, default: overrides.steps } : base.steps,
    cfg: overrides.cfg ? { ...base.cfg, default: overrides.cfg } : base.cfg,
    resolution: overrides.resolution ?? base.resolution,
    aspectRatio: overrides.aspectRatio ?? base.aspectRatio,
  }
}

export function detectPresetFromPrompt(prompt: string): NSFWPreset {
  const lower = prompt.toLowerCase()

  const pornographicScore = countMatches(lower, [
    /\b(porn|porno|xxx|hardcore)\b/i,
    /\b(fuck|fucking|sucking|blowjob|handjob)\b/i,
    /\b(cum|cumshot|ejaculation|creampie)\b/i,
    /\b(anal|deep\s*throat|gangbang)\b/i,
  ])

  const explicitScore = countMatches(lower, [
    /\b(explicit|graphic|detailed)\b/i,
    /\b(sex|sexual|intercourse)\b/i,
    /\b(genitals|penis|vagina|pussy|cock)\b/i,
    /\b(naked|nude|unclothed)\b/i,
  ])

  const artisticScore = countMatches(lower, [
    /\b(artistic|aesthetic|fine\s+art|classical)\b/i,
    /\b(sculpture|painting|artistic\s+nude)\b/i,
    /\b(museum|gallery|exhibition)\b/i,
  ])

  const softcoreScore = countMatches(lower, [
    /\b(softcore|suggestive|teasing|implied)\b/i,
    /\b(lingerie|bikini|underwear)\b/i,
    /\b(topless|bare\s+chest)\b/i,
  ])

  const scores = { pornographic: pornographicScore, explicit: explicitScore, artistic: artisticScore, softcore: softcoreScore }
  const max = Math.max(...Object.values(scores))

  if (max === 0) return 'artistic'
  return Object.entries(scores).find(([, s]) => s === max)?.[0] as NSFWPreset
}

function countMatches(text: string, patterns: RegExp[]): number {
  let count = 0
  for (const p of patterns) {
    if (p.test(text)) count++
  }
  return count
}

export function getQualityTierSteps(tier: QualityTier, preset: NSFWPreset): number {
  const config = NSFW_PRESETS[preset]
  switch (tier) {
    case 'fast':
      return config.steps.min
    case 'balanced':
      return config.steps.default
    case 'best':
      return config.steps.max
  }
}

export function buildPresetNegativePrompt(preset: NSFWPreset, customNegative?: string): string {
  const base = NSFW_PRESETS[preset].negativePromptBoost
  const defaultNegative = 'bad anatomy, extra limbs, deformed hands, mutated fingers, blurry, low quality, watermark, text'

  const parts = [defaultNegative, base]
  if (customNegative) parts.push(customNegative)
  return parts.join(', ')
}

export function enhancePromptWithPreset(prompt: string, preset: NSFWPreset): string {
  const config = NSFW_PRESETS[preset]
  return `${prompt}, ${config.promptEnhancement}`
}
