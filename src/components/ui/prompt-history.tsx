import { useState } from 'react';
import { haptic } from '../../lib/haptics';


interface PromptHistoryItem {
  prompt: string
  negative?: string
  timestamp: number
  favorite: boolean
}

const STORAGE_KEY = 'chilli-prompt-history'
const MAX_HISTORY = 20

export function usePromptHistory() {
  const [history, setHistory] = useState<PromptHistoryItem[]>(() => { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value : [] } catch { return [] } })



  const saveToHistory = (prompt: string, negative?: string) => {
    const newItem: PromptHistoryItem = {
      prompt,
      negative,
      timestamp: Date.now(),
      favorite: false,
    }

    setHistory((prev) => {
      const filtered = prev.filter((item) => item.prompt !== prompt)
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const toggleFavorite = (timestamp: number) => {
    setHistory((prev) => {
      const updated = prev.map((item) =>
        item.timestamp === timestamp ? { ...item, favorite: !item.favorite } : item
      )
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return { history, saveToHistory, toggleFavorite, clearHistory }
}

interface PromptHistoryListProps {
  history: PromptHistoryItem[]
  onSelect: (prompt: string, negative?: string) => void
  onToggleFavorite: (timestamp: number) => void
  onClear: () => void
}

export function PromptHistoryList({ history, onSelect, onToggleFavorite, onClear }: PromptHistoryListProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-6 text-[13px] text-white/40">
        No prompt history yet
      </div>
    )
  }

  const favorites = history.filter((item) => item.favorite)
  const recent = history.filter((item) => !item.favorite)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-white/70">Prompt History</span>
        <button
          type="button"
          onClick={() => {
            haptic('tap')
            onClear()
          }}
          className="text-[12px] text-white/50 hover:text-white/80 min-h-8 px-2"
        >
          Clear all
        </button>
      </div>

      {favorites.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-white/50 font-medium">Favorites</span>
          {favorites.map((item) => (
            <div key={item.timestamp} className="flex items-start gap-2 rounded-lg bg-white/[0.04] p-2">
              <button
                type="button"
                onClick={() => {
                  haptic('select')
                  onSelect(item.prompt, item.negative)
                }}
                className="flex-1 text-left text-[13px] text-white/80 hover:text-white min-h-8"
              >
                {item.prompt.slice(0, 80)}{item.prompt.length > 80 && '…'}
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic('tap')
                  onToggleFavorite(item.timestamp)
                }}
                className="shrink-0 text-[var(--color-accent)] min-h-8 min-w-8"
                aria-label="Remove from favorites"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-white/50 font-medium">Recent</span>
          {recent.slice(0, 10).map((item) => (
            <div key={item.timestamp} className="flex items-start gap-2 rounded-lg bg-white/[0.02] p-2">
              <button
                type="button"
                onClick={() => {
                  haptic('select')
                  onSelect(item.prompt, item.negative)
                }}
                className="flex-1 text-left text-[13px] text-white/70 hover:text-white min-h-8"
              >
                {item.prompt.slice(0, 80)}{item.prompt.length > 80 && '…'}
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic('tap')
                  onToggleFavorite(item.timestamp)
                }}
                className="shrink-0 text-white/30 hover:text-[var(--color-accent)] min-h-8 min-w-8"
                aria-label="Add to favorites"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
