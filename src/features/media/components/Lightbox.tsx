import { useEffect } from 'react'
import styles from './Lightbox.module.scss'

interface LightboxProps {
  src: string
  alt?: string
  onClose: () => void
}

export function Lightbox({ src, alt = '', onClose }: LightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className={styles.image} />
        <button className={styles.close} onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
      </div>
    </div>
  )
}
