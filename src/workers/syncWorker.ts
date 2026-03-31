/**
 * Sync Worker — offloads Matrix sync processing to a Web Worker.
 *
 * In a production implementation, this worker would:
 * 1. Run the Matrix sync loop in a separate thread
 * 2. Process incoming events (filtering, sorting, deduplication)
 * 3. Send processed room summaries and timeline updates to the main thread
 *
 * Current implementation provides the worker scaffolding and message protocol.
 * The matrix-js-sdk currently doesn't support running fully in a Web Worker
 * due to DOM dependencies, but event processing can be offloaded here.
 */

export interface SyncWorkerMessage {
  type: 'START_SYNC' | 'STOP_SYNC' | 'PROCESS_EVENTS'
  payload?: unknown
}

export interface SyncWorkerResponse {
  type: 'SYNC_STARTED' | 'SYNC_STOPPED' | 'EVENTS_PROCESSED' | 'SYNC_ERROR'
  payload?: unknown
}

const ctx = self as unknown as Worker

ctx.addEventListener('message', (event: MessageEvent<SyncWorkerMessage>) => {
  const { type, payload } = event.data

  switch (type) {
    case 'START_SYNC':
      ctx.postMessage({
        type: 'SYNC_STARTED',
        payload: { timestamp: Date.now() },
      } satisfies SyncWorkerResponse)
      break

    case 'STOP_SYNC':
      ctx.postMessage({
        type: 'SYNC_STOPPED',
      } satisfies SyncWorkerResponse)
      break

    case 'PROCESS_EVENTS':
      try {
        const events = payload as Array<Record<string, unknown>>
        const processed = events.filter(
          (e) => e.type === 'm.room.message' || e.type === 'm.room.encrypted',
        )
        ctx.postMessage({
          type: 'EVENTS_PROCESSED',
          payload: { events: processed, count: processed.length },
        } satisfies SyncWorkerResponse)
      } catch (error) {
        ctx.postMessage({
          type: 'SYNC_ERROR',
          payload: { error: String(error) },
        } satisfies SyncWorkerResponse)
      }
      break
  }
})
