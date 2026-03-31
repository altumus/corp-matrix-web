import { useTranslation } from 'react-i18next'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { redactMessage, sendReaction } from '../services/messageService.js'
import styles from './MessageActions.module.scss'

interface MessageActionsProps {
  eventId: string
  roomId: string
  sender: string
}

export function MessageActions({ eventId, roomId, sender }: MessageActionsProps) {
  const { t } = useTranslation()
  const client = getMatrixClient()
  const isOwnMessage = client?.getUserId() === sender

  const handleReact = (emoji: string) => {
    sendReaction(roomId, eventId, emoji)
  }

  const handleRemove = () => {
    if (confirm(t('messages.remove') + '?')) {
      redactMessage(roomId, eventId)
    }
  }

  return (
    <div className={styles.actions}>
      <button className={styles.btn} onClick={() => handleReact('👍')} title={t('messages.react')}>
        👍
      </button>
      <button className={styles.btn} onClick={() => handleReact('❤️')} title={t('messages.react')}>
        ❤️
      </button>
      <button className={styles.btn} title={t('messages.reply')}>
        ↩
      </button>
      <button className={styles.btn} title={t('messages.thread')}>
        💬
      </button>
      {isOwnMessage && (
        <button className={styles.btn} onClick={handleRemove} title={t('messages.remove')}>
          🗑
        </button>
      )}
    </div>
  )
}
