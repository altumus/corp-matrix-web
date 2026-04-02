import {
  createMatrixClient,
  saveSession,
  loadSession,
  clearSession,
  startClient,
  stopClient,
} from '../../../shared/lib/matrixClient.js'
import type { AuthUser, LoginCredentials, RegisterCredentials } from '../types.js'

function normalizeHomeserver(url: string): string {
  let normalized = url.trim()
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`
  }
  return normalized.replace(/\/+$/, '')
}

export async function loginWithPassword(
  credentials: LoginCredentials,
): Promise<AuthUser> {
  const baseUrl = normalizeHomeserver(credentials.homeserver)

  const client = createMatrixClient({ baseUrl })

  const response = await client.loginWithPassword(
    credentials.username,
    credentials.password,
  )

  await saveSession({
    userId: response.user_id,
    accessToken: response.access_token,
    deviceId: response.device_id,
    homeserverUrl: baseUrl,
  })

  createMatrixClient({
    baseUrl,
    accessToken: response.access_token,
    userId: response.user_id,
    deviceId: response.device_id,
  })

  await startClient()

  return {
    userId: response.user_id,
    displayName: undefined,
    avatarUrl: null,
  }
}

export async function registerAccount(
  credentials: RegisterCredentials,
): Promise<AuthUser> {
  const baseUrl = normalizeHomeserver(credentials.homeserver)

  const client = createMatrixClient({ baseUrl })

  const response = await client.registerRequest({
    username: credentials.username,
    password: credentials.password,
    auth: {
      type: 'm.login.dummy',
    },
  })

  const userId = response.user_id!
  const accessToken = response.access_token!
  const deviceId = response.device_id!

  await saveSession({
    userId,
    accessToken,
    deviceId,
    homeserverUrl: baseUrl,
  })

  createMatrixClient({
    baseUrl,
    accessToken,
    userId,
    deviceId,
  })

  await startClient()

  return {
    userId,
    displayName: undefined,
    avatarUrl: null,
  }
}

export async function restoreExistingSession(): Promise<AuthUser | null> {
  const session = await loadSession()
  if (!session) return null

  try {
    const client = createMatrixClient({
      baseUrl: session.homeserverUrl,
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId,
    })

    await client.whoami()
    await startClient()

    const profile = await client.getProfileInfo(session.userId)

    return {
      userId: session.userId,
      displayName: profile.displayname,
      avatarUrl: profile.avatar_url ?? null,
    }
  } catch {
    await clearSession()
    return null
  }
}

export async function logoutSession(): Promise<void> {
  try {
    const { getMatrixClient } = await import('../../../shared/lib/matrixClient.js')
    const client = getMatrixClient()
    if (client) {
      await client.logout(true)
    }
  } catch {
    // best-effort logout
  }
  await stopClient()
  await clearSession()

  localStorage.clear()

  const dbs = await indexedDB.databases?.() ?? []
  for (const db of dbs) {
    if (db.name) {
      try { indexedDB.deleteDatabase(db.name) } catch { /* ignore */ }
    }
  }
}
