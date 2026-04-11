import { openDB, type IDBPDatabase } from 'idb'
import { sendTextMessage } from './messageService.js'
import type { SendMessageOptions } from '../types.js'
import { logger } from '../../../shared/lib/logger.js'

const DB_NAME = 'corp-matrix-send-queue'
const DB_VERSION = 1
const STORE = 'pending'

interface QueuedMessage {
  id: string
  opts: SendMessageOptions
  attempts: number
  createdAt: number
}

let db: IDBPDatabase | null = null
let processingTimer: ReturnType<typeof setTimeout> | null = null

async function getDb(): Promise<IDBPDatabase> {
  if (db) return db
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'id' })
      }
    },
  })
  return db
}

export async function enqueueMessage(opts: SendMessageOptions): Promise<string> {
  const database = await getDb()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const queued: QueuedMessage = {
    id,
    opts,
    attempts: 0,
    createdAt: Date.now(),
  }
  await database.put(STORE, queued)
  scheduleProcess()
  return id
}

export async function dequeueMessage(id: string): Promise<void> {
  const database = await getDb()
  await database.delete(STORE, id)
}

export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  const database = await getDb()
  return await database.getAll(STORE)
}

async function processQueue(): Promise<void> {
  if (!navigator.onLine) return

  const messages = await getQueuedMessages()
  if (messages.length === 0) return

  logger.log(`[sendQueue] Processing ${messages.length} pending messages`)

  for (const msg of messages) {
    if (msg.attempts >= 5) {
      logger.warn(`[sendQueue] Giving up on message ${msg.id} after 5 attempts`)
      await dequeueMessage(msg.id)
      continue
    }

    try {
      await sendTextMessage(msg.opts)
      await dequeueMessage(msg.id)
      logger.log(`[sendQueue] Sent queued message ${msg.id}`)
    } catch (err) {
      logger.warn(`[sendQueue] Failed to send ${msg.id}:`, err)
      const database = await getDb()
      msg.attempts++
      await database.put(STORE, msg)
    }
  }
}

function scheduleProcess(): void {
  if (processingTimer) return
  processingTimer = setTimeout(() => {
    processingTimer = null
    processQueue()
  }, 500)
}

export function startQueueProcessor(): void {
  // Process on online event
  window.addEventListener('online', () => {
    logger.log('[sendQueue] Network back, processing queue')
    scheduleProcess()
  })

  // Process every minute as fallback
  setInterval(() => {
    if (navigator.onLine) processQueue()
  }, 60_000)

  // Process immediately on startup
  scheduleProcess()
}
