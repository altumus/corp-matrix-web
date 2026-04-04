import { useTranslation } from 'react-i18next'
import { useNotifications } from '../hooks/useNotifications.js'
import { Button } from '../../../shared/ui/index.js'
import styles from './NotificationSettings.module.scss'

export function NotificationSettings() {
  const { t } = useTranslation()
  const { permission, enable, pushStatus, pushError } = useNotifications()

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

      {permission === 'granted' && (
        <div className={styles.pushStatus}>
          {pushStatus === 'subscribing' && (
            <p className={styles.status}>Push: подключение...</p>
          )}
          {pushStatus === 'active' && (
            <p className={styles.status}>Push: активен</p>
          )}
          {pushStatus === 'failed' && (
            <p className={styles.statusDenied}>
              Push: ошибка — {pushError}
            </p>
          )}
          {pushStatus === 'idle' && (
            <p className={styles.status}>Push: ожидание</p>
          )}
        </div>
      )}
    </div>
  )
}
