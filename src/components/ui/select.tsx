import { useState, useRef, useEffect, useMemo } from 'react'
import { cn } from '../../lib/utils'

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  searchable?: boolean
  className?: string
}

export function Select({ value, onChange, options, placeholder = 'Select...', searchable = false, className }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && searchable) inputRef.current?.focus()
  }, [open, searchable])

  const filtered = useMemo(() =>
    search ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())) : options,
    [options, search],
  )

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => { const next = !open; setOpen(next); if (!next) setSearch('') }}
        className={cn(
          'w-full flex items-center justify-between gap-2 bg-transparent border border-white/[0.12] rounded-md px-3 py-2 text-[16px] min-h-11 hover:border-white/[0.22] transition-colors outline-none',
          open && 'border-white/[0.25]',
        )}
      >
        <span className={cn('truncate text-[15px] sm:text-[16px]', value ? 'text-white' : 'text-white/40')}>{selectedLabel}</span>
        <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          className={cn('shrink-0 text-white/50 transition-transform duration-150', open && 'rotate-180')}>
          <path d="M2.5 3.75L5 6.25L7.5 3.75" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-0.5 w-full min-w-[min(12rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-white/[0.12] bg-[#0e0e0e] shadow-2xl shadow-black/50 animate-scale-in">
          {searchable && (
            <div className="p-1 border-b border-white/[0.06]">
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full bg-white/[0.03] rounded px-2 py-2 text-[16px] text-white outline-none placeholder:text-white/30 min-h-11"
              />
            </div>
          )}
          <div className="max-h-60 overflow-y-auto p-0.5">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-[15px] text-white/40 text-center">No results</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className={cn(
                    'w-full text-left px-3 py-3 text-[16px] rounded transition-colors min-h-11',
                    o.value === value
                      ? 'bg-white/[0.1] text-white'
                      : 'text-white/70 hover:bg-white/[0.05] hover:text-white',
                  )}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
