/**
 * Crypto Worker — offloads decryption operations to a Web Worker.
 *
 * In a production implementation, this worker would:
 * 1. Handle Olm/Megolm decryption outside the UI thread
 * 2. Manage session keys in the worker context
 * 3. Return decrypted event content to the main thread
 *
 * The matrix-js-sdk's Rust crypto backend already uses Web Workers internally
 * when available (via matrix-sdk-crypto-wasm). This worker provides an additional
 * layer for custom decryption batching and lazy decryption strategies.
 */

export interface CryptoWorkerMessage {
  type: 'DECRYPT_EVENT' | 'DECRYPT_BATCH' | 'INIT'
  payload?: unknown
}

export interface CryptoWorkerResponse {
  type: 'DECRYPTED' | 'BATCH_DECRYPTED' | 'INITIALIZED' | 'DECRYPT_ERROR'
  payload?: unknown
}

const ctx = self as unknown as Worker

ctx.addEventListener('message', (event: MessageEvent<CryptoWorkerMessage>) => {
  const { type, payload } = event.data

  switch (type) {
    case 'INIT':
      ctx.postMessage({
        type: 'INITIALIZED',
        payload: { ready: true },
      } satisfies CryptoWorkerResponse)
      break

    case 'DECRYPT_EVENT': {
      const eventData = payload as { eventId: string; content: Record<string, unknown> }
      // In production, actual Olm/Megolm decryption would happen here
      ctx.postMessage({
        type: 'DECRYPTED',
        payload: {
          eventId: eventData.eventId,
          content: eventData.content,
          decrypted: false,
        },
      } satisfies CryptoWorkerResponse)
      break
    }

    case 'DECRYPT_BATCH': {
      const events = payload as Array<{ eventId: string; content: Record<string, unknown> }>
      const results = events.map((e) => ({
        eventId: e.eventId,
        content: e.content,
        decrypted: false,
      }))
      ctx.postMessage({
        type: 'BATCH_DECRYPTED',
        payload: { results },
      } satisfies CryptoWorkerResponse)
      break
    }
  }
})
