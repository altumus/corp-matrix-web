import type { TimelineEvent } from '../types.js'
import styles from './SystemMessage.module.scss'

interface SystemMessageProps {
  event: TimelineEvent
}

function getSystemText(event: TimelineEvent): string {
  const name = event.senderName
  const content = event.content

  switch (event.type) {
    case 'm.room.member': {
      const membership = content.membership as string
      if (membership === 'join') return `${name} присоединился(ась)`
      if (membership === 'leave') return `${name} покинул(а) комнату`
      if (membership === 'invite') return `${name} приглашён(а)`
      if (membership === 'ban') return `${name} забанен(а)`
      return `${name}: ${membership}`
    }
    case 'm.room.create':
      return `${name} создал(а) комнату`
    case 'm.room.name':
      return `${name} изменил(а) название на «${(content.name as string) || ''}»`
    case 'm.room.topic':
      return `${name} изменил(а) тему: ${(content.topic as string) || ''}`
    case 'm.room.avatar':
      return `${name} изменил(а) аватар комнаты`
    default:
      return (content.body as string) || event.type
  }
}

export function SystemMessage({ event }: SystemMessageProps) {
  return (
    <div className={styles.system}>
      <span className={styles.text}>{getSystemText(event)}</span>
      <time className={styles.time}>{formatTime(event.timestamp)}</time>
    </div>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
