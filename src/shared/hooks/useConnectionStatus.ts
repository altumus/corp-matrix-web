import { useState, useEffect } from 'react'
import { useMatrixClient } from '../contexts/MatrixClientContext.js'
import { ClientEvent, SyncState } from 'matrix-js-sdk'

export type ConnectionState = 'connected' | 'reconnecting' | 'error'

export function useConnectionStatus(): ConnectionState {
  const client = useMatrixClient()
  const [status, setStatus] = useState<ConnectionState>('connected')

  useEffect(() => {
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
  }, [client])

  return status
}
