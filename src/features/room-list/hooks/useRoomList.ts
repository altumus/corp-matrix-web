import { useCallback, useEffect, useRef } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { ClientEvent, RoomEvent, MatrixEventEvent, SyncState } from 'matrix-js-sdk'
import { NotificationCountType } from 'matrix-js-sdk/lib/models/room.js'
import type { MatrixEvent, Room } from 'matrix-js-sdk'
import { useRoomListStore } from '../store/roomListStore.js'
import { useSpacesStore } from '../../spaces/store/spacesStore.js'
import type { RoomListEntry } from '../types.js'
import { roomHasUnreadThreads } from '../../room/hooks/useRoomThreads.js'

function isThreadEvent(event: MatrixEvent): boolean {
  const rel = event.getContent()?.['m.relates_to'] as Record<string, unknown> | undefined
  return rel?.rel_type === 'm.thread'
}

function getLastMessage(room: Room): { body: string; sender: string; senderId: string; ts: number; inThread: boolean } {
  const timeline = room.getLiveTimeline().getEvents()
  for (let i = timeline.length - 1; i >= 0; i--) {
    const event = timeline[i]
    const type = event.getType()

    if (type === 'm.room.message') {
      const content = event.getContent()
      const senderId = event.getSender()!
      const sender = room.getMember(senderId)?.name || senderId
      return {
        body: (content.body as string) || '',
        sender,
        senderId,
        ts: event.getTs(),
        inThread: isThreadEvent(event),
      }
    }

    // Encrypted events that haven't been decrypted yet
    if (type === 'm.room.encrypted') {
      const senderId = event.getSender()!
      const sender = room.getMember(senderId)?.name || senderId
      return {
        body: 'Зашифрованное сообщение',
        sender,
        senderId,
        ts: event.getTs(),
        inThread: isThreadEvent(event),
      }
    }

    if (type === 'm.sticker') {
      const senderId = event.getSender()!
      const sender = room.getMember(senderId)?.name || senderId
      return {
        body: 'Стикер',
        sender,
        senderId,
        ts: event.getTs(),
        inThread: isThreadEvent(event),
      }
    }
  }
  return { body: '', sender: '', senderId: '', ts: room.getLastActiveTimestamp(), inThread: false }
}

function getActiveMembers(room: Room) {
  return [
    ...room.getJoinedMembers(),
    ...room.getMembersWithMembership('invite'),
  ]
}

function isDmRoom(room: Room): boolean {
  const client = getMatrixClient()
  if (client) {
    const event = client.getAccountData('m.direct')
    if (event) {
      const content = event.getContent() as Record<string, string[]>
      for (const roomIds of Object.values(content)) {
        if (Array.isArray(roomIds) && roomIds.includes(room.roomId)) return true
      }
    }
  }
  // Fallback for invitee side: m.direct may not be set yet, but the inviter
  // marked the membership event as is_direct.
  if (room.getDMInviter()) return true
  return false
}

function isSelfDm(room: Room, myUserId: string): boolean {
  const members = getActiveMembers(room)
  if (members.length === 0) return false
  return members.every((m) => m.userId === myUserId)
}

function getDmPartnerAvatar(room: Room, myUserId: string): string | null {
  const members = getActiveMembers(room)
  const other = members.find((m) => m.userId !== myUserId)
  return other?.getMxcAvatarUrl() ?? null
}

// Module-level cache for mention detection (invalidated on refresh)
const mentionCache = new Map<string, number>() // roomId → highlightCount override
let lastMentionScan = 0

function getMentionFallback(room: Room, myUserId: string): number {
  const roomId = room.roomId

  // Only re-scan if room has unread AND we haven't scanned recently (1s cooldown)
  const now = Date.now()
  if (now - lastMentionScan < 1000 && mentionCache.has(roomId)) {
    return mentionCache.get(roomId)!
  }

  const unread = room.getUnreadNotificationCount()
  if (unread === 0) {
    mentionCache.set(roomId, 0)
    return 0
  }

  // Only scan last 50 events (not entire timeline)
  const timeline = room.getLiveTimeline().getEvents()
  const start = Math.max(0, timeline.length - 50)
  const readUpTo = room.getEventReadUpTo(myUserId)
  let pastRead = !readUpTo

  for (let i = start; i < timeline.length; i++) {
    const ev = timeline[i]
    if (ev.getId() === readUpTo) { pastRead = true; continue }
    if (!pastRead || ev.getSender() === myUserId) continue
    const mentions = ev.getContent()['m.mentions'] as { user_ids?: string[]; room?: boolean } | undefined
    if (mentions?.user_ids?.includes(myUserId) || mentions?.room) {
      mentionCache.set(roomId, 1)
      lastMentionScan = now
      return 1
    }
  }

  mentionCache.set(roomId, 0)
  lastMentionScan = now
  return 0
}

// Module-level entry cache — invalidate per room when activity changes
const entryCache = new Map<string, { entry: RoomListEntry; lastTs: number; unread: number; lastBody: string; lastInThread: boolean; threadsUnread: boolean }>()

function cachedRoomToEntry(room: Room): RoomListEntry | null {
  const roomId = room.roomId
  const lastTs = room.getLastActiveTimestamp() || 0
  const unread = room.getUnreadNotificationCount() || 0
  const cached = entryCache.get(roomId)

  // Also check last message body — it changes when encrypted events get decrypted
  const lastMsg = getLastMessage(room)
  const lastBody = lastMsg.body
  const lastInThread = lastMsg.inThread
  const threadsUnread = roomHasUnreadThreads(room, getMatrixClient()?.getUserId() ?? null)

  // Cache hit if timestamp, unread count, last message body, thread flag, and thread-unread haven't changed
  if (
    cached &&
    cached.lastTs === lastTs &&
    cached.unread === unread &&
    cached.lastBody === lastBody &&
    cached.lastInThread === lastInThread &&
    cached.threadsUnread === threadsUnread
  ) {
    return cached.entry
  }

  const entry = roomToEntry(room)
  if (entry) {
    entryCache.set(roomId, { entry, lastTs, unread, lastBody, lastInThread, threadsUnread })
  }
  return entry
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

  let highlightCount = room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) || 0
  if (highlightCount === 0) {
    highlightCount = getMentionFallback(room, myUserId)
  }

  return {
    roomId: room.roomId,
    name: room.name || room.roomId,
    avatarUrl,
    lastMessage: lastMsg.body,
    lastMessageSender: savedMessages ? '' : lastMsg.sender,
    lastMessageSenderId: lastMsg.senderId,
    lastMessageTs: lastMsg.ts || room.getLastActiveTimestamp(),
    lastMessageInThread: lastMsg.inThread,
    hasUnreadThreads: roomHasUnreadThreads(room, myUserId),
    unreadCount: room.getUnreadNotificationCount() || 0,
    highlightCount,
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
      .map(cachedRoomToEntry).filter((e): e is RoomListEntry => e !== null)
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
    const onReceipt = () => scheduleRefresh()

    client.on(ClientEvent.Sync, onSync)
    client.on(ClientEvent.Room, onRoom)
    client.on(RoomEvent.MyMembership, onMembership)
    client.on(RoomEvent.Timeline, onTimeline)
    client.on(RoomEvent.Receipt, onReceipt)
    client.on(MatrixEventEvent.Decrypted, onDecrypted)

    return () => {
      client.removeListener(ClientEvent.Sync, onSync)
      client.removeListener(ClientEvent.Room, onRoom)
      client.removeListener(RoomEvent.MyMembership, onMembership)
      client.removeListener(RoomEvent.Timeline, onTimeline)
      client.removeListener(RoomEvent.Receipt, onReceipt)
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
