import { getMatrixClient } from '../../../shared/lib/matrixClient.js'

const NTFY_SERVER = import.meta.env.VITE_NTFY_SERVER || 'https://ntfy.sh'
const NTFY_TOPIC_PREFIX = import.meta.env.VITE_NTFY_TOPIC_PREFIX || 'corp-matrix'
const NTFY_TOKEN = import.meta.env.VITE_NTFY_TOKEN || ''

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

async function subscribeNtfyAccount(topic: string): Promise<void> {
  if (!NTFY_TOKEN) {
    console.log('[Push] No NTFY_TOKEN — skipping account subscription')
    return
  }

  console.log('[Push] Subscribing ntfy account to topic:', topic)
  const res = await fetch(`${NTFY_SERVER}/v1/account/subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NTFY_TOKEN}`,
    },
    body: JSON.stringify({
      topic,
      base_url: NTFY_SERVER,
    }),
  })

  if (!res.ok && res.status !== 409) {
    const text = await res.text()
    throw new Error(`ntfy account subscription failed: ${res.status} ${text}`)
  }
  console.log('[Push] ntfy account subscribed')
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

  console.log('[Push] Matrix pusher registered')
}

export async function subscribeToPush(): Promise<boolean> {
  const topic = getUserTopic()
  if (!topic) {
    throw new Error('Matrix client not ready — no user ID')
  }
  console.log('[Push] Starting push setup for topic:', topic)

  await subscribeNtfyAccount(topic)
  await registerMatrixPusher(topic)

  console.log('[Push] Push setup complete! Topic:', topic)
  return true
}

export function getPushTopic(): string | null {
  return getUserTopic()
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
    console.log('[Push] Unsubscribed')
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err)
  }
}
