/* TwinkleTune service worker — cache-first with background refresh,
   so the app keeps working offline after the first visit. */
const CACHE = 'twinkletune-v2'

/* Fonts are precached at install time. font-display:optional only uses a
   webface that is already available, so having the bytes in the cache before
   the next navigation is what guarantees the real typeface from then on. */
const PRECACHE = [
  './fonts/baloo2-v23-latin.woff2',
  './fonts/baloo2-v23-latin-ext.woff2',
  './fonts/nunito-v32-latin.woff2',
  './fonts/nunito-v32-latin-ext.woff2',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {
        /* a cold cache is not fatal — the fetch handler fills it in */
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  /* Fonts are versioned in their filename, so a cache hit is always correct
     and never needs a background refresh racing the first paint. */
  if (request.destination === 'font') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const res = await fetch(request)
        if (res && res.ok) cache.put(request, res.clone())
        return res
      }),
    )
    return
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const refresh = fetch(request)
        .then((res) => {
          if (res && res.ok) cache.put(request, res.clone())
          return res
        })
        .catch(() => cached)
      return cached || refresh
    }),
  )
})
