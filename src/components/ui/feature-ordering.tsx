import { useState, useRef, useCallback, useEffect } from 'react';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

export interface FeatureOrderingProps {
  items: { id: string; label: string }[]
  onReorder: (newOrder: string[]) => void
  onClose: () => void
}

const STORAGE_KEY = 'chilli-feature-order'

function loadOrder(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveOrder(order: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch (e) {
    console.warn('Failed to save feature order:', e)
  }
}

export function FeatureOrdering({ items, onReorder, onClose }: FeatureOrderingProps) {
  const [ordered, setOrdered] = useState(() => {
    const saved = loadOrder()
    if (saved.length > 0) {
      const orderedItems = saved
        .map((id) => items.find((item) => item.id === id))
        .filter(Boolean) as typeof items
      const remaining = items.filter((item) => !saved.includes(item.id))
      return [...orderedItems, ...remaining]
    }
    return items
  })

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [, setDragOffsetY] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  // Save order whenever it changes
  useEffect(() => {
    const ids = ordered.map((item) => item.id)
    saveOrder(ids)
  }, [ordered])

  const handlePointerDown = useCallback(
    (index: number, e: React.PointerEvent) => {
void e;
      e.preventDefault()
      haptic('tap')
      const el = itemRefs.current[index]
      if (!el) return

      const rect = el.getBoundingClientRect()
      setDragIndex(index)
      setDragOverIndex(index)
      setDragOffsetY(e.clientY - rect.top)

      el.setPointerCapture(e.pointerId)
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
void e;
      if (dragIndex === null) return

      // Find which item the pointer is over
      const container = containerRef.current
      if (!container) return

      const children = container.querySelectorAll<HTMLDivElement>('[data-order-item]')
      let newIndex = dragIndex

      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect()
        const midY = rect.top + rect.height / 2
        if (e.clientY < midY) {
          newIndex = i
          break
        }
        if (i === children.length - 1) {
          newIndex = i
        }
      }

      if (newIndex !== dragOverIndex) {
        setDragOverIndex(newIndex)
      }
    },
    [dragIndex, dragOverIndex]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
void e;
      if (dragIndex === null || dragOverIndex === null) {
        setDragIndex(null)
        setDragOverIndex(null)
        return
      }

      if (dragIndex !== dragOverIndex) {
        haptic('select')
        setOrdered((prev) => {
          const updated = [...prev]
          const [moved] = updated.splice(dragIndex, 1)
          updated.splice(dragOverIndex, 0, moved)
          onReorder(updated.map((item) => item.id))
          return updated
        })
        setAnnouncement(`Moved to position ${dragOverIndex + 1}`)
      }

      setDragIndex(null)
      setDragOverIndex(null)
    },
    [dragIndex, dragOverIndex, onReorder]
  )

  const handleResetToDefault = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('Failed to clear feature order:', e)
    }
    setOrdered(items)
    onReorder(items.map((item) => item.id))
    setAnnouncement('Order reset to default')
    haptic('success')
  }, [items, onReorder])

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
      />
      {/* Live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <div className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-2xl glass-strong shadow-2xl animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <h2 className="text-[15px] font-semibold text-white">Reorder Features</h2>
          <button
            type="button"
            onClick={() => {
              haptic('tap')
              onClose()
            }}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Drag instructions */}
        <div className="px-4 py-2 text-[12px] text-white/30">
          Drag the handle to reorder features
        </div>

        {/* Item list */}
        <div
          ref={containerRef}
          className="max-h-[60vh] overflow-y-auto overscroll-contain px-3 pb-4"
          role="listbox"
          aria-label="Feature order"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="flex flex-col gap-1.5">
            {ordered.map((item, index) => {
              const isDragging = dragIndex === index
              const isOver = dragOverIndex === index && dragIndex !== null && dragIndex !== index

              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el
                  }}
                  data-order-item
                  role="option"
                  aria-grabbed={isDragging}
                  aria-selected={isDragging}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-3 transition-all duration-200 select-none',
                    isDragging
                      ? 'border-white/[0.2] bg-white/[0.12] shadow-[0_8px_32px_rgba(255,255,255,0.08)] scale-[1.03] z-10'
                      : 'border-white/[0.06] bg-white/[0.04]',
                    isOver && !isDragging && 'border-white/[0.12] bg-white/[0.07] translate-y-0.5'
                  )}
                  style={{
                    opacity: isDragging ? 0.92 : 1,
                    transition: isDragging ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
                  }}
                >
                  {/* Drag handle */}
                  <div
                    className={cn(
                      'flex flex-col items-center justify-center w-8 h-10 rounded-lg cursor-grab active:cursor-grabbing transition-colors touch-none',
                      isDragging
                        ? 'bg-white/[0.15] text-white/80'
                        : 'bg-white/[0.05] text-white/30 hover:bg-white/[0.08] hover:text-white/50'
                    )}
                    onPointerDown={(e) => handlePointerDown(index, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    aria-label={`Drag handle for ${item.label}`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <circle cx="9" cy="5" r="1.5" />
                      <circle cx="15" cy="5" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="19" r="1.5" />
                      <circle cx="15" cy="19" r="1.5" />
                    </svg>
                  </div>

                  {/* Position number */}
                  <span className="w-6 text-center text-[12px] font-mono text-white/30">
                    {index + 1}
                  </span>

                  {/* Label */}
                  <span
                    className={cn(
                      'flex-1 text-[14px] font-medium',
                      isDragging ? 'text-white' : 'text-white/80'
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-white/30">
              {ordered.length} feature{ordered.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={handleResetToDefault}
              className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-[12px] text-white/40 hover:bg-white/[0.08] hover:text-white/60 transition-colors"
            >
              Reset to Default
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic('tap')
              onReorder(ordered.map((item) => item.id))
              onClose()
            }}
            className="rounded-lg bg-white/[0.08] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-white/[0.12] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
