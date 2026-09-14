import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  ariaLabel?: string
}

/** Sliding-indicator segmented control used for compact mode switches. */
export function SegmentedControl<T extends string>({ options, value, onChange, className, ariaLabel }: SegmentedControlProps<T>) {
  const index = Math.max(0, options.findIndex((option) => option.value === value))

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('relative grid rounded-xl border border-white/[0.08] bg-white/[0.03] p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-white/[0.11] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-transform duration-200 ease-out"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 flex min-h-9 items-center justify-center rounded-lg px-2 text-[13px] font-medium transition-colors duration-150',
              active ? 'text-white' : 'text-white/50 hover:text-white/80',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
