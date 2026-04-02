import type { TimelineEvent } from '../types.js'
import { MessageBubble } from './MessageBubble.js'
import { SystemMessage } from './SystemMessage.js'
import styles from './TimelineItem.module.scss'

interface TimelineItemProps {
  event: TimelineEvent
  showAvatar: boolean
  isHighlighted?: boolean
}

export function TimelineItem({ event, showAvatar, isHighlighted }: TimelineItemProps) {
  if (event.type === 'm.room.member' || event.type === 'm.room.create') {
    return <SystemMessage event={event} />
  }

  const cls = [
    styles.item,
    showAvatar ? styles.withAvatar : styles.continuation,
    isHighlighted ? styles.highlighted : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      <MessageBubble event={event} showAvatar={showAvatar} />
    </div>
  )
}
