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

const ImagePage = lazy(() => import('./components/image/image-page').then((module) => ({ default: module.ImagePage })))
const PlaygroundView = lazy(() => import('./components/playground/playground-view').then((module) => ({ default: module.PlaygroundView })))

const views = {
  playground: PlaygroundView,
  image: ImagePage,
} as const

const TAB_ORDER: Tab[] = ['playground', 'image']

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
          {([['playground', 'Noor'], ['image', 'Create']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={safeTab === id ? 'page' : undefined} className={`min-h-14 px-2 text-[13px] font-medium ${safeTab === id ? 'text-[var(--color-accent)] bg-white/[0.04]' : 'text-white/55'}`}>
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
