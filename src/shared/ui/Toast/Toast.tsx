import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { setAddToastFn, type ToastData } from './toastService.js'
import styles from './Toast.module.scss'

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    setAddToastFn((data) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { ...data, id }])
    })
    return () => {
      setAddToastFn(null)
    }
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return createPortal(
    <div className={styles.container} aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>,
    document.body,
  )
}

function ToastItem({
  toast: t,
  onRemove,
}: {
  toast: ToastData
  onRemove: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), t.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [t.id, t.duration, onRemove])

  return (
    <div className={`${styles.toast} ${styles[t.type]}`} role="alert">
      <span className={styles.message}>{t.message}</span>
      <button className={styles.close} onClick={() => onRemove(t.id)} aria-label="Закрыть">
        ✕
      </button>
    </div>
  )
}
