import { useSettingsStore, type Tab } from '../../stores/settings-store'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface MobileNavProps {
  onQuickCreate?: () => void
}

function NoorIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M4.9 4.9l2.8 2.8M2 12h4M18 12h4M16.3 7.7l2.8-2.8" />
      <rect x="5" y="9" width="14" height="11" rx="3" />
      <circle cx="9" cy="14" r="1" fill="currentColor" />
      <circle cx="15" cy="14" r="1" fill="currentColor" />
    </svg>
  )
}

function CreateIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

export function MobileNav({ onQuickCreate }: MobileNavProps) {
  const activeTab = useSettingsStore((s) => s.activeTab)
  const setActiveTab = useSettingsStore((s) => s.setActiveTab)

  const handleTabChange = (id: Tab) => {
    if (id !== activeTab) {
      haptic('tap')
      setActiveTab(id)
    }
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden shrink-0 border-t border-white/[0.1] glass"
    >
      <div role="tablist" className="grid grid-cols-3 gap-2 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          role="tab"
          type="button"
          onClick={() => handleTabChange('playground')}
          aria-current={activeTab === 'playground' ? 'page' : undefined}
          aria-selected={activeTab === 'playground'}
          className={cn(
            'relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 transition-all min-h-[3.5rem]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]',
            activeTab === 'playground'
              ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
              : 'text-white/50 active:text-white/80 active:bg-white/5'
          )}
        >
          {activeTab === 'playground' && (
            <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent)]" />
          )}
          <NoorIcon active={activeTab === 'playground'} />
          <span className="text-[11px] font-medium leading-none">Chat</span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic('select')
            onQuickCreate?.()
          }}
          className="relative -mt-6 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/80 shadow-lg shadow-[var(--color-accent)]/30 active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          aria-label="Quick create"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <button
          role="tab"
          type="button"
          onClick={() => handleTabChange('image')}
          aria-current={activeTab === 'image' ? 'page' : undefined}
          aria-selected={activeTab === 'image'}
          className={cn(
            'relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 transition-all min-h-[3.5rem]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]',
            activeTab === 'image'
              ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
              : 'text-white/50 active:text-white/80 active:bg-white/5'
          )}
        >
          {activeTab === 'image' && (
            <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent)]" />
          )}
          <CreateIcon active={activeTab === 'image'} />
          <span className="text-[11px] font-medium leading-none">Image</span>
        </button>
      </div>
    </nav>
  )
}
