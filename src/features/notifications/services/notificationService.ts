import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { RoomEvent } from 'matrix-js-sdk'
import type { MatrixEvent, Room } from 'matrix-js-sdk'

let notificationSound: HTMLAudioElement | null = null

export function initNotificationSound() {
  notificationSound = new Audio('/notification.mp3')
  notificationSound.volume = 0.5
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export function showDesktopNotification(title: string, body: string, roomId?: string) {
  if (Notification.permission !== 'granted') return
  if (document.hasFocus()) return

  const notification = new Notification(title, {
    body,
    icon: '/favicon.svg',
    tag: roomId,
  })

  notification.onclick = () => {
    window.focus()
    if (roomId) {
      window.location.href = `/rooms/${encodeURIComponent(roomId)}`
    }
    notification.close()
  }
}

export function playNotificationSound() {
  notificationSound?.play().catch(() => {
    // autoplay blocked
  })
}

export function setupNotificationListeners() {
  const client = getMatrixClient()
  if (!client) return

  client.on(RoomEvent.Timeline, (event: MatrixEvent, room: Room | undefined) => {
    if (!event || !room) return

    const sender = event.getSender()
    if (sender === client.getUserId()) return

    if (event.getType() !== 'm.room.message') return

    const content = event.getContent()
    const body = (content.body as string) || ''
    const senderMember = room.getMember(sender!)
    const senderName = senderMember?.name || sender || ''

    showDesktopNotification(senderName, body, room.roomId)
    playNotificationSound()
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
