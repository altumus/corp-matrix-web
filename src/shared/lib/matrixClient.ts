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
  return clientInstance
}

export function getMatrixClient(): sdk.MatrixClient | null {
  return clientInstance
}

async function clearCryptoStore(): Promise<void> {
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

export async function startClient(): Promise<void> {
  if (!clientInstance) throw new Error('Matrix client not initialized')

  try {
    await clientInstance.initRustCrypto()
  } catch (err) {
    if (err instanceof Error && err.message.includes("doesn't match")) {
      await clearCryptoStore()
      try {
        await clientInstance.initRustCrypto()
      } catch {
        // second attempt failed — continue without E2EE
      }
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
