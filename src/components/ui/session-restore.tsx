import { useState, useCallback } from 'react';
import { haptic } from '../../lib/haptics';


const SESSION_KEY = 'chilli-session-state'

interface SessionState {
  prompt: string
  negativePrompt: string
  model: string
  steps: number
  seed: string
  aspectRatio: string
  preset: string
  lastImages: string[]
  savedAt: number
}

function saveSession(state: SessionState) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

function loadSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionState
  } catch {
    return null
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Ignore
  }
}

interface UseSessionRestoreReturn {
  hasSavedSession: boolean
  savedSession: SessionState | null
  restore: () => SessionState | null
  dismiss: () => void
  save: (state: Omit<SessionState, 'savedAt'>) => void
}

export function useSessionRestore(): UseSessionRestoreReturn {
  const [savedSession, setSavedSession] = useState<SessionState | null>(loadSession)
  const [dismissed, setDismissed] = useState(false)



  const restore = useCallback((): SessionState | null => {
    const session = loadSession()
    if (session) {
      haptic('success')
      clearSession()
      setSavedSession(null)
      return session
    }
    return null
  }, [])

  const dismiss = useCallback(() => {
    haptic('tap')
    setDismissed(true)
    clearSession()
    setSavedSession(null)
  }, [])

  const save = useCallback((state: Omit<SessionState, 'savedAt'>) => {
    saveSession({ ...state, savedAt: Date.now() })
  }, [])

  return {
    hasSavedSession: savedSession !== null && !dismissed,
    savedSession,
    restore,
    dismiss,
    save,
  }
}

interface SessionRestorePromptProps {
  hasSavedSession: boolean
  savedSession: SessionState | null
  onRestore: () => void
  onDismiss: () => void
}

export function SessionRestorePrompt({
  hasSavedSession,
  savedSession,
  onRestore,
  onDismiss,
}: SessionRestorePromptProps) {
  const [referenceTime] = useState(() => Date.now())
  if (!hasSavedSession || !savedSession) return null

  const timeAgo = (() => {
    const diff = referenceTime - savedSession.savedAt
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`
    return `${Math.floor(diff / 86400000)} days ago`
  })()

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#121214] p-5 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-300">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-white">Restore last session?</h3>
            <p className="text-[12px] text-white/40">{timeAgo}</p>
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 mb-4">
          <div className="space-y-1.5 text-[12px]">
            {savedSession.prompt && (
              <div className="flex gap-2">
                <span className="text-white/30 shrink-0">Prompt:</span>
                <span className="text-white/60 truncate">{savedSession.prompt.slice(0, 60)}</span>
              </div>
            )}
            {savedSession.model && (
              <div className="flex gap-2">
                <span className="text-white/30 shrink-0">Model:</span>
                <span className="text-white/60">{savedSession.model}</span>
              </div>
            )}
            {savedSession.lastImages.length > 0 && (
              <div className="flex gap-2">
                <span className="text-white/30 shrink-0">Images:</span>
                <span className="text-white/60">{savedSession.lastImages.length} saved</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 min-h-11 rounded-xl bg-white/[0.06] text-[14px] font-medium text-white/60 hover:text-white hover:bg-white/[0.1] transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="flex-1 min-h-11 rounded-xl bg-white text-[14px] font-semibold text-black transition-colors hover:bg-white/90"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  )
}
