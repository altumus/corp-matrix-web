self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const roomId = event.notification.tag
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
