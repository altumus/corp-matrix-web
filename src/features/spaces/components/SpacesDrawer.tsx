import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Plus, X } from 'lucide-react'
import { useSpaces } from '../hooks/useSpaces.js'
import { Avatar } from '../../../shared/ui/index.js'
import { CreateSpaceDialog } from './CreateSpaceDialog.js'
import { ARCHIVE_ID } from './SpacesSidebar.js'
import styles from './SpacesDrawer.module.scss'

interface SpacesDrawerProps {
  onClose: () => void
}

export function SpacesDrawer({ onClose }: SpacesDrawerProps) {
  const { t } = useTranslation()
  const { spaces, activeSpaceId, setActiveSpace } = useSpaces()
  const [showCreate, setShowCreate] = useState(false)

  const selectSpace = (id: string | null) => {
    setActiveSpace(id)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t('spaces.title', 'Пространства')}</span>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.list}>
          <button
            className={`${styles.item} ${activeSpaceId === null ? styles.active : ''}`}
            onClick={() => selectSpace(null)}
          >
            <div className={styles.homeIcon}>⌂</div>
            <span>{t('spaces.home')}</span>
          </button>

          {spaces.map((space) => (
            <button
              key={space.roomId}
              className={`${styles.item} ${activeSpaceId === space.roomId ? styles.active : ''}`}
              onClick={() => selectSpace(space.roomId)}
            >
              <Avatar src={space.avatarUrl} name={space.name} size="sm" />
              <span>{space.name}</span>
            </button>
          ))}

          <button
            className={`${styles.item} ${activeSpaceId === ARCHIVE_ID ? styles.active : ''}`}
            onClick={() => selectSpace(activeSpaceId === ARCHIVE_ID ? null : ARCHIVE_ID)}
          >
            <Archive size={20} />
            <span>{t('rooms.archive')}</span>
          </button>

          <button
            className={styles.addItem}
            onClick={() => setShowCreate(true)}
          >
            <Plus size={20} />
            <span>{t('spaces.create')}</span>
          </button>
        </div>
      </div>

      {showCreate && <CreateSpaceDialog onClose={() => setShowCreate(false)} />}
    </div>
  )
}
