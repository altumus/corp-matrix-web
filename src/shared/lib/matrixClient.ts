import * as sdk from 'matrix-js-sdk'
import { IndexedDBStore } from 'matrix-js-sdk/lib/store/indexeddb.js'
import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'corp-matrix-web'
const DB_VERSION = 1
const SESSION_STORE = 'session'

interface SessionData {
  userId: string
  accessToken: string
  deviceId: string
  homeserverUrl: string
  refreshToken?: string
}

const CRYPTO_DB_NAMES = [
  'matrix-js-sdk::matrix-sdk-crypto',
  'matrix-js-sdk::matrix-sdk-crypto-meta',
]

let clientInstance: sdk.MatrixClient | null = null
let dbInstance: IDBPDatabase | null = null
let cachedSecretStorageKey: Uint8Array | null = null
let storeInstance: IndexedDBStore | null = null

export function setSecretStorageKey(key: Uint8Array | null): void {
  cachedSecretStorageKey = key
}

async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE)
      }
    },
  })
  return dbInstance
}

export async function saveSession(session: SessionData): Promise<void> {
  const db = await getDb()
  await db.put(SESSION_STORE, session, 'current')
}

export async function loadSession(): Promise<SessionData | null> {
  const db = await getDb()
  return (await db.get(SESSION_STORE, 'current')) ?? null
}

export async function clearSession(): Promise<void> {
  const db = await getDb()
  await db.delete(SESSION_STORE, 'current')
  await db.delete(SESSION_STORE, 'recoveryKey').catch(() => {})
  await db.delete(SESSION_STORE, 'recoveryKeyAcknowledged').catch(() => {})
}

export async function setRecoveryKeyAcknowledged(): Promise<void> {
  const db = await getDb()
  await db.put(SESSION_STORE, true, 'recoveryKeyAcknowledged')
}

export async function isRecoveryKeyAcknowledged(): Promise<boolean> {
  const db = await getDb()
  return Boolean(await db.get(SESSION_STORE, 'recoveryKeyAcknowledged'))
}

// ─── Recovery key encryption ─────────────────────────────────────
// Encrypt the recovery key with a key derived from device fingerprint.
// Not perfect (a sufficiently motivated attacker with full device access
// can still reconstruct the fingerprint), but blocks XSS reading plaintext.

const DEVICE_ID_KEY = 'corp-matrix-device-id'

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

async function deriveDeviceKey(): Promise<CryptoKey> {
  const fingerprint = [
    getOrCreateDeviceId(),
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|')

  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(fingerprint),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('corp-matrix-recovery-salt'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

interface EncryptedBlob {
  iv: number[]
  data: number[]
}

export async function saveRecoveryKey(key: Uint8Array): Promise<void> {
  const cryptoKey = await deriveDeviceKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    key as unknown as BufferSource,
  )

  const blob: EncryptedBlob = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  }

  const db = await getDb()
  await db.put(SESSION_STORE, blob, 'recoveryKey')
}

export async function loadRecoveryKey(): Promise<Uint8Array | null> {
  const db = await getDb()
  const stored = await db.get(SESSION_STORE, 'recoveryKey')
  if (!stored || typeof stored !== 'object') return null

  // Legacy plaintext format (array)
  if (Array.isArray(stored)) {
    return new Uint8Array(stored)
  }

  // Encrypted format
  const blob = stored as EncryptedBlob
  if (!blob.iv || !blob.data) return null

  try {
    const cryptoKey = await deriveDeviceKey()
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(blob.iv) },
      cryptoKey,
      new Uint8Array(blob.data),
    )
    return new Uint8Array(decrypted)
  } catch {
    // Decryption failed (e.g. user changed device fingerprint)
    return null
  }
}

export function createMatrixClient(opts: {
  baseUrl: string
  accessToken?: string
  userId?: string
  deviceId?: string
  refreshToken?: string
}): sdk.MatrixClient {
  // Persistent sync store — survives reloads, enables incremental sync
  storeInstance = new IndexedDBStore({
    indexedDB: window.indexedDB,
    dbName: 'corp-matrix-sync',
  } as never)

  clientInstance = sdk.createClient({
    baseUrl: opts.baseUrl,
    accessToken: opts.accessToken,
    userId: opts.userId,
    deviceId: opts.deviceId,
    refreshToken: opts.refreshToken,
    useAuthorizationHeader: true,
    store: storeInstance,
    fallbackICEServerAllowed: true,
    tokenRefreshFunction: opts.refreshToken
      ? async (refreshToken: string) => {
          const res = await fetch(`${opts.baseUrl}/_matrix/client/v3/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          })
          if (!res.ok) throw new Error('Token refresh failed')
          const data = await res.json()
          const session = await loadSession()
          if (session) {
            const updated = { ...session, accessToken: data.access_token as string }
            if (data.refresh_token) updated.refreshToken = data.refresh_token as string
            await saveSession(updated)
          }
          return {
            accessToken: data.access_token as string,
            refreshToken: data.refresh_token as string,
          }
        }
      : undefined,
    cryptoCallbacks: {
      getSecretStorageKey: async ({ keys }: { keys: Record<string, unknown> }) => {
        if (!cachedSecretStorageKey) return null
        const keyId = Object.keys(keys)[0]
        if (!keyId) return null
        return [keyId, cachedSecretStorageKey] as [string, Uint8Array<ArrayBuffer>]
      },
      cacheSecretStorageKey: (_keyId: string, _keyInfo: unknown, key: Uint8Array) => {
        cachedSecretStorageKey = key
      },
    } as never,
    ...({ pendingEventOrdering: 'detached' } as any),
  })
  return clientInstance
}

export function getMatrixClient(): sdk.MatrixClient | null {
  return clientInstance
}

export async function clearCryptoStore(): Promise<void> {
  for (const name of CRYPTO_DB_NAMES) {
    try {
      const req = indexedDB.deleteDatabase(name)
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        req.onblocked = () => resolve()
      })
    } catch {
      // best-effort
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ])
}

let cryptoInitialized = false

export function isCryptoReady(): boolean {
  return cryptoInitialized
}

export async function startClient(): Promise<void> {
  if (!clientInstance) throw new Error('Matrix client not initialized')

  cryptoInitialized = false

  // Load persisted sync state from IndexedDB (incremental sync after reload)
  if (storeInstance) {
    try {
      await withTimeout(storeInstance.startup(), 10_000, 'IndexedDBStore.startup')
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[store] IndexedDBStore startup failed, continuing with memory store:', err)
      }
      // Fallback: continue without persistent store — sync will be full but work
    }
  }

  try {
    await withTimeout(clientInstance.initRustCrypto(), 15_000, 'initRustCrypto')
    cryptoInitialized = true
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes("doesn't match") || msg.includes('timed out')) {
      await clearCryptoStore()
      try {
        await withTimeout(clientInstance.initRustCrypto(), 15_000, 'initRustCrypto (retry)')
        cryptoInitialized = true
      } catch {
        if (import.meta.env.DEV) console.warn('[crypto] E2E encryption unavailable — init failed on retry')
      }
    } else {
      if (import.meta.env.DEV) console.warn('[crypto] E2E encryption unavailable —', msg)
    }
  }

  await clientInstance.startClient({ initialSyncLimit: 20, pendingEventOrdering: 'detached' as never })
}

export async function stopClient(): Promise<void> {
  if (clientInstance) {
    clientInstance.stopClient()
    clientInstance = null
  }
  if (storeInstance) {
    try {
      await storeInstance.save(true)
      // Don't destroy — keep data for next session
    } catch { /* ignore */ }
    storeInstance = null
  }
}

export function mxcToHttp(
  mxcUrl: string | undefined | null,
  width?: number,
  height?: number,
): string | null {
  if (!mxcUrl || !clientInstance) return null
  let url: string | null
  if (width && height) {
    url = clientInstance.mxcUrlToHttp(mxcUrl, width, height, 'crop') ?? null
  } else {
    url = clientInstance.mxcUrlToHttp(mxcUrl) ?? null
  }
  return url || null
}
