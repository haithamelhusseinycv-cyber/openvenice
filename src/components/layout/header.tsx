import { useSettingsStore } from '../../stores/settings-store'
import { useImageWorkspace } from '../../stores/image-workspace-store'
import { useModels } from '../../hooks/use-models'
import { useAuthStore } from '../../stores/auth-store'
import { Select } from '../ui/select'
import { StatusDot } from '../ui/shared'
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
  const modelOptions = hasOwnSelector ? [] : (models?.map((m) => ({ value: m.id, label: m.model_spec?.name || m.id })) ?? [])

  return (
    <header className="grid max-w-full min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 border-b border-white/[0.05] bg-[var(--color-bg-base)] px-2 py-1 pt-[max(0.25rem,env(safe-area-inset-top))] sm:flex sm:min-h-14 sm:flex-nowrap sm:gap-3 sm:px-3 sm:py-0 sm:pt-[env(safe-area-inset-top)]">
      <button
        onClick={() => onOpenMobileSidebar?.()}
        aria-label="Open menu"
        className="col-start-1 row-start-1 lg:hidden text-white/80 hover:text-white transition-colors p-2 -ml-1 rounded-md min-h-11 min-w-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      <button
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="hidden lg:block text-white/55 hover:text-white transition-colors p-1.5 -ml-1 rounded-md min-h-11 min-w-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M3 4h18M3 12h12M3 20h18" />
        </svg>
      </button>

      <div className="col-start-2 row-start-1 flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold text-[#f4efe8] leading-none">{tabLabels[activeTab]}</span>
        <span className="text-[11px] text-[#938b85] mt-0.5 leading-none truncate hidden sm:block">{tabSubtitles[activeTab]}</span>
      </div>

      {!hasOwnSelector && (
        <Select
          value={currentModel}
          onChange={(v) => setSelectedModel(activeTab, v)}
          options={modelOptions}
          searchable
          placeholder="Model"
          className="col-start-1 col-end-4 row-start-2 min-w-0 sm:w-52 sm:flex-none"
        />
      )}

      <div className="col-start-3 row-start-1 flex min-w-0 items-center justify-end gap-1 sm:ml-auto">
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
          onClick={onOpenApiKey}
          aria-label={apiKey ? 'API key connected, manage' : 'Connect API key'}
          className="shrink-0 flex items-center gap-2 text-[13px] px-2.5 py-2 rounded-md border border-white/[0.12] hover:border-white/[0.25] min-h-11 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
        >
          <StatusDot tone={apiKey ? 'emerald' : 'slate'} pulsing={!apiKey} />
          <span className={apiKey ? 'text-[#f4efe8] font-medium hidden sm:inline' : 'text-white/80'}>
            {apiKey ? 'Ready' : 'Key'}
          </span>
        </button>
      </div>
    </header>
  )
}
