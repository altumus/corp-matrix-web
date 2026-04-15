import { openDB, type IDBPDatabase } from 'idb'
import { sendTextMessage } from './messageService.js'
import type { SendMessageOptions } from '../types.js'
import { logger } from '../../../shared/lib/logger.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'

const DB_NAME = 'corp-matrix-send-queue'
const DB_VERSION = 1
const STORE = 'pending'
const MAX_QUEUE_SIZE = 20
const MAX_ATTEMPTS = 10

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

  // Enforce queue size limit
  const existing = await database.getAll(STORE) as QueuedMessage[]
  if (existing.length >= MAX_QUEUE_SIZE) {
    toast('Очередь сообщений переполнена. Дождитесь восстановления сети.', 'warning', 6000)
    throw new Error('Send queue is full')
  }

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

export async function clearQueue(): Promise<void> {
  const database = await getDb()
  await database.clear(STORE)
}

let processing = false

async function processQueue(): Promise<void> {
  if (processing) return
  if (!navigator.onLine) return

  processing = true
  try {
  const messages = await getQueuedMessages()
  if (messages.length === 0) return

  logger.log(`[sendQueue] Processing ${messages.length} pending messages`)

  for (const msg of messages) {
    if (msg.attempts >= MAX_ATTEMPTS) {
      logger.warn(`[sendQueue] Giving up on message ${msg.id} after ${MAX_ATTEMPTS} attempts`)
      await dequeueMessage(msg.id)
      const preview = msg.opts.body.slice(0, 50)
      toast(`Сообщение не доставлено: «${preview}${msg.opts.body.length > 50 ? '…' : ''}»`, 'error', 8000)
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
  } finally {
    processing = false
  }
}

function scheduleProcess(): void {
  if (processingTimer) return
  processingTimer = setTimeout(() => {
    processingTimer = null
    processQueue()
  }, 500)
}

let onlineHandlerAttached = false
let queueIntervalId: ReturnType<typeof setInterval> | null = null

export function startQueueProcessor(): void {
  // Process on online event (guard against duplicate listeners)
  if (!onlineHandlerAttached) {
    window.addEventListener('online', () => {
      logger.log('[sendQueue] Network back, processing queue')
      scheduleProcess()
    })
    onlineHandlerAttached = true
  }

  // Process every minute as fallback (cleanup previous interval)
  if (queueIntervalId) clearInterval(queueIntervalId)
  queueIntervalId = setInterval(() => {
    if (navigator.onLine) processQueue()
  }, 60_000)

  // Process immediately on startup
  scheduleProcess()
}
