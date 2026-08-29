import { useSettingsStore } from '../../stores/settings-store'
import { useImageWorkspace } from '../../stores/image-workspace-store'
import { useModels } from '../../hooks/use-models'
import { useAuthStore } from '../../stores/auth-store'
import { Select } from '../ui/select'
import { StatusDot } from '../ui/shared'

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
  image: 'Image',
  audio: 'Audio',
  music: 'Music',
  video: 'Video',
  embeddings: 'Embeddings',
  workflows: 'Workflows',
  playground: 'Playground',
}

const tabSubtitles: Record<string, string> = {
  chat: 'Conversational AI',
  image: 'Lustify stills',
  audio: 'Text-to-speech and transcription',
  music: 'Generate music and sound',
  video: 'Generate video clips',
  embeddings: 'Vector representations of text',
  workflows: 'Chain models visually',
  playground: 'Build workflows by chatting',
}

const noModelSelector = new Set(['video', 'workflows', 'playground'])

interface Props {
  onOpenApiKey: () => void
  onOpenMobileSidebar?: () => void
}

export function Header({ onOpenApiKey, onOpenMobileSidebar }: Props) {
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
    <header className="flex items-center gap-2 sm:gap-3 h-14 px-2 sm:px-3 border-b border-white/[0.05] bg-[#0a0a0c] shrink-0 pt-[env(safe-area-inset-top)]">
      <button
        onClick={() => onOpenMobileSidebar?.()}
        aria-label="Open menu"
        className="md:hidden text-white/80 hover:text-white transition-colors p-2 -ml-1 rounded-md min-h-11 min-w-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      <button
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="hidden md:block text-white/55 hover:text-white transition-colors p-1.5 -ml-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M3 4h18M3 12h12M3 20h18" />
        </svg>
      </button>

      <div className="flex flex-col min-w-0 shrink-0">
        <span className="text-[15px] font-semibold text-white leading-none">{tabLabels[activeTab]}</span>
        <span className="text-[11px] text-white/50 mt-0.5 leading-none truncate hidden sm:block">{tabSubtitles[activeTab]}</span>
      </div>

      {!hasOwnSelector && (
        <Select
          value={currentModel}
          onChange={(v) => setSelectedModel(activeTab, v)}
          options={modelOptions}
          searchable
          placeholder="Model"
          className="min-w-0 flex-1 max-w-[46vw] sm:max-w-none sm:w-64"
        />
      )}

      <button
        onClick={onOpenApiKey}
        aria-label={apiKey ? 'API key connected, manage' : 'Connect API key'}
        className="shrink-0 flex items-center gap-2 text-[13px] px-2.5 py-2 rounded-md border border-white/[0.12] hover:border-white/[0.25] min-h-11 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
      >
        <StatusDot tone={apiKey ? 'teal' : 'slate'} pulsing={!apiKey} />
        <span className={apiKey ? 'text-white font-medium hidden xs:inline sm:inline' : 'text-white/80'}>
          {apiKey ? 'On' : 'Key'}
        </span>
      </button>
    </header>
  )
}
