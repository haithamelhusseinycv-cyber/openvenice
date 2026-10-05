import { useEffect, useState } from 'react'
import { LocalDreamCloudConnector, type CloudJob } from '../../connectors/localdream/cloud-connector'

interface CloudJobStatusProps {
  job: CloudJob
  onJobUpdate?: (job: CloudJob) => void
}

const terminal = new Set(['complete', 'needs_review', 'needs_input', 'failed', 'cancelled'])

const stateColors: Record<string, string> = {
  queued: 'text-white/50',
  planning: 'text-blue-300',
  processing: 'text-[var(--color-accent)]',
  reviewing: 'text-amber-300',
  complete: 'text-emerald-300',
  needs_review: 'text-amber-300',
  needs_input: 'text-orange-300',
  failed: 'text-rose-300',
  cancelled: 'text-white/40',
}

const stateLabels: Record<string, string> = {
  queued: 'In queue',
  planning: 'Planning workflow',
  processing: 'Generating on GPU',
  reviewing: 'Quality review',
  complete: 'Complete',
  needs_review: 'Needs review',
  needs_input: 'Needs input',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function CloudJobStatus({ job, onJobUpdate }: CloudJobStatusProps) {
  const client = useState(() => new LocalDreamCloudConnector(localStorage))[0]
  const [currentJob, setCurrentJob] = useState(job)
  const isTerminal = terminal.has(currentJob.state)

  useEffect(() => {
    if (isTerminal) return
    const controller = new AbortController()
    const poll = async () => {
      try {
        const updated = await client.reconnect(controller.signal)
        setCurrentJob(updated)
        onJobUpdate?.(updated)
      } catch {
        // Silently retry on next interval
      }
    }
    const timer = window.setInterval(() => { void poll() }, 3000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [isTerminal, client, onJobUpdate])

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111114] p-4">
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${!isTerminal ? 'animate-pulse-dot bg-[var(--color-accent)]' : 'bg-white/20'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[13px] font-medium ${stateColors[currentJob.state] ?? 'text-white/70'}`}>
              {stateLabels[currentJob.state] ?? currentJob.state}
            </span>
            {currentJob.estimated_cost_usd !== undefined && (
              <span className="text-[11px] text-white/30">
                ~${currentJob.estimated_cost_usd.toFixed(3)}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-white/50">{currentJob.message}</p>
        </div>
      </div>

      {!isTerminal && (
        <div className="mt-3">
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-[var(--color-accent)]/60 transition-all duration-1000"
              style={{
                width: currentJob.state === 'queued' ? '10%'
                  : currentJob.state === 'planning' ? '30%'
                  : currentJob.state === 'processing' ? '70%'
                  : '90%',
                animation: 'progress-indeterminate 1.25s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      )}

      {currentJob.review?.issues && currentJob.review.issues.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          {currentJob.review.issues.map((issue, i) => (
            <p key={i} className="text-[12px] text-amber-200/80">{issue}</p>
          ))}
        </div>
      )}

      {currentJob.state === 'complete' && currentJob.images.length > 0 && (
        <div className="mt-3 flex gap-2">
          {currentJob.images.map((img, i) => (
            <div key={i} className="h-16 w-16 overflow-hidden rounded-lg border border-white/10 bg-white/5">
              <img
                src={`${client.base}/api/images/${img.filename}`}
                alt="Generated result"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
