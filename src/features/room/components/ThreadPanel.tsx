import { useRef, useState, useCallback, useEffect, lazy, Suspense, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send, ArrowLeft, Copy, Quote, Reply, Forward, Link, Pencil, Trash2, Smile } from 'lucide-react'
import { useThread } from '../hooks/useThread.js'
import { Avatar } from '../../../shared/ui/index.js'
import { editMessage, sendReaction, redactMessage } from '../../messaging/services/messageService.js'
import { useSendMessage } from '../../messaging/hooks/useSendMessage.js'
import { useMentions, type MentionCandidate } from '../../messaging/hooks/useMentions.js'
import { MentionPopup } from '../../messaging/components/MentionPopup.js'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery.js'
import { MessageContent } from './MessageContent.js'
import { ReplyPreview } from './ReplyPreview.js'
import { ReactionBar } from './ReactionBar.js'
import { MessageContextMenu, type ContextMenuAction } from '../../messaging/components/MessageContextMenu.js'
import { ForwardDialog } from '../../messaging/components/ForwardDialog.js'
import type { TimelineEvent } from '../types.js'
import type { MediaType } from '../../media/components/Lightbox.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { UserProfilePopup } from './UserProfilePopup.js'
import styles from './ThreadPanel.module.scss'

const Lightbox = lazy(() =>
  import('../../media/components/Lightbox.js').then((m) => ({ default: m.Lightbox })),
)
const EmojiPicker = lazy(() =>
  import('../../messaging/components/EmojiPicker.js').then((m) => ({ default: m.EmojiPicker })),
)

function getMentionContext(text: string, cursorPos: number): { query: string; start: number } | null {
  const before = text.slice(0, cursorPos)
  const match = before.match(/@([^\s@]*)$/)
  if (!match) return null
  return { query: match[1], start: before.length - match[0].length }
}

interface ThreadPanelProps {
  roomId: string
  threadRootId: string
  onClose: () => void
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

interface ThreadReplyTarget {
  eventId: string
  sender: string
  body: string
  quotedText?: string
}

function ThreadMessage({
  event,
  roomId,
  showAvatar,
  isRoot,
  onReply,
  onEdit,
}: {
  event: TimelineEvent
  roomId: string
  showAvatar: boolean
  isRoot?: boolean
  onReply?: (target: ThreadReplyTarget) => void
  onEdit?: (target: { eventId: string; body: string }) => void
}) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const myUserId = client?.getUserId()
  const isOwn = event.sender === myUserId
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [lightbox, setLightbox] = useState<{ mxcUrl: string; filename: string; mediaType: MediaType } | null>(null)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [showForwardDialog, setShowForwardDialog] = useState(false)
  const [optimisticReactions, setOptimisticReactions] = useState<Map<string, Set<string>> | null>(null)
  const [profilePopup, setProfilePopup] = useState<DOMRect | null>(null)
  const replyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOptimisticReactions(null)
  }, [event.reactions])

  const displayReactions = optimisticReactions ?? event.reactions

  const handleReactionClick = (key: string) => {
    const current = new Map(displayReactions)
    const senders = new Set(current.get(key) || [])
    if (myUserId && senders.has(myUserId)) {
      senders.delete(myUserId)
      if (senders.size === 0) current.delete(key)
      else current.set(key, senders)
    } else if (myUserId) {
      senders.add(myUserId)
      current.set(key, senders)
    }
    setOptimisticReactions(current)
    sendReaction(roomId, event.eventId, key).catch(() => setOptimisticReactions(null))
  }

  const rawBody = (event.content.body as string) || ''
  const body = event.replyTo ? stripReplyFallback(rawBody) : rawBody
  const rawFormatted = event.content.formatted_body as string | undefined
  const formattedBody = event.replyTo && rawFormatted ? stripHtmlReplyFallback(rawFormatted) : rawFormatted

  const selectedText = contextMenu ? (window.getSelection()?.toString().trim() || '') : ''

  const contextMenuActions: ContextMenuAction[] = [
    {
      id: 'reply',
      icon: <Reply size={16} />,
      label: t('messages.reply'),
      onClick: () => {
        setContextMenu(null)
        onReply?.({
          eventId: event.eventId,
          sender: event.senderName,
          body: rawBody,
        })
      },
    },
    {
      id: 'reply-quote',
      icon: <Quote size={16} />,
      label: t('messages.replyWithQuote'),
      hidden: !selectedText,
      onClick: () => {
        setContextMenu(null)
        onReply?.({
          eventId: event.eventId,
          sender: event.senderName,
          body: rawBody,
          quotedText: selectedText,
        })
      },
    },
    {
      id: 'edit',
      icon: <Pencil size={16} />,
      label: t('messages.edit'),
      hidden: !isOwn,
      onClick: () => {
        setContextMenu(null)
        onEdit?.({ eventId: event.eventId, body: rawBody })
      },
    },
    {
      id: 'copy',
      icon: <Copy size={16} />,
      label: t('messages.copyText'),
      onClick: () => {
        const textToCopy = selectedText || rawBody
        navigator.clipboard.writeText(textToCopy)
      },
    },
    {
      id: 'copy-link',
      icon: <Link size={16} />,
      label: t('messages.copyLink'),
      onClick: () => {
        const link = `https://matrix.to/#/${encodeURIComponent(roomId)}/${encodeURIComponent(event.eventId)}`
        navigator.clipboard.writeText(link)
      },
    },
    {
      id: 'forward',
      icon: <Forward size={16} />,
      label: t('messages.forward'),
      onClick: () => {
        setContextMenu(null)
        setShowForwardDialog(true)
      },
    },
    {
      id: 'react',
      icon: <Smile size={16} />,
      label: t('messages.react'),
      onClick: () => {
        setContextMenu(null)
        setShowReactionPicker(true)
      },
    },
    {
      id: 'remove',
      icon: <Trash2 size={16} />,
      label: t('messages.remove'),
      danger: true,
      hidden: !isOwn,
      onClick: () => {
        if (confirm(t('messages.remove') + '?')) {
          redactMessage(roomId, event.eventId)
        }
      },
    },
  ]

  const avatarSize = isRoot ? 'sm' : 'xs'
  const placeholderWidth = isRoot ? 32 : 24

  if (event.isRedacted) {
    return (
      <div className={styles.reply}>
        {showAvatar ? (
          <button
            className={styles.avatarClickable}
            onClick={(e) => setProfilePopup(e.currentTarget.getBoundingClientRect())}
          >
            <Avatar src={event.senderAvatar} name={event.senderName} size={avatarSize} />
          </button>
        ) : (
          <div style={{ width: placeholderWidth, flexShrink: 0 }} />
        )}
        <div className={styles.replyContent}>
          {showAvatar && <span className={styles.replySender}>{event.senderName}</span>}
          <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Сообщение удалено</span>
        </div>
        {profilePopup && (
          <UserProfilePopup
            userId={event.sender}
            roomId={roomId}
            onClose={() => setProfilePopup(null)}
            anchorRect={profilePopup}
          />
        )}
      </div>
    )
  }

  return (
    <div
      ref={replyRef}
      className={styles.reply}
      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
    >
      {showAvatar ? (
        <button
          className={styles.avatarClickable}
          onClick={(e) => setProfilePopup(e.currentTarget.getBoundingClientRect())}
        >
          <Avatar src={event.senderAvatar} name={event.senderName} size={avatarSize} />
        </button>
      ) : (
        <div style={{ width: placeholderWidth, flexShrink: 0 }} />
      )}
      <div className={styles.replyContent}>
        {showAvatar && (
          <div className={styles.replyHeader}>
            <button
              className={styles.senderClickable}
              onClick={(e) => setProfilePopup(e.currentTarget.getBoundingClientRect())}
            >
              {event.senderName}
            </button>
            <time className={styles.replyTime}>
              {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
        )}
        {!showAvatar && (
          <time className={styles.replyTimeInline}>
            {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
        )}
        {event.replyToEvent && event.replyTo && (
          <ReplyPreview
            sender={event.replyToEvent.sender}
            body={event.replyToEvent.body}
            onNavigate={() => {}}
          />
        )}
        <MessageContent
          content={event.content}
          eventType={event.type}
          eventId={event.eventId}
          roomId={roomId}
          body={body}
          formattedBody={formattedBody}
          isEdited={event.isEdited}
          onLightbox={setLightbox}
        />
        <ReactionBar
          reactions={displayReactions}
          myUserId={myUserId ?? null}
          onReactionClick={handleReactionClick}
          onShowDetails={() => {}}
        />
      </div>

      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenuActions}
          receipts={[]}
          onClose={() => setContextMenu(null)}
          onQuickReact={(emoji) => {
            setContextMenu(null)
            sendReaction(roomId, event.eventId, emoji)
          }}
        />
      )}

      {showReactionPicker && (
        <Suspense fallback={null}>
          <EmojiPicker
            anchorRef={replyRef}
            onSelect={(emoji) => sendReaction(roomId, event.eventId, emoji)}
            onClose={() => setShowReactionPicker(false)}
          />
        </Suspense>
      )}

      {lightbox && (
        <Suspense fallback={null}>
          <Lightbox
            mxcUrl={lightbox.mxcUrl}
            filename={lightbox.filename}
            mediaType={lightbox.mediaType}
            onClose={() => setLightbox(null)}
          />
        </Suspense>
      )}

      {showForwardDialog && (
        <ForwardDialog
          fromRoomId={roomId}
          eventId={event.eventId}
          onClose={() => setShowForwardDialog(false)}
        />
      )}

      {profilePopup && (
        <UserProfilePopup
          userId={event.sender}
          roomId={roomId}
          onClose={() => setProfilePopup(null)}
          anchorRect={profilePopup}
        />
      )}
    </div>
  )
}

export function ThreadPanel({ roomId, threadRootId, onClose }: ThreadPanelProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const { rootEvent, replies } = useThread(roomId, threadRootId)
  const [text, setText] = useState('')
  const [replyTarget, setReplyTarget] = useState<ThreadReplyTarget | null>(null)
  const [editTarget, setEditTarget] = useState<{ eventId: string; body: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const repliesEndRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const { send } = useSendMessage(roomId)
  const { candidates, active: mentionActive, open: openMention, close: closeMention } = useMentions(roomId)
  const mentionStartRef = useRef<number>(-1)
  const [mentionIndex, setMentionIndex] = useState(0)

  // Mark the thread as read when the user opens it / new replies arrive.
  // SDK attaches thread_id automatically for thread-scoped receipts.
  const lastSeenReplyIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!client) return
    const lastReply = replies[replies.length - 1] ?? rootEvent
    if (!lastReply) return
    if (lastSeenReplyIdRef.current === lastReply.eventId) return
    lastSeenReplyIdRef.current = lastReply.eventId

    const room = client.getRoom(roomId)
    const matrixEvent = room?.findEventById(lastReply.eventId)
    if (!matrixEvent) return

    void (async () => {
      const { getSendReadReceipts } = await import('../../settings/components/PrivacySettings.js')
      if (!getSendReadReceipts()) return
      client.sendReadReceipt(matrixEvent).catch(() => {})
    })()
  }, [client, roomId, rootEvent, replies])

  const insertMention = useCallback((candidate: MentionCandidate) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = mentionStartRef.current
    if (start === -1) return

    const before = text.slice(0, start)
    const after = text.slice(textarea.selectionStart)
    const mention = `@${candidate.displayName} `
    const newText = before + mention + after
    setText(newText)
    closeMention()
    setMentionIndex(0)
    mentionStartRef.current = -1

    requestAnimationFrame(() => {
      const pos = before.length + mention.length
      textarea.setSelectionRange(pos, pos)
      textarea.focus()
    })
  }, [text, closeMention])

  const handleReply = useCallback((target: ThreadReplyTarget) => {
    setReplyTarget(target)
    setEditTarget(null)
    textareaRef.current?.focus()
  }, [])

  const handleEdit = useCallback((target: { eventId: string; body: string }) => {
    setEditTarget(target)
    setReplyTarget(null)
    setText(target.body)
    textareaRef.current?.focus()
  }, [])

  // Auto-scroll to bottom on new replies
  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies.length])

  const handleSend = useCallback(async () => {
    if (!text.trim()) return

    if (editTarget) {
      await editMessage(roomId, editTarget.eventId, text.trim())
      setEditTarget(null)
    } else {
      const ok = await send(
        text.trim(),
        replyTarget?.eventId,
        replyTarget?.quotedText,
        replyTarget?.quotedText ? replyTarget.sender : undefined,
        threadRootId,
      )
      if (!ok) return
      setReplyTarget(null)
    }

    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, roomId, threadRootId, replyTarget, editTarget, send])

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
          <ThreadMessage
            event={rootEvent}
            roomId={roomId}
            showAvatar
            isRoot
            onReply={handleReply}
            onEdit={handleEdit}
          />
        </div>
      )}

      <div className={styles.replies}>
        {replies.map((ev, i) => {
          const prev = i > 0 ? replies[i - 1] : null
          const showAvatar = !prev || prev.sender !== ev.sender
          return (
            <ThreadMessage
              key={ev.eventId}
              event={ev}
              roomId={roomId}
              showAvatar={showAvatar}
              onReply={handleReply}
              onEdit={handleEdit}
            />
          )
        })}
        <div ref={repliesEndRef} />
      </div>

      {(replyTarget || editTarget) && (
        <div className={styles.composerPreview}>
          <div className={styles.previewContent}>
            <span className={styles.previewLabel}>
              {editTarget ? 'Редактирование' : `Ответ ${replyTarget!.sender}`}
            </span>
            <span className={styles.previewBody}>
              {editTarget ? editTarget.body : replyTarget!.body}
            </span>
          </div>
          <button
            className={styles.closeBtn}
            onClick={() => { setReplyTarget(null); setEditTarget(null); setText('') }}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form className={styles.composer} onSubmit={handleSubmit} style={{ position: 'relative' }}>
        {mentionActive && candidates.length > 0 && (
          <MentionPopup
            candidates={candidates}
            selectedIndex={mentionIndex}
            onSelect={insertMention}
          />
        )}
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          onChange={(e) => {
            const value = e.target.value
            setText(value)
            const ta = textareaRef.current
            if (ta) {
              ta.style.height = 'auto'
              ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`

              const cursorPos = ta.selectionStart
              const ctx = getMentionContext(value, cursorPos)
              if (ctx) {
                mentionStartRef.current = ctx.start
                openMention(ctx.query)
                setMentionIndex(0)
              } else {
                closeMention()
                mentionStartRef.current = -1
              }
            }
          }}
          onKeyDown={(e) => {
            if (mentionActive && candidates.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setMentionIndex((i) => (i + 1) % candidates.length)
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setMentionIndex((i) => (i - 1 + candidates.length) % candidates.length)
                return
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                insertMention(candidates[mentionIndex])
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                closeMention()
                mentionStartRef.current = -1
                return
              }
            }
            handleKeyDown(e)
          }}
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
