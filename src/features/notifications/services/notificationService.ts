import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { RoomEvent, ClientEvent, SyncState, RoomMemberEvent } from 'matrix-js-sdk'
import type { MatrixEvent, Room, IRoomTimelineData, RoomMember } from 'matrix-js-sdk'
import { useRoomListStore } from '../../room-list/store/roomListStore.js'

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

/** Strip HTML tags and decode entities for clean notification body */
function sanitizeNotificationBody(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim()
    .slice(0, 200)                     // limit length
}

export async function showDesktopNotification(title: string, body: string, roomId?: string) {
  if (Notification.permission !== 'granted') return
  if (document.hasFocus()) return

  const cleanBody = sanitizeNotificationBody(body)

  const options: NotificationOptions & { renotify?: boolean } = {
    body: cleanBody,
    icon: '/corp-logo.png',
    tag: roomId,
    // Renotify so updated messages in same room re-alert
    renotify: !!roomId,
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
          const targetEvent = room.findEventById(targetEventId)
          if (targetEvent && targetEvent.getSender() === client.getUserId()) {
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
        }
        return
      }

      if (eventType !== 'm.room.message') return

      // Muted rooms: skip unless user was @mentioned (Telegram-style)
      const pushRules = client.pushRules
      const isMuted = !!pushRules?.global?.room?.find((r) => r.rule_id === room.roomId)

      // Check if room is muted via tag (in addition to push rules)
      const roomTags = room.tags || {}
      const isMutedByTag = !!roomTags['m.mute']
      if (isMutedByTag) return

      if (isMuted) {
        const actions = client.pushProcessor.actionsForEvent(event)
        if (!actions.tweaks?.highlight) return
      }

      const currentRoomId = useRoomListStore.getState().selectedRoomId
      const isInCurrentRoom = currentRoomId === room.roomId && document.hasFocus()

      if (isInCurrentRoom) return

      const content = event.getContent()
      const body = (content.body as string) || ''
      const senderMember = room.getMember(sender!)
      const senderName = senderMember?.name || sender || ''
      const roomName = room.name || ''

      // Format: "Sender — Room" for groups, just "Sender" for DMs
      const isDm = room.getJoinedMemberCount() <= 2
      const title = isDm || !roomName || roomName === senderName
        ? senderName
        : `${senderName} — ${roomName}`

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
