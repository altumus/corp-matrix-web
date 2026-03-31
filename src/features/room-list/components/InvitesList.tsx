import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import type { RoomListEntry } from '../types.js'
import { Avatar, Button } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './InvitesList.module.scss'

interface InvitesListProps {
  invites: RoomListEntry[]
}

export function InvitesList({ invites }: InvitesListProps) {
  const { t } = useTranslation()

  if (invites.length === 0) return null

  return (
    <div className={styles.section}>
      <h3 className={styles.title}>{t('rooms.invitations')} ({invites.length})</h3>
      {invites.map((invite) => (
        <InviteItem key={invite.roomId} invite={invite} />
      ))}
    </div>
  )
}

function InviteItem({ invite }: { invite: RoomListEntry }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const handleAction = async (accept: boolean) => {
    const client = getMatrixClient()
    if (!client) return

    setLoading(true)
    try {
      if (accept) {
        await client.joinRoom(invite.roomId)
      } else {
        await client.leave(invite.roomId)
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.invite}>
      <Avatar src={invite.avatarUrl} name={invite.name} size="sm" />
      <span className={styles.name}>{invite.name}</span>
      <div className={styles.actions}>
        <Button size="sm" onClick={() => handleAction(true)} loading={loading}>
          {t('rooms.accept')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => handleAction(false)} disabled={loading}>
          {t('rooms.decline')}
        </Button>
      </div>
    </div>
  )
}
