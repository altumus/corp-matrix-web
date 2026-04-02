import { useEffect, useRef, useState } from 'react'
import {
  requestNotificationPermission,
  initNotificationSound,
  setupNotificationListeners,
} from '../services/notificationService.js'

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied',
  )
  const setupRef = useRef(false)

  useEffect(() => {
    if (setupRef.current) return
    setupRef.current = true

    initNotificationSound()
    setupNotificationListeners()

    if ('Notification' in window && Notification.permission === 'default') {
      requestNotificationPermission().then((granted) => {
        setPermission(granted ? 'granted' : 'denied')
      })
    }
  }, [])

  const enable = async () => {
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
  }

  return { permission, enable }
}
