import { useEffect, useRef, useCallback, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../shared/ui/index.js'
import styles from './ImagePreviewDialog.module.scss'

interface ImagePreviewDialogProps {
  file: File
  onConfirm: () => void
  onCancel: () => void
}

export function ImagePreviewDialog({ file, onConfirm, onCancel }: ImagePreviewDialogProps) {
  const { t } = useTranslation()
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (imgRef.current) {
      imgRef.current.src = url
    }
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, onConfirm])

  const handleOverlayClick = useCallback((e: MouseEvent) => {
    if (e.target === e.currentTarget) onCancel()
  }, [onCancel])

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.dialog} role="dialog" aria-modal="true">
        <h2 className={styles.title}>{t('messages.sendImage')}</h2>
        <div className={styles.preview}>
          <img ref={imgRef} alt={file.name} className={styles.image} />
        </div>
        <span className={styles.fileName}>{file.name} ({formatSize(file.size)})</span>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onConfirm}>
            {t('messages.send')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
