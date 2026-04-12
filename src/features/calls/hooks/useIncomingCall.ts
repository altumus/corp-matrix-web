import { useEffect, useState } from 'react'
import { type MatrixCall } from 'matrix-js-sdk'
import { CallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/callEventHandler.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'

export function useIncomingCall(): {
  incoming: MatrixCall | null
  dismiss: () => void
} {
  const client = useMatrixClient()
  const [incoming, setIncoming] = useState<MatrixCall | null>(null)

  useEffect(() => {
    if (!client) return

    const handler = (call: MatrixCall) => {
      setIncoming(call)
    }

    client.on(CallEventHandlerEvent.Incoming, handler)

    return () => {
      client.removeListener(CallEventHandlerEvent.Incoming, handler)
    }
  }, [client])

  const dismiss = () => setIncoming(null)

  return { incoming, dismiss }
}
