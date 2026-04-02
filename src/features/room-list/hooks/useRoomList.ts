import { useCallback, useEffect } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { ClientEvent } from 'matrix-js-sdk'
import { NotificationCountType } from 'matrix-js-sdk/lib/models/room.js'
import type { Room } from 'matrix-js-sdk'
import { useRoomListStore } from '../store/roomListStore.js'
import { useSpacesStore } from '../../spaces/store/spacesStore.js'
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

function isSelfDm(room: Room, myUserId: string): boolean {
  const members = room.getJoinedMembers()
  if (members.length === 1 && members[0].userId === myUserId) {
    return true
  }
  if (members.length === 2 && members.every((m) => m.userId === myUserId)) {
    return true
  }
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
  const myUserId = client.getUserId()!

  const savedMessages = isSelfDm(room, myUserId)
  const isDirect = savedMessages || isDmRoom(room)
  let avatarUrl = room.getMxcAvatarUrl() ?? null
  if (!avatarUrl && isDirect && !savedMessages) {
    avatarUrl = getDmPartnerAvatar(room, myUserId) ?? null
  }

  return {
    roomId: room.roomId,
    name: room.name || room.roomId,
    avatarUrl,
    lastMessage: lastMsg.body,
    lastMessageSender: savedMessages ? '' : lastMsg.sender,
    lastMessageTs: lastMsg.ts || room.getLastActiveTimestamp(),
    unreadCount: room.getUnreadNotificationCount() || 0,
    highlightCount: room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) || 0,
    isDirect,
    isInvite: room.getMyMembership() === 'invite',
    isEncrypted: room.hasEncryptionStateEvent(),
    isSavedMessages: savedMessages,
  }
}

export function useRoomList() {
  const { rooms, searchQuery, setRooms } = useRoomListStore()
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const spaces = useSpacesStore((s) => s.spaces)

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
      .sort((a, b) => {
        if (a.isSavedMessages && !b.isSavedMessages) return -1
        if (!a.isSavedMessages && b.isSavedMessages) return 1
        return b.lastMessageTs - a.lastMessageTs
      })

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

  let filteredRooms = rooms

  if (activeSpaceId) {
    const space = spaces.find((s) => s.roomId === activeSpaceId)
    if (space) {
      const childIds = new Set(space.childRoomIds)
      filteredRooms = filteredRooms.filter((r) => childIds.has(r.roomId))
    }
  }

  if (searchQuery) {
    filteredRooms = filteredRooms.filter((r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }

  const invites = filteredRooms.filter((r) => r.isInvite)
  const joined = filteredRooms.filter((r) => !r.isInvite)

  return { rooms: joined, invites, refresh }
}
