import { useState, useMemo, useCallback } from 'react'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface WeightedTerm {
  text: string
  weight: number
  index: number
}

const WEIGHT_REGEX = /\(([^()]+):(\d+\.?\d*)\)/g

function parseWeightedPrompt(prompt: string): { segments: { text: string; weight: number; isWeighted: boolean }[]; terms: WeightedTerm[] } {
  const segments: { text: string; weight: number; isWeighted: boolean }[] = []
  const terms: WeightedTerm[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let termIndex = 0

  const regex = new RegExp(WEIGHT_REGEX.source, 'g')
  while ((match = regex.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: prompt.slice(lastIndex, match.index), weight: 1, isWeighted: false })
    }
    const term = match[1]
    const weight = parseFloat(match[2])
    segments.push({ text: term, weight, isWeighted: true })
    terms.push({ text: term, weight, index: termIndex })
    lastIndex = match.index + match[0].length
    termIndex++
  }

  if (lastIndex < prompt.length) {
    segments.push({ text: prompt.slice(lastIndex), weight: 1, isWeighted: false })
  }

  return { segments, terms }
}

function rebuildPrompt(baseText: string, terms: WeightedTerm[]): string {
  let result = baseText
  for (const term of terms) {
    const escaped = term.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\(${escaped}:\\d+\\.?\\d*\\)`, 'g')
    if (pattern.test(result)) {
      result = result.replace(pattern, `(${term.text}:${term.weight.toFixed(2)})`)
    } else {
      const plainPattern = new RegExp(`\\b${escaped}\\b`)
      if (plainPattern.test(result)) {
        result = result.replace(plainPattern, `(${term.text}:${term.weight.toFixed(2)})`)
      }
    }
  }
  return result
}

interface PromptWeightEditorProps {
  prompt: string
  onChange: (newPrompt: string) => void
}

export function PromptWeightEditor({ prompt, onChange }: PromptWeightEditorProps) {
  const { segments, terms } = useMemo(() => parseWeightedPrompt(prompt), [prompt])
  const [newTermText, setNewTermText] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const updateWeight = useCallback((termIndex: number, newWeight: number) => {
    const updated = [...terms]
    updated[termIndex] = { ...updated[termIndex], weight: newWeight }
    const newPrompt = rebuildPrompt(prompt, updated)
    onChange(newPrompt)
  }, [terms, prompt, onChange])

  const removeWeight = useCallback((termIndex: number) => {
    const term = terms[termIndex]
    if (!term) return
    const escaped = term.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\(${escaped}:\\d+\\.?\\d*\\)`, 'g')
    const newPrompt = prompt.replace(pattern, term.text)
    haptic('tap')
    onChange(newPrompt)
  }, [terms, prompt, onChange])

  const addWeightedTerm = useCallback(() => {
    if (!newTermText.trim()) return
    haptic('select')
    const newTerm: WeightedTerm = {
      text: newTermText.trim(),
      weight: 1.0,
      index: terms.length,
    }
    const newPrompt = prompt ? `${prompt} (${newTerm.text}:${newTerm.weight.toFixed(2)})` : `(${newTerm.text}:${newTerm.weight.toFixed(2)})`
    onChange(newPrompt)
    setNewTermText('')
    setShowAdd(false)
  }, [newTermText, terms, prompt, onChange])

  const getWeightColor = (weight: number) => {
    if (weight >= 1.5) return 'text-red-300'
    if (weight >= 1.2) return 'text-amber-300'
    if (weight >= 1.0) return 'text-emerald-300'
    if (weight >= 0.7) return 'text-blue-300'
    return 'text-white/40'
  }

  const getWeightBg = (weight: number) => {
    if (weight >= 1.5) return 'bg-red-500/10 border-red-500/20'
    if (weight >= 1.2) return 'bg-amber-500/10 border-amber-500/20'
    if (weight >= 1.0) return 'bg-emerald-500/10 border-emerald-500/20'
    if (weight >= 0.7) return 'bg-blue-500/10 border-blue-500/20'
    return 'bg-white/[0.03] border-white/[0.08]'
  }

  if (terms.length === 0 && !showAdd) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#c6beb5] uppercase tracking-[0.06em]">
            Prompt Weights
          </span>
          <button
            type="button"
            onClick={() => { haptic('tap'); setShowAdd(true) }}
            className="text-[12px] text-white/50 hover:text-white/70"
          >
            + Add weight
          </button>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center">
          <p className="text-[12px] text-white/30">
            No weighted terms found. Use <code className="text-white/50">(word:1.5)</code> syntax in your prompt, or add one below.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#c6beb5] uppercase tracking-[0.06em]">
          Prompt Weights
        </span>
        <button
          type="button"
          onClick={() => { haptic('tap'); setShowAdd(!showAdd) }}
          className="text-[12px] text-white/50 hover:text-white/70"
        >
          {showAdd ? 'Cancel' : '+ Add weight'}
        </button>
      </div>

      {/* Preview */}
      <div className="rounded-xl bg-black/20 p-2.5">
        <div className="flex flex-wrap gap-0.5 text-[13px] leading-relaxed">
          {segments.map((seg, i) => {
            if (!seg.isWeighted) {
              return <span key={i} className="text-white/50">{seg.text}</span>
            }
            return (
              <span key={i} className={cn('rounded px-0.5', getWeightColor(seg.weight))}>
                {seg.text}
                <span className="text-[10px] ml-0.5 opacity-60">{seg.weight.toFixed(1)}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* Sliders */}
      {terms.length > 0 && (
        <div className="flex flex-col gap-2">
          {terms.map((term) => (
            <div
              key={`${term.text}-${term.index}`}
              className={cn('rounded-xl border p-3', getWeightBg(term.weight))}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn('text-[13px] font-medium', getWeightColor(term.weight))}>
                  {term.text}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-white/40 font-mono">{term.weight.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => removeWeight(term.index)}
                    className="text-white/20 hover:text-red-300/60 transition-colors"
                    aria-label={`Remove weight from ${term.text}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={term.weight}
                onChange={(e) => {
                  const w = parseFloat(e.target.value)
                  haptic('select')
                  updateWeight(term.index, w)
                }}
                className="w-full h-1.5 appearance-none rounded-full bg-white/[0.08] outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
                <span>0.1 (less)</span>
                <span>1.0</span>
                <span>2.0 (more)</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new term */}
      {showAdd && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTermText}
            onChange={(e) => setNewTermText(e.target.value)}
            placeholder="Term to weight..."
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-white/[0.25] placeholder:text-white/35 min-h-9"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addWeightedTerm()
            }}
          />
          <button
            type="button"
            onClick={addWeightedTerm}
            disabled={!newTermText.trim()}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/70 hover:bg-white/15 hover:text-white min-h-9 disabled:opacity-30"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
