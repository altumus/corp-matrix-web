import { useState, useEffect } from 'react'
import { getMatrixClient } from '../lib/matrixClient.js'
import { ClientEvent, SyncState } from 'matrix-js-sdk'

export type ConnectionState = 'connected' | 'reconnecting' | 'error'

export function useConnectionStatus(): ConnectionState {
  const [status, setStatus] = useState<ConnectionState>('connected')

  useEffect(() => {
    const client = getMatrixClient()
    if (!client) return

    const onSync = (state: SyncState, _prev: SyncState | null) => {
      if (state === SyncState.Syncing || state === SyncState.Prepared) {
        setStatus('connected')
      } else if (state === SyncState.Reconnecting || state === SyncState.Catchup) {
        setStatus('reconnecting')
      } else if (state === SyncState.Error || state === SyncState.Stopped) {
        setStatus('error')
      }
    }

    client.on(ClientEvent.Sync, onSync)
    return () => {
      client.removeListener(ClientEvent.Sync, onSync)
    }
  }, [])

  return status
}
