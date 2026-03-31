import type { TimelineEvent } from '../types.js'
import styles from './SystemMessage.module.scss'

interface SystemMessageProps {
  event: TimelineEvent
}

export function SystemMessage({ event }: SystemMessageProps) {
  const body = (event.content.body as string) || event.type

  return (
    <div className={styles.system}>
      <span className={styles.text}>{body}</span>
      <time className={styles.time}>{formatTime(event.timestamp)}</time>
    </div>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
