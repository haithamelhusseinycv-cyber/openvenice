import { ImageView } from './image-view'
import { ImageTools } from './image-tools'
import { useImageWorkspace, type ImageSubTab } from '../../stores/image-workspace-store'
import { SegmentedControl } from '../ui/segmented-control'
import { haptic } from '../../lib/haptics'

const TABS: { value: ImageSubTab; label: string }[] = [
  { value: 'generate', label: 'Generate' },
  { value: 'tools', label: 'Tools' },
]

export function ImagePage() {
  const tab = useImageWorkspace((s) => s.imageSubTab)
  const setTab = useImageWorkspace((s) => s.setImageSubTab)

  return (
    <div className="flex h-full max-w-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex items-center px-4 py-2.5 border-b border-white/[0.055] bg-[#0d0d11]/80">
        <SegmentedControl
          ariaLabel="Create mode"
          className="w-full max-w-xs"
          options={TABS}
          value={tab}
          onChange={(next) => { haptic('select'); setTab(next) }}
        />
      </div>
      <div className="max-w-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {tab === 'generate' ? <ImageView /> : <ImageTools />}
      </div>
    </div>
  )
}
