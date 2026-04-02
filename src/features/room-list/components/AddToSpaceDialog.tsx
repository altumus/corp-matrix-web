import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Avatar } from '../../../shared/ui/index.js'
import { useSpacesStore } from '../../spaces/store/spacesStore.js'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import styles from './AddToSpaceDialog.module.scss'

interface AddToSpaceDialogProps {
  roomId: string
  onClose: () => void
}

export function AddToSpaceDialog({ roomId, onClose }: AddToSpaceDialogProps) {
  const { t } = useTranslation()
  const spaces = useSpacesStore((s) => s.spaces)
  const [adding, setAdding] = useState<string | null>(null)

  const handleAdd = async (spaceId: string) => {
    const client = getMatrixClient()
    if (!client || adding) return

    setAdding(spaceId)
    try {
      const userId = client.getUserId()!
      const serverDomain = userId.split(':')[1]
      await client.sendStateEvent(
        spaceId,
        'm.space.child' as never,
        { via: [serverDomain] } as never,
        roomId,
      )
      onClose()
    } catch {
      setAdding(null)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('rooms.addToSpace')}>
      <div className={styles.container}>
        {spaces.length === 0 ? (
          <div className={styles.empty}>{t('search.noResults')}</div>
        ) : (
          <div className={styles.list}>
            {spaces.map((space) => {
              const alreadyAdded = space.childRoomIds.includes(roomId)
              return (
                <button
                  key={space.roomId}
                  className={`${styles.spaceItem} ${alreadyAdded ? styles.added : ''}`}
                  onClick={() => !alreadyAdded && handleAdd(space.roomId)}
                  disabled={adding === space.roomId || alreadyAdded}
                >
                  <Avatar src={space.avatarUrl} name={space.name} size="sm" />
                  <span className={styles.spaceName}>{space.name}</span>
                  {alreadyAdded && <span className={styles.check}>✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
