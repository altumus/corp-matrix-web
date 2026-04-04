import { useEffect, useRef, useState } from 'react'
import {
  requestNotificationPermission,
  initNotificationSound,
  setupNotificationListeners,
  setupAudioUnlock,
} from '../services/notificationService.js'
import { subscribeToPush } from '../services/pushService.js'

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied',
  )
  const setupRef = useRef(false)

  useEffect(() => {
    if (setupRef.current) return
    setupRef.current = true

    initNotificationSound()
    setupAudioUnlock()
    setupNotificationListeners()

    if ('Notification' in window && Notification.permission === 'default') {
      requestNotificationPermission().then((granted) => {
        setPermission(granted ? 'granted' : 'denied')
        if (granted) subscribeToPush()
      })
    } else if ('Notification' in window && Notification.permission === 'granted') {
      subscribeToPush()
    }
  }, [])

  const enable = async () => {
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
    if (granted) subscribeToPush()
  }

  return { permission, enable }
}
