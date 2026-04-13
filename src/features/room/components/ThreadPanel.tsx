import { useRef, useState, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send, ArrowLeft } from 'lucide-react'
import { useThread } from '../hooks/useThread.js'
import { Avatar } from '../../../shared/ui/index.js'
import { sendTextMessage } from '../../messaging/services/messageService.js'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery.js'
import { sanitizeHtml } from '../../../shared/lib/sanitizeHtml.js'
import type { TimelineEvent } from '../types.js'
import styles from './ThreadPanel.module.scss'

interface ThreadPanelProps {
  roomId: string
  threadRootId: string
  onClose: () => void
}

/** Render message body — use formatted_body (HTML) when available, fallback to plain text */
function MessageBody({ event, className }: { event: TimelineEvent; className: string }) {
  const formattedBody = event.content.formatted_body as string | undefined
  const format = event.content.format as string | undefined
  const body = (event.content.body as string) || ''

  if (formattedBody && format === 'org.matrix.custom.html') {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(formattedBody) }}
      />
    )
  }

  // Plain text — wrap in sanitizeHtml to get hashtag highlighting + line breaks
  const html = sanitizeHtml(body.replace(/\n/g, '<br />'))
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

export function ThreadPanel({ roomId, threadRootId, onClose }: ThreadPanelProps) {
  const { t } = useTranslation()
  const { rootEvent, replies } = useThread(roomId, threadRootId)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isMobile = useIsMobile()

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
    <div className={`${styles.panel} ${isMobile ? styles.panelMobile : ''}`}>
      <div className={styles.header}>
        {isMobile && (
          <button className={styles.closeBtn} onClick={onClose} aria-label="Назад">
            <ArrowLeft size={18} />
          </button>
        )}
        <span className={styles.title}>{t('messages.thread')}</span>
        {!isMobile && (
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        )}
      </div>

      {rootEvent && (
        <div className={styles.root}>
          <Avatar src={rootEvent.senderAvatar} name={rootEvent.senderName} size="sm" />
          <div className={styles.rootContent}>
            <span className={styles.rootSender}>{rootEvent.senderName}</span>
            <MessageBody event={rootEvent} className={styles.rootBody} />
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
              <MessageBody event={ev} className={styles.replyBody} />
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
