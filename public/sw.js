/* Zurvo service worker — the piece that makes the app installable.
   Chrome only offers "Install app" when a service worker with a fetch handler is
   present; this is that handler, kept deliberately small.

   Caching strategy is chosen to never serve staleness:
     • navigations (HTML)  -> network first, cache only as an offline fallback,
       so a fresh deploy is seen immediately (the old stale-chunk pain).
     • static same-origin   -> cache first; safe because Next.js filenames are
       content-hashed, so a new build is a new URL, never an overwrite.
     • cross-origin (Supabase, Unsplash, fonts) -> untouched, straight to network. */
const CACHE = 'zurvo-v1'
const SHELL = ['/', '/get/', '/manifest.json', '/icon-192.png', '/icon.png']

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  if (new URL(req.url).origin !== location.origin) return // leave Supabase/CDNs alone

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('/'))))
    return
  }

  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            return res
          })
          .catch(() => cached),
    ),
  )
})
