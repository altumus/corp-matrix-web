import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { Spinner } from '../../../shared/ui/index.js'
import { useAuthenticatedMedia } from '../../../shared/hooks/useAuthenticatedMedia.js'
import styles from './Lightbox.module.scss'

export type MediaType = 'image' | 'video' | 'file' | 'audio'

interface LightboxProps {
  mxcUrl: string
  filename: string
  mediaType: MediaType
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  currentIndex?: number
  total?: number
}

export function Lightbox({
  mxcUrl, filename, mediaType, onClose, onPrev, onNext, currentIndex, total,
}: LightboxProps) {
  const src = useAuthenticatedMedia(mxcUrl)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
      if (e.key === 'ArrowRight' && onNext) onNext()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, onPrev, onNext])

  const handleDownload = () => {
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = filename
    a.target = '_blank'
    a.click()
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        <div className={styles.toolbar}>
          <span className={styles.filename}>
            {filename}
            {typeof currentIndex === 'number' && total && total > 1 && (
              <span className={styles.counter}> ({currentIndex + 1} / {total})</span>
            )}
          </span>
          <div className={styles.actions}>
            <button className={styles.toolBtn} onClick={handleDownload} title="Скачать">
              <Download size={18} />
            </button>
            {src && (
              <a className={styles.toolBtn} href={src} target="_blank" rel="noreferrer" title="Открыть в новой вкладке">
                <ExternalLink size={18} />
              </a>
            )}
            <button className={styles.toolBtn} onClick={onClose} title="Закрыть">
              <X size={18} />
            </button>
          </div>
        </div>

        {onPrev && (
          <button
            className={`${styles.toolBtn} ${styles.navPrev}`}
            onClick={onPrev}
            title="Предыдущее"
            aria-label="Предыдущее"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {onNext && (
          <button
            className={`${styles.toolBtn} ${styles.navNext}`}
            onClick={onNext}
            title="Следующее"
            aria-label="Следующее"
          >
            <ChevronRight size={24} />
          </button>
        )}

        <div className={styles.content}>
          {!src ? (
            <Spinner size={32} />
          ) : mediaType === 'image' ? (
            <img src={src} alt={filename} className={styles.image} />
          ) : mediaType === 'video' ? (
            <video src={src} controls autoPlay className={styles.video}>
              <track kind="captions" />
            </video>
          ) : mediaType === 'audio' ? (
            <div className={styles.audioWrap}>
              <audio src={src} controls autoPlay />
              <span className={styles.audioName}>{filename}</span>
            </div>
          ) : (
            <div className={styles.filePreview}>
              <span className={styles.fileIcon}>📄</span>
              <span className={styles.fileName}>{filename}</span>
              <button className={styles.downloadBtn} onClick={handleDownload}>
                <Download size={16} /> Скачать
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
