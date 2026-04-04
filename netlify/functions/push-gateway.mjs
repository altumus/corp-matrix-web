import webpush from 'web-push'
import { getStore } from '@netlify/blobs'

export async function handler(event) {
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gateway: 'matrix' }),
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@corp-matrix.app'

  if (!vapidPublic || !vapidPrivate) {
    console.error('VAPID keys not configured')
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejected: [] }),
    }
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejected: [] }),
    }
  }

  const notification = body.notification
  if (!notification) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejected: [] }),
    }
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

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rejected }),
  }
}
