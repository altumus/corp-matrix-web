import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { Modal, Avatar } from '../../../shared/ui/index.js'
import styles from './ReactionDetailsDialog.module.scss'

interface ReactionDetailsDialogProps {
  roomId: string
  reactions: Map<string, Set<string>>
  onClose: () => void
}

interface ReactionDetail {
  emoji: string
  userId: string
  name: string
  avatarUrl: string | null
}

export function ReactionDetailsDialog({ roomId, reactions, onClose }: ReactionDetailsDialogProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()

  const details = useMemo<ReactionDetail[]>(() => {
    if (!client) return []
    const room = client.getRoom(roomId)
    if (!room) return []

    const result: ReactionDetail[] = []
    for (const [emoji, senders] of reactions) {
      for (const userId of senders) {
        const member = room.getMember(userId)
        result.push({
          emoji,
          userId,
          name: member?.name || userId,
          avatarUrl: member?.getMxcAvatarUrl() ?? null,
        })
      }
    }
    return result
  }, [roomId, reactions, client])

  const grouped = useMemo(() => {
    const map = new Map<string, ReactionDetail[]>()
    for (const d of details) {
      if (!map.has(d.emoji)) map.set(d.emoji, [])
      map.get(d.emoji)!.push(d)
    }
    return map
  }, [details])

  return (
    <Modal open onClose={onClose} title={t('messages.react')}>
      <div className={styles.container}>
        {[...grouped.entries()].map(([emoji, users]) => (
          <div key={emoji} className={styles.section}>
            <div className={styles.emojiHeader}>
              <span className={styles.emoji}>{emoji}</span>
              <span className={styles.count}>{users.length}</span>
            </div>
            <div className={styles.users}>
              {users.map((u) => (
                <div key={u.userId} className={styles.user}>
                  <Avatar src={u.avatarUrl} name={u.name} size="xs" />
                  <span className={styles.userName}>{u.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
