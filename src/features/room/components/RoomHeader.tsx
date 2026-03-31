import type { RoomSummary } from '../types.js'
import { Avatar } from '../../../shared/ui/index.js'
import styles from './RoomHeader.module.scss'

interface RoomHeaderProps {
  room: RoomSummary
}

export function RoomHeader({ room }: RoomHeaderProps) {
  return (
    <header className={styles.header}>
      <Avatar src={room.avatarUrl} name={room.name} size="sm" />
      <div className={styles.info}>
        <h2 className={styles.name}>
          {room.name}
          {room.isEncrypted && <span className={styles.encrypted} title="Зашифровано">🔒</span>}
        </h2>
        {room.topic && <p className={styles.topic}>{room.topic}</p>}
      </div>
      <div className={styles.members}>{room.memberCount} уч.</div>
    </header>
  )
}
