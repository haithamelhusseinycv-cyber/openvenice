import { useState } from 'react'
import { venice } from '../../lib/venice-client'
import { useAuthStore } from '../../stores/auth-store'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'
import type { ImageGenerateResponse } from '../../types/venice'

interface SmartVariationsProps {
  prompt: string
  negativePrompt?: string
  aspectRatio: string
  model: string
  onComplete: (images: string[]) => void
}

function toImageSrc(b64: string): string {
  if (b64.startsWith('data:')) return b64
  if (b64.startsWith('/9j/')) return `data:image/jpeg;base64,${b64}`
  if (b64.startsWith('iVBOR')) return `data:image/png;base64,${b64}`
  if (b64.startsWith('UklGR')) return `data:image/webp;base64,${b64}`
  return `data:image/png;base64,${b64}`
}

export function SmartVariations({ prompt, negativePrompt, aspectRatio, model, onComplete }: SmartVariationsProps) {
  const [generating, setGenerating] = useState(false)
  const [variations, setVariations] = useState<string[]>([])
  const apiKey = useAuthStore((s) => s.apiKey)

  const generateVariations = async () => {
    if (!prompt.trim() || !apiKey || generating) return

    haptic('tap')
    setGenerating(true)
    setVariations([])

    try {
      const seeds = Array.from({ length: 4 }, () => Math.floor(Math.random() * 999999999))
      const results: string[] = []

      for (const seed of seeds) {
        try {
          const data = await venice<ImageGenerateResponse>('/image/generate', {
            method: 'POST',
            body: JSON.stringify({
              prompt,
              negative_prompt: negativePrompt,
              model,
              aspect_ratio: aspectRatio,
              seed,
              steps: 20,
              variants: 1,
              safe_mode: false,
              hide_watermark: true,
              format: 'jpeg',
              enhance_prompt: false,
            }),
          })
          if (data.images?.[0]) {
            const b64 = typeof data.images[0] === 'string' ? data.images[0] : data.images[0].b64_json
            results.push(toImageSrc(b64))
          }
        } catch {
          // skip failed variation
        }
      }

      if (results.length > 0) {
        haptic('success')
        setVariations(results)
        onComplete(results)
      }
    } catch (error) {
      console.error('Variation generation failed:', error)
      haptic('error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={generateVariations}
        disabled={generating || !prompt.trim() || !apiKey}
        className={cn(
          'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-medium transition-all min-h-12',
          generating
            ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] cursor-wait'
            : !prompt.trim() || !apiKey
              ? 'bg-white/[0.03] text-white/30 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white hover:from-purple-500/30 hover:to-pink-500/30 active:scale-95'
        )}
      >
        {generating ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span>Generating 4 variations…</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            <span>Generate 4 Variations</span>
          </>
        )}
      </button>

      {variations.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {variations.map((src, index) => (
            <div key={index} className="aspect-square rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.08]">
              <img src={src} alt={`Variation ${index + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
