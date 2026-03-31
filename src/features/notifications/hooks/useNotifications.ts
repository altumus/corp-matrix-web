import { useEffect, useState } from 'react'
import {
  requestNotificationPermission,
  initNotificationSound,
  setupNotificationListeners,
} from '../services/notificationService.js'

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied',
  )

  useEffect(() => {
    initNotificationSound()
    setupNotificationListeners()
  }, [])

  const enable = async () => {
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
  }

  return { permission, enable }
}
