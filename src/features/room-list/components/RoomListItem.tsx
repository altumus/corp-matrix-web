import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { RoomListEntry } from '../types.js'
import { useRoomListStore } from '../store/roomListStore.js'
import { Avatar, Badge } from '../../../shared/ui/index.js'
import styles from './RoomListItem.module.scss'

interface RoomListItemProps {
  room: RoomListEntry
}

function SavedMessagesIcon() {
  return (
    <div className={styles.savedAvatar}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 2C4.44772 2 4 2.44772 4 3V21C4 21.3746 4.21215 21.7178 4.54772 21.8944C4.88329 22.0711 5.28719 22.0527 5.60555 21.8472L12 17.8685L18.3944 21.8472C18.7128 22.0527 19.1167 22.0711 19.4523 21.8944C19.7879 21.7178 20 21.3746 20 21V3C20 2.44772 19.5523 2 19 2H5Z" fill="currentColor"/>
      </svg>
    </div>
  )
}

export function RoomListItem({ room }: RoomListItemProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const selectedRoomId = useRoomListStore((s) => s.selectedRoomId)
  const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom)
  const isSelected = selectedRoomId === room.roomId

  const handleClick = () => {
    setSelectedRoom(room.roomId)
    navigate(`/rooms/${encodeURIComponent(room.roomId)}`)
  }

  const displayName = room.isSavedMessages ? t('rooms.savedMessages') : room.name

  return (
    <button
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
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
          {room.lastMessageTs > 0 && (
            <time className={styles.time}>{formatTime(room.lastMessageTs)}</time>
          )}
        </div>
        <div className={styles.bottom}>
          <span className={styles.message}>
            {room.lastMessageSender && `${room.lastMessageSender}: `}
            {room.lastMessage}
          </span>
          {room.unreadCount > 0 && (
            <Badge count={room.unreadCount} highlight={room.highlightCount > 0} />
          )}
        </div>
      </div>
    </button>
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
