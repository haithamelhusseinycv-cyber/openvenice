import { useState, useMemo } from 'react'
import { getNSFWModelRecommendations, type NSFWCapability, type ModelNSFWInfo } from '../../lib/nsfw-model-capabilities'
import { haptic } from '../../lib/haptics'
import { BottomSheet } from '../ui/bottom-sheet'

interface Props {
  open: boolean
  onClose: () => void
  selectedModel: string
  onSelect: (modelId: string) => void
  requiredLevel?: NSFWCapability
}

const CAPABILITY_LABELS: Record<NSFWCapability, { label: string; color: string }> = {
  none: { label: 'SFW Only', color: 'text-white/40' },
  softcore: { label: 'Softcore', color: 'text-amber-400' },
  artistic: { label: 'Artistic', color: 'text-blue-400' },
  explicit: { label: 'Explicit', color: 'text-purple-400' },
  full: { label: 'Full NSFW', color: 'text-rose-400' },
}

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  venice: { label: 'Cloud', color: 'bg-cyan-500/20 text-cyan-300' },
  localdream: { label: 'Local', color: 'bg-emerald-500/20 text-emerald-300' },
  atelier: { label: 'GPU', color: 'bg-violet-500/20 text-violet-300' },
}

export function NSFWModelPicker({ open, onClose, selectedModel, onSelect, requiredLevel = 'full' }: Props) {
  const [query, setQuery] = useState('')
  const [filterProvider, setFilterProvider] = useState<'all' | 'venice' | 'localdream' | 'atelier'>('all')

  const models = useMemo(() => {
    let list = getNSFWModelRecommendations(requiredLevel)
    if (filterProvider !== 'all') {
      list = list.filter((m) => m.provider === filterProvider)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
    }
    return list
  }, [requiredLevel, filterProvider, query])

  const pick = (model: ModelNSFWInfo) => {
    haptic('select')
    onSelect(model.id)
    onClose()
    setQuery('')
  }

  return (
    <BottomSheet open={open} onClose={() => { onClose(); setQuery('') }} title="NSFW Models">
      <div className="sticky -top-4 z-10 -mx-4 bg-[#15151b] px-4 pb-3 pt-1 space-y-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models..."
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 py-2.5 text-[16px] text-white outline-none placeholder:text-white/30 focus:border-white/[0.25]"
        />
        <div className="flex gap-1.5">
          {(['all', 'localdream', 'atelier', 'venice'] as const).map((p) => (
            <button
              key={p}
              onClick={() => { haptic('tap'); setFilterProvider(p) }}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                filterProvider === p
                  ? 'bg-white/[0.12] text-white'
                  : 'bg-white/[0.04] text-white/50 hover:text-white/70'
              }`}
            >
              {p === 'all' ? 'All' : p === 'localdream' ? 'Local' : p === 'atelier' ? 'GPU' : 'Cloud'}
            </button>
          ))}
        </div>
      </div>

      {models.length === 0 ? (
        <div className="px-1 py-6 text-center text-[14px] text-white/40">
          No models match your criteria.
        </div>
      ) : (
        <ul className="flex flex-col gap-1 pb-2">
          {models.map((model) => {
            const active = model.id === selectedModel
            const cap = CAPABILITY_LABELS[model.capability]
            const prov = PROVIDER_LABELS[model.provider]

            return (
              <li key={model.id}>
                <button
                  type="button"
                  onClick={() => pick(model)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-[var(--color-accent-soft)] text-white'
                      : 'text-white/75 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium truncate">{model.name}</span>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${prov.color}`}>
                        {prov.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className={`text-[11px] font-medium ${cap.color}`}>{cap.label}</span>
                      {model.supportsInpainting && (
                        <span className="text-[10px] text-white/30">Inpaint</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {model.strengths.slice(0, 3).map((s) => (
                        <span key={s} className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/40">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  {active && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </BottomSheet>
  )
}
