import http from 'node:http'
import webPush from 'web-push'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@corp-matrix.local'

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set.')
  console.error('Run: node generate-vapid-keys.mjs')
  process.exit(1)
}

webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const subscriptions = new Map()

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
  })
}

function respond(res, status, data) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  try {
    if (req.method === 'POST' && req.url === '/api/push-subscribe') {
      const { subscription, userId } = await parseBody(req)
      subscriptions.set(userId, subscription)
      console.log(`[Subscribe] ${userId} — total: ${subscriptions.size}`)
      return respond(res, 200, { ok: true })
    }

    if (req.url === '/api/push-test') {
      if (subscriptions.size === 0) {
        return respond(res, 400, {
          error: 'No subscriptions. Open the app and enable notifications first.',
        })
      }

      const payload = JSON.stringify({
        sender: 'Test User',
        room_name: 'Test Room',
        body: 'Тестовое уведомление — Web Push работает!',
        room_id: '!test:local',
      })

      let sent = 0
      for (const [userId, sub] of subscriptions) {
        try {
          await webPush.sendNotification(sub, payload)
          sent++
          console.log(`[Test] Sent to ${userId}`)
        } catch (err) {
          console.error(`[Test] Failed for ${userId}:`, err.message)
          subscriptions.delete(userId)
        }
      }
      return respond(res, 200, { sent })
    }

    if (req.method === 'POST' && req.url === '/_matrix/push/v1/notify') {
      const body = await parseBody(req)
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
          console.log('[Matrix] Notification sent for', n.room_name || n.room_id)
        } catch (err) {
          console.error('[Matrix] Failed:', err.message)
          rejected.push(device.pushkey)
        }
      }

      return respond(res, 200, { rejected })
    }

    if (req.url === '/') {
      return respond(res, 200, {
        status: 'running',
        subscriptions: subscriptions.size,
        endpoints: {
          subscribe: 'POST /api/push-subscribe',
          test: 'GET|POST /api/push-test',
          matrix: 'POST /_matrix/push/v1/notify',
        },
      })
    }

    respond(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error('[Error]', err)
    respond(res, 500, { error: err.message })
  }
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`\n  Push gateway: http://localhost:${PORT}`)
  console.log(`  VAPID public: ${VAPID_PUBLIC_KEY.slice(0, 20)}...`)
  console.log(`  Subscriptions: ${subscriptions.size}\n`)
  console.log('  Endpoints:')
  console.log('    POST /api/push-subscribe  — save browser push subscription')
  console.log('    GET  /api/push-test       — send test notification to all')
  console.log('    POST /_matrix/push/v1/notify — Matrix push gateway\n')
})
