import type { TimelineEvent } from '../types.js'
import { MessageBubble } from './MessageBubble.js'
import { SystemMessage } from './SystemMessage.js'
import { ReadReceipts } from './ReadReceipts.js'
import styles from './TimelineItem.module.scss'

interface TimelineItemProps {
  event: TimelineEvent
  showAvatar: boolean
}

export function TimelineItem({ event, showAvatar }: TimelineItemProps) {
  if (event.type === 'm.room.member' || event.type === 'm.room.create') {
    return <SystemMessage event={event} />
  }

  return (
    <div className={`${styles.item} ${showAvatar ? styles.withAvatar : styles.continuation}`}>
      <MessageBubble event={event} showAvatar={showAvatar} />
      <ReadReceipts eventId={event.eventId} />
    </div>
  )
}
