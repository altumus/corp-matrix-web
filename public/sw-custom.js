self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Corp Matrix', message: event.data.text() }
  }

  const title = payload.title || 'Corp Matrix'
  const body = payload.message || payload.body || ''
  const roomId = payload.topic || payload.tag || ''

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/corp-logo.png',
      tag: roomId,
      data: { roomId },
      renotify: !!roomId,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const roomId = event.notification.data?.roomId || event.notification.tag
  const urlToOpen = roomId
    ? `/rooms/${encodeURIComponent(roomId)}`
    : '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(urlToOpen)
          return
        }
      }
      return clients.openWindow(urlToOpen)
    })
  )
})
