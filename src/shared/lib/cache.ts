import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'corp-matrix-cache'
const DB_VERSION = 1

const STORES = {
  ROOMS: 'rooms',
  TIMELINE: 'timeline',
  PROFILES: 'profiles',
} as const

let db: IDBPDatabase | null = null

async function getDb(): Promise<IDBPDatabase> {
  if (db) return db
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORES.ROOMS)) {
        database.createObjectStore(STORES.ROOMS, { keyPath: 'roomId' })
      }
      if (!database.objectStoreNames.contains(STORES.TIMELINE)) {
        const store = database.createObjectStore(STORES.TIMELINE, { keyPath: 'eventId' })
        store.createIndex('roomId', 'roomId')
        store.createIndex('timestamp', 'timestamp')
      }
      if (!database.objectStoreNames.contains(STORES.PROFILES)) {
        database.createObjectStore(STORES.PROFILES, { keyPath: 'userId' })
      }
    },
  })
  return db
}

export async function cacheRooms(rooms: Array<Record<string, unknown>>): Promise<void> {
  const database = await getDb()
  const tx = database.transaction(STORES.ROOMS, 'readwrite')
  for (const room of rooms) {
    await tx.store.put(room)
  }
  await tx.done
}

export async function getCachedRooms(): Promise<Array<Record<string, unknown>>> {
  const database = await getDb()
  return database.getAll(STORES.ROOMS)
}

export async function cacheTimelineEvents(
  events: Array<Record<string, unknown>>,
): Promise<void> {
  const database = await getDb()
  const tx = database.transaction(STORES.TIMELINE, 'readwrite')
  for (const event of events) {
    await tx.store.put(event)
  }
  await tx.done
}

export async function getCachedTimeline(
  roomId: string,
  limit = 50,
): Promise<Array<Record<string, unknown>>> {
  const database = await getDb()
  const tx = database.transaction(STORES.TIMELINE, 'readonly')
  const index = tx.store.index('roomId')
  const results = await index.getAll(roomId, limit)
  return results.sort(
    (a, b) => (a.timestamp as number) - (b.timestamp as number),
  )
}

export async function cacheProfile(profile: Record<string, unknown>): Promise<void> {
  const database = await getDb()
  await database.put(STORES.PROFILES, profile)
}

export async function getCachedProfile(
  userId: string,
): Promise<Record<string, unknown> | undefined> {
  const database = await getDb()
  return database.get(STORES.PROFILES, userId)
}

export async function clearAllCaches(): Promise<void> {
  const database = await getDb()
  const tx = database.transaction(
    [STORES.ROOMS, STORES.TIMELINE, STORES.PROFILES],
    'readwrite',
  )
  await Promise.all([
    tx.objectStore(STORES.ROOMS).clear(),
    tx.objectStore(STORES.TIMELINE).clear(),
    tx.objectStore(STORES.PROFILES).clear(),
    tx.done,
  ])
}
