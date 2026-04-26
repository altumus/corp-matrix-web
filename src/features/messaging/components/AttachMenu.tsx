import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, ImageIcon, Video, FileIcon } from 'lucide-react'
import styles from './AttachMenu.module.scss'

interface AttachMenuProps {
  onFileSelect: (accept: string) => void
  onPoll?: () => void
  onClose: () => void
}

export function AttachMenu({ onFileSelect, onPoll, onClose }: AttachMenuProps) {
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

  return (
    <div ref={menuRef} className={styles.menu}>
      {onPoll && (
        <button className={styles.item} onClick={() => { onClose(); onPoll() }}>
          <BarChart3 size={20} className={styles.iconPoll} />
          <span>{t('messages.startPoll')}</span>
        </button>
      )}
      <button className={styles.item} onClick={() => onFileSelect('image/*')}>
        <ImageIcon size={20} className={styles.iconImage} />
        <span>{t('messages.sendImage')}</span>
      </button>
      <button className={styles.item} onClick={() => onFileSelect('video/*')}>
        <Video size={20} className={styles.iconVideo} />
        <span>{t('messages.sendVideo')}</span>
      </button>
      <button className={styles.item} onClick={() => onFileSelect('*')}>
        <FileIcon size={20} className={styles.iconFile} />
        <span>{t('messages.sendFile')}</span>
      </button>
    </div>
  )
}
