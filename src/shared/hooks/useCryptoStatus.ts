import { useState, useEffect } from 'react'
import { isCryptoReady } from '../lib/matrixClient.js'
import { useMatrixClient } from '../contexts/MatrixClientContext.js'
import { ClientEvent, SyncState } from 'matrix-js-sdk'

export function useCryptoStatus(): boolean {
  const client = useMatrixClient()
  const [ready, setReady] = useState(isCryptoReady())

  useEffect(() => {
    if (!client) return

    // Re-check after initial sync completes
    const onSync = (state: SyncState) => {
      if (state === SyncState.Prepared || state === SyncState.Syncing) {
        setReady(isCryptoReady())
      }
    }

    client.on(ClientEvent.Sync, onSync)
    return () => { client.removeListener(ClientEvent.Sync, onSync) }
  }, [client])

  return ready
}
