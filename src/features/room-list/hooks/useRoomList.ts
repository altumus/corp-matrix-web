import { useCallback, useEffect } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { ClientEvent } from 'matrix-js-sdk'
import { NotificationCountType } from 'matrix-js-sdk/lib/models/room.js'
import type { Room } from 'matrix-js-sdk'
import { useRoomListStore } from '../store/roomListStore.js'
import type { RoomListEntry } from '../types.js'

function getLastMessage(room: Room): { body: string; sender: string; ts: number } {
  const timeline = room.getLiveTimeline().getEvents()
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event.getType() === 'm.room.message') {
      const content = event.getContent()
      const sender = room.getMember(event.getSender()!)?.name || event.getSender()!
      return {
        body: (content.body as string) || '',
        sender,
        ts: event.getTs(),
      }
    }
  }
  return { body: '', sender: '', ts: room.getLastActiveTimestamp() }
}

function isDmRoom(room: Room): boolean {
  const members = room.getJoinedMembers()
  if (members.length === 2) return true
  if (members.length <= 2 && room.getDMInviter()) return true
  return false
}

function getDmPartnerAvatar(room: Room, myUserId: string): string | null {
  const members = room.getJoinedMembers()
  const other = members.find((m) => m.userId !== myUserId)
  return other?.getMxcAvatarUrl() ?? null
}

function roomToEntry(room: Room): RoomListEntry {
  const lastMsg = getLastMessage(room)
  const client = getMatrixClient()!

  const isDirect = isDmRoom(room)
  let avatarUrl = room.getMxcAvatarUrl() ?? null
  if (!avatarUrl && isDirect) {
    avatarUrl = getDmPartnerAvatar(room, client.getUserId()!) ?? null
  }

  return {
    roomId: room.roomId,
    name: room.name || room.roomId,
    avatarUrl,
    lastMessage: lastMsg.body,
    lastMessageSender: lastMsg.sender,
    lastMessageTs: lastMsg.ts || room.getLastActiveTimestamp(),
    unreadCount: room.getUnreadNotificationCount() || 0,
    highlightCount: room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) || 0,
    isDirect,
    isInvite: room.getMyMembership() === 'invite',
    isEncrypted: room.hasEncryptionStateEvent(),
  }
}

export function useRoomList() {
  const { rooms, searchQuery, setRooms } = useRoomListStore()

  const refresh = useCallback(() => {
    const client = getMatrixClient()
    if (!client) return

    const matrixRooms = client.getRooms()
    const entries = matrixRooms
      .filter((r) => {
        const membership = r.getMyMembership()
        return membership === 'join' || membership === 'invite'
      })
      .map(roomToEntry)
      .sort((a, b) => b.lastMessageTs - a.lastMessageTs)

    setRooms(entries)
  }, [setRooms])

  useEffect(() => {
    const client = getMatrixClient()
    if (!client) return

    refresh()

    const onSync = () => refresh()
    client.on(ClientEvent.Sync, onSync)

    return () => {
      client.removeListener(ClientEvent.Sync, onSync)
    }
  }, [refresh])

  const filteredRooms = searchQuery
    ? rooms.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : rooms

  const invites = filteredRooms.filter((r) => r.isInvite)
  const joined = filteredRooms.filter((r) => !r.isInvite)

  return { rooms: joined, invites, refresh }
}
