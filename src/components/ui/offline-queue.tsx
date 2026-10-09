import { useState, useEffect, useCallback, useRef } from 'react'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface QueuedGeneration {
  id: string
  prompt: string
  negativePrompt?: string
  model: string
  steps: number
  seed?: number
  aspectRatio: string
  addedAt: number
  status: 'pending' | 'processing' | 'done' | 'failed'
  error?: string
  request?: Record<string, unknown>
}

const QUEUE_KEY = 'chilli-offline-queue'

function loadQueue(): QueuedGeneration[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (raw) { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.prompt === 'string').map(item => item.status === 'processing' ? { ...item, status: 'failed', error: 'Interrupted. Check generation history before retrying.' } : item) : [] }
  } catch { /* ignore */ }
  return []
}

function saveQueue(queue: QueuedGeneration[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch { /* ignore */ }
}

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [queue, setQueue] = useState<QueuedGeneration[]>(() => loadQueue())
  const [processing, setProcessing] = useState(false)
  const processingRef = useRef(false)
  const [processorReady, setProcessorReady] = useState(false)
  const processRef = useRef<((item: QueuedGeneration) => Promise<void>) | null>(null)

  useEffect(() => {
    const handleOnline = () => {
      haptic('success')
      setIsOnline(true)
    }
    const handleOffline = () => {
      haptic('warn')
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    saveQueue(queue)
  }, [queue])

  const setProcessor = useCallback((processor: (item: QueuedGeneration) => Promise<void>) => {
    processRef.current = processor
    setProcessorReady(true)
  }, [])

  const addToQueue = useCallback((item: Omit<QueuedGeneration, 'id' | 'addedAt' | 'status'>) => {
    haptic('tap')
    const queued: QueuedGeneration = {
      ...item,
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      addedAt: Date.now(),
      status: 'pending',
    }
    setQueue((prev) => {
      const updated = [...prev, queued]
      saveQueue(updated)
      return updated
    })


    return queued.id
  }, [])

  const processQueue = useCallback(async () => {
    if (processingRef.current || !isOnline || !processRef.current) return
    processingRef.current = true

    setProcessing(true)
    const pending = queue.filter((q) => q.status === 'pending')

    for (const item of pending) {
      setQueue((prev) => {
        const updated = prev.map((q) =>
          q.id === item.id ? { ...q, status: 'processing' as const } : q
        )
        saveQueue(updated)
        return updated
      })

      try {
        await processRef.current!(item)
        setQueue((prev) => {
          const updated = prev.map((q) =>
            q.id === item.id ? { ...q, status: 'done' as const } : q
          )
          saveQueue(updated)
          return updated
        })
      } catch (err) {
        setQueue((prev) => {
          const updated = prev.map((q) =>
            q.id === item.id ? {
              ...q,
              status: 'failed' as const,
              error: err instanceof Error ? err.message : 'Failed',
            } : q
          )
          saveQueue(updated)
          return updated
        })
      }
    }

    processingRef.current = false
    setProcessing(false)
  }, [isOnline, queue])

  useEffect(() => {
    if (processorReady && isOnline && !processing && queue.some(item => item.status === 'pending')) void processQueue()
  }, [processorReady, isOnline, processing, queue, processQueue])

  const removeFromQueue = useCallback((id: string) => {
    haptic('tap')
    setQueue((prev) => {
      const updated = prev.filter((q) => q.id !== id)
      saveQueue(updated)
      return updated
    })
  }, [])

  const clearCompleted = useCallback(() => {
    haptic('tap')
    setQueue((prev) => {
      const updated = prev.filter((q) => q.status !== 'done')
      saveQueue(updated)
      return updated
    })
  }, [])

  const retryFailed = useCallback(() => {
    haptic('tap')
    setQueue((prev) => {
      const updated = prev.map((q) =>
        q.status === 'failed' ? { ...q, status: 'pending' as const, error: undefined } : q
      )
      saveQueue(updated)
      return updated
    })
    if (isOnline) {
      processQueue()
    }
  }, [isOnline, processQueue])

  const pendingCount = queue.filter((q) => q.status === 'pending').length
  const failedCount = queue.filter((q) => q.status === 'failed').length

  return {
    isOnline,
    queue,
    processing,
    pendingCount,
    failedCount,
    addToQueue,
    removeFromQueue,
    clearCompleted,
    retryFailed,
    processQueue,
    setProcessor,
  }
}

interface OfflineQueueIndicatorProps {
  isOnline: boolean
  pendingCount: number
  failedCount: number
  processing: boolean
  onShowQueue: () => void
}

export function OfflineQueueIndicator({
  isOnline,
  pendingCount,
  failedCount,
  processing,
  onShowQueue,
}: OfflineQueueIndicatorProps) {
  const totalActive = pendingCount + failedCount

  if (totalActive === 0 && isOnline) return null

  return (
    <button
      type="button"
      onClick={() => { haptic('tap'); onShowQueue() }}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 min-h-10 transition-colors',
        !isOnline
          ? 'border-red-500/20 bg-red-500/[0.06] text-red-300/80'
          : processing
            ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300/80'
            : failedCount > 0
              ? 'border-amber-500/20 bg-amber-500/[0.06] text-amber-300/80'
              : 'border-white/[0.08] bg-white/[0.03] text-white/60',
      )}
    >
      {!isOnline ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span className="text-[12px] font-medium">Offline</span>
          {pendingCount > 0 && (
            <span className="text-[11px] bg-red-500/20 rounded-full px-1.5 py-0.5">
              {pendingCount} queued
            </span>
          )}
        </>
      ) : processing ? (
        <>
          <div className="h-3 w-3 rounded-full border-2 border-emerald-400/60 border-t-transparent animate-spin" />
          <span className="text-[12px] font-medium">Processing queue...</span>
        </>
      ) : failedCount > 0 ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-[12px] font-medium">{failedCount} failed</span>
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <span className="text-[12px] font-medium">{pendingCount} in queue</span>
        </>
      )}
    </button>
  )
}

interface OfflineQueueListProps {
  queue: QueuedGeneration[]
  onRemove: (id: string) => void
  onRetryFailed: () => void
  onClearCompleted: () => void
}

export function OfflineQueueList({ queue, onRemove, onRetryFailed, onClearCompleted }: OfflineQueueListProps) {
  if (queue.length === 0) {
    return (
      <div className="text-center py-6 text-[13px] text-white/40">
        Queue is empty
      </div>
    )
  }

  const hasFailed = queue.some((q) => q.status === 'failed')
  const hasCompleted = queue.some((q) => q.status === 'done')

  const statusIcon = (status: QueuedGeneration['status']) => {
    switch (status) {
      case 'pending':
        return (
          <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
        )
      case 'processing':
        return (
          <div className="h-2.5 w-2.5 rounded-full border-2 border-emerald-400/60 border-t-transparent animate-spin" />
        )
      case 'done':
        return (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )
      case 'failed':
        return (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-white/40">{queue.length} items</span>
        <div className="flex gap-2">
          {hasFailed && (
            <button
              type="button"
              onClick={onRetryFailed}
              className="text-[11px] text-amber-300/70 hover:text-amber-300"
            >
              Retry failed
            </button>
          )}
          {hasCompleted && (
            <button
              type="button"
              onClick={onClearCompleted}
              className="text-[11px] text-white/40 hover:text-white/60"
            >
              Clear done
            </button>
          )}
        </div>
      </div>

      {queue.map((item) => (
        <div
          key={item.id}
          className={cn(
            'rounded-xl border p-3',
            item.status === 'failed'
              ? 'border-red-500/15 bg-red-500/[0.04]'
              : item.status === 'done'
                ? 'border-emerald-500/10 bg-emerald-500/[0.02]'
                : 'border-white/[0.08] bg-white/[0.03]',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <div className="mt-1 shrink-0">{statusIcon(item.status)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white/60 truncate">{item.prompt}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-white/25">{item.model}</span>
                <span className="text-[10px] text-white/25">{item.steps} steps</span>
              </div>
              {item.error && (
                <p className="text-[10px] text-red-300/70 mt-0.5">{item.error}</p>
              )}
            </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="text-white/20 hover:text-red-300/60 shrink-0"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
