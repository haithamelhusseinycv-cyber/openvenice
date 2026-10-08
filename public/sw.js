const CACHE_PREFIX = 'chilli-shell-'
const CACHE_NAME = CACHE_PREFIX + '__VERSION__'
const SHELL = __PRECACHE__
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    try { await cache.addAll(SHELL) } catch (error) { await caches.delete(CACHE_NAME); throw error }
  })())
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = (await caches.keys()).filter(k=>k.startsWith(CACHE_PREFIX))
    const previous = keys.filter(k=>k!==CACHE_NAME).pop()
    await Promise.all(keys.filter(k=>k!==CACHE_NAME && k!==previous).map(k=>caches.delete(k)))
    await self.clients.claim()
  })())
})
self.addEventListener('message', event => { if(event.data === 'SKIP_WAITING') self.skipWaiting() })
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if(request.method !== 'GET' || url.origin !== self.location.origin) return
  if(request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(request,{cache:'no-store'}) }
      catch { return (await caches.open(CACHE_NAME)).match('/index.html') }
    })())
  } else if(SHELL.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await (await caches.open(CACHE_NAME)).match(url.pathname)
      return cached || fetch(request)
    })())
  }
})
