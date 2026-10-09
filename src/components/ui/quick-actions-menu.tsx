import { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'

interface QuickAction {
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'accent'
}

interface QuickActionsMenuProps {
  actions: QuickAction[]
  open: boolean
  onClose: () => void
  position: { x: number; y: number }
}

export function QuickActionsMenu({ actions, open, onClose, position }: QuickActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  const menuStyle = {
    left: Math.min(position.x, window.innerWidth - 200),
    top: Math.min(position.y, window.innerHeight - actions.length * 44 - 20),
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] rounded-xl border border-white/[0.12] bg-[#1a1a20]/95 backdrop-blur-xl shadow-2xl animate-scale-in overflow-hidden"
      style={menuStyle}
    >
      {actions.map((action, index) => (
        <button
          key={index}
          type="button"
          onClick={() => {
            haptic('tap')
            action.onClick()
            onClose()
          }}
          className={cn(
            'flex w-full items-center gap-3 px-3 py-2.5 text-left text-[14px] transition-colors min-h-11',
            action.variant === 'accent'
              ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
              : 'text-white/90 hover:bg-white/[0.08]'
          )}
        >
          <span className="flex items-center justify-center w-5 h-5">{action.icon}</span>
          <span className="font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  )
}

export function useLongPress(duration = 500) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  const startPress = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    timerRef.current = window.setTimeout(() => {
      haptic('select')
      setPosition({ x: clientX, y: clientY })
      setOpen(true)
    }, duration)
  }

  const endPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const close = () => {
    setOpen(false)
    setPosition(null)
  }

  return {
    open,
    position: position || { x: 0, y: 0 },
    close,
    handlers: {
      onTouchStart: startPress,
      onTouchEnd: endPress,
      onTouchCancel: endPress,
      onMouseDown: startPress,
      onMouseUp: endPress,
      onMouseLeave: endPress,
    },
  }
}
