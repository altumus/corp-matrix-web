import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { RoomEvent, ClientEvent, SyncState, RoomMemberEvent } from 'matrix-js-sdk'
import type { MatrixEvent, Room, IRoomTimelineData, RoomMember } from 'matrix-js-sdk'
import { useRoomListStore } from '../../room-list/store/roomListStore.js'
import { getThreadRootId } from '../../room/utils/threadRelations.js'

let notificationSound: HTMLAudioElement | null = null
let soundUnlocked = false

export function initNotificationSound() {
  notificationSound = new Audio('/notification.wav')
  notificationSound.volume = 0.3
}

function unlockAudio() {
  if (soundUnlocked || !notificationSound) return
  const ctx = new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const buffer = ctx.createBuffer(1, 1, 22050)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start()

  notificationSound.play().then(() => {
    notificationSound!.pause()
    notificationSound!.currentTime = 0
    soundUnlocked = true
  }).catch(() => {})

  document.removeEventListener('touchstart', unlockAudio, true)
  document.removeEventListener('click', unlockAudio, true)
}

export function setupAudioUnlock() {
  document.addEventListener('touchstart', unlockAudio, { capture: true, once: true })
  document.addEventListener('click', unlockAudio, { capture: true, once: true })
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

/** Strip HTML tags, markdown syntax, and decode entities for clean notification body */
function sanitizeNotificationBody(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')                    // strip HTML tags
    .replace(/```[\s\S]*?```/g, '[код]')        // code blocks → [код]
    .replace(/`([^`]+)`/g, '$1')                // inline code → content
    .replace(/\*\*(.+?)\*\*/g, '$1')            // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')                // *italic* → italic
    .replace(/~~(.+?)~~/g, '$1')                // ~~strike~~ → strike
    .replace(/^> /gm, '')                       // > quote → quote
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')    // [text](url) → text
    .replace(/#{1,6}\s/g, '')                    // # heading → heading
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')                       // collapse whitespace
    .trim()
    .slice(0, 200)                              // limit length
}

export async function showDesktopNotification(title: string, body: string, roomId?: string) {
  if (Notification.permission !== 'granted') return

  const cleanBody = sanitizeNotificationBody(body)

  const options: NotificationOptions = {
    body: cleanBody,
    icon: '/corp-logo.png',
    tag: roomId,
  }

  // Prefer SW-based notification — avoids duplication across tabs
  // (SW deduplicates by tag, multiple tabs share one SW)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, {
        ...options,
        data: { roomId },
      })
      return
    } catch {
      // fallback below
    }
  }

  const notification = new Notification(title, options)
  notification.onclick = () => {
    window.focus()
    if (roomId) {
      window.location.href = `/rooms/${encodeURIComponent(roomId)}`
    }
    notification.close()
  }
}

export function playNotificationSound() {
  if (!notificationSound) return
  notificationSound.currentTime = 0
  notificationSound.play().catch(() => {})
}

let notificationListenersSetup = false

export function setupNotificationListeners() {
  if (notificationListenersSetup) return
  notificationListenersSetup = true

  const client = getMatrixClient()
  if (!client) return

  let initialSyncDone = false

  const syncState = client.getSyncState()
  if (syncState === SyncState.Prepared || syncState === SyncState.Syncing) {
    initialSyncDone = true
  } else {
    const onSync = (state: SyncState) => {
      if (state === SyncState.Prepared || state === SyncState.Syncing) {
        initialSyncDone = true
        client.removeListener(ClientEvent.Sync, onSync)
      }
    }
    client.on(ClientEvent.Sync, onSync)
  }

  // Cache for event sender lookups (avoids repeated server fetches)
  const eventSenderCache = new Map<string, string>()
  const MAX_CACHE_SIZE = 200

  function cacheEventSender(eventId: string, senderId: string) {
    if (eventSenderCache.size >= MAX_CACHE_SIZE) {
      const firstKey = eventSenderCache.keys().next().value as string
      eventSenderCache.delete(firstKey)
    }
    eventSenderCache.set(eventId, senderId)
  }

  async function getEventSender(roomId: string, eventId: string): Promise<string | null> {
    const cached = eventSenderCache.get(eventId)
    if (cached) return cached

    try {
      const result = await client.fetchRoomEvent(roomId, eventId)
      const senderId = result?.sender as string | undefined
      if (senderId) cacheEventSender(eventId, senderId)
      return senderId || null
    } catch {
      return null
    }
  }

  client.on(
    RoomEvent.Timeline,
    (event: MatrixEvent, room: Room | undefined, _toStart: boolean | undefined, _removed: boolean, data: IRoomTimelineData) => {
      if (!initialSyncDone) return
      if (!data.liveEvent) return
      if (!event || !room) return

      const sender = event.getSender()
      if (sender === client.getUserId()) return

      const eventType = event.getType()

      // Handle reaction events — notify only when someone reacts to MY message
      if (eventType === 'm.reaction') {
        const relatesTo = event.getContent()?.['m.relates_to']
        const targetEventId = relatesTo?.event_id as string | undefined
        const reactionKey = relatesTo?.key as string | undefined
        if (targetEventId && room) {
          const showReactionNotification = () => {
            const reactorMember = room.getMember(sender!)
            const reactorName = reactorMember?.name || sender || ''
            const roomName = room.name || ''
            const reactTitle = roomName && roomName !== reactorName
              ? `${reactorName} — ${roomName}`
              : reactorName
            showDesktopNotification(
              reactTitle,
              `${reactionKey || '👍'} реакция на ваше сообщение`,
              room.roomId,
            )
            playNotificationSound()
          }

          const targetEvent = room.findEventById(targetEventId)
          if (targetEvent && targetEvent.getSender() === client.getUserId()) {
            showReactionNotification()
          } else if (!targetEvent) {
            // Event not in loaded timeline — check server
            void getEventSender(room.roomId, targetEventId).then((targetSender) => {
              if (targetSender === client.getUserId()) {
                showReactionNotification()
              }
            })
          }
        }
        return
      }

      if (eventType !== 'm.room.message') return

      const content = event.getContent()
      const mMentions = content['m.mentions'] as { user_ids?: string[]; room?: boolean } | undefined
      const myUserId = client.getUserId()!
      const isMentioned = !!(mMentions?.user_ids?.includes(myUserId) || mMentions?.room)

      // Muted rooms: skip unless user was @mentioned (Telegram-style)
      const pushRules = client.pushRules
      const isMuted = !!pushRules?.global?.room?.find((r) => r.rule_id === room.roomId)

      // Check if room is muted via tag (in addition to push rules)
      const roomTags = room.tags || {}
      const isMutedByTag = !!roomTags['m.mute']
      if (isMutedByTag && !isMentioned) return

      if (isMuted && !isMentioned) {
        const actions = client.pushProcessor.actionsForEvent(event)
        if (!actions.tweaks?.highlight) return
      }

      const currentRoomId = useRoomListStore.getState().selectedRoomId
      const isInCurrentRoom = currentRoomId === room.roomId && document.hasFocus()

      // Thread messages: notify even if user is in the room but not viewing this thread
      const threadRootId = getThreadRootId(event)
      const isThreadMessage = threadRootId !== undefined

      if (isInCurrentRoom) {
        if (!isThreadMessage) return
        // In room but is the user viewing this specific thread?
        const activeThread = useRoomListStore.getState().activeThreadRootId
        if (activeThread === threadRootId) return
      }

      const body = (content.body as string) || ''
      const senderMember = room.getMember(sender!)
      const senderName = senderMember?.name || sender || ''
      const roomName = room.name || ''

      // Format: "Sender — Room" for groups, just "Sender" for DMs
      const isDm = room.getJoinedMemberCount() <= 2
      let title = isDm || !roomName || roomName === senderName
        ? senderName
        : `${senderName} — ${roomName}`

      if (isMentioned) {
        title = `@ ${title}`
      }

      showDesktopNotification(title, body, room.roomId)
      playNotificationSound()
    },
  )

  // B16: Notification when invited members join my rooms
  client.on(RoomMemberEvent.Membership, (event: MatrixEvent, member: RoomMember) => {
    if (!initialSyncDone) return
    if (member.userId === client.getUserId()) return // not our own changes

    const prev = event.getPrevContent()?.membership
    const curr = member.membership
    if (prev !== 'invite' || curr !== 'join') return

    const room = client.getRoom(event.getRoomId()!)
    if (!room) return

    const myMembership = room.getMyMembership()
    if (myMembership !== 'join') return // we're not in this room

    const name = member.name || member.userId
    const roomName = room.name || 'комната'
    showDesktopNotification(roomName, `${name} присоединился к комнате`, room.roomId)
  })
}

export type NotificationLevel = 'all' | 'mentions' | 'mute'

export async function setRoomNotificationLevel(
  roomId: string,
  level: NotificationLevel,
): Promise<void> {
  const client = getMatrixClient()
  if (!client) return

  await client.setRoomAccountData(roomId, 'corp.notification_level', {
    level,
  })
}
