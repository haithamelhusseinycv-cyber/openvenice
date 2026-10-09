/**
 * Batch Generation Hook
 * Generates 4-9 variations in parallel with queue management
 * Tracks progress for each item in the batch
 */

/**
 * Batch Generation Hook
 * Generates 4-9 variations in parallel with queue management
 * Tracks progress for each item in the batch
 */
import { useState, useCallback, useRef } from 'react';
import { useImageGenerate } from './use-image';
import { useAnalyticsStore } from '../stores/analytics-store';
import { useContentStore } from '../stores/content-store';
import { classifyContent } from '../lib/nsfw-content-classifier';
import { detectPresetFromPrompt, enhancePromptWithPreset, buildPresetNegativePrompt } from '../lib/nsfw-quality-presets';
import type { NSFWPreset } from '../lib/nsfw-quality-presets';

export interface BatchItem {
  id: string
  prompt: string
  enhancedPrompt: string
  negativePrompt: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  imageUrl?: string
  error?: string
  progress: number
  seed?: number
}

export interface BatchConfig {
  count: number
  preset: NSFWPreset
  model: string
  steps?: number
  cfg?: number
  resolution?: string
  aspectRatio?: string
  baseSeed?: number
  variationStrength: number
}

const DEFAULT_CONFIG: BatchConfig = {
  count: 4,
  preset: 'artistic',
  model: 'lustify-v8',
  steps: 28,
  cfg: 8,
  resolution: '1024x1024',
  aspectRatio: '3:4',
  variationStrength: 0.3,
}

export function useBatchGeneration() {
  const [batch, setBatch] = useState<BatchItem[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const abortRef = useRef(false)
  const generateImage = useImageGenerate()
  const trackGeneration = useAnalyticsStore((s) => s.trackGeneration)
  const addContentItem = useContentStore((s) => s.addItem)

  const createVariation = useCallback((basePrompt: string, index: number, strength: number): string => {
void index;
    const variations = [
      ', slightly different angle',
      ', alternative composition',
      ', different lighting setup',
      ', alternative pose variation',
      ', subtle expression change',
      ', different background element',
      ', alternative color grading',
      ', slightly different framing',
      ', alternative mood variation',
    ]

    const variation = variations[index % variations.length]
    const seedModifier = `variation ${index + 1}`

    if (strength === 0) return basePrompt
    return `${basePrompt}${variation}, ${seedModifier}`
  }, [])

  const startBatch = useCallback(async (basePrompt: string, config?: Partial<BatchConfig>) => {
    const fullConfig = { ...DEFAULT_CONFIG, ...config }
    const preset = fullConfig.preset || detectPresetFromPrompt(basePrompt)
    const enhancedBase = enhancePromptWithPreset(basePrompt, preset)
    const negativePrompt = buildPresetNegativePrompt(preset)

    abortRef.current = false
    setIsRunning(true)

    const items: BatchItem[] = Array.from({ length: fullConfig.count }, (_, i) => {
      const prompt = i === 0
        ? enhancedBase
        : createVariation(enhancedBase, i, fullConfig.variationStrength)

      return {
        id: `batch_${Date.now()}_${i}`,
        prompt,
        enhancedPrompt: prompt,
        negativePrompt,
        status: 'pending' as const,
        progress: 0,
        seed: fullConfig.baseSeed ? fullConfig.baseSeed + i : undefined,
      }
    })

    setBatch(items)
    setOverallProgress(0)

    const results = await Promise.allSettled(
      items.map(async (item, index) => {
void index;
        if (abortRef.current) return

        setBatch((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: 'running', progress: 10 } : p))
        )

        const startTime = Date.now()

        try {
          setBatch((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, progress: 30 } : p))
          )

          const response = await generateImage.mutateAsync({
            prompt: item.prompt,
            negative_prompt: item.negativePrompt,
            model: fullConfig.model,
            steps: fullConfig.steps,
            cfg_scale: fullConfig.cfg,
            resolution: fullConfig.resolution,
            aspect_ratio: fullConfig.aspectRatio,
            seed: item.seed,
            hide_watermark: true,
            safe_mode: false,
          })

          const first = response.images[0]
          const result = typeof first === 'string' ? first : first?.b64_json
          if (!result) throw new Error('Provider returned no image')
          setBatch((prev) =>
            prev.map((p) =>
              p.id === item.id
                ? { ...p, status: 'completed', progress: 100, imageUrl: result }
                : p
            )
          )

          const duration = Date.now() - startTime
          const tags = classifyContent(item.prompt)

          trackGeneration({
            model: fullConfig.model,
            provider: 'venice',
            promptLength: item.prompt.length,
            explicitLevel: tags.explicitLevel,
            contentType: tags.contentType,
            duration,
            success: true,
          })

          if (result) {
            addContentItem({
              imageUrl: result,
              prompt: basePrompt,
              enhancedPrompt: item.prompt,
              model: fullConfig.model,
              provider: 'venice',
              metadata: {
                steps: fullConfig.steps,
                cfg: fullConfig.cfg,
                resolution: fullConfig.resolution,
                seed: item.seed,
              },
            })
          }
        } catch (error) {
          setBatch((prev) =>
            prev.map((p) =>
              p.id === item.id
                ? { ...p, status: 'failed', error: error instanceof Error ? error.message : 'Failed' }
                : p
            )
          )

          trackGeneration({
            model: fullConfig.model,
            provider: 'venice',
            promptLength: item.prompt.length,
            duration: Date.now() - startTime,
            success: false,
          })
        }

        const completed = batch.filter((b) => b.status === 'completed' || b.status === 'failed').length + 1
        setOverallProgress(Math.round((completed / fullConfig.count) * 100))
      })
    )

    setIsRunning(false)
    return results
  }, [generateImage, createVariation, trackGeneration, addContentItem, batch])

  const cancelBatch = useCallback(() => {
    abortRef.current = true
    setIsRunning(false)
  }, [])

  const retryFailed = useCallback(async () => {
    const failedItems = batch.filter((item) => item.status === 'failed')
    if (failedItems.length === 0) return

    setBatch((prev) =>
      prev.map((item) =>
        item.status === 'failed' ? { ...item, status: 'pending', error: undefined, progress: 0 } : item
      )
    )

    setIsRunning(true)

    for (const item of failedItems) {
      if (abortRef.current) break

      setBatch((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: 'running', progress: 10 } : p))
      )

      try {
        const response = await generateImage.mutateAsync({
          prompt: item.prompt,
          negative_prompt: item.negativePrompt,
          model: 'lustify-v8',
          steps: 28,
          cfg_scale: 8,
          resolution: '1024x1024',
          aspect_ratio: '3:4',
          seed: item.seed,
          hide_watermark: true,
          safe_mode: false,
        })

        const first = response.images[0]
        const result = typeof first === 'string' ? first : first?.b64_json
        if (!result) throw new Error('Provider returned no image')
        setBatch((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? { ...p, status: 'completed', progress: 100, imageUrl: result }
              : p
          )
        )
      } catch (error) {
        setBatch((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? { ...p, status: 'failed', error: error instanceof Error ? error.message : 'Failed' }
              : p
          )
        )
      }
    }

    setIsRunning(false)
  }, [batch, generateImage])

  const completedCount = batch.filter((item) => item.status === 'completed').length
  const failedCount = batch.filter((item) => item.status === 'failed').length
  const runningCount = batch.filter((item) => item.status === 'running').length

  return {
    batch,
    isRunning,
    overallProgress,
    completedCount,
    failedCount,
    runningCount,
    startBatch,
    cancelBatch,
    retryFailed,
  }
}
