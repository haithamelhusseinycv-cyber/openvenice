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
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/[0.04]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'text-[14px] font-medium px-3 min-h-11 rounded-full transition-all duration-150',
              tab === t.id ? 'bg-white text-black' : 'bg-white/[0.03] text-white/20 hover:text-white/40 hover:bg-white/[0.05]',
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
