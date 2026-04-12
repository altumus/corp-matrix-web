import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Modal, Avatar } from '../../../shared/ui/index.js'
import { useRoomListStore } from '../../room-list/store/roomListStore.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { forwardMessage } from '../services/messageService.js'
import styles from './ForwardDialog.module.scss'

interface ForwardDialogProps {
  fromRoomId: string
  eventId: string | string[]
  onClose: () => void
}

export function ForwardDialog({ fromRoomId, eventId, onClose }: ForwardDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useMatrixClient()
  const rooms = useRoomListStore((s) => s.rooms)
  const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom)
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)

  const eventIds = Array.isArray(eventId) ? eventId : [eventId]

  const filteredRooms = useMemo(() => {
    const joined = rooms.filter((r) => !r.isInvite)
    if (!search.trim()) return joined
    const q = search.toLowerCase()
    return joined.filter((r) => r.name.toLowerCase().includes(q))
  }, [rooms, search])

  const handleForward = async (toRoomId: string) => {
    if (sending) return
    setSending(true)
    try {
      const fromRoom = client?.getRoom(fromRoomId)
      const toRoom = client?.getRoom(toRoomId)
      if (fromRoom?.hasEncryptionStateEvent() && !toRoom?.hasEncryptionStateEvent()) {
        if (!confirm('Целевая комната не зашифрована. Сообщение будет отправлено в открытом виде. Продолжить?')) {
          setSending(false)
          return
        }
      }
      for (const id of eventIds) {
        await forwardMessage(fromRoomId, id, toRoomId)
      }
      setSelectedRoom(toRoomId)
      navigate(`/rooms/${encodeURIComponent(toRoomId)}`)
      onClose()
    } catch {
      setSending(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('messages.forward')}>
      <div className={styles.container}>
        <input
          className={styles.search}
          type="text"
          placeholder={t('rooms.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className={styles.list}>
          {filteredRooms.map((room) => (
            <button
              key={room.roomId}
              className={styles.roomItem}
              onClick={() => handleForward(room.roomId)}
              disabled={sending}
            >
              <Avatar src={room.avatarUrl} name={room.name} size="sm" />
              <span className={styles.roomName}>{room.name}</span>
            </button>
          ))}
          {filteredRooms.length === 0 && (
            <div className={styles.empty}>{t('search.noResults')}</div>
          )}
        </div>
      </div>
    </Modal>
  )
}
