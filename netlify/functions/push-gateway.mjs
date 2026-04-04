import webpush from 'web-push'
import { getStore } from '@netlify/blobs'

export default async (req) => {
  if (req.method === 'GET') {
    return Response.json({ gateway: 'matrix' })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@corp-matrix.app'

  if (!vapidPublic || !vapidPrivate) {
    console.error('VAPID keys not configured')
    return Response.json({ rejected: [] })
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ rejected: [] })
  }

  const notification = body.notification
  if (!notification) {
    return Response.json({ rejected: [] })
  }

  const devices = notification.devices || []
  const rejected = []

  const store = getStore('push-subscriptions')

  for (const device of devices) {
    const pushkey = device.pushkey
    if (!pushkey) continue

    let subscriptionStr
    try {
      subscriptionStr = await store.get(pushkey)
    } catch {
      rejected.push(pushkey)
      continue
    }

    if (!subscriptionStr) {
      rejected.push(pushkey)
      continue
    }

    let subscription
    try {
      subscription = JSON.parse(subscriptionStr)
    } catch {
      rejected.push(pushkey)
      continue
    }

    const payload = JSON.stringify({
      event_id: notification.event_id,
      room_id: notification.room_id,
      room_name: notification.room_name || '',
      sender: notification.sender_display_name || notification.sender || '',
      body: notification.content?.body || '',
      unread: notification.counts?.unread || 0,
      prio: notification.prio || 'high',
    })

    try {
      await webpush.sendNotification(subscription, payload)
    } catch (err) {
      console.error('Web push failed for', pushkey, err.statusCode || err.message)
      if (err.statusCode === 404 || err.statusCode === 410) {
        rejected.push(pushkey)
        try { await store.delete(pushkey) } catch {}
      }
    }
  }

  return Response.json({ rejected })
}

export const config = {
  path: ['/_matrix/push/v1/notify'],
  method: ['GET', 'POST'],
}
