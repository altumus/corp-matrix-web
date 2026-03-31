import { useNavigate } from 'react-router'
import type { RoomListEntry } from '../types.js'
import { useRoomListStore } from '../store/roomListStore.js'
import { Avatar, Badge } from '../../../shared/ui/index.js'
import styles from './RoomListItem.module.scss'

interface RoomListItemProps {
  room: RoomListEntry
}

export function RoomListItem({ room }: RoomListItemProps) {
  const navigate = useNavigate()
  const selectedRoomId = useRoomListStore((s) => s.selectedRoomId)
  const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom)
  const isSelected = selectedRoomId === room.roomId

  const handleClick = () => {
    setSelectedRoom(room.roomId)
    navigate(`/rooms/${encodeURIComponent(room.roomId)}`)
  }

  return (
    <button
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      aria-current={isSelected ? 'page' : undefined}
    >
      <Avatar src={room.avatarUrl} name={room.name} size="md" />
      <div className={styles.content}>
        <div className={styles.top}>
          <span className={styles.name}>{room.name}</span>
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
