import { useCallback, useEffect, useRef } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { ClientEvent, RoomEvent, MatrixEventEvent, SyncState } from 'matrix-js-sdk'
import { NotificationCountType } from 'matrix-js-sdk/lib/models/room.js'
import type { Room } from 'matrix-js-sdk'
import { useRoomListStore } from '../store/roomListStore.js'
import { useSpacesStore } from '../../spaces/store/spacesStore.js'
import type { RoomListEntry } from '../types.js'

function getLastMessage(room: Room): { body: string; sender: string; senderId: string; ts: number } {
  const timeline = room.getLiveTimeline().getEvents()
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    if (event.getType() === 'm.room.message') {
      const content = event.getContent()
      const senderId = event.getSender()!
      const sender = room.getMember(senderId)?.name || senderId
      return {
        body: (content.body as string) || '',
        sender,
        senderId,
        ts: event.getTs(),
      }
    }
  }
  return { body: '', sender: '', senderId: '', ts: room.getLastActiveTimestamp() }
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

function roomToEntry(room: Room): RoomListEntry | null {
  const lastMsg = getLastMessage(room)
  const client = getMatrixClient()
  if (!client) return null
  const myUserId = client.getUserId()
  if (!myUserId) return null

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
    lastMessageSenderId: lastMsg.senderId,
    lastMessageTs: lastMsg.ts || room.getLastActiveTimestamp(),
    unreadCount: room.getUnreadNotificationCount() || 0,
    highlightCount: room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) || 0,
    isDirect,
    isInvite: room.getMyMembership() === 'invite',
    isEncrypted: room.hasEncryptionStateEvent(),
    isSavedMessages: savedMessages,
    isPinned: !!(room.tags?.['m.favourite']),
    isArchived: !!(room.tags?.['m.archive']),
  }
}

export function useRoomList() {
  const { rooms, searchQuery, setRooms, setInitialLoading } = useRoomListStore()
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const spaces = useSpacesStore((s) => s.spaces)

  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(() => {
    const client = getMatrixClient()
    if (!client) return

    const matrixRooms = client.getRooms()
    const entries = matrixRooms
      .filter((r) => {
        const membership = r.getMyMembership()
        if (membership !== 'join' && membership !== 'invite') return false
        const createEvent = r.currentState.getStateEvents('m.room.create', '')
        if (createEvent?.getContent()?.type === 'm.space') return false
        return true
      })
      .map(roomToEntry).filter((e): e is RoomListEntry => e !== null)
      .sort((a, b) => {
        if (a.isSavedMessages && !b.isSavedMessages) return -1
        if (!a.isSavedMessages && b.isSavedMessages) return 1
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return b.lastMessageTs - a.lastMessageTs
      })

    setRooms(entries)
  }, [setRooms])

  const scheduleRefresh = useCallback(() => {
    if (throttleRef.current) return
    refresh()
    throttleRef.current = setTimeout(() => { throttleRef.current = null }, 300)
  }, [refresh])

  useEffect(() => {
    const client = getMatrixClient()
    if (!client) return

    const onSync = (state: SyncState) => {
      if (state === SyncState.Prepared || state === SyncState.Syncing) {
        setInitialLoading(false)
      }
      refresh()
    }
    // Instant refresh on:
    // - new room added (joinRoom from invite accept)
    // - own membership change
    // - new timeline event (so unread/highlight badges update before next sync)
    // - decrypted event (E2E rooms — mention is hidden until decrypt completes)
    const onRoom = () => refresh()
    const onMembership = () => refresh()
    const onTimeline = () => scheduleRefresh()
    const onDecrypted = () => scheduleRefresh()

    client.on(ClientEvent.Sync, onSync)
    client.on(ClientEvent.Room, onRoom)
    client.on(RoomEvent.MyMembership, onMembership)
    client.on(RoomEvent.Timeline, onTimeline)
    client.on(MatrixEventEvent.Decrypted, onDecrypted)

    return () => {
      client.removeListener(ClientEvent.Sync, onSync)
      client.removeListener(ClientEvent.Room, onRoom)
      client.removeListener(RoomEvent.MyMembership, onMembership)
      client.removeListener(RoomEvent.Timeline, onTimeline)
      client.removeListener(MatrixEventEvent.Decrypted, onDecrypted)
    }
  }, [refresh, scheduleRefresh, setInitialLoading])

  let filteredRooms = rooms

  if (activeSpaceId === '__archive__') {
    filteredRooms = filteredRooms.filter((r) => r.isArchived)
  } else {
    filteredRooms = filteredRooms.filter((r) => !r.isArchived)
    if (activeSpaceId) {
      const space = spaces.find((s) => s.roomId === activeSpaceId)
      if (space) {
        const childIds = new Set(space.childRoomIds)
        filteredRooms = filteredRooms.filter((r) => childIds.has(r.roomId))
      }
    }
  }

  // Tab filter
  const activeTab = useRoomListStore((s) => s.activeTab)
  if (activeTab === 'unread') {
    filteredRooms = filteredRooms.filter((r) => r.unreadCount > 0 || r.highlightCount > 0)
  } else if (activeTab === 'dms') {
    filteredRooms = filteredRooms.filter((r) => r.isDirect)
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
