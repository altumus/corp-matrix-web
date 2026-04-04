import { useEffect, useRef, useState } from 'react'
import {
  requestNotificationPermission,
  initNotificationSound,
  setupNotificationListeners,
  setupAudioUnlock,
} from '../services/notificationService.js'
import { subscribeToPush } from '../services/pushService.js'

type PushStatus = 'idle' | 'subscribing' | 'active' | 'failed'

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied',
  )
  const [pushStatus, setPushStatus] = useState<PushStatus>('idle')
  const [pushError, setPushError] = useState<string | null>(null)
  const setupRef = useRef(false)

  const trySubscribePush = async () => {
    setPushStatus('subscribing')
    setPushError(null)
    try {
      const ok = await subscribeToPush()
      setPushStatus(ok ? 'active' : 'failed')
      if (!ok) setPushError('Push subscription returned false')
    } catch (err) {
      setPushStatus('failed')
      setPushError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    if (setupRef.current) return
    setupRef.current = true

    initNotificationSound()
    setupAudioUnlock()
    setupNotificationListeners()

    if ('Notification' in window && Notification.permission === 'default') {
      requestNotificationPermission().then((granted) => {
        setPermission(granted ? 'granted' : 'denied')
        if (granted) trySubscribePush()
      })
    } else if ('Notification' in window && Notification.permission === 'granted') {
      trySubscribePush()
    }
  }, [])

  const enable = async () => {
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
    if (granted) trySubscribePush()
  }

  return { permission, enable, pushStatus, pushError }
}
