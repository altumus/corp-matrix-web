import { useMemo } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import type { RoomSummary } from '../types.js'

export function useRoom(roomId: string | undefined) {
  const room = useMemo<RoomSummary | null>(() => {
    if (!roomId) return null

    const client = getMatrixClient()
    if (!client) return null

    const matrixRoom = client.getRoom(roomId)
    if (!matrixRoom) return null

    return {
      roomId: matrixRoom.roomId,
      name: matrixRoom.name || roomId,
      avatarUrl: matrixRoom.getMxcAvatarUrl() ?? null,
      topic: matrixRoom.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic as string | undefined,
      isDirect: !!matrixRoom.getDMInviter(),
      isEncrypted: matrixRoom.hasEncryptionStateEvent(),
      memberCount: matrixRoom.getJoinedMemberCount(),
    }
  }, [roomId])

  return { room, loading: false }
}
