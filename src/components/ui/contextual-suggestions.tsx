import { useState, useMemo } from 'react';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

export interface ContextualSuggestionsProps {
  currentPrompt: string
  activeFeatures: string[]
  onSuggestionClick: (featureId: string) => void
  imageCount?: number
  hasSeed?: boolean
}

interface Suggestion {
  featureId: string
  label: string
  reason: string
  icon: React.ReactNode
}

const DISMISS_STORAGE_KEY = 'chilli-suggestions-dismissed'

function generateSuggestions(
  currentPrompt: string,
  activeFeatures: string[],
  imageCount: number,
  hasSeed: boolean,
): Suggestion[] {
  const suggestions: Suggestion[] = []
  const lower = currentPrompt.toLowerCase()
  const activeSet = new Set(activeFeatures)

  // Face / portrait keywords
  if (/\bface\b|\bportrait\b|\bheadshot\b|\bselfie\b|\bperson\b|\bpeople\b/.test(lower)) {
    if (!activeSet.has('image-to-prompt')) {
      suggestions.push({
        featureId: 'image-to-prompt',
        label: 'Image to Prompt',
        reason: 'Great for face & portrait workflows',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 5V9" /><path d="M4 5V9" /><path d="M2 13h20" />
            <path d="M4 13v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
          </svg>
        ),
      })
    }
    if (!activeSet.has('prompt-scorer')) {
      suggestions.push({
        featureId: 'prompt-scorer',
        label: 'Prompt Scorer',
        reason: 'Check quality of portrait prompts',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ),
      })
    }
  }

  // Variation / different keywords
  if (/\bvariation\b|\bdifferent\b|\bdiverse\b|\balternatives\b|\bexplore\b/.test(lower)) {
    if (!activeSet.has('smart-variations')) {
      suggestions.push({
        featureId: 'smart-variations',
        label: 'Smart Variations',
        reason: 'Generate diverse variations',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
        ),
      })
    }
    if (!activeSet.has('ab-testing')) {
      suggestions.push({
        featureId: 'ab-testing',
        label: 'A/B Testing',
        reason: 'Compare different approaches side by side',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3h5v5" /><path d="M8 3H3v5" />
            <path d="M21 3l-7 7" /><path d="M3 3l7 7" />
            <path d="M16 21h5v-5" /><path d="M8 21H3v-5" />
            <path d="M21 21l-7-7" /><path d="M3 21l7-7" />
          </svg>
        ),
      })
    }
  }

  // Long prompt
  if (currentPrompt.length > 200) {
    if (!activeSet.has('prompt-weighting')) {
      suggestions.push({
        featureId: 'prompt-weighting',
        label: 'Prompt Weights',
        reason: 'Fine-tune emphasis in long prompts',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
        ),
      })
    }
    if (!activeSet.has('prompt-templates')) {
      suggestions.push({
        featureId: 'prompt-templates',
        label: 'Prompt Templates',
        reason: 'Save and reuse long prompt structures',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
      })
    }
  }

  // High image count
  if (imageCount > 5) {
    if (!activeSet.has('comparison-grid')) {
      suggestions.push({
        featureId: 'comparison-grid',
        label: 'Compare Grid',
        reason: 'Compare your generated images',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" />
          </svg>
        ),
      })
    }
    if (!activeSet.has('batch-export')) {
      suggestions.push({
        featureId: 'batch-export',
        label: 'Batch Export',
        reason: 'Export multiple images at once',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        ),
      })
    }
  }

  // Seed is set
  if (hasSeed && !activeSet.has('seed-tracker')) {
    suggestions.push({
      featureId: 'seed-tracker',
      label: 'Seed Tracker',
      reason: 'Track and reuse successful seeds',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    })
  }

  return suggestions.slice(0, 3)
}

export function ContextualSuggestions({ currentPrompt, activeFeatures, onSuggestionClick, imageCount: propImageCount, hasSeed: propHasSeed }: ContextualSuggestionsProps) {
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISS_STORAGE_KEY) === 'true' } catch { return false } })
  const [stats] = useState(() => { try { return JSON.parse(localStorage.getItem('chilli-generation-stats') || '{}') as { totalImages?: number; hasSeed?: boolean } } catch { return {} } })
  const imageCount = propImageCount ?? stats.totalImages ?? 0
  const hasSeed = propHasSeed ?? stats.hasSeed ?? false
  const suggestions = useMemo(
    () => generateSuggestions(currentPrompt, activeFeatures, imageCount, hasSeed),
    [currentPrompt, activeFeatures, imageCount, hasSeed],
  )

  const shouldShow = !dismissed && suggestions.length > 0
  const handleDismiss = () => {
    haptic('tap')
    setDismissed(true)
    localStorage.setItem(DISMISS_STORAGE_KEY, 'true')
  }

  const handleClick = (featureId: string) => {
    haptic('tap')
    onSuggestionClick(featureId)
  }

  if (!shouldShow) return null

  return (
    <div className={cn(
      'flex flex-col gap-2',
      'animate-suggestions-enter'
    )}>
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-white/30 uppercase tracking-wider font-medium">
          Suggested for you
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-[11px] text-white/30 hover:text-white/50 transition-colors min-h-[44px] px-1"
        >
          Don&apos;t show again
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s.featureId}
            type="button"
            onClick={() => handleClick(s.featureId)}
            className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-left transition-all hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.98] min-h-[44px]"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.06] text-white/50 shrink-0">
              {s.icon}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] font-medium text-white/80">{s.label}</span>
              <span className="text-[11px] text-white/40 truncate">{s.reason}</span>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/20 ml-auto shrink-0"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
