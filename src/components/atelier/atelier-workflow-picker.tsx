import { useState, useEffect } from 'react';
import { atelierConnector, type AtelierWorkflow } from '../../connectors/atelier/atelier-connector';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

interface AtelierWorkflowPickerProps {
  onSelect: (workflow: AtelierWorkflow) => void
  selectedId?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  generate: 'Generate',
  edit: 'Edit',
  enhance: 'Enhance',
  restore: 'Restore',
}

const CATEGORY_ICONS: Record<string, string> = {
  generate: '✨',
  edit: '🎨',
  enhance: '💎',
  restore: '🔧',
}

export function AtelierWorkflowPicker({ onSelect, selectedId }: AtelierWorkflowPickerProps) {
  const [workflows] = useState<AtelierWorkflow[]>(() => atelierConnector.getWorkflows())
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [gpuStatus, setGpuStatus] = useState<'online' | 'offline' | 'checking'>('checking')

  useEffect(() => {
    atelierConnector.health().then((h) => {
      setGpuStatus(h.ok ? 'online' : 'offline')
    }).catch(() => setGpuStatus('offline'))
  }, [])

  const categories = ['all', ...new Set(workflows.map((w) => w.category))]
  const filtered = activeCategory === 'all' ? workflows : workflows.filter((w) => w.category === activeCategory)

  return (
    <div className="flex flex-col gap-4">
      {/* GPU Status Bar */}
      <div className={cn(
        'flex items-center justify-between rounded-2xl border px-4 py-3',
        gpuStatus === 'online'
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : 'border-white/[0.08] bg-white/[0.03]',
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-2.5 w-2.5 rounded-full',
            gpuStatus === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-white/20',
          )} />
          <div>
            <div className="text-[14px] font-medium text-white/90">
              {gpuStatus === 'online' ? 'GPU Online' : 'GPU Offline'}
            </div>
            <div className="text-[11px] text-white/40">
              {gpuStatus === 'online' ? 'Vast 51253074 · ComfyUI ready' : 'Tap Start GPU when needed'}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            haptic('select')
            if (gpuStatus === 'online') {
              atelierConnector.stopGpu()
              setGpuStatus('offline')
            } else {
              atelierConnector.startGpu()
              setGpuStatus('checking')
              setTimeout(() => setGpuStatus('online'), 3000)
            }
          }}
          className={cn(
            'rounded-xl px-4 py-2 text-[13px] font-medium transition-all',
            gpuStatus === 'online'
              ? 'bg-red-500/15 text-red-300 border border-red-500/20 hover:bg-red-500/25'
              : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/25',
          )}
        >
          {gpuStatus === 'online' ? 'Stop GPU' : 'Start GPU'}
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { haptic('tap'); setActiveCategory(cat) }}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-all',
              activeCategory === cat
                ? 'bg-[var(--color-accent)] text-black'
                : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white/80',
            )}
          >
            {cat === 'all' ? 'All' : `${CATEGORY_ICONS[cat] || ''} ${CATEGORY_LABELS[cat] || cat}`}
          </button>
        ))}
      </div>

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 gap-2.5">
        {filtered.map((wf) => {
          const isSelected = selectedId === wf.id
          return (
            <button
              key={wf.id}
              onClick={() => { haptic('select'); onSelect(wf) }}
              className={cn(
                'group relative flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all',
                isSelected
                  ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 shadow-[0_0_20px_rgba(var(--color-accent-rgb),0.1)]'
                  : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.05]',
              )}
            >
              <div className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[22px]',
                isSelected ? 'bg-[var(--color-accent)]/20' : 'bg-white/[0.06]',
              )}>
                {wf.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-white/90">{wf.name}</span>
                  <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/40">
                    {wf.category}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/45">{wf.purpose}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {wf.capabilities.slice(0, 4).map((cap) => (
                    <span key={cap} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/35">
                      {cap}
                    </span>
                  ))}
                  {wf.capabilities.length > 4 && (
                    <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/35">
                      +{wf.capabilities.length - 4}
                    </span>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
