import { getStore } from '@netlify/blobs'

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers }
  }

  if (event.httpMethod === 'GET') {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY
    if (!vapidPublic) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'VAPID key not configured' }),
      }
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ public_key: vapidPublic }),
    }
  }

  if (event.httpMethod === 'DELETE') {
    try {
      const { pushkey } = JSON.parse(event.body)
      if (!pushkey) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'pushkey required' }) }
      }
      const store = getStore('push-subscriptions')
      await store.delete(pushkey)
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { pushkey, subscription } = JSON.parse(event.body)
      if (!pushkey || !subscription?.endpoint) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'pushkey and subscription required' }),
        }
      }
      const store = getStore('push-subscriptions')
      await store.set(pushkey, JSON.stringify(subscription))
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
    }
  }

  return { statusCode: 405, headers, body: 'Method not allowed' }
}
