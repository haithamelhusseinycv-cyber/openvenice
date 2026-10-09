import { useState, useCallback } from 'react';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

interface PromptVersion {
  id: string
  prompt: string
  negative?: string
  timestamp: number
  label?: string
}

const STORAGE_KEY = 'chilli-prompt-versions'
const MAX_VERSIONS = 50

export function usePromptVersions() {
  const [versions, setVersions] = useState<PromptVersion[]>(() => { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value : [] } catch { return [] } })



  const persist = useCallback((updated: PromptVersion[]) => {
    setVersions(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // Ignore storage errors
    }
  }, [])

  const saveVersion = useCallback((prompt: string, negative?: string, label?: string) => {
    const newVersion: PromptVersion = {
      id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prompt,
      negative,
      timestamp: Date.now(),
      label,
    }
    setVersions((prev) => {
      const updated = [newVersion, ...prev].slice(0, MAX_VERSIONS)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch { /* ignore */ }
      return updated
    })
  }, [])

  const revertTo = useCallback((versionId: string): PromptVersion | null => {
    const found = versions.find((v) => v.id === versionId)
    return found ?? null
  }, [versions])

  const deleteVersion = useCallback((versionId: string) => {
    setVersions((prev) => {
      const updated = prev.filter((v) => v.id !== versionId)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch { /* ignore */ }
      return updated
    })
  }, [])

  const clearAll = useCallback(() => {
    persist([])
  }, [persist])

  return { versions, saveVersion, revertTo, deleteVersion, clearAll }
}

function computeDiff(oldText: string, newText: string): { type: 'same' | 'added' | 'removed'; text: string }[] {
  const oldWords = oldText.split(/(\s+)/)
  const newWords = newText.split(/(\s+)/)
  const result: { type: 'same' | 'added' | 'removed'; text: string }[] = []

  const oldSet = new Set(oldWords.filter((w) => w.trim()))
  const newSet = new Set(newWords.filter((w) => w.trim()))

  for (const word of newWords) {
    if (!word.trim()) {
      result.push({ type: 'same', text: word })
      continue
    }
    if (oldSet.has(word)) {
      result.push({ type: 'same', text: word })
    } else {
      result.push({ type: 'added', text: word })
    }
  }

  for (const word of oldWords) {
    if (!word.trim()) continue
    if (!newSet.has(word)) {
      result.push({ type: 'removed', text: word })
    }
  }

  return result
}

interface DiffViewProps {
  oldPrompt: string
  newPrompt: string
}

function DiffView({ oldPrompt, newPrompt }: DiffViewProps) {
  const diff = computeDiff(oldPrompt, newPrompt)

  return (
    <div className="flex flex-wrap gap-0.5 text-[12px] leading-relaxed">
      {diff.map((part, i) => {
        if (part.type === 'same') {
          return <span key={i} className="text-white/50">{part.text}</span>
        }
        if (part.type === 'added') {
          return (
            <span key={i} className="rounded bg-emerald-500/20 text-emerald-300 px-0.5">
              +{part.text}
            </span>
          )
        }
        return (
          <span key={i} className="rounded bg-red-500/20 text-red-300 px-0.5 line-through">
            -{part.text}
          </span>
        )
      })}
    </div>
  )
}

interface PromptVersionHistoryProps {
  versions: PromptVersion[]
  onSelect: (prompt: string, negative?: string) => void
  onDelete: (id: string) => void
  onClear: () => void
  currentPrompt: string
}

export function PromptVersionHistory({
  versions,
  onSelect,
  onDelete,
  onClear,
  currentPrompt,
}: PromptVersionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState<string | null>(null)

  const [referenceTime] = useState(() => Date.now())
  if (versions.length === 0) {
    return (
      <div className="text-center py-6 text-[13px] text-white/40">
        No prompt versions saved yet.
        <br />
        <span className="text-[11px] text-white/25">Versions are saved automatically when you generate.</span>
      </div>
    )
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const now = referenceTime
    const diff = now - ts
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-white/40">{versions.length} versions</span>
        <button
          type="button"
          onClick={() => { haptic('tap'); onClear() }}
          className="text-[12px] text-red-300/70 hover:text-red-300"
        >
          Clear all
        </button>
      </div>

      {versions.map((version) => {
        const isExpanded = expandedId === version.id
        const isShowingDiff = showDiff === version.id
        const isCurrent = version.prompt === currentPrompt

        return (
          <div
            key={version.id}
            className={cn(
              'rounded-xl border transition-colors',
              isCurrent
                ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                : 'border-white/[0.08] bg-white/[0.03]',
            )}
          >
            <button
              type="button"
              onClick={() => {
                haptic('tap')
                setExpandedId(isExpanded ? null : version.id)
              }}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left min-h-10"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-white/70 truncate">
                    {version.label || version.prompt.slice(0, 50)}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] text-emerald-300/70 bg-emerald-500/10 rounded px-1 py-0.5">
                      current
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-white/30">{formatTime(version.timestamp)}</span>
              </div>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={cn('text-white/30 transition-transform', isExpanded && 'rotate-180')}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 flex flex-col gap-2 border-t border-white/[0.06] pt-2">
                <p className="text-[12px] text-white/60 leading-relaxed break-words">
                  {version.prompt}
                </p>
                {version.negative && (
                  <p className="text-[11px] text-white/35 leading-relaxed break-words">
                    <span className="text-white/20">Negative: </span>{version.negative}
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { haptic('select'); onSelect(version.prompt, version.negative) }}
                    className="rounded-lg bg-white/10 px-2.5 py-1 text-[12px] text-white/70 hover:bg-white/15 hover:text-white min-h-8"
                  >
                    Revert to this
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptic('tap')
                      setShowDiff(isShowingDiff ? null : version.id)
                    }}
                    className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[12px] text-white/50 hover:text-white/70 min-h-8"
                  >
                    {isShowingDiff ? 'Hide diff' : 'Show diff'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { haptic('tap'); onDelete(version.id) }}
                    className="rounded-lg px-2.5 py-1 text-[12px] text-red-300/60 hover:text-red-300 min-h-8"
                  >
                    Delete
                  </button>
                </div>

                {isShowingDiff && (
                  <div className="rounded-lg bg-black/20 p-2">
                    <span className="text-[10px] text-white/25 uppercase tracking-wider mb-1 block">
                      Diff from current
                    </span>
                    <DiffView oldPrompt={version.prompt} newPrompt={currentPrompt} />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
