import { useTranslation } from 'react-i18next'
import { X, ArrowLeft, MessageSquare } from 'lucide-react'
import { Avatar } from '../../../shared/ui/index.js'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery.js'
import { useRoomThreads, type ThreadSummary } from '../hooks/useRoomThreads.js'
import { useRightPanel } from '../context/RightPanelContext.js'
import styles from './ThreadsListPanel.module.scss'

interface ThreadsListPanelProps {
  roomId: string
  onClose: () => void
}

function formatTime(ts: number): string {
  const now = new Date()
  const date = new Date(ts)
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export function ThreadsListPanel({ roomId, onClose }: ThreadsListPanelProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const threads = useRoomThreads(roomId)
  const { openThread } = useRightPanel()

  return (
    <div className={`${styles.panel} ${isMobile ? styles.panelMobile : ''}`}>
      <div className={styles.header}>
        {isMobile && (
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('common.back')}>
            <ArrowLeft size={18} />
          </button>
        )}
        <span className={styles.title}>{t('messages.threads')}</span>
        {!isMobile && (
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        )}
      </div>

      <div className={styles.list}>
        {threads.length === 0 ? (
          <div className={styles.empty}>
            <MessageSquare size={32} className={styles.emptyIcon} />
            <p className={styles.emptyText}>{t('messages.noThreads')}</p>
          </div>
        ) : (
          threads.map((thread) => (
            <ThreadItem
              key={thread.rootEventId}
              thread={thread}
              onClick={() => openThread(thread.rootEventId)}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface ThreadItemProps {
  thread: ThreadSummary
  onClick: () => void
}

function ThreadItem({ thread, onClick }: ThreadItemProps) {
  const { t } = useTranslation()
  const rootBody = thread.rootIsRedacted
    ? t('messages.removed')
    : (thread.rootBody || `[${t('messages.thread')}]`)

  return (
    <button
      className={`${styles.item} ${thread.unread ? styles.itemUnread : ''}`}
      onClick={onClick}
    >
      <Avatar src={thread.rootSenderAvatar} name={thread.rootSenderName} size="sm" />
      <div className={styles.itemBody}>
        <div className={styles.itemHeader}>
          <span className={styles.itemSender}>{thread.rootSenderName}</span>
          <time className={styles.itemTime}>{formatTime(thread.lastReplyTimestamp)}</time>
        </div>
        <p className={styles.itemRoot}>{rootBody}</p>
        <div className={styles.itemFooter}>
          <span className={styles.itemReplies}>
            {thread.unread && <span className={styles.repliesDot} aria-label="unread" />}
            <MessageSquare size={12} />
            {t('messages.threadReplies', { count: thread.replyCount })}
          </span>
          {thread.lastReplyBody && (
            <span className={styles.itemLastReply}>
              <span className={styles.itemLastReplyName}>{thread.lastReplySenderName}:</span>{' '}
              {thread.lastReplyBody}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
