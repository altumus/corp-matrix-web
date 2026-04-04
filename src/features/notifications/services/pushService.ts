import { getMatrixClient } from '../../../shared/lib/matrixClient.js'

function getUserPushkey(): string | null {
  const client = getMatrixClient()
  if (!client) return null
  const userId = client.getUserId()
  if (!userId) return null
  const hash = simpleHash(userId)
  return `corp-matrix-${hash}`
}

function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function getVapidKey(): Promise<string> {
  console.log('[Push] Fetching VAPID key...')
  const res = await fetch('/api/push/subscribe')
  if (!res.ok) throw new Error(`Failed to get VAPID key: ${res.status}`)
  const data = await res.json()
  console.log('[Push] Got VAPID key')
  return data.public_key
}

async function subscribeWebPush(vapidKey: string): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready
  console.log('[Push] Service worker ready')

  let subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    console.log('[Push] Reusing existing Web Push subscription')
    return subscription
  }

  console.log('[Push] Creating new Web Push subscription...')
  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
  })
  console.log('[Push] Web Push subscription created')
  return subscription
}

async function registerSubscription(
  pushkey: string,
  subscription: PushSubscription,
): Promise<void> {
  console.log('[Push] Registering subscription on server...')
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pushkey, subscription: subscription.toJSON() }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Subscription registration failed: ${res.status} ${text}`)
  }
  console.log('[Push] Subscription registered')
}

async function registerMatrixPusher(pushkey: string): Promise<void> {
  const client = getMatrixClient()
  if (!client) throw new Error('Matrix client not available')

  const gatewayUrl = `${window.location.origin}/_matrix/push/v1/notify`
  console.log('[Push] Registering Matrix pusher — pushkey:', pushkey, 'gateway:', gatewayUrl)

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
      format: 'event_id_only',
    },
    append: false,
  } as never)

  console.log('[Push] Matrix pusher registered')
}

export async function subscribeToPush(): Promise<boolean> {
  const pushkey = getUserPushkey()
  if (!pushkey) throw new Error('Matrix client not ready — no user ID')

  console.log('[Push] Starting push setup, pushkey:', pushkey)

  const vapidKey = await getVapidKey()
  const subscription = await subscribeWebPush(vapidKey)
  await registerSubscription(pushkey, subscription)
  await registerMatrixPusher(pushkey)

  console.log('[Push] All done — native push notifications active!')
  return true
}

export function getPushTopic(): string | null {
  return getUserPushkey()
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const client = getMatrixClient()
    const pushkey = getUserPushkey()
    if (client && pushkey) {
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
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushkey }),
      })
    }

    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()

    console.log('[Push] Unsubscribed')
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err)
  }
}
