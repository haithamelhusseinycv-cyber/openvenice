import { lazy, Suspense, useState, useEffect } from 'react'
import { useSettingsStore, type Tab } from './stores/settings-store'
import { useChatStore } from './stores/chat-store'
import { useAuthStore } from './stores/auth-store'
import { Sidebar } from './components/layout/sidebar'
import { Header } from './components/layout/header'
import { ApiKeyDialog } from './components/layout/api-key-dialog'
import { ErrorBoundary } from './components/ui/error-boundary'
import { Toaster } from './components/ui/toaster'
import { isVisibleTab } from './lib/allowed-models'

const ChatView = lazy(() => import('./components/chat/chat-view').then((module) => ({ default: module.ChatView })))
const ImagePage = lazy(() => import('./components/image/image-page').then((module) => ({ default: module.ImagePage })))
const PlaygroundView = lazy(() => import('./components/playground/playground-view').then((module) => ({ default: module.PlaygroundView })))

const views = {
  chat: ChatView,
  image: ImagePage,
  playground: PlaygroundView,
} as const

const TAB_ORDER: Tab[] = ['chat', 'image', 'playground']

export function App() {
  const needsUnlock = useAuthStore((s) => s.hasEncrypted && !s.apiKey)
  const [apiKeyOpen, setApiKeyOpen] = useState(needsUnlock)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const activeTab = useSettingsStore((s) => s.activeTab)
  const setActiveTab = useSettingsStore((s) => s.setActiveTab)
  const safeTab = isVisibleTab(activeTab) ? activeTab : 'chat'
  const ActiveView = views[safeTab]

  useEffect(() => {
    if (!isVisibleTab(activeTab)) setActiveTab('chat')
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
      if (mobileSidebarOpen) {
        setMobileSidebarOpen(false)
        return
      }
      if (apiKeyOpen) {
        setApiKeyOpen(false)
        return
      }
      if (safeTab !== 'chat') {
        setActiveTab('chat')
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [mobileSidebarOpen, apiKeyOpen, safeTab, setActiveTab])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      if (!isMeta) return

      if (e.key === 'n') {
        e.preventDefault()
        setActiveTab('chat')
        setMobileSidebarOpen(false)
        useChatStore.getState().setActiveConversation(null)
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
    <div className="flex h-[100dvh] w-full max-w-[100vw] overflow-hidden pb-[env(safe-area-inset-bottom)]">
      {mobileSidebarOpen && (
        <button
          aria-label="Close menu"
          className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header
          onOpenApiKey={() => setApiKeyOpen(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 min-h-0 overflow-hidden">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-[14px] text-white/45" role="status">Loading…</div>}>
            <ErrorBoundary key={safeTab}>
              <ActiveView />
            </ErrorBoundary>
          </Suspense>
        </main>
        <nav aria-label="Mobile navigation" className="lg:hidden shrink-0 grid grid-cols-3 border-t border-white/[0.08] bg-[#0d0d11] pb-[env(safe-area-inset-bottom)]">
          {([['chat', 'Chat'], ['image', 'Create'], ['playground', 'Noor']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={safeTab === id ? 'page' : undefined} className={`min-h-14 px-2 text-[13px] font-medium ${safeTab === id ? 'text-[var(--color-accent)] bg-white/[0.04]' : 'text-white/55'}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>
      <ApiKeyDialog open={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />
      <Toaster />
    </div>
  )
}
