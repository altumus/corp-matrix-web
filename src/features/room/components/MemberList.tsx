import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreVertical } from 'lucide-react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { Avatar } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import { usePresence } from '../../../shared/hooks/usePresence.js'
import styles from './MemberList.module.scss'

function MemberAvatar({ userId, name, src }: { userId: string; name: string; src: string | null }) {
  const presence = usePresence(userId)
  return <Avatar src={src} name={name} size="sm" online={presence?.online} />
}

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
  const client = useMatrixClient()
  const [actionsFor, setActionsFor] = useState<string | null>(null)

  const { members, myPL, refresh } = useMemo(() => {
    if (!client) return { members: [], myPL: 0, refresh: 0 }
    const room = client.getRoom(roomId)
    if (!room) return { members: [], myPL: 0, refresh: 0 }

    const powerLevels = room.currentState.getStateEvents('m.room.power_levels', '')?.getContent() || {}
    const users = (powerLevels.users || {}) as Record<string, number>
    const defaultLevel = (powerLevels.users_default as number) || 0
    const myUserId = client.getUserId()
    const myLevel = (myUserId && users[myUserId]) ?? defaultLevel

    const list = room.getJoinedMembers().map((m) => {
      const pl = users[m.userId] ?? defaultLevel
      return {
        userId: m.userId,
        name: m.name || m.userId,
        avatarUrl: m.getMxcAvatarUrl() ?? null,
        role: getRoleName(pl, t),
        powerLevel: pl,
      }
    }).sort((a, b) => b.powerLevel - a.powerLevel)

    return { members: list, myPL: myLevel, refresh: 0 }
  }, [roomId, t, client])

  const myUserId = client?.getUserId()
  const canKick = myPL >= 50
  const canBan = myPL >= 50
  const canPromote = myPL >= 100

  const handleAction = async (
    action: 'kick' | 'ban' | 'promote' | 'demote',
    member: MemberEntry,
  ) => {
    if (!client) return
    setActionsFor(null)
    try {
      if (action === 'kick') {
        if (!confirm(t('rooms.kickConfirm', { defaultValue: `Удалить ${member.name} из комнаты?` }))) return
        await client.kick(roomId, member.userId)
        toast(t('rooms.userKicked', { defaultValue: 'Пользователь удалён' }), 'success')
      } else if (action === 'ban') {
        if (!confirm(t('rooms.banConfirm', { defaultValue: `Заблокировать ${member.name}?` }))) return
        await client.ban(roomId, member.userId)
        toast(t('rooms.userBanned', { defaultValue: 'Пользователь заблокирован' }), 'success')
      } else if (action === 'promote') {
        await client.setPowerLevel(roomId, member.userId, 50)
        toast(t('rooms.userPromoted', { defaultValue: 'Назначен модератором' }), 'success')
      } else if (action === 'demote') {
        await client.setPowerLevel(roomId, member.userId, 0)
        toast(t('rooms.userDemoted', { defaultValue: 'Снят с модерации' }), 'success')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
  }

  return (
    <div className={styles.list}>
      <div className={styles.count}>{members.length} {t('rooms.members').toLowerCase()}</div>
      {members.map((m) => {
        const isMe = m.userId === myUserId
        const canActOnThis = !isMe && (canKick || canBan || canPromote) && m.powerLevel < myPL
        return (
          <div key={m.userId + refresh} className={styles.member}>
            <MemberAvatar userId={m.userId} name={m.name} src={m.avatarUrl} />
            <div className={styles.info}>
              <span className={styles.name}>{m.name}</span>
              <span className={styles.userId}>{m.userId}</span>
            </div>
            {m.powerLevel > 0 && (
              <span className={styles.role}>{m.role}</span>
            )}
            {canActOnThis && (
              <div className={styles.actionsWrap}>
                <button
                  className={styles.actionsBtn}
                  onClick={() => setActionsFor(actionsFor === m.userId ? null : m.userId)}
                  aria-label="Действия"
                >
                  <MoreVertical size={16} />
                </button>
                {actionsFor === m.userId && (
                  <div className={styles.actionsMenu}>
                    {canKick && (
                      <button onClick={() => handleAction('kick', m)}>
                        {t('rooms.kick', { defaultValue: 'Удалить из комнаты' })}
                      </button>
                    )}
                    {canBan && (
                      <button onClick={() => handleAction('ban', m)}>
                        {t('rooms.ban', { defaultValue: 'Заблокировать' })}
                      </button>
                    )}
                    {canPromote && m.powerLevel < 50 && (
                      <button onClick={() => handleAction('promote', m)}>
                        {t('rooms.promote', { defaultValue: 'Сделать модератором' })}
                      </button>
                    )}
                    {canPromote && m.powerLevel >= 50 && m.powerLevel < 100 && (
                      <button onClick={() => handleAction('demote', m)}>
                        {t('rooms.demote', { defaultValue: 'Снять модерацию' })}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
