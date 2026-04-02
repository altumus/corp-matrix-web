import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Bookmark, BellOff, Bell, Circle, Pin, ArrowDown, Home, LogOut } from 'lucide-react'
import type { RoomListEntry } from '../types.js'
import { useRoomListStore } from '../store/roomListStore.js'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { Avatar, Badge } from '../../../shared/ui/index.js'
import {
  MessageContextMenu,
  type ContextMenuAction,
} from '../../messaging/components/MessageContextMenu.js'
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
  const isMyMessage = myUserId && room.lastMessageSenderId === myUserId
  if (room.isSavedMessages) return room.lastMessage
  if (room.isDirect) {
    return isMyMessage ? `${youLabel}: ${room.lastMessage}` : room.lastMessage
  }
  if (isMyMessage) return `${youLabel}: ${room.lastMessage}`
  if (room.lastMessageSender) return `${room.lastMessageSender}: ${room.lastMessage}`
  return room.lastMessage
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

  const handleClick = () => {
    setSelectedRoom(room.roomId)
    navigate(`/rooms/${encodeURIComponent(room.roomId)}`)
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

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
            c.deletePushRule('global', 'room' as never, room.roomId).catch(() => {})
          } else {
            c.addPushRule('global', 'room' as never, room.roomId, {
              actions: ['dont_notify' as never],
              conditions: [{ kind: 'event_match' as never, key: 'room_id', pattern: room.roomId }],
            } as never).catch(() => {})
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
          c.setRoomAccountData(room.roomId, 'com.famedly.marked_unread' as never, { unread: !markedUnread } as never).catch(() => {})
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
            c.deleteRoomTag(room.roomId, 'm.favourite').catch(() => {})
          } else {
            c.setRoomTag(room.roomId, 'm.favourite', { order: 0.5 }).catch(() => {})
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
            c.deleteRoomTag(room.roomId, 'm.lowpriority').catch(() => {})
          } else {
            c.setRoomTag(room.roomId, 'm.lowpriority', { order: 0.5 }).catch(() => {})
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
        id: 'leave',
        icon: <LogOut size={16} />,
        label: t('rooms.leave'),
        danger: true,
        onClick: () => {
          if (!confirm(t('rooms.leaveConfirm'))) return
          const c = getMatrixClient()
          if (!c) return
          c.leave(room.roomId).catch(() => {})
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
      >
        {room.isSavedMessages ? (
          <SavedMessagesIcon />
        ) : (
          <Avatar src={room.avatarUrl} name={room.name} size="md" />
        )}
        <div className={styles.content}>
          <div className={styles.top}>
            <span className={styles.name}>{displayName}</span>
            {muted && <span className={styles.statusIcon}><BellOff size={12} /></span>}
            {room.isPinned && <span className={styles.statusIcon}><Pin size={12} /></span>}
            {room.lastMessageTs > 0 && (
              <time className={styles.time}>{formatTime(room.lastMessageTs)}</time>
            )}
          </div>
          <div className={styles.bottom}>
            <span className={styles.message}>{messagePreview}</span>
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
