import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSpaces } from '../hooks/useSpaces.js'
import { Avatar } from '../../../shared/ui/index.js'
import { CreateSpaceDialog } from './CreateSpaceDialog.js'
import styles from './SpacesSidebar.module.scss'

export function SpacesSidebar() {
  const { t } = useTranslation()
  const { spaces, activeSpaceId, setActiveSpace } = useSpaces()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className={styles.sidebar}>
      <button
        className={`${styles.item} ${activeSpaceId === null ? styles.active : ''}`}
        onClick={() => setActiveSpace(null)}
        title={t('spaces.home')}
      >
        <div className={styles.homeIcon}>⌂</div>
      </button>

      <div className={styles.divider} />

      {spaces.map((space) => (
        <button
          key={space.roomId}
          className={`${styles.item} ${activeSpaceId === space.roomId ? styles.active : ''}`}
          onClick={() => setActiveSpace(space.roomId)}
          title={space.name}
        >
          <Avatar src={space.avatarUrl} name={space.name} size="sm" />
        </button>
      ))}

      <button
        className={styles.addBtn}
        onClick={() => setShowCreate(true)}
        title={t('spaces.create')}
      >
        +
      </button>

      {showCreate && <CreateSpaceDialog onClose={() => setShowCreate(false)} />}
    </div>
  )
}
