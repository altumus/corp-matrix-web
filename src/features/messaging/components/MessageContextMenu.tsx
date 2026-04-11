import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar } from '../../../shared/ui/index.js'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery.js'
import { useFrequentEmoji, trackEmojiUsage } from '../hooks/useFrequentEmoji.js'
import styles from './MessageContextMenu.module.scss'

export interface ContextMenuAction {
  id: string
  label: string
  icon: ReactNode
  danger?: boolean
  hidden?: boolean
  onClick: () => void
}

export interface ReceiptEntry {
  userId: string
  name: string
  avatarUrl: string | null
  ts: number
}

interface MessageContextMenuProps {
  x: number
  y: number
  actions: ContextMenuAction[]
  receipts: ReceiptEntry[]
  onClose: () => void
  onQuickReact?: (emoji: string) => void
}

export function MessageContextMenu({ x, y, actions, receipts, onClose, onQuickReact }: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [showReceipts, setShowReceipts] = useState(false)
  const isMobile = useIsMobile()
  const quickEmojis = useFrequentEmoji()

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  useEffect(() => {
    if (isMobile) return
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menu.style.left = `${x - rect.width}px`
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`
    }
  }, [x, y, showReceipts, isMobile])

  const visibleActions = actions.filter((a) => !a.hidden)

  return (
    <>
      {isMobile && <div className={styles.backdrop} onClick={onClose} />}
      <div
        ref={menuRef}
        className={`${styles.menu} ${isMobile ? styles.menuMobile : ''}`}
        style={isMobile ? undefined : { left: x, top: y }}
      >
      {onQuickReact && (
        <div className={styles.quickReactions}>
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              className={styles.quickEmoji}
              onClick={() => {
                trackEmojiUsage(emoji)
                onQuickReact(emoji)
                onClose()
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {visibleActions.map((action) => (
        <button
          key={action.id}
          className={`${styles.item} ${action.danger ? styles.danger : ''}`}
          onClick={() => {
            action.onClick()
            onClose()
          }}
        >
          <span className={styles.icon}>{action.icon}</span>
          <span className={styles.label}>{action.label}</span>
        </button>
      ))}

      {receipts.length > 0 && (
        <>
          <div className={styles.separator} />
          <button
            className={styles.receiptsRow}
            onClick={() => setShowReceipts((v) => !v)}
          >
            <span className={styles.icon}>✓</span>
            <span className={styles.label}>{receipts.length} просмотров</span>
            <div className={styles.receiptAvatars}>
              {receipts.slice(0, 3).map((r) => (
                <div key={r.userId} className={styles.receiptAvatarWrap}>
                  <Avatar src={r.avatarUrl} name={r.name} size="xs" />
                </div>
              ))}
            </div>
          </button>

          {showReceipts && (
            <div className={styles.receiptList}>
              {receipts.map((r) => (
                <div key={r.userId} className={styles.receiptItem}>
                  <Avatar src={r.avatarUrl} name={r.name} size="sm" />
                  <div className={styles.receiptInfo}>
                    <span className={styles.receiptName}>{r.name}</span>
                    <span className={styles.receiptTime}>✓ {formatReceiptTime(r.ts)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
    </>
  )
}

function formatReceiptTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `сегодня в ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `вчера в ${time}`
  }

  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} в ${time}`
}
