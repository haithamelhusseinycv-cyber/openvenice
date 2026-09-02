import { cn } from '../../lib/utils'
import { useSettingsStore, type Tab } from '../../stores/settings-store'
import { VeniceLogo, VeniceWordmark } from '../ui/logo'

function AgentIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M4.9 4.9l2.8 2.8M2 12h4M18 12h4M16.3 7.7l2.8-2.8" /><rect x="5" y="9" width="14" height="11" rx="3" /><circle cx="9" cy="14" r="1" fill="currentColor" /><circle cx="15" cy="14" r="1" fill="currentColor" /><path d="M9 17h6" /></svg>)
}
function ImageIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>)
}

interface NavGroup {
  label: string
  items: Array<{ id: Tab; label: string; Icon: () => React.JSX.Element }>
}

const navGroups: NavGroup[] = [
  {
    label: 'App',
    items: [
      { id: 'playground', label: 'Noor', Icon: AgentIcon },
      { id: 'image', label: 'Create', Icon: ImageIcon },
    ],
  },
]

interface Props {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: Props) {
  const activeTab = useSettingsStore((s) => s.activeTab)
  const setActiveTab = useSettingsStore((s) => s.setActiveTab)
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen)
  const expanded = sidebarOpen || mobileOpen

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        'flex flex-col h-full bg-[#0d0d11] border-r border-white/[0.05] transition-all duration-200 ease-out',
        'fixed top-0 left-0 z-40 w-72 h-[100dvh] lg:static lg:h-full lg:w-auto',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        sidebarOpen ? 'lg:w-64' : 'lg:w-[60px]',
      )}
    >
      <div className={cn('flex items-center gap-2.5 h-14 shrink-0 border-b border-white/[0.04]', expanded ? 'px-4' : 'lg:px-3 lg:justify-center px-4')}>
        <VeniceLogo size={20} />
        {expanded && <VeniceWordmark className="text-[15px] tracking-tight" />}
        <button
          onClick={onMobileClose}
          aria-label="Close menu"
          className="lg:hidden ml-auto p-1 text-white/45 hover:text-white/80 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <nav aria-label="Sections" className="flex flex-col gap-3 py-3 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className={cn(expanded ? 'px-2' : 'lg:px-1.5 px-2')}>
            {expanded && (
              <div className="px-2 pb-1.5 text-[10.5px] uppercase tracking-[0.1em] text-white/30 font-semibold">
                {group.label}
              </div>
            )}
            <div className="flex flex-col gap-px">
              {group.items.map(({ id, label, Icon }) => {
                const isActive = activeTab === id
                return (
                  <button
                    key={id}
                    onClick={() => { setActiveTab(id); onMobileClose?.() }}
                    aria-current={isActive ? 'page' : undefined}
                    title={!expanded ? label : undefined}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-lg text-[14px] transition-all duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2',
                      expanded ? 'px-2.5 py-2' : 'lg:px-0 lg:py-2 lg:justify-center px-2.5 py-2',
                      isActive
                        ? 'bg-white/[0.06] text-white'
                        : 'text-white/55 hover:text-white hover:bg-white/[0.03]',
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-[var(--color-accent)]" />
                    )}
                    <Icon />
                    {expanded && <span className="font-medium">{label}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      {expanded && (
        <div className="px-3 py-2.5 border-t border-white/[0.04]">
          <div className="text-[11px] text-white/35 space-y-0.5">
            <div className="flex justify-between"><span>New Noor chat</span><kbd className="font-mono text-white/50">⌘N</kbd></div>
            <div className="flex justify-between"><span>Switch tab</span><kbd className="font-mono text-white/50">⌘1-2</kbd></div>
          </div>
        </div>
      )}
    </aside>
  )
}
