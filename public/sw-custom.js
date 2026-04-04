self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { body: event.data.text() }
  }

  const title = data.sender || data.room_name || 'Corp Matrix'
  const body = data.body || 'Новое сообщение'
  const roomId = data.room_id || ''

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/corp-logo.png',
      badge: '/corp-logo.png',
      tag: roomId || undefined,
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
