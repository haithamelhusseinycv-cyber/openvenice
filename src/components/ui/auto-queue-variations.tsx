import { useState, useEffect, useCallback, useRef } from 'react'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

const STORAGE_KEY = 'chilli-auto-queue-enabled'
const VARIATION_COUNT = 3

interface AutoQueueState {
  enabled: boolean
  setEnabled: (v: boolean) => void
}

export function useAutoQueue(): AutoQueueState {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch {
      // Ignore storage errors
    }
  }, [enabled])

  return { enabled, setEnabled }
}

interface AutoQueueToggleProps {
  enabled: boolean
  onToggle: (v: boolean) => void
}

export function AutoQueueToggle({ enabled, onToggle }: AutoQueueToggleProps) {
  const handleToggle = () => {
    haptic('select')
    onToggle(!enabled)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        'flex min-h-11 w-full items-center justify-between rounded-xl border px-3.5 text-[14px] transition-colors',
        enabled
          ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300'
          : 'border-white/[0.08] bg-white/[0.03] text-white/75 hover:border-white/[0.16] hover:text-white',
      )}
    >
      <span className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <span className="font-medium">Auto-Queue Variations</span>
      </span>
      <span className={cn(
        'flex h-6 w-11 items-center rounded-full p-0.5 transition-colors',
        enabled ? 'bg-emerald-500' : 'bg-white/15',
      )}>
        <span className={cn(
          'h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          enabled ? 'translate-x-5' : 'translate-x-0',
        )} />
      </span>
    </button>
  )
}

interface QueuedVariation {
  seed: number
  prompt: string
  negativePrompt?: string
  model: string
  aspectRatio: string
  steps: number
}

export function buildVariationQueue(params: {
  prompt: string
  negativePrompt?: string
  model: string
  aspectRatio: string
  steps: number
  baseSeed?: number
}): QueuedVariation[] {
  const baseSeed = params.baseSeed ?? Math.floor(Math.random() * 999999999)
  return Array.from({ length: VARIATION_COUNT }, (_, i) => ({
    seed: baseSeed + i + 1,
    prompt: params.prompt,
    negativePrompt: params.negativePrompt,
    model: params.model,
    aspectRatio: params.aspectRatio,
    steps: params.steps,
  }))
}

interface AutoQueueProcessorProps {
  enabled: boolean
  queue: QueuedVariation[]
  onProcessItem: (item: QueuedVariation) => Promise<void>
  onQueueComplete?: () => void
}

export function useAutoQueueProcessor({ enabled, queue, onProcessItem, onQueueComplete }: AutoQueueProcessorProps) {
  const [processing, setProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const processQueue = useCallback(async () => {
    if (!enabled || queue.length === 0 || processing) return

    cancelledRef.current = false
    setProcessing(true)
    setError(null)
    setCurrentIndex(0)

    for (let i = 0; i < queue.length; i++) {
      if (cancelledRef.current) break
      setCurrentIndex(i)
      try {
        await onProcessItem(queue[i])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Variation failed')
        break
      }
    }

    if (!cancelledRef.current) {
      onQueueComplete?.()
      haptic('success')
    }

    setProcessing(false)
    setCurrentIndex(0)
  }, [enabled, queue, processing, onProcessItem, onQueueComplete])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    setProcessing(false)
    setCurrentIndex(0)
  }, [])

  return { processing, currentIndex, error, processQueue, cancel }
}

interface AutoQueueStatusProps {
  processing: boolean
  currentIndex: number
  total: number
  onCancel: () => void
}

export function AutoQueueStatus({ processing, currentIndex, total, onCancel }: AutoQueueStatusProps) {
  if (!processing) return null

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-white/70">
          Auto-queue: {currentIndex + 1} / {total}
        </span>
        <button
          type="button"
          onClick={() => { haptic('tap'); onCancel() }}
          className="text-[12px] text-red-300/80 hover:text-red-300"
        >
          Cancel
        </button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-emerald-500/70 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  )
}
