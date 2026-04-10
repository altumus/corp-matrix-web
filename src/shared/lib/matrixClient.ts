import * as sdk from 'matrix-js-sdk'
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
}

export async function saveRecoveryKey(key: Uint8Array): Promise<void> {
  const db = await getDb()
  await db.put(SESSION_STORE, Array.from(key), 'recoveryKey')
}

export async function loadRecoveryKey(): Promise<Uint8Array | null> {
  const db = await getDb()
  const stored = await db.get(SESSION_STORE, 'recoveryKey')
  if (stored && Array.isArray(stored)) {
    return new Uint8Array(stored)
  }
  return null
}

export function createMatrixClient(opts: {
  baseUrl: string
  accessToken?: string
  userId?: string
  deviceId?: string
}): sdk.MatrixClient {
  clientInstance = sdk.createClient({
    baseUrl: opts.baseUrl,
    accessToken: opts.accessToken,
    userId: opts.userId,
    deviceId: opts.deviceId,
    useAuthorizationHeader: true,
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
  })
  // @ts-expect-error pendingEventOrdering exists on MatrixClient but not in ICreateClientOpts
  clientInstance.pendingEventOrdering = 'detached'
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
        console.warn('[crypto] E2E encryption unavailable — init failed on retry')
      }
    } else {
      console.warn('[crypto] E2E encryption unavailable —', msg)
    }
  }

  await clientInstance.startClient({ initialSyncLimit: 20 })
}

export async function stopClient(): Promise<void> {
  if (clientInstance) {
    clientInstance.stopClient()
    clientInstance = null
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
