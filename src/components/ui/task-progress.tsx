import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'

interface TaskProgressProps {
  label: string
  detail?: string
  value?: number
  indeterminate?: boolean
  showElapsed?: boolean
  className?: string
}

export function TaskProgress({ label, detail, value, indeterminate, showElapsed, className }: TaskProgressProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!showElapsed) return
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [showElapsed])

  const safeValue = Math.min(100, Math.max(0, value ?? 0))

  return (
    <div className={cn('w-full rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2.5', className)} role="status" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-2 text-[12px]">
        <span className="min-w-0 truncate font-medium text-white/75">{label}</span>
        <span className="shrink-0 text-white/40">
          {showElapsed ? `${elapsed}s` : !indeterminate ? `${Math.round(safeValue)}%` : ''}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        {indeterminate ? (
          <div className="h-full w-2/5 rounded-full bg-[var(--color-accent)] animate-progress-indeterminate" />
        ) : (
          <div className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300 ease-out" style={{ width: `${safeValue}%` }} />
        )}
      </div>
      {detail && <div className="mt-1.5 truncate text-[11px] text-white/40">{detail}</div>}
    </div>
  )
}
