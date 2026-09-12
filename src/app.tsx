import { lazy, Suspense, useState, useEffect } from 'react'
import { useSettingsStore, type Tab } from './stores/settings-store'
import { usePlaygroundStore } from './stores/playground-store'
import { useAuthStore } from './stores/auth-store'
import { Sidebar } from './components/layout/sidebar'
import { Header } from './components/layout/header'
import { ApiKeyDialog } from './components/layout/api-key-dialog'
import { DeviceDiagnosticsDialog } from './components/chat/device-diagnostics-dialog'
import { ErrorBoundary } from './components/ui/error-boundary'
import { Toaster } from './components/ui/toaster'
import { isVisibleTab } from './lib/allowed-models'
import { checkVoiceTutHealth } from './lib/venice-client'

const ImagePage = lazy(() => import('./components/image/image-page').then((module) => ({ default: module.ImagePage })))
const PlaygroundView = lazy(() => import('./components/playground/playground-view').then((module) => ({ default: module.PlaygroundView })))

const views = {
  playground: PlaygroundView,
  image: ImagePage,
} as const

const TAB_ORDER: Tab[] = ['playground', 'image']

function AgentNavIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v4M4.9 4.9l2.8 2.8M2 12h4M18 12h4M16.3 7.7l2.8-2.8" />
      <rect x="5" y="9" width="14" height="11" rx="3" />
    </svg>
  )
}

function ImageNavIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

export function App() {
  const needsUnlock = useAuthStore((s) => s.hasEncrypted && !s.apiKey)
  const hydrateFromDevice = useAuthStore((s) => s.hydrateFromDevice)
  const [apiKeyOpen, setApiKeyOpen] = useState(needsUnlock)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const activeTab = useSettingsStore((s) => s.activeTab)
  const setActiveTab = useSettingsStore((s) => s.setActiveTab)
  const safeTab = isVisibleTab(activeTab) ? activeTab : 'playground'
  const ActiveView = views[safeTab]

  useEffect(() => {
    void hydrateFromDevice().then((restored) => {
      if (restored) setApiKeyOpen(false)
    })
  }, [hydrateFromDevice])

  useEffect(() => {
    void checkVoiceTutHealth().catch(() => undefined)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const syncKeyboard = () => {
      const viewport = window.visualViewport
      if (!viewport) {
        root.style.setProperty('--keyboard-inset', '0px')
        return
      }
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
    }
    syncKeyboard()
    window.visualViewport?.addEventListener('resize', syncKeyboard)
    window.visualViewport?.addEventListener('scroll', syncKeyboard)
    window.addEventListener('resize', syncKeyboard)
    return () => {
      window.visualViewport?.removeEventListener('resize', syncKeyboard)
      window.visualViewport?.removeEventListener('scroll', syncKeyboard)
      window.removeEventListener('resize', syncKeyboard)
      root.style.removeProperty('--keyboard-inset')
    }
  }, [])

  useEffect(() => {
    if (!isVisibleTab(activeTab)) setActiveTab('playground')
  }, [activeTab, setActiveTab])

  useEffect(() => {
    const onInvalidKey = () => setApiKeyOpen(true)
    window.addEventListener('venice-auth-invalid', onInvalidKey)
    return () => window.removeEventListener('venice-auth-invalid', onInvalidKey)
  }, [])

  useEffect(() => {
    const stay = () => {
      if (window.history.state?.venice !== 1) {
        window.history.pushState({ venice: 1 }, '')
      }
    }
    stay()
    const onPop = () => {
      const ev = new CustomEvent('venice-back', { cancelable: true })
      window.dispatchEvent(ev)
      stay()
      if (ev.defaultPrevented) return
      if (diagnosticsOpen) {
        setDiagnosticsOpen(false)
        return
      }
      if (mobileSidebarOpen) {
        setMobileSidebarOpen(false)
        return
      }
      if (apiKeyOpen) {
        setApiKeyOpen(false)
        return
      }
      if (safeTab !== 'playground') {
        setActiveTab('playground')
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [diagnosticsOpen, mobileSidebarOpen, apiKeyOpen, safeTab, setActiveTab])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      if (!isMeta) return

      if (e.key === 'n') {
        e.preventDefault()
        setActiveTab('playground')
        setMobileSidebarOpen(false)
        usePlaygroundStore.getState().clearConversation()
        return
      }

      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= TAB_ORDER.length) {
        e.preventDefault()
        setActiveTab(TAB_ORDER[num - 1])
        setMobileSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveTab])

  return (
    <div className="flex h-[100dvh] w-full max-w-[100vw] overflow-hidden pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {mobileSidebarOpen && (
        <button
          aria-label="Close menu"
          className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <div className="flex max-w-full flex-1 min-w-0 flex-col overflow-hidden">
        <Header
          onOpenApiKey={() => setApiKeyOpen(true)}
          onOpenDiagnostics={() => setDiagnosticsOpen(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="max-w-full min-h-0 min-w-0 flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-[14px] text-white/45" role="status">Loading…</div>}>
            <ErrorBoundary key={safeTab}>
              <ActiveView />
            </ErrorBoundary>
          </Suspense>
        </main>
        <nav aria-label="Mobile navigation" className="lg:hidden shrink-0 grid grid-cols-2 border-t border-white/[0.08] bg-[#0d0d11] pb-[env(safe-area-inset-bottom)]">
          {([['playground', 'Noor', AgentNavIcon], ['image', 'Create', ImageNavIcon]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={safeTab === id ? 'page' : undefined} className={`min-h-14 px-2 text-[12px] font-medium flex flex-col items-center justify-center gap-0.5 ${safeTab === id ? 'text-[var(--color-accent)]' : 'text-white/50'}`}>
              <Icon />
              {label}
            </button>
          ))}
        </nav>
      </div>
      <ApiKeyDialog open={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />
      <DeviceDiagnosticsDialog open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
      <Toaster />
    </div>
  )
}
