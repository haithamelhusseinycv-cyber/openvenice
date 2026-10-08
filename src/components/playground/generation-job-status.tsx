import { useGenerationJob } from '../../hooks/use-generation-job'
import { generationExecutor } from '../../services/generation-executor'
import { cn } from '../../lib/utils'

/**
 * Displays the current generation job status with progress bar,
 * provider info, and completion state.
 */
export function GenerationJobStatus() {
  const job = useGenerationJob()

  if (!job) return null

  const isRunning = ['queued', 'routing', 'starting', 'running'].includes(job.status)
  const isCompleted = job.status === 'completed'
  const isFailed = job.status === 'failed'

  return (
    <div aria-busy={isRunning} className="animate-fade-in rounded-2xl border border-white/[0.08] bg-[#111114] p-4">
      <div className="flex items-center gap-3">
        {/* Status icon */}
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl',
          isRunning && 'bg-[var(--color-accent)]/10',
          isCompleted && 'bg-green-500/10',
          isFailed && 'bg-red-500/10',
        )}>
          {isRunning && (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)]" aria-hidden="true" />
          )}
          {isCompleted && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(34 197 94)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {isFailed && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(239 68 68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        {/* Status text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-white/90">
              {job.provider === 'venice' && 'Venice API'}
              {job.provider === 'local-dream' && 'Local Dream'}
              {job.provider === 'atelier' && 'Atelier GPU'}
            </span>
            <span className="text-[11px] text-white/40">
              {job.status === 'queued' && 'Queued'}
              {job.status === 'routing' && 'Routing'}
              {job.status === 'starting' && 'Starting'}
              {job.status === 'running' && 'Generating'}
              {job.status === 'completed' && 'Complete'}
              {job.status === 'failed' && 'Failed'}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-white/50 truncate">{job.message}</p>
        </div>

        {/* Progress percentage */}
        {isRunning && (
          <span className="text-[13px] font-medium text-[var(--color-accent)]">
            {job.progress}%
          </span>
        )}

        {/* Close button for completed/failed */}
        {(isCompleted || isFailed) && (
          <button
            onClick={() => generationExecutor.clearJob()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/60"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"
          role="progressbar"
          aria-valuenow={job.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Generation progress: ${job.progress}%`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)]/80 transition-all duration-300"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}

      {/* Error message */}
      {isFailed && job.error && (
        <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-400" role="alert">
          {job.error}
        </div>
      )}

      {/* Completed image */}
      {isCompleted && job.imageUrl && (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08]">
          <img
            src={job.imageUrl}
            alt={job.prompt ? `Generated: ${job.prompt.slice(0, 80)}` : 'Generated image'}
            className="w-full object-cover"
          />
        </div>
      )}
    </div>
  )
}
