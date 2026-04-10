import webPush from 'web-push'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@corp-matrix.local'

let vapidConfigured = false
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (!vapidConfigured) {
    return Response.json(
      { rejected: [], error: 'VAPID keys not configured' },
      { status: 500 },
    )
  }

  try {
    const body = await req.json()
    const n = body.notification || {}
    const rejected = []

    for (const device of n.devices || []) {
      try {
        const subJson = Buffer.from(device.pushkey, 'base64url').toString()
        const subscription = JSON.parse(subJson)

        const payload = JSON.stringify({
          sender: n.sender_display_name || n.sender || '',
          room_name: n.room_name || '',
          body: n.content?.body || 'Новое сообщение',
          room_id: n.room_id || '',
          event_id: n.event_id || '',
        })

        await webPush.sendNotification(subscription, payload)
      } catch (err) {
        console.error('[Push Gateway]', err.message)
        rejected.push(device.pushkey)
      }
    }

    return Response.json({ rejected })
  } catch (err) {
    console.error('[Push Gateway]', err)
    return Response.json({ rejected: [] }, { status: 500 })
  }
}

export const config = {
  path: '/_matrix/push/v1/notify',
}
