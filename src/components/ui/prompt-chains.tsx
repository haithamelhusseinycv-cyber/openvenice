import { useState, useCallback } from 'react';
import { haptic } from '../../lib/haptics';
import { venice } from '../../lib/venice-client';
import { useAuthStore } from '../../stores/auth-store';
import { cn } from '../../lib/utils';
import type { ImageGenerateResponse } from '../../types/venice';

type ChainStepType = 'generate' | 'upscale' | 'face-fix' | 'watermark'

interface ChainStep {
  id: string
  type: ChainStepType
  label: string
  params?: Record<string, unknown>
}

interface PromptChain {
  id: string
  name: string
  steps: ChainStep[]
}

const DEFAULT_CHAINS: PromptChain[] = [
  {
    id: 'portrait-pipeline',
    name: 'Portrait Pipeline',
    steps: [
      { id: 'pp-1', type: 'generate', label: 'Generate' },
      { id: 'pp-2', type: 'upscale', label: 'Upscale' },
      { id: 'pp-3', type: 'face-fix', label: 'Face Fix' },
    ],
  },
  {
    id: 'quick-share',
    name: 'Quick Share',
    steps: [
      { id: 'qs-1', type: 'generate', label: 'Generate' },
      { id: 'qs-2', type: 'watermark', label: 'Watermark' },
    ],
  },
]

const STEP_ICONS: Record<ChainStepType, string> = {
  generate: 'M12 5v14M5 12h14',
  upscale: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  'face-fix': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  watermark: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
}

function toImageSrc(b64: string): string {
  if (b64.startsWith('data:')) return b64
  if (b64.startsWith('/9j/')) return `data:image/jpeg;base64,${b64}`
  if (b64.startsWith('iVBOR')) return `data:image/png;base64,${b64}`
  if (b64.startsWith('UklGR')) return `data:image/webp;base64,${b64}`
  return `data:image/png;base64,${b64}`
}

interface PromptChainBuilderProps {
  prompt: string
  negativePrompt?: string
  model: string
  aspectRatio: string
  steps: number
  seed?: number
  onChainComplete?: (images: string[]) => void
}

export function PromptChainBuilder({
  prompt,
  negativePrompt,
  model,
  aspectRatio,
  steps,
  seed,
  onChainComplete,
}: PromptChainBuilderProps) {
  const apiKey = useAuthStore((s) => s.apiKey)
  const [selectedChain, setSelectedChain] = useState<PromptChain>(DEFAULT_CHAINS[0])
  const [customChains, setCustomChains] = useState<PromptChain[]>([])
  const [executing, setExecuting] = useState(false)
  const [currentStepIdx, setCurrentStepIdx] = useState(-1)
  const [, setStepResults] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [chainName, setChainName] = useState('')

  const allChains = [...DEFAULT_CHAINS, ...customChains]

  const addStep = (type: ChainStepType) => {
    haptic('tap')
    const newStep: ChainStep = {
      id: `step-${Date.now()}`,
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
    }
    setSelectedChain((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }))
  }

  const removeStep = (stepId: string) => {
    haptic('tap')
    setSelectedChain((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
    }))
  }

  const saveCustomChain = () => {
    if (!chainName.trim()) return
    haptic('success')
    const newChain: PromptChain = {
      id: `custom-${Date.now()}`,
      name: chainName.trim(),
      steps: [...selectedChain.steps],
    }
    setCustomChains((prev) => [...prev, newChain])
    setEditingName(false)
    setChainName('')
  }

  const executeStep = useCallback(
    async (step: ChainStep, inputImages: string[]): Promise<string[]> => {
      if (!apiKey) throw new Error('No API key')

      switch (step.type) {
        case 'generate': {
          const data = await venice<ImageGenerateResponse>('/image/generate', {
            method: 'POST',
            body: JSON.stringify({
              prompt,
              negative_prompt: negativePrompt,
              model,
              aspect_ratio: aspectRatio,
              seed: seed ?? undefined,
              steps,
              variants: 1,
              safe_mode: false,
              hide_watermark: true,
              format: 'jpeg',
              enhance_prompt: false,
            }),
          })
          return data.images.map((img) => {
            const b64 = typeof img === 'string' ? img : img.b64_json
            return toImageSrc(b64)
          })
        }
        case 'upscale': {
          if (inputImages.length === 0) return []
          const data = await venice<ImageGenerateResponse>('/image/generate', {
            method: 'POST',
            body: JSON.stringify({
              prompt: prompt + ', high resolution, detailed, sharp',
              model,
              aspect_ratio: aspectRatio,
              steps: Math.min(steps + 10, 50),
              variants: 1,
              safe_mode: false,
              hide_watermark: true,
              format: 'jpeg',
              enhance_prompt: false,
            }),
          })
          return data.images.map((img) => {
            const b64 = typeof img === 'string' ? img : img.b64_json
            return toImageSrc(b64)
          })
        }
        case 'face-fix': {
          if (inputImages.length === 0) return []
          const data = await venice<ImageGenerateResponse>('/image/generate', {
            method: 'POST',
            body: JSON.stringify({
              prompt: prompt + ', detailed face, sharp eyes, natural skin',
              negative_prompt: negativePrompt ?? 'blurry face, distorted',
              model,
              aspect_ratio: aspectRatio,
              steps,
              variants: 1,
              safe_mode: false,
              hide_watermark: true,
              format: 'jpeg',
              enhance_prompt: false,
            }),
          })
          return data.images.map((img) => {
            const b64 = typeof img === 'string' ? img : img.b64_json
            return toImageSrc(b64)
          })
        }
        case 'watermark': {
          return inputImages
        }
        default:
          return inputImages
      }
    },
    [apiKey, prompt, negativePrompt, model, aspectRatio, steps, seed],
  )

  const executeChain = async () => {
    if (!prompt.trim() || !apiKey || executing || selectedChain.steps.length === 0) return

    haptic('heavy')
    setExecuting(true)
    setError(null)
    setStepResults({})
    setCurrentStepIdx(-1)

    try {
      let currentImages: string[] = []

      for (let i = 0; i < selectedChain.steps.length; i++) {
        setCurrentStepIdx(i)
        const step = selectedChain.steps[i]
        currentImages = await executeStep(step, currentImages)
        setStepResults((prev) => ({ ...prev, [step.id]: currentImages }))
      }

      onChainComplete?.(currentImages)
      haptic('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chain execution failed')
      haptic('error')
    } finally {
      setExecuting(false)
      setCurrentStepIdx(-1)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-[#c6beb5] uppercase tracking-[0.06em]">
            Pipeline
          </span>
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={chainName}
                onChange={(e) => setChainName(e.target.value)}
                placeholder="Chain name"
                className="bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1 text-[13px] text-white outline-none focus:border-white/[0.25] placeholder:text-white/35 w-32 min-h-8"
              />
              <button
                type="button"
                onClick={saveCustomChain}
                className="text-[12px] text-emerald-300 hover:text-emerald-200 px-1"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="text-[12px] text-white/40 hover:text-white/60 px-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { haptic('tap'); setEditingName(true) }}
              className="text-[12px] text-white/50 hover:text-white/70"
            >
              Save as...
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {allChains.map((chain) => (
            <button
              key={chain.id}
              type="button"
              onClick={() => { haptic('select'); setSelectedChain(chain) }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors min-h-8',
                selectedChain.id === chain.id
                  ? 'bg-white/15 text-white'
                  : 'bg-white/[0.04] text-white/50 hover:text-white/70 hover:bg-white/[0.08]',
              )}
            >
              {chain.name}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {selectedChain.steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] px-2.5 py-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50">
                  <path d={STEP_ICONS[step.type]} />
                </svg>
                <span className={cn(
                  'text-[12px] font-medium',
                  executing && idx === currentStepIdx ? 'text-emerald-300' : 'text-white/70',
                )}>
                  {step.label}
                </span>
                {!executing && (
                  <button
                    type="button"
                    onClick={() => removeStep(step.id)}
                    className="text-white/30 hover:text-red-300/70 ml-0.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              {idx < selectedChain.steps.length - 1 && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(['generate', 'upscale', 'face-fix', 'watermark'] as ChainStepType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => addStep(type)}
              disabled={executing}
              className="rounded-md border border-dashed border-white/[0.12] px-2 py-1 text-[11px] text-white/40 hover:text-white/60 hover:border-white/[0.2] transition-colors disabled:opacity-30 min-h-7"
            >
              + {type}
            </button>
          ))}
        </div>
      </div>

      {executing && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-white/70">
              Step {currentStepIdx + 1} / {selectedChain.steps.length}: {selectedChain.steps[currentStepIdx]?.label}
            </span>
            <div className="h-3 w-3 rounded-full border-2 border-emerald-400/60 border-t-transparent animate-spin" />
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-all duration-500"
              style={{ width: `${((currentStepIdx + 1) / selectedChain.steps.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-[13px] text-red-300/95 rounded-lg bg-red-500/[0.06] border border-red-500/10 px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={executeChain}
        disabled={!prompt.trim() || !apiKey || executing || selectedChain.steps.length === 0}
        className={cn(
          'w-full rounded-xl font-semibold py-3 text-[16px] min-h-12 transition-colors',
          !executing && prompt.trim() && apiKey
            ? 'btn-premium text-black font-bold'
            : 'bg-white/[0.06] text-white/30 cursor-not-allowed',
        )}
      >
        {executing ? 'Running Pipeline...' : `Run ${selectedChain.name}`}
      </button>
    </div>
  )
}

interface ChainExecutorState {
  executing: boolean
  currentStep: number
  totalSteps: number
  results: string[]
  error: string | null
}

export function useChainExecutor() {
  const [state, setState] = useState<ChainExecutorState>({
    executing: false,
    currentStep: 0,
    totalSteps: 0,
    results: [],
    error: null,
  })

  const reset = () => {
    setState({ executing: false, currentStep: 0, totalSteps: 0, results: [], error: null })
  }

  return { ...state, reset, setState }
}
