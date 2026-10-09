import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore, type Tab } from './stores/settings-store';
import { usePlaygroundStore } from './stores/playground-store';
import { useAuthStore } from './stores/auth-store';
import { Sidebar } from './components/layout/sidebar';
import { Header } from './components/layout/header';
import { MobileNav } from './components/layout/mobile-nav';
import { ApiKeyDialog } from './components/layout/api-key-dialog';
import { DeviceDiagnosticsDialog } from './components/chat/device-diagnostics-dialog';
import { ErrorBoundary } from './components/ui/error-boundary';
import { Toaster } from './components/ui/toaster';
import { LockScreen } from './components/ui/lock-screen';
import { CommandPalette, useCommandPalette } from './components/ui/command-palette';
import { BottomSheet } from './components/ui/bottom-sheet';
import { biometricGateAvailability } from './lib/auth-gate';
import { isVisibleTab } from './lib/allowed-models';
import { haptic } from './lib/haptics';
import { checkVoiceTutHealth } from './lib/venice-client';
import { readLastCrashReport, clearLastCrashReport, copyCrashReport } from './lib/crash-report';
import { toast } from './stores/toast-store';
import { hydrateProxyAccessTokenFromDevice } from './lib/proxy-access';
import { generationExecutor } from './services/generation-executor';
import { installGlobalHandlers } from './lib/error-monitor';
import type { RoutingDecision } from './agent/intelligent-router';

const ImagePage = lazy(() => import('./components/image/image-page').then((module) => ({ default: module.ImagePage })))
const PlaygroundView = lazy(() => import('./components/playground/playground-view').then((module) => ({ default: module.PlaygroundView })))
const SmartActionBar = lazy(() => import('./components/playground/smart-action-bar').then((module) => ({ default: module.SmartActionBar })))
const GenerationJobStatus = lazy(() => import('./components/playground/generation-job-status').then((module) => ({ default: module.GenerationJobStatus })))
const JobHistoryGallery = lazy(() => import('./components/playground/job-history-gallery').then((module) => ({ default: module.JobHistoryGallery })))

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
  const safeTab = (new URLSearchParams(window.location.search).has('recipe') || new URLSearchParams(window.location.search).has('preset')) ? 'image' : isVisibleTab(activeTab) ? activeTab : 'playground'
  const ActiveView = views[safeTab]
  const biometricLock = useSettingsStore((s) => s.biometricLock)
  const [gateReady, setGateReady] = useState(false)
  const [biometricUsable, setBiometricUsable] = useState(false)
  const [locked, setLocked] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const commandPalette = useCommandPalette()
  const relockArmedRef = useRef(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const handleQuickCreateRoute = useCallback((_decision: RoutingDecision, _enhancedPrompt: string) => {
void _decision;
void _enhancedPrompt;
    setQuickCreateOpen(false)
    setActiveTab('image')
  }, [setActiveTab])

  useEffect(() => {
    let disposed = false
    // Defer the gate probe until the first frame has painted. Locking during
    // bridge startup can race the activity window and black-screen the app on
    // some devices; a short delay keeps the shell visible before the prompt.
    const timer = window.setTimeout(() => {
      void biometricGateAvailability().then((availability) => {
        if (disposed) return
        const usable = availability.available
        setBiometricUsable(usable)
        setGateReady(true)
        if (usable && useSettingsStore.getState().biometricLock) setLocked(true)
      })
    }, 350)
    return () => { disposed = true; window.clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (!biometricUsable) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        relockArmedRef.current = true
        return
      }
      if (document.visibilityState === 'visible' && relockArmedRef.current) {
        relockArmedRef.current = false
        if (biometricLock) setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [biometricUsable, biometricLock])

  useEffect(() => {
    void hydrateFromDevice().then((restored) => {
      if (restored) setApiKeyOpen(false)
    })
  }, [hydrateFromDevice])

  useEffect(() => {
    installGlobalHandlers()
    void hydrateProxyAccessTokenFromDevice()
      .then(() => checkVoiceTutHealth())
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const onOnline = () => {
      void generationExecutor.processOfflineQueue()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const syncKeyboard = () => {
      const viewport = window.visualViewport
      if (!viewport) {
        root.style.setProperty('--keyboard-inset', '0px')
        document.body.classList.remove('chilli-keyboard-open')
        return
      }
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
      document.body.classList.toggle('chilli-keyboard-open', viewport.height < window.innerHeight - 140)
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
      document.body.classList.remove('chilli-keyboard-open')
    }
  }, [])

  useEffect(() => {
    if (!isVisibleTab(activeTab)) setActiveTab('playground')
  }, [activeTab, setActiveTab])

  useEffect(() => {
    // Surface any crash the previous run recorded, so failures on phones we
    // cannot reach are still diagnosable: copy the trace to the clipboard.
    let disposed = false
    const timer = window.setTimeout(() => {
      void (async () => {
        const report = await readLastCrashReport()
        if (disposed || !report?.found || !report.content?.trim()) return
        const copied = await copyCrashReport(report.content)
        toast.info(
          'Crash report from last run',
          copied ? 'Trace copied to clipboard — send it to Shahy.' : 'Saved in Downloads as openvenice-last-crash.txt.',
        )
        await clearLastCrashReport()
      })()
    }, 2500)
    return () => { disposed = true; window.clearTimeout(timer) }
  }, [])

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

  if (gateReady && locked) {
    return <LockScreen onUnlocked={() => { setLocked(false); haptic('success') }} />
  }

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
        <main
          className="max-w-full min-h-0 min-w-0 flex-1 overflow-hidden"
          onTouchStart={(e) => {
            const touch = e.touches[0]
            touchStart.current = { x: touch.clientX, y: touch.clientY }
          }}
          onTouchEnd={(e) => {
            const start = touchStart.current
            touchStart.current = null
            if (!start || window.innerWidth >= 1024) return
            const touch = e.changedTouches[0]
            const dx = touch.clientX - start.x
            const dy = touch.clientY - start.y
            if (Math.abs(dx) < 72 || Math.abs(dy) > Math.abs(dx) * 1.2) return
            const currentIndex = TAB_ORDER.indexOf(safeTab)
            const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1
            if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) return
            haptic('select')
            setActiveTab(TAB_ORDER[nextIndex])
          }}
        >
          <Suspense fallback={<div className="flex h-full items-center justify-center" role="status"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-accent)]" aria-hidden="true" /></div>}>
            <ErrorBoundary key={safeTab}>
              <ActiveView />
            </ErrorBoundary>
          </Suspense>
        </main>
        <MobileNav onQuickCreate={() => setQuickCreateOpen(true)} />
      </div>
      <BottomSheet open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} title="Quick Create">
        <Suspense fallback={<div className="flex h-32 items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-accent)]" /></div>}>
          <SmartActionBar onRoute={handleQuickCreateRoute} />
          <GenerationJobStatus />
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <JobHistoryGallery />
          </div>
        </Suspense>
      </BottomSheet>
      <ApiKeyDialog open={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />
      <DeviceDiagnosticsDialog open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
      <CommandPalette
        open={commandPalette.open}
        onClose={() => commandPalette.setOpen(false)}
        onOpenApiKey={() => setApiKeyOpen(true)}
        onOpenDiagnostics={() => setDiagnosticsOpen(true)}
      />
      <Toaster />
    </div>
  )
}
