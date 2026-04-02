import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus } from 'lucide-react'
import type { RoomSummary } from '../types.js'
import { Avatar } from '../../../shared/ui/index.js'
import { EncryptionBadge } from '../../encryption/components/EncryptionBadge.js'
import { usePresence, getDmPartnerId } from '../../../shared/hooks/usePresence.js'
import { InviteToRoomDialog } from './InviteToRoomDialog.js'
import { useRightPanel } from '../context/RightPanelContext.js'
import styles from './RoomHeader.module.scss'

interface RoomHeaderProps {
  room: RoomSummary
}

export function RoomHeader({ room }: RoomHeaderProps) {
  const { t } = useTranslation()
  const [showInvite, setShowInvite] = useState(false)
  const { openDetails } = useRightPanel()
  const dmPartnerId = room.isDirect ? getDmPartnerId(room.roomId) : null
  const presence = usePresence(dmPartnerId)

  const subtitle = (() => {
    if (room.topic) return room.topic
    if (presence) {
      if (presence.online) return t('rooms.online')
      if (presence.lastActiveAgo) {
        const mins = Math.floor(presence.lastActiveAgo / 60000)
        if (mins < 1) return t('rooms.online')
        if (mins < 60) return t('rooms.lastSeen', { time: `${mins} мин. назад` })
        const hours = Math.floor(mins / 60)
        if (hours < 24) return t('rooms.lastSeen', { time: `${hours} ч. назад` })
        return t('rooms.offline')
      }
      return t('rooms.offline')
    }
    return null
  })()

  return (
    <header className={styles.header}>
      <Avatar
        src={room.avatarUrl}
        name={room.name}
        size="sm"
        online={presence ? presence.online : undefined}
      />
      <button className={styles.info} onClick={openDetails}>
        <h2 className={styles.name}>
          {room.name}
          {room.isEncrypted && <EncryptionBadge verified />}
        </h2>
        {subtitle ? (
          <p className={`${styles.topic} ${presence?.online ? styles.onlineText : ''}`}>
            {subtitle}
          </p>
        ) : (
          <p className={styles.topic}>{room.memberCount} уч.</p>
        )}
      </button>
      <button
        className={styles.inviteBtn}
        onClick={() => setShowInvite(true)}
        title={t('rooms.inviteUser')}
      >
        <UserPlus size={18} />
      </button>

      {showInvite && (
        <InviteToRoomDialog
          roomId={room.roomId}
          onClose={() => setShowInvite(false)}
        />
      )}
    </header>
  )
}
