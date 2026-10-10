import { useSettingsStore } from '../../stores/settings-store'
import { APP_ROUTES } from '../../lib/app-routes'
import { haptic } from '../../lib/haptics'
interface MobileNavProps { onQuickCreate?: () => void }
export const MobileNav: React.FC<MobileNavProps> = () => {
  const active = useSettingsStore(s => s.activeTab)
  const select = useSettingsStore(s => s.setActiveTab)
  return <nav aria-label="Mobile navigation" className="lg:hidden shrink-0 border-t border-white/10 glass">
    <div className="grid grid-cols-3 gap-2 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {([{ id: 'studio', label: 'Studio', icon: '✦' }, { id: 'playground', label: 'Noor', icon: '◌' }, { id: 'image', label: 'Image', icon: '▧' }] as const).map(item =>
        <a key={item.id} href={APP_ROUTES[item.id]} aria-current={active === item.id ? 'page' : undefined}
          onClick={event => { event.preventDefault(); haptic('tap'); select(item.id) }}
          className={'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs ' + (active === item.id ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-white/60')}>
          <span aria-hidden="true" className="text-xl">{item.icon}</span><span>{item.label}</span>
        </a>)}
    </div>
  </nav>
}
