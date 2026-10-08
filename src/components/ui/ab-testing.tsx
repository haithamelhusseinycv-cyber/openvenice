import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { venice } from '../../lib/venice-client';
import { useAuthStore } from '../../stores/auth-store';
import { cn } from '../../lib/utils';
import type { ImageGenerateResponse } from '../../types/venice';

function toImageSrc(b64: string): string {
  if (b64.startsWith('data:')) return b64
  if (b64.startsWith('/9j/')) return `data:image/jpeg;base64,${b64}`
  if (b64.startsWith('iVBOR')) return `data:image/png;base64,${b64}`
  if (b64.startsWith('UklGR')) return `data:image/webp;base64,${b64}`
  return `data:image/png;base64,${b64}`
}



interface ABTestPanelProps {
  prompt: string
  negativePrompt?: string
  aspectRatio: string
  configA: { model: string; steps: number; seed?: number; label?: string }
  configB: { model: string; steps: number; seed?: number; label?: string }
  onResultsReady?: (results: { a: string[]; b: string[] }) => void
}

export function ABTestPanel({
  prompt,
  negativePrompt,
  aspectRatio,
  configA,
  configB,
  onResultsReady,
}: ABTestPanelProps) {
  const apiKey = useAuthStore((s) => s.apiKey)
  const [generating, setGenerating] = useState(false)
  const [resultA, setResultA] = useState<string | null>(null)
  const [resultB, setResultB] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<'idle' | 'a' | 'b' | 'done'>('idle')

  const generateSide = async (
    config: { model: string; steps: number; seed?: number },
  ): Promise<string | null> => {
    if (!apiKey) throw new Error('No API key')

    const data = await venice<ImageGenerateResponse>('/image/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        model: config.model,
        aspect_ratio: aspectRatio,
        seed: config.seed ?? undefined,
        steps: config.steps,
        variants: 1,
        safe_mode: false,
        hide_watermark: true,
        format: 'jpeg',
        enhance_prompt: false,
      }),
    })

    if (data.images?.[0]) {
      const b64 = typeof data.images[0] === 'string' ? data.images[0] : data.images[0].b64_json
      return toImageSrc(b64)
    }
    return null
  }

  const runTest = async () => {
    if (!prompt.trim() || !apiKey || generating) return

    haptic('heavy')
    setGenerating(true)
    setError(null)
    setResultA(null)
    setResultB(null)
    setProgress('a')

    try {
      const imgA = await generateSide(configA)
      setResultA(imgA)

      setProgress('b')
      const imgB = await generateSide(configB)
      setResultB(imgB)

      setProgress('done')
      haptic('success')

      if (imgA && imgB) {
        onResultsReady?.({ a: [imgA], b: [imgB] })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A/B test failed')
      haptic('error')
    } finally {
      setGenerating(false)
    }
  }

  const labelA = configA.label || 'A'
  const labelB = configB.label || 'B'

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[13px] font-semibold text-[#c6beb5] uppercase tracking-[0.06em]">
        A/B Test
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Side A config */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/30 text-[11px] font-bold text-blue-300">
              A
            </span>
            <span className="text-[12px] font-medium text-blue-200/80">{labelA}</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-white/50">
            <div>Model: <span className="text-white/70">{configA.model.split('-').slice(0, 2).join('-')}</span></div>
            <div>Steps: <span className="text-white/70">{configA.steps}</span></div>
            <div>Seed: <span className="text-white/70">{configA.seed ?? 'random'}</span></div>
          </div>
        </div>

        {/* Side B config */}
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/30 text-[11px] font-bold text-purple-300">
              B
            </span>
            <span className="text-[12px] font-medium text-purple-200/80">{labelB}</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-white/50">
            <div>Model: <span className="text-white/70">{configB.model.split('-').slice(0, 2).join('-')}</span></div>
            <div>Steps: <span className="text-white/70">{configB.steps}</span></div>
            <div>Seed: <span className="text-white/70">{configB.seed ?? 'random'}</span></div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
            <span className="text-[11px] font-medium text-blue-300/80">Side A</span>
            {progress === 'a' && generating && (
              <div className="h-2.5 w-2.5 rounded-full border-2 border-blue-400/60 border-t-transparent animate-spin" />
            )}
          </div>
          <div className="aspect-square flex items-center justify-center bg-black/20">
            {resultA ? (
              <img src={resultA} alt="Side A result" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[12px] text-white/20">
                {generating && progress === 'a' ? 'Generating...' : 'Waiting'}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
            <span className="text-[11px] font-medium text-purple-300/80">Side B</span>
            {progress === 'b' && generating && (
              <div className="h-2.5 w-2.5 rounded-full border-2 border-purple-400/60 border-t-transparent animate-spin" />
            )}
          </div>
          <div className="aspect-square flex items-center justify-center bg-black/20">
            {resultB ? (
              <img src={resultB} alt="Side B result" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[12px] text-white/20">
                {generating && progress === 'b' ? 'Generating...' : 'Waiting'}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[13px] text-red-300/95 rounded-lg bg-red-500/[0.06] border border-red-500/10 px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={runTest}
        disabled={!prompt.trim() || !apiKey || generating}
        className={cn(
          'w-full rounded-xl font-semibold py-3 text-[16px] min-h-12 transition-colors',
          !generating && prompt.trim() && apiKey
            ? 'btn-premium text-black font-bold'
            : 'bg-white/[0.06] text-white/30 cursor-not-allowed',
        )}
      >
        {generating ? 'Running A/B Test...' : 'Run A/B Test'}
      </button>
    </div>
  )
}
