import { useEffect, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api/CryptoEvent.js'
import type { VerificationRequest } from 'matrix-js-sdk/lib/crypto-api/index.js'

export function useIncomingVerification() {
  const [request, setRequest] = useState<VerificationRequest | null>(null)

  useEffect(() => {
    const client = getMatrixClient()
    if (!client) return

    const crypto = client.getCrypto()
    if (!crypto) return

    const onRequest = (req: VerificationRequest) => {
      setRequest(req)
    }

    crypto.on(CryptoEvent.VerificationRequestReceived, onRequest)
    return () => {
      crypto.removeListener(CryptoEvent.VerificationRequestReceived, onRequest)
    }
  }, [])

  const dismiss = () => setRequest(null)

  return { request, dismiss }
}
