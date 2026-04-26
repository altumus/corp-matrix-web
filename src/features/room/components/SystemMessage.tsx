import type { TimelineEvent } from '../types.js'
import styles from './SystemMessage.module.scss'

interface SystemMessageProps {
  event: TimelineEvent
}

function getSystemText(event: TimelineEvent): string | null {
  const name = event.senderName
  const target = event.targetName || event.stateKey || name
  const content = event.content
  const prev = event.prevContent

  switch (event.type) {
    case 'm.room.member': {
      const membership = content.membership as string | undefined
      const prevMembership = prev?.membership as string | undefined

      if (membership === 'join') {
        // Real join: previous state was not "join" (or no prior state at all).
        if (prevMembership !== 'join') return `${target} присоединился(ась)`

        // Profile-only update while already joined.
        const avatarChanged = (prev?.avatar_url ?? null) !== (content.avatar_url ?? null)
        const nameChanged = (prev?.displayname ?? null) !== (content.displayname ?? null)
        if (avatarChanged && !nameChanged) return `${target} изменил(а) аватар`
        if (nameChanged && !avatarChanged) {
          const newName = (content.displayname as string) || target
          return `${target} изменил(а) имя на «${newName}»`
        }
        if (avatarChanged && nameChanged) return `${target} изменил(а) профиль`
        return null
      }

      if (membership === 'invite') return `${name} пригласил(а) ${target}`
      if (membership === 'leave') {
        // A leave after invite is just the invite being withdrawn/declined — skip.
        if (prevMembership === 'invite') return null
        if (event.sender !== event.stateKey) return `${name} удалил(а) ${target}`
        return `${target} покинул(а) комнату`
      }
      if (membership === 'ban') return `${name} забанил(а) ${target}`
      return null
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
      return null
  }
}

export function SystemMessage({ event }: SystemMessageProps) {
  const text = getSystemText(event)
  if (!text) return null
  return (
    <div className={styles.system}>
      <span className={styles.text}>{text}</span>
      <time className={styles.time}>{formatTime(event.timestamp)}</time>
    </div>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
