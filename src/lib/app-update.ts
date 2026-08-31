const RECOVERY_KEY = 'openvenice-build-recovery'
const RECOVERY_COOLDOWN_MS = 30_000

const STALE_BUILD_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [\w-]+ failed/i,
  /chunkloaderror/i,
]

export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '')
  return STALE_BUILD_PATTERNS.some((pattern) => pattern.test(message))
}

async function clearBuildCaches() {
  if ('caches' in window) {
    const keys = await window.caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith('openvenice-shell-'))
        .map((key) => window.caches.delete(key)),
    )
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)))
  }
}

export async function recoverFromStaleBuild(force = false): Promise<void> {
  let lastRecovery = 0
  try {
    lastRecovery = Number(sessionStorage.getItem(RECOVERY_KEY) || 0)
  } catch {
    /* private mode */
  }

  if (!force && Date.now() - lastRecovery < RECOVERY_COOLDOWN_MS) return

  try {
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()))
  } catch {
    /* private mode */
  }

  try {
    await clearBuildCaches()
  } finally {
    const next = new URL(window.location.href)
    next.searchParams.set('app-update', String(Date.now()))
    window.location.replace(next.toString())
  }
}

function currentEntryScript(): string {
  const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
  return entry?.src ? new URL(entry.src, window.location.href).pathname : ''
}

function entryScriptFromHtml(html: string): string {
  const match = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i)
    ?? html.match(/<script[^>]+src=["']([^"']+)["'][^>]+type=["']module["']/i)
  return match?.[1] ? new URL(match[1], window.location.href).pathname : ''
}

export async function checkForNewBuild(): Promise<void> {
  if (document.visibilityState !== 'visible') return
  if (document.querySelector('[aria-busy="true"]')) return

  const current = currentEntryScript()
  if (!current) return

  try {
    const url = new URL('/', window.location.origin)
    url.searchParams.set('build-check', String(Date.now()))
    const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'text/html' } })
    if (!response.ok) return
    const latest = entryScriptFromHtml(await response.text())
    if (latest && latest !== current) await recoverFromStaleBuild()
  } catch {
    // Being offline should not interrupt the active app.
  }
}
