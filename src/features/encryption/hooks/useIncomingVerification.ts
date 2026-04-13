import { useEffect, useState } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api/CryptoEvent.js'
import type { VerificationRequest } from 'matrix-js-sdk/lib/crypto-api/index.js'

export function useIncomingVerification() {
  const client = useMatrixClient()
  const [request, setRequest] = useState<VerificationRequest | null>(null)

  useEffect(() => {
    if (!client) return

    // Listen on CLIENT (not crypto) — MatrixClient re-emits all CryptoEvents
    // via reEmitter. Listening on crypto directly can fail due to TypeScript
    // cast issues with Rust crypto's EventEmitter implementation.
    const onRequest = (req: VerificationRequest) => {
      setRequest(req)
    }

    client.on(CryptoEvent.VerificationRequestReceived as any, onRequest)
    return () => {
      client.removeListener(CryptoEvent.VerificationRequestReceived as any, onRequest)
    }
  }, [client])

  const dismiss = () => setRequest(null)

  return { request, dismiss }
}
