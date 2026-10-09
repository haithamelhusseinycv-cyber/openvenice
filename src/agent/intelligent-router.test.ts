import { describe, it, expect } from 'vitest'
import { routeIntelligently, enhancePromptForNSFW, type RoutingInput } from './intelligent-router'

function input(overrides: Partial<RoutingInput> & { prompt: string }): RoutingInput {
  return { hasImages: false, imageCount: 0, ...overrides }
}

describe('routeIntelligently', () => {
  describe('intent detection', () => {
    it('detects upscale intent', () => {
      const result = routeIntelligently(input({ prompt: 'upscale this to 4k' }))
      expect(result.intent).toBe('upscale')
      expect(result.confidence).toBe(0.95)
    })

    it('detects remove_background intent', () => {
      const result = routeIntelligently(input({ prompt: 'remove the background' }))
      expect(result.intent).toBe('remove_background')
      expect(result.confidence).toBe(0.95)
    })

    it('detects refine_faces intent', () => {
      const result = routeIntelligently(input({ prompt: 'enhance the face details' }))
      expect(result.intent).toBe('refine_faces')
      expect(result.confidence).toBe(0.9)
    })

    it('detects combine_photos intent', () => {
      const result = routeIntelligently(input({ prompt: 'combine two photos together' }))
      expect(result.intent).toBe('combine_photos')
      expect(result.confidence).toBe(0.9)
    })

    it('detects edit_region intent', () => {
      const result = routeIntelligently(input({ prompt: 'edit the region and change clothes' }))
      expect(result.intent).toBe('edit_region')
      expect(result.confidence).toBe(0.85)
    })

    it('detects edit_photo intent', () => {
      const result = routeIntelligently(input({ prompt: 'edit this photo' }))
      expect(result.intent).toBe('edit_photo')
    })

    it('detects create_from_scratch intent', () => {
      const result = routeIntelligently(input({ prompt: 'create a beautiful sunset' }))
      expect(result.intent).toBe('create_from_scratch')
    })

    it('falls back to create_from_scratch for ambiguous prompts', () => {
      const result = routeIntelligently(input({ prompt: 'hello world' }))
      expect(result.intent).toBe('create_from_scratch')
      expect(result.confidence).toBe(0.6)
    })

    it('picks highest-weight intent when multiple match', () => {
      const result = routeIntelligently(input({ prompt: 'upscale and enhance the face' }))
      expect(result.intent).toBe('upscale')
      expect(result.confidence).toBe(0.95)
    })
  })

  describe('quality selection', () => {
    it('returns user preference when set', () => {
      const result = routeIntelligently(input({
        prompt: 'create something',
        userExplicitPreferences: { quality: 'fast' },
      }))
      expect(result.quality).toBe('fast')
    })

    it('selects best for quality hints', () => {
      const result = routeIntelligently(input({ prompt: 'create a photorealistic portrait' }))
      expect(result.quality).toBe('best')
    })

    it('selects fast for speed hints', () => {
      const result = routeIntelligently(input({ prompt: 'quick preview draft' }))
      expect(result.quality).toBe('fast')
    })

    it('selects best for NSFW prompts', () => {
      const result = routeIntelligently(input({ prompt: 'generate a nude portrait' }))
      expect(result.quality).toBe('best')
    })

    it('defaults to balanced for neutral prompts', () => {
      const result = routeIntelligently(input({ prompt: 'a cat sitting' }))
      expect(result.quality).toBe('balanced')
    })
  })

  describe('cloud routing', () => {
    it('routes to cloud for best quality', () => {
      const result = routeIntelligently(input({ prompt: 'create a photorealistic scene' }))
      expect(result.useCloud).toBe(true)
    })

    it('routes to cloud for remove_background', () => {
      const result = routeIntelligently(input({ prompt: 'remove the background' }))
      expect(result.useCloud).toBe(true)
    })

    it('routes to cloud for refine_faces', () => {
      const result = routeIntelligently(input({ prompt: 'enhance the face' }))
      expect(result.useCloud).toBe(true)
    })

    it('routes to cloud for combine_photos with multiple images', () => {
      const result = routeIntelligently(input({
        prompt: 'combine photos together',
        hasImages: true,
        imageCount: 3,
      }))
      expect(result.useCloud).toBe(true)
    })

    it('routes locally for fast quality create', () => {
      const result = routeIntelligently(input({
        prompt: 'quick draft of a cat',
        userExplicitPreferences: { quality: 'fast' },
      }))
      expect(result.useCloud).toBe(false)
    })

    it('routes upscale to cloud unless fast', () => {
      const best = routeIntelligently(input({ prompt: 'upscale to 4k' }))
      expect(best.useCloud).toBe(true)

      const fast = routeIntelligently(input({
        prompt: 'upscale',
        userExplicitPreferences: { quality: 'fast' },
      }))
      expect(fast.useCloud).toBe(false)
    })
  })

  describe('operation mapping', () => {
    it('maps create_from_scratch to create', () => {
      expect(routeIntelligently(input({ prompt: 'generate a sunset' })).operation).toBe('create')
    })

    it('maps refine_faces to face_detailer', () => {
      expect(routeIntelligently(input({ prompt: 'enhance face details' })).operation).toBe('face_detailer')
    })

    it('maps edit_region to masked_edit', () => {
      expect(routeIntelligently(input({ prompt: 'edit the region' })).operation).toBe('masked_edit')
    })

    it('maps upscale to upscale', () => {
      expect(routeIntelligently(input({ prompt: 'upscale this' })).operation).toBe('upscale')
    })
  })

  describe('auto settings', () => {
    it('includes aspect_ratio for create_from_scratch', () => {
      const result = routeIntelligently(input({ prompt: 'create a portrait photo' }))
      expect(result.autoSettings.aspect_ratio).toBe('9:16')
    })

    it('detects landscape aspect ratio', () => {
      const result = routeIntelligently(input({ prompt: 'create a landscape panorama' }))
      expect(result.autoSettings.aspect_ratio).toBe('16:9')
    })

    it('detects square aspect ratio', () => {
      const result = routeIntelligently(input({ prompt: 'create a square profile picture' }))
      expect(result.autoSettings.aspect_ratio).toBe('1:1')
    })

    it('includes upscale_factor for upscale at best quality', () => {
      const result = routeIntelligently(input({ prompt: 'upscale to high quality' }))
      expect(result.autoSettings.upscale_factor).toBe(4)
    })

    it('includes denoise_strength for edit_photo', () => {
      const result = routeIntelligently(input({ prompt: 'edit this photo' }))
      expect(result.autoSettings).toHaveProperty('denoise_strength')
    })

    it('adds negative_prompt for NSFW create', () => {
      const result = routeIntelligently(input({ prompt: 'create a nude portrait' }))
      expect(result.autoSettings.negative_prompt).toBeDefined()
    })
  })

  describe('reasoning', () => {
    it('includes intent in reasoning', () => {
      const result = routeIntelligently(input({ prompt: 'upscale this' }))
      expect(result.reasoning).toContain('upscale')
    })

    it('mentions cloud when routing to cloud', () => {
      const result = routeIntelligently(input({ prompt: 'create a photorealistic scene' }))
      expect(result.reasoning).toContain('cloud')
    })

    it('mentions local when routing locally', () => {
      const result = routeIntelligently(input({
        prompt: 'quick draft',
        userExplicitPreferences: { quality: 'fast' },
      }))
      expect(result.reasoning).toContain('local')
    })
  })
})

describe('enhancePromptForNSFW', () => {
  it('returns non-NSFW prompts unchanged', () => {
    const prompt = 'a beautiful sunset over mountains'
    expect(enhancePromptForNSFW(prompt)).toBe(prompt)
  })

  it('appends quality enhancements to NSFW prompts', () => {
    const result = enhancePromptForNSFW('a nude portrait')
    expect(result).toContain('a nude portrait')
    expect(result).toContain('highly detailed')
    expect(result).toContain('professional photography')
    expect(result).toContain('sharp focus')
  })

  it('does not double-enhance prompts with quality terms', () => {
    const prompt = 'a nude portrait, highly detailed, 4k'
    expect(enhancePromptForNSFW(prompt)).toBe(prompt)
  })

  it('detects various NSFW indicators', () => {
    expect(enhancePromptForNSFW('erotic artwork')).not.toBe('erotic artwork')
    expect(enhancePromptForNSFW('sensual pose')).not.toBe('sensual pose')
    expect(enhancePromptForNSFW('naked figure')).not.toBe('naked figure')
    expect(enhancePromptForNSFW('intimate scene')).not.toBe('intimate scene')
  })

  it('does not enhance safe prompts with ambiguous words', () => {
    const prompt = 'a beautiful artistic portrait'
    expect(enhancePromptForNSFW(prompt)).toBe(prompt)
  })
})
