import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './mobile.css'
import './mobile-android.css'
import './mobile-polish.css'
import './premium-theme.css'
import { App } from './app'
import { ErrorBoundary } from './components/ui/error-boundary'
import { startCacheRefresh } from './lib/cache-refresh'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandledrejection]', e.reason)
})

startCacheRefresh()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let updateRequested = false
  const showUpdate = () => {
    if (document.getElementById('chilli-update-button')) return
    const button = document.createElement('button')
    button.id = 'chilli-update-button'
    button.textContent = 'Update ready · restart Chilli'
    button.style.cssText = 'position:fixed;bottom:80px;left:16px;right:16px;z-index:9999;padding:14px;border-radius:12px;background:#eee6d6;color:#171717'
    button.onclick = async () => {
      if (document.querySelector('[aria-busy="true"]')) { button.textContent = 'Finish or cancel your active job before updating'; return }
      const registration = await navigator.serviceWorker.getRegistration()
      updateRequested = true
      if (registration?.waiting) registration.waiting.postMessage('SKIP_WAITING')
      else window.location.reload()
    }
    document.body.appendChild(button)
  }
  window.addEventListener('chilli-update-ready', showUpdate)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        if (registration.waiting) showUpdate()
        registration.addEventListener('updatefound', () => {
          registration.installing?.addEventListener('statechange', () => {
            if (registration.waiting && navigator.serviceWorker.controller) showUpdate()
          })
        })
        return registration.update()
      })
      .catch((error) => {
        console.warn('[service-worker] registration failed', error)
      })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
