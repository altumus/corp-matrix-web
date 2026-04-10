import { useState, useEffect } from 'react'
import { isCryptoReady, getMatrixClient } from '../lib/matrixClient.js'
import { ClientEvent, SyncState } from 'matrix-js-sdk'

export function useCryptoStatus(): boolean {
  const [ready, setReady] = useState(isCryptoReady())

  useEffect(() => {
    const client = getMatrixClient()
    if (!client) return

    // Re-check after initial sync completes
    const onSync = (state: SyncState) => {
      if (state === SyncState.Prepared || state === SyncState.Syncing) {
        setReady(isCryptoReady())
      }
    }

    client.on(ClientEvent.Sync, onSync)
    return () => { client.removeListener(ClientEvent.Sync, onSync) }
  }, [])

  return ready
}
