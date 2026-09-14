import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

const DISMISS_DISTANCE = 110
const DRAG_EXIT_MS = 200

/**
 * Mobile-first bottom sheet: drag handle, drag-to-dismiss, backdrop tap,
 * Escape to close. Rendered in a portal above the app shell.
 */
export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const [dragDy, setDragDy] = useState(0)
  const [exiting, setExiting] = useState(false)
  const drag = useRef<{ startY: number; active: boolean } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const exitTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    sheetRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => () => {
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current)
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { startY: event.clientY, active: true }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current?.active) return
    setDragDy(Math.max(0, event.clientY - drag.current.startY))
  }, [])

  const endDrag = useCallback(() => {
    if (!drag.current?.active) return
    drag.current = null
    if (dragDy > DISMISS_DISTANCE) {
      setExiting(true)
      exitTimer.current = window.setTimeout(onClose, DRAG_EXIT_MS)
    } else {
      setDragDy(0)
    }
  }, [dragDy, onClose])

  if (!open || typeof document === 'undefined') return null

  const dragging = dragDy > 0 && !exiting

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title || 'Sheet'}>
      <div
        className={cn('absolute inset-0 bg-black/65 backdrop-blur-[2px] animate-backdrop-in', exiting && 'animate-backdrop-out')}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl outline-none',
          'border-x border-t border-white/[0.08] bg-[#15151b] shadow-[0_-16px_60px_rgba(0,0,0,0.65)]',
          exiting ? 'transition-transform' : dragging ? '' : 'animate-sheet-in',
          className,
        )}
        style={
          exiting
            ? { transform: 'translateY(100%)', transitionDuration: `${DRAG_EXIT_MS}ms`, transitionTimingFunction: 'cubic-bezier(0.5, 0, 0.75, 0.4)' }
            : dragging
              ? { transform: `translateY(${dragDy}px)`, transition: 'none' }
              : undefined
        }
      >
        <div
          className="shrink-0 cursor-grab touch-none select-none py-2.5 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-white/25" />
        </div>
        {title && (
          <div className="shrink-0 px-4 pb-2.5 pt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-white/90">
            {title}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
