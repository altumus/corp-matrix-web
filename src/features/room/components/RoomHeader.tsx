import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, UserPlus, Phone, Video, Users, Search, MessageSquare } from 'lucide-react'
import { useCallStore } from '../../calls/store/callStore.js'
import { useGroupCallStore } from '../../calls/store/groupCallStore.js'
import { useActiveGroupCall } from '../../calls/hooks/useGroupCall.js'
import type { RoomSummary } from '../types.js'
import { Avatar } from '../../../shared/ui/index.js'
import { EncryptionBadge } from '../../encryption/components/EncryptionBadge.js'
import { useRoomTrust } from '../../encryption/hooks/useRoomTrust.js'
import { usePresence, getDmPartnerId } from '../../../shared/hooks/usePresence.js'
import { InviteToRoomDialog } from './InviteToRoomDialog.js'
import { useRightPanel } from '../context/RightPanelContext.js'
import { useRoomHasUnreadThreads } from '../hooks/useRoomThreads.js'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery.js'
import styles from './RoomHeader.module.scss'

interface RoomHeaderProps {
  room: RoomSummary
  onSearchToggle?: () => void
}

export function RoomHeader({ room, onSearchToggle }: RoomHeaderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showInvite, setShowInvite] = useState(false)
  const { panel, openDetails, openThreadsList, closePanel } = useRightPanel()
  const hasUnreadThreads = useRoomHasUnreadThreads(room.roomId)
  const isMobile = useIsMobile()
  const dmPartnerId = room.isDirect ? getDmPartnerId(room.roomId) : null
  const presence = usePresence(dmPartnerId)
  const trust = useRoomTrust(room.roomId, room.isEncrypted)
  const startVoice = useCallStore((s) => s.startVoice)
  const startVideo = useCallStore((s) => s.startVideo)
  const callActive = useCallStore((s) => s.activeCall !== null)
  const groupCallStatus = useGroupCallStore((s) => s.status)
  const joinGroupCall = useGroupCallStore((s) => s.joinGroupCall)
  const activeGroupCall = useActiveGroupCall(room.roomId)

  const handleBack = () => {
    navigate('/rooms')
  }

  const isOnline = (() => {
    if (!presence) return false
    if (presence.online) return true
    // Recently active (< 1 min) counts as online
    if (presence.lastActiveAgo !== null && presence.lastActiveAgo < 60000) return true
    return false
  })()

  const subtitle = (() => {
    if (room.topic) return room.topic
    if (presence) {
      if (isOnline) return t('rooms.online')
      if (presence.lastActiveAgo) {
        const mins = Math.floor(presence.lastActiveAgo / 60000)
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
      {isMobile && (
        <button className={styles.backBtn} onClick={handleBack}>
          <ArrowLeft size={20} />
        </button>
      )}
      <Avatar
        src={room.avatarUrl}
        name={room.name}
        size="sm"
        online={presence ? isOnline : undefined}
      />
      <button className={styles.info} onClick={openDetails}>
        <h2 className={styles.name}>
          {room.name}
          {room.isEncrypted && <EncryptionBadge verified={trust !== false} />}
        </h2>
        {subtitle ? (
          <p className={`${styles.topic} ${isOnline ? styles.onlineText : ''}`}>
            {subtitle}
          </p>
        ) : (
          <p className={styles.topic}>{room.memberCount} уч.</p>
        )}
      </button>
      {room.isDirect && dmPartnerId && (
        <>
          <button
            className={styles.inviteBtn}
            onClick={() => !callActive && startVoice(room.roomId, dmPartnerId)}
            title={t('rooms.callVoice', { defaultValue: 'Голосовой звонок' })}
            disabled={callActive}
          >
            <Phone size={18} />
          </button>
          <button
            className={styles.inviteBtn}
            onClick={() => !callActive && startVideo(room.roomId, dmPartnerId)}
            title={t('rooms.callVideo', { defaultValue: 'Видеозвонок' })}
            disabled={callActive}
          >
            <Video size={18} />
          </button>
        </>
      )}
      {!room.isDirect && (
        <>
          {activeGroupCall && groupCallStatus === 'idle' ? (
            <button
              className={styles.inviteBtn}
              onClick={() => void joinGroupCall(activeGroupCall, true)}
              title={t('calls.joinCall', { defaultValue: 'Присоединиться' })}
            >
              <Phone size={18} />
            </button>
          ) : (
            <button
              className={styles.inviteBtn}
              onClick={() => {
                useGroupCallStore.getState().startGroupCall(room.roomId, 'video')
              }}
              disabled={groupCallStatus !== 'idle'}
              title={t('calls.groupCall', { defaultValue: 'Групповой звонок' })}
            >
              <Users size={18} />
            </button>
          )}
        </>
      )}
      <button
        className={`${styles.inviteBtn} ${panel?.type === 'threads-list' ? styles.inviteBtnActive : ''}`}
        onClick={() => panel?.type === 'threads-list' ? closePanel() : openThreadsList()}
        title={t('messages.threads')}
      >
        <span className={styles.threadsIconWrap}>
          <MessageSquare size={18} />
          {hasUnreadThreads && <span className={styles.threadsUnreadDot} />}
        </span>
      </button>
      <button
        className={styles.inviteBtn}
        onClick={onSearchToggle}
        title={t('search.inRoom', { defaultValue: 'Поиск по чату' }) + ' (Ctrl+F)'}
      >
        <Search size={18} />
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
