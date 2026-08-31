import { checkForNewBuild } from './app-update'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

export function startCacheRefresh() {
  const tick = () => { void checkForNewBuild() }
  window.setTimeout(tick, 2_000)
  window.setInterval(tick, CHECK_INTERVAL_MS)
  document.addEventListener('visibilitychange', tick)
}
