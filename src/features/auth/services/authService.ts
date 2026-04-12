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

export interface SsoIdentityProvider {
  id: string
  name: string
  icon?: string
  brand?: string
}

export interface LoginFlows {
  supportsPassword: boolean
  supportsSso: boolean
  ssoProviders: SsoIdentityProvider[]
}

export async function fetchLoginFlows(homeserverUrl: string): Promise<LoginFlows> {
  const url = normalizeHomeserver(homeserverUrl)
  const res = await fetch(`${url}/_matrix/client/v3/login`)
  const data = await res.json()
  const flows = data.flows || []

  const supportsPassword = flows.some((f: any) => f.type === 'm.login.password')
  const ssoFlow = flows.find((f: any) => f.type === 'm.login.sso' || f.type === 'm.login.cas')

  return {
    supportsPassword,
    supportsSso: !!ssoFlow,
    ssoProviders: ssoFlow?.identity_providers || [],
  }
}

async function finalizeLogin(
  loginData: { user_id: string; access_token: string; device_id: string; refresh_token?: string },
  baseUrl: string,
): Promise<AuthUser> {
  const sessionData = {
    userId: loginData.user_id,
    accessToken: loginData.access_token,
    deviceId: loginData.device_id,
    homeserverUrl: baseUrl,
    refreshToken: loginData.refresh_token,
  }

  await saveSession(sessionData)

  createMatrixClient({
    baseUrl,
    accessToken: loginData.access_token,
    userId: loginData.user_id,
    deviceId: loginData.device_id,
  })

  await startClient()

  return {
    userId: loginData.user_id,
    displayName: undefined,
    avatarUrl: null,
  }
}

export async function loginWithPassword(
  credentials: LoginCredentials,
): Promise<AuthUser> {
  const baseUrl = normalizeHomeserver(credentials.homeserver)

  const tempClient = createMatrixClient({ baseUrl })

  const response = await tempClient.loginWithPassword(
    credentials.username,
    credentials.password,
  )

  return finalizeLogin(
    {
      user_id: response.user_id,
      access_token: response.access_token,
      device_id: response.device_id,
      refresh_token: (response as Record<string, unknown>).refresh_token as string | undefined,
    },
    baseUrl,
  )
}

export async function loginWithSsoToken(
  homeserverUrl: string,
  loginToken: string,
): Promise<AuthUser> {
  const baseUrl = normalizeHomeserver(homeserverUrl)

  const res = await fetch(`${baseUrl}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.token',
      token: loginToken,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'SSO login failed')
  }

  const data = await res.json()

  return finalizeLogin(
    {
      user_id: data.user_id,
      access_token: data.access_token,
      device_id: data.device_id,
      refresh_token: data.refresh_token,
    },
    baseUrl,
  )
}

export async function registerAccount(
  credentials: RegisterCredentials,
): Promise<AuthUser> {
  const baseUrl = normalizeHomeserver(credentials.homeserver)

  await stopClient()

  const tempClient = createMatrixClient({ baseUrl })

  const response = await tempClient.registerRequest({
    username: credentials.username,
    password: credentials.password,
    auth: {
      type: 'm.login.dummy',
    },
  })

  const userId = response.user_id!
  const accessToken = response.access_token!
  const deviceId = response.device_id!

  await saveSession({ userId, accessToken, deviceId, homeserverUrl: baseUrl })

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
