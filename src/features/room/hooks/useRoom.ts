import { useEffect, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { ClientEvent, RoomStateEvent } from 'matrix-js-sdk'
import type { MatrixClient } from 'matrix-js-sdk'
import type { RoomSummary } from '../types.js'

function isDirectRoom(client: MatrixClient, roomId: string): boolean {
  const event = client.getAccountData('m.direct')
  if (!event) return false
  const content = event.getContent() as Record<string, string[]>
  for (const roomIds of Object.values(content)) {
    if (Array.isArray(roomIds) && roomIds.includes(roomId)) return true
  }
  return false
}

function resolveRoom(roomId: string | undefined): RoomSummary | null {
  if (!roomId) return null

  const client = getMatrixClient()
  if (!client) return null

  const matrixRoom = client.getRoom(roomId)
  if (!matrixRoom) return null

  const isDirect = isDirectRoom(client, roomId)
  let avatarUrl = matrixRoom.getMxcAvatarUrl() ?? null
  if (!avatarUrl && isDirect) {
    const myUserId = client.getUserId()!
    const members = [
      ...matrixRoom.getJoinedMembers(),
      ...matrixRoom.getMembersWithMembership('invite'),
    ]
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
}

function summariesEqual(a: RoomSummary | null, b: RoomSummary | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.roomId === b.roomId &&
    a.name === b.name &&
    a.avatarUrl === b.avatarUrl &&
    a.topic === b.topic &&
    a.isDirect === b.isDirect &&
    a.isEncrypted === b.isEncrypted &&
    a.memberCount === b.memberCount
  )
}

export function useRoom(roomId: string | undefined) {
  const client = useMatrixClient()
  const [room, setRoom] = useState<RoomSummary | null>(() => resolveRoom(roomId))
  const [trackedRoomId, setTrackedRoomId] = useState(roomId)

  if (trackedRoomId !== roomId) {
    setRoom(resolveRoom(roomId))
    setTrackedRoomId(roomId)
  }

  useEffect(() => {
    if (!client || !roomId) return

    const refresh = () => {
      const next = resolveRoom(roomId)
      setRoom((prev) => (summariesEqual(prev, next) ? prev : next))
    }

    const matrixRoom = client.getRoom(roomId)
    matrixRoom?.currentState.on(RoomStateEvent.Events, refresh)
    matrixRoom?.currentState.on(RoomStateEvent.Members, refresh)
    client.on(ClientEvent.Sync, refresh)

    return () => {
      matrixRoom?.currentState.removeListener(RoomStateEvent.Events, refresh)
      matrixRoom?.currentState.removeListener(RoomStateEvent.Members, refresh)
      client.removeListener(ClientEvent.Sync, refresh)
    }
  }, [client, roomId])

  return { room, loading: !room }
}
