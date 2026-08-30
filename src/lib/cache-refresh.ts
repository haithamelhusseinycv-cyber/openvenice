const SIX_HOURS = 6 * 60 * 60 * 1000
const CHECK_KEY = 'venice-cache-checked'

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

async function refreshIfDue() {
  const last = lastCheck()
  if (!last) {
    markCheck()
    return
  }
  if (Date.now() - last < SIX_HOURS) return
  if (document.visibilityState !== 'visible') return
  // Never reload while an API job, upload or agent task is active.
  if (document.querySelector('[aria-busy="true"]')) return
  markCheck()
  location.reload()
}

export function startCacheRefresh() {
  if (!lastCheck()) markCheck()
  const tick = () => {
    void refreshIfDue()
  }
  window.setInterval(tick, 15 * 60 * 1000)
  document.addEventListener('visibilitychange', tick)
}
