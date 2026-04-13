import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Copy } from 'lucide-react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { Avatar } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import { usePresence } from '../../../shared/hooks/usePresence.js'
import styles from './UserProfilePopup.module.scss'

interface UserProfilePopupProps {
  userId: string
  roomId: string
  onClose: () => void
  anchorRect: DOMRect
}

export function UserProfilePopup({ userId, roomId, onClose, anchorRect }: UserProfilePopupProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const navigate = useNavigate()
  const popupRef = useRef<HTMLDivElement>(null)
  const presence = usePresence(userId)

  const [profile, setProfile] = useState<{
    displayName: string
    avatarUrl: string | null
  } | null>(null)

  useEffect(() => {
    if (!client) return
    const room = client.getRoom(roomId)
    const member = room?.getMember(userId)
    if (member) {
      setProfile({
        displayName: member.name || userId,
        avatarUrl: member.getMxcAvatarUrl() ?? null,
      })
    } else {
      client.getProfileInfo(userId).then((info) => {
        setProfile({
          displayName: (info.displayname as string) || userId,
          avatarUrl: (info.avatar_url as string) ?? null,
        })
      }).catch(() => {
        setProfile({ displayName: userId, avatarUrl: null })
      })
    }
  }, [client, userId, roomId])

  // Close on click outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const handleSendMessage = async () => {
    if (!client) return
    const myUserId = client.getUserId()
    if (userId === myUserId) return

    // Find existing DM
    const rooms = client.getRooms()
    for (const room of rooms) {
      const members = room.getJoinedMembers()
      if (members.length === 2 && members.some((m) => m.userId === userId)) {
        navigate(`/rooms/${encodeURIComponent(room.roomId)}`)
        onClose()
        return
      }
    }

    // Create new DM
    try {
      const { room_id } = await client.createRoom({
        is_direct: true,
        invite: [userId],
        preset: 'trusted_private_chat' as never,
      })
      navigate(`/rooms/${encodeURIComponent(room_id)}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
    onClose()
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(userId).catch(() => {})
    toast('ID скопирован', 'success')
  }

  if (!profile) return null

  // Position popup near the click
  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 320)
  const left = Math.min(anchorRect.left, window.innerWidth - 280)

  const lastSeen = presence?.lastActiveAgo
    ? formatLastSeen(presence.lastActiveAgo)
    : presence?.online
      ? t('presence.online', { defaultValue: 'В сети' })
      : null

  return (
    <div
      ref={popupRef}
      className={styles.popup}
      style={{ top, left }}
    >
      <div className={styles.header}>
        <Avatar src={profile.avatarUrl} name={profile.displayName} size="lg" />
        <div className={styles.info}>
          <span className={styles.name}>{profile.displayName}</span>
          <span className={styles.userId}>{userId}</span>
          {lastSeen && <span className={styles.lastSeen}>{lastSeen}</span>}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={handleCopyId}>
          <Copy size={16} />
          <span>Копировать ID</span>
        </button>
        {userId !== client?.getUserId() && (
          <>
            <button className={styles.actionBtn} onClick={handleSendMessage}>
              <MessageSquare size={16} />
              <span>Написать</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function formatLastSeen(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'Только что'
  if (minutes < 60) return `Был(а) ${minutes} мин. назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Был(а) ${hours} ч. назад`
  const days = Math.floor(hours / 24)
  return `Был(а) ${days} дн. назад`
}
