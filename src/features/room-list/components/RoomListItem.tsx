import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Bookmark, BellOff, Bell, Circle, Pin, ArrowDown, Home, Archive, LogOut, AtSign } from 'lucide-react'
import type { RoomListEntry } from '../types.js'
import { useRoomListStore } from '../store/roomListStore.js'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { Avatar, Badge, toast } from '../../../shared/ui/index.js'
import {
  MessageContextMenu,
  type ContextMenuAction,
} from '../../messaging/components/MessageContextMenu.js'
import { EncryptionBadge } from '../../encryption/components/EncryptionBadge.js'
import { usePresence, getDmPartnerId } from '../../../shared/hooks/usePresence.js'
import { useLongPress } from '../../../shared/hooks/useLongPress.js'
import { AddToSpaceDialog } from './AddToSpaceDialog.jsx'
import styles from './RoomListItem.module.scss'

interface RoomListItemProps {
  room: RoomListEntry
}

function SavedMessagesIcon() {
  return (
    <div className={styles.savedAvatar}>
      <Bookmark size={20} />
    </div>
  )
}

function getMessagePreview(room: RoomListEntry, myUserId: string | null, youLabel: string): string {
  if (!room.lastMessage) return ''
  // Replace SDK's UTD placeholder with a cleaner message
  const msg = room.lastMessage.startsWith('** Unable to decrypt')
    ? 'Зашифрованное сообщение'
    : room.lastMessage
  const isMyMessage = myUserId && room.lastMessageSenderId === myUserId
  if (room.isSavedMessages) return msg
  if (room.isDirect) {
    return isMyMessage ? `${youLabel}: ${msg}` : msg
  }
  if (isMyMessage) return `${youLabel}: ${msg}`
  if (room.lastMessageSender) return `${room.lastMessageSender}: ${msg}`
  return msg
}

function hasTag(roomId: string, tag: string): boolean {
  const client = getMatrixClient()
  if (!client) return false
  const room = client.getRoom(roomId)
  if (!room) return false
  const tags = room.tags || {}
  return !!tags[tag]
}

function isMuted(roomId: string): boolean {
  const client = getMatrixClient()
  if (!client) return false
  const rules = client.pushRules
  return !!rules?.global?.room?.find((r) => r.rule_id === roomId)
}

function isMarkedUnread(roomId: string): boolean {
  const client = getMatrixClient()
  if (!client) return false
  const room = client.getRoom(roomId)
  if (!room) return false
  try {
    const data = room.getAccountData('com.famedly.marked_unread')
    return !!(data?.getContent()?.unread)
  } catch {
    return false
  }
}

export function RoomListItem({ room }: RoomListItemProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const selectedRoomId = useRoomListStore((s) => s.selectedRoomId)
  const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom)
  const isSelected = selectedRoomId === room.roomId
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showSpaceDialog, setShowSpaceDialog] = useState(false)
  const [mutedLocal, setMutedLocal] = useState(() => isMuted(room.roomId))
  const [unreadLocal, setUnreadLocal] = useState(() => isMarkedUnread(room.roomId))
  const [lowPriorityLocal, setLowPriorityLocal] = useState(() => hasTag(room.roomId, 'm.lowpriority'))

  const client = getMatrixClient()
  const myUserId = client?.getUserId() ?? null
  const dmPartnerId = room.isDirect && !room.isSavedMessages ? getDmPartnerId(room.roomId) : null
  const presence = usePresence(dmPartnerId)

  const handleClick = () => {
    setSelectedRoom(room.roomId)

    // If user was mentioned — scroll to first (oldest) unread mention
    if (room.highlightCount > 0 && client) {
      const matrixRoom = client.getRoom(room.roomId)
      if (matrixRoom) {
        const timeline = matrixRoom.getLiveTimeline().getEvents()
        const myId = client.getUserId()
        const encodedId = myId ? encodeURIComponent(myId) : ''
        for (const ev of timeline) {
          if (ev.getSender() === myId) continue
          const content = ev.getContent()
          const mentions = content['m.mentions'] as { user_ids?: string[]; room?: boolean } | undefined
          const html = (content.formatted_body as string) || ''
          const isMention = mentions?.user_ids?.includes(myId!) || mentions?.room ||
            html.includes(`matrix.to/#/${encodedId}`) || html.includes(`matrix.to/#/${myId}`)
          if (isMention) {
            navigate(`/rooms/${encodeURIComponent(room.roomId)}?eventId=${encodeURIComponent(ev.getId()!)}`)
            return
          }
        }
      }
    }

    navigate(`/rooms/${encodeURIComponent(room.roomId)}`)
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const longPressHandlers = useLongPress({
    onLongPress: useCallback((e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (touch) {
        setContextMenu({ x: touch.clientX, y: touch.clientY })
      }
    }, []),
  })

  const isPinned = room.isPinned
  const isLowPriority = lowPriorityLocal
  const muted = mutedLocal
  const markedUnread = unreadLocal

  const contextMenuActions = useMemo<ContextMenuAction[]>(() => {
    const actions: ContextMenuAction[] = [
      {
        id: 'header',
        icon: null,
        label: room.isSavedMessages ? t('rooms.savedMessages') : room.name,
        onClick: () => {},
      },
      {
        id: 'mute',
        icon: muted ? <Bell size={16} /> : <BellOff size={16} />,
        label: muted ? t('rooms.unmuteNotifications') : t('rooms.muteNotifications'),
        onClick: () => {
          const c = getMatrixClient()
          if (!c) return
          if (muted) {
            c.deletePushRule('global', 'room' as never, room.roomId).catch((err: Error) => toast(err.message, 'error'))
          } else {
            c.addPushRule('global', 'room' as never, room.roomId, {
              actions: ['dont_notify' as never],
              conditions: [{ kind: 'event_match' as never, key: 'room_id', pattern: room.roomId }],
            } as never).catch((err: Error) => toast(err.message, 'error'))
          }
          setMutedLocal(!muted)
        },
      },
      {
        id: 'mark-unread',
        icon: <Circle size={16} />,
        label: markedUnread ? t('rooms.markRead') : t('rooms.markUnread'),
        onClick: () => {
          const c = getMatrixClient()
          if (!c) return
          c.setRoomAccountData(room.roomId, 'com.famedly.marked_unread' as never, { unread: !markedUnread } as never).catch((err: Error) => toast(err.message, 'error'))
          setUnreadLocal(!markedUnread)
        },
      },
      {
        id: 'pin',
        icon: <Pin size={16} />,
        label: isPinned ? t('rooms.unpin') : t('rooms.pin'),
        onClick: () => {
          const c = getMatrixClient()
          if (!c) return
          if (isPinned) {
            c.deleteRoomTag(room.roomId, 'm.favourite').catch((err: Error) => toast(err.message, 'error'))
          } else {
            c.setRoomTag(room.roomId, 'm.favourite', { order: 0.5 }).catch((err: Error) => toast(err.message, 'error'))
          }
        },
      },
      {
        id: 'low-priority',
        icon: <ArrowDown size={16} />,
        label: isLowPriority ? t('rooms.removeLowPriority') : t('rooms.lowPriority'),
        onClick: () => {
          const c = getMatrixClient()
          if (!c) return
          if (isLowPriority) {
            c.deleteRoomTag(room.roomId, 'm.lowpriority').catch((err: Error) => toast(err.message, 'error'))
          } else {
            c.setRoomTag(room.roomId, 'm.lowpriority', { order: 0.5 }).catch((err: Error) => toast(err.message, 'error'))
          }
          setLowPriorityLocal(!isLowPriority)
        },
      },
      {
        id: 'add-to-space',
        icon: <Home size={16} />,
        label: t('rooms.addToSpace'),
        onClick: () => {
          setShowSpaceDialog(true)
        },
      },
      {
        id: 'archive',
        icon: <Archive size={16} />,
        label: hasTag(room.roomId, 'm.archive') ? t('rooms.unarchive') : t('rooms.archive'),
        onClick: () => {
          const c = getMatrixClient()
          if (!c) return
          if (hasTag(room.roomId, 'm.archive')) {
            c.deleteRoomTag(room.roomId, 'm.archive').catch((err: Error) => toast(err.message, 'error'))
          } else {
            c.setRoomTag(room.roomId, 'm.archive', { order: 0 }).catch((err: Error) => toast(err.message, 'error'))
          }
        },
      },
      {
        id: 'leave',
        icon: <LogOut size={16} />,
        label: t('rooms.leave'),
        danger: true,
        onClick: () => {
          if (!confirm(t('rooms.leaveConfirm'))) return
          const c = getMatrixClient()
          if (!c) return
          c.leave(room.roomId).catch((err: Error) => toast(err.message, 'error'))
        },
      },
    ]
    return actions
  }, [room, isPinned, isLowPriority, muted, markedUnread, t])

  const displayName = room.isSavedMessages ? t('rooms.savedMessages') : room.name
  const messagePreview = getMessagePreview(room, myUserId, t('rooms.you'))

  return (
    <>
      <button
        className={`${styles.item} ${isSelected ? styles.selected : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        aria-current={isSelected ? 'page' : undefined}
        {...longPressHandlers}
      >
        {room.isSavedMessages ? (
          <SavedMessagesIcon />
        ) : (
          <Avatar
            src={room.avatarUrl}
            name={room.name}
            size="md"
            online={presence ? presence.online : undefined}
          />
        )}
        <div className={styles.content}>
          <div className={styles.top}>
            <span className={styles.name}>{displayName}</span>
            {room.isEncrypted && <span className={styles.statusIcon}><EncryptionBadge verified /></span>}
            {muted && <span className={styles.statusIcon}><BellOff size={12} /></span>}
            {room.isPinned && <span className={styles.statusIcon}><Pin size={12} /></span>}
            {room.lastMessageTs > 0 && (
              <time className={styles.time}>{formatTime(room.lastMessageTs)}</time>
            )}
          </div>
          <div className={styles.bottom}>
            <span className={styles.message}>{messagePreview}</span>
            {room.highlightCount > 0 && (
              <span className={styles.mentionIcon} title="Вас упомянули">
                <AtSign size={14} />
              </span>
            )}
            {room.unreadCount > 0 && (
              <Badge count={room.unreadCount} highlight={room.highlightCount > 0} />
            )}
          </div>
        </div>
      </button>

      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenuActions}
          receipts={[]}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showSpaceDialog && (
        <AddToSpaceDialog
          roomId={room.roomId}
          onClose={() => setShowSpaceDialog(false)}
        />
      )}
    </>
  )
}

function formatTime(ts: number): string {
  const now = new Date()
  const date = new Date(ts)
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) return 'Вчера'
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}
