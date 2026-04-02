import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { Avatar } from '../../../shared/ui/index.js'
import styles from './MemberList.module.scss'

interface MemberListProps {
  roomId: string
}

interface MemberEntry {
  userId: string
  name: string
  avatarUrl: string | null
  role: string
  powerLevel: number
}

function getRoleName(level: number, t: (key: string) => string): string {
  if (level >= 100) return t('rooms.owner')
  if (level >= 50) return t('rooms.moderator')
  return t('rooms.user')
}

export function MemberList({ roomId }: MemberListProps) {
  const { t } = useTranslation()

  const members = useMemo<MemberEntry[]>(() => {
    const client = getMatrixClient()
    if (!client) return []
    const room = client.getRoom(roomId)
    if (!room) return []

    const powerLevels = room.currentState.getStateEvents('m.room.power_levels', '')?.getContent() || {}
    const users = (powerLevels.users || {}) as Record<string, number>
    const defaultLevel = (powerLevels.users_default as number) || 0

    return room.getJoinedMembers().map((m) => {
      const pl = users[m.userId] ?? defaultLevel
      return {
        userId: m.userId,
        name: m.name || m.userId,
        avatarUrl: m.getMxcAvatarUrl() ?? null,
        role: getRoleName(pl, t),
        powerLevel: pl,
      }
    }).sort((a, b) => b.powerLevel - a.powerLevel)
  }, [roomId, t])

  return (
    <div className={styles.list}>
      <div className={styles.count}>{members.length} {t('rooms.members').toLowerCase()}</div>
      {members.map((m) => (
        <div key={m.userId} className={styles.member}>
          <Avatar src={m.avatarUrl} name={m.name} size="sm" />
          <div className={styles.info}>
            <span className={styles.name}>{m.name}</span>
            <span className={styles.userId}>{m.userId}</span>
          </div>
          {m.powerLevel > 0 && (
            <span className={styles.role}>{m.role}</span>
          )}
        </div>
      ))}
    </div>
  )
}
