
import { NSFW_PRESETS, type NSFWPreset, detectPresetFromPrompt } from '../../lib/nsfw-quality-presets';
import { haptic } from '../../lib/haptics';
import { BottomSheet } from '../ui/bottom-sheet';

interface Props {
  open: boolean
  onClose: () => void
  currentPreset: NSFWPreset
  onSelect: (preset: NSFWPreset) => void
  prompt?: string
}

const PRESET_ICONS: Record<NSFWPreset, string> = {
  neutral: 'M5 12l4 4L19 6',
  softcore: 'M12 3v18M3 12h18',
  artistic: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  explicit: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
  pornographic: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
}

const PRESET_COLORS: Record<NSFWPreset, string> = {
  neutral: 'border-white/20 bg-white/5',
  softcore: 'border-amber-500/30 bg-amber-500/5',
  artistic: 'border-blue-500/30 bg-blue-500/5',
  explicit: 'border-purple-500/30 bg-purple-500/5',
  pornographic: 'border-rose-500/30 bg-rose-500/5',
}

const PRESET_ACTIVE_COLORS: Record<NSFWPreset, string> = {
  neutral: 'border-white/20 bg-white/5',
  softcore: 'border-amber-500/60 bg-amber-500/15',
  artistic: 'border-blue-500/60 bg-blue-500/15',
  explicit: 'border-purple-500/60 bg-purple-500/15',
  pornographic: 'border-rose-500/60 bg-rose-500/15',
}

export function QualityPresetPicker({ open, onClose, currentPreset, onSelect, prompt }: Props) {
  const detectedPreset = prompt ? detectPresetFromPrompt(prompt) : null

  const pick = (preset: NSFWPreset) => {
    haptic('select')
    onSelect(preset)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Quality preset">
      {detectedPreset && detectedPreset !== currentPreset && (
        <div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/50">
          Detected from prompt: <span className="font-medium text-white/70">{NSFW_PRESETS[detectedPreset].label}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 pb-2">
        {(Object.entries(NSFW_PRESETS) as [NSFWPreset, typeof NSFW_PRESETS[NSFWPreset]][]).map(([key, config]) => {
          const active = key === currentPreset
          const color = active ? PRESET_ACTIVE_COLORS[key] : PRESET_COLORS[key]

          return (
            <button
              key={key}
              onClick={() => pick(key)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${color}`}
            >
              <div className="mt-0.5 shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/50">
                  <path d={PRESET_ICONS[key]} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-white/90">{config.label}</span>
                  <span className="text-[11px] text-white/30">
                    {config.steps.default} steps · CFG {config.cfg.default}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-white/45 leading-snug">{config.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {config.recommendedModels.slice(0, 2).map((m) => (
                    <span key={m} className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/35">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              {active && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}
