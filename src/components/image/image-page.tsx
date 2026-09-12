import { ImageView } from './image-view'
import { ImageTools } from './image-tools'
import { useImageWorkspace, type ImageSubTab } from '../../stores/image-workspace-store'
import { cn } from '../../lib/utils'

const TABS: { id: ImageSubTab; label: string }[] = [
  { id: 'generate', label: 'Generate' },
  { id: 'tools', label: 'Tools' },
]

export function ImagePage() {
  const tab = useImageWorkspace((s) => s.imageSubTab)
  const setTab = useImageWorkspace((s) => s.setImageSubTab)

  return (
    <div className="flex h-full max-w-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.055] bg-[#0d0d11]/80">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={cn(
              'text-[14px] font-semibold px-4 min-h-11 rounded-full border transition-all duration-150',
              tab === t.id
                ? 'border-white/[0.14] bg-white text-black'
                : 'border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white hover:border-white/[0.16]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="max-w-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {tab === 'generate' ? <ImageView /> : <ImageTools />}
      </div>
    </div>
  )
}
