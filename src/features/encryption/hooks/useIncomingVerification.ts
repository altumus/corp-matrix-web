import { useEffect, useState } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api/CryptoEvent.js'
import type { VerificationRequest } from 'matrix-js-sdk/lib/crypto-api/index.js'

export function useIncomingVerification() {
  const client = useMatrixClient()
  const [request, setRequest] = useState<VerificationRequest | null>(null)

  useEffect(() => {
    if (!client) return

    const crypto = client.getCrypto()
    if (!crypto) return

    const onRequest = (req: VerificationRequest) => {
      setRequest(req)
    }

    const emitter = crypto as unknown as {
      on: (event: string, handler: (...args: never[]) => void) => void
      removeListener: (event: string, handler: (...args: never[]) => void) => void
    }

    emitter.on(CryptoEvent.VerificationRequestReceived, onRequest as never)
    return () => {
      emitter.removeListener(CryptoEvent.VerificationRequestReceived, onRequest as never)
    }
  }, [client])

  const dismiss = () => setRequest(null)

  return { request, dismiss }
}
