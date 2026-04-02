import { useRef, useState, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send } from 'lucide-react'
import { useThread } from '../hooks/useThread.js'
import { Avatar } from '../../../shared/ui/index.js'
import { sendTextMessage } from '../../messaging/services/messageService.js'
import styles from './ThreadPanel.module.scss'

interface ThreadPanelProps {
  roomId: string
  threadRootId: string
  onClose: () => void
}

export function ThreadPanel({ roomId, threadRootId, onClose }: ThreadPanelProps) {
  const { t } = useTranslation()
  const { rootEvent, replies } = useThread(roomId, threadRootId)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(async () => {
    if (!text.trim()) return
    await sendTextMessage({
      roomId,
      body: text.trim(),
      threadRootId,
    })
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, roomId, threadRootId])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSend()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t('messages.thread')}</span>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {rootEvent && (
        <div className={styles.root}>
          <Avatar src={rootEvent.senderAvatar} name={rootEvent.senderName} size="sm" />
          <div className={styles.rootContent}>
            <span className={styles.rootSender}>{rootEvent.senderName}</span>
            <span className={styles.rootBody}>{(rootEvent.content.body as string) || ''}</span>
          </div>
        </div>
      )}

      <div className={styles.replies}>
        {replies.map((ev) => (
          <div key={ev.eventId} className={styles.reply}>
            <Avatar src={ev.senderAvatar} name={ev.senderName} size="xs" />
            <div className={styles.replyContent}>
              <div className={styles.replyHeader}>
                <span className={styles.replySender}>{ev.senderName}</span>
                <time className={styles.replyTime}>
                  {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              <span className={styles.replyBody}>{(ev.content.body as string) || ''}</span>
            </div>
          </div>
        ))}
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('messages.replyInThread')}
          rows={1}
        />
        <button type="submit" className={styles.sendBtn} disabled={!text.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
