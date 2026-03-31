import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './MessageContextMenu.module.scss'

interface MessageContextMenuProps {
  x: number
  y: number
  onReplyWithQuote: () => void
  onCopy: () => void
  onClose: () => void
}

export function MessageContextMenu({ x, y, onReplyWithQuote, onCopy, onClose }: MessageContextMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menu.style.left = `${x - rect.width}px`
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`
    }
  }, [x, y])

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: x, top: y }}
    >
      <button className={styles.item} onClick={onReplyWithQuote}>
        {t('messages.replyWithQuote')}
      </button>
      <button className={styles.item} onClick={onCopy}>
        {t('messages.copyText')}
      </button>
    </div>
  )
}
