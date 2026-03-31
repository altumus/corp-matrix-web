import { useCallback, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'

export type CallStatus = 'idle' | 'ringing' | 'connected' | 'ended'

export function useCall(roomId: string) {
  const [status, setStatus] = useState<CallStatus>('idle')

  const startCall = useCallback(
    async (video: boolean) => {
      const client = getMatrixClient()
      if (!client) return

      setStatus('ringing')

      try {
        // matrix-js-sdk VoIP call creation
        // In production, use client.createCall(roomId) for 1:1
        // or Element Call widget for group calls (MSC3401)
        void video
        void roomId
        setStatus('connected')
      } catch {
        setStatus('ended')
      }
    },
    [roomId],
  )

  const endCall = useCallback(() => {
    setStatus('ended')
    setTimeout(() => setStatus('idle'), 1000)
  }, [])

  return { status, startCall, endCall }
}
