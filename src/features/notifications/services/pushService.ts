import { getMatrixClient } from '../../../shared/lib/matrixClient.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
const PUSH_GATEWAY_URL = import.meta.env.VITE_PUSH_GATEWAY_URL || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function subscriptionToPushkey(sub: PushSubscription): string {
  const json = JSON.stringify(sub.toJSON())
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not supported')
  }

  if (import.meta.env.DEV) {
    const reg = await navigator.serviceWorker.register('/sw-custom.js')
    await navigator.serviceWorker.ready
    return reg
  }

  return navigator.serviceWorker.ready
}

async function getWebPushSubscription(): Promise<PushSubscription> {
  const registration = await ensureServiceWorker()

  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
}

async function registerMatrixPusher(pushkey: string, gatewayUrl: string): Promise<void> {
  const client = getMatrixClient()
  if (!client) throw new Error('Matrix client not available')

  await client.setPusher({
    pushkey,
    kind: 'http',
    app_id: 'corp.matrix.web',
    app_display_name: 'Corp Matrix Web',
    device_display_name: navigator.userAgent.slice(0, 64),
    lang: navigator.language || 'ru',
    profile_tag: '',
    data: {
      url: gatewayUrl,
    },
    append: false,
  } as never)
}

export async function subscribeToPush(): Promise<boolean> {
  if (!('PushManager' in window)) throw new Error('Push API not supported')
  if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY not configured')

  const subscription = await getWebPushSubscription()
  const pushkey = subscriptionToPushkey(subscription)

  const gatewayBase = PUSH_GATEWAY_URL || window.location.origin
  const gatewayPushUrl = `${gatewayBase}/_matrix/push/v1/notify`

  if (PUSH_GATEWAY_URL) {
    const client = getMatrixClient()
    const userId = client?.getUserId() || 'unknown'
    await fetch(`${PUSH_GATEWAY_URL}/api/push-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), userId }),
    })
    console.log('[Push] Subscription sent to gateway')
  }

  if (gatewayPushUrl.startsWith('https://')) {
    await registerMatrixPusher(pushkey, gatewayPushUrl)
    console.log('[Push] Matrix pusher registered, gateway:', gatewayPushUrl)
  } else {
    console.log('[Push] Local dev mode — Matrix pusher skipped')
    console.log('[Push] Test at:', `${gatewayBase}/api/push-test`)
  }

  return true
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const client = getMatrixClient()
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (client && subscription) {
      const pushkey = subscriptionToPushkey(subscription)
      await client.setPusher({
        pushkey,
        kind: null,
        app_id: 'corp.matrix.web',
        app_display_name: 'Corp Matrix Web',
        device_display_name: '',
        lang: '',
        profile_tag: '',
        data: {},
      } as never)
    }

    if (subscription) await subscription.unsubscribe()
    console.log('[Push] Unsubscribed')
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err)
  }
}
