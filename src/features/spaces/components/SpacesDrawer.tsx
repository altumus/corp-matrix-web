import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Plus, X, Trash2 } from 'lucide-react'
import { useSpaces } from '../hooks/useSpaces.js'
import { Avatar } from '../../../shared/ui/index.js'
import { CreateSpaceDialog } from './CreateSpaceDialog.js'
import { ARCHIVE_ID } from './SpacesSidebar.js'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './SpacesDrawer.module.scss'

interface SpacesDrawerProps {
  onClose: () => void
}

export function SpacesDrawer({ onClose }: SpacesDrawerProps) {
  const { t } = useTranslation()
  const { spaces, activeSpaceId, setActiveSpace } = useSpaces()
  const [showCreate, setShowCreate] = useState(false)
  const [contextSpaceId, setContextSpaceId] = useState<string | null>(null)

  const selectSpace = (id: string | null) => {
    setActiveSpace(id)
    onClose()
  }

  const handleLeaveSpace = async (spaceId: string) => {
    if (!confirm(t('spaces.leaveConfirm', { defaultValue: 'Покинуть пространство?' }))) return
    const client = getMatrixClient()
    if (!client) return
    try {
      await client.leave(spaceId)
      if (activeSpaceId === spaceId) setActiveSpace(null)
      toast(t('spaces.left', { defaultValue: 'Вы покинули пространство' }), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
    setContextSpaceId(null)
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
            <div key={space.roomId} style={{ position: 'relative' }}>
              <button
                className={`${styles.item} ${activeSpaceId === space.roomId ? styles.active : ''}`}
                onClick={() => selectSpace(space.roomId)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextSpaceId(space.roomId)
                }}
              >
                <Avatar src={space.avatarUrl} name={space.name} size="sm" />
                <span>{space.name}</span>
              </button>
              {contextSpaceId === space.roomId && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 100,
                    minWidth: 160,
                  }}
                  onMouseLeave={() => setContextSpaceId(null)}
                >
                  <button
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      color: 'var(--color-danger)',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleLeaveSpace(space.roomId)}
                  >
                    <Trash2 size={14} />
                    {t('spaces.leave', { defaultValue: 'Покинуть' })}
                  </button>
                </div>
              )}
            </div>
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
