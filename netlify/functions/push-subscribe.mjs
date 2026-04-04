import { getStore } from '@netlify/blobs'

export default async (req) => {
  if (req.method === 'GET') {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY
    if (!vapidPublic) {
      return Response.json({ error: 'VAPID key not configured' }, { status: 500 })
    }
    return Response.json({ public_key: vapidPublic })
  }

  if (req.method === 'DELETE') {
    try {
      const { pushkey } = await req.json()
      if (!pushkey) {
        return Response.json({ error: 'pushkey required' }, { status: 400 })
      }
      const store = getStore('push-subscriptions')
      await store.delete(pushkey)
      return Response.json({ ok: true })
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { pushkey, subscription } = await req.json()

    if (!pushkey || !subscription?.endpoint) {
      return Response.json({ error: 'pushkey and subscription required' }, { status: 400 })
    }

    const store = getStore('push-subscriptions')
    await store.set(pushkey, JSON.stringify(subscription))

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export const config = {
  path: ['/api/push/subscribe'],
  method: ['GET', 'POST', 'DELETE'],
}
