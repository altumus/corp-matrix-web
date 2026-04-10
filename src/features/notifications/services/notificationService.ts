import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { RoomEvent, ClientEvent, SyncState } from 'matrix-js-sdk'
import type { MatrixEvent, Room, IRoomTimelineData } from 'matrix-js-sdk'
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

export async function showDesktopNotification(title: string, body: string, roomId?: string) {
  if (Notification.permission !== 'granted') return
  if (document.hasFocus()) return

  const options: NotificationOptions = {
    body,
    icon: '/corp-logo.png',
    tag: roomId,
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, options)
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

export function setupNotificationListeners() {
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
      if (event.getType() !== 'm.room.message') return

      // Muted rooms: skip unless user was @mentioned (Telegram-style)
      const pushRules = client.pushRules
      const isMuted = !!pushRules?.global?.room?.find((r) => r.rule_id === room.roomId)
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

      showDesktopNotification(senderName, body, room.roomId)
      playNotificationSound()
    },
  )
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
