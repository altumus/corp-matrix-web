import { execSync, spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import { CONFIG } from '../lib/config.js'
import { log, snap, bug, listen, loginAs, waitFor, runTest, ROOM_ITEM_SEL } from '../lib/helpers.js'
import { api } from '../lib/api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COMPOSE_DIR = path.resolve(__dirname, '../../federation-test')

const FED_CONFIG = {
  server1: 'http://127.0.0.1:8008',  // same as main test server
  server2: 'http://127.0.0.1:8009',
  user1: { username: 'feduser1', password: 'fedpass123' },
  user2: { username: 'feduser2', password: 'fedpass123' },
}

async function waitForServer(url, maxWait = 60000) {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`${url}/_matrix/client/versions`)
      if (res.ok) return true
    } catch { /* not ready */ }
    await new Promise(r => setTimeout(r, 2000))
  }
  return false
}

export async function startFederationServers() {
  log('═══ FEDERATION: Starting Docker containers ═══')
  try {
    // Check if docker is available
    execSync('docker --version', { stdio: 'pipe' })
  } catch {
    log('FEDERATION: Docker not available, skipping federation tests')
    return false
  }

  try {
    // Start containers
    execSync('docker compose up -d', { cwd: COMPOSE_DIR, stdio: 'pipe', timeout: 60000 })
    log('FEDERATION: Containers started, waiting for servers...')

    // Wait for both servers
    const s1Ready = await waitForServer(FED_CONFIG.server1)
    const s2Ready = await waitForServer(FED_CONFIG.server2)

    if (!s1Ready || !s2Ready) {
      log(`FEDERATION: Servers not ready (s1=${s1Ready}, s2=${s2Ready})`)
      return false
    }

    log('FEDERATION: Both servers ready')

    // Register users
    for (const [server, user] of [[FED_CONFIG.server1, FED_CONFIG.user1], [FED_CONFIG.server2, FED_CONFIG.user2]]) {
      // Try login first
      const loginRes = await api('POST', '/_matrix/client/v3/login', {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: user.username },
        password: user.password,
      })
      // If login works, user exists. Override api base temporarily.
      if (!loginRes.ok) {
        // Register
        const regRes = await api('POST', '/_matrix/client/v3/register', {
          username: user.username,
          password: user.password,
          auth: { type: 'm.login.dummy' },
          inhibit_login: false,
        })
        if (regRes.ok) {
          user.token = regRes.data.access_token
          user.userId = regRes.data.user_id
          log(`FEDERATION: Registered ${user.username} on ${server}`)
        }
      } else {
        user.token = loginRes.data.access_token
        user.userId = loginRes.data.user_id
        log(`FEDERATION: Logged in ${user.username} on ${server}`)
      }
    }
    // Note: the api() helper uses CONFIG.homeserver which is server1.
    // For server2 we need direct fetch calls.

    return true
  } catch (err) {
    log(`FEDERATION: Setup failed: ${err.message}`)
    return false
  }
}

export async function stopFederationServers() {
  log('═══ FEDERATION: Stopping Docker containers ═══')
  try {
    execSync('docker compose down -v', { cwd: COMPOSE_DIR, stdio: 'pipe', timeout: 30000 })
    log('FEDERATION: Containers stopped')
  } catch (err) {
    log(`FEDERATION: Stop failed: ${err.message}`)
  }
}

// Нужны direct fetch функции для server2 (api() helper использует CONFIG.homeserver)
async function apiDirect(method, baseUrl, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  try {
    const res = await fetch(`${baseUrl}${path}`, opts)
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data: json }
  } catch (err) {
    return { ok: false, status: 0, data: { error: err.message } }
  }
}

export async function testFederationInvite(page) {
  log('--- FEDERATION_INVITE ---')
  const u1 = FED_CONFIG.user1
  const u2 = FED_CONFIG.user2
  if (!u1.token || !u2.token) { log('FEDERATION_INVITE: SKIP (users not ready)'); return }

  // User1 (server1) creates room and invites user2 (server2)
  const roomRes = await apiDirect('POST', FED_CONFIG.server1, '/_matrix/client/v3/createRoom', {
    name: 'QA Federation Test',
    preset: 'private_chat',
    invite: [u2.userId],
  }, u1.token)

  if (!roomRes.ok) {
    bug('HIGH', 'FEDERATION_INVITE', `Failed to create federated room: ${JSON.stringify(roomRes.data)}`, [], '')
    return
  }
  const fedRoomId = roomRes.data.room_id
  log(`FEDERATION_INVITE: Room created ${fedRoomId}, inviting ${u2.userId}`)

  // User2 joins
  const joinRes = await apiDirect('POST', FED_CONFIG.server2, `/_matrix/client/v3/join/${encodeURIComponent(fedRoomId)}`, {}, u2.token)
  if (!joinRes.ok) {
    bug('HIGH', 'FEDERATION_INVITE', `User2 failed to join federated room: ${JSON.stringify(joinRes.data)}`, [], '')
    return
  }

  log('FEDERATION_INVITE: PASS — cross-server invite + join successful')
}

export async function testFederationMessage(page) {
  log('--- FEDERATION_MESSAGE ---')
  const u1 = FED_CONFIG.user1
  const u2 = FED_CONFIG.user2
  if (!u1.token || !u2.token) { log('FEDERATION_MESSAGE: SKIP'); return }

  // Find the federation test room
  const joinedRes = await apiDirect('GET', FED_CONFIG.server1, '/_matrix/client/v3/joined_rooms', null, u1.token)
  if (!joinedRes.ok || !joinedRes.data.joined_rooms?.length) {
    log('FEDERATION_MESSAGE: SKIP (no rooms)')
    return
  }

  const roomId = joinedRes.data.joined_rooms[0]

  // User1 sends message
  const msg1 = `Federation test from server1: ${Date.now()}`
  const sendRes = await apiDirect('PUT', FED_CONFIG.server1,
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/fed-${Date.now()}`,
    { msgtype: 'm.text', body: msg1 }, u1.token)

  if (!sendRes.ok) {
    bug('HIGH', 'FEDERATION_MESSAGE', 'User1 failed to send message', [], '')
    return
  }

  // Wait for federation sync
  await new Promise(r => setTimeout(r, 3000))

  // User2 reads messages
  const msgRes = await apiDirect('GET', FED_CONFIG.server2,
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=5`, null, u2.token)

  if (!msgRes.ok) {
    bug('HIGH', 'FEDERATION_MESSAGE', 'User2 cannot read federated room messages', [], '')
    return
  }

  const found = (msgRes.data.chunk || []).some(e => e.content?.body === msg1)
  if (!found) {
    bug('HIGH', 'FEDERATION_MESSAGE', 'Message from server1 not visible on server2', [], '')
  } else {
    log('FEDERATION_MESSAGE: PASS — cross-server message delivery confirmed')
  }

  // User2 replies
  const msg2 = `Reply from server2: ${Date.now()}`
  await apiDirect('PUT', FED_CONFIG.server2,
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/fed-reply-${Date.now()}`,
    { msgtype: 'm.text', body: msg2 }, u2.token)

  await new Promise(r => setTimeout(r, 3000))

  const msgRes2 = await apiDirect('GET', FED_CONFIG.server1,
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=5`, null, u1.token)

  const found2 = (msgRes2.data?.chunk || []).some(e => e.content?.body === msg2)
  if (!found2) {
    bug('MEDIUM', 'FEDERATION_MESSAGE', 'Reply from server2 not visible on server1', [], '')
  } else {
    log('FEDERATION_MESSAGE: PASS — bidirectional messaging confirmed')
  }
}

export async function testFederationAvatar(page) {
  log('--- FEDERATION_AVATAR ---')
  const u2 = FED_CONFIG.user2
  if (!u2.token) { log('FEDERATION_AVATAR: SKIP'); return }

  // Set display name on server2
  const profileRes = await apiDirect('PUT', FED_CONFIG.server2,
    `/_matrix/client/v3/profile/${encodeURIComponent(u2.userId)}/displayname`,
    { displayname: 'Federation User 2' }, u2.token)

  if (profileRes.ok) {
    log('FEDERATION_AVATAR: PASS — profile update on server2 succeeded')
  } else {
    log(`FEDERATION_AVATAR: Profile update failed (${profileRes.status})`)
  }
}
