import { getMatrixClient } from '../../../shared/lib/matrixClient.js'

const NTFY_SERVER = import.meta.env.VITE_NTFY_SERVER || 'https://ntfy.sh'
const NTFY_TOPIC_PREFIX = import.meta.env.VITE_NTFY_TOPIC_PREFIX || 'corp-matrix'

function getUserTopic(): string | null {
  const client = getMatrixClient()
  if (!client) return null
  const userId = client.getUserId()
  if (!userId) return null
  const hash = simpleHash(userId)
  return `${NTFY_TOPIC_PREFIX}-${hash}`
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

async function getNtfyVapidKey(): Promise<string> {
  console.log('[Push] Fetching VAPID key from', `${NTFY_SERVER}/v1/webpush`)
  const res = await fetch(`${NTFY_SERVER}/v1/webpush`)
  if (!res.ok) throw new Error(`Failed to get VAPID key: ${res.status} ${res.statusText}`)
  const data = await res.json()
  console.log('[Push] Got VAPID key:', data.public_key?.slice(0, 20) + '...')
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
  console.log('[Push] Web Push subscription created:', subscription.endpoint.slice(0, 60) + '...')
  return subscription
}

async function registerNtfySubscription(
  subscription: PushSubscription,
  topic: string,
): Promise<void> {
  const json = subscription.toJSON()
  console.log('[Push] Registering with ntfy for topic:', topic)
  const res = await fetch(`${NTFY_SERVER}/v1/webpush`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      topics: [topic],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ntfy registration failed: ${res.status} ${text}`)
  }
  console.log('[Push] Registered with ntfy successfully')
}

async function registerMatrixPusher(topic: string): Promise<void> {
  const client = getMatrixClient()
  if (!client) throw new Error('Matrix client not available')

  const pushkey = `${NTFY_SERVER}/${topic}`
  const pushUrl = `${NTFY_SERVER}/_matrix/push/v1/notify`
  console.log('[Push] Registering Matrix pusher — pushkey:', pushkey, 'url:', pushUrl)

  await client.setPusher({
    pushkey,
    kind: 'http',
    app_id: 'corp.matrix.web',
    app_display_name: 'Corp Matrix Web',
    device_display_name: navigator.userAgent.slice(0, 64),
    lang: navigator.language || 'ru',
    profile_tag: '',
    data: {
      url: pushUrl,
      format: 'event_id_only',
    },
    append: false,
  } as never)

  console.log('[Push] Matrix pusher registered successfully')
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Service Worker or PushManager not supported')
      return false
    }

    const topic = getUserTopic()
    if (!topic) {
      console.warn('[Push] No user topic — client not ready?')
      return false
    }
    console.log('[Push] Starting push subscription for topic:', topic)

    const vapidKey = await getNtfyVapidKey()
    const subscription = await subscribeWebPush(vapidKey)
    await registerNtfySubscription(subscription, topic)
    await registerMatrixPusher(topic)

    console.log('[Push] All done — push notifications active!')
    return true
  } catch (err) {
    console.error('[Push] Subscription failed:', err)
    return false
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const client = getMatrixClient()
    if (client) {
      const topic = getUserTopic()
      if (topic) {
        const pushkey = `${NTFY_SERVER}/${topic}`
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
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
    }
    console.log('[Push] Unsubscribed')
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err)
  }
}
