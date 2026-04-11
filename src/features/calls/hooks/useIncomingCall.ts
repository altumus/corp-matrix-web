import { useEffect, useState } from 'react'
import { CallEventHandlerEvent, type MatrixCall } from 'matrix-js-sdk'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'

export function useIncomingCall(): {
  incoming: MatrixCall | null
  dismiss: () => void
} {
  const [incoming, setIncoming] = useState<MatrixCall | null>(null)

  useEffect(() => {
    const client = getMatrixClient()
    if (!client) return

    const handler = (call: MatrixCall) => {
      setIncoming(call)
    }

    client.on(CallEventHandlerEvent.Incoming, handler)

    return () => {
      client.removeListener(CallEventHandlerEvent.Incoming, handler)
    }
  }, [])

  const dismiss = () => setIncoming(null)

  return { incoming, dismiss }
}
