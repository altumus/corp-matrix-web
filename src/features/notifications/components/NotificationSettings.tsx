import { useTranslation } from 'react-i18next'
import { useNotifications } from '../hooks/useNotifications.js'
import { Button } from '../../../shared/ui/index.js'
import styles from './NotificationSettings.module.scss'

export function NotificationSettings() {
  const { t } = useTranslation()
  const { permission, enable } = useNotifications()

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{t('notifications.title')}</h3>
      {permission === 'granted' ? (
        <p className={styles.status}>Уведомления включены</p>
      ) : permission === 'denied' ? (
        <p className={styles.statusDenied}>
          Уведомления заблокированы. Разрешите их в настройках браузера.
        </p>
      ) : (
        <Button onClick={enable}>{t('notifications.enable')}</Button>
      )}
    </div>
  )
}
