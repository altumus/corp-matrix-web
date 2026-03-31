import { useCallback, useState } from 'react'
import type { TimelineEvent } from '../types.js'
import { Avatar, AuthImage } from '../../../shared/ui/index.js'
import { MessageActions } from '../../messaging/components/MessageActions.js'
import { MessageContextMenu } from '../../messaging/components/MessageContextMenu.js'
import { useComposerStore } from '../../messaging/store/composerStore.js'
import { useTimelineScroll } from '../context/TimelineScrollContext.js'
import styles from './MessageBubble.module.scss'

interface MessageBubbleProps {
  event: TimelineEvent
  showAvatar: boolean
}

export function MessageBubble({ event, showAvatar }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selectedText: string } | null>(null)
  const setReplyTarget = useComposerStore((s) => s.setReplyTarget)
  const scrollToEvent = useTimelineScroll()

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim() || ''
    if (!selectedText) return

    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, selectedText })
  }, [])

  const handleReplyWithQuote = useCallback(() => {
    if (!contextMenu) return
    setReplyTarget({
      eventId: event.eventId,
      sender: event.senderName,
      body: (event.content.body as string) || '',
      quotedText: contextMenu.selectedText,
    })
    setContextMenu(null)
  }, [contextMenu, event, setReplyTarget])

  const handleCopy = useCallback(() => {
    if (!contextMenu) return
    navigator.clipboard.writeText(contextMenu.selectedText)
    setContextMenu(null)
  }, [contextMenu])

  if (event.isRedacted) {
    return (
      <div className={styles.message}>
        {showAvatar && <Avatar src={event.senderAvatar} name={event.senderName} size="sm" />}
        {!showAvatar && <div className={styles.avatarPlaceholder} />}
        <div className={styles.body}>
          <span className={styles.redacted}>Сообщение удалено</span>
        </div>
      </div>
    )
  }

  const content = event.content
  const msgtype = content.msgtype as string
  const rawBody = (content.body as string) || ''
  const body = event.replyTo ? stripReplyFallback(rawBody) : rawBody
  const rawFormatted = content.formatted_body as string | undefined
  const formattedBody = event.replyTo && rawFormatted ? stripHtmlReplyFallback(rawFormatted) : rawFormatted

  return (
    <div
      className={styles.message}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onContextMenu={handleContextMenu}
    >
      {showAvatar ? (
        <Avatar src={event.senderAvatar} name={event.senderName} size="sm" />
      ) : (
        <div className={styles.avatarPlaceholder} />
      )}

      <div className={styles.body}>
        {showAvatar && (
          <div className={styles.header}>
            <span className={styles.sender}>{event.senderName}</span>
            <time className={styles.time} dateTime={new Date(event.timestamp).toISOString()}>
              {formatTime(event.timestamp)}
            </time>
          </div>
        )}

        {event.replyToEvent && event.replyTo && (
          <div
            className={styles.replyQuote}
            onClick={() => scrollToEvent(event.replyTo!)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') scrollToEvent(event.replyTo!) }}
          >
            <span className={styles.replyQuoteSender}>{event.replyToEvent.sender}</span>
            <span className={styles.replyQuoteBody}>{event.replyToEvent.body}</span>
          </div>
        )}

        <div className={styles.content}>
          {msgtype === 'm.image' && (
            <AuthImage
              mxcUrl={content.url as string}
              alt={body}
              className={styles.imageMessage}
              loading="lazy"
            />
          )}
          {msgtype === 'm.video' && (
            <AuthImage
              mxcUrl={content.url as string}
              alt={body}
              className={styles.imageMessage}
            />
          )}
          {msgtype === 'm.file' && (
            <div className={styles.fileMessage}>
              📎 <span>{body}</span>
            </div>
          )}
          {msgtype === 'm.audio' && (
            <div className={styles.audioMessage}>
              🎤 <span>Голосовое сообщение</span>
            </div>
          )}
          {(msgtype === 'm.text' || msgtype === 'm.notice' || !msgtype) && (
            formattedBody ? (
              <div
                className={styles.textContent}
                dangerouslySetInnerHTML={{ __html: formattedBody }}
              />
            ) : (
              <p className={styles.textContent}>{body}</p>
            )
          )}
          {event.isEdited && <span className={styles.edited}>(изм.)</span>}
        </div>

        {event.reactions.size > 0 && (
          <div className={styles.reactions}>
            {[...event.reactions.entries()].map(([key, senders]) => (
              <button key={key} className={styles.reaction}>
                {key} <span>{senders.size}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showActions && (
        <MessageActions
          eventId={event.eventId}
          roomId={event.roomId}
          sender={event.sender}
          senderName={event.senderName}
          body={(event.content.body as string) || ''}
        />
      )}

      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onReplyWithQuote={handleReplyWithQuote}
          onCopy={handleCopy}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function stripReplyFallback(body: string): string {
  const lines = body.split('\n')
  let i = 0
  while (i < lines.length && lines[i].startsWith('> ')) i++
  if (i > 0 && i < lines.length && lines[i] === '') i++
  return lines.slice(i).join('\n')
}

function stripHtmlReplyFallback(html: string): string {
  return html.replace(/^<mx-reply>[\s\S]*?<\/mx-reply>/, '')
}
