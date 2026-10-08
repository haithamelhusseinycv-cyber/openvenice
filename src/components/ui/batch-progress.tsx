import { useBatchGeneration, type BatchItem } from '../../hooks/use-batch-generation'
import { haptic } from '../../lib/haptics'

export function BatchProgress() {
  const { batch, isRunning, overallProgress, completedCount, failedCount, runningCount, cancelBatch, retryFailed } = useBatchGeneration()

  if (batch.length === 0) return null

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-white/80">
            Batch {completedCount}/{batch.length}
          </span>
          {failedCount > 0 && (
            <span className="text-[11px] text-red-400">{failedCount} failed</span>
          )}
          {runningCount > 0 && (
            <span className="text-[11px] text-white/40">{runningCount} running</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {failedCount > 0 && !isRunning && (
            <button
              onClick={() => { haptic('tap'); retryFailed() }}
              className="rounded-md bg-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/70 hover:bg-white/[0.12] hover:text-white"
            >
              Retry
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => { haptic('tap'); cancelBatch() }}
              className="rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-9">
        {batch.map((item) => (
          <BatchThumbnail key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

function BatchThumbnail({ item }: { item: BatchItem }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-white/[0.04] border-white/[0.06]',
    running: 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30',
    completed: 'bg-emerald-500/10 border-emerald-500/30',
    failed: 'bg-red-500/10 border-red-500/30',
  }

  return (
    <div className={`relative aspect-square overflow-hidden rounded-md border ${statusColors[item.status]}`}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : item.status === 'running' ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : item.status === 'failed' ? (
        <div className="flex h-full w-full items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-white/20" />
        </div>
      )}
    </div>
  )
}
