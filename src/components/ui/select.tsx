import { useState, useRef, useEffect, useMemo, useId } from 'react'
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
  const [activeIndex, setActiveIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const filtered = useMemo(() => {
    if (!search) return options
    const query = search.trim().toLowerCase()
    return options.filter((option) =>
      option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query),
    )
  }, [options, search])

  const selectedIndex = filtered.findIndex((option) => option.value === value)
  const selectedLabel = options.find((option) => option.value === value)?.label || placeholder
  const hasValue = options.some((option) => option.value === value)

  const close = (restoreFocus = false) => {
    setOpen(false)
    setSearch('')
    setActiveIndex(0)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const openMenu = (direction: 'selected' | 'first' | 'last' = 'selected') => {
    setOpen(true)
    if (direction === 'first') setActiveIndex(0)
    else if (direction === 'last') setActiveIndex(Math.max(0, options.length - 1))
    else {
      const index = options.findIndex((option) => option.value === value)
      setActiveIndex(index >= 0 ? index : 0)
    }
  }

  const choose = (index: number) => {
    const option = filtered[index]
    if (!option) return
    onChange(option.value)
    close(true)
  }

  const moveActive = (delta: number) => {
    if (filtered.length === 0) return
    setActiveIndex((current) => {
      const base = Math.min(current, filtered.length - 1)
      return (base + delta + filtered.length) % filtered.length
    })
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const next = selectedIndex >= 0 ? selectedIndex : 0
    setActiveIndex(Math.min(next, Math.max(0, filtered.length - 1)))
  }, [open, filtered.length, selectedIndex])

  useEffect(() => {
    if (open && searchable) inputRef.current?.focus()
  }, [open, searchable])

  const handleNavigationKey = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) openMenu('first')
      else moveActive(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openMenu('last')
      else moveActive(-1)
      return
    }
    if (open && event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (open && event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(0, filtered.length - 1))
      return
    }
    if (open && event.key === 'Enter') {
      event.preventDefault()
      choose(activeIndex)
    }
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? close(false) : openMenu()}
        onKeyDown={handleNavigationKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          'w-full flex items-center justify-between gap-2 bg-transparent border border-white/[0.06] rounded-md px-2.5 py-1.5 text-[15px] hover:border-white/[0.12] transition-colors outline-none',
          open && 'border-white/[0.15]',
        )}
      >
        <span className={cn('truncate text-[15px]', hasValue ? 'text-white/70' : 'text-white/20')}>{selectedLabel}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          className={cn('shrink-0 text-white/20 transition-transform duration-150', open && 'rotate-180')}>
          <path d="M2.5 3.75L5 6.25L7.5 3.75" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-0.5 bg-[#0e0e0e] border border-white/[0.08] rounded-lg shadow-2xl shadow-black/50 animate-scale-in overflow-hidden">
          {searchable && (
            <div className="p-1 border-b border-white/[0.04]">
              <input
                ref={inputRef}
                value={search}
                onChange={(event) => { setSearch(event.target.value); setActiveIndex(0) }}
                onKeyDown={handleNavigationKey}
                placeholder="Search..."
                aria-label="Search options"
                aria-controls={listboxId}
                aria-activedescendant={filtered[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
                className="w-full bg-white/[0.03] rounded px-2 py-1 text-[15px] text-white/70 outline-none placeholder:text-white/20"
              />
            </div>
          )}
          <div id={listboxId} role="listbox" aria-label="Options" className="max-h-60 overflow-y-auto p-0.5">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-2.5 text-[14px] text-white/25 text-center">No results</div>
            ) : (
              filtered.map((option, index) => (
                <button
                  id={`${listboxId}-${index}`}
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(index)}
                  className={cn(
                    'w-full text-left px-3 py-[6px] text-[15px] rounded transition-colors',
                    option.value === value
                      ? 'bg-white/[0.07] text-white/85'
                      : index === activeIndex
                        ? 'bg-white/[0.04] text-white/70'
                        : 'text-white/45 hover:bg-white/[0.04] hover:text-white/70',
                  )}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
