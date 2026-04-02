import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/hooks/useAuth.js'
import { Dropdown } from '../../../shared/ui/index.js'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { useRoomListStore } from '../store/roomListStore.js'
import { CreateRoomDialog } from './CreateRoomDialog.js'
import styles from './RoomListHeader.module.scss'

export function RoomListHeader() {
  const { t } = useTranslation()
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const rooms = useRoomListStore((s) => s.rooms)
  const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom)

  const openSavedMessages = useCallback(async () => {
    const client = getMatrixClient()
    if (!client) return
    const myUserId = client.getUserId()!

    const existing = rooms.find((r) => r.isSavedMessages)
    if (existing) {
      setSelectedRoom(existing.roomId)
      navigate(`/rooms/${encodeURIComponent(existing.roomId)}`)
      return
    }

    try {
      const { room_id } = await client.createRoom({
        is_direct: true,
        invite: [myUserId],
        preset: 'trusted_private_chat' as never,
        name: 'Saved Messages',
      })
      setSelectedRoom(room_id)
      navigate(`/rooms/${encodeURIComponent(room_id)}`)
    } catch {
      // room creation failed silently
    }
  }, [rooms, navigate, setSelectedRoom])

  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{t('rooms.title')}</h1>
      <div className={styles.actions}>
        <button
          className={styles.savedBtn}
          onClick={openSavedMessages}
          title={t('rooms.savedMessages')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 2C4.44772 2 4 2.44772 4 3V21C4 21.3746 4.21215 21.7178 4.54772 21.8944C4.88329 22.0711 5.28719 22.0527 5.60555 21.8472L12 17.8685L18.3944 21.8472C18.7128 22.0527 19.1167 22.0711 19.4523 21.8944C19.7879 21.7178 20 21.3746 20 21V3C20 2.44772 19.5523 2 19 2H5Z" fill="currentColor"/>
          </svg>
        </button>
        <button
          className={styles.createBtn}
          onClick={() => setShowCreate(true)}
          title={t('rooms.create')}
        >
          +
        </button>
        <Dropdown
          trigger={
            <span className={styles.menuTrigger}>⋮</span>
          }
          align="right"
          items={[
            {
              id: 'settings',
              label: t('settings.title'),
              onClick: () => {
                window.location.href = '/settings'
              },
            },
            {
              id: 'logout',
              label: t('auth.logout'),
              danger: true,
              onClick: () => {
                void user
                logout()
              },
            },
          ]}
        />
      </div>
      {showCreate && <CreateRoomDialog onClose={() => setShowCreate(false)} />}
    </div>
  )
}
