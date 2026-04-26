import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { redactMessage, sendReaction } from '../services/messageService.js'
import { useComposerStore } from '../store/composerStore.js'
import { EmojiPicker } from './EmojiPicker.js'
import styles from './MessageActions.module.scss'

interface MessageActionsProps {
  eventId: string
  roomId: string
  sender: string
  senderName: string
  body: string
}

export function MessageActions({ eventId, roomId, sender, senderName, body }: MessageActionsProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const isOwnMessage = client?.getUserId() === sender
  const setReplyTarget = useComposerStore((s) => s.setReplyTarget)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  const handleReact = (emoji: string) => {
    sendReaction(roomId, eventId, emoji)
  }

  const handleReply = () => {
    setReplyTarget(roomId, { eventId, sender: senderName, body })
  }

  const handleRemove = () => {
    if (confirm(t('messages.remove') + '?')) {
      redactMessage(roomId, eventId)
    }
  }

  return (
    <div ref={actionsRef} className={styles.actions}>
      <button className={styles.btn} onClick={() => handleReact('👍')} title={t('messages.react')}>
        👍
      </button>
      <button className={styles.btn} onClick={() => handleReact('❤️')} title={t('messages.react')}>
        ❤️
      </button>
      <button
        className={styles.btn}
        onClick={() => setShowEmojiPicker((v) => !v)}
        title={t('messages.emoji')}
      >
        😊
      </button>
      <button className={styles.btn} onClick={handleReply} title={t('messages.reply')}>
        ↩
      </button>
      {isOwnMessage && (
        <button className={styles.btn} onClick={handleRemove} title={t('messages.remove')}>
          🗑
        </button>
      )}
      {showEmojiPicker && (
        <EmojiPicker
          anchorRef={actionsRef}
          onSelect={(emoji) => handleReact(emoji)}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  )
}
