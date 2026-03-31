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

    let avatarUrl = matrixRoom.getMxcAvatarUrl() ?? null
    const members = matrixRoom.getJoinedMembers()
    const isDirect = members.length === 2
    if (!avatarUrl && isDirect) {
      const myUserId = client.getUserId()!
      const other = members.find((m) => m.userId !== myUserId)
      avatarUrl = other?.getMxcAvatarUrl() ?? null
    }

    return {
      roomId: matrixRoom.roomId,
      name: matrixRoom.name || roomId,
      avatarUrl,
      topic: matrixRoom.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic as string | undefined,
      isDirect,
      isEncrypted: matrixRoom.hasEncryptionStateEvent(),
      memberCount: matrixRoom.getJoinedMemberCount(),
    }
  }, [roomId])

  return { room, loading: false }
}
