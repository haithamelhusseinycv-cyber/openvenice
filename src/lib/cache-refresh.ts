const SIX_HOURS = 6 * 60 * 60 * 1000
const BOOT_KEY = 'venice-cache-boot'
const CHECK_KEY = 'venice-cache-checked'

function bootStamp() {
  try {
    if (!sessionStorage.getItem(BOOT_KEY)) {
      sessionStorage.setItem(BOOT_KEY, String(Date.now()))
    }
  } catch {
    /* ignore */
  }
}

function lastCheck(): number {
  try {
    return Number(localStorage.getItem(CHECK_KEY) || 0)
  } catch {
    return 0
  }
}

function markCheck() {
  try {
    localStorage.setItem(CHECK_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

async function newerBundle(): Promise<boolean> {
  try {
    const res = await fetch(`/?cache=${Date.now()}`, { cache: 'no-store' })
    const html = await res.text()
    const remote = html.match(/\/assets\/[^"']+\.js/g) || []
    if (remote.length === 0) return false
    const local = [...document.scripts].map((s) => s.src).join(' ')
    return remote.some((src) => !local.includes(src.replace(/^\//, '')))
  } catch {
    return false
  }
}

async function refreshIfDue() {
  const due = Date.now() - lastCheck() >= SIX_HOURS
  if (!due) return
  markCheck()
  if (document.visibilityState !== 'visible') return
  if (await newerBundle()) {
    location.reload()
    return
  }
  location.reload()
}

export function startCacheRefresh() {
  bootStamp()
  const tick = () => {
    void refreshIfDue()
  }
  window.setInterval(tick, 15 * 60 * 1000)
  document.addEventListener('visibilitychange', tick)
  window.setTimeout(tick, 20_000)
}
