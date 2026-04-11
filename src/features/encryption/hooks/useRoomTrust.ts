import { useState, useEffect } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'

/**
 * Returns true if all devices of all room members are verified.
 * Returns null while loading.
 */
export function useRoomTrust(roomId: string, isEncrypted: boolean): boolean | null {
  const client = useMatrixClient()
  const [trusted, setTrusted] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isEncrypted) {
      setTrusted(null)
      return
    }

    let cancelled = false
    const check = async () => {
      const crypto = client?.getCrypto()
      if (!client || !crypto) {
        if (!cancelled) setTrusted(null)
        return
      }

      const room = client.getRoom(roomId)
      if (!room) return

      try {
        const members = room.getJoinedMembers()
        for (const member of members) {
          const devices = await crypto.getUserDeviceInfo([member.userId])
          const userDevices = devices.get(member.userId)
          if (!userDevices) continue

          for (const [deviceId] of userDevices) {
            const status = await crypto.getDeviceVerificationStatus(member.userId, deviceId)
            if (status && !status.isVerified()) {
              if (!cancelled) setTrusted(false)
              return
            }
          }
        }
        if (!cancelled) setTrusted(true)
      } catch {
        if (!cancelled) setTrusted(null)
      }
    }

    check()
    return () => { cancelled = true }
  }, [roomId, isEncrypted, client])

  return trusted
}
