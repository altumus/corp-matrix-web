import { useConnectionStatus } from '../../hooks/useConnectionStatus.js'
import styles from './ConnectionBanner.module.scss'

export function ConnectionBanner() {
  const status = useConnectionStatus()

  if (status === 'connected') return null

  return (
    <div className={`${styles.banner} ${styles[status]}`}>
      <span className={styles.icon}>
        {status === 'reconnecting' ? '⟳' : '⚠'}
      </span>
      <span className={styles.text}>
        {status === 'reconnecting'
          ? 'Переподключение...'
          : 'Нет соединения с сервером'}
      </span>
    </div>
  )
}
