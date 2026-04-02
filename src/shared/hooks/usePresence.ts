import { useEffect, useState } from 'react'
import { getMatrixClient } from '../lib/matrixClient.js'
import { UserEvent } from 'matrix-js-sdk'

export interface PresenceInfo {
  online: boolean
  lastActiveAgo: number | null
  statusMsg: string | null
}

export function usePresence(userId: string | null | undefined): PresenceInfo | null {
  const [presence, setPresence] = useState<PresenceInfo | null>(null)

  useEffect(() => {
    if (!userId) return

    const client = getMatrixClient()
    if (!client) return

    const update = () => {
      const user = client.getUser(userId)
      if (!user) return

      setPresence({
        online: user.presence === 'online',
        lastActiveAgo: user.lastActiveAgo ?? null,
        statusMsg: user.presenceStatusMsg ?? null,
      })
    }

    update()

    const onPresence = () => update()
    const user = client.getUser(userId)
    user?.on(UserEvent.Presence, onPresence)

    return () => {
      user?.removeListener(UserEvent.Presence, onPresence)
    }
  }, [userId])

  return presence
}

export function getDmPartnerId(roomId: string): string | null {
  const client = getMatrixClient()
  if (!client) return null

  const room = client.getRoom(roomId)
  if (!room) return null

  const members = room.getJoinedMembers()
  if (members.length !== 2) return null

  const myUserId = client.getUserId()
  const other = members.find((m) => m.userId !== myUserId)
  return other?.userId ?? null
}
