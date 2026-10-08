import { useState, useEffect, useCallback } from 'react';
import { haptic } from '../../lib/haptics';


interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  label: string
  description: string
  action: string
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: 'Enter', ctrl: true, label: 'Ctrl+Enter', description: 'Generate image', action: 'generate' },
  { key: 's', ctrl: true, label: 'Ctrl+S', description: 'Save current image', action: 'save' },
  { key: 'k', ctrl: true, label: 'Ctrl+K', description: 'Open command palette', action: 'command-palette' },
  { key: 'Escape', label: 'Escape', description: 'Close dialog / cancel', action: 'close' },
  { key: 'h', ctrl: true, label: 'Ctrl+H', description: 'Toggle prompt history', action: 'history' },
  { key: 'v', ctrl: true, label: 'Ctrl+V', description: 'Open smart variations', action: 'variations' },
  { key: 'c', ctrl: true, shift: true, label: 'Ctrl+Shift+C', description: 'Copy prompt', action: 'copy-prompt' },
  { key: 'ArrowRight', alt: true, label: 'Alt+Right', description: 'Next image in gallery', action: 'next-image' },
  { key: 'ArrowLeft', alt: true, label: 'Alt+Left', description: 'Previous image in gallery', action: 'prev-image' },
  { key: '?', shift: true, label: 'Shift+?', description: 'Show keyboard shortcuts', action: 'show-help' },
]

type ShortcutActionHandler = (action: string) => void

export function useKeyboardShortcuts(onAction: ShortcutActionHandler) {
  const [helpOpen, setHelpOpen] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key !== 'Escape') return
      }

      for (const shortcut of DEFAULT_SHORTCUTS) {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey
        const keyMatch = e.key === shortcut.key

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault()

          if (shortcut.action === 'show-help') {
            setHelpOpen((prev) => !prev)
            return
          }

          if (shortcut.action === 'close') {
            setHelpOpen(false)
          }

          haptic('tap')
          onAction(shortcut.action)
          return
        }
      }
    },
    [onAction],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { helpOpen, setHelpOpen, shortcuts: DEFAULT_SHORTCUTS }
}

interface ShortcutHelpModalProps {
  open: boolean
  onClose: () => void
  shortcuts?: Shortcut[]
}

export function ShortcutHelpModal({ open, onClose, shortcuts }: ShortcutHelpModalProps) {
  if (!open) return null

  const displayShortcuts = shortcuts ?? DEFAULT_SHORTCUTS

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#121214] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-semibold text-white">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={() => { haptic('tap'); onClose() }}
            className="min-h-9 min-w-9 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {displayShortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"
            >
              <span className="text-[13px] text-white/70">{shortcut.description}</span>
              <kbd className="rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-0.5 text-[11px] font-mono text-white/50">
                {shortcut.label}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => { haptic('tap'); onClose() }}
            className="min-h-10 px-4 rounded-lg bg-white/10 text-[14px] font-medium text-white/70 hover:text-white hover:bg-white/15"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
