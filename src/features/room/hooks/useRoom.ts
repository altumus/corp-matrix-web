import { useEffect, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { ClientEvent } from 'matrix-js-sdk'
import type { RoomSummary } from '../types.js'

function resolveRoom(roomId: string | undefined): RoomSummary | null {
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
}

export function useRoom(roomId: string | undefined) {
  const [state, setState] = useState(() => {
    const r = resolveRoom(roomId)
    return { room: r, loading: !r, trackedRoomId: roomId }
  })

  if (state.trackedRoomId !== roomId) {
    const r = resolveRoom(roomId)
    setState({ room: r, loading: !r, trackedRoomId: roomId })
  }

  useEffect(() => {
    if (state.room) return

    const client = getMatrixClient()
    if (!client) return

    const onSync = () => {
      const r = resolveRoom(roomId)
      if (r) {
        setState({ room: r, loading: false, trackedRoomId: roomId })
      }
    }

    client.on(ClientEvent.Sync, onSync)
    return () => {
      client.removeListener(ClientEvent.Sync, onSync)
    }
  }, [roomId, state.room])

  return { room: state.room, loading: state.loading }
}
