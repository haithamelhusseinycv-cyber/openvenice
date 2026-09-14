import { useMemo, useState } from 'react'
import { useSettingsStore } from '../../stores/settings-store'
import { useImageWorkspace } from '../../stores/image-workspace-store'
import { useModels } from '../../hooks/use-models'
import { useAuthStore } from '../../stores/auth-store'
import { Select } from '../ui/select'
import { StatusDot } from '../ui/shared'
import { BottomSheet } from '../ui/bottom-sheet'
import { haptic } from '../../lib/haptics'
import { BillingBar } from './billing-bar'

const modelTypeMap: Record<string, string> = {
  chat: 'text',
  image: 'image',
  audio: 'tts',
  music: 'music',
  video: 'video',
  embeddings: 'embedding',
}

const tabLabels: Record<string, string> = {
  chat: 'Chat',
  image: 'Create',
  audio: 'Audio',
  music: 'Music',
  video: 'Video',
  embeddings: 'Embeddings',
  workflows: 'Workflows',
  playground: 'Noor',
}

const tabSubtitles: Record<string, string> = {
  chat: 'Conversational AI',
  image: 'Image generation and editing',
  audio: 'Text-to-speech and transcription',
  music: 'Generate music and sound',
  video: 'Generate video clips',
  embeddings: 'Vector representations of text',
  workflows: 'Chain models visually',
  playground: 'Adult companion · reason and create',
}

const noModelSelector = new Set(['video', 'workflows', 'playground'])

interface Props {
  onOpenApiKey: () => void
  onOpenDiagnostics: () => void
  onOpenMobileSidebar?: () => void
}

export function Header({ onOpenApiKey, onOpenDiagnostics, onOpenMobileSidebar }: Props) {
  const { activeTab, selectedModels, setSelectedModel, toggleSidebar } = useSettingsStore()
  const imageSubTab = useImageWorkspace((s) => s.imageSubTab)
  const apiKey = useAuthStore((s) => s.apiKey)
  const hideImageModels = activeTab === 'image' && imageSubTab === 'tools'
  const hasOwnSelector = noModelSelector.has(activeTab) || hideImageModels
  const modelType = modelTypeMap[activeTab] || 'text'
  const { data: models } = useModels(hasOwnSelector ? undefined : modelType)
  const currentModel = hasOwnSelector ? '' : (selectedModels[activeTab] || models?.[0]?.id || '')
  const modelOptions = useMemo(
    () => (hasOwnSelector ? [] : (models?.map((m) => ({ value: m.id, label: m.model_spec?.name || m.id })) ?? [])),
    [hasOwnSelector, models],
  )
  const [modelSheetOpen, setModelSheetOpen] = useState(false)
  const [modelQuery, setModelQuery] = useState('')

  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase()
    if (!query) return modelOptions
    return modelOptions.filter((option) => option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query))
  }, [modelOptions, modelQuery])

  const currentModelLabel = modelOptions.find((option) => option.value === currentModel)?.label || currentModel || 'Model'

  const pickModel = (value: string) => {
    haptic('select')
    setSelectedModel(activeTab, value)
    setModelSheetOpen(false)
    setModelQuery('')
  }

  return (
    <header className="flex max-w-full min-w-0 items-center gap-1.5 border-b border-white/[0.05] bg-[var(--color-bg-base)] px-2 py-1 pt-[max(0.25rem,env(safe-area-inset-top))] sm:min-h-14 sm:gap-3 sm:px-3 sm:py-0 sm:pt-[env(safe-area-inset-top)]">
      <button
        onClick={() => { haptic('tap'); onOpenMobileSidebar?.() }}
        aria-label="Open menu"
        className="lg:hidden flex shrink-0 text-white/80 hover:text-white transition-colors p-2 -ml-1 rounded-md min-h-11 min-w-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      <button
        onClick={() => { haptic('tap'); toggleSidebar() }}
        aria-label="Toggle sidebar"
        className="hidden lg:block shrink-0 text-white/55 hover:text-white transition-colors p-1.5 -ml-1 rounded-md min-h-11 min-w-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M3 4h18M3 12h12M3 20h18" />
        </svg>
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold text-[#f4efe8] leading-none">{tabLabels[activeTab]}</span>
        {!hasOwnSelector ? (
          <button
            type="button"
            onClick={() => { haptic('tap'); setModelSheetOpen(true) }}
            aria-haspopup="dialog"
            className="mt-0.5 flex max-w-full min-h-8 items-center gap-1 self-start rounded-full border border-white/[0.09] bg-white/[0.04] px-2 py-0.5 text-[11.5px] font-medium text-white/65 transition-colors hover:border-white/[0.2] hover:text-white sm:hidden"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]/80" aria-hidden="true" />
            <span className="max-w-[46vw] truncate">{currentModelLabel}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        ) : (
          <span className="text-[11px] text-[#938b85] mt-0.5 leading-none truncate hidden sm:block">{tabSubtitles[activeTab]}</span>
        )}
      </div>

      {!hasOwnSelector && (
        <Select
          value={currentModel}
          onChange={(v) => setSelectedModel(activeTab, v)}
          options={modelOptions}
          searchable
          placeholder="Model"
          className="hidden sm:block sm:w-52 sm:flex-none"
        />
      )}

      <div className="flex shrink-0 items-center justify-end gap-1 sm:ml-auto">
        <BillingBar />
        <button
          onClick={onOpenDiagnostics}
          aria-label="Device diagnostics"
          title="Device diagnostics"
          className="shrink-0 flex min-h-11 min-w-11 items-center justify-center rounded-md border border-white/[0.1] px-2 text-white/60 transition-colors hover:border-white/[0.22] hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h4l2-7 4 12 2-5h4" /><path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg>
        </button>
        <button
          onClick={() => { haptic('tap'); onOpenApiKey() }}
          aria-label={apiKey ? 'API key connected, manage' : 'Connect API key'}
          className="shrink-0 flex items-center gap-2 text-[13px] px-2.5 py-2 rounded-md border border-white/[0.12] hover:border-white/[0.25] min-h-11 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
        >
          <StatusDot tone={apiKey ? 'emerald' : 'slate'} pulsing={!apiKey} />
          <span className={apiKey ? 'text-[#f4efe8] font-medium hidden sm:inline' : 'text-white/80'}>
            {apiKey ? 'Ready' : 'Key'}
          </span>
        </button>
      </div>

      <BottomSheet open={modelSheetOpen} onClose={() => { setModelSheetOpen(false); setModelQuery('') }} title="Choose model">
        <div className="sticky -top-4 z-10 -mx-4 bg-[#15151b] px-4 pb-3 pt-1">
          <input
            value={modelQuery}
            onChange={(e) => setModelQuery(e.target.value)}
            placeholder="Search models…"
            aria-label="Search models"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 py-2.5 text-[16px] text-white outline-none placeholder:text-white/30 focus:border-white/[0.25]"
          />
        </div>
        {filteredModels.length === 0 ? (
          <div className="px-1 py-6 text-center text-[14px] text-white/40">No models match “{modelQuery}”.</div>
        ) : (
          <ul className="flex flex-col gap-0.5 pb-2">
            {filteredModels.map((option) => {
              const active = option.value === currentModel
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => pickModel(option.value)}
                    aria-current={active || undefined}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[15px] transition-colors ${
                      active
                        ? 'bg-[var(--color-accent-soft)] text-white'
                        : 'text-white/75 hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {active && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </BottomSheet>
    </header>
  )
}
