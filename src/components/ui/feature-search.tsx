import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'
import { useFeatureTracker } from './feature-tracker'

export interface FeatureSearchProps {
  features: { id: string; label: string; category: string; keywords: string[] }[]
  onSelect: (featureId: string) => void
  onClose: () => void
}

interface GroupedResult {
  category: string
  items: { id: string; label: string; category: string; keywords: string[] }[]
}

export function FeatureSearch({ features, onSelect, onClose }: FeatureSearchProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { getRecentFeatures } = useFeatureTracker()

  const recentIds = useMemo(() => {
    return getRecentFeatures().map((r) => r.featureId)
  }, [getRecentFeatures])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return features
    return features.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.keywords.some((kw) => kw.toLowerCase().includes(q))
    )
  }, [query, features])

  // When search is empty, show recent features first, then the rest
  const ordered = useMemo(() => {
    if (query.trim()) return filtered
    const recent = filtered.filter((f) => recentIds.includes(f.id))
    const rest = filtered.filter((f) => !recentIds.includes(f.id))
    return [...recent, ...rest]
  }, [filtered, query, recentIds])

  const grouped = useMemo((): GroupedResult[] => {
    const map = new Map<string, GroupedResult['items']>()
    for (const item of ordered) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
  }, [ordered])

  // Flat list for keyboard navigation indexing
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])


  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
        e.preventDefault()
        haptic('tap')
        onSelect(flatItems[selectedIndex].id)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [flatItems, selectedIndex, onSelect, onClose]
  )

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const buttons = listRef.current.querySelectorAll<HTMLButtonElement>('[data-feature-item]')
    const el = buttons[selectedIndex]
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (typeof document === 'undefined') return null

  const activeDescendantId = flatItems[selectedIndex]
    ? `feature-search-option-${flatItems[selectedIndex].id}`
    : undefined

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg rounded-2xl glass-strong shadow-2xl animate-scale-in overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/40 shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            placeholder="Search features…"
            aria-label="Search features"
            autoCapitalize="none"
            autoCorrect="off"
            className="flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/30"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-mono text-white/40">
            ESC
          </kbd>
        </div>

        {/* Result count */}
        {query.trim() && (
          <div className="px-4 py-1.5 text-[11px] text-white/30">
            {flatItems.length === 0
              ? 'No results found'
              : `${flatItems.length} result${flatItems.length === 1 ? '' : 's'}`}
          </div>
        )}

        {/* Results */}
        <div
          ref={listRef}
          role="listbox"
          aria-activedescendant={activeDescendantId}
          className="max-h-[55vh] overflow-y-auto overscroll-contain p-2"
        >
          {flatItems.length === 0 ? (
            <div className="px-3 py-8 text-center text-[14px] text-white/40">
              No features match &quot;{query}&quot;
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {grouped.map((group, groupIdx) => {
                // Calculate the flat index offset for this group
                const flatOffset = grouped
                  .slice(0, groupIdx)
                  .reduce((sum, g) => sum + g.items.length, 0)
                return (
                <div key={group.category}>
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">
                    {group.category}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item, itemIdx) => {
                      const idx = flatOffset + itemIdx
                      const isSelected = idx === selectedIndex
                      const isRecent = !query.trim() && recentIds.includes(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          id={`feature-search-option-${item.id}`}
                          aria-selected={isSelected}
                          data-feature-item
                          onClick={() => {
                            haptic('tap')
                            onSelect(item.id)
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                            isSelected
                              ? 'bg-white/[0.08] text-white'
                              : 'text-white/70 hover:bg-white/[0.05] hover:text-white'
                          )}
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-[14px] font-medium truncate">
                              {item.label}
                            </span>
                          </span>
                          {isRecent && (
                            <span className="shrink-0 text-[10px] text-white/30 bg-white/[0.05] rounded-full px-2 py-0.5">
                              Recent
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 text-[11px] text-white/30">
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-white/[0.08] bg-white/[0.03] px-1 py-0.5 font-mono">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-white/[0.08] bg-white/[0.03] px-1 py-0.5 font-mono">
              ↵
            </kbd>
            Select
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}
