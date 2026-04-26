import type { TimelineEvent } from '../types.js'
import styles from './SystemMessage.module.scss'

interface SystemMessageProps {
  event: TimelineEvent
}

function getSystemText(event: TimelineEvent): string {
  const name = event.senderName
  const target = event.targetName || event.stateKey || name
  const content = event.content

  switch (event.type) {
    case 'm.room.member': {
      const membership = content.membership as string
      if (membership === 'join') return `${target} присоединился(ась)`
      if (membership === 'invite') return `${name} пригласил(а) ${target}`
      if (membership === 'leave') {
        if (event.sender !== event.stateKey) return `${name} удалил(а) ${target}`
        return `${target} покинул(а) комнату`
      }
      if (membership === 'ban') return `${name} забанил(а) ${target}`
      return `${target}: ${membership}`
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
