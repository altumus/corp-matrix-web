const CACHE_NAME = 'corp-matrix-v1'
const STATIC_ASSETS = [
  '/',
  '/corp-logo.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  if (request.url.includes('/_matrix/')) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })

      return cached || fetched
    })
  )
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || 'Corp Matrix'
  const options = {
    body: data.body || '',
    icon: '/corp-logo.png',
    badge: '/corp-logo.png',
    data: { roomId: data.roomId },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const roomId = event.notification.data?.roomId
  const url = roomId ? `/rooms/${encodeURIComponent(roomId)}` : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
