import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/hooks/useAuth.js'
import { Dropdown } from '../../../shared/ui/index.js'
import { CreateRoomDialog } from './CreateRoomDialog.js'
import styles from './RoomListHeader.module.scss'

export function RoomListHeader() {
  const { t } = useTranslation()
  const { logout, user } = useAuth()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{t('rooms.title')}</h1>
      <div className={styles.actions}>
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
