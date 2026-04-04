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

async function getNtfyVapidKey(): Promise<string> {
  const res = await fetch(`${NTFY_SERVER}/v1/webpush`)
  if (!res.ok) throw new Error(`Failed to get VAPID key: ${res.status}`)
  const data = await res.json()
  return data.public_key
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function subscribeWebPush(vapidKey: string): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    return subscription
  }

  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
  })

  return subscription
}

async function registerNtfySubscription(
  subscription: PushSubscription,
  topic: string,
): Promise<void> {
  const json = subscription.toJSON()
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
    throw new Error(`Failed to register ntfy subscription: ${res.status} ${text}`)
  }
}

async function registerMatrixPusher(topic: string): Promise<void> {
  const client = getMatrixClient()
  if (!client) throw new Error('Matrix client not available')

  await client.setPusher({
    pushkey: topic,
    kind: 'http',
    app_id: 'corp.matrix.web',
    app_display_name: 'Corp Matrix Web',
    device_display_name: navigator.userAgent.slice(0, 64),
    lang: navigator.language || 'ru',
    profile_tag: '',
    data: {
      url: `${NTFY_SERVER}/_matrix/push/v1/notify`,
      format: 'event_id_only',
    },
    append: false,
  } as never)
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false
    }

    const topic = getUserTopic()
    if (!topic) return false

    const vapidKey = await getNtfyVapidKey()
    const subscription = await subscribeWebPush(vapidKey)
    await registerNtfySubscription(subscription, topic)
    await registerMatrixPusher(topic)

    return true
  } catch (err) {
    console.error('[Push] subscription failed:', err)
    return false
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const client = getMatrixClient()
    if (client) {
      const topic = getUserTopic()
      if (topic) {
        await client.setPusher({
          pushkey: topic,
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
  } catch (err) {
    console.error('[Push] unsubscribe failed:', err)
  }
}
