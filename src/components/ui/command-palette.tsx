import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSettingsStore } from '../../stores/settings-store';
import { usePlaygroundStore } from '../../stores/playground-store';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onOpenApiKey: () => void
  onOpenDiagnostics: () => void
}

interface Command {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  keywords: string[]
  action: () => void
}

export function CommandPalette({ open, onClose, onOpenApiKey, onOpenDiagnostics }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const setActiveTab = useSettingsStore((s) => s.setActiveTab)

  const commands: Command[] = useMemo(() => [
    {
      id: 'chat',
      label: 'Go to Chat',
      description: 'Switch to conversational AI',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
      keywords: ['chat', 'noor', 'conversation', 'talk'],
      action: () => { setActiveTab('playground'); onClose() },
    },
    {
      id: 'image',
      label: 'Go to Image',
      description: 'Switch to image generation',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>,
      keywords: ['image', 'create', 'generate', 'picture'],
      action: () => { setActiveTab('image'); onClose() },
    },
    {
      id: 'new-chat',
      label: 'New Chat',
      description: 'Clear conversation and start fresh',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
      keywords: ['new', 'clear', 'reset', 'fresh'],
      action: () => {
        setActiveTab('playground')
        usePlaygroundStore.getState().clearConversation()
        onClose()
      },
    },
    {
      id: 'api-key',
      label: 'Manage API Key',
      description: 'Connect or update your Venice API key',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>,
      keywords: ['api', 'key', 'venice', 'connect', 'settings'],
      action: () => { onOpenApiKey(); onClose() },
    },
    {
      id: 'diagnostics',
      label: 'Device Diagnostics',
      description: 'Check device health and performance',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h4l2-7 4 12 2-5h4" /><path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg>,
      keywords: ['diagnostics', 'health', 'performance', 'debug'],
      action: () => { onOpenDiagnostics(); onClose() },
    },
  ], [setActiveTab, onClose, onOpenApiKey, onOpenDiagnostics])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.keywords.some((kw) => kw.includes(q))
    )
  }, [query, commands])

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setQuery(''); setSelectedIndex(0) }
  }
  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [open])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault()
      haptic('tap')
      filtered[selectedIndex].action()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [filtered, selectedIndex, onClose])

  useEffect(() => {
    if (listRef.current && filtered[selectedIndex]) {
      const el = listRef.current.children[selectedIndex] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, filtered])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl glass-strong shadow-2xl animate-scale-in overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40 shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            placeholder="Type a command…"
            aria-label="Search commands"
            autoCapitalize="none"
            autoCorrect="off"
            className="flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/30"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-mono text-white/40">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto overscroll-contain p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-[14px] text-white/40">
              No commands match "{query}"
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map((cmd, index) => (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => { haptic('tap'); cmd.action() }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    index === selectedIndex
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/70 hover:bg-white/[0.05] hover:text-white'
                  )}
                >
                  <span className="flex shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-white/[0.05] text-white/60">
                    {cmd.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-medium">{cmd.label}</span>
                    {cmd.description && (
                      <span className="block text-[12px] text-white/40 truncate">{cmd.description}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 text-[11px] text-white/30">
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-white/[0.08] bg-white/[0.03] px-1 py-0.5 font-mono">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-white/[0.08] bg-white/[0.03] px-1 py-0.5 font-mono">↵</kbd>
            Select
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        haptic('tap')
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return { open, setOpen }
}
