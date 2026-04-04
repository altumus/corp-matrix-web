import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Bell, Bookmark, Plus, Settings } from 'lucide-react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { requestNotificationPermission } from '../../notifications/services/notificationService.js'
import { useRoomListStore } from '../store/roomListStore.js'
import { CreateRoomDialog } from './CreateRoomDialog.js'
import styles from './RoomListHeader.module.scss'

export function RoomListHeader() {
  const { t } = useTranslation()
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
          <Bookmark size={18} />
        </button>
        <button
          className={styles.createBtn}
          onClick={() => setShowCreate(true)}
          title={t('rooms.create')}
        >
          <Plus size={18} />
        </button>
        <button
          className={styles.settingsBtn}
          onClick={async () => {
            const granted = await requestNotificationPermission()
            if (!granted) return

            const options: NotificationOptions = {
              body: 'Уведомления работают корректно!',
              icon: '/corp-logo.png',
              tag: 'test',
            }

            if ('serviceWorker' in navigator) {
              const reg = await navigator.serviceWorker.ready
              await reg.showNotification('Corp Matrix', options)
            } else {
              new Notification('Corp Matrix', options)
            }
          }}
          title='Тест уведомлений'
        >
          <Bell size={18} />
        </button>
        <button
          className={styles.settingsBtn}
          onClick={() => navigate('/settings')}
          title={t('settings.title')}
        >
          <Settings size={18} />
        </button>
      </div>
      {showCreate && <CreateRoomDialog onClose={() => setShowCreate(false)} />}
    </div>
  )
}
